const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`Missing environment variable: ${name}`);
    err.code = 'ENV_MISSING';
    err.statusCode = 500;
    throw err;
  }
  return v;
}

function envFlag(name, fallback = false) {
  const value = process.env[name];

  if (value == null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function resolveFromServerDir(filePath) {
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(__dirname, '..', filePath);
}

function buildSslConfig() {
  const inlineCa = process.env.DB_SSL_CA;
  const caPath = process.env.DB_SSL_CA_PATH;
  const sslEnabled = envFlag('DB_SSL_ENABLED', Boolean(inlineCa || caPath));

  if (!sslEnabled) {
    return undefined;
  }

  const ssl = {
    minVersion: process.env.DB_SSL_MIN_VERSION || 'TLSv1.2',
    rejectUnauthorized: envFlag('DB_SSL_REJECT_UNAUTHORIZED', true)
  };

  if (inlineCa && inlineCa.trim()) {
    ssl.ca = inlineCa.replace(/\\n/g, '\n');
    return ssl;
  }

  if (caPath && caPath.trim()) {
    const resolvedPath = resolveFromServerDir(caPath.trim());

    if (!fs.existsSync(resolvedPath)) {
      const err = new Error(`Missing CA certificate file: ${resolvedPath}`);
      err.code = 'CA_FILE_MISSING';
      err.statusCode = 500;
      throw err;
    }

    ssl.ca = fs.readFileSync(resolvedPath, 'utf8');
  }

  return ssl;
}

const pool = mysql.createPool({
  host: requireEnv('DB_HOST'),
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: requireEnv('DB_USER'),
  password: process.env.DB_PASSWORD || '',
  database: requireEnv('DB_NAME'),
  ssl: buildSslConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: false,
  charset: 'utf8mb4'
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {
      // ignore rollback errors
    }
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  query,
  withTransaction
};

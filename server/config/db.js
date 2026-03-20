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

const pool = mysql.createPool({
  host: requireEnv('DB_HOST'),
  user: requireEnv('DB_USER'),
  password: process.env.DB_PASSWORD || '',
  database: requireEnv('DB_NAME'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: false
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


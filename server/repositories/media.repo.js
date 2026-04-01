const { query } = require('../config/db');

let ensureTablePromise = null;

function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = query(
      `CREATE TABLE IF NOT EXISTS media_assets (
         id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
         mime_type VARCHAR(100) NOT NULL,
         original_name VARCHAR(255) DEFAULT NULL,
         byte_size INT UNSIGNED NOT NULL,
         data LONGBLOB NOT NULL,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP
       )`
    ).catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
}

async function insert({ mimeType, originalName = null, byteSize, data }) {
  await ensureTable();

  const result = await query(
    `INSERT INTO media_assets (mime_type, original_name, byte_size, data)
     VALUES (?, ?, ?, ?)`,
    [mimeType, originalName, byteSize, data]
  );

  return result.insertId;
}

async function findById(id) {
  await ensureTable();

  const rows = await query(
    `SELECT id, mime_type, original_name, byte_size, data, created_at
     FROM media_assets
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

module.exports = {
  insert,
  findById
};

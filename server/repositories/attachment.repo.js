const { query } = require('../config/db');

async function create({ messageId, fileName, fileType, fileSize, encryptedFilePath, thumbnailPath = null }) {
  const result = await query(
    'INSERT INTO message_attachments (message_id, file_name, file_type, file_size, encrypted_file_path, thumbnail_path) VALUES (?, ?, ?, ?, ?, ?)',
    [messageId, fileName, fileType, fileSize, encryptedFilePath, thumbnailPath]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const rows = await query('SELECT * FROM message_attachments WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
  return rows[0] || null;
}

async function listForMessage(messageId) {
  return query('SELECT * FROM message_attachments WHERE message_id = ? AND deleted_at IS NULL ORDER BY created_at ASC', [messageId]);
}

async function softDelete(id) {
  await query('UPDATE message_attachments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  return findById(id);
}

module.exports = { create, findById, listForMessage, softDelete };

const { query } = require('../config/db');
const { toSqlLimit } = require('../utils/sql');

async function create({ conversationId, senderId, encryptedContent, iv, salt }) {
  const result = await query(
    'INSERT INTO messages (conversation_id, sender_id, encrypted_content, iv, salt) VALUES (?, ?, ?, ?, ?)',
    [conversationId, senderId, encryptedContent, iv, salt]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const rows = await query('SELECT * FROM messages WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function listForConversation(conversationId, { page = 1, limit = 50 } = {}) {
  const safeLimit = toSqlLimit(limit, 50, 100);
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;
  return query(
    `SELECT m.*
     FROM messages m
     WHERE m.conversation_id = ? AND m.deleted_at IS NULL
     ORDER BY m.created_at DESC
     LIMIT ${safeLimit} OFFSET ${offset}`,
    [conversationId]
  );
}

async function updateEncrypted(id, { encryptedContent, iv, salt }) {
  await query(
    'UPDATE messages SET encrypted_content = ?, iv = ?, salt = ?, is_edited = 1, edited_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
    [encryptedContent, iv, salt, id]
  );
  return findById(id);
}

async function softDelete(id) {
  await query('UPDATE messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL', [id]);
  return findById(id);
}

async function markRead(messageId, userId) {
  await query('UPDATE messages SET is_read = 1 WHERE id = ? AND sender_id != ?', [messageId, userId]);
  await query(
    `INSERT INTO message_read_receipts (message_id, user_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP`,
    [messageId, userId]
  );
  return findById(messageId);
}

async function listReceipts(messageId) {
  return query('SELECT * FROM message_read_receipts WHERE message_id = ? ORDER BY read_at ASC', [messageId]);
}

module.exports = { create, findById, listForConversation, updateEncrypted, softDelete, markRead, listReceipts };

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

async function listForConversation(conversationId, userId, { page = 1, limit = 50, includeDeleted = false } = {}) {
  const safeLimit = toSqlLimit(limit, 50, 100);
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;
  const includeSoftDeleted = includeDeleted === true || includeDeleted === 'true';
  return query(
    `SELECT m.*
     FROM messages m
     LEFT JOIN message_visibility mv
       ON mv.message_id = m.id AND mv.user_id = ? AND mv.is_hidden = 1
     WHERE m.conversation_id = ?
       AND m.unsent_at IS NULL
       AND mv.id IS NULL
       ${includeSoftDeleted ? '' : 'AND m.deleted_at IS NULL'}
     ORDER BY m.created_at DESC
     LIMIT ${safeLimit} OFFSET ${offset}`,
    [userId, conversationId]
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

async function hardDelete(id) {
  await query(
    'UPDATE messages SET unsent_at = CURRENT_TIMESTAMP, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND unsent_at IS NULL',
    [id]
  );
  return findById(id);
}

async function countForConversation(conversationId) {
  const rows = await query(
    'SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ? AND deleted_at IS NULL AND unsent_at IS NULL',
    [conversationId]
  );
  return Number(rows[0]?.count || 0);
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

module.exports = { create, findById, listForConversation, updateEncrypted, softDelete, hardDelete, countForConversation, markRead, listReceipts };

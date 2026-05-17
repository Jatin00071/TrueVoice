const { query } = require('../config/db');

function toEnvelope(row) {
  return {
    conversationId: row.conversation_id,
    senderId: row.user_id,
    encryptedContent: row.encrypted_content,
    iv: row.iv,
    salt: row.salt
  };
}

async function create({ conversationId, userId, encryptedContent, iv, salt }) {
  const result = await query(
    `INSERT INTO message_queue (conversation_id, user_id, encrypted_content, iv, salt, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [conversationId, userId, encryptedContent, iv, salt]
  );
  return findById(result.insertId);
}

async function findById(id) {
  const rows = await query('SELECT * FROM message_queue WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function listForUser(userId) {
  return query(
    `SELECT id, conversation_id, encrypted_content, status, retry_count, max_retries, last_retry_at, created_at, error_message
     FROM message_queue
     WHERE user_id = ? AND status IN ('pending', 'failed')
     ORDER BY created_at ASC`,
    [userId]
  );
}

async function listPending({ limit = 100, userId = null } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 100, 500));
  const params = [];
  const userFilter = userId ? 'AND user_id = ?' : '';
  if (userId) params.push(userId);

  return query(
    `SELECT *
     FROM message_queue
     WHERE status = 'pending'
       AND retry_count < max_retries
       AND (last_retry_at IS NULL OR last_retry_at <= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 SECOND))
       ${userFilter}
     ORDER BY created_at ASC
     LIMIT ${safeLimit}`,
    params
  );
}

async function markSent(id) {
  await query("UPDATE message_queue SET status = 'sent', last_retry_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
  return findById(id);
}

async function markFailed(id, errorMessage = null) {
  await query(
    `UPDATE message_queue
     SET status = 'failed', retry_count = retry_count + 1, last_retry_at = CURRENT_TIMESTAMP, error_message = ?
     WHERE id = ?`,
    [errorMessage, id]
  );
  return findById(id);
}

async function bumpRetry(id, errorMessage = null) {
  await query(
    `UPDATE message_queue
     SET retry_count = retry_count + 1,
         last_retry_at = CURRENT_TIMESTAMP,
         error_message = ?,
         status = CASE WHEN retry_count + 1 >= max_retries THEN 'failed' ELSE status END
     WHERE id = ?`,
    [errorMessage, id]
  );
  return findById(id);
}

async function clearOldSuccessful() {
  await query("DELETE FROM message_queue WHERE status = 'sent' AND created_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)");
}

module.exports = { create, findById, listForUser, listPending, markSent, markFailed, bumpRetry, clearOldSuccessful, toEnvelope };

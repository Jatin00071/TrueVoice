const { query } = require('../config/db');

async function upsert({ conversationId, userId, is_pinned = 0, is_muted = 0, is_blocked = 0, is_hidden = 0, pinnedAt = null, mutedUntil = null, blockedAt = null, deletedAt = null }) {
  await query(
    `INSERT INTO conversation_settings (conversation_id, user_id, is_pinned, is_muted, is_blocked, is_hidden, pinned_at, muted_until, blocked_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       is_pinned = VALUES(is_pinned),
       is_muted = VALUES(is_muted),
       is_blocked = VALUES(is_blocked),
       is_hidden = VALUES(is_hidden),
       pinned_at = VALUES(pinned_at),
       muted_until = VALUES(muted_until),
       blocked_at = VALUES(blocked_at),
       deleted_at = VALUES(deleted_at),
       updated_at = CURRENT_TIMESTAMP`,
    [conversationId, userId, is_pinned, is_muted, is_blocked, is_hidden, pinnedAt, mutedUntil, blockedAt, deletedAt]
  );
  return find(conversationId, userId);
}

async function find(conversationId, userId) {
  const rows = await query('SELECT * FROM conversation_settings WHERE conversation_id = ? AND user_id = ? LIMIT 1', [conversationId, userId]);
  return rows[0] || null;
}

async function remove(conversationId, userId) {
  await query('DELETE FROM conversation_settings WHERE conversation_id = ? AND user_id = ?', [conversationId, userId]);
  return true;
}

async function listForUser(userId) {
  return query('SELECT * FROM conversation_settings WHERE user_id = ? AND is_hidden = 0', [userId]);
}

module.exports = { upsert, find, remove, listForUser };

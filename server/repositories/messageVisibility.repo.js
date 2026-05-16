const { query } = require('../config/db');

async function hide(messageId, userId) {
  await query(
    `INSERT INTO message_visibility (message_id, user_id, is_hidden, hidden_at)
     VALUES (?, ?, 1, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE is_hidden = 1, hidden_at = CURRENT_TIMESTAMP`,
    [messageId, userId]
  );
  return { message_id: messageId, user_id: userId, is_hidden: 1 };
}

async function listHiddenIds(userId, conversationId) {
  const rows = await query(
    `SELECT mv.message_id
     FROM message_visibility mv
     JOIN messages m ON m.id = mv.message_id
     WHERE mv.user_id = ? AND mv.is_hidden = 1 AND m.conversation_id = ?`,
    [userId, conversationId]
  );
  return rows.map((row) => row.message_id);
}

module.exports = { hide, listHiddenIds };

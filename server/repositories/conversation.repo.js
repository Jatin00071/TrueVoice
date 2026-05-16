const { query } = require('../config/db');
const { toSqlLimit } = require('../utils/sql');

function normalizePair(a, b) {
  const first = Number(a);
  const second = Number(b);
  if (!Number.isFinite(first) || !Number.isFinite(second) || first === second) {
    throw { error: true, message: 'Invalid conversation participants', code: 'VALIDATION_ERROR', statusCode: 400 };
  }
  return first < second ? [first, second] : [second, first];
}

async function findById(id) {
  const rows = await query(
    `SELECT c.*,
            u1.username AS user_1_username, u1.display_name AS user_1_display_name, u1.avatar_url AS user_1_avatar_url,
            u2.username AS user_2_username, u2.display_name AS user_2_display_name, u2.avatar_url AS user_2_avatar_url
     FROM conversations c
     JOIN users u1 ON u1.id = c.user_1_id
     JOIN users u2 ON u2.id = c.user_2_id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findBetween(userA, userB) {
  const [user1, user2] = normalizePair(userA, userB);
  const rows = await query('SELECT * FROM conversations WHERE user_1_id = ? AND user_2_id = ? LIMIT 1', [user1, user2]);
  return rows[0] || null;
}

async function create(userA, userB) {
  const [user1, user2] = normalizePair(userA, userB);
  await query(
    `INSERT INTO conversations (user_1_id, user_2_id, is_archived)
     VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE is_archived = 0`,
    [user1, user2]
  );
  return findBetween(user1, user2);
}

async function listForUser(userId, limit = 50) {
  const safeLimit = toSqlLimit(limit, 50);
  return query(
    `SELECT c.*,
            CASE WHEN c.user_1_id = ? THEN c.user_2_id ELSE c.user_1_id END AS other_user_id,
            CASE WHEN c.user_1_id = ? THEN u2.username ELSE u1.username END AS other_username,
            CASE WHEN c.user_1_id = ? THEN u2.display_name ELSE u1.display_name END AS other_display_name,
            CASE WHEN c.user_1_id = ? THEN u2.avatar_url ELSE u1.avatar_url END AS other_avatar_url,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.is_read = 0 AND m.deleted_at IS NULL) AS unread_count
     FROM conversations c
     JOIN users u1 ON u1.id = c.user_1_id
     JOIN users u2 ON u2.id = c.user_2_id
     WHERE (c.user_1_id = ? OR c.user_2_id = ?) AND c.is_archived = 0
     ORDER BY COALESCE(c.last_message_timestamp, c.created_at) DESC
     LIMIT ${safeLimit}`,
    [userId, userId, userId, userId, userId, userId, userId]
  );
}

async function userCanAccess(userId, conversationId) {
  const rows = await query(
    'SELECT id FROM conversations WHERE id = ? AND (user_1_id = ? OR user_2_id = ?) LIMIT 1',
    [conversationId, userId, userId]
  );
  return rows.length > 0;
}

function getOtherParticipant(conversation, userId) {
  if (!conversation) return null;
  return Number(conversation.user_1_id) === Number(userId) ? conversation.user_2_id : conversation.user_1_id;
}

async function touch(conversationId) {
  await query('UPDATE conversations SET last_message_timestamp = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);
}

async function archive(userId, conversationId) {
  await query('UPDATE conversations SET is_archived = 1 WHERE id = ? AND (user_1_id = ? OR user_2_id = ?)', [conversationId, userId, userId]);
  return findById(conversationId);
}

module.exports = { normalizePair, findById, findBetween, create, listForUser, userCanAccess, getOtherParticipant, touch, archive };

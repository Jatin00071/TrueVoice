const { query } = require('../config/db');
const { toSqlLimit } = require('../utils/sql');

async function create({ recipientId, senderId, type, postId = null }) {
  const rows = await query(
    `INSERT INTO notifications (recipient_id, sender_id, type, post_id)
     VALUES (?, ?, ?, ?)`,
    [recipientId, senderId, type, postId]
  );
  return findById(rows.insertId);
}

async function findById(id) {
  const rows = await query(
    `SELECT n.id, n.recipient_id, n.sender_id, n.type, n.post_id, n.is_read, n.created_at,
            su.username AS sender_username, su.display_name AS sender_display_name, su.avatar_url AS sender_avatar_url
     FROM notifications n
     JOIN users su ON su.id = n.sender_id
     WHERE n.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function listForUser(userId, limit = 50) {
  const safeLimit = toSqlLimit(limit, 50);
  const rows = await query(
    `SELECT n.id, n.recipient_id, n.sender_id, n.type, n.post_id, n.is_read, n.created_at,
            su.username AS sender_username, su.display_name AS sender_display_name, su.avatar_url AS sender_avatar_url
     FROM notifications n
     JOIN users su ON su.id = n.sender_id
     WHERE n.recipient_id = ?
     ORDER BY n.created_at DESC
     LIMIT ${safeLimit}`,
    [userId]
  );
  return rows;
}

async function markRead(userId, notificationId) {
  await query(`UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?`, [
    notificationId,
    userId
  ]);
  return findById(notificationId);
}

async function markAllRead(userId) {
  const rows = await query(`UPDATE notifications SET is_read = 1 WHERE recipient_id = ? AND is_read = 0`, [userId]);
  return rows.affectedRows || 0;
}

module.exports = { create, findById, listForUser, markRead, markAllRead };

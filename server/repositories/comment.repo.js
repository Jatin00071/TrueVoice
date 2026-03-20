const { query } = require('../config/db');
const { toSqlLimit } = require('../utils/sql');

async function insert({
  userId,
  postId,
  content,
  status,
  flaggedReason = null,
  deletedByShield = 0,
  toxicityCategory = null
}) {
  const rows = await query(
    `INSERT INTO comments (
       post_id, user_id, content, status, flagged_reason, deleted_by_shield, toxicity_category
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [postId, userId, content, status, flaggedReason, deletedByShield ? 1 : 0, toxicityCategory]
  );
  const id = rows.insertId;
  return findById(id);
}

async function findById(id) {
  const rows = await query(
    `SELECT c.id, c.post_id, c.user_id, c.content, c.status, c.flagged_reason,
            c.deleted_by_shield, c.toxicity_category, c.created_at, c.deleted_at,
            u.username, u.display_name, u.avatar_url, u.is_verified
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function listApproved(postId, limit = 50) {
  const safeLimit = toSqlLimit(limit, 50);
  const rows = await query(
    `SELECT c.id, c.post_id, c.user_id, c.content, c.status, c.created_at,
            u.username, u.display_name, u.avatar_url, u.is_verified
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ? AND c.deleted_at IS NULL AND c.status='approved'
     ORDER BY c.created_at DESC
     LIMIT ${safeLimit}`,
    [postId]
  );
  return rows;
}

async function listPending(postId, limit = 50) {
  const safeLimit = toSqlLimit(limit, 50);
  const rows = await query(
    `SELECT c.id, c.post_id, c.user_id, c.content, c.status, c.created_at,
            u.username, u.display_name, u.avatar_url, u.is_verified
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ? AND c.deleted_at IS NULL AND c.status='pending'
     ORDER BY c.created_at DESC
     LIMIT ${safeLimit}`,
    [postId]
  );
  return rows;
}

async function countPending(postId) {
  const rows = await query(
    `SELECT COUNT(*) AS cnt FROM comments WHERE post_id = ? AND deleted_at IS NULL AND status='pending'`,
    [postId]
  );
  return Number(rows[0]?.cnt || 0);
}

async function softDelete(commentId, userId) {
  await query(
    `UPDATE comments SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [commentId, userId]
  );
  return true;
}

async function approve(commentId, postId) {
  await query(
    `UPDATE comments SET status='approved' WHERE id = ? AND post_id = ? AND deleted_at IS NULL`,
    [commentId, postId]
  );
  return findById(commentId);
}

async function approveAllPending(postId) {
  const rows = await query(
    `UPDATE comments SET status='approved' WHERE status='pending' AND post_id = ? AND deleted_at IS NULL`,
    [postId]
  );
  return rows.affectedRows || 0;
}

module.exports = {
  insert,
  findById,
  listApproved,
  listPending,
  countPending,
  softDelete,
  approve,
  approveAllPending
};

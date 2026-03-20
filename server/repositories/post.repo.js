const { query } = require('../config/db');
const { toSqlLimit } = require('../utils/sql');

async function insert({
  userId,
  content = null,
  mediaUrl = null,
  mediaType = null,
  isReshare = 0,
  originalPostId = null,
  shieldEnabled = 0
}) {
  const rows = await query(
    `INSERT INTO posts (
       user_id, content, media_url, media_type, is_reshare, original_post_id, shield_enabled
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, content, mediaUrl, mediaType, isReshare ? 1 : 0, originalPostId, shieldEnabled ? 1 : 0]
  );
  return findById(rows.insertId);
}

async function findById(id, viewerId = null) {
  const viewerSelect = viewerId
    ? `,
            EXISTS(SELECT 1 FROM likes vl WHERE vl.post_id = p.id AND vl.user_id = ?) AS viewer_has_liked`
    : `,
            0 AS viewer_has_liked`;
  const params = viewerId ? [viewerId, id] : [id];
  const rows = await query(
    `SELECT p.id, p.user_id, p.content, p.media_url, p.media_type, p.is_reshare, p.original_post_id,
            p.shield_enabled, p.shield_active, p.post_flagged, p.post_flag_reason,
            p.shield_deleted_count, p.shield_activated_at,
            p.created_at, p.updated_at, p.deleted_at,
            u.username, u.display_name, u.avatar_url, u.is_verified,
            ou.username AS original_owner_username,
            ou.display_name AS original_owner_display_name,
            ou.avatar_url AS original_owner_avatar${viewerSelect},
            (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL AND c.status='approved') AS comment_count
     FROM posts p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN posts op ON p.original_post_id = op.id
     LEFT JOIN users ou ON op.user_id = ou.id
     WHERE p.id = ? AND p.deleted_at IS NULL`,
    params
  );
  return rows[0] || null;
}

async function update(postId, userId, { content, mediaUrl, mediaType }) {
  const result = await query(
    `UPDATE posts
     SET content = COALESCE(?, content),
         media_url = COALESCE(?, media_url),
         media_type = COALESCE(?, media_type)
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [content ?? null, mediaUrl ?? null, mediaType ?? null, postId, userId]
  );
  if (!result.affectedRows) return null;
  return findById(postId);
}

async function markAsReshare(postId, originalPostId) {
  const result = await query(
    `UPDATE posts
     SET is_reshare = 1,
         original_post_id = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [originalPostId, postId]
  );
  if (!result.affectedRows) return null;
  return findById(postId);
}

async function softDelete(postId, userId) {
  const result = await query(`UPDATE posts SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [
    postId,
    userId
  ]);
  return !!result.affectedRows;
}

async function flagAndDelete(postId, reason) {
  const result = await query(
    `UPDATE posts
     SET post_flagged = 1,
         post_flag_reason = ?,
         deleted_at = NOW()
     WHERE id = ? AND deleted_at IS NULL`,
    [reason, postId]
  );
  return !!result.affectedRows;
}

async function setShieldActive(postId, active) {
  await query(`UPDATE posts SET shield_active = ? WHERE id = ? AND deleted_at IS NULL`, [active ? 1 : 0, postId]);
}

async function feed({ userId, cursor, limit = 20 }) {
  const safeLimit = toSqlLimit(limit, 20);
  const params = [userId, userId, userId, userId];
  let cursorSql = '';
  if (cursor) {
    cursorSql = 'AND p.created_at < ?';
    params.push(cursor);
  }

  const rows = await query(
    `SELECT p.id, p.user_id, p.content, p.media_url, p.media_type, p.is_reshare, p.original_post_id,
            p.shield_enabled, p.shield_active, p.post_flagged, p.post_flag_reason,
            p.shield_deleted_count, p.shield_activated_at,
            p.created_at,
            u.username, u.display_name, u.avatar_url, u.is_verified,
            ou.username AS original_owner_username,
            ou.display_name AS original_owner_display_name,
            ou.avatar_url AS original_owner_avatar,
            EXISTS(SELECT 1 FROM likes vl WHERE vl.post_id = p.id AND vl.user_id = ?) AS viewer_has_liked,
            (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL AND c.status='approved') AS comment_count
     FROM posts p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN follows f ON f.following_id = p.user_id AND f.follower_id = ?
     LEFT JOIN posts op ON p.original_post_id = op.id
     LEFT JOIN users ou ON op.user_id = ou.id
     WHERE p.deleted_at IS NULL
       AND (f.follower_id = ? OR p.user_id = ?)
       ${cursorSql}
     ORDER BY p.created_at DESC
     LIMIT ${safeLimit}`,
    params
  );

  const nextCursor = rows.length ? rows[rows.length - 1].created_at : null;
  return { items: rows, nextCursor };
}

async function discover({ userId = null, limit = 20 }) {
  const safeLimit = toSqlLimit(limit, 20);
  const viewerSelect = userId
    ? `,
            EXISTS(SELECT 1 FROM likes vl WHERE vl.post_id = p.id AND vl.user_id = ?) AS viewer_has_liked`
    : `,
            0 AS viewer_has_liked`;
  const privacyJoin = userId ? 'LEFT JOIN follows f ON f.following_id = p.user_id AND f.follower_id = ?' : '';
  // Private accounts should only be visible to followers (approved), or the author themself.
  const privacyWhere = userId ? 'AND (u.is_private = 0 OR p.user_id = ? OR f.follower_id IS NOT NULL)' : '';

  const params = userId ? [userId, userId, userId] : [];
  const rows = await query(
    `SELECT p.id, p.user_id, p.content, p.media_url, p.media_type, p.is_reshare, p.original_post_id,
            p.shield_enabled, p.shield_active, p.post_flagged, p.post_flag_reason,
            p.shield_deleted_count, p.shield_activated_at,
            p.created_at,
            u.username, u.display_name, u.avatar_url, u.is_verified,
            ou.username AS original_owner_username,
            ou.display_name AS original_owner_display_name,
            ou.avatar_url AS original_owner_avatar${viewerSelect},
            (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL AND c.status='approved') AS comment_count
     FROM posts p
     JOIN users u ON u.id = p.user_id
     ${privacyJoin}
     LEFT JOIN posts op ON p.original_post_id = op.id
     LEFT JOIN users ou ON op.user_id = ou.id
     WHERE p.deleted_at IS NULL
       ${privacyWhere}
     ORDER BY p.created_at DESC
     LIMIT ${safeLimit}`,
    params
  );
  return rows;
}

async function getOriginChain(postId, maxDepth = 10) {
  const chain = [];
  let currentId = postId;
  for (let i = 0; i < maxDepth; i++) {
    // eslint-disable-next-line no-await-in-loop
    const p = await query(
      `SELECT id, original_post_id, is_reshare FROM posts WHERE id = ? AND deleted_at IS NULL`,
      [currentId]
    );
    const row = p[0];
    if (!row) break;
    chain.push(row);
    if (!row.original_post_id) break;
    currentId = row.original_post_id;
  }
  return chain;
}

module.exports = {
  insert,
  findById,
  update,
  markAsReshare,
  softDelete,
  flagAndDelete,
  setShieldActive,
  feed,
  discover,
  getOriginChain
};

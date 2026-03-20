const { query } = require('../config/db');

async function hasLike(postId, userId) {
  const rows = await query(`SELECT 1 FROM likes WHERE post_id = ? AND user_id = ? LIMIT 1`, [postId, userId]);
  return !!rows[0];
}

async function toggle(postId, userId) {
  const exists = await hasLike(postId, userId);
  if (exists) {
    await query(`DELETE FROM likes WHERE post_id = ? AND user_id = ?`, [postId, userId]);
    return { liked: false };
  }
  await query(`INSERT INTO likes (post_id, user_id) VALUES (?, ?)`, [postId, userId]);
  return { liked: true };
}

module.exports = { toggle, hasLike };


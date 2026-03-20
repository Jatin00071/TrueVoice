const { query } = require('../config/db');

async function isFollower(followerId, followingId) {
  const rows = await query(
    `SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1`,
    [followerId, followingId]
  );
  return !!rows[0];
}

async function toggleFollow(followerId, followingId) {
  if (followerId === followingId) {
    throw { error: true, message: 'Cannot follow yourself', code: 'VALIDATION_ERROR', statusCode: 400 };
  }
  const exists = await isFollower(followerId, followingId);
  if (exists) {
    await query(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`, [followerId, followingId]);
    return { following: false };
  }
  await query(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [followerId, followingId]);
  return { following: true };
}

module.exports = { isFollower, toggleFollow };


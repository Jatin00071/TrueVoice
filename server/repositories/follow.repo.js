const { query, withTransaction } = require('../config/db');
const { toSqlLimit } = require('../utils/sql');

async function isFollower(followerId, followingId) {
  const rows = await query(`SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1`, [
    followerId,
    followingId
  ]);
  return !!rows[0];
}

async function getIsPrivate(userId) {
  const rows = await query(`SELECT is_private FROM users WHERE id = ? LIMIT 1`, [userId]);
  return rows[0] ? !!rows[0].is_private : null;
}

async function hasFollowRequest(requesterId, recipientId) {
  const rows = await query(
    `SELECT 1 FROM follow_requests WHERE requester_id = ? AND recipient_id = ? LIMIT 1`,
    [requesterId, recipientId]
  );
  return !!rows[0];
}

async function toggleFollow(followerId, followingId) {
  if (followerId === followingId) {
    throw { error: true, message: 'Cannot follow yourself', code: 'VALIDATION_ERROR', statusCode: 400 };
  }

  const isPrivate = await getIsPrivate(followingId);
  if (isPrivate === null) {
    throw { error: true, message: 'User not found', code: 'NOT_FOUND', statusCode: 404 };
  }

  // If already a follower, toggle it off for both public/private.
  const exists = await isFollower(followerId, followingId);
  if (exists) {
    await query(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`, [followerId, followingId]);
    return { following: false };
  }

  // Private account: create/cancel a follow request instead of following.
  if (isPrivate) {
    const alreadyRequested = await hasFollowRequest(followerId, followingId);
    if (alreadyRequested) {
      await query(`DELETE FROM follow_requests WHERE requester_id = ? AND recipient_id = ?`, [
        followerId,
        followingId
      ]);
      return { requested: false, following: false };
    }

    await query(`INSERT INTO follow_requests (requester_id, recipient_id) VALUES (?, ?)`, [
      followerId,
      followingId
    ]);
    return { requested: true, following: false };
  }

  // Public account: follow directly.
  await query(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [followerId, followingId]);
  return { following: true, requested: false };
}

async function listFollowRequests(recipientId, limit = 50) {
  const safeLimit = toSqlLimit(limit, 50);
  const rows = await query(
    `SELECT fr.requester_id,
            fr.recipient_id,
            fr.created_at,
            u.username,
            u.display_name,
            u.avatar_url,
            u.is_verified
     FROM follow_requests fr
     JOIN users u ON u.id = fr.requester_id
     WHERE fr.recipient_id = ?
     ORDER BY fr.created_at DESC
     LIMIT ${safeLimit}`,
    [recipientId]
  );

  return rows;
}

async function approveFollowRequest(recipientId, requesterId) {
  const isPrivate = await getIsPrivate(recipientId);
  if (isPrivate !== true) {
    throw { error: true, message: 'Recipient account is not private', code: 'NOT_PRIVATE', statusCode: 400 };
  }

  return withTransaction(async (conn) => {
    const [reqRows] = await conn.execute(
      `SELECT 1 FROM follow_requests WHERE requester_id = ? AND recipient_id = ? LIMIT 1`,
      [requesterId, recipientId]
    );
    if (!reqRows.length) {
      throw { error: true, message: 'Follow request not found', code: 'REQUEST_NOT_FOUND', statusCode: 404 };
    }

    await conn.execute(`DELETE FROM follow_requests WHERE requester_id = ? AND recipient_id = ?`, [
      requesterId,
      recipientId
    ]);
    await conn.execute(`INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)`, [
      requesterId,
      recipientId
    ]);

    return { following: true, requested: false };
  });
}

async function rejectFollowRequest(recipientId, requesterId) {
  return withTransaction(async (conn) => {
    const [reqRows] = await conn.execute(
      `SELECT 1 FROM follow_requests WHERE requester_id = ? AND recipient_id = ? LIMIT 1`,
      [requesterId, recipientId]
    );
    if (!reqRows.length) {
      throw { error: true, message: 'Follow request not found', code: 'REQUEST_NOT_FOUND', statusCode: 404 };
    }

    await conn.execute(`DELETE FROM follow_requests WHERE requester_id = ? AND recipient_id = ?`, [
      requesterId,
      recipientId
    ]);
    return { requested: false, following: false };
  });
}

module.exports = {
  isFollower,
  hasFollowRequest,
  toggleFollow,
  listFollowRequests,
  approveFollowRequest,
  rejectFollowRequest
};

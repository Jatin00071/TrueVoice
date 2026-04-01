const { query, withTransaction } = require('../config/db');
const { toSqlLimit } = require('../utils/sql');

function stripSensitive(u) {
  if (!u) return u;
  // eslint-disable-next-line no-unused-vars
  const { password_hash, refresh_token_hash, verification_token, ...rest } = u;
  return rest;
}

async function create({ username, email, passwordHash, displayName, verificationTokenHash = null, isVerified = false }) {
  const rows = await query(
    `INSERT INTO users (username, email, password_hash, display_name, verification_token, is_verified)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [username, email, passwordHash, displayName, verificationTokenHash, isVerified ? 1 : 0]
  );
  return findById(rows.insertId);
}

async function findById(id) {
  const rows = await query(
    `SELECT id, username, email, display_name, bio, avatar_url, is_verified,
            is_private, fingerprinting_enabled, shield_enabled,
            notif_likes, notif_comments, notif_follows, notif_shield, notif_reshares,
            created_at, updated_at
     FROM users WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function getProfileByIdOrUsername(identifier) {
  const isNumeric = /^\d+$/.test(String(identifier));
  const rows = await query(
    isNumeric
      ? `SELECT u.id, u.username, u.email, u.display_name, u.bio, u.avatar_url, u.is_verified,
                u.is_private, u.fingerprinting_enabled, u.shield_enabled,
                u.notif_likes, u.notif_comments, u.notif_follows, u.notif_shield, u.notif_reshares,
                u.created_at, u.updated_at,
                (SELECT COUNT(*)
                 FROM posts p
                 WHERE p.user_id = u.id AND p.deleted_at IS NULL) AS post_count,
                (SELECT COUNT(*)
                 FROM follows f
                 WHERE f.following_id = u.id) AS follower_count,
                (SELECT COUNT(*)
                 FROM follows f2
                 WHERE f2.follower_id = u.id) AS following_count,
                (SELECT COUNT(*)
                 FROM posts p2
                 WHERE p2.original_post_id IN (
                   SELECT id FROM posts WHERE user_id = u.id
                 ) AND p2.deleted_at IS NULL) AS reshare_count
         FROM users u
         WHERE u.id = ?
         LIMIT 1`
      : `SELECT u.id, u.username, u.email, u.display_name, u.bio, u.avatar_url, u.is_verified,
                u.is_private, u.fingerprinting_enabled, u.shield_enabled,
                u.notif_likes, u.notif_comments, u.notif_follows, u.notif_shield, u.notif_reshares,
                u.created_at, u.updated_at,
                (SELECT COUNT(*)
                 FROM posts p
                 WHERE p.user_id = u.id AND p.deleted_at IS NULL) AS post_count,
                (SELECT COUNT(*)
                 FROM follows f
                 WHERE f.following_id = u.id) AS follower_count,
                (SELECT COUNT(*)
                 FROM follows f2
                 WHERE f2.follower_id = u.id) AS following_count,
                (SELECT COUNT(*)
                 FROM posts p2
                 WHERE p2.original_post_id IN (
                   SELECT id FROM posts WHERE user_id = u.id
                 ) AND p2.deleted_at IS NULL) AS reshare_count
         FROM users u
         WHERE u.username = ?
         LIMIT 1`,
    [identifier]
  );

  return stripSensitive(rows[0] || null);
}

async function findAuthByEmail(email) {
  const rows = await query(
    `SELECT id, username, email, password_hash, display_name, is_verified, verification_token, refresh_token_hash
     FROM users WHERE email = ?`,
    [email]
  );
  return rows[0] || null;
}

async function findByUsername(username) {
  const rows = await query(
    `SELECT id, username, email, password_hash, display_name, bio, avatar_url, is_verified, verification_token, refresh_token_hash
     FROM users
     WHERE username = ?
     LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

async function findAuthById(id) {
  const rows = await query(
    `SELECT id, username, email, password_hash, display_name, is_verified, verification_token, refresh_token_hash
     FROM users WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findByVerificationToken(token) {
  const rows = await query(
    `SELECT id, username, email, display_name, is_verified, verification_token
     FROM users WHERE verification_token = ?`,
    [token]
  );
  return rows[0] || null;
}

async function markVerified(userId) {
  await query(`UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?`, [userId]);
  return findById(userId);
}

async function setVerificationToken(userId, verificationTokenHash) {
  await query(
    `UPDATE users
     SET verification_token = ?, is_verified = 0
     WHERE id = ?`,
    [verificationTokenHash, userId]
  );
}

async function setRefreshTokenHash(userId, refreshTokenHash) {
  await query(`UPDATE users SET refresh_token_hash = ? WHERE id = ?`, [refreshTokenHash, userId]);
}

async function clearRefreshTokenHash(userId) {
  await query(`UPDATE users SET refresh_token_hash = NULL WHERE id = ?`, [userId]);
}

async function updateProfile(userId, { displayName, bio, avatarUrl }) {
  await query(
    `UPDATE users SET display_name = COALESCE(?, display_name),
                     bio = COALESCE(?, bio),
                     avatar_url = COALESCE(?, avatar_url)
     WHERE id = ?`,
    [displayName ?? null, bio ?? null, avatarUrl ?? null, userId]
  );
  return findById(userId);
}

async function updatePassword(userId, passwordHash) {
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

async function updateFields(userId, fields) {
  const keys = Object.keys(fields || {});
  if (!keys.length) return;

  const setClause = keys.map((key) => `${key} = ?`).join(', ');
  const values = [...keys.map((key) => fields[key]), userId];

  await query(`UPDATE users SET ${setClause} WHERE id = ?`, values);
}

async function deleteAccount(userId) {
  return withTransaction(async (conn) => {
    const [userRows] = await conn.execute('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!userRows.length) return false;

    await conn.execute('DELETE FROM notifications WHERE recipient_id = ? OR sender_id = ?', [userId, userId]);
    await conn.execute('DELETE FROM follows WHERE follower_id = ? OR following_id = ?', [userId, userId]);
    await conn.execute('DELETE FROM likes WHERE user_id = ?', [userId]);
    await conn.execute('DELETE FROM comments WHERE user_id = ?', [userId]);

    await conn.execute(
      `DELETE n FROM notifications n
       JOIN posts p ON p.id = n.post_id
       WHERE p.user_id = ?`,
      [userId]
    );
    await conn.execute(
      `DELETE l FROM likes l
       JOIN posts p ON p.id = l.post_id
       WHERE p.user_id = ?`,
      [userId]
    );
    await conn.execute(
      `DELETE c FROM comments c
       JOIN posts p ON p.id = c.post_id
       WHERE p.user_id = ?`,
      [userId]
    );
    await conn.execute(
      `DELETE se FROM shield_events se
       JOIN posts p ON p.id = se.post_id
       WHERE p.user_id = ?`,
      [userId]
    );
    await conn.execute(
      `DELETE f FROM fingerprints f
       JOIN posts p ON p.id = f.post_id
       WHERE p.user_id = ?`,
      [userId]
    );
    await conn.execute(
      `UPDATE posts p
       JOIN posts source ON source.id = p.original_post_id
       SET p.original_post_id = NULL,
           p.is_reshare = 0
       WHERE source.user_id = ?
         AND p.user_id != ?`,
      [userId, userId]
    );
    await conn.execute('DELETE FROM posts WHERE user_id = ?', [userId]);

    const [result] = await conn.execute('DELETE FROM users WHERE id = ?', [userId]);
    return Boolean(result.affectedRows);
  });
}

async function search(q, limit = 20) {
  const like = `%${q}%`;
  const safeLimit = toSqlLimit(limit, 20);
  const rows = await query(
    `SELECT id, username, email, display_name, bio, avatar_url, is_verified, created_at, updated_at
     FROM users
     WHERE username LIKE ? OR display_name LIKE ?
     ORDER BY is_verified DESC, id DESC
     LIMIT ${safeLimit}`,
    [like, like]
  );
  return rows.map(stripSensitive);
}

async function listFollowers(userId, limit = 50) {
  const safeLimit = toSqlLimit(limit, 50);
  const rows = await query(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified
     FROM follows f
     JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = ?
     ORDER BY f.created_at DESC
     LIMIT ${safeLimit}`,
    [userId]
  );
  return rows.map(stripSensitive);
}

async function listFollowing(userId, limit = 50) {
  const safeLimit = toSqlLimit(limit, 50);
  const rows = await query(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified
     FROM follows f
     JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = ?
     ORDER BY f.created_at DESC
     LIMIT ${safeLimit}`,
    [userId]
  );
  return rows.map(stripSensitive);
}

module.exports = {
  create,
  findById,
  getProfileByIdOrUsername,
  findAuthByEmail,
  findByUsername,
  findAuthById,
  findByVerificationToken,
  markVerified,
  setVerificationToken,
  setRefreshTokenHash,
  clearRefreshTokenHash,
  updateProfile,
  updatePassword,
  updateFields,
  deleteAccount,
  search,
  listFollowers,
  listFollowing
};

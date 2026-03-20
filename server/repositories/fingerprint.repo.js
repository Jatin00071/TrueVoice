const db = require('../config/db');

async function insert(postId, hash, phash, fingerprintType) {
  const [result] = await db.pool.execute(
    `INSERT INTO fingerprints
     (post_id, hash, phash, fingerprint_type)
     VALUES (?, ?, ?, ?)`,
    [postId, hash, phash || null, fingerprintType || 'image']
  );
  return result;
}

async function findByExactHash(hash) {
  const [rows] = await db.pool.execute(
    `SELECT f.*, p.user_id AS original_owner_id
     FROM fingerprints f
     JOIN posts p ON f.post_id = p.id
     WHERE f.hash = ?
     AND p.deleted_at IS NULL
     LIMIT 1`,
    [hash]
  );
  return rows[0] || null;
}

async function getAllImagePHashes() {
  const [rows] = await db.pool.execute(
    `SELECT f.post_id, f.phash, p.user_id AS original_owner_id
     FROM fingerprints f
     JOIN posts p ON f.post_id = p.id
     WHERE f.phash IS NOT NULL
     AND f.fingerprint_type IN ('image', 'both')
     AND p.deleted_at IS NULL`
  );
  return rows;
}

async function getOriginChain(postId) {
  const [rows] = await db.pool.execute(
    `WITH RECURSIVE chain AS (
       SELECT id, user_id, content, media_url, is_reshare,
              original_post_id, created_at, 0 AS depth
       FROM posts
       WHERE id = ?
       UNION ALL
       SELECT p.id, p.user_id, p.content, p.media_url, p.is_reshare,
              p.original_post_id, p.created_at, c.depth + 1
       FROM posts p
       JOIN chain c ON p.original_post_id = c.id
       WHERE p.deleted_at IS NULL AND c.depth < 20
     )
     SELECT chain.*, u.username, u.display_name, u.avatar_url
     FROM chain
     JOIN users u ON chain.user_id = u.id
     ORDER BY chain.depth ASC`,
    [postId]
  );
  return rows;
}

async function deleteByPostId(postId) {
  await db.pool.execute(
    'DELETE FROM fingerprints WHERE post_id = ?',
    [postId]
  );
}

module.exports = {
  insert,
  findByExactHash,
  getAllImagePHashes,
  getOriginChain,
  deleteByPostId
};

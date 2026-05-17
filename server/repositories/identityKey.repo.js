const { query } = require('../config/db');

let ensurePromise = null;

async function ensureTable() {
  if (!ensurePromise) {
    ensurePromise = query(
      `CREATE TABLE IF NOT EXISTS user_identity_keys (
        user_id INT UNSIGNED PRIMARY KEY,
        public_key LONGTEXT NOT NULL,
        key_fingerprint VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_fingerprint (key_fingerprint)
      )`
    ).catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

async function upsert({ userId, publicKey, keyFingerprint }) {
  await ensureTable();
  await query(
    `INSERT INTO user_identity_keys (user_id, public_key, key_fingerprint)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       public_key = VALUES(public_key),
       key_fingerprint = VALUES(key_fingerprint),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, publicKey, keyFingerprint]
  );
  return findByUserId(userId);
}

async function findByUserId(userId) {
  await ensureTable();
  const rows = await query(
    `SELECT user_id, public_key, key_fingerprint, created_at, updated_at
     FROM user_identity_keys
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { upsert, findByUserId };

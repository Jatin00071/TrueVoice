const { query } = require('../config/db');

async function upsert({ conversationId, userId, publicKey, keyFingerprint }) {
  await query(
    `INSERT INTO encryption_keys (conversation_id, user_id, public_key, key_fingerprint) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE public_key = VALUES(public_key), key_fingerprint = VALUES(key_fingerprint), created_at = CURRENT_TIMESTAMP`,
    [conversationId, userId, publicKey, keyFingerprint]
  );
  return findForUser(conversationId, userId);
}

async function findForUser(conversationId, userId) {
  const rows = await query('SELECT * FROM encryption_keys WHERE conversation_id = ? AND user_id = ? LIMIT 1', [conversationId, userId]);
  return rows[0] || null;
}

async function listForConversation(conversationId) {
  return query('SELECT id, conversation_id, user_id, public_key, key_fingerprint, created_at FROM encryption_keys WHERE conversation_id = ? ORDER BY user_id ASC', [conversationId]);
}

async function latestPublicKeyForUser(userId) {
  const rows = await query(
    'SELECT user_id, public_key, key_fingerprint, created_at FROM encryption_keys WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

module.exports = { upsert, findForUser, listForConversation, latestPublicKeyForUser };

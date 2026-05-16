const crypto = require('crypto');

const IV_PATTERN = /^[A-Za-z0-9+/=_-]{12,64}$/;
const SALT_PATTERN = /^[A-Za-z0-9+/=_-]{12,128}$/;

function assertEncryptedEnvelope(body = {}) {
  const encryptedContent = body.encryptedContent ?? body.encrypted_content;
  const { iv, salt } = body;

  if (typeof encryptedContent !== 'string' || encryptedContent.length < 1) {
    throw { error: true, message: 'Encrypted content is required', code: 'ENCRYPTED_CONTENT_REQUIRED', statusCode: 400 };
  }
  if (typeof iv !== 'string' || !IV_PATTERN.test(iv)) {
    throw { error: true, message: 'A valid encryption IV is required', code: 'INVALID_IV', statusCode: 400 };
  }
  if (typeof salt !== 'string' || !SALT_PATTERN.test(salt)) {
    throw { error: true, message: 'A valid encryption salt is required', code: 'INVALID_SALT', statusCode: 400 };
  }

  return { encryptedContent, iv, salt };
}

function fingerprintPublicKey(publicKey) {
  if (typeof publicKey !== 'string' || publicKey.length < 32) {
    throw { error: true, message: 'A valid public key is required', code: 'INVALID_PUBLIC_KEY', statusCode: 400 };
  }
  return crypto.createHash('sha256').update(publicKey).digest('hex');
}

function assertKeyExchange(body = {}) {
  const publicKey = body.publicKey ?? body.public_key;
  const conversationId = Number(body.conversationId ?? body.conversation_id);

  if (!Number.isFinite(conversationId)) {
    throw { error: true, message: 'Conversation id is required', code: 'VALIDATION_ERROR', statusCode: 400 };
  }

  const keyFingerprint = body.keyFingerprint ?? body.key_fingerprint ?? fingerprintPublicKey(publicKey);
  if (typeof keyFingerprint !== 'string' || keyFingerprint.length !== 64) {
    throw { error: true, message: 'A valid key fingerprint is required', code: 'INVALID_FINGERPRINT', statusCode: 400 };
  }

  return { conversationId, publicKey, keyFingerprint };
}

module.exports = { assertEncryptedEnvelope, assertKeyExchange, fingerprintPublicKey };

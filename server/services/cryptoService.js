const crypto = require('crypto');

function encryptionError(message, details = {}) {
  const error = { error: true, message, code: 'ENCRYPTION_REQUIRED', statusCode: 400, details };
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[Messaging] encrypted envelope validation failed:', details);
  }
  return error;
}

function decodeBase64Field(name, value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw encryptionError(`${name} is required`, { field: name, reason: 'missing' });
  }

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const buffer = Buffer.from(normalized, 'base64');
    if (!buffer.length || buffer.toString('base64').replace(/=+$/, '') !== normalized.replace(/=+$/, '')) {
      throw new Error('invalid base64');
    }
    return buffer;
  } catch (error) {
    throw encryptionError(`${name} must be base64 encoded`, { field: name, reason: error.message });
  }
}

function assertEncryptedEnvelope(body = {}) {
  const encryptedContent = body.encryptedContent ?? body.encrypted_content;
  const { iv, salt } = body;

  const ciphertext = decodeBase64Field('encrypted_content', encryptedContent);
  const ivBytes = decodeBase64Field('iv', iv);
  const saltBytes = decodeBase64Field('salt', salt);

  if (ciphertext.length < 16) {
    throw encryptionError('Encrypted content is too short', { field: 'encrypted_content', byteLength: ciphertext.length });
  }

  // The browser client uses a 12-byte AES-GCM IV, while 16-byte IVs are accepted for
  // forward compatibility with older clients/spec drafts.
  if (![12, 16].includes(ivBytes.length)) {
    throw encryptionError('A valid AES-GCM IV is required', { field: 'iv', byteLength: ivBytes.length });
  }

  if (saltBytes.length < 12) {
    throw encryptionError('A valid encryption salt is required', { field: 'salt', byteLength: saltBytes.length });
  }

  return { encryptedContent, iv, salt };
}

function fingerprintPublicKey(publicKey) {
  if (typeof publicKey !== 'string' || publicKey.length < 32 || publicKey.length > 4096) {
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

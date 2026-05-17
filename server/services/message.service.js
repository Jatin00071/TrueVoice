const messageRepo = require('../repositories/message.repo');
const messageQueueRepo = require('../repositories/messageQueue.repo');
const messageVisibilityRepo = require('../repositories/messageVisibility.repo');
const attachmentRepo = require('../repositories/attachment.repo');
const conversationRepo = require('../repositories/conversation.repo');
const encryptionKeyRepo = require('../repositories/encryptionKey.repo');
const identityKeyRepo = require('../repositories/identityKey.repo');
const userRepo = require('../repositories/user.repo');
const conversationService = require('./conversation.service');
const cryptoService = require('./cryptoService');
const messageNotificationService = require('./messageNotification.service');
const socketManager = require('../socket/socket.manager');

async function decorateMessage(message) {
  if (!message) return null;
  const attachments = await attachmentRepo.listForMessage(message.id);
  const receipts = await messageRepo.listReceipts(message.id);
  return { ...message, attachments, read_receipts: receipts };
}

async function send(userId, data) {
  const conversationId = Number(data.conversationId ?? data.conversation_id);
  if (!Number.isFinite(conversationId)) {
    throw { error: true, message: 'Conversation id is required', code: 'VALIDATION_ERROR', statusCode: 400 };
  }

  const conversation = await conversationService.ensureAccess(userId, conversationId);
  const envelope = cryptoService.assertEncryptedEnvelope(data);

  if (data.queue === true || data.status === 'pending') {
    const queued = await messageQueueRepo.create({ conversationId, userId, ...envelope });
    return {
      message: {
        id: `queue:${queued.id}`,
        queue_id: queued.id,
        conversation_id: conversationId,
        sender_id: userId,
        encrypted_content: envelope.encryptedContent,
        iv: envelope.iv,
        salt: envelope.salt,
        status: 'pending',
        attachments: [],
        read_receipts: [],
        created_at: queued.created_at
      },
      queued: true,
      willRetry: true
    };
  }

  const message = await messageRepo.create({ conversationId, senderId: userId, ...envelope });
  await conversationRepo.touch(conversationId);

  const decorated = { ...(await decorateMessage(message)), status: 'sent' };
  const recipientId = conversationRepo.getOtherParticipant(conversation, userId);
  socketManager.emit(recipientId, 'message:new', decorated);
  socketManager.emit(userId, 'message:sent', decorated);
  await messageNotificationService.notifyMessage({ recipientId, senderId: userId, conversationId, messageId: message.id });
  return { message: decorated };
}

async function list(userId, conversationId, pagination) {
  await conversationService.ensureAccess(userId, conversationId);
  const rows = await messageRepo.listForConversation(conversationId, userId, pagination);
  const items = [];
  for (const row of rows) items.push(await decorateMessage(row));
  return { items };
}

async function update(userId, messageId, data) {
  const existing = await messageRepo.findById(messageId);
  if (!existing || Number(existing.sender_id) !== Number(userId) || existing.deleted_at) {
    throw { error: true, message: 'Message not found', code: 'NOT_FOUND', statusCode: 404 };
  }
  await conversationService.ensureAccess(userId, existing.conversation_id);
  const envelope = cryptoService.assertEncryptedEnvelope(data);
  const message = await messageRepo.updateEncrypted(messageId, envelope);
  const decorated = await decorateMessage(message);
  const conversation = await conversationRepo.findById(existing.conversation_id);
  socketManager.emit(conversationRepo.getOtherParticipant(conversation, userId), 'message:edited', decorated);
  return { message: decorated };
}

async function remove(userId, messageId, type = 'soft') {
  const existing = await messageRepo.findById(messageId);
  if (!existing || existing.unsent_at) {
    throw { error: true, message: 'Message not found', code: 'NOT_FOUND', statusCode: 404 };
  }
  const conversation = await conversationService.ensureAccess(userId, existing.conversation_id);

  if (type === 'soft') {
    if (Number(existing.sender_id) !== Number(userId)) {
      throw { error: true, message: 'Only sender can soft delete', code: 'FORBIDDEN', statusCode: 403 };
    }
    const message = await messageRepo.softDelete(messageId);
    const payload = { id: messageId, conversation_id: existing.conversation_id, type: 'soft', deletedAt: message.deleted_at, timestamp: new Date().toISOString() };
    socketManager.emit(conversationRepo.getOtherParticipant(conversation, userId), 'message:deleted', payload);
    socketManager.emit(userId, 'message:deleted', payload);
    return { message, type: 'soft' };
  }

  await messageVisibilityRepo.hide(messageId, userId);
  const payload = { id: messageId, conversation_id: existing.conversation_id, type: 'hard', hiddenBy: userId, timestamp: new Date().toISOString() };
  socketManager.emit(userId, 'message:hidden', payload);
  return { message: { id: messageId }, type: 'hard', hidden: true };
}

async function unsend(userId, messageId) {
  const existing = await messageRepo.findById(messageId);
  if (!existing) {
    throw { error: true, message: 'Message not found', code: 'NOT_FOUND', statusCode: 404 };
  }
  if (existing.unsent_at) {
    throw { error: true, message: 'Message already unsent', code: 'ALREADY_UNSENT', statusCode: 404 };
  }
  if (Number(existing.sender_id) !== Number(userId)) {
    throw { error: true, message: 'Only message sender can unsend', code: 'FORBIDDEN', statusCode: 403 };
  }

  const conversation = await conversationService.ensureAccess(userId, existing.conversation_id);
  const age = Date.now() - new Date(existing.created_at).getTime();
  if (age > 15 * 60 * 1000) {
    throw {
      error: true,
      message: `Unsend window closed. Message sent ${Math.round(age / 60000)} minutes ago`,
      code: 'UNSEND_WINDOW_CLOSED',
      statusCode: 403
    };
  }

  const message = await messageRepo.hardDelete(messageId);
  const payload = { id: messageId, conversation_id: existing.conversation_id, unsentAt: message.unsent_at, timestamp: new Date().toISOString() };
  socketManager.emit(conversationRepo.getOtherParticipant(conversation, userId), 'message:unsent', payload);
  socketManager.emit(userId, 'message:unsent', payload);
  return { success: true, messageId, unsentAt: message.unsent_at };
}

async function read(userId, messageId) {
  const existing = await messageRepo.findById(messageId);
  if (!existing) {
    throw { error: true, message: 'Message not found', code: 'NOT_FOUND', statusCode: 404 };
  }
  const conversation = await conversationService.ensureAccess(userId, existing.conversation_id);
  const message = await messageRepo.markRead(messageId, userId);
  const payload = { messageId, conversationId: existing.conversation_id, userId, readAt: new Date().toISOString() };
  socketManager.emit(conversationRepo.getOtherParticipant(conversation, userId), 'message:read', payload);
  return { message, receipt: payload };
}

async function exchangeKey(userId, data) {
  const exchange = cryptoService.assertKeyExchange(data);
  const conversation = await conversationService.ensureAccess(userId, exchange.conversationId);
  await identityKeyRepo.upsert({ userId, publicKey: exchange.publicKey, keyFingerprint: exchange.keyFingerprint });
  const key = await encryptionKeyRepo.upsert({ ...exchange, userId });
  socketManager.emit(conversationRepo.getOtherParticipant(conversation, userId), 'keys:updated', {
    conversationId: exchange.conversationId,
    userId,
    publicKey: exchange.publicKey,
    keyFingerprint: exchange.keyFingerprint
  });
  return { key };
}

async function verifyKeys(userId, conversationId) {
  await conversationService.ensureAccess(userId, conversationId);
  const keys = await encryptionKeyRepo.listForConversation(conversationId);
  return { keys };
}

async function publicKey(_requesterId, userId) {
  const key = await identityKeyRepo.findByUserId(userId) || await encryptionKeyRepo.latestPublicKeyForUser(userId);
  if (!key) {
    throw { error: true, message: 'User has not initialized encryption', code: 'KEY_NOT_FOUND', statusCode: 404 };
  }
  return { key };
}

async function publishIdentityKey(userId, data) {
  const publicKey = data.publicKey ?? data.public_key;
  const keyFingerprint = data.keyFingerprint ?? data.key_fingerprint ?? cryptoService.fingerprintPublicKey(publicKey);
  if (typeof keyFingerprint !== 'string' || keyFingerprint.length !== 64) {
    throw { error: true, message: 'A valid key fingerprint is required', code: 'INVALID_FINGERPRINT', statusCode: 400 };
  }
  const key = await identityKeyRepo.upsert({ userId, publicKey, keyFingerprint });
  return { key };
}

async function conversationDetails(userId, conversationId) {
  const conversation = await conversationService.ensureAccess(userId, conversationId);
  const otherUserId = conversationRepo.getOtherParticipant(conversation, userId);
  const participant = await userRepo.findById(otherUserId);
  const encryptionKey = await identityKeyRepo.findByUserId(otherUserId) || await encryptionKeyRepo.latestPublicKeyForUser(otherUserId);
  const messageCount = await messageRepo.countForConversation(conversationId);
  return {
    conversation: {
      ...conversation,
      messageCount,
      participant: {
        ...participant,
        avatar: participant?.avatar_url || null,
        is_online: false,
        encryptionKey: encryptionKey
          ? {
              public_key: encryptionKey.public_key,
              key_fingerprint: encryptionKey.key_fingerprint,
              created_at: encryptionKey.created_at
            }
          : null
      }
    }
  };
}

async function getQueue(userId) {
  const queue = await messageQueueRepo.listForUser(userId);
  return {
    queue: queue.map((item) => ({
      id: item.id,
      conversation_id: item.conversation_id,
      encrypted_content: item.encrypted_content,
      status: item.status,
      retryCount: item.retry_count,
      maxRetries: item.max_retries,
      lastRetryAt: item.last_retry_at,
      createdAt: item.created_at,
      errorMessage: item.error_message
    })),
    pendingCount: queue.filter((item) => item.status === 'pending').length
  };
}

async function processQueue() {
  const pending = await messageQueueRepo.listPending();
  for (const item of pending) {
    try {
      const conversation = await conversationService.ensureAccess(item.user_id, item.conversation_id);
      const message = await messageRepo.create(messageQueueRepo.toEnvelope(item));
      await conversationRepo.touch(item.conversation_id);
      await messageQueueRepo.markSent(item.id);
      const decorated = { ...(await decorateMessage(message)), status: 'sent', queue_id: item.id };
      const recipientId = conversationRepo.getOtherParticipant(conversation, item.user_id);
      socketManager.emit(recipientId, 'message:new', decorated);
      socketManager.emit(item.user_id, 'message:status', {
        messageId: `queue:${item.id}`,
        queueId: item.id,
        conversationId: item.conversation_id,
        status: 'sent',
        persistedMessageId: message.id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      await messageQueueRepo.bumpRetry(item.id, error?.message || 'Queue processing failed');
    }
  }
  await messageQueueRepo.clearOldSuccessful();
}

module.exports = {
  send,
  list,
  update,
  remove,
  unsend,
  read,
  exchangeKey,
  publishIdentityKey,
  verifyKeys,
  publicKey,
  conversationDetails,
  getQueue,
  processQueue
};

const messageRepo = require('../repositories/message.repo');
const attachmentRepo = require('../repositories/attachment.repo');
const conversationRepo = require('../repositories/conversation.repo');
const encryptionKeyRepo = require('../repositories/encryptionKey.repo');
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
  const message = await messageRepo.create({ conversationId, senderId: userId, ...envelope });
  await conversationRepo.touch(conversationId);

  const decorated = await decorateMessage(message);
  const recipientId = conversationRepo.getOtherParticipant(conversation, userId);
  socketManager.emit(recipientId, 'message:new', decorated);
  socketManager.emit(userId, 'message:sent', decorated);
  await messageNotificationService.notifyMessage({ recipientId, senderId: userId, conversationId, messageId: message.id });
  return { message: decorated };
}

async function list(userId, conversationId, pagination) {
  await conversationService.ensureAccess(userId, conversationId);
  const rows = await messageRepo.listForConversation(conversationId, pagination);
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

async function remove(userId, messageId) {
  const existing = await messageRepo.findById(messageId);
  if (!existing || Number(existing.sender_id) !== Number(userId)) {
    throw { error: true, message: 'Message not found', code: 'NOT_FOUND', statusCode: 404 };
  }
  const conversation = await conversationService.ensureAccess(userId, existing.conversation_id);
  const message = await messageRepo.softDelete(messageId);
  socketManager.emit(conversationRepo.getOtherParticipant(conversation, userId), 'message:deleted', { id: messageId, conversation_id: existing.conversation_id });
  return { message };
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
  const key = await encryptionKeyRepo.latestPublicKeyForUser(userId);
  if (!key) {
    throw { error: true, message: 'User has not initialized encryption', code: 'KEY_NOT_FOUND', statusCode: 404 };
  }
  return { key };
}

module.exports = { send, list, update, remove, read, exchangeKey, verifyKeys, publicKey };

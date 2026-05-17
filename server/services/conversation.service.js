const conversationRepo = require('../repositories/conversation.repo');
const userRepo = require('../repositories/user.repo');
const conversationSettingsRepo = require('../repositories/conversationSettings.repo');
const socketManager = require('../socket/socket.manager');

function assertConversationAccess(conversation, userId) {
  if (!conversation || (Number(conversation.user_1_id) !== Number(userId) && Number(conversation.user_2_id) !== Number(userId))) {
    throw { error: true, message: 'Conversation not found', code: 'NOT_FOUND', statusCode: 404 };
  }
}

async function list(userId, { limit } = {}) {
  const items = await conversationRepo.listForUser(userId, limit);
  return { items };
}

async function get(userId, conversationId) {
  const conversation = await conversationRepo.findById(conversationId);
  assertConversationAccess(conversation, userId);
  return { conversation };
}

async function start(userId, targetUserId) {
  const target = await userRepo.findById(targetUserId);
  if (!target) {
    throw { error: true, message: 'User not found', code: 'NOT_FOUND', statusCode: 404 };
  }
  const conversation = await conversationRepo.create(userId, targetUserId);
  return { conversation };
}

async function archive(userId, conversationId) {
  const existing = await conversationRepo.findById(conversationId);
  assertConversationAccess(existing, userId);
  const conversation = await conversationRepo.archive(userId, conversationId);
  return { conversation };
}

async function pinConversation(userId, conversationId) {
  const conversation = await conversationRepo.findById(conversationId);
  assertConversationAccess(conversation, userId);
  const result = await conversationSettingsRepo.upsert({ conversationId, userId, is_pinned: 1, pinnedAt: new Date() });
  const other = conversationRepo.getOtherParticipant(conversation, userId);
  socketManager.emit(other, 'conversation:pinned', { conversationId, userId });
  return { setting: result };
}

async function muteConversation(userId, conversationId, { mutedUntil = null } = {}) {
  const conversation = await conversationRepo.findById(conversationId);
  assertConversationAccess(conversation, userId);
  const result = await conversationSettingsRepo.upsert({ conversationId, userId, is_muted: 1, mutedUntil });
  const other = conversationRepo.getOtherParticipant(conversation, userId);
  socketManager.emit(other, 'conversation:muted', { conversationId, userId, mutedUntil });
  return { setting: result };
}

async function blockConversation(userId, conversationId) {
  const conversation = await conversationRepo.findById(conversationId);
  assertConversationAccess(conversation, userId);
  const result = await conversationSettingsRepo.upsert({ conversationId, userId, is_blocked: 1, blockedAt: new Date() });
  const other = conversationRepo.getOtherParticipant(conversation, userId);
  socketManager.emit(other, 'conversation:blocked', { conversationId, userId });
  return { setting: result };
}

async function hideConversation(userId, conversationId) {
  const conversation = await conversationRepo.findById(conversationId);
  assertConversationAccess(conversation, userId);
  const result = await conversationSettingsRepo.upsert({ conversationId, userId, is_hidden: 1, deletedAt: new Date() });
  const other = conversationRepo.getOtherParticipant(conversation, userId);
  socketManager.emit(other, 'conversation:hidden', { conversationId, userId });
  return { setting: result };
}

async function ensureAccess(userId, conversationId) {
  const conversation = await conversationRepo.findById(conversationId);
  assertConversationAccess(conversation, userId);
  return conversation;
}

module.exports = { list, get, start, archive, ensureAccess, assertConversationAccess, pinConversation, muteConversation, blockConversation, hideConversation };

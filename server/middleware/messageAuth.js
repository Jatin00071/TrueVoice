const conversationService = require('../services/conversation.service');
const messageRepo = require('../repositories/message.repo');

async function requireConversationAccess(req, _res, next) {
  try {
    const conversationId = Number(req.params.id || req.params.conversationId || req.body?.conversationId || req.body?.conversation_id);
    if (!Number.isFinite(conversationId)) {
      throw { error: true, message: 'Conversation id is required', code: 'VALIDATION_ERROR', statusCode: 400 };
    }
    req.conversation = await conversationService.ensureAccess(req.auth.userId, conversationId);
    next();
  } catch (error) {
    next(error);
  }
}

async function requireMessageAccess(req, _res, next) {
  try {
    const message = await messageRepo.findById(Number(req.params.id));
    if (!message) throw { error: true, message: 'Message not found', code: 'NOT_FOUND', statusCode: 404 };
    req.conversation = await conversationService.ensureAccess(req.auth.userId, message.conversation_id);
    req.message = message;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireConversationAccess, requireMessageAccess };

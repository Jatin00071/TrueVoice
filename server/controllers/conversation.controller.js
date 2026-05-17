const conversationService = require('../services/conversation.service');
const messageService = require('../services/message.service');

async function list(req, res) {
  const result = await conversationService.list(req.auth.userId, { limit: req.query.limit });
  res.json(result);
}

async function get(req, res) {
  const result = await conversationService.get(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function details(req, res) {
  const result = await messageService.conversationDetails(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function start(req, res) {
  const result = await conversationService.start(req.auth.userId, Number(req.params.userId));
  res.status(201).json(result);
}

async function archive(req, res) {
  const result = await conversationService.archive(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function pin(req, res) {
  const result = await conversationService.pinConversation(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function mute(req, res) {
  const { mutedUntil } = req.body || {};
  const result = await conversationService.muteConversation(req.auth.userId, Number(req.params.id), { mutedUntil });
  res.json(result);
}

async function block(req, res) {
  const result = await conversationService.blockConversation(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function hide(req, res) {
  const result = await conversationService.hideConversation(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function messages(req, res) {
  const result = await messageService.list(req.auth.userId, Number(req.params.id), {
    page: req.query.page,
    limit: req.query.limit,
    includeDeleted: req.query.includeDeleted
  });
  res.json(result);
}

module.exports = { list, get, details, start, archive, messages, pin, mute, block, hide };

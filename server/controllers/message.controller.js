const messageService = require('../services/message.service');

async function send(req, res) {
  const result = await messageService.send(req.auth.userId, req.body);
  res.status(201).json(result);
}

async function update(req, res) {
  const result = await messageService.update(req.auth.userId, Number(req.params.id), req.body);
  res.json(result);
}

async function remove(req, res) {
  const result = await messageService.remove(req.auth.userId, Number(req.params.id), req.query.type || 'soft');
  res.json(result);
}

async function unsend(req, res) {
  const result = await messageService.unsend(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function read(req, res) {
  const result = await messageService.read(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function publicKey(req, res) {
  const result = await messageService.publicKey(req.auth.userId, Number(req.params.userId));
  res.json(result);
}

async function exchangeKey(req, res) {
  const result = await messageService.exchangeKey(req.auth.userId, req.body);
  res.status(201).json(result);
}

async function verifyKeys(req, res) {
  const result = await messageService.verifyKeys(req.auth.userId, Number(req.params.conversationId));
  res.json(result);
}

async function getQueue(req, res) {
  const result = await messageService.getQueue(req.auth.userId);
  res.json(result);
}

module.exports = { send, update, remove, unsend, read, publicKey, exchangeKey, verifyKeys, getQueue };

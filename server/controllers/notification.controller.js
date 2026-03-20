const notificationService = require('../services/notification.service');

async function list(req, res) {
  const items = await notificationService.list(req.auth.userId);
  res.json({ items });
}

async function read(req, res) {
  const result = await notificationService.read(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function readAll(req, res) {
  const result = await notificationService.readAll(req.auth.userId);
  res.json(result);
}

module.exports = { list, read, readAll };

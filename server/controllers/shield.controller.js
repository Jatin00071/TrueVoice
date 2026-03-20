const shieldService = require('../services/shield.service');

async function activate(req, res) {
  const result = await shieldService.activateManual(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function deactivate(req, res) {
  const result = await shieldService.deactivateManual(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function status(req, res) {
  const result = await shieldService.status(req.auth.userId, Number(req.params.id));
  res.json(result);
}

module.exports = { activate, deactivate, status };


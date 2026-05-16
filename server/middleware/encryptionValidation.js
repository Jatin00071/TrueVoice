const cryptoService = require('../services/cryptoService');

function validateEncryptedEnvelope(req, _res, next) {
  try {
    req.encryptedEnvelope = cryptoService.assertEncryptedEnvelope(req.body);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { validateEncryptedEnvelope };

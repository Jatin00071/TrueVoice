const rateLimit = require('express-rate-limit');

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: 'Too many login attempts', code: 'RATE_LIMIT', statusCode: 429 }
});

module.exports = { loginRateLimit };


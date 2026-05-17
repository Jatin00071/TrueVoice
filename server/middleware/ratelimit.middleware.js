const rateLimit = require('express-rate-limit');

const ipKeyGenerator = rateLimit.ipKeyGenerator || ((ip) => ip || 'unknown');

function requesterKey(req) {
  if (req.auth?.userId) return `user:${req.auth.userId}`;
  return ipKeyGenerator(req.ip);
}

function envInt(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function createRateLimit({ windowMs, limit, message, skipSuccessfulRequests = false, keyByRequester = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByRequester ? requesterKey : undefined,
    message: { error: true, message, code: 'RATE_LIMIT', statusCode: 429 }
  });
}

const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: envInt('RATE_LIMIT_API_MAX', 900),
  message: 'Too many requests. Please slow down.'
});

const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: envInt('RATE_LIMIT_LOGIN_MAX', 5),
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please try again later.'
});

const registerRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  limit: envInt('RATE_LIMIT_REGISTER_MAX', 5),
  message: 'Too many account creation attempts. Please try again later.'
});

const authEmailRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  limit: envInt('RATE_LIMIT_AUTH_EMAIL_MAX', 5),
  message: 'Too many email requests. Please try again later.'
});

const authTokenRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: envInt('RATE_LIMIT_AUTH_TOKEN_MAX', 60),
  message: 'Too many authentication requests. Please slow down.'
});

const writeRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  limit: envInt('RATE_LIMIT_WRITE_MAX', 60),
  keyByRequester: true,
  message: 'Too many changes in a short time. Please slow down.'
});

const uploadRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  limit: envInt('RATE_LIMIT_UPLOAD_MAX', 20),
  keyByRequester: true,
  message: 'Too many uploads. Please try again later.'
});

const searchRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  limit: envInt('RATE_LIMIT_SEARCH_MAX', 30),
  keyByRequester: true,
  message: 'Too many searches. Please slow down.'
});

const messageRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  limit: envInt('RATE_LIMIT_MESSAGE_MAX', 90),
  keyByRequester: true,
  message: 'Too many messaging actions. Please slow down.'
});

module.exports = {
  apiRateLimit,
  loginRateLimit,
  registerRateLimit,
  authEmailRateLimit,
  authTokenRateLimit,
  writeRateLimit,
  uploadRateLimit,
  searchRateLimit,
  messageRateLimit
};

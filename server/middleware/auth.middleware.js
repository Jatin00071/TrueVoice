const { isBlocked } = require('../config/blocklist');
const tokenService = require('../services/token.service');

function getBearerToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return next({ error: true, message: 'Missing Authorization token', code: 'AUTH_MISSING', statusCode: 401 });
  if (isBlocked(token)) return next({ error: true, message: 'Token revoked', code: 'AUTH_REVOKED', statusCode: 401 });

  const payload = tokenService.verifyAccessToken(token);
  req.auth = { userId: payload.userId, token };
  next();
}

function requireOwner(paramIdKey = 'id') {
  return function ownerOnly(req, res, next) {
    const id = Number(req.params[paramIdKey]);
    if (!req.auth?.userId) return next({ error: true, message: 'Unauthorized', code: 'AUTH_MISSING', statusCode: 401 });
    if (!Number.isFinite(id)) return next({ error: true, message: 'Invalid id', code: 'VALIDATION_ERROR', statusCode: 400 });
    if (req.auth.userId !== id) return next({ error: true, message: 'Forbidden', code: 'FORBIDDEN', statusCode: 403 });
    next();
  };
}

module.exports = { requireAuth, requireOwner };


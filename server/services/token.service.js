const jwt = require('jsonwebtoken');

function msFromJwtExpiry(exp) {
  // supports '15m', '7d', number (seconds)
  if (typeof exp === 'number') return exp * 1000;
  const s = String(exp || '').trim();
  const m = s.match(/^(\d+)([smhd])$/i);
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 's') return n * 1000;
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 60 * 60 * 1000;
  return n * 24 * 60 * 60 * 1000; // d
}

function signAccessToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw { error: true, message: 'JWT secret not configured', code: 'JWT_CONFIG', statusCode: 500 };
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRY || '15m' });
}

function signRefreshToken(payload) {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw { error: true, message: 'JWT refresh secret not configured', code: 'JWT_CONFIG', statusCode: 500 };
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' });
}

function signEmailVerificationToken(payload) {
  const secret = process.env.JWT_EMAIL_SECRET || process.env.JWT_SECRET;
  if (!secret) throw { error: true, message: 'JWT email secret not configured', code: 'JWT_CONFIG', statusCode: 500 };

  return jwt.sign(
    {
      ...payload,
      purpose: 'email_verification'
    },
    secret,
    { expiresIn: process.env.EMAIL_VERIFY_EXPIRY || '24h' }
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    throw { error: true, message: 'Invalid or expired token', code: 'AUTH_INVALID', statusCode: 401 };
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (e) {
    throw { error: true, message: 'Invalid or expired refresh token', code: 'AUTH_REFRESH_INVALID', statusCode: 401 };
  }
}

function verifyEmailVerificationToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_EMAIL_SECRET || process.env.JWT_SECRET);
    if (payload?.purpose !== 'email_verification') {
      throw new Error('Invalid verification token purpose');
    }
    return payload;
  } catch (e) {
    throw {
      error: true,
      message: 'Invalid or expired verification link',
      code: 'EMAIL_VERIFICATION_INVALID',
      statusCode: 400
    };
  }
}

function accessTokenExpiryMs() {
  return msFromJwtExpiry(process.env.JWT_EXPIRY || '15m');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  signEmailVerificationToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyEmailVerificationToken,
  accessTokenExpiryMs
};

const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');

const REFRESH_COOKIE = 'tv_refresh';

function parseCookies(header = '') {
  return String(header || '')
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const index = pair.indexOf('=');
      if (index === -1) return cookies;
      let key;
      let value;
      try {
        key = decodeURIComponent(pair.slice(0, index).trim());
        value = decodeURIComponent(pair.slice(index + 1).trim());
      } catch (_) {
        return cookies;
      }
      cookies[key] = value;
      return cookies;
    }, {});
}

function refreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/v1/auth',
    maxAge: tokenService.refreshTokenExpiryMs()
  };
}

function setRefreshCookie(res, refreshToken) {
  if (refreshToken) res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const { maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
}

function getRefreshToken(req) {
  return req.body?.refreshToken || parseCookies(req.headers.cookie)[REFRESH_COOKIE] || null;
}

function withoutRefreshToken(result = {}) {
  // eslint-disable-next-line no-unused-vars
  const { refreshToken, ...publicResult } = result;
  return publicResult;
}

async function register(req, res) {
  const { username, email, password, display_name, bio } = req.body || {};
  const result = await authService.register({ username, email, password, display_name, bio });
  res.json(result);
}

async function login(req, res) {
  const result = await authService.login(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.json(withoutRefreshToken(result));
}

async function refresh(req, res) {
  const result = await authService.refresh({ ...req.body, refreshToken: getRefreshToken(req) });
  setRefreshCookie(res, result.refreshToken);
  res.json(withoutRefreshToken(result));
}

async function logout(req, res) {
  const result = await authService.logout({
    userId: req.auth?.userId,
    accessToken: req.auth?.token,
    refreshToken: getRefreshToken(req)
  });
  clearRefreshCookie(res);
  res.json(result);
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  const userId = req.auth?.userId;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: 'Current password and new password are required'
    });
  }

  await authService.changePassword(userId, currentPassword, newPassword);

  return res.status(200).json({
    data: null,
    message: 'Password changed successfully'
  });
}

async function verifyEmail(req, res) {
  const token = req.body?.token || req.query?.token;
  const result = await authService.verifyEmail(token);
  res.json(result);
}

async function resendVerification(req, res) {
  const { email, username } = req.body || {};
  const result = await authService.resendVerification({ email, username });
  res.json(result);
}

async function forgotPassword(req, res) {
  const { email, username, identifier } = req.body || {};
  const result = await authService.forgotPassword({ email, username, identifier });
  res.json(result);
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body || {};
  const result = await authService.resetPassword({ token, newPassword });
  res.json(result);
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  changePassword,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword
};

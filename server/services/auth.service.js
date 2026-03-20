const bcrypt = require('bcrypt');
const userRepo = require('../repositories/user.repo');
const tokenService = require('./token.service');
const blocklist = require('../config/blocklist');

function safeUser(u) {
  if (!u) return u;
  // repository already strips most; keep defensive
  // eslint-disable-next-line no-unused-vars
  const { password_hash, refresh_token_hash, verification_token, ...rest } = u;
  return rest;
}

async function register(payload = {}) {
  const { username, email, password, display_name, bio } = payload;

  if (!username || !email || !password) {
    throw { error: true, message: 'Missing fields', code: 'VALIDATION_ERROR', statusCode: 400 };
  }

  const existingEmail = await userRepo.findAuthByEmail(email);
  if (existingEmail) {
    throw { error: true, message: 'Email already registered', code: 'DUPLICATE_EMAIL', statusCode: 409 };
  }

  const existingUsername = await userRepo.findByUsername(username);
  if (existingUsername) {
    throw { error: true, message: 'Username already taken', code: 'DUPLICATE_USERNAME', statusCode: 409 };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await userRepo.create({
    username,
    email,
    passwordHash,
    displayName: display_name || username
  });

  const profileUpdates = {};
  if (bio) profileUpdates.bio = bio;
  if (Object.keys(profileUpdates).length) {
    await userRepo.updateFields(user.id, profileUpdates);
  }

  const nextUser = await userRepo.findById(user.id);
  return {
    user: safeUser(nextUser),
    message: process.env.NODE_ENV === 'development'
      ? 'Account created. You can log in immediately.'
      : 'Account created. Please verify your email.'
  };
}

async function login(payload = {}) {
  const { email, username, password } = payload;

  if ((!email && !username) || !password) {
    throw { error: true, message: 'Missing fields', code: 'VALIDATION_ERROR', statusCode: 400 };
  }

  let authUser = null;

  if (email) {
    authUser = await userRepo.findAuthByEmail(email);
  }

  if (!authUser && username) {
    authUser = await userRepo.findByUsername(username);
  }

  if (!authUser) {
    throw { error: true, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS', statusCode: 401 };
  }

  const isMatch = await bcrypt.compare(password, authUser.password_hash);
  if (!isMatch) {
    throw { error: true, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS', statusCode: 401 };
  }

  if (process.env.NODE_ENV !== 'development' && !authUser.is_verified) {
    throw {
      code: 'UNVERIFIED_EMAIL',
      message: 'Please verify your email first',
      statusCode: 403
    };
  }

  const accessToken = tokenService.signAccessToken({ userId: authUser.id });
  const refreshToken = tokenService.signRefreshToken({ userId: authUser.id });
  const refreshHash = await bcrypt.hash(refreshToken, 12);
  await userRepo.setRefreshTokenHash(authUser.id, refreshHash);

  const user = await userRepo.findById(authUser.id);
  return { user: safeUser(user), accessToken, refreshToken };
}

async function refresh(payload = {}) {
  const { refreshToken } = payload;
  if (!refreshToken) {
    throw { error: true, message: 'Missing refresh token', code: 'AUTH_REFRESH_MISSING', statusCode: 400 };
  }
  const tokenPayload = tokenService.verifyRefreshToken(refreshToken);
  const authUser = await userRepo.findAuthById(tokenPayload.userId);
  if (!authUser || !authUser.refresh_token_hash) {
    throw { error: true, message: 'Refresh token revoked', code: 'AUTH_REFRESH_REVOKED', statusCode: 401 };
  }
  const ok = await bcrypt.compare(refreshToken, authUser.refresh_token_hash);
  if (!ok) throw { error: true, message: 'Invalid refresh token', code: 'AUTH_REFRESH_INVALID', statusCode: 401 };

  const accessToken = tokenService.signAccessToken({ userId: tokenPayload.userId });
  const newRefreshToken = tokenService.signRefreshToken({ userId: tokenPayload.userId });
  const newHash = await bcrypt.hash(newRefreshToken, 12);
  await userRepo.setRefreshTokenHash(tokenPayload.userId, newHash);

  const user = await userRepo.findById(tokenPayload.userId);
  return { user: safeUser(user), accessToken, refreshToken: newRefreshToken };
}

async function logout({ userId, accessToken }) {
  await userRepo.clearRefreshTokenHash(userId);
  if (accessToken) {
    const exp = Date.now() + tokenService.accessTokenExpiryMs();
    blocklist.block(accessToken, exp);
  }
  return { success: true };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepo.findAuthById(userId);
  if (!user) {
    throw { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 };
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw {
      code: 'INVALID_PASSWORD',
      message: 'Current password is incorrect',
      statusCode: 401
    };
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await userRepo.updatePassword(userId, newHash);
}

module.exports = { register, login, refresh, logout, changePassword };

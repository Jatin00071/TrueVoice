const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userRepo = require('../repositories/user.repo');
const tokenService = require('./token.service');
const emailService = require('./email.service');
const blocklist = require('../config/blocklist');

function safeUser(u) {
  if (!u) return u;
  // repository already strips most; keep defensive
  // eslint-disable-next-line no-unused-vars
  const { password_hash, refresh_token_hash, verification_token, password_reset_token, ...rest } = u;
  return rest;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || '').trim();
}

function hashVerificationToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function ensureEmailVerificationAvailable() {
  if (process.env.NODE_ENV === 'production' && !emailService.isConfigured()) {
    throw {
      error: true,
      message: 'Email verification is not configured on the server',
      code: 'EMAIL_NOT_CONFIGURED',
      statusCode: 503
    };
  }
}

function buildClientUrl(pathname, query = {}) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const nextUrl = new URL(pathname, clientUrl);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      nextUrl.searchParams.set(key, value);
    }
  });

  return nextUrl.toString();
}

function buildVerificationUrl(token) {
  return buildClientUrl('/verify-email', { token });
}

function buildPasswordResetUrl(token) {
  return buildClientUrl('/reset-password', { token });
}

async function sendVerificationEmail(authUser, verificationUrl) {
  try {
    return await emailService.sendVerificationEmail({
      to: authUser.email,
      username: authUser.display_name || authUser.username,
      verificationUrl
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Mail] Failed to send verification email:', emailService.formatMailError(error));
    return {
      delivered: false,
      mode: 'error'
    };
  }
}

async function sendPasswordResetEmail(authUser, resetUrl) {
  try {
    return await emailService.sendPasswordResetEmail({
      to: authUser.email,
      username: authUser.display_name || authUser.username,
      resetUrl
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Mail] Failed to send password reset email:', emailService.formatMailError(error));
    return {
      delivered: false,
      mode: 'error'
    };
  }
}

function verificationResponseFields(mailResult, verificationUrl) {
  const response = {
    verificationRequired: true,
    emailSent: Boolean(mailResult?.delivered)
  };

  if (process.env.NODE_ENV !== 'production' && verificationUrl) {
    response.verificationUrl = verificationUrl;
  }

  return response;
}

function passwordResetResponseFields(mailResult, resetUrl) {
  const response = {
    emailSent: Boolean(mailResult?.delivered)
  };

  if (process.env.NODE_ENV !== 'production' && resetUrl) {
    response.resetUrl = resetUrl;
  }

  return response;
}

async function register(payload = {}) {
  const { password, display_name, bio } = payload;
  const username = normalizeUsername(payload.username);
  const email = normalizeEmail(payload.email);

  if (!username || !email || !password) {
    throw { error: true, message: 'Missing fields', code: 'VALIDATION_ERROR', statusCode: 400 };
  }

  ensureEmailVerificationAvailable();

  const existingEmail = await userRepo.findAuthByEmail(email);
  if (existingEmail) {
    if (existingEmail.is_verified) {
      throw {
        error: true,
        message: 'This email is already registered. Sign in instead.',
        code: 'DUPLICATE_EMAIL',
        statusCode: 409
      };
    }

    const verificationToken = tokenService.signEmailVerificationToken({
      userId: existingEmail.id,
      email: existingEmail.email
    });
    const verificationUrl = buildVerificationUrl(verificationToken);
    const verificationTokenHash = hashVerificationToken(verificationToken);

    await userRepo.setVerificationToken(existingEmail.id, verificationTokenHash);

    const mailResult = await sendVerificationEmail(existingEmail, verificationUrl);

    let message = 'This email already has an unverified account. We sent a fresh verification link.';
    if (mailResult.mode === 'preview') {
      message = 'This email already has an unverified account. Email delivery is not configured, so use the development verification link below.';
    } else if (mailResult.mode === 'error') {
      message = 'This email already has an unverified account, but we could not send the verification email just now. Please request a new link from sign in.';
    }

    const user = await userRepo.findById(existingEmail.id);

    return {
      user: safeUser(user),
      existingUnverified: true,
      message,
      ...verificationResponseFields(mailResult, verificationUrl)
    };
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
    displayName: String(display_name || username).trim() || username,
    isVerified: false
  });

  const finalVerificationToken = tokenService.signEmailVerificationToken({ userId: user.id, email });
  const finalVerificationTokenHash = hashVerificationToken(finalVerificationToken);
  await userRepo.setVerificationToken(user.id, finalVerificationTokenHash);

  const profileUpdates = {};
  if (bio) profileUpdates.bio = bio;
  if (Object.keys(profileUpdates).length) {
    await userRepo.updateFields(user.id, profileUpdates);
  }

  const nextUser = await userRepo.findById(user.id);
  const verificationUrl = buildVerificationUrl(finalVerificationToken);
  const mailResult = await sendVerificationEmail(nextUser, verificationUrl);

  let message = 'Account created. Check your email to verify your account.';
  if (mailResult.mode === 'preview') {
    message = 'Account created. Email delivery is not configured, so use the development verification link below.';
  } else if (mailResult.mode === 'error') {
    message = 'Account created, but we could not send the verification email just now. Please request a new link from sign in.';
  }

  return {
    user: safeUser(nextUser),
    message,
    ...verificationResponseFields(mailResult, verificationUrl)
  };
}

async function login(payload = {}) {
  const { password } = payload;
  const email = normalizeEmail(payload.email);
  const username = normalizeUsername(payload.username);

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

  if (!authUser.is_verified) {
    throw {
      error: true,
      code: 'UNVERIFIED_EMAIL',
      message: 'Please verify your email before signing in',
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

  if (!authUser.is_verified) {
    await userRepo.clearRefreshTokenHash(tokenPayload.userId);
    throw {
      error: true,
      message: 'Please verify your email before signing in',
      code: 'UNVERIFIED_EMAIL',
      statusCode: 403
    };
  }

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

async function verifyEmail(token) {
  if (!token) {
    throw {
      error: true,
      message: 'Verification token is required',
      code: 'VALIDATION_ERROR',
      statusCode: 400
    };
  }

  const tokenPayload = tokenService.verifyEmailVerificationToken(token);
  const authUser = await userRepo.findAuthById(tokenPayload.userId);

  if (!authUser) {
    throw {
      error: true,
      message: 'Account not found',
      code: 'NOT_FOUND',
      statusCode: 404
    };
  }

  if (authUser.is_verified) {
    const user = await userRepo.findById(authUser.id);
    return {
      user: safeUser(user),
      alreadyVerified: true,
      message: 'Email already verified. You can sign in now.'
    };
  }

  const tokenHash = hashVerificationToken(token);
  if (!authUser.verification_token || authUser.verification_token !== tokenHash) {
    throw {
      error: true,
      message: 'This verification link is no longer valid. Request a new email and try again.',
      code: 'EMAIL_VERIFICATION_INVALID',
      statusCode: 400
    };
  }

  const user = await userRepo.markVerified(authUser.id);
  return {
    user: safeUser(user),
    alreadyVerified: false,
    message: 'Email verified successfully. You can sign in now.'
  };
}

async function resendVerification(payload = {}) {
  const email = normalizeEmail(payload.email);
  const username = normalizeUsername(payload.username);

  if (!email && !username) {
    throw {
      error: true,
      message: 'Email or username is required',
      code: 'VALIDATION_ERROR',
      statusCode: 400
    };
  }

  ensureEmailVerificationAvailable();

  const authUser = email
    ? await userRepo.findAuthByEmail(email)
    : await userRepo.findByUsername(username);

  if (!authUser) {
    return {
      success: true,
      message: 'If an account exists for that login, a fresh verification email has been sent.'
    };
  }

  if (authUser.is_verified) {
    return {
      success: true,
      alreadyVerified: true,
      message: 'This account is already verified. You can sign in now.'
    };
  }

  const verificationToken = tokenService.signEmailVerificationToken({
    userId: authUser.id,
    email: authUser.email
  });
  const verificationUrl = buildVerificationUrl(verificationToken);
  const verificationTokenHash = hashVerificationToken(verificationToken);

  await userRepo.setVerificationToken(authUser.id, verificationTokenHash);

  const mailResult = await sendVerificationEmail(authUser, verificationUrl);

  let message = 'A fresh verification email is on its way.';
  if (mailResult.mode === 'preview') {
    message = 'Email delivery is not configured, so use the development verification link below.';
  } else if (mailResult.mode === 'error') {
    message = 'We could not send the verification email just now. Please try again in a moment.';
  }

  return {
    success: true,
    alreadyVerified: false,
    message,
    ...verificationResponseFields(mailResult, verificationUrl)
  };
}

async function forgotPassword(payload = {}) {
  const explicitEmail = normalizeEmail(payload.email);
  const explicitUsername = normalizeUsername(payload.username);
  const identifier = normalizeUsername(payload.identifier);

  const email = explicitEmail || (identifier.includes('@') ? normalizeEmail(identifier) : '');
  const username = explicitUsername || (!identifier.includes('@') ? identifier : '');

  if (!email && !username) {
    throw {
      error: true,
      message: 'Email or username is required',
      code: 'VALIDATION_ERROR',
      statusCode: 400
    };
  }

  ensureEmailVerificationAvailable();

  const authUser = email
    ? await userRepo.findAuthByEmail(email)
    : await userRepo.findByUsername(username);

  if (!authUser) {
    throw {
      error: true,
      message: email
        ? 'There is no account with this email.'
        : 'There is no account with this username.',
      code: 'ACCOUNT_NOT_FOUND',
      statusCode: 404
    };
  }

  const resetToken = tokenService.signPasswordResetToken({
    userId: authUser.id,
    email: authUser.email
  });
  const resetTokenHash = hashVerificationToken(resetToken);
  const resetUrl = buildPasswordResetUrl(resetToken);

  await userRepo.setPasswordResetToken(authUser.id, resetTokenHash);

  const mailResult = await sendPasswordResetEmail(authUser, resetUrl);

  let message = 'Check your email for the password reset link.';
  if (mailResult.mode === 'preview') {
    message = 'Email delivery is not configured, so use the development reset link below.';
  } else if (mailResult.mode === 'error') {
    message = 'We could not send the password reset email just now. Please try again in a moment.';
  }

  return {
    success: true,
    message,
    ...passwordResetResponseFields(mailResult, resetUrl)
  };
}

async function resetPassword(payload = {}) {
  const token = String(payload.token || '').trim();
  const newPassword = String(payload.newPassword || '');

  if (!token || !newPassword) {
    throw {
      error: true,
      message: 'Reset token and new password are required',
      code: 'VALIDATION_ERROR',
      statusCode: 400
    };
  }

  if (newPassword.length < 8) {
    throw {
      error: true,
      message: 'New password must be at least 8 characters',
      code: 'VALIDATION_ERROR',
      statusCode: 400
    };
  }

  const tokenPayload = tokenService.verifyPasswordResetToken(token);
  const authUser = await userRepo.findPasswordResetAuthById(tokenPayload.userId);

  if (!authUser) {
    throw {
      error: true,
      message: 'Account not found',
      code: 'NOT_FOUND',
      statusCode: 404
    };
  }

  const tokenHash = hashVerificationToken(token);
  if (!authUser.password_reset_token || authUser.password_reset_token !== tokenHash) {
    throw {
      error: true,
      message: 'This password reset link is no longer valid. Request a new one and try again.',
      code: 'PASSWORD_RESET_INVALID',
      statusCode: 400
    };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await userRepo.updatePassword(authUser.id, passwordHash);
  await userRepo.clearPasswordResetToken(authUser.id);
  await userRepo.clearRefreshTokenHash(authUser.id);

  return {
    success: true,
    message: 'Password reset successful. You can sign in with your new password now.'
  };
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

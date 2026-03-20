const authService = require('../services/auth.service');

async function register(req, res) {
  const { username, email, password, display_name, bio } = req.body || {};
  const result = await authService.register({ username, email, password, display_name, bio });
  res.json(result);
}

async function login(req, res) {
  const result = await authService.login(req.body);
  res.json(result);
}

async function refresh(req, res) {
  const result = await authService.refresh(req.body);
  res.json(result);
}

async function logout(req, res) {
  const result = await authService.logout({ userId: req.auth.userId, accessToken: req.auth.token });
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

  if (String(newPassword).length < 8) {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: 'New password must be at least 8 characters'
    });
  }

  await authService.changePassword(userId, currentPassword, newPassword);

  return res.status(200).json({
    data: null,
    message: 'Password changed successfully'
  });
}

module.exports = { register, login, refresh, logout, changePassword };

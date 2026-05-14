const userService = require('../services/user.service');
const userRepo = require('../repositories/user.repo');

async function search(req, res) {
  const result = await userService.search(req.query.q, req.auth.userId);
  res.json(result);
}

async function getProfile(req, res) {
  const profile = await userService.getProfile(req.params.id, req.auth?.userId);
  return res.status(200).json({ data: profile, message: 'success' });
}

async function updateProfile(req, res) {
  const userId = req.auth.userId;

  if (Number.parseInt(req.params.id, 10) !== userId) {
    return res.status(403).json({
      error: true,
      code: 'FORBIDDEN',
      message: 'You can only update your own profile'
    });
  }

  const updatedUser = await userService.updateProfile(userId, req.body, req.file || null);
  return res.status(200).json({
    data: updatedUser,
    message: 'Profile updated successfully'
  });
}

async function followers(req, res) {
  const result = await userService.followers(Number(req.params.id));
  res.json(result);
}

async function following(req, res) {
  const result = await userService.following(Number(req.params.id));
  res.json(result);
}

async function toggleFollow(req, res) {
  const result = await userService.toggleFollow(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function listFollowRequests(req, res) {
  const result = await userService.listFollowRequests(Number(req.params.id), req.query.limit || 50);
  return res.status(200).json(result);
}

async function approveFollowRequest(req, res) {
  const result = await userService.approveFollowRequest(
    Number(req.params.id),
    Number(req.params.requesterId)
  );
  return res.status(200).json(result);
}

async function rejectFollowRequest(req, res) {
  const result = await userService.rejectFollowRequest(
    Number(req.params.id),
    Number(req.params.requesterId)
  );
  return res.status(200).json(result);
}

async function updateNotifPrefs(req, res) {
  const result = await userService.updateNotifPrefs(req.auth.userId, req.body);
  return res.status(200).json({
    data: result?.prefs || req.body,
    message: 'Notification preferences updated'
  });
}

async function updatePrivacy(req, res) {
  const userId = req.auth.userId;

  if (Number.parseInt(req.params.id, 10) !== userId) {
    return res.status(403).json({ error: true, message: 'Forbidden' });
  }

  const { is_private, fingerprinting_enabled, shield_enabled } = req.body;
  await userRepo.updateFields(userId, {
    ...(is_private !== undefined && { is_private: is_private ? 1 : 0 }),
    ...(fingerprinting_enabled !== undefined && {
      fingerprinting_enabled: fingerprinting_enabled ? 1 : 0
    }),
    ...(shield_enabled !== undefined && {
      shield_enabled: shield_enabled ? 1 : 0
    })
  });

  const updated = await userRepo.findById(userId);
  if (!updated) {
    throw { error: true, message: 'User not found', code: 'NOT_FOUND', statusCode: 404 };
  }

  delete updated.password_hash;
  delete updated.refresh_token_hash;
  return res.status(200).json({ data: updated, message: 'Privacy settings updated' });
}

async function remove(req, res) {
  const result = await userService.remove(req.auth.userId);
  return res.status(200).json(result);
}

module.exports = {
  search,
  getById: getProfile,
  getProfile,
  update: updateProfile,
  updateProfile,
  followers,
  following,
  toggleFollow,
  listFollowRequests,
  approveFollowRequest,
  rejectFollowRequest,
  updateNotifPrefs,
  updatePrivacy,
  remove
};

const userRepo = require('../repositories/user.repo');
const followRepo = require('../repositories/follow.repo');
const notificationService = require('./notification.service');
const mediaService = require('./media.service');

async function search(q, authUserId) {
  if (!q) return { items: [] };
  const items = await userRepo.search(q);
  return { items, viewerId: authUserId };
}

async function getProfile(identifier) {
  const user = await userRepo.getProfileByIdOrUsername(identifier);
  if (!user) {
    throw { error: true, message: 'User not found', code: 'NOT_FOUND', statusCode: 404 };
  }
  return user;
}

async function updateProfile(userId, data, file = null) {
  const updates = {};

  if (data.displayName !== undefined || data.display_name !== undefined) {
    updates.display_name = data.displayName ?? data.display_name;
  }
  if (data.bio !== undefined) {
    updates.bio = data.bio;
  }
  if (file) {
    if (!file.mimetype?.startsWith('image/')) {
      throw {
        error: true,
        message: 'Only image files can be used as profile photos.',
        code: 'UNSUPPORTED_MEDIA',
        statusCode: 415
      };
    }
    updates.avatar_url = await mediaService.store(file);
  }

  if (!Object.keys(updates).length) {
    const existingUser = await userRepo.findById(userId);
    if (!existingUser) {
      throw { error: true, message: 'User not found', code: 'NOT_FOUND', statusCode: 404 };
    }
    return existingUser;
  }

  await userRepo.updateFields(userId, updates);
  const updatedUser = await userRepo.findById(userId);
  if (!updatedUser) {
    throw { error: true, message: 'User not found', code: 'NOT_FOUND', statusCode: 404 };
  }

  delete updatedUser.password_hash;
  delete updatedUser.refresh_token_hash;
  delete updatedUser.verification_token;
  return updatedUser;
}

async function followers(id) {
  const items = await userRepo.listFollowers(id);
  return { items };
}

async function following(id) {
  const items = await userRepo.listFollowing(id);
  return { items };
}

async function toggleFollow(authUserId, targetId) {
  const result = await followRepo.toggleFollow(authUserId, targetId);
  if (result.following) {
    await notificationService.create({ type: 'follow', recipientId: targetId, senderId: authUserId });
  }
  return result;
}

async function updateNotifPrefs(userId, prefs) {
  const allowed = ['notif_likes', 'notif_comments', 'notif_follows', 'notif_shield', 'notif_reshares'];
  const filtered = {};

  for (const key of allowed) {
    if (prefs?.[key] !== undefined) {
      filtered[key] = prefs[key] ? 1 : 0;
    }
  }

  if (!Object.keys(filtered).length) {
    const user = await userRepo.findById(userId);
    return { user };
  }

  await userRepo.updateFields(userId, filtered);
  const user = await userRepo.findById(userId);
  return { user, prefs: filtered };
}

async function remove(userId) {
  const deleted = await userRepo.deleteAccount(userId);
  if (!deleted) {
    throw { error: true, message: 'User not found', code: 'NOT_FOUND', statusCode: 404 };
  }
  return { success: true };
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
  updateNotifPrefs,
  remove
};

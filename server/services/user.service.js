const userRepo = require('../repositories/user.repo');
const followRepo = require('../repositories/follow.repo');
const notificationService = require('./notification.service');
const mediaService = require('./media.service');

function cleanText(value, maxLength, field) {
  const next = String(value || '').trim();
  if (next.length > maxLength) {
    throw { error: true, message: `${field} must be ${maxLength} characters or fewer`, code: 'VALIDATION_ERROR', statusCode: 400 };
  }
  return next;
}

async function search(q, authUserId) {
  const query = cleanText(q, 80, 'Search query');
  if (!query) return { items: [] };
  const items = await userRepo.search(query);
  return { items, viewerId: authUserId };
}

async function getProfile(identifier, viewerId = null) {
  const user = await userRepo.getProfileByIdOrUsername(identifier);
  if (!user) {
    throw { error: true, message: 'User not found', code: 'NOT_FOUND', statusCode: 404 };
  }

  if (viewerId && String(viewerId) !== String(user.id)) {
    const [viewerIsFollowing, viewerHasRequested] = await Promise.all([
      followRepo.isFollower(viewerId, user.id),
      followRepo.hasFollowRequest(viewerId, user.id)
    ]);

    return {
      ...user,
      viewer_is_following: viewerIsFollowing ? 1 : 0,
      viewer_has_requested: viewerHasRequested ? 1 : 0
    };
  }

  if (viewerId && String(viewerId) === String(user.id)) {
    return {
      ...user,
      viewer_is_following: 0,
      viewer_has_requested: 0
    };
  }

  return user;
}

async function updateProfile(userId, data, file = null) {
  const updates = {};

  if (data.displayName !== undefined || data.display_name !== undefined) {
    updates.display_name = cleanText(data.displayName ?? data.display_name, 80, 'Display name');
  }
  if (data.bio !== undefined) {
    updates.bio = cleanText(data.bio, 300, 'Bio');
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
  if (result.requested) {
    await notificationService.create({ type: 'follow_request', recipientId: targetId, senderId: authUserId });
  }
  return result;
}

async function listFollowRequests(ownerId, limit = 50) {
  const items = await followRepo.listFollowRequests(ownerId, limit);
  return { items };
}

async function approveFollowRequest(ownerId, requesterId) {
  const result = await followRepo.approveFollowRequest(ownerId, requesterId);
  // Notify the private account owner that the follow was approved.
  await notificationService.create({ type: 'follow', recipientId: ownerId, senderId: requesterId });
  return result;
}

async function rejectFollowRequest(ownerId, requesterId) {
  const result = await followRepo.rejectFollowRequest(ownerId, requesterId);
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
  listFollowRequests,
  approveFollowRequest,
  rejectFollowRequest,
  updateNotifPrefs,
  remove
};

const likeRepo = require('../repositories/like.repo');
const postRepo = require('../repositories/post.repo');
const notificationService = require('./notification.service');

async function toggle(userId, postId) {
  const post = await postRepo.findById(postId);
  if (!post) throw { error: true, message: 'Post not found', code: 'NOT_FOUND', statusCode: 404 };

  const result = await likeRepo.toggle(postId, userId);
  if (result.liked) {
    await notificationService.create({ type: 'like', recipientId: post.user_id, senderId: userId, postId });
  }
  return result;
}

module.exports = { toggle };


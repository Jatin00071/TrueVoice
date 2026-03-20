const commentRepo = require('../repositories/comment.repo');
const postRepo = require('../repositories/post.repo');
const notificationService = require('./notification.service');
const shieldService = require('./shield.service');

async function createComment(userId, postId, content) {
  const shieldResult = await shieldService.processComment(userId, postId, content);

  if (!shieldResult.allowed) {
    const comment = await commentRepo.insert({
      userId,
      postId,
      content,
      status: 'rejected',
      flaggedReason: shieldResult.toxicityCategory || 'shield',
      deletedByShield: 1,
      toxicityCategory: shieldResult.toxicityCategory || null
    });

    console.log('[Comment] Toxic comment blocked by shield');

    return {
      comment,
      wasDeleted: true,
      message: 'Your comment was removed by our content moderation system.'
    };
  }

  if (shieldResult.deletedByShield && shieldResult.status === 'approved') {
    const comment = await commentRepo.insert({
      userId,
      postId,
      content,
      status: 'approved',
      flaggedReason: shieldResult.toxicityCategory,
      deletedByShield: 1,
      toxicityCategory: shieldResult.toxicityCategory || null
    });

    console.log(
      '[Comment] Toxic comment allowed through',
      '(counting toward threshold)'
    );

    const post = await postRepo.findById(postId);
    if (post && post.user_id !== userId) {
      await notificationService.create({
        type: 'comment',
        recipientId: post.user_id,
        senderId: userId,
        postId
      });
    }

    return {
      comment,
      wasDeleted: false,
      thresholdWarning: true
    };
  }

  const comment = await commentRepo.insert({
    userId,
    postId,
    content,
    status: shieldResult.status,
    flaggedReason: null,
    deletedByShield: 0,
    toxicityCategory: null
  });

  if (shieldResult.status === 'approved') {
    const post = await postRepo.findById(postId);
    if (post && post.user_id !== userId) {
      await notificationService.create({
        type: 'comment',
        recipientId: post.user_id,
        senderId: userId,
        postId
      });
    }
  }

  return { comment, wasDeleted: false };
}

async function listComments(postId) {
  const post = await postRepo.findById(postId);
  if (!post) throw { error: true, message: 'Post not found', code: 'NOT_FOUND', statusCode: 404 };
  const items = await commentRepo.listApproved(postId);
  return { items };
}

async function deleteComment(userId, postId, commentId) {
  // basic ownership delete
  await commentRepo.softDelete(commentId, userId);
  return { success: true };
}

async function listPendingForOwner(ownerId, postId) {
  const post = await postRepo.findById(postId);
  if (!post) throw { error: true, message: 'Post not found', code: 'NOT_FOUND', statusCode: 404 };
  if (post.user_id !== ownerId) throw { error: true, message: 'Forbidden', code: 'FORBIDDEN', statusCode: 403 };
  const items = await commentRepo.listPending(postId);
  return { items };
}

async function approvePending(ownerId, postId, commentId) {
  const post = await postRepo.findById(postId);
  if (!post) throw { error: true, message: 'Post not found', code: 'NOT_FOUND', statusCode: 404 };
  if (post.user_id !== ownerId) throw { error: true, message: 'Forbidden', code: 'FORBIDDEN', statusCode: 403 };
  const comment = await commentRepo.approve(commentId, postId);
  return { comment };
}

module.exports = { createComment, listComments, deleteComment, listPendingForOwner, approvePending };

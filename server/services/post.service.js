const postRepo = require('../repositories/post.repo');
const fingerprintRepo = require('../repositories/fingerprint.repo');
const fingerprintService = require('./fingerprint.service');
const mediaService = require('./media.service');
const notificationService = require('./notification.service');
const aiModerationService = require('./aiModerationService');

async function buildDuplicateResult({ post, originalPostId, originalOwnerId, matchType, userId }) {
  let nextPost = post;

  if (originalPostId && (!post?.is_reshare || !post?.original_post_id)) {
    nextPost = (await postRepo.markAsReshare(post.id, originalPostId)) || post;
  }

  if (originalOwnerId && originalOwnerId !== userId) {
    await notificationService.create({
      type: 'content_reshared',
      recipientId: originalOwnerId,
      senderId: userId,
      postId: nextPost.id
    });
  }

  console.log(
    `[Fingerprint] Duplicate detected - type: ${matchType},`,
    `original: ${originalPostId}`
  );

  return {
    post: nextPost,
    isDuplicate: true,
    matchType: matchType || null,
    originalPostId: originalPostId || null,
    originalOwnerUsername: nextPost?.original_owner_username || null
  };
}

async function create(userId, data, file) {
  const isImageUpload = !!(file && file.mimetype.startsWith('image/'));
  const imageBuffer = isImageUpload ? file.buffer : null;
  const textContent = data.content || null;

  const fingerprintResult = await fingerprintService.processNewPost(
    textContent,
    imageBuffer,
    userId
  );

  let mediaUrl = null;
  if (file) {
    mediaUrl = await mediaService.store(file);
  }

  const postData = {
    userId,
    content: textContent,
    mediaUrl,
    mediaType: file ? (file.mimetype.startsWith('video') ? 'video' : 'image') : null,
    isReshare: fingerprintResult.isDuplicate ? 1 : 0,
    originalPostId: fingerprintResult.isDuplicate
      ? fingerprintResult.originalPostId
      : null,
    shieldEnabled: data.shieldEnabled ? 1 : 0
  };

  const post = await postRepo.insert(postData);

  if (textContent && textContent.trim().length >= 10) {
    const postAnalysis = await aiModerationService.analyzePost(textContent, mediaUrl);

    if (postAnalysis.isFlagged) {
      await postRepo.flagAndDelete(post.id, postAnalysis.reason);
      await notificationService.create({
        type: 'post_removed',
        recipientId: userId,
        senderId: userId,
        postId: post.id
      });

      console.log(
        `[Post Screening] Post ${post.id} removed - ${postAnalysis.category}: ${postAnalysis.reason}`
      );

      return {
        post: null,
        removed: true,
        reason: postAnalysis.reason,
        category: postAnalysis.category,
        message: `Your post was removed: ${postAnalysis.reason}`
      };
    }
  }

  if (!fingerprintResult.isDuplicate && imageBuffer) {
    try {
      await fingerprintRepo.insert(
        post.id,
        fingerprintResult.computedHash,
        fingerprintResult.computedPHash,
        'image'
      );
      console.log(`[Fingerprint] Saved for post ${post.id}`);
    } catch (error) {
      if (error?.code !== 'ER_DUP_ENTRY') {
        throw error;
      }

      const exactMatch = await fingerprintRepo.findByExactHash(fingerprintResult.computedHash);
      if (!exactMatch) {
        throw error;
      }

      return buildDuplicateResult({
        post,
        originalPostId: exactMatch.post_id,
        originalOwnerId: exactMatch.original_owner_id,
        matchType: 'exact_image',
        userId
      });
    }
  }

  if (fingerprintResult.isDuplicate) {
    return buildDuplicateResult({
      post,
      originalPostId: fingerprintResult.originalPostId,
      originalOwnerId: fingerprintResult.originalOwnerId,
      matchType: fingerprintResult.matchType,
      userId
    });
  }

  return {
    post,
    removed: false,
    isDuplicate: fingerprintResult.isDuplicate,
    matchType: fingerprintResult.matchType || null,
    originalPostId: fingerprintResult.originalPostId || null,
    originalOwnerUsername: post?.original_owner_username || null
  };
}

async function getById(id, viewerId = null) {
  const post = await postRepo.findById(id, viewerId);
  if (!post) throw { error: true, message: 'Post not found', code: 'NOT_FOUND', statusCode: 404 };
  return { post };
}

async function update(userId, postId, data) {
  const existing = await postRepo.findById(postId);
  if (!existing) throw { error: true, message: 'Post not found', code: 'NOT_FOUND', statusCode: 404 };
  if (existing.user_id !== userId) throw { error: true, message: 'Forbidden', code: 'FORBIDDEN', statusCode: 403 };
  const post = await postRepo.update(postId, userId, { content: data.content ?? null });
  return { post };
}

async function remove(userId, postId) {
  const existing = await postRepo.findById(postId);
  if (!existing) throw { error: true, message: 'Post not found', code: 'NOT_FOUND', statusCode: 404 };
  if (existing.user_id !== userId) throw { error: true, message: 'Forbidden', code: 'FORBIDDEN', statusCode: 403 };
  await postRepo.softDelete(postId, userId);
  return { success: true };
}

async function originChain(postId) {
  const chain = await postRepo.getOriginChain(postId);
  return { chain };
}

module.exports = { create, getById, update, remove, originChain };

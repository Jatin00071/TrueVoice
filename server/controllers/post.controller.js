const postService = require('../services/post.service');
const feedService = require('../services/feed.service');

async function create(req, res) {
  const userId = req.auth.userId;
  const file = req.file || null;
  const content = typeof req.body?.content === 'string' ? req.body.content : '';
  const { shieldEnabled } = req.body;

  if (!content?.trim() && !file) {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: 'Post must have text or media'
    });
  }

  const result = await postService.create(
    userId,
    {
      content,
      shieldEnabled: shieldEnabled === 'true' || shieldEnabled === true
    },
    file
  );

  if (result.removed) {
    return res.status(200).json({
      data: null,
      removed: true,
      message: result.message,
      category: result.category
    });
  }

  const originalOwnerUsername = result.originalOwnerUsername || result.post?.original_owner_username || null;
  return res.status(201).json({
    data: {
      post: result.post,
      isDuplicate: result.isDuplicate,
      matchType: result.matchType,
      originalPostId: result.originalPostId
    },
    removed: false,
    message: result.isDuplicate
      ? originalOwnerUsername
        ? `This is @${originalOwnerUsername}'s post.`
        : 'This post was shared with origin credit.'
      : 'Post created'
  });
}

async function feed(req, res) {
  const result = await feedService.feed(req.auth.userId, { cursor: req.query.cursor || null, limit: req.query.limit || 20 });
  res.json(result);
}

async function discover(req, res) {
  const result = await feedService.discover(req.auth.userId, { limit: req.query.limit || 20 });
  res.json(result);
}

async function getById(req, res) {
  const result = await postService.getById(Number(req.params.id), req.auth.userId);
  res.json(result);
}

async function update(req, res) {
  const result = await postService.update(req.auth.userId, Number(req.params.id), req.body);
  res.json(result);
}

async function remove(req, res) {
  const result = await postService.remove(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function originChain(req, res) {
  const result = await postService.originChain(Number(req.params.id));
  res.json(result);
}

module.exports = { create, feed, discover, getById, update, remove, originChain };

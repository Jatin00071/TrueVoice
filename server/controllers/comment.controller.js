const commentService = require('../services/comment.service');

async function create(req, res) {
  const content = typeof req.body?.content === 'string' ? req.body.content : '';
  const postId = Number(req.params.id);
  const userId = req.auth.userId;

  if (!content.trim()) {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: 'Comment cannot be empty'
    });
  }

  const result = await commentService.createComment(userId, postId, content);

  if (result.wasDeleted) {
    return res.status(200).json({
      data: null,
      comment: null,
      wasDeleted: true,
      message: result.message
    });
  }

  return res.status(201).json({
    data: result.comment,
    comment: result.comment,
    wasDeleted: false,
    message: result.comment.status === 'pending' ? 'Your comment is pending review' : 'Comment posted'
  });
}

async function list(req, res) {
  const result = await commentService.listComments(Number(req.params.id));
  res.json(result);
}

async function remove(req, res) {
  const result = await commentService.deleteComment(req.auth.userId, Number(req.params.id), Number(req.params.cid));
  res.json(result);
}

async function pending(req, res) {
  const result = await commentService.listPendingForOwner(req.auth.userId, Number(req.params.id));
  res.json(result);
}

async function approve(req, res) {
  const result = await commentService.approvePending(req.auth.userId, Number(req.params.id), Number(req.params.cid));
  res.json(result);
}

module.exports = { create, list, remove, pending, approve };

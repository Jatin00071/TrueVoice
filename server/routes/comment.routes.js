const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const commentController = require('../controllers/comment.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { writeRateLimit } = require('../middleware/ratelimit.middleware');

const router = express.Router({ mergeParams: true });

router.post('/:id/comments', requireAuth, writeRateLimit, asyncHandler(commentController.create));
router.get('/:id/comments', requireAuth, asyncHandler(commentController.list));
router.delete('/:id/comments/:cid', requireAuth, writeRateLimit, asyncHandler(commentController.remove));
router.get('/:id/comments/pending', requireAuth, asyncHandler(commentController.pending));
router.post('/:id/comments/:cid/approve', requireAuth, writeRateLimit, asyncHandler(commentController.approve));

module.exports = router;

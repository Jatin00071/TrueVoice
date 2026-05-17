const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const conversationController = require('../controllers/conversation.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { writeRateLimit } = require('../middleware/ratelimit.middleware');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(conversationController.list));
router.get('/:id/details', requireAuth, asyncHandler(conversationController.details));
router.get('/:id', requireAuth, asyncHandler(conversationController.get));
router.post('/:userId', requireAuth, writeRateLimit, asyncHandler(conversationController.start));
router.delete('/:id', requireAuth, writeRateLimit, asyncHandler(conversationController.archive));
router.get('/:id/messages', requireAuth, asyncHandler(conversationController.messages));
router.patch('/:id/pin', requireAuth, writeRateLimit, asyncHandler(conversationController.pin));
router.patch('/:id/mute', requireAuth, writeRateLimit, asyncHandler(conversationController.mute));
router.patch('/:id/block', requireAuth, writeRateLimit, asyncHandler(conversationController.block));
router.delete('/:id/hide', requireAuth, writeRateLimit, asyncHandler(conversationController.hide));

module.exports = router;

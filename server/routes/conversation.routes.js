const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const conversationController = require('../controllers/conversation.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(conversationController.list));
router.get('/:id/details', requireAuth, asyncHandler(conversationController.details));
router.get('/:id', requireAuth, asyncHandler(conversationController.get));
router.post('/:userId', requireAuth, asyncHandler(conversationController.start));
router.delete('/:id', requireAuth, asyncHandler(conversationController.archive));
router.get('/:id/messages', requireAuth, asyncHandler(conversationController.messages));
router.patch('/:id/pin', requireAuth, asyncHandler(conversationController.pin));
router.patch('/:id/mute', requireAuth, asyncHandler(conversationController.mute));
router.patch('/:id/block', requireAuth, asyncHandler(conversationController.block));
router.delete('/:id/hide', requireAuth, asyncHandler(conversationController.hide));

module.exports = router;

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

module.exports = router;

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const notificationController = require('../controllers/notification.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { writeRateLimit } = require('../middleware/ratelimit.middleware');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(notificationController.list));
router.put('/:id/read', requireAuth, writeRateLimit, asyncHandler(notificationController.read));
router.put('/read-all', requireAuth, writeRateLimit, asyncHandler(notificationController.readAll));

module.exports = router;

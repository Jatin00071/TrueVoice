const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const notificationController = require('../controllers/notification.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(notificationController.list));
router.put('/:id/read', requireAuth, asyncHandler(notificationController.read));
router.put('/read-all', requireAuth, asyncHandler(notificationController.readAll));

module.exports = router;


const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const shieldController = require('../controllers/shield.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { writeRateLimit } = require('../middleware/ratelimit.middleware');

const router = express.Router({ mergeParams: true });

router.post('/:id/shield/activate', requireAuth, writeRateLimit, asyncHandler(shieldController.activate));
router.post('/:id/shield/deactivate', requireAuth, writeRateLimit, asyncHandler(shieldController.deactivate));
router.get('/:id/shield/status', requireAuth, asyncHandler(shieldController.status));

module.exports = router;

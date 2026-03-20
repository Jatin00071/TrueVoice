const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const shieldController = require('../controllers/shield.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router({ mergeParams: true });

router.post('/:id/shield/activate', requireAuth, asyncHandler(shieldController.activate));
router.post('/:id/shield/deactivate', requireAuth, asyncHandler(shieldController.deactivate));
router.get('/:id/shield/status', requireAuth, asyncHandler(shieldController.status));

module.exports = router;

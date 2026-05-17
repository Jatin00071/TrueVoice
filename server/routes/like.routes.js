const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const likeController = require('../controllers/like.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { writeRateLimit } = require('../middleware/ratelimit.middleware');

const router = express.Router({ mergeParams: true });

router.post('/:id/like', requireAuth, writeRateLimit, asyncHandler(likeController.toggle));

module.exports = router;

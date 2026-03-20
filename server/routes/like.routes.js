const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const likeController = require('../controllers/like.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router({ mergeParams: true });

router.post('/:id/like', requireAuth, asyncHandler(likeController.toggle));

module.exports = router;


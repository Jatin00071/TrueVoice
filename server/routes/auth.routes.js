const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { loginRateLimit } = require('../middleware/ratelimit.middleware');

const router = express.Router();

router.post('/register', asyncHandler(authController.register));
router.post('/login', loginRateLimit, asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', requireAuth, asyncHandler(authController.logout));
router.put('/change-password', requireAuth, asyncHandler(authController.changePassword));

module.exports = router;

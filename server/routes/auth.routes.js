const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const authController = require('../controllers/auth.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth.middleware');
const {
  loginRateLimit,
  registerRateLimit,
  authEmailRateLimit,
  authTokenRateLimit
} = require('../middleware/ratelimit.middleware');

const router = express.Router();

router.post('/register', registerRateLimit, asyncHandler(authController.register));
router.post('/login', loginRateLimit, asyncHandler(authController.login));
router.post('/verify-email', authTokenRateLimit, asyncHandler(authController.verifyEmail));
router.post('/resend-verification', authEmailRateLimit, asyncHandler(authController.resendVerification));
router.post('/forgot-password', authEmailRateLimit, asyncHandler(authController.forgotPassword));
router.post('/reset-password', authTokenRateLimit, asyncHandler(authController.resetPassword));
router.post('/refresh', authTokenRateLimit, asyncHandler(authController.refresh));
router.post('/logout', optionalAuth, asyncHandler(authController.logout));
router.put('/change-password', requireAuth, asyncHandler(authController.changePassword));

module.exports = router;

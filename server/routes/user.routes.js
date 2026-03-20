const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const userController = require('../controllers/user.controller');
const { requireAuth, requireOwner } = require('../middleware/auth.middleware');
const { upload, enforceMediaLimits } = require('../middleware/upload.middleware');

const router = express.Router();

router.get('/search', requireAuth, asyncHandler(userController.search));
router.get('/:id', requireAuth, asyncHandler(userController.getProfile));
router.put(
  '/:id/notification-preferences',
  requireAuth,
  requireOwner('id'),
  asyncHandler(userController.updateNotifPrefs)
);
router.put(
  '/:id/privacy',
  requireAuth,
  requireOwner('id'),
  asyncHandler(userController.updatePrivacy)
);
router.put(
  '/:id',
  requireAuth,
  requireOwner('id'),
  upload.single('avatar'),
  enforceMediaLimits,
  asyncHandler(userController.updateProfile)
);
router.delete('/:id', requireAuth, requireOwner('id'), asyncHandler(userController.remove));
router.get('/:id/followers', requireAuth, asyncHandler(userController.followers));
router.get('/:id/following', requireAuth, asyncHandler(userController.following));
router.post('/:id/follow', requireAuth, asyncHandler(userController.toggleFollow));
router.get(
  '/:id/follow-requests',
  requireAuth,
  requireOwner('id'),
  asyncHandler(userController.listFollowRequests)
);
router.post(
  '/:id/follow-requests/:requesterId/approve',
  requireAuth,
  requireOwner('id'),
  asyncHandler(userController.approveFollowRequest)
);
router.post(
  '/:id/follow-requests/:requesterId/reject',
  requireAuth,
  requireOwner('id'),
  asyncHandler(userController.rejectFollowRequest)
);

module.exports = router;

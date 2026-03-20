const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const postController = require('../controllers/post.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { upload, enforceMediaLimits } = require('../middleware/upload.middleware');

const router = express.Router();

router.post('/', requireAuth, upload.single('media'), enforceMediaLimits, asyncHandler(postController.create));
router.get('/feed', requireAuth, asyncHandler(postController.feed));
router.get('/discover', requireAuth, asyncHandler(postController.discover));
router.get('/:id', requireAuth, asyncHandler(postController.getById));
router.put('/:id', requireAuth, asyncHandler(postController.update));
router.delete('/:id', requireAuth, asyncHandler(postController.remove));
router.get('/:id/origin-chain', requireAuth, asyncHandler(postController.originChain));

module.exports = router;


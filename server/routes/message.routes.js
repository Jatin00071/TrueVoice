const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../utils/asyncHandler');
const messageController = require('../controllers/message.controller');
const attachmentController = require('../controllers/attachment.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateEncryptedEnvelope } = require('../middleware/encryptionValidation');
const { messageRateLimit, uploadRateLimit, writeRateLimit } = require('../middleware/ratelimit.middleware');

const router = express.Router();
function envInt(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: envInt('MAX_FILE_SIZE', 52428800) } });

router.post('/messages', requireAuth, messageRateLimit, validateEncryptedEnvelope, asyncHandler(messageController.send));
router.put('/messages/:id', requireAuth, messageRateLimit, validateEncryptedEnvelope, asyncHandler(messageController.update));
router.delete('/messages/:id', requireAuth, messageRateLimit, asyncHandler(messageController.remove));
router.post('/messages/:id/unsend', requireAuth, messageRateLimit, asyncHandler(messageController.unsend));
router.put('/messages/:id/read', requireAuth, messageRateLimit, asyncHandler(messageController.read));
router.post('/messages/upload', requireAuth, uploadRateLimit, upload.single('file'), asyncHandler(attachmentController.upload));
router.get('/message-queue', requireAuth, asyncHandler(messageController.getQueue));

router.get('/attachments/:id/download', requireAuth, asyncHandler(attachmentController.download));
router.get('/attachments/:id/thumbnail', requireAuth, asyncHandler(attachmentController.thumbnail));

router.get('/keys/public/:userId', requireAuth, asyncHandler(messageController.publicKey));
router.post('/keys/identity', requireAuth, writeRateLimit, asyncHandler(messageController.publishIdentityKey));
router.post('/keys/exchange', requireAuth, writeRateLimit, asyncHandler(messageController.exchangeKey));
router.get('/keys/verify/:conversationId', requireAuth, asyncHandler(messageController.verifyKeys));
router.get('/messages/:conversationId/verify-fingerprint', requireAuth, asyncHandler(messageController.verifyKeys));

module.exports = router;

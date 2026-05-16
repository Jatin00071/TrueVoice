const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../utils/asyncHandler');
const messageController = require('../controllers/message.controller');
const attachmentController = require('../controllers/attachment.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateEncryptedEnvelope } = require('../middleware/encryptionValidation');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 52428800) } });

router.post('/messages', requireAuth, validateEncryptedEnvelope, asyncHandler(messageController.send));
router.put('/messages/:id', requireAuth, validateEncryptedEnvelope, asyncHandler(messageController.update));
router.delete('/messages/:id', requireAuth, asyncHandler(messageController.remove));
router.put('/messages/:id/read', requireAuth, asyncHandler(messageController.read));
router.post('/messages/upload', requireAuth, upload.single('file'), asyncHandler(attachmentController.upload));

router.get('/attachments/:id/download', requireAuth, asyncHandler(attachmentController.download));
router.get('/attachments/:id/thumbnail', requireAuth, asyncHandler(attachmentController.thumbnail));

router.get('/keys/public/:userId', requireAuth, asyncHandler(messageController.publicKey));
router.post('/keys/exchange', requireAuth, asyncHandler(messageController.exchangeKey));
router.get('/keys/verify/:conversationId', requireAuth, asyncHandler(messageController.verifyKeys));

module.exports = router;

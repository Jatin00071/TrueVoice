const path = require('path');
const mediaService = require('../services/mediaService');
const messageRepo = require('../repositories/message.repo');
const conversationService = require('../services/conversation.service');

async function upload(req, res) {
  const messageId = Number(req.body?.messageId || req.body?.message_id);
  if (!Number.isFinite(messageId)) {
    return res.status(400).json({ error: true, message: 'Message id is required', code: 'VALIDATION_ERROR' });
  }
  const message = await messageRepo.findById(messageId);
  if (!message) {
    return res.status(404).json({ error: true, message: 'Message not found', code: 'NOT_FOUND' });
  }
  await conversationService.ensureAccess(req.auth.userId, message.conversation_id);
  const attachment = await mediaService.createAttachment(messageId, req.file);
  res.status(201).json({ attachment });
}

async function download(req, res) {
  const attachment = await mediaService.getAttachment(Number(req.params.id));
  const message = await messageRepo.findById(attachment.message_id);
  await conversationService.ensureAccess(req.auth.userId, message.conversation_id);
  const filename = path.basename(attachment.encrypted_file_path);
  const fullPath = path.join(__dirname, '..', 'uploads', 'messages', filename);
  res.download(fullPath, attachment.file_name);
}

async function thumbnail(req, res) {
  const attachment = await mediaService.getAttachment(Number(req.params.id));
  const message = await messageRepo.findById(attachment.message_id);
  await conversationService.ensureAccess(req.auth.userId, message.conversation_id);
  if (!attachment.thumbnail_path) {
    return res.status(404).json({ error: true, message: 'Thumbnail not available', code: 'NOT_FOUND' });
  }
  const filename = path.basename(attachment.thumbnail_path);
  res.sendFile(path.join(__dirname, '..', 'uploads', 'messages', filename));
}

module.exports = { upload, download, thumbnail };

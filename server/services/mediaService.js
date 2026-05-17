const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const attachmentRepo = require('../repositories/attachment.repo');
const { declaredMimeMatches, detectMime, hasDangerousExtension } = require('../utils/fileSignature.util');

const STORAGE_ROOT = process.env.MESSAGE_STORAGE_DIR || path.join(__dirname, '..', 'uploads', 'messages');
function envInt(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const MAX_FILE_SIZE = envInt('MAX_FILE_SIZE', 50 * 1024 * 1024);
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/webm',
  'application/pdf', 'text/plain', 'application/zip'
]);
const MAX_ORIGINAL_NAME_LENGTH = 180;

function classifyLimit(mimetype) {
  if (mimetype?.startsWith('image/')) return 10 * 1024 * 1024;
  if (mimetype?.startsWith('video/')) return 50 * 1024 * 1024;
  return 25 * 1024 * 1024;
}

function assertFile(file) {
  if (!file) throw { error: true, message: 'File is required', code: 'FILE_REQUIRED', statusCode: 400 };
  if (file.size > MAX_FILE_SIZE || file.size > classifyLimit(file.mimetype)) {
    throw { error: true, message: 'File is too large for this media type', code: 'FILE_TOO_LARGE', statusCode: 413 };
  }
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    throw { error: true, message: 'Unsupported message attachment type', code: 'UNSUPPORTED_MEDIA', statusCode: 415 };
  }
  const originalName = path.basename(file.originalname || '');
  if (originalName.length > MAX_ORIGINAL_NAME_LENGTH || /[\r\n\0]/.test(originalName) || hasDangerousExtension(originalName)) {
    throw { error: true, message: 'This attachment name is not allowed', code: 'INVALID_FILE_NAME', statusCode: 400 };
  }

  const detectedMime = detectMime(file.buffer);
  if (!declaredMimeMatches(file.mimetype, detectedMime)) {
    throw {
      error: true,
      message: 'Attachment content does not match the declared file type',
      code: 'MEDIA_SIGNATURE_MISMATCH',
      statusCode: 415
    };
  }
}

async function storeEncryptedUpload(file) {
  assertFile(file);
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.bin`;
  const target = path.join(STORAGE_ROOT, safeName);
  await fs.writeFile(target, file.buffer);
  return `/uploads/messages/${safeName}`;
}

async function createAttachment(messageId, file) {
  const encryptedFilePath = await storeEncryptedUpload(file);
  return attachmentRepo.create({
    messageId,
    fileName: file.originalname || 'encrypted-file',
    fileType: file.mimetype || 'application/octet-stream',
    fileSize: file.size || 0,
    encryptedFilePath,
    thumbnailPath: null
  });
}

async function getAttachment(id) {
  const attachment = await attachmentRepo.findById(id);
  if (!attachment) throw { error: true, message: 'Attachment not found', code: 'NOT_FOUND', statusCode: 404 };
  return attachment;
}

module.exports = { createAttachment, getAttachment, assertFile };

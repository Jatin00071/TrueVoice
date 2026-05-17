const multer = require('multer');
const path = require('path');
const { detectMime, declaredMimeMatches } = require('../utils/fileSignature.util');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime'
]);

function envInt(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const IMAGE_LIMIT = envInt('MAX_IMAGE_UPLOAD_SIZE', 10 * 1024 * 1024);
const VIDEO_LIMIT = envInt('MAX_VIDEO_UPLOAD_SIZE', 50 * 1024 * 1024);
const MAX_ORIGINAL_NAME_LENGTH = 180;

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb({
      error: true,
      message: 'Invalid file type. Only images and videos allowed.',
      code: 'UNSUPPORTED_MEDIA',
      statusCode: 415
    }, false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: VIDEO_LIMIT
  }
});

function enforceMediaLimits(req, res, next) {
  const file = req.file;
  if (!file) return next();

  const isVideo = file.mimetype.startsWith('video/');
  const max = isVideo ? VIDEO_LIMIT : IMAGE_LIMIT;

  if (file.size > max) {
    return next({
      error: true,
      message: `File too large (max ${Math.round(max / 1024 / 1024)}MB)`,
      code: 'FILE_TOO_LARGE',
      statusCode: 413
    });
  }

  const originalName = path.basename(file.originalname || '');
  if (originalName.length > MAX_ORIGINAL_NAME_LENGTH || /[\r\n\0]/.test(originalName)) {
    return next({
      error: true,
      message: 'File name is too long',
      code: 'INVALID_FILE_NAME',
      statusCode: 400
    });
  }

  const detectedMime = detectMime(file.buffer);
  if (!declaredMimeMatches(file.mimetype, detectedMime)) {
    return next({
      error: true,
      message: 'File content does not match the declared media type',
      code: 'MEDIA_SIGNATURE_MISMATCH',
      statusCode: 415
    });
  }

  return next();
}

module.exports = { upload, enforceMediaLimits };

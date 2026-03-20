const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime'
]);

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
    fileSize: 100 * 1024 * 1024
  }
});

function enforceMediaLimits(req, res, next) {
  const file = req.file;
  if (!file) return next();

  const isVideo = file.mimetype.startsWith('video/');
  const max = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;

  if (file.size > max) {
    return next({
      error: true,
      message: `File too large (max ${isVideo ? '100MB' : '10MB'})`,
      code: 'FILE_TOO_LARGE',
      statusCode: 413
    });
  }

  return next();
}

module.exports = { upload, enforceMediaLimits };

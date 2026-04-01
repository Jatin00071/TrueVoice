const path = require('path');
const fs = require('fs');
const mediaRepo = require('../repositories/media.repo');

function storageMode() {
  if (process.env.MEDIA_BACKEND) {
    return String(process.env.MEDIA_BACKEND).trim().toLowerCase();
  }

  return process.env.NODE_ENV === 'production' ? 'database' : 'filesystem';
}

async function storeOnFilesystem(file) {
  const uploadDir = process.env.NODE_ENV === 'production'
    ? '/tmp/uploads'
    : path.join(__dirname, '..', 'uploads');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(file.originalname || '') || '';
  const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
  const abs = path.join(uploadDir, name);
  await fs.promises.writeFile(abs, file.buffer);

  return `/uploads/${name}`;
}

async function storeOnDatabase(file) {
  const id = await mediaRepo.insert({
    mimeType: file.mimetype,
    originalName: file.originalname || null,
    byteSize: file.size || Buffer.byteLength(file.buffer || Buffer.alloc(0)),
    data: file.buffer
  });

  return `/media/${id}`;
}

async function store(file) {
  if (!file) return null;

  return storageMode() === 'database'
    ? storeOnDatabase(file)
    : storeOnFilesystem(file);
}

async function getById(id) {
  const asset = await mediaRepo.findById(Number(id));

  if (!asset) {
    throw {
      error: true,
      message: 'Media not found',
      code: 'NOT_FOUND',
      statusCode: 404
    };
  }

  return {
    id: asset.id,
    mimeType: asset.mime_type,
    originalName: asset.original_name,
    byteSize: asset.byte_size,
    data: asset.data
  };
}

module.exports = { store, getById };

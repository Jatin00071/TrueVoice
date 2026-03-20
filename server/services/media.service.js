const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

async function store(file) {
  if (!file) return null;
  const ext = (() => {
    if (file.mimetype === 'image/jpeg') return '.jpg';
    if (file.mimetype === 'image/png') return '.png';
    if (file.mimetype === 'image/gif') return '.gif';
    if (file.mimetype === 'video/mp4') return '.mp4';
    return '';
  })();

  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const uploadDir = path.join(__dirname, '..', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  const abs = path.join(uploadDir, name);
  await fs.writeFile(abs, file.buffer);

  return `/uploads/${name}`;
}

module.exports = { store };


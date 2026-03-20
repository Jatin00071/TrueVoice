const path = require('path');
const fs = require('fs');
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
  const uploadDir = process.env.NODE_ENV === 'production'
    ? '/tmp/uploads'
    : path.join(__dirname, '..', 'uploads');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const abs = path.join(uploadDir, name);
  await fs.promises.writeFile(abs, file.buffer);

  return `/uploads/${name}`;
}

module.exports = { store };

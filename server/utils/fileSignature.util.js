const path = require('path');

const DANGEROUS_EXTENSIONS = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.hta',
  '.html',
  '.jar',
  '.js',
  '.msi',
  '.php',
  '.ps1',
  '.scr',
  '.sh',
  '.svg',
  '.vbs',
  '.wsf'
]);

function startsWith(buffer, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function detectMime(buffer) {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';

  const asciiHead = Buffer.isBuffer(buffer) ? buffer.subarray(0, 16).toString('ascii') : '';
  if (asciiHead.startsWith('GIF87a') || asciiHead.startsWith('GIF89a')) return 'image/gif';
  if (asciiHead.startsWith('RIFF') && asciiHead.slice(8, 12) === 'WEBP') return 'image/webp';

  if (Buffer.isBuffer(buffer) && buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  }
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';

  if (asciiHead.startsWith('%PDF-')) return 'application/pdf';
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) || startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])) {
    return 'application/zip';
  }

  if (isLikelyText(buffer)) return 'text/plain';
  return null;
}

function isLikelyText(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (sample.includes(0)) return false;
  return sample.toString('utf8').includes('\ufffd') === false;
}

function declaredMimeMatches(declared, detected) {
  if (!detected) return false;
  if (declared === detected) return true;
  if (declared?.startsWith('video/') && detected.startsWith('video/')) return true;
  return false;
}

function hasDangerousExtension(filename = '') {
  return DANGEROUS_EXTENSIONS.has(path.extname(String(filename).toLowerCase()));
}

module.exports = {
  detectMime,
  declaredMimeMatches,
  hasDangerousExtension
};

const sharp = require('sharp');

const HASH_SIZE = 16;

async function generatePHash(imageBuffer) {
  try {
    const size = HASH_SIZE + 1;

    const { data } = await sharp(imageBuffer)
      .resize(size, size, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = Array.from(data);
    const dctSize = HASH_SIZE;
    const hashBits = [];

    for (let y = 0; y < dctSize; y += 1) {
      for (let x = 0; x < dctSize; x += 1) {
        const current = pixels[y * size + x];
        const right = pixels[y * size + (x + 1)];
        hashBits.push(current > right ? 1 : 0);
      }
    }

    return hashBits.join('');
  } catch (error) {
    console.error('pHash generation failed:', error.message);
    return null;
  }
}

function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return Infinity;

  let distance = 0;
  for (let i = 0; i < hash1.length; i += 1) {
    if (hash1[i] !== hash2[i]) distance += 1;
  }
  return distance;
}

function areSimilarImages(hash1, hash2, threshold) {
  const t = threshold || Number.parseInt(process.env.PHASH_THRESHOLD, 10) || 20;
  const distance = hammingDistance(hash1, hash2);
  console.log(`[pHash] Hamming distance: ${distance}, threshold: ${t}`);
  return distance <= t;
}

module.exports = { generatePHash, hammingDistance, areSimilarImages };

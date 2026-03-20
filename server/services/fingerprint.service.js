const crypto = require('crypto');
const db = require('../config/db');
const fingerprintRepo = require('../repositories/fingerprint.repo');
const { generatePHash, areSimilarImages } = require('../utils/perceptualHash.util');
const { areTextsSemanticallyDuplicate } = require('../utils/aiSimilarity.util');

const MINIMUM_TEXT_LENGTH_FOR_AI_CHECK = 30;

async function processNewPost(textContent, imageBuffer, userId) {
  const result = {
    isDuplicate: false,
    originalPostId: null,
    originalOwnerId: null,
    matchType: null,
    computedHash: null,
    computedPHash: null
  };

  const hasImage = !!imageBuffer;
  const hasText = !!(textContent && textContent.trim().length > 0);

  if (!hasImage && !hasText) return result;

  if (hasImage) {
    const exactHash = crypto
      .createHash('sha256')
      .update(imageBuffer)
      .digest('hex');

    result.computedHash = exactHash;

    const exactMatch = await fingerprintRepo.findByExactHash(exactHash);
    if (exactMatch) {
      result.isDuplicate = true;
      result.originalPostId = exactMatch.post_id;
      result.originalOwnerId = exactMatch.original_owner_id;
      result.matchType = 'exact_image';
      return result;
    }

    const newPHash = await generatePHash(imageBuffer);
    result.computedPHash = newPHash;

    if (newPHash) {
      const allPHashes = await fingerprintRepo.getAllImagePHashes();
      console.log(`[pHash] Checking against ${allPHashes.length} existing fingerprints`);

      for (const existing of allPHashes) {
        if (existing.phash && areSimilarImages(newPHash, existing.phash)) {
          result.isDuplicate = true;
          result.originalPostId = existing.post_id;
          result.originalOwnerId = existing.original_owner_id;
          result.matchType = 'similar_image';
          return result;
        }
      }
    }
  }

  if (!hasImage && hasText) {
    const wordCount = textContent.trim().split(/\s+/).length;
    if (wordCount >= MINIMUM_TEXT_LENGTH_FOR_AI_CHECK) {
      const textResult = await checkTextDuplicateWithAI(textContent, userId);
      if (textResult.isDuplicate) {
        return { ...result, ...textResult };
      }
    }
  }

  return result;
}

async function checkTextDuplicateWithAI(newText, currentUserId) {
  const result = {
    isDuplicate: false,
    originalPostId: null,
    originalOwnerId: null,
    matchType: null
  };

  const [recentTextPosts] = await db.pool.execute(
    `SELECT p.id, p.content, p.user_id
     FROM posts p
     WHERE p.deleted_at IS NULL
     AND p.media_url IS NULL
     AND p.user_id != ?
     AND p.content IS NOT NULL
     AND CHAR_LENGTH(p.content) > 100
     AND p.created_at > NOW() - INTERVAL 30 DAY
     ORDER BY p.created_at DESC
     LIMIT 50`,
    [currentUserId]
  );

  for (const existing of recentTextPosts) {
    const isDuplicate = await areTextsSemanticallyDuplicate(existing.content, newText);

    if (isDuplicate) {
      result.isDuplicate = true;
      result.originalPostId = existing.id;
      result.originalOwnerId = existing.user_id;
      result.matchType = 'ai_text_similarity';
      return result;
    }
  }

  return result;
}

async function getOriginChain(postId) {
  return fingerprintRepo.getOriginChain(postId);
}

module.exports = {
  processNewPost,
  getOriginChain
};

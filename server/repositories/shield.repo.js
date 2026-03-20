const { query } = require('../config/db');

async function insertActivated({ postId, triggerType, commentCountAtTrigger }) {
  await query(
    `INSERT INTO shield_events (post_id, trigger_type, comment_count_at_trigger, activated_at)
     VALUES (?, ?, ?, NOW())`,
    [postId, triggerType, commentCountAtTrigger]
  );
}

async function insertDeactivated({ postId }) {
  await query(
    `INSERT INTO shield_events (post_id, trigger_type, deactivated_at)
     VALUES (?, 'auto', NOW())`,
    [postId]
  );
}

async function activationCandidates() {
  // exact SQL per spec
  const rows = await query(
    `SELECT c.post_id, COUNT(*) as cnt
FROM comments c
JOIN posts p ON c.post_id = p.id
WHERE c.created_at > NOW() - INTERVAL 5 MINUTE
AND c.status = 'approved'
AND c.deleted_at IS NULL
AND p.deleted_at IS NULL
AND p.shield_active = 0
AND c.user_id NOT IN (
  SELECT follower_id FROM follows WHERE following_id = p.user_id
)
GROUP BY c.post_id
HAVING cnt > 15;`
  );
  return rows;
}

async function releaseCandidates() {
  const rows = await query(
    `SELECT p.id as post_id
FROM posts p
WHERE p.shield_active = 1
AND p.deleted_at IS NULL
AND (
  SELECT COUNT(*) FROM comments c
  WHERE c.post_id = p.id
  AND c.created_at > NOW() - INTERVAL 10 MINUTE
  AND c.status IN ('approved','pending')
  AND c.user_id NOT IN (
    SELECT follower_id FROM follows WHERE following_id = p.user_id
  )
) < 5;`
  );
  return rows;
}

module.exports = {
  insertActivated,
  insertDeactivated,
  activationCandidates,
  releaseCandidates
};


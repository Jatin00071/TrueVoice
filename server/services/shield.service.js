const { query } = require('../config/db');
const aiModerationService = require('./aiModerationService');
const notificationService = require('./notification.service');
const socketManager = require('../socket/socket.manager');

const TOXIC_VELOCITY_THRESHOLD = 10;
const TOXIC_VELOCITY_WINDOW_MINUTES = 5;
const SHIELD_RELEASE_WINDOW_MINUTES = 10;
const SHIELD_RELEASE_THRESHOLD = 5;

async function findPost(postId) {
  const rows = await query(
    `SELECT *
     FROM posts
     WHERE id = ? AND deleted_at IS NULL`,
    [postId]
  );

  return rows[0] || null;
}

async function assertPostOwner(postId, userId) {
  const post = await findPost(postId);
  if (!post) {
    throw { error: true, code: 'NOT_FOUND', message: 'Post not found', statusCode: 404 };
  }

  if (post.user_id !== userId) {
    throw { error: true, code: 'FORBIDDEN', message: 'Not your post', statusCode: 403 };
  }

  return post;
}

async function processComment(userId, postId, content) {
  const result = {
    allowed: true,
    status: 'approved',
    deletedByShield: false,
    toxicityCategory: null
  };

  const post = await findPost(postId);
  if (!post) {
    throw { error: true, code: 'NOT_FOUND', message: 'Post not found', statusCode: 404 };
  }

  const isOwner = userId === post.user_id;
  if (isOwner) {
    return result;
  }

  const followRows = await query(
    `SELECT 1
     FROM follows
     WHERE follower_id = ? AND following_id = ?
     LIMIT 1`,
    [userId, post.user_id]
  );
  const isFollower = followRows.length > 0;

  const analysis = await aiModerationService.analyzeComment(content);

  console.log(
    `[Shield] Comment analysis - toxic: ${analysis.isToxic},`,
    `shield active: ${!!post.shield_active},`,
    `follower: ${isFollower}`
  );

  if (analysis.isToxic) {
    const countRows = await query(
      `SELECT COUNT(*) AS toxic_count
       FROM comments
       WHERE post_id = ?
         AND deleted_by_shield = 1
         AND created_at > NOW() - INTERVAL ? MINUTE`,
      [postId, TOXIC_VELOCITY_WINDOW_MINUTES]
    );

    const recentToxicCount = Number(countRows[0]?.toxic_count || 0);

    console.log(
      `[Shield] Recent toxic count for post ${postId}:`,
      `${recentToxicCount} in last ${TOXIC_VELOCITY_WINDOW_MINUTES} min`
    );

    if (!post.shield_active && recentToxicCount < TOXIC_VELOCITY_THRESHOLD) {
      console.log(
        '[Shield] Toxic comment allowed through',
        `(${recentToxicCount + 1}/${TOXIC_VELOCITY_THRESHOLD} - threshold not yet reached)`
      );

      result.allowed = true;
      result.status = 'approved';
      result.deletedByShield = true;
      result.toxicityCategory = analysis.category;

      if (recentToxicCount + 1 >= TOXIC_VELOCITY_THRESHOLD) {
        console.log(
          '[Shield] Threshold reached!',
          `Activating shield on post ${postId}`
        );
        await activateShieldFromVelocity(post, recentToxicCount + 1);
      }

      return result;
    }

    if (post.shield_active || recentToxicCount >= TOXIC_VELOCITY_THRESHOLD) {
      console.log(
        '[Shield] Threshold reached or shield active',
        '- deleting toxic comment'
      );

      result.allowed = false;
      result.status = 'rejected';
      result.deletedByShield = true;
      result.toxicityCategory = analysis.category;

      await incrementShieldDeleteCount(postId);
      await updateDailyReport(postId, analysis.category);

      if (!post.shield_active) {
        await activateShieldFromVelocity(post, recentToxicCount + 1);
      }

      return result;
    }
  }

  if (post.shield_active && !isFollower) {
    result.allowed = true;
    result.status = 'pending';
    return result;
  }

  result.allowed = true;
  result.status = 'approved';
  return result;
}

async function activateShieldFromVelocity(post, toxicCount) {
  await query(
    `UPDATE posts
     SET shield_active = 1,
         shield_activated_at = NOW()
     WHERE id = ?`,
    [post.id]
  );

  await query(
    `INSERT INTO shield_events
     (post_id, trigger_type, comment_count_at_trigger)
     VALUES (?, 'auto', ?)`,
    [post.id, toxicCount]
  );

  if (post.content && post.content.trim().length >= 5) {
    try {
      const postAnalysis = await aiModerationService.analyzePost(
        post.content,
        post.media_url
      );

      if (postAnalysis.isFlagged) {
        await query(
          `UPDATE posts
           SET post_flagged = 1,
               post_flag_reason = ?,
               deleted_at = NOW()
           WHERE id = ?`,
          [postAnalysis.reason, post.id]
        );

        await notificationService.create({
          type: 'post_removed',
          recipientId: post.user_id,
          senderId: post.user_id,
          postId: post.id
        });

        socketManager.emit(post.user_id, 'post:removed', {
          postId: post.id,
          reason: postAnalysis.reason
        });

        console.log(`[Shield] Post ${post.id} removed after re-analysis`);
        return;
      }
    } catch (err) {
      console.log('[Shield] Post re-analysis skipped:', err.message);
    }
  }

  await notificationService.create({
    type: 'shield_activated',
    recipientId: post.user_id,
    senderId: post.user_id,
    postId: post.id
  });

  socketManager.emit(post.user_id, 'shield:activated', {
    postId: post.id,
    toxicCount,
    message: `Shield activated - ${toxicCount} abusive comments detected`
  });

  console.log(
    `[Shield] Activated on post ${post.id}`,
    `after ${toxicCount} toxic comments`
  );
}

async function checkAndAutoActivateShield(post, pendingToxicIncrement = 0) {
  const rows = await query(
    `SELECT COUNT(*) AS toxic_count
     FROM comments
     WHERE post_id = ?
       AND deleted_by_shield = 1
       AND created_at > NOW() - INTERVAL ? MINUTE`,
    [post.id, TOXIC_VELOCITY_WINDOW_MINUTES]
  );

  const toxicCount = Number(rows[0]?.toxic_count || 0) + Number(pendingToxicIncrement || 0);

  console.log(
    `[Shield] Toxic velocity check - post ${post.id}: ${toxicCount} toxic comments in last ${TOXIC_VELOCITY_WINDOW_MINUTES} min`
  );

  if (toxicCount < TOXIC_VELOCITY_THRESHOLD || post.shield_active) {
    return;
  }

  await activateShieldFromVelocity(post, toxicCount);
}

async function incrementShieldDeleteCount(postId) {
  await query(
    `UPDATE posts
     SET shield_deleted_count = shield_deleted_count + 1
     WHERE id = ?`,
    [postId]
  );
}

async function updateDailyReport(postId, category) {
  const categoryColumn = {
    hate_speech: 'hate_speech_count',
    abuse: 'abuse_count',
    harassment: 'abuse_count',
    spam: 'spam_count',
    threat: 'hate_speech_count'
  }[category] || 'abuse_count';

  await query(
    `INSERT INTO shield_reports (post_id, report_date, auto_deleted_count, ${categoryColumn})
     VALUES (?, CURDATE(), 1, 1)
     ON DUPLICATE KEY UPDATE
       auto_deleted_count = auto_deleted_count + 1,
       ${categoryColumn} = ${categoryColumn} + 1`,
    [postId]
  );
}

async function getShieldReport(postId) {
  const todayReport = await query(
    `SELECT *
     FROM shield_reports
     WHERE post_id = ? AND report_date = CURDATE()`,
    [postId]
  );

  const totalRows = await query(
    `SELECT SUM(auto_deleted_count) AS total_deleted
     FROM shield_reports
     WHERE post_id = ?`,
    [postId]
  );

  const postRows = await query(
    `SELECT shield_active, shield_enabled, shield_deleted_count, shield_activated_at
     FROM posts
     WHERE id = ? AND deleted_at IS NULL`,
    [postId]
  );

  return {
    shieldActive: !!postRows[0]?.shield_active,
    shieldEnabled: !!postRows[0]?.shield_enabled,
    totalDeletedToday: Number(todayReport[0]?.auto_deleted_count || 0),
    totalDeletedAllTime: Number(totalRows[0]?.total_deleted || 0),
    activatedAt: postRows[0]?.shield_activated_at || null
  };
}

async function manualActivate(postId, userId) {
  await assertPostOwner(postId, userId);

  await query(
    `UPDATE posts
     SET shield_active = 1,
         shield_enabled = 1,
         shield_activated_at = NOW()
     WHERE id = ?`,
    [postId]
  );

  await query(
    `INSERT INTO shield_events (post_id, trigger_type, comment_count_at_trigger)
     VALUES (?, 'manual', 0)`,
    [postId]
  );

  return { shieldActive: true };
}

async function manualDeactivate(postId, userId) {
  await assertPostOwner(postId, userId);

  await query(
    `UPDATE posts
     SET shield_active = 0
     WHERE id = ?`,
    [postId]
  );

  await query(
    `UPDATE shield_events
     SET deactivated_at = NOW()
     WHERE post_id = ? AND deactivated_at IS NULL`,
    [postId]
  );

  await query(
    `UPDATE comments
     SET status = 'approved'
     WHERE post_id = ?
       AND status = 'pending'
       AND deleted_at IS NULL`,
    [postId]
  );

  return { shieldActive: false };
}

async function checkVelocityAllPosts() {
  const activePosts = await query(
    `SELECT *
     FROM posts
     WHERE deleted_at IS NULL
       AND shield_active = 0`
  );

  for (const post of activePosts) {
    // eslint-disable-next-line no-await-in-loop
    await checkAndAutoActivateShield(post);
  }

  const shieldedPosts = await query(
    `SELECT id, user_id
     FROM posts
     WHERE shield_active = 1
       AND deleted_at IS NULL`
  );

  for (const post of shieldedPosts) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await query(
      `SELECT COUNT(*) AS cnt
       FROM comments
       WHERE post_id = ?
         AND deleted_by_shield = 0
         AND status IN ('approved', 'pending')
         AND user_id NOT IN (
           SELECT follower_id FROM follows WHERE following_id = ?
         )
         AND created_at > NOW() - INTERVAL ? MINUTE`,
      [post.id, post.user_id, SHIELD_RELEASE_WINDOW_MINUTES]
    );

    if (Number(rows[0]?.cnt || 0) >= SHIELD_RELEASE_THRESHOLD) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await query(
      `UPDATE posts
       SET shield_active = 0
       WHERE id = ?`,
      [post.id]
    );

    // eslint-disable-next-line no-await-in-loop
    await query(
      `UPDATE shield_events
       SET deactivated_at = NOW()
       WHERE post_id = ? AND deactivated_at IS NULL`,
      [post.id]
    );

    // eslint-disable-next-line no-await-in-loop
    await query(
      `UPDATE comments
       SET status = 'approved'
       WHERE post_id = ?
         AND status = 'pending'
         AND deleted_at IS NULL`,
      [post.id]
    );

    socketManager.emit(post.user_id, 'shield:deactivated', {
      postId: post.id
    });
  }
}

async function status(ownerId, postId) {
  await assertPostOwner(postId, ownerId);
  return getShieldReport(postId);
}

async function activateManual(ownerId, postId) {
  return manualActivate(postId, ownerId);
}

async function deactivateManual(ownerId, postId) {
  return manualDeactivate(postId, ownerId);
}

async function runAutoCycle() {
  return checkVelocityAllPosts();
}

module.exports = {
  processComment,
  getShieldReport,
  manualActivate,
  manualDeactivate,
  checkVelocityAllPosts,
  status,
  activateManual,
  deactivateManual,
  runAutoCycle
};

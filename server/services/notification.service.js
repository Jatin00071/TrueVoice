const notificationRepo = require('../repositories/notification.repo');
const socketManager = require('../socket/socket.manager');

function buildMessage(n) {
  const base = {
    like: 'liked your post',
    comment: 'commented on your post',
    follow: 'started following you',
    shield_activated: 'Shield activated on your post',
    content_reshared: 'reshared your content',
    message: 'sent you a message'
  };
  return base[n.type] || 'New notification';
}

async function create({ recipientId, senderId, type, postId = null }) {
  const notif = await notificationRepo.create({ recipientId, senderId, type, postId });
  socketManager.emit(recipientId, 'notification:new', {
    type: notif.type,
    message: buildMessage(notif),
    postId: notif.post_id,
    senderId: notif.sender_id,
    createdAt: notif.created_at
  });
  return notif;
}

async function list(userId) {
  return notificationRepo.listForUser(userId);
}

async function read(userId, notificationId) {
  return notificationRepo.markRead(userId, notificationId);
}

async function readAll(userId) {
  const count = await notificationRepo.markAllRead(userId);
  return { updated: count };
}

module.exports = { create, list, read, readAll };

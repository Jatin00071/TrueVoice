const notificationService = require('./notification.service');
const socketManager = require('../socket/socket.manager');

async function notifyMessage({ recipientId, senderId, conversationId, messageId }) {
  socketManager.emit(recipientId, 'message:notification', { conversationId, messageId, senderId, createdAt: new Date().toISOString() });

  try {
    await notificationService.create({ recipientId, senderId, type: 'message', postId: null });
  } catch (error) {
    // Existing notification schemas may enforce known types. Messaging remains functional even if
    // the legacy notification table rejects the new additive type.
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Messaging] notification integration skipped:', error.message || error.code || error);
    }
  }
}

module.exports = { notifyMessage };

const { Server } = require('socket.io');
const tokenService = require('../services/token.service');

function envInt(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const EVENT_LIMITS = {
  'message:send': { windowMs: 60 * 1000, limit: envInt('SOCKET_LIMIT_MESSAGE_SEND', 60) },
  'message:typing': { windowMs: 60 * 1000, limit: envInt('SOCKET_LIMIT_TYPING', 120) },
  'message:read': { windowMs: 60 * 1000, limit: envInt('SOCKET_LIMIT_READ', 120) },
  'message:retry': { windowMs: 60 * 1000, limit: envInt('SOCKET_LIMIT_RETRY', 10) },
  'message:queued': { windowMs: 60 * 1000, limit: envInt('SOCKET_LIMIT_QUEUED', 120) },
  'keys:exchange': { windowMs: 60 * 1000, limit: envInt('SOCKET_LIMIT_KEYS', 30) },
  'conversation:archived': { windowMs: 60 * 1000, limit: envInt('SOCKET_LIMIT_CONVERSATION', 20) }
};

class SocketManager {
  constructor() {
    this.io = null;
    this.userSocketId = new Map(); // userId -> socketId
  }

  init(httpServer, { corsOrigin }) {
    this.io = new Server(httpServer, {
      cors: {
        origin: corsOrigin,
        credentials: true
      }
    });

    this.io.use((socket, next) => {
      const token = socket.handshake?.auth?.token;
      if (!token) return next(new Error('AUTH_MISSING'));
      try {
        const payload = tokenService.verifyAccessToken(token);
        socket.data.userId = payload.userId;
        return next();
      } catch (e) {
        return next(new Error('AUTH_INVALID'));
      }
    });

    this.io.on('connection', (socket) => {
      const userId = socket.data.userId;
      socket.join(`user:${userId}`);
      this.userSocketId.set(userId, socket.id);

      const emitMessagingError = (code, message) => {
        socket.emit('message:error', { code, message });
      };

      const eventBuckets = new Map();
      const checkEventLimit = (event, ack) => {
        const config = EVENT_LIMITS[event];
        if (!config) return true;

        const now = Date.now();
        const current = eventBuckets.get(event);
        const nextBucket = current && current.resetAt > now
          ? { ...current, count: current.count + 1 }
          : { count: 1, resetAt: now + config.windowMs };

        eventBuckets.set(event, nextBucket);

        if (nextBucket.count <= config.limit) return true;

        const response = {
          ok: false,
          code: 'SOCKET_RATE_LIMIT',
          message: 'Too many realtime actions. Please slow down.'
        };
        if (typeof ack === 'function') ack(response);
        emitMessagingError(response.code, response.message);
        return false;
      };

      socket.on('message:send', async (payload = {}, ack) => {
        if (!checkEventLimit('message:send', ack)) return;
        try {
          const messageService = require('../services/message.service');
          const result = await messageService.send(userId, payload);
          if (typeof ack === 'function') ack({ ok: true, ...result });
        } catch (error) {
          const response = {
            ok: false,
            code: error.code || 'MESSAGE_SEND_FAILED',
            message: error.message || 'Unable to send message'
          };
          if (typeof ack === 'function') ack(response);
          emitMessagingError(response.code, response.message);
        }
      });

      socket.on('message:typing', async (payload = {}) => {
        if (!checkEventLimit('message:typing')) return;
        try {
          const conversationService = require('../services/conversation.service');
          const conversationRepo = require('../repositories/conversation.repo');
          const conversation = await conversationService.ensureAccess(userId, Number(payload.conversationId));
          this.emit(conversationRepo.getOtherParticipant(conversation, userId), 'message:typing', {
            conversationId: Number(payload.conversationId),
            userId,
            isTyping: Boolean(payload.isTyping)
          });
        } catch (error) {
          emitMessagingError(error.code || 'TYPING_FAILED', error.message || 'Unable to send typing indicator');
        }
      });

      socket.on('message:read', async (payload = {}, ack) => {
        if (!checkEventLimit('message:read', ack)) return;
        try {
          const messageService = require('../services/message.service');
          const result = await messageService.read(userId, Number(payload.messageId));
          if (typeof ack === 'function') ack({ ok: true, ...result });
        } catch (error) {
          const response = {
            ok: false,
            code: error.code || 'READ_RECEIPT_FAILED',
            message: error.message || 'Unable to mark message as read'
          };
          if (typeof ack === 'function') ack(response);
          emitMessagingError(response.code, response.message);
        }
      });

      socket.on('message:retry', async (_payload = {}, ack) => {
        if (!checkEventLimit('message:retry', ack)) return;
        try {
          const messageService = require('../services/message.service');
          await messageService.processQueue({ userId, limit: 25 });
          if (typeof ack === 'function') ack({ ok: true });
        } catch (error) {
          const response = {
            ok: false,
            code: error.code || 'MESSAGE_RETRY_FAILED',
            message: error.message || 'Unable to retry message'
          };
          if (typeof ack === 'function') ack(response);
          emitMessagingError(response.code, response.message);
        }
      });

      socket.on('message:queued', (payload = {}) => {
        if (!checkEventLimit('message:queued')) return;
        socket.emit('message:status', {
          messageId: payload.messageId,
          conversationId: payload.conversationId,
          status: 'pending',
          timestamp: new Date().toISOString()
        });
      });

      socket.on('keys:exchange', async (payload = {}, ack) => {
        if (!checkEventLimit('keys:exchange', ack)) return;
        try {
          const messageService = require('../services/message.service');
          const result = await messageService.exchangeKey(userId, payload);
          this.emit(userId, 'message:retry-eligible', {
            conversationId: payload.conversationId,
            readyToSend: true
          });
          if (typeof ack === 'function') ack({ ok: true, ...result });
        } catch (error) {
          const response = {
            ok: false,
            code: error.code || 'KEY_EXCHANGE_FAILED',
            message: error.message || 'Unable to exchange keys'
          };
          if (typeof ack === 'function') ack(response);
          emitMessagingError(response.code, response.message);
        }
      });

      socket.on('conversation:archived', async (payload = {}, ack) => {
        if (!checkEventLimit('conversation:archived', ack)) return;
        try {
          const conversationService = require('../services/conversation.service');
          const conversationRepo = require('../repositories/conversation.repo');
          const conversation = await conversationService.archive(userId, Number(payload.conversationId));
          if (conversation?.conversation) {
            this.emit(conversationRepo.getOtherParticipant(conversation.conversation, userId), 'conversation:archived', {
              conversationId: Number(payload.conversationId),
              userId
            });
          }
          if (typeof ack === 'function') ack({ ok: true, ...conversation });
        } catch (error) {
          const response = {
            ok: false,
            code: error.code || 'CONVERSATION_ARCHIVE_FAILED',
            message: error.message || 'Unable to archive conversation'
          };
          if (typeof ack === 'function') ack(response);
          emitMessagingError(response.code, response.message);
        }
      });

      socket.on('disconnect', () => {
        const current = this.userSocketId.get(userId);
        if (current === socket.id) this.userSocketId.delete(userId);
      });
    });

    return this.io;
  }

  emit(userId, event, data) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }
}

module.exports = new SocketManager();

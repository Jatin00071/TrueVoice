const { Server } = require('socket.io');
const tokenService = require('../services/token.service');

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


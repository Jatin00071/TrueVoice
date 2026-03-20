require('dotenv').config({ path: require('path').join(__dirname, '.env') });

if (!process.env.HUGGINGFACE_API_KEY) {
  console.warn('[WARNING] HUGGINGFACE_API_KEY is not set in .env');
  console.warn('[WARNING] Comment moderation will use keyword fallback only');
} else {
  console.log('[OK] Hugging Face API key loaded');
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[WARNING] ANTHROPIC_API_KEY not set — post screening disabled');
}

const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const postRoutes = require('./routes/post.routes');
const commentRoutes = require('./routes/comment.routes');
const likeRoutes = require('./routes/like.routes');
const shieldRoutes = require('./routes/shield.routes');
const notificationRoutes = require('./routes/notification.routes');

const socketManager = require('./socket/socket.manager');
const cronService = require('./services/cron.service');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);
const uploadStaticDir = process.env.NODE_ENV === 'production'
  ? '/tmp/uploads'
  : path.join(__dirname, 'uploads');

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadStaticDir));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'TrueVoice API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/posts', likeRoutes);
app.use('/api/v1/posts', commentRoutes);
app.use('/api/v1/posts', shieldRoutes);
app.use('/api/v1/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
socketManager.init(server, { corsOrigin: allowedOrigins });
cronService.start();

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[Server] TrueVoice running on port ${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
  // eslint-disable-next-line no-console
  console.log(`[Server] Client URL: ${process.env.CLIENT_URL}`);
});

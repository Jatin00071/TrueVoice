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

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

const corsOrigin = process.env.CLIENT_URL;
app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => res.json({ ok: true }));

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
socketManager.init(server, { corsOrigin });
cronService.start();

const port = Number(process.env.PORT || 5000);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`TrueVoice backend listening on :${port}`);
});

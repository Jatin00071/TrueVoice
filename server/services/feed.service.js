const postRepo = require('../repositories/post.repo');

async function feed(userId, { cursor, limit }) {
  return postRepo.feed({ userId, cursor, limit });
}

async function discover(userId, { limit }) {
  const items = await postRepo.discover({ userId, limit });
  return { items };
}

module.exports = { feed, discover };

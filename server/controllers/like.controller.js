const likeService = require('../services/like.service');

async function toggle(req, res) {
  const result = await likeService.toggle(req.auth.userId, Number(req.params.id));
  res.json(result);
}

module.exports = { toggle };


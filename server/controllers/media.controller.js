const mediaService = require('../services/media.service');

async function getById(req, res) {
  const asset = await mediaService.getById(req.params.id);

  res.setHeader('Content-Type', asset.mimeType);
  res.setHeader('Content-Length', String(asset.byteSize));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  return res.status(200).send(asset.data);
}

module.exports = {
  getById
};

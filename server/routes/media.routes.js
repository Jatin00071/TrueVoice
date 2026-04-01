const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const mediaController = require('../controllers/media.controller');

const router = express.Router();

router.get('/:id', asyncHandler(mediaController.getById));

module.exports = router;

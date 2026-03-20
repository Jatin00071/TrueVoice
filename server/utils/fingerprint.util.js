function normalizeText(text) {
  return String(text || '').trim().toLowerCase();
}

module.exports = { normalizeText };


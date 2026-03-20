const blockedAccessTokens = new Map(); // token -> expiresAtMs

function block(token, expiresAtMs) {
  if (!token) return;
  blockedAccessTokens.set(token, expiresAtMs || Date.now() + 15 * 60 * 1000);
}

function isBlocked(token) {
  if (!token) return false;
  const exp = blockedAccessTokens.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    blockedAccessTokens.delete(token);
    return false;
  }
  return true;
}

function sweep() {
  const now = Date.now();
  for (const [t, exp] of blockedAccessTokens.entries()) {
    if (now > exp) blockedAccessTokens.delete(t);
  }
}

module.exports = { block, isBlocked, sweep };


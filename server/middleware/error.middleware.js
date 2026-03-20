function normalizeError(err) {
  if (err && err.error === true && err.message && err.code && err.statusCode) return err;

  if (err && err.code === 'ER_DUP_ENTRY') {
    return { error: true, message: 'Duplicate value', code: 'DUPLICATE', statusCode: 409 };
  }
  if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
    return { error: true, message: 'Invalid reference', code: 'INVALID_REFERENCE', statusCode: 400 };
  }

  const statusCode = err?.statusCode || 500;
  const code = err?.code || 'INTERNAL_ERROR';
  const message = err?.message || 'Something went wrong';
  return { error: true, message, code, statusCode };
}

function notFound(req, res, next) {
  next({ error: true, message: 'Route not found', code: 'NOT_FOUND', statusCode: 404 });
}

function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);
  const statusCode = normalized.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  // eslint-disable-next-line no-console
  console.error(`[Error] ${statusCode}:`, normalized.message);
  if (isDev && err && err.stack) console.error(err.stack);

  res.status(statusCode).json({
    error: true,
    message: normalized.message || 'Internal server error',
    code: normalized.code || 'INTERNAL_ERROR',
    ...(isDev && err && err.stack ? { stack: err.stack } : {})
  });
}

module.exports = { notFound, errorHandler, normalizeError };

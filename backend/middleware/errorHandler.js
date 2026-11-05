const env = require('../config/env');
const { AppError } = require('../utils/AppError');

function scrub(text) {
  let output = String(text || '');
  const key = env.gemini.apiKey;
  if (key) {
    output = output.split(key).join('[REDACTED]');
  }
  return output;
}

function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `Rute ${req.method} ${req.path} tidak ditemukan.`));
}

function normalizeError(error) {
  if (error instanceof AppError) return error;

  if (error && error.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Ukuran data yang dikirim terlalu besar.');
  }
  if (error && error.type === 'entity.parse.failed') {
    return new AppError(400, 'INVALID_JSON', 'Body permintaan bukan JSON yang valid.');
  }
  if (error && error.message === 'CORS_NOT_ALLOWED') {
    return new AppError(403, 'CORS_NOT_ALLOWED', 'Origin ini tidak diizinkan mengakses API.');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server.');
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const normalized = normalizeError(error);
  const isUnexpected = !(error instanceof AppError) && normalized.status >= 500;

  const isExpectedSetupState = normalized.code === 'AI_NOT_CONFIGURED';

  if ((normalized.status >= 500 || isUnexpected) && !isExpectedSetupState) {
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    const detail = isUnexpected ? scrub(error && error.message) : scrub(normalized.message);
    console.error(`[error] ${normalized.code} ${req.method} ${path} -> ${normalized.status}: ${detail}`);
  }

  const body = {
    error: {
      code: normalized.code,
      message: normalized.message,
      requestId: req.id || null
    }
  };
  if (normalized.details !== undefined) {
    body.error.details = normalized.details;
  }

  return res.status(normalized.status).json(body);
}

module.exports = { notFound, errorHandler };

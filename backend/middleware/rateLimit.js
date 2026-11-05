const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const env = require('../config/env');
const { AppError } = require('../utils/AppError');

function buildLimiter({ windowMs, limit, message, perUser = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: perUser ? (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip)) : undefined,
    handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', message))
  });
}

const apiLimiter = buildLimiter({
  windowMs: env.limits.apiWindowMs,
  limit: env.limits.apiMax,
  message: 'Terlalu banyak permintaan. Tunggu beberapa saat lalu coba lagi.'
});

const aiLimiter = buildLimiter({
  windowMs: env.limits.aiWindowMs,
  limit: env.limits.aiMax,
  message: 'Batas permintaan AI tercapai. Tunggu satu menit lalu coba lagi.',
  perUser: true
});

module.exports = { apiLimiter, aiLimiter };

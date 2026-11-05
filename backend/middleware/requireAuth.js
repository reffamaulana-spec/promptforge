const env = require('../config/env');
const { AppError } = require('../utils/AppError');
const { verifyToken } = require('../services/auth');

function readBearer(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/);
  return match ? match[1] : null;
}

async function requireAuth(req, res, next) {
  try {
    if (!env.supabase.configured) {
      throw new AppError(
        503,
        'AUTH_NOT_CONFIGURED',
        'Login belum diatur. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di file .env lalu restart server.'
      );
    }
    const token = readBearer(req);
    if (!token) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Kamu perlu masuk dulu untuk memakai fitur ini.');
    }
    const user = await verifyToken(token);
    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Sesi login tidak valid atau sudah habis. Masuk lagi.');
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireAuth };

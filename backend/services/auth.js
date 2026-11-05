const crypto = require('crypto');
const env = require('../config/env');
const { AppError } = require('../utils/AppError');

const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map();

function cacheKey(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function remember(key, user) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { user, expires: Date.now() + CACHE_TTL_MS });
}

async function verifyWithSupabase(token) {
  const key = cacheKey(token);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.user;
  cache.delete(key);

  let response;
  try {
    response = await fetch(`${env.supabase.url}/auth/v1/user`, {
      headers: { apikey: env.supabase.anonKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    });
  } catch (error) {
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'Layanan login tidak bisa dihubungi. Coba lagi sebentar lagi.');
  }

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'Layanan login sedang bermasalah. Coba lagi sebentar lagi.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!payload || typeof payload.id !== 'string') return null;

  const user = { id: payload.id, email: typeof payload.email === 'string' ? payload.email : '' };
  remember(key, user);
  return user;
}

let verifier = verifyWithSupabase;

function setVerifier(next) {
  verifier = next || verifyWithSupabase;
}

function clearCache() {
  cache.clear();
}

function verifyToken(token) {
  return verifier(token);
}

module.exports = { verifyToken, setVerifier, clearCache };

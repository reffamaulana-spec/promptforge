const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

function toInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

function toList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTrustProxy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === '' || normalized === 'false') return false;
  if (normalized === 'true') return true;
  const hops = Number.parseInt(normalized, 10);
  return Number.isFinite(hops) && hops >= 0 ? hops : false;
}

const placeholderKeys = new Set(['', 'your_api_key_here', 'your-api-key-here', 'changeme']);

const nodeEnv = (process.env.NODE_ENV || 'development').trim();
const aiProvider = (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();
const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
const geminiKeyIsSet = !placeholderKeys.has(geminiApiKey.toLowerCase());

function toOrigin(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' || url.hostname === '127.0.0.1' || url.hostname === 'localhost' ? url.origin : '';
  } catch (error) {
    return '';
  }
}

const supabaseUrl = toOrigin(process.env.SUPABASE_URL);
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
const supabaseIsSet = Boolean(supabaseUrl) && supabaseAnonKey.length > 20 && !placeholderKeys.has(supabaseAnonKey.toLowerCase());

const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: toInt(process.env.PORT, 3000, { min: 1, max: 65535 }),
  trustProxy: toTrustProxy(process.env.TRUST_PROXY),
  allowedOrigins: toList(process.env.ALLOWED_ORIGINS),
  aiProvider,
  supabase: Object.freeze({
    configured: supabaseIsSet,
    url: supabaseIsSet ? supabaseUrl : '',
    anonKey: supabaseIsSet ? supabaseAnonKey : ''
  }),
  gemini: Object.freeze({
    apiKey: geminiKeyIsSet ? geminiApiKey : '',
    model: (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').trim(),
    timeoutMs: toInt(process.env.GEMINI_TIMEOUT_MS, 60000, { min: 1000, max: 300000 })
  }),
  limits: Object.freeze({
    apiMax: toInt(process.env.RATE_LIMIT_API_MAX, 120),
    apiWindowMs: toInt(process.env.RATE_LIMIT_API_WINDOW_MS, 15 * 60 * 1000),
    aiMax: toInt(process.env.RATE_LIMIT_AI_MAX, 20),
    aiWindowMs: toInt(process.env.RATE_LIMIT_AI_WINDOW_MS, 60 * 1000),
    jsonBody: (process.env.JSON_BODY_LIMIT || '1mb').trim(),
    maxImageBytes: toInt(process.env.MAX_IMAGE_MB, 5, { min: 1, max: 20 }) * 1024 * 1024
  })
});

module.exports = env;

import { getAccessToken } from './auth.js';

const DEFAULT_TIMEOUT_MS = 90000;

export class ApiError extends Error {
  constructor(message, { code = 'UNKNOWN', status = 0, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, headers = {}, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;

  try {
    response = await fetch(path, { method, headers, body, signal: controller.signal });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new ApiError('Server terlalu lama menjawab. Coba lagi sebentar lagi.', { code: 'TIMEOUT' });
    }
    throw new ApiError('Tidak bisa terhubung ke server. Pastikan "npm run dev" masih berjalan.', { code: 'NETWORK' });
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const info = payload && payload.error ? payload.error : null;
    throw new ApiError((info && info.message) || `Permintaan gagal (HTTP ${response.status}).`, {
      code: (info && info.code) || 'HTTP_ERROR',
      status: response.status,
      details: info ? info.details : undefined
    });
  }

  return payload;
}

export function getHealth() {
  return request('/api/health', { timeout: 8000 });
}

async function authHeaders(extra = {}) {
  const token = await getAccessToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export async function postJson(path, data) {
  return request(path, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data)
  });
}

export async function postForm(path, formData) {
  return request(path, { method: 'POST', headers: await authHeaders(), body: formData, timeout: 120000 });
}

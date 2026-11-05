const { AppError } = require('./AppError');

function fail(field, message) {
  throw new AppError(400, 'INVALID_INPUT', message, { field });
}

function ensureObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'INVALID_INPUT', 'Body permintaan harus berupa objek JSON.');
  }
  return body;
}

function readText(body, field, { label, max, min = 1, required = true }) {
  const value = body[field];

  if (value === undefined || value === null) {
    if (required) fail(field, `${label} wajib diisi.`);
    return '';
  }
  if (typeof value !== 'string') {
    fail(field, `${label} harus berupa teks.`);
  }

  const cleaned = value.replace(/\u0000/g, '').trim();

  if (cleaned.length === 0) {
    if (required) fail(field, `${label} wajib diisi.`);
    return '';
  }
  if (cleaned.length < min) {
    fail(field, `${label} minimal ${min} karakter.`);
  }
  if (cleaned.length > max) {
    fail(field, `${label} maksimal ${max} karakter.`);
  }
  return cleaned;
}

function readEnum(body, field, allowed, { label, fallback }) {
  const value = body[field];

  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(field, `${label} harus salah satu dari: ${allowed.join(', ')}.`);
  }
  return value;
}

module.exports = { ensureObject, readText, readEnum };

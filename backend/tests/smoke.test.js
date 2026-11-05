process.env.GEMINI_API_KEY = '';
process.env.RATE_LIMIT_API_MAX = '25';
process.env.RATE_LIMIT_API_WINDOW_MS = '600000';
process.env.JSON_BODY_LIMIT = '10kb';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { createApp } = require('../server');
const { requireAi } = require('../middleware/requireAi');
const { requestId } = require('../middleware/requestId');
const { errorHandler } = require('../middleware/errorHandler');
const { mapGeminiError, GeminiProvider } = require('../services/ai/gemini');
const { AppError } = require('../utils/AppError');

let server;
let baseUrl;

test.before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /api/health returns ok and reports AI not configured', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.ai.provider, 'gemini');
  assert.equal(body.ai.configured, false);
  assert.equal(body.ai.model, null);
  assert.match(body.ai.setupMessage, /GEMINI_API_KEY/);
});

test('responses carry security headers and request id, without x-powered-by', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.ok(response.headers.get('x-request-id'));
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(response.headers.get('content-security-policy'));
});

test('unknown API route returns JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('malformed JSON body returns 400 INVALID_JSON', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json'
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.code, 'INVALID_JSON');
});

test('oversized JSON body returns 413', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'x'.repeat(20000) })
  });
  assert.equal(response.status, 413);
  const body = await response.json();
  assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('requireAi blocks with 503 AI_NOT_CONFIGURED when no key is set', async () => {
  const app = express();
  app.use(requestId);
  app.post('/ai', requireAi, (req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  const local = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${local.address().port}/ai`, { method: 'POST' });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, 'AI_NOT_CONFIGURED');
  } finally {
    await new Promise((resolve) => local.close(resolve));
  }
});

test('provider refuses to call Gemini without a key', async () => {
  const provider = new GeminiProvider({ apiKey: '', model: 'any-model', timeoutMs: 1000 });
  assert.equal(provider.isConfigured, false);
  await assert.rejects(
    () => provider.generateText({ prompt: 'halo' }),
    (error) => error instanceof AppError && error.code === 'AI_NOT_CONFIGURED' && error.status === 503
  );
});

test('mapGeminiError maps upstream failures to safe app errors', () => {
  const cases = [
    [{ status: 429, message: 'quota' }, 429, 'AI_QUOTA_EXCEEDED'],
    [{ status: 403, message: 'forbidden' }, 502, 'AI_AUTH_FAILED'],
    [{ status: 400, message: 'API key not valid. Please pass a valid API key.' }, 502, 'AI_AUTH_FAILED'],
    [{ status: 400, message: 'bad payload' }, 400, 'AI_BAD_REQUEST'],
    [{ status: 404, message: 'not found' }, 502, 'AI_MODEL_NOT_FOUND'],
    [{ status: 503, message: 'overloaded' }, 503, 'AI_UNAVAILABLE'],
    [{ name: 'AbortError', message: 'aborted' }, 504, 'AI_TIMEOUT'],
    [{ message: 'something odd' }, 502, 'AI_REQUEST_FAILED']
  ];
  for (const [input, status, code] of cases) {
    const mapped = mapGeminiError(input);
    assert.equal(mapped.status, status, `status for ${code}`);
    assert.equal(mapped.code, code);
  }
});

test('rate limiter eventually returns 429 RATE_LIMITED', async () => {
  let limited = null;
  for (let i = 0; i < 40; i += 1) {
    const response = await fetch(`${baseUrl}/api/health`);
    if (response.status === 429) {
      limited = await response.json();
      break;
    }
  }
  assert.ok(limited, 'expected a 429 response within 40 requests');
  assert.equal(limited.error.code, 'RATE_LIMITED');
});

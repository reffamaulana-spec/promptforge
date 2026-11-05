process.env.SUPABASE_URL = 'http://127.0.0.1:45871';
process.env.SUPABASE_ANON_KEY = 'test_anon_key_not_real_0123456789';
process.env.GEMINI_API_KEY = 'test_key_not_real';
process.env.RATE_LIMIT_API_MAX = '1000';
process.env.RATE_LIMIT_AI_MAX = '3';
process.env.RATE_LIMIT_AI_WINDOW_MS = '600000';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp } = require('../server');
const { setProvider } = require('../services/ai/provider');
const { setVerifier, clearCache } = require('../services/auth');

const USERS = {
  'token-user-a-0123456789-abcdef': { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.com' },
  'token-user-b-0123456789-abcdef': { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@example.com' },
  'token-user-c-0123456789-abcdef': { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'c@example.com' },
  'token-user-d-0123456789-abcdef': { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', email: 'd@example.com' }
};

let authHits = [];
let authMode = 'normal';
let supabase;
let server;
let baseUrl;

const fakeProvider = {
  name: 'fake',
  model: 'fake-model',
  isConfigured: true,
  setupMessage: '',
  async generateText() {
    return { text: 'Hasil.', model: 'fake-model', usage: null };
  }
};

test.before(async () => {
  setVerifier(null);
  setProvider(fakeProvider);
  supabase = http.createServer((req, res) => {
    authHits.push({ url: req.url, apikey: req.headers.apikey, authorization: req.headers.authorization });
    if (authMode === 'down') {
      res.writeHead(500);
      res.end('{}');
      return;
    }
    const token = String(req.headers.authorization || '').replace('Bearer ', '');
    const user = USERS[token];
    if (req.url !== '/auth/v1/user' || !user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"msg":"invalid"}');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(user));
  });
  await new Promise((resolve) => supabase.listen(45871, '127.0.0.1', resolve));
  await new Promise((resolve) => {
    server = createApp().listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => supabase.close(resolve));
});

test.beforeEach(() => {
  authHits = [];
  authMode = 'normal';
  clearCache();
});

async function translate(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}/api/ai/translate`, { method: 'POST', headers, body: JSON.stringify({ text: 'halo' }) });
  return { status: response.status, body: await response.json() };
}

test('AI endpoint without a token answers 401 UNAUTHENTICATED and never calls Supabase', async () => {
  const { status, body } = await translate(null);
  assert.equal(status, 401);
  assert.equal(body.error.code, 'UNAUTHENTICATED');
  assert.equal(authHits.length, 0);
});

test('malformed Authorization header answers 401 without calling Supabase', async () => {
  const { status } = await translate('short');
  assert.equal(status, 401);
  assert.equal(authHits.length, 0);
});

test('a token Supabase rejects answers 401', async () => {
  const { status, body } = await translate('token-unknown-0123456789-abcdef');
  assert.equal(status, 401);
  assert.equal(body.error.code, 'UNAUTHENTICATED');
});

test('a valid token reaches the AI and Supabase receives apikey and bearer', async () => {
  const { status, body } = await translate('token-user-a-0123456789-abcdef');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(authHits.length, 1);
  assert.equal(authHits[0].apikey, 'test_anon_key_not_real_0123456789');
  assert.equal(authHits[0].authorization, 'Bearer token-user-a-0123456789-abcdef');
});

test('verified tokens are cached for a short time', async () => {
  await translate('token-user-a-0123456789-abcdef');
  await translate('token-user-a-0123456789-abcdef');
  assert.equal(authHits.length, 1);
});

test('Supabase outage answers 503 AUTH_UNAVAILABLE', async () => {
  authMode = 'down';
  const { status, body } = await translate('token-user-a-0123456789-abcdef');
  assert.equal(status, 503);
  assert.equal(body.error.code, 'AUTH_UNAVAILABLE');
});

test('AI rate limit is counted per user, not per IP', async () => {
  const c = 'token-user-c-0123456789-abcdef';
  const d = 'token-user-d-0123456789-abcdef';
  assert.equal((await translate(c)).status, 200);
  assert.equal((await translate(c)).status, 200);
  assert.equal((await translate(c)).status, 200);
  assert.equal((await translate(c)).status, 429);
  assert.equal((await translate(d)).status, 200);
});

test('GET /api/config exposes only the public Supabase settings', async () => {
  const response = await fetch(`${baseUrl}/api/config`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ['supabase']);
  assert.equal(body.supabase.url, 'http://127.0.0.1:45871');
  assert.equal(body.supabase.anonKey, 'test_anon_key_not_real_0123456789');
  assert.doesNotMatch(JSON.stringify(body), /test_key_not_real"/);
});

test('CSP connect-src allows the Supabase origin and nothing broader', async () => {
  const response = await fetch(`${baseUrl}/`);
  const csp = response.headers.get('content-security-policy');
  const connect = csp.match(/connect-src ([^;]*)/)[1];
  assert.equal(connect, "'self' http://127.0.0.1:45871");
});

test('health reports that login is configured', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(body.auth.configured, true);
});

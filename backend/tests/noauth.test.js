process.env.SUPABASE_URL = '';
process.env.SUPABASE_ANON_KEY = '';
process.env.GEMINI_API_KEY = 'test_key_not_real';
process.env.RATE_LIMIT_API_MAX = '1000';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../server');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('without Supabase settings, AI endpoints answer 503 AUTH_NOT_CONFIGURED', async () => {
  const response = await fetch(`${baseUrl}/api/ai/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer abcdefghijklmnopqrstuvwxyz' },
    body: JSON.stringify({ text: 'halo' })
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error.code, 'AUTH_NOT_CONFIGURED');
});

test('without Supabase settings, config is null and health says login is not configured', async () => {
  const config = await (await fetch(`${baseUrl}/api/config`)).json();
  assert.equal(config.supabase, null);
  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  assert.equal(health.auth.configured, false);
});

test('without Supabase settings, CSP connect-src stays self only', async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.headers.get('content-security-policy').match(/connect-src ([^;]*)/)[1], "'self'");
});

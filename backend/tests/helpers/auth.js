process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:45871';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test_anon_key_not_real_0123456789';

const TEST_TOKEN = 'test-token-0123456789-abcdef';
const TEST_USER = { id: '11111111-1111-4111-8111-111111111111', email: 'tester@example.com' };

function installAuth() {
  const { setVerifier } = require('../../services/auth');
  setVerifier(async (token) => (token === TEST_TOKEN ? TEST_USER : null));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!String(url).includes('/api/ai/')) return originalFetch(input, init);
    const headers = new Headers(init.headers || {});
    if (!headers.has('authorization')) headers.set('authorization', `Bearer ${TEST_TOKEN}`);
    return originalFetch(input, { ...init, headers });
  };
}

module.exports = { installAuth, TEST_TOKEN, TEST_USER };

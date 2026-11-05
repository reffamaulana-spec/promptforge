process.env.GEMINI_API_KEY = '';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createApp } = require('../server');

const FRONTEND_DIR = path.join(__dirname, '..', '..', 'public');

function listFiles(dir, extension) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, extension);
    return full.endsWith(extension) ? [full] : [];
  });
}

const jsFiles = listFiles(path.join(FRONTEND_DIR, 'js'), '.js');
const indexHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'index.html'), 'utf8');

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

test('index.html is served with a strict CSP', async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const csp = response.headers.get('content-security-policy');
  assert.ok(csp, 'CSP header is missing');
  assert.match(csp, /script-src 'self'/);
  assert.ok(!/unsafe-inline/.test(csp.match(/script-src[^;]*/)[0]), 'script-src must not allow unsafe-inline');
});

test('all frontend assets are served', async () => {
  const assets = ['/css/style.css', '/favicon.svg', '/vendor/supabase.js', ...jsFiles.map((file) => '/' + path.relative(FRONTEND_DIR, file).split(path.sep).join('/'))];
  for (const asset of assets) {
    const response = await fetch(`${baseUrl}${asset}`);
    assert.equal(response.status, 200, `${asset} returned ${response.status}`);
    await response.arrayBuffer();
  }
});

test('index.html has no inline scripts, styles, or event handlers', () => {
  const scripts = [...indexHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0);
  for (const [, attrs, body] of scripts) {
    assert.match(attrs, /\bsrc=/, 'script without src found');
    assert.equal(body.trim(), '', 'inline script body found');
  }
  assert.ok(!/<style\b/i.test(indexHtml), 'inline <style> found');
  assert.ok(!/\sstyle\s*=/i.test(indexHtml), 'inline style attribute found');
  assert.ok(!/\son[a-z]+\s*=/i.test(indexHtml), 'inline event handler found');
});

test('frontend JS avoids unsafe DOM and eval APIs', () => {
  const forbidden = [/\.innerHTML\b/, /\.outerHTML\b/, /\binsertAdjacentHTML\b/, /\beval\s*\(/, /\bnew Function\b/, /document\.write\s*\(/];
  for (const file of jsFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(source), `${path.relative(FRONTEND_DIR, file)} matches ${pattern}`);
    }
  }
});

test('every relative module import resolves to a file', () => {
  const importPattern = /(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]/g;
  for (const file of jsFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const target = path.resolve(path.dirname(file), match[1] || match[2]);
      assert.ok(fs.existsSync(target), `${path.relative(FRONTEND_DIR, file)} imports missing ${match[1] || match[2]}`);
    }
  }
});

test('unknown API paths return JSON 404, not the HTML page', async () => {
  const response = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /application\/json/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { request } from 'node:http';
import { once } from 'node:events';
import { createPreviewServer } from '../lib/preview.mjs';

async function fixture(t, prefix = '') {
  const parent = mkdtempSync(join(tmpdir(), 'brief-preview-'));
  const root = join(parent, 'site');
  const put = (file, content) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  };
  put('site.config.json', JSON.stringify({ baseUrl: `https://example.github.io${prefix}/` }));
  put('content/2026-10-30.json', JSON.stringify({ date: '2026-10-30', sections: [{ title: '测试', items: [{ text: '静态正文' }] }] }));
  for (const file of ['index.html', 'map/index.html', 'archive/index.html', 'about/index.html', 'sources/index.html', 'subscribe/index.html', '2026-10-30/index.html', '2026-10-30/map/index.html']) put(file, `<h1>Public ${file}</h1>`);
  const missing = `<base href="${prefix}/"><link rel="stylesheet" href="assets/site.css"><h1>Custom 404</h1><a href="index.html">返回首页</a>`;
  put('404.html', missing);
  put('assets/site.css', 'body { color: #111; }');
  put('assets/app.js', 'void 0;');
  put('assets/favicon.svg', '<svg/>');
  put('assets/map-h.svg', '<svg/>');
  put('assets/og-card.png', Buffer.from([0, 1, 2]));
  for (const file of ['feed.xml', 'sitemap.xml', 'robots.txt', '.nojekyll', 'CNAME']) put(file, 'public');
  for (const file of ['.git/config', '.env', '.qa/private.txt', 'build.mjs', 'data/sources.json', 'node_modules/package.json', 'docs/private.md']) put(file, 'PRIVATE-FIXTURE');
  const outside = join(parent, 'private.txt');
  writeFileSync(outside, 'OUTSIDE-FIXTURE');
  const server = createPreviewServer(root, { port: 0 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    rmSync(parent, { recursive: true, force: true });
  });
  const get = (path, options = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method: options.method || 'GET', headers: { Host: options.host || `127.0.0.1:${port}` }, agent: false }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
  return { root, port, outside, missing, get };
}

test('preview serves only public outputs with safe headers and correct HEAD responses', async t => {
  const { get, missing } = await fixture(t);
  const home = await get('/');
  assert.equal(home.status, 200);
  assert.match(home.body, /Public index.html/);
  assert.equal(home.headers['x-content-type-options'], 'nosniff');
  assert.equal(home.headers['referrer-policy'], 'no-referrer');
  assert.equal(home.headers['cache-control'], 'no-store');
  const css = await get('/assets/site.css?v=content-version');
  assert.equal(css.status, 200);
  assert.match(css.headers['content-type'], /^text\/css/);
  const head = await get('/assets/site.css', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(Number(head.headers['content-length']), Buffer.byteLength(css.body));
  const unknown = await get('/missing/deep/path/');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body, missing);
  const missingHead = await get('/missing/deep/path/', { method: 'HEAD' });
  assert.equal(missingHead.status, 404);
  assert.equal(missingHead.body, '');
  assert.equal(Number(missingHead.headers['content-length']), Buffer.byteLength(missing));
});

test('preview rejects private files, hidden paths and encoded traversal without revealing paths', async t => {
  const { get, root } = await fixture(t);
  for (const path of ['/.git/config', '/.env', '/.qa/private.txt', '/build.mjs', '/site.config.json', '/content/2026-10-30.json', '/data/sources.json', '/node_modules/package.json', '/docs/private.md', '/%2e%2e/private.txt', '/%2e%2e%2fprivate.txt', '/%5c..%5cprivate.txt', '/%00', '/%']) {
    const result = await get(path);
    assert.equal(result.status, 404, path);
    assert.ok(!result.body.includes('PRIVATE-FIXTURE'), path);
    assert.ok(!result.body.includes(root), path);
  }
});

test('preview rejects foreign Host headers and non-read methods', async t => {
  const { get, port } = await fixture(t);
  for (const host of [`attacker.example:${port}`, `127.0.0.1.attacker.example:${port}`, '127.0.0.1:1', 'localhost', `[::1]:${port}`]) {
    assert.equal((await get('/', { host })).status, 403, host);
  }
  assert.equal((await get('/', { host: `localhost:${port}` })).status, 200);
  const post = await get('/', { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});

test('preview refuses public-path symlinks, including a symlinked fallback page', async t => {
  const { get, root, outside } = await fixture(t);
  unlinkSync(join(root, 'assets/site.css'));
  symlinkSync(outside, join(root, 'assets/site.css'));
  const asset = await get('/assets/site.css');
  assert.equal(asset.status, 404);
  assert.ok(!asset.body.includes('OUTSIDE-FIXTURE'));
  unlinkSync(join(root, '404.html'));
  symlinkSync(outside, join(root, '404.html'));
  const unknown = await get('/missing/');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body, 'Not found');
});

test('preview preserves project-prefixed routes, relative 404 resources and root preview compatibility', async t => {
  const { get, missing } = await fixture(t, '/defense-brief');
  const redirect = await get('/defense-brief?q=hello');
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.location, '/defense-brief/?q=hello');
  assert.equal((await get('/defense-brief/')).status, 200);
  assert.equal((await get('/defense-brief/2026-10-30/')).status, 200);
  assert.equal((await get('/defense-brief/assets/site.css?v=1')).status, 200);
  assert.equal((await get('/')).status, 200);
  const directory = await get('/defense-brief/archive?q=search');
  assert.equal(directory.status, 302);
  assert.equal(directory.headers.location, '/defense-brief/archive/?q=search');
  const unknown = await get('/defense-brief/a/missing/');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body, missing);
  assert.match(unknown.body, /<base href="\/defense-brief\/">/);
});

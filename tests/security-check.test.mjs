import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectHtml, inspectClientScript, scanSecretText, sensitiveFilename } from '../tools/security-check.mjs';

const scriptBytes = Buffer.from('document.documentElement.classList.add("js");');
const styleBytes = Buffer.from('body { color: black; }');
const hash = (bytes, format) => createHash('sha256').update(bytes).digest(format);
const scriptIntegrity = `sha256-${hash(scriptBytes, 'base64')}`;
const csp = `default-src 'none'; script-src '${scriptIntegrity}'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'`;
const escape = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const options = { page: '2026-10-30/index.html', baseUrl: 'https://dibao.news/', scriptBytes, styleBytes };
function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escape(csp)}"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="stylesheet" href="../assets/site.css?v=${hash(styleBytes, 'hex').slice(0, 16)}"><script src="../assets/app.js?v=${hash(scriptBytes, 'hex').slice(0, 16)}" integrity="${scriptIntegrity}" defer></script></head><body><p>&lt;script&gt;新闻原文&lt;/script&gt;</p><a href="https://example.com/news" target="_blank" rel="noopener">来源</a></body></html>`;
}

test('security regression accepts escaped prose and the one hash-authorized script', () => {
  assert.deepEqual(inspectHtml(fixture(), options), []);
  assert.deepEqual(inspectClientScript(scriptBytes.toString()), []);
});

test('security regression rejects executable HTML, obfuscated link protocols and policy bypasses', () => {
  const cases = [
    [html => html.replace('</body>', '<img src="x" onerror="alert(1)"></body>'), /内联事件/],
    [html => html.replace('</body>', '<a href="java&#x0a;script&colon;alert(1)">坏链接</a></body>'), /危险 URL/],
    [html => html.replace('</body>', '<script>alert(1)</script></body>'), /内联脚本/],
    [html => html.replace('</body>', '<iframe src="https://evil.example/"></iframe></body>'), /活动嵌入/],
    [html => html.replace('rel="noopener"', 'rel="opener"'), /noopener/],
    [html => html.replace('default-src', 'script-src-elem *; default-src'), /script-src-elem/],
    [html => html.replace('sha256-', 'sha256-invalid'), /script-src/],
    [html => html.replace(`integrity="${scriptIntegrity}"`, 'integrity="sha256-wrong"'), /SRI/],
    [html => html.replace('../assets/app.js?', 'https://evil.example/assets/app.js?'), /本站 app.js/],
    [html => html.replace('strict-origin-when-cross-origin', 'unsafe-url'), /referrer/],
  ];
  for (const [mutate, expected] of cases) assert.ok(inspectHtml(mutate(fixture()), options).some(error => expected.test(error)), String(expected));
});

test('client regression blocks HTML sinks, dynamic evaluation and unexpected network code', () => {
  for (const source of ['target.innerHTML = text', 'document.write(text)', 'eval(text)', 'new Function(text)', 'fetch(url)', 'new WebSocket(url)']) assert.ok(inspectClientScript(source).length, source);
  assert.deepEqual(inspectClientScript('node.textContent = query; button.hidden = true;'), []);
});

test('secret regression redacts values and distinguishes examples from secret filenames', () => {
  const token = 'ghp_' + 'A'.repeat(36);
  const hits = scanSecretText('intro\n' + token + '\n', 'example.txt');
  assert.deepEqual(hits, [{ file: 'example.txt', rule: 'GitHub personal token', line: 2 }]);
  assert.ok(!JSON.stringify(hits).includes(token));
  assert.deepEqual(scanSecretText('sha512-Abc123+SAFE/LOCKFILE==', 'package-lock.json'), []);
  for (const file of ['.env', '.env.production', 'cert/private.pem', 'credentials.json', 'id_ed25519']) assert.equal(sensitiveFilename(file), true, file);
  for (const file of ['.env.example', '.env.sample', 'README.md', 'package-lock.json', 'id_ed25519.pub']) assert.equal(sensitiveFilename(file), false, file);
});

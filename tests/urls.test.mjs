import test from 'node:test';
import assert from 'node:assert/strict';
import { relativeUrl, absoluteUrl, escapeHtml, escapeXml } from '../lib/urls.mjs';

const baseUrl = 'https://meiyou398.github.io/defense-brief/';

test('relative navigation preserves the Pages project prefix at every route depth', () => {
  const cases = [
    ['index.html', '2026-10-27/'],
    ['2026-10-27/index.html', 'archive/'],
    ['2026-10-27/map/index.html', '2026-10-27/#n09'],
    ['2026-10-27/map/index.html', 'assets/site.css'],
    ['archive/index.html', 'index.html'],
  ];
  for (const [from, target] of cases) {
    const href = relativeUrl(from, target);
    assert.ok(!href.startsWith('/'), `${from} → ${target}`);
    assert.equal(new URL(href, new URL(from, baseUrl)).href, new URL(target, baseUrl).href);
  }
});

test('same-page fragment links stay on the currently requested issue', () => {
  assert.equal(relativeUrl('2026-10-27/index.html', '#n09'), '#n09');
  assert.equal(new URL(relativeUrl('2026-10-27/index.html', '#n09'), `${baseUrl}2026-10-27/`).href, `${baseUrl}2026-10-27/#n09`);
});

test('metadata URLs use the configured canonical base', () => {
  assert.equal(absoluteUrl({ baseUrl }, ''), baseUrl);
  assert.equal(absoluteUrl({ baseUrl }, '2026-10-27/'), `${baseUrl}2026-10-27/`);
});

test('plain JSON text cannot break HTML attributes or XML markup', () => {
  const text = '<script data-x="a&b">\'新闻\'</script>';
  const encoded = '&lt;script data-x=&quot;a&amp;b&quot;&gt;&#39;新闻&#39;&lt;/script&gt;';
  assert.equal(escapeHtml(text), encoded);
  assert.equal(escapeXml(text), encoded);
});

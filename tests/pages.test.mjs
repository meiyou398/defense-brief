import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { context } from '../templates/layout.mjs';
import { notFoundPage } from '../templates/informational.mjs';
import { archivePage } from '../templates/archive.mjs';
import { normalizeIssue } from '../lib/normalize.mjs';
import { issuePage } from '../templates/issue.mjs';
import { mapPage } from '../templates/map.mjs';

const config = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const sample = JSON.parse(readFileSync(new URL('../content/2026-10-27.json', import.meta.url), 'utf8'));
const assetVersion = file => createHash('sha256').update(readFileSync(new URL(`../${file}`, import.meta.url))).digest('hex').slice(0, 16);

test('404 resources and return navigation resolve correctly from arbitrary missing paths', () => {
  const html = notFoundPage(context(config, '404.html', '404'));
  const base = html.match(/<base\s+href="([^"]+)"/i)?.[1];
  assert.equal(base, new URL(config.baseUrl).pathname);
  assert.ok(html.indexOf('<base') < html.indexOf('<link'));
  const stylesheet = html.match(/<link\b[^>]*href="([^"]*assets\/site\.css(?:\?[^"#]*)?)"/i)?.[1];
  const script = html.match(/<script\b[^>]*src="([^"]*assets\/app\.js(?:\?[^"#]*)?)"/i)?.[1];
  const home = html.match(/<a\b[^>]*href="([^"]+)"[^>]*>返回首页/i)?.[1];
  assert.ok(stylesheet && script && home);
  for (const missing of ['missing/', 'a/b/c/', 'a/missing.html']) {
    const responseUrl = new URL(missing, config.baseUrl);
    const documentBase = new URL(base, responseUrl);
    assert.equal(new URL(stylesheet, documentBase).href, new URL(`assets/site.css?v=${assetVersion('assets/site.css')}`, config.baseUrl).href);
    assert.equal(new URL(script, documentBase).href, new URL(`assets/app.js?v=${assetVersion('assets/app.js')}`, config.baseUrl).href);
    assert.equal(new URL(home, documentBase).href, new URL('index.html', config.baseUrl).href);
  }
});

test('all page depths use one local stylesheet and script versioned by the actual asset bytes', () => {
  const issue = normalizeIssue(sample, config);
  issue.issueNumber = 11;
  const examples = [
    ['index.html', ctx => issuePage(ctx, issue), 'issue', { latest: true }],
    [`${issue.date}/index.html`, ctx => issuePage(ctx, issue), 'issue'],
    [`${issue.date}/map/index.html`, ctx => mapPage(ctx, issue), 'map'],
    ['archive/index.html', ctx => archivePage(ctx, [issue]), 'archive'],
    ['404.html', ctx => notFoundPage(ctx), '404']
  ];
  for (const [file, render, page, options] of examples) {
    const html = render(context(config, file, page, options));
    const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)];
    const scripts = [...html.matchAll(/<script\b[^>]*>/gi)];
    assert.equal(styles.length, 1, `${file}: one stylesheet`);
    assert.equal(scripts.length, 1, `${file}: one script`);
    const documentURL = new URL(file, config.baseUrl);
    const base = html.match(/<base\s+href="([^"]+)"/i)?.[1];
    const documentBase = base ? new URL(base, documentURL) : documentURL;
    for (const [tag, attribute, asset] of [[styles[0][0], 'href', 'assets/site.css'], [scripts[0][0], 'src', 'assets/app.js']]) {
      const value = tag.match(new RegExp(`${attribute}="([^"]+)"`, 'i'))?.[1];
      assert.ok(value && !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value), `${file}: relative ${asset}`);
      const url = new URL(value, documentBase);
      const expected = new URL(asset, config.baseUrl);
      assert.equal(url.origin, expected.origin, `${file}: ${asset} origin`);
      assert.equal(url.pathname, expected.pathname, `${file}: ${asset} pathname`);
      assert.equal(url.hash, '', `${file}: ${asset} has no fragment`);
      assert.deepEqual([...url.searchParams], [['v', assetVersion(asset)]], `${file}: ${asset} content hash`);
    }
  }
});

test('archive search includes published map locations, all prose and numeric callouts', () => {
  const issue = normalizeIssue(sample, config);
  issue.issueNumber = 11;
  const html = archivePage(context(config, 'archive/index.html', 'archive'), [issue]);
  const corpus = html.match(/data-search="([^"]+)"/)?.[1];
  assert.ok(corpus);
  for (const value of ['慕尼黑', '阿拉布加', 'arrw 量产合同', '低成本拦截弹赛道在升温']) {
    assert.ok(corpus.includes(value), `search corpus should include ${value}`);
  }
  assert.ok(corpus.includes('https://www.twz.com/'));
});

test('system-font pages make no external font requests and Today is only current on latest home', () => {
  const issue=normalizeIssue(sample,config);issue.issueNumber=11;
  const old=issuePage(context(config,'2026-10-27/index.html','issue'),issue);
  const home=issuePage(context(config,'index.html','issue',{latest:true}),issue);
  assert.ok(!/fonts\.(googleapis|gstatic)\.com|data-fonts/.test(old));
  assert.ok(!old.match(/<nav class="site-nav\b[\s\S]*?<\/nav>/)[0].includes('aria-current="page"'));
  assert.ok(home.match(/<nav class="site-nav\b[\s\S]*?<\/nav>/)[0].includes('aria-current="page"'));
});
test('legacy map renders grouped choices and every full-text action statically', () => {
  const raw=JSON.parse(readFileSync(new URL('../content/2026-10-17.json',import.meta.url),'utf8'));
  const issue=normalizeIssue(raw,config);issue.issueNumber=1;
  const html=mapPage(context(config,'2026-10-17/map/index.html','map'),issue);
  assert.equal((html.match(/data-marker /g)||[]).length,13);
  assert.equal((html.match(/data-feed-row /g)||[]).length,29);
  assert.equal((html.match(/data-detail-full /g)||[]).length,29);
  assert.ok(html.includes('data-group-choice'));
  for(const group of issue.markerGroups) assert.ok(html.includes(`data-items="${group.map(i=>i.number).join(' ')}"`));
});

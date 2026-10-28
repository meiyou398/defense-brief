import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { context } from '../templates/layout.mjs';
import { notFoundPage } from '../templates/informational.mjs';
import { archivePage } from '../templates/archive.mjs';
import { normalizeIssue } from '../lib/normalize.mjs';
import { issuePage } from '../templates/issue.mjs';
import { mapPage } from '../templates/map.mjs';

const config = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const sample = JSON.parse(readFileSync(new URL('../content/2026-10-27.json', import.meta.url), 'utf8'));

test('404 resources and return navigation resolve correctly from arbitrary missing paths', () => {
  const html = notFoundPage(context(config, '404.html', '404'));
  const base = html.match(/<base\s+href="([^"]+)"/i)?.[1];
  assert.equal(base, new URL(config.baseUrl).pathname);
  assert.ok(html.indexOf('<base') < html.indexOf('<link'));
  const stylesheet = html.match(/<link\b[^>]*href="([^"]*assets\/site\.css)"/i)?.[1];
  const script = html.match(/<script\b[^>]*src="([^"]*assets\/app\.js)"/i)?.[1];
  const home = html.match(/<a\b[^>]*href="([^"]+)"[^>]*>返回首页/i)?.[1];
  assert.ok(stylesheet && script && home);
  for (const missing of ['missing/', 'a/b/c/', 'a/missing.html']) {
    const responseUrl = new URL(missing, config.baseUrl);
    const documentBase = new URL(base, responseUrl);
    assert.equal(new URL(stylesheet, documentBase).href, new URL('assets/site.css', config.baseUrl).href);
    assert.equal(new URL(script, documentBase).href, new URL('assets/app.js', config.baseUrl).href);
    assert.equal(new URL(home, documentBase).href, new URL('index.html', config.baseUrl).href);
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

test('fonts load independently of JS and the Today nav is only current on latest home', () => {
  const issue=normalizeIssue(sample,config);issue.issueNumber=11;
  const old=issuePage(context(config,'2026-10-27/index.html','issue'),issue);
  const home=issuePage(context(config,'index.html','issue',{latest:true}),issue);
  assert.ok(old.includes('display=swap'));assert.ok(!old.includes('data-fonts'));
  assert.ok(!old.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)[0].includes('aria-current="page"'));
  assert.ok(home.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)[0].includes('aria-current="page"'));
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

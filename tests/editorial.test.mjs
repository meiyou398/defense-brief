import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateIssue } from '../lib/validate.mjs';
import { normalizeIssue } from '../lib/normalize.mjs';
import { context } from '../templates/layout.mjs';
import { issuePage } from '../templates/issue.mjs';
import { sourceLabel } from '../templates/components.mjs';

const config = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const makeRaw = () => ({
  date: '2026-10-29',
  summary: '保留编辑写入的完整摘要。',
  highlights: [{ lead: '第二条', text: '编辑确认的重点。', item: 2 }],
  sections: [{ title: '其他', items: [
    { headline: '首条标题', text: '原有正文一。', related: [2] },
    { headline: '重点条目标题', text: '原有正文二。', tierText: '三档评论 + 一档文件事实' },
  ] }],
});
const render = (raw, latest = true) => {
  const issue = normalizeIssue(validateIssue(raw), config);
  issue.issueNumber = 13;
  return issuePage(context(config, latest ? 'index.html' : `${raw.date}/index.html`, 'issue', { latest }), issue);
};

test('main headline is optional, bounded and uses the selected highlight without rewriting facts', () => {
  const raw = makeRaw();
  assert.match(render(raw), /<h1[^>]*>重点条目标题<\/h1>/);
  assert.match(render({ ...raw, headline: '编辑确认的本期主线' }), /<h1[^>]*>编辑确认的本期主线<\/h1>/);
  assert.throws(() => render({ ...raw, headline: '字'.repeat(65) }), /headline/);
  assert.match(render({ ...raw, headline: '   ', highlights: [] }), /<h1[^>]*>首条标题<\/h1>/);
});

test('native full text has one anchor per story, static related links and mixed original tier text', () => {
  const html = render(makeRaw(), false);
  assert.equal((html.match(/\bid="n01"/g) || []).length, 1);
  assert.equal((html.match(/\bid="n02"/g) || []).length, 1);
  assert.equal((html.match(/<details\b[^>]*class="b-story"[^>]*\bopen/g) || []).length, 2);
  assert.match(html, /href="#n02"/);
  assert.ok(html.includes('三档评论 + 一档文件事实'));
  assert.ok(html.includes('保留编辑写入的完整摘要。'));
  assert.ok(!/noindex|品牌延续版|第二版预览|brand\.html|2026-10-29\/map\//.test(html));
  assert.match(html, /href="map\/"/);
});

test('unsafe editorial text is escaped in the headline and optional analysis', () => {
  const raw = makeRaw();
  raw.headline = '<script>alert(1)</script>';
  raw.sections[0].items[0].whyItMatters = '<img src=x onerror=alert(2)>';
  const html = render(raw);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(2)&gt;'));
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes('<img src=x'));
});

test('generic source names use actual host or X account while editorial attribution stays intact', () => {
  assert.equal(sourceLabel({ name: '原文', url: 'https://www.reuters.com/world/article' }), 'reuters.com');
  assert.equal(sourceLabel({ name: '原文', url: 'https://x.com/USNavy/status/123' }), '@USNavy · X 原帖');
  assert.equal(sourceLabel({ name: '原文', url: 'https://x.com/i/status/123' }), 'X 原帖');
  assert.equal(sourceLabel({ name: '官方原始文件', url: 'https://example.com/doc' }), '官方原始文件');
});

test('an empty section does not break the overview or shift the numbered story anchors', () => {
  const raw = makeRaw();
  raw.sections.unshift({ title: '暂无条目的战区', items: [] });
  const html = render(raw);
  assert.ok(!html.includes('暂无条目的战区'));
  assert.ok(html.includes('id="n01"') && html.includes('id="n02"'));
});

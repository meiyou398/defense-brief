import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateExternalUrl } from '../lib/urls.mjs';
import { validateIssue } from '../lib/validate.mjs';
import { validateSourceCatalog } from '../lib/validate-sources.mjs';
import { tierChip } from '../templates/components.mjs';
import { sourcesPage } from '../templates/sources.mjs';
import { context } from '../templates/layout.mjs';

const load = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const catalog = load('data/sources.json');

test('source rendering rejects unsafe catalog data and tier markup cannot create attributes', () => {
  assert.equal(tierChip('1" data-injected="yes'), '');
  assert.equal(tierChip(0), '');
  const markup = tierChip(1, '<img src=x onerror=alert(1)>');
  assert.ok(markup.includes('&lt;img'));
  assert.ok(!markup.includes('<img'));
  const malicious = structuredClone(catalog);
  malicious.groups[0].sources[0].url = 'javascript:alert(1)';
  const config = load('site.config.json');
  assert.throws(() => sourcesPage(context(config, 'sources/index.html', 'sources'), malicious), /url/);
});
const minimal = () => ({ date: '2026-10-30', sections: [{ title: '其他', items: [{ text: '已有正文。' }] }] });
const withLink = url => {
  const raw = minimal();
  raw.sections[0].items[0].links = [{ name: '原文', url }];
  return raw;
};

test('all published issues and catalog URLs remain valid without editorial mutation', () => {
  const files = readdirSync(new URL('../content/', import.meta.url)).filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file));
  for (const file of files) {
    const raw = load(`content/${file}`);
    const snapshot = JSON.stringify(raw);
    assert.equal(validateIssue(raw), raw, file);
    assert.equal(JSON.stringify(raw), snapshot, file);
  }
  const snapshot = JSON.stringify(catalog);
  assert.equal(validateSourceCatalog(catalog), catalog);
  assert.equal(JSON.stringify(catalog), snapshot);
});

test('external URL validation preserves valid HTTP URLs and encoded path/query characters', () => {
  for (const value of [
    'https://www.example.com/news?a=1&b=2#source',
    'http://example.com:8080/path',
    'HTTPS://Example.COM/%E4%B8%AD%E6%96%87?title=a%20b&next=javascript%3Aalert(1)',
    'https://example.com/path%0Aencoded?value=%5C',
    'https://例子.测试/报道',
  ]) {
    assert.equal(validateExternalUrl(value), value);
    assert.doesNotThrow(() => validateIssue(withLink(value)));
  }
});

test('both issue and catalog links reject unsafe schemes, parser repairs and credentials', () => {
  for (const value of [
    'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///tmp/file',
    '//example.com/path', 'https:example.com', 'https:///example.com',
    ' https://example.com', 'https://example.com ', 'https://example.com/a b',
    'https://example.com/\u0000', 'https://example.com/\u0085',
    'https://exam\nple.com/path', 'https://example.com\r/path', 'https://example.com/\tpath',
    'https://example.com\\path', 'https://user@example.com', 'https://user:password@example.com',
    'https://@example.com', 'https://%75ser@example.com', 'https://example.com@evil.example',
    'https://', '', null, 12,
  ]) {
    assert.throws(() => validateExternalUrl(value), /URL|http\/https/, String(value));
    assert.throws(() => validateIssue(withLink(value)), /links\[0\]\.url/, String(value));
    const raw = structuredClone(catalog);
    raw.groups[0].sources[0].url = value;
    assert.throws(() => validateSourceCatalog(raw), /groups\[0\]\.sources\[0\]\.url/, String(value));
  }
});

test('source catalog rejects missing fields, invalid shapes, dates, tiers and duplicate anchors', () => {
  const mutations = [
    [raw => { delete raw.groups; }, /groups/],
    [raw => { raw.updatedAt = '2026-02-30'; }, /updatedAt/],
    [raw => { raw.intro = null; }, /intro/],
    [raw => { raw.tiers[1].tier = 1; }, /tiers\[1\]\.tier/],
    [raw => { raw.tiers.pop(); }, /tiers/],
    [raw => { raw.rules = '文字'; }, /rules/],
    [raw => { raw.groups[0].sources = {}; }, /sources/],
    [raw => { raw.groups[0].sources[0].tier = 2.5; }, /tier/],
    [raw => { raw.groups[0].sources[0].tier = 0; }, /tier/],
    [raw => { raw.groups[0].sources[0].tier = 5; }, /tier/],
    [raw => { delete raw.groups[0].sources[0].name; }, /name/],
    [raw => { raw.groups[0].sources[0].note = {}; }, /note/],
    [raw => { raw.groups[1].id = raw.groups[0].id; }, /id/],
    [raw => { raw.groups[0].id = 'main'; }, /id/],
    [raw => { raw.groups[0].id = 'source-tiers'; }, /id/],
    [raw => { raw.groups[0].id = 'source-rules'; }, /id/],
    [raw => { raw.groups[0].id = 'g0" onclick="alert(1)'; }, /id/],
  ];
  for (const [mutate, expected] of mutations) {
    const raw = structuredClone(catalog);
    mutate(raw);
    assert.throws(() => validateSourceCatalog(raw, 'catalog-fixture.json'), error => error.message.includes('catalog-fixture.json') && expected.test(error.message));
  }
  assert.throws(() => validateSourceCatalog(null), /需要对象/);
  assert.throws(() => validateSourceCatalog([]), /需要对象/);
});

test('integer references and tier bounds were already enforced and remain strict', () => {
  for (const number of [-1, 0, 1.5, NaN, Infinity, 2]) {
    for (const extra of [
      { featured: [number] },
      { highlights: [{ lead: '要点', text: '已有短句。', item: number }] },
      { stats: [{ value: '1', label: '已有数字', item: number }] },
    ]) assert.throws(() => validateIssue({ ...minimal(), ...extra }));
    const raw = minimal();
    raw.sections[0].items[0].related = [number];
    assert.throws(() => validateIssue(raw), /related/);
  }
  for (const tier of [-1, 0, 1.5, 5, NaN, Infinity]) {
    const raw = minimal();
    raw.sections[0].items[0].tier = tier;
    assert.throws(() => validateIssue(raw), /tier/);
  }
  for (const domain of ['other', '', 1]) {
    const raw = minimal();
    raw.sections[0].items[0].domain = domain;
    assert.throws(() => validateIssue(raw), /domain/);
  }
  const inherited = Object.create({ date: '2026-10-30' });
  inherited.sections = minimal().sections;
  assert.throws(() => validateIssue(inherited), /date.*缺少必填字段/);
});

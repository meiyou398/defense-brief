import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { geoNaturalEarth1 } from 'd3-geo';
import { normalizeIssue, parseTiers, fallbackHeadline, deriveSummary } from '../lib/normalize.mjs';
import { makeProjection, markerPosition, groupMarkers } from '../lib/projection.mjs';
import { validateIssue } from '../lib/validate.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const config = load('site.config.json');
const sample = load('content/2026-10-27.json');
const minimal = () => ({ date: '2026-10-28', sections: [{ title: '其他', items: [{ text: '第一条正文，后续事实。' }] }] });

test('all eleven supplied issues validate without requiring new presentation fields', () => {
  const files = readdirSync(join(root, 'content')).filter((file) => /^2026-10-(1[7-9]|2[0-7])\.json$/.test(file));
  assert.equal(files.length, 11);
  for (const file of files) assert.doesNotThrow(() => validateIssue(load(`content/${file}`)), file);
});

test('sample derives exact primary-tier statistics and geographic categories', () => {
  const issue = normalizeIssue(sample, config);
  assert.equal(issue.items.length, 14);
  assert.deepEqual([1, 2, 3, 4].map((tier) => issue.counts[tier]), [8, 5, 0, 1]);
  assert.equal(issue.items[6].tier, 4);
  assert.equal(issue.items.filter((item) => item.domain.id === 'sea').length, 6);
  assert.equal(issue.items.filter((item) => item.position).length, 9);
  assert.deepEqual(issue.items.filter((item) => item.location?.offMap === 'us').map((item) => item.number), [9, 10, 12]);
  assert.deepEqual(issue.items.filter((item) => !item.location).map((item) => item.number), [7, 14]);
  assert.deepEqual(issue.featured.map((item) => item.number), [9, 11]);
  assert.deepEqual(issue.items.map((item) => item.anchor), Array.from({ length: 14 }, (_, i) => `n${String(i + 1).padStart(2, '0')}`));
});

test('tier parser uses textual occurrence order and retains mixed classifications', () => {
  assert.deepEqual(parseTiers({ tierText: '二档分析 + 一档事实 + 二档引用' }), { tier: 2, tiers: [2, 1] });
  assert.deepEqual(parseTiers({ tierText: '1档事实 / 3档有立场' }), { tier: 1, tiers: [1, 3] });
  assert.deepEqual(parseTiers({ tierText: '仅作官方口径参考' }), { tier: null, tiers: [] });
  assert.equal(parseTiers({ tier: 4, tierText: '一档事实' }).tier, 4);
});

test('cutoff clocks use IANA zones including Washington previous day and Tehran half hour', () => {
  const issue = normalizeIssue(sample, config);
  assert.deepEqual(issue.clocks.map(({ city, time }) => [city, time]), [
    ['华盛顿', '20:00'], ['布鲁塞尔', '01:00'], ['基辅', '02:00'],
    ['德黑兰', '03:30'], ['北京', '08:00'], ['台北', '08:00'],
  ]);
  const tehran = issue.clocks.find((clock) => clock.city === '德黑兰');
  assert.equal(tehran.hourAngle, 105);
  assert.equal(tehran.minuteAngle, 180);
  assert.equal(tehran.night, true);
  assert.equal(issue.clocks.find((clock) => clock.city === '北京').night, false);
});

test('publication timestamps reject normalized impossible dates and midnight overflow', () => {
  for (const publishedAt of ['2026-02-30T08:00:00+08:00', '2026-10-27T24:00:00+08:00', '2026-10-27T08:60:00+08:00']) {
    assert.throws(() => validateIssue({ ...sample, publishedAt }), /publishedAt/);
  }
  assert.doesNotThrow(() => validateIssue({ ...sample, publishedAt: '2026-10-27T08:00+08:00' }));
});

test('legacy issue uses deterministic fallbacks without mutating input data', () => {
  const raw = load('content/2026-10-17.json');
  for (const item of raw.sections.flatMap(section => section.items)) { delete item.location; delete item.domain; }
  const snapshot = JSON.stringify(raw);
  const issue = normalizeIssue(raw, config);
  assert.equal(issue.items.length, 29);
  assert.equal(issue.highlights.length, 6);
  assert.equal(issue.stats.length, 0);
  assert.equal(issue.publishedAt, '2026-10-17T08:00:00+08:00');
  assert.ok(issue.items.every((item) => item.headline && item.domain.id === 'other' && !item.position));
  assert.ok(issue.items.some((item) => item.tier === null));
  assert.deepEqual(issue.featured.map((item) => item.number), issue.items.filter((item) => item.tier === 1).slice(0, 2).map((item) => item.number));
  assert.equal(issue.summary, deriveSummary(raw));
  assert.ok(issue.summary.length > 0);
  assert.equal(JSON.stringify(raw), snapshot);
});

test('supplied map enrichment covers every issue and preserves every grouped member', () => {
  const expected = [
    [17,20,13,6,3], [18,10,8,2,2], [19,10,7,0,4], [20,8,5,4,2],
    [21,10,10,4,1], [22,8,8,4,3], [23,11,11,6,2], [24,12,12,4,5],
    [25,12,9,1,5], [26,12,11,0,5], [27,9,9,3,2],
  ];
  for (const [day, coordinates, groups, us, missing] of expected) {
    const issue = normalizeIssue(load(`content/2026-10-${day}.json`), config);
    assert.equal(issue.items.filter(i => i.position).length, coordinates, `${day}: coordinates`);
    assert.equal(issue.markerGroups.length, groups, `${day}: groups`);
    assert.equal(issue.items.filter(i => i.location?.offMap === 'us').length, us);
    assert.equal(issue.items.filter(i => !i.position && !i.location?.offMap).length, missing);
    const members = issue.markerGroups.flat().map(i => i.number).sort((a,b) => a-b);
    assert.deepEqual(members, issue.items.filter(i => i.position).map(i => i.number));
    assert.equal(new Set(members).size, coordinates);
  }
  assert.deepEqual(groupMarkers([{ n: 1, left: 50, top: 50 }, { n: 2, left: 50, top: 50 }, { n: 3, left: 90, top: 50 }]).map(g => g.map(m => m.n)), [[1,2],[3]]);
});

test('headline extraction preserves decimals and numeric thousands separators', () => {
  assert.equal(fallbackHeadline('洛马获6.94亿美元合同，后续交付。'), '洛马获6.94亿美元合同');
  assert.equal(fallbackHeadline('采购1,000架无人机,计划公布。'), '采购1,000架无人机');
});

test('numbering precedes repeated-section grouping and unknown sections stay distinct', () => {
  const raw = {
    date: '2026-10-28',
    sections: [
      { title: '新战区甲', items: [{ text: '甲一。' }] },
      { title: '新战区乙', items: [{ text: '乙一。' }] },
      { title: '新战区甲', items: [{ text: '甲二。' }] },
    ],
    featured: [3],
  };
  const issue = normalizeIssue(raw, config);
  assert.deepEqual(issue.items.map((item) => item.number), [1, 2, 3]);
  assert.equal(issue.groups.length, 2);
  assert.deepEqual(issue.groups[0].items.map((item) => item.number), [1, 3]);
  assert.equal(issue.groups[0].id, 's1');
  assert.equal(issue.groups[1].id, 's2');
  assert.equal(issue.groups[0].title, '新战区甲');
  assert.equal(issue.featured[0].text, '甲二。');
});

test('headline and summary fallbacks only extract supplied facts', () => {
  assert.equal(fallbackHeadline('首句标题，后半句。'), '首句标题');
  assert.equal(fallbackHeadline('首句标题。后一句。'), '首句标题');
  const long = '这是一段很长的原始标题'.repeat(8);
  assert.ok(fallbackHeadline(long).endsWith('…'));
  assert.ok(Array.from(fallbackHeadline(long)).length <= 33);
  const raw = minimal();
  assert.equal(deriveSummary(raw), raw.sections[0].items[0].text);
  assert.equal(deriveSummary({ ...raw, summary: '已经编辑的摘要。' }), '已经编辑的摘要。');
});

test('projection matches the supplied Natural Earth extent and omits out-of-map entries', () => {
  const projection = makeProjection();
  const reference = geoNaturalEarth1().fitExtent([[0, 0], [900, 640]], {
    type: 'MultiPoint', coordinates: [[-15, -38], [155, 70], [-15, 70], [155, -38]],
  });
  const location = { name: '德黑兰', lat: 35.69, lon: 51.39 };
  const [x, y] = reference([location.lon, location.lat]);
  const actual = markerPosition(location, projection);
  assert.ok(Math.abs(actual.left - x / 9) <= 0.006);
  assert.ok(Math.abs(actual.top - y / 6.4) <= 0.006);
  assert.equal(markerPosition(null, projection), null);
  assert.equal(markerPosition({ name: '美国本土', offMap: 'us' }, projection), null);
  assert.equal(markerPosition({ name: '纽约', lat: 40.71, lon: -74.01 }, projection), null);
});

test('schema validation rejects missing fields, invalid location shapes and unknown keys', () => {
  assert.throws(() => validateIssue({ sections: [] }), /date/);
  assert.throws(() => validateIssue({ date: '2026-10-28', sections: [{ title: '其他', items: [{}] }] }), /text/);
  assert.throws(() => validateIssue({ ...minimal(), unexpected: true }), /unexpected/);
  for (const fields of [
    { tier: 5 }, { domain: 'other' }, { location: { name: '伦敦', lat: 51.5 } },
    { location: { name: '伦敦', lat: 91, lon: 0 } }, { headline: '字'.repeat(33) },
  ]) {
    const raw = minimal();
    Object.assign(raw.sections[0].items[0], fields);
    assert.throws(() => validateIssue(raw), undefined, JSON.stringify(fields));
  }
});

test('invalid references and impossible dates fail before output can contain broken links', () => {
  const badDate = { ...minimal(), date: '2026-02-30' };
  assert.throws(() => validateIssue(badDate), /date/);
  for (const fields of [
    { highlights: [{ lead: '要点', text: '短句。', item: 2 }] },
    { stats: [{ value: '1', label: '数字', item: 2 }] },
    { featured: [2] },
  ]) assert.throws(() => validateIssue({ ...minimal(), ...fields }), /2/);
  const raw = minimal();
  raw.sections[0].items[0].related = [2];
  assert.throws(() => validateIssue(raw, undefined, 'content/example.json'), /content\/example\.json.*related/);
});

test('source links accept only complete HTTP or HTTPS addresses', () => {
  const raw = minimal();
  raw.sections[0].items[0].links = [{ name: '来源', url: 'javascript:alert(1)' }];
  assert.throws(() => validateIssue(raw), /url/);
  raw.sections[0].items[0].links[0].url = 'https://example.com/news?a=1&b=2';
  assert.doesNotThrow(() => validateIssue(raw));
});

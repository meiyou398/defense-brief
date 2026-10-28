import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { context } from '../templates/layout.mjs';
import { sourcesPage } from '../templates/sources.mjs';
import { escapeHtml } from '../lib/urls.mjs';

const catalog = JSON.parse(readFileSync(new URL('../data/sources.json', import.meta.url), 'utf8'));
const config = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));

test('migrated source directory preserves all categories, records and source notes in static HTML', () => {
  assert.equal(catalog.groups.length, 16);
  assert.deepEqual(catalog.groups.map(group => group.sources.length), [19, 13, 11, 8, 3, 6, 16, 7, 7, 5, 2, 4, 24, 8, 2, 1]);
  assert.equal(catalog.groups.reduce((total, group) => total + group.sources.length, 0), 136);
  assert.equal(catalog.tiers.length, 4);
  assert.equal(catalog.rules.length, 4);
  const html = sourcesPage(context(config, 'sources/index.html', 'sources'), catalog);
  assert.equal((html.match(/class="source-record"/g) || []).length, 136);
  assert.ok(html.includes(`href="${new URL('sources/', config.baseUrl).href}"`));
  for (const group of catalog.groups) {
    assert.ok(html.includes(`id="${group.id}"`));
    assert.ok(html.includes(`href="#${group.id}"`));
    for (const source of group.sources) {
      for (const value of [source.name, source.url, source.lang, source.description, source.note].filter(Boolean)) {
        assert.ok(html.includes(escapeHtml(value)), `missing source field: ${source.name}`);
      }
    }
  }
  for (const value of [catalog.intro, ...catalog.rules]) assert.ok(html.includes(escapeHtml(value)));
});

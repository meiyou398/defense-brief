import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assetDigest, assetVersions, versionedAsset } from '../lib/assets.mjs';
import { context } from '../templates/layout.mjs';

test('resource versions are stable for identical bytes and change with the resource content', () => {
  const a = Buffer.from('body { color: black; }');
  assert.equal(assetDigest(a), assetDigest(Buffer.from(a)));
  assert.notEqual(assetDigest(a), assetDigest(Buffer.from('body { color: orange; }')));
  for (const file of ['assets/site.css', 'assets/app.js']) {
    const expected = createHash('sha256').update(readFileSync(new URL(`../${file}`, import.meta.url))).digest('hex').slice(0, 16);
    assert.equal(assetVersions[file], expected);
  }
});

test('versioned resource URLs preserve root and project deployments at every page depth', () => {
  for (const baseUrl of ['https://dibao.news/', 'https://meiyou398.github.io/defense-brief/']) {
    for (const from of ['index.html', '2026-10-30/index.html', '2026-10-30/map/index.html', 'archive/index.html']) {
      const ctx = context({ baseUrl }, from, 'issue');
      for (const file of ['assets/site.css', 'assets/app.js']) {
        const href = versionedAsset(ctx, file);
        assert.ok(!href.startsWith('/'));
        const resolved = new URL(href, new URL(from, baseUrl));
        assert.equal(resolved.pathname, new URL(file, baseUrl).pathname);
        assert.equal(resolved.searchParams.get('v'), assetVersions[file]);
      }
    }
  }
  assert.throws(() => versionedAsset(context({}, 'index.html', 'issue'), 'external.js'), /未登记/);
});

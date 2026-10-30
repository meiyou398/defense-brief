import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { packageSite, publishedFiles } from '../lib/publish.mjs';

const required = [
  'index.html', 'map/index.html', 'archive/index.html', 'about/index.html', 'sources/index.html', 'subscribe/index.html', '404.html',
  '2026-10-30/index.html', '2026-10-30/map/index.html',
  'assets/site.css', 'assets/app.js', 'assets/map-h.svg', 'assets/favicon.svg', 'assets/og-card.png',
  'feed.xml', 'sitemap.xml', 'robots.txt', '.nojekyll'
];
const write = (root, file, value = file) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), value); };
function fixture(t) {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'defense-publish-')));
  const root = join(parent, 'repo');
  mkdirSync(root);
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  for (const file of required) write(root, file, file === '.nojekyll' ? '' : `public:${file}`);
  write(root, 'content/2026-10-30.json', '{"date":"2026-10-30"}');
  return { root, parent };
}
const walk = (root, prefix = '') => readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
  const file = prefix ? `${prefix}/${entry.name}` : entry.name;
  return entry.isDirectory() ? walk(root, file) : [file];
}).sort();

test('only the explicit public file list is packaged with unchanged bytes', t => {
  const { root } = fixture(t);
  for (const file of ['.env', '.env.production', '.git/config', 'data/sources.json', 'lib/private.mjs', 'docs/internal.md', 'node_modules/private/index.js', 'content/private.json', 'README.md', 'old-unlisted/index.html', 'assets/private.txt']) write(root, file, 'sensitive');
  assert.deepEqual(publishedFiles(root), required);
  const result = packageSite(root);
  assert.equal(result.directory, join(root, '.pages'));
  assert.deepEqual(result.files, required);
  assert.deepEqual(walk(result.directory), [...required].sort());
  for (const file of required) assert.deepEqual(readFileSync(join(result.directory, file)), readFileSync(join(root, file)));
});

test('CNAME is copied only when present and output can be an existing empty directory', t => {
  const { root, parent } = fixture(t);
  write(root, 'CNAME', 'example.test\n');
  const out = join(parent, 'public');
  mkdirSync(out);
  assert.deepEqual(publishedFiles(root), [...required, 'CNAME']);
  const result = packageSite(root, out);
  assert.equal(result.directory, out);
  assert.equal(readFileSync(join(out, 'CNAME'), 'utf8'), 'example.test\n');
});

test('a missing mandatory source fails before creating any output', t => {
  const { root } = fixture(t);
  rmSync(join(root, 'robots.txt'));
  const out = join(root, 'new-output');
  assert.throws(() => packageSite(root, out), /robots\.txt|ENOENT/);
  assert.equal(existsSync(out), false);
});

test('every dated JSON has issue and map outputs and invalid dates fail safely', t => {
  const { root } = fixture(t);
  write(root, 'content/2026-10-29.json', '{}');
  write(root, '2026-10-29/index.html', 'issue');
  assert.throws(() => packageSite(root), /2026-10-29.*map|ENOENT/);
  assert.equal(existsSync(join(root, '.pages')), false);
  write(root, '2026-10-29/map/index.html', 'map');
  assert.ok(publishedFiles(root).includes('2026-10-29/map/index.html'));
  write(root, 'content/2026-02-30.json', '{}');
  assert.throws(() => publishedFiles(root), /无效的发布期日/);
});

test('symlink source files are rejected even if their target remains inside the repository', t => {
  const { root } = fixture(t);
  renameSync(join(root, 'assets/site.css'), join(root, 'assets/real.css'));
  symlinkSync('real.css', join(root, 'assets/site.css'));
  assert.throws(() => packageSite(root), /符号链接/);
  assert.equal(existsSync(join(root, '.pages')), false);
});

test('symlink directories cannot bring outside files into the public package', t => {
  const { root, parent } = fixture(t);
  renameSync(join(root, 'assets'), join(parent, 'outside-assets'));
  symlinkSync(join(parent, 'outside-assets'), join(root, 'assets'), 'dir');
  assert.throws(() => publishedFiles(root), /符号链接/);
  assert.throws(() => packageSite(root), /符号链接/);
  assert.equal(existsSync(join(root, '.pages')), false);
});

test('symlink CNAME and date metadata are not silently ignored', t => {
  const { root, parent } = fixture(t);
  write(parent, 'secret', 'secret');
  symlinkSync(join(parent, 'secret'), join(root, 'CNAME'));
  assert.throws(() => publishedFiles(root), /符号链接/);
  rmSync(join(root, 'CNAME'));
  rmSync(join(root, 'content/2026-10-30.json'));
  symlinkSync(join(parent, 'secret'), join(root, 'content/2026-10-30.json'));
  assert.throws(() => publishedFiles(root), /符号链接/);
});

test('nonempty output directories and source overlaps are rejected without overwriting', t => {
  const { root, parent } = fixture(t);
  const out = join(parent, 'existing');
  write(out, 'keep.txt', 'keep');
  assert.throws(() => packageSite(root, out), /必须为空/);
  assert.deepEqual(walk(out), ['keep.txt']);
  assert.equal(readFileSync(join(out, 'keep.txt'), 'utf8'), 'keep');
  assert.throws(() => packageSite(root, root), /不得覆盖/);
  assert.throws(() => packageSite(root, parent), /不得覆盖/);
  assert.throws(() => packageSite(root, 'assets/new-output'), /已有源目录/);
  assert.equal(existsSync(join(root, 'assets/new-output')), false);
  assert.equal(readFileSync(join(root, 'index.html'), 'utf8'), 'public:index.html');
});

test('an output symlink is rejected even when its target is empty', t => {
  const { root, parent } = fixture(t);
  const actual = join(parent, 'actual');
  mkdirSync(actual);
  const out = join(parent, 'alias');
  symlinkSync(actual, out, 'dir');
  assert.throws(() => packageSite(root, out), /非符号链接/);
  assert.deepEqual(readdirSync(actual), []);
});

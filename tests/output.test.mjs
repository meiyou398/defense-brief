import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { orphanIssueOutputs, removeGeneratedOrphans, publishingConfig } from '../lib/output.mjs';

const generated = '<meta name="generator" content="defense-brief-build"><h1>Generated</h1>';
test('orphan cleanup only deletes owned HTML and preserves other files', () => {
  const root = mkdtempSync(join(tmpdir(), 'brief-orphans-'));
  try {
    mkdirSync(join(root, '2026-01-01/map'), { recursive: true });
    writeFileSync(join(root, '2026-01-01/index.html'), generated);
    writeFileSync(join(root, '2026-01-01/map/index.html'), generated);
    writeFileSync(join(root, '2026-01-01/notes.txt'), 'keep');
    const orphans = orphanIssueOutputs(root, ['2026-01-02']);
    assert.equal(orphans.length, 2); assert.ok(orphans.every(f => f.generated));
    removeGeneratedOrphans(root, orphans);
    assert.equal(existsSync(join(root, '2026-01-01/index.html')), false);
    assert.equal(readFileSync(join(root, '2026-01-01/notes.txt'), 'utf8'), 'keep');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('handwritten orphan pages and pages modified after scanning are protected', () => {
  const root = mkdtempSync(join(tmpdir(), 'brief-protected-'));
  try {
    mkdirSync(join(root, '2026-01-01'));
    const file = join(root, '2026-01-01/index.html');
    writeFileSync(file, '<h1>Handwritten</h1>');
    const orphan = orphanIssueOutputs(root, []);
    assert.equal(orphan[0].generated, false);
    assert.throws(() => removeGeneratedOrphans(root, orphan), /拒绝删除/);
    writeFileSync(file, generated); const scanned = orphanIssueOutputs(root, []);
    writeFileSync(file, '<h1>Changed after scan</h1>');
    assert.throws(() => removeGeneratedOrphans(root, scanned), /已被修改/);
    assert.ok(existsSync(file));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('publishing supports project prefixes and a future domain root without placeholders', () => {
  assert.deepEqual(publishingConfig({baseUrl:'https://meiyou398.github.io/defense-brief/'}), {baseUrl:'https://meiyou398.github.io/defense-brief/',path:'/defense-brief/',domain:null});
  assert.equal(publishingConfig({baseUrl:'https://www.example.com/'}).domain, 'www.example.com');
  for(const baseUrl of ['http://www.example.com/','https://www.example.com/defense-brief/','https://user:pass@example.com/','https://example.com/?x=1']) assert.throws(()=>publishingConfig({baseUrl}));
});

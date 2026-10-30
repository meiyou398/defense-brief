import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const assetDigest = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

// A resource keeps the same URL until its bytes change. Versions are computed
// from the files shipped with this build, never from the clock or machine.
export const assetVersions = Object.fromEntries(['assets/site.css', 'assets/app.js'].map(file => [
  file, assetDigest(readFileSync(new URL(`../${file}`, import.meta.url)))
]));

export function versionedAsset(ctx, file) {
  if (!Object.hasOwn(assetVersions, file)) throw new Error(`未登记的浏览器资源：${file}`);
  return `${ctx.url(file)}?v=${assetVersions[file]}`;
}

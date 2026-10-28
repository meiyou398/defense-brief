import { readdirSync, existsSync, readFileSync, lstatSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const marker = 'name="generator" content="defense-brief-build"';

export function orphanIssueOutputs(root, dates) {
  const known = new Set(dates);
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name) && !known.has(entry.name))
    .flatMap(entry => ['index.html', 'map/index.html'].map(file => `${entry.name}/${file}`))
    .filter(file => existsSync(join(root, file)))
    .map(file => ({ file, generated: !lstatSync(join(root, file)).isSymbolicLink() && readFileSync(join(root, file), 'utf8').includes(marker) }));
}

export function removeGeneratedOrphans(root, files) {
  for (const { file, generated } of files) {
    if (!generated || !/^\d{4}-\d{2}-\d{2}\/(?:map\/)?index\.html$/.test(file)) throw new Error(`拒绝删除非生成页面：${file}`);
    const path = join(root, file);
    if (!readFileSync(path, 'utf8').includes(marker)) throw new Error(`页面已被修改，未删除：${file}`);
    unlinkSync(path);
  }
}

export function publishingConfig(config) {
  const url = new URL(config.baseUrl);
  if (url.protocol !== 'https:' || !config.baseUrl.endsWith('/') || url.username || url.password || url.port || url.search || url.hash) throw new Error('baseUrl 需要无账号、端口或查询参数，且以 / 结尾的 HTTPS 地址');
  const custom = !url.hostname.endsWith('.github.io');
  if (custom && url.pathname !== '/') throw new Error('GitHub Pages 自定义域名应使用根路径，例如 https://www.your-domain.com/');
  return { baseUrl: url.href, path: url.pathname, domain: custom ? url.hostname : null };
}

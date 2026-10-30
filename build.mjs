import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateIssue } from './lib/validate.mjs';
import { validateSourceCatalog } from './lib/validate-sources.mjs';
import { normalizeIssue } from './lib/normalize.mjs';
import { absoluteUrl, escapeXml as x } from './lib/urls.mjs';
import { orphanIssueOutputs, removeGeneratedOrphans, publishingConfig } from './lib/output.mjs';
import { context } from './templates/layout.mjs';
import { issuePage } from './templates/issue.mjs';
import { mapPage } from './templates/map.mjs';
import { archivePage } from './templates/archive.mjs';
import { sourcesPage } from './templates/sources.mjs';
import { aboutPage, subscribePage, notFoundPage } from './templates/informational.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const readJSON = async path => JSON.parse(await readFile(join(ROOT, path), 'utf8'));
const config = await readJSON('site.config.json');
const sources = validateSourceCatalog(await readJSON('data/sources.json'));
const publishing = publishingConfig(config);
const files = (await readdir(join(ROOT, 'content'))).filter(f => f.endsWith('.json')).sort();
if (!files.length) throw new Error('content/ 中没有简报 JSON');
const issues = [];
for (const file of files) {
  if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(file)) throw new Error(`content/${file}：文件名需要 YYYY-MM-DD.json`);
  const raw = validateIssue(await readJSON(`content/${file}`), undefined, `content/${file}`);
  if (raw.date !== file.slice(0, 10)) throw new Error(`content/${file}：date 与文件名不一致`);
  const issue = normalizeIssue(raw, config);
  issue.issueNumber = issues.length + 1;
  issues.push(issue);
}

// Validate all input before touching the published HTML.
const orphans = orphanIssueOutputs(ROOT, issues.map(issue => issue.date));
const protectedPages = orphans.filter(file => !file.generated);
if (protectedPages.length) throw new Error(`以下旧页面没有对应 JSON 且不是生成文件，未进行删除：${protectedPages.map(file => file.file).join('、')}`);
const outputs = new Map();
const latest = issues.at(-1);
outputs.set('index.html', issuePage(context(config, 'index.html', 'issue', { latest: true }), latest));
outputs.set('map/index.html', mapPage(context(config, 'map/index.html', 'map', { latest: true }), latest));
for (const [index, issue] of issues.entries()) {
  const file = `${issue.date}/index.html`;
  outputs.set(file, issuePage(context(config, file, 'issue'), issue, issues[index - 1], issues[index + 1]));
  const mapFile = `${issue.date}/map/index.html`;
  outputs.set(mapFile, mapPage(context(config, mapFile, 'map'), issue));
}
outputs.set('archive/index.html', archivePage(context(config, 'archive/index.html', 'archive'), issues));
outputs.set('about/index.html', aboutPage(context(config, 'about/index.html', 'about')));
outputs.set('sources/index.html', sourcesPage(context(config, 'sources/index.html', 'sources'), sources));
outputs.set('subscribe/index.html', subscribePage(context(config, 'subscribe/index.html', 'subscribe')));
outputs.set('404.html', notFoundPage(context(config, '404.html', '404')));

const feedItems = [...issues].reverse().map(issue => `<item><title>${x(`${config.title}｜${String(issue.month).padStart(2, '0')}.${issue.day} ${issue.weekday}`)}</title><link>${x(absoluteUrl(config, `${issue.date}/`))}</link><guid isPermaLink="true">${x(absoluteUrl(config, `${issue.date}/`))}</guid><description>${x(issue.summary)}</description><pubDate>${new Date(issue.publishedAt).toUTCString()}</pubDate></item>`).join('');
outputs.set('feed.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${x(config.title)}</title><link>${x(config.baseUrl)}</link><description>${x(config.description)}</description><language>zh-CN</language><lastBuildDate>${new Date(latest.publishedAt).toUTCString()}</lastBuildDate><atom:link href="${x(absoluteUrl(config, 'feed.xml'))}" rel="self" type="application/rss+xml"/>${feedItems}</channel></rss>\n`);

const htmlCount = [...outputs.keys()].filter(file => file.endsWith('.html')).length;
const routes = [...outputs.keys()].filter(file => file.endsWith('.html') && file !== '404.html').map(file => file === 'index.html' ? '' : file.replace(/index\.html$/, ''));
outputs.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route => {
  const issue = issues.find(i => route.startsWith(`${i.date}/`)) || latest;
  return `<url><loc>${x(absoluteUrl(config, route))}</loc><lastmod>${x(issue.publishedAt)}</lastmod></url>`;
}).join('')}</urlset>\n`);
outputs.set('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl(config, 'sitemap.xml')}\n`);
if (publishing.domain) outputs.set('CNAME', `${publishing.domain}\n`);
else {
  try {
    const cname = (await readFile(join(ROOT, 'CNAME'), 'utf8')).trim();
    if (cname) throw new Error('CNAME 已存在但 baseUrl 仍使用 github.io；请先把 baseUrl 改为已购买的域名，或确认后移除旧 CNAME');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

for (const [path, content] of outputs) {
  const destination = join(ROOT, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
}
removeGeneratedOrphans(ROOT, orphans);
if (orphans.length) console.log(`已清理 ${orphans.length} 个失去对应 JSON 的生成页面（保留其他文件）。`);
console.log(`已生成 ${issues.length} 期简报、${htmlCount} 个 HTML 页面、RSS 和 sitemap。最新一期 ${latest.date}。`);
console.log(`主分档：${Object.entries(latest.counts).map(([tier, count]) => `${tier}档 ${count}`).join(' / ')}；地图 ${latest.items.filter(i => i.position).length} 个标记。`);

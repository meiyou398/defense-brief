#!/usr/bin/env node
// Static output verification. Browser interaction and Lighthouse are checked separately.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { orphanIssueOutputs, publishingConfig } from '../lib/output.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const config = JSON.parse(read('site.config.json'));
const issues = readdirSync(join(root, 'content')).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
const dates = issues.map((name) => name.slice(0, -5));
const publishing = publishingConfig(config);
const pages = ['index.html', 'map/index.html', 'archive/index.html', 'about/index.html', 'sources/index.html', 'subscribe/index.html', '404.html',
  ...dates.flatMap((date) => [`${date}/index.html`, `${date}/map/index.html`])];
const errors = [];
const requireThat = (condition, description) => { if (!condition) errors.push(description); };
for (const entry of orphanIssueOutputs(root, dates)) requireThat(false, `孤立日期页面（没有对应 content JSON）：${entry.file}`);
if (publishing.domain) requireThat(existsSync(join(root, 'CNAME')) && read('CNAME').trim() === publishing.domain, 'CNAME 必须与 baseUrl 自定义域名一致');
else requireThat(!existsSync(join(root, 'CNAME')), 'github.io 模式不应遗留自定义 CNAME');
const decode = (value) => value.replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[0-9a-f]+|\d+);/gi, (entity) => {
  if (entity[1] === '#') return String.fromCodePoint(entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1)));
  return { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' }[entity.toLowerCase()];
});
const attr = (tag, name) => {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? decode(match[1] ?? match[2]) : null;
};
const tags = (html) => [...html.matchAll(/<[a-z][^>]*>/gi)].map((match) => match[0]);
const htmlByFile = new Map();
const idsByFile = new Map();
const baseByFile = new Map();
const projectPrefix = new URL(config.baseUrl).pathname;

for (const page of pages) {
  requireThat(existsSync(join(root, page)), `缺少页面：${page}`);
  if (!existsSync(join(root, page))) continue;
  const html = read(page);
  htmlByFile.set(page, html);
  const elements = tags(html);
  const bases = elements.filter((tag) => /^<base\b/i.test(tag));
  if (page === '404.html') {
    requireThat(bases.length === 1 && attr(bases[0], 'href') === projectPrefix, '404.html：需要一个匹配 baseUrl 路径的 base，确保任意深路径的资源和返回链接可用');
    requireThat(html.indexOf('<base') < html.indexOf('<link'), '404.html：base 必须位于其他资源链接前');
  } else requireThat(bases.length === 0, `${page}：普通页面不应覆盖相对 URL 的基准地址`);
  const documentUrl = new URL(page, config.baseUrl);
  baseByFile.set(page, bases[0] && attr(bases[0], 'href') ? new URL(attr(bases[0], 'href'), documentUrl) : documentUrl);
  const pageIds = elements.map((tag) => attr(tag, 'id')).filter((id) => id !== null);
  idsByFile.set(page, new Set(pageIds));
  requireThat(new Set(pageIds).size === pageIds.length, `${page}：存在重复 id`);
  requireThat(/<html\b[^>]*\blang=["']zh-CN["']/i.test(html), `${page}：缺少 lang="zh-CN"`);
  requireThat((html.match(/<h1(?:\s|>)/gi) ?? []).length === 1, `${page}：必须恰有一个 h1`);
  requireThat(/<title>[^<]+<\/title>/i.test(html), `${page}：缺少 title`);
  requireThat(elements.some((tag) => /^<meta\b/i.test(tag) && attr(tag, 'name') === 'description' && attr(tag, 'content')?.trim()), `${page}：缺少非空 meta description`);
  requireThat(elements.some((tag) => /^<meta\b/i.test(tag) && attr(tag, 'name') === 'generator' && attr(tag, 'content') === 'defense-brief-build'), `${page}：缺少旧版导入保护标记`);
  const canonical = elements.find((tag) => /^<link\b/i.test(tag) && attr(tag, 'rel') === 'canonical');
  const canonicalHref = canonical && attr(canonical, 'href');
  requireThat(Boolean(canonicalHref?.startsWith(config.baseUrl)), `${page}：canonical 未使用 baseUrl`);
  if (page === 'index.html') requireThat(canonicalHref === config.baseUrl, '首页 canonical 应为站点根地址');
  if (/^\d{4}-\d{2}-\d{2}\/index\.html$/.test(page)) {
    requireThat(canonicalHref === new URL(`${page.slice(0, 10)}/`, config.baseUrl).href, `${page}：canonical 应指向当期地址`);
  }
  for (const property of ['og:title', 'og:description', 'og:image']) {
    requireThat(elements.some((tag) => /^<meta\b/i.test(tag) && attr(tag, 'property') === property && attr(tag, 'content')?.trim()), `${page}：缺少 ${property}`);
  }
  requireThat(elements.some((tag) => /^<link\b/i.test(tag) && attr(tag, 'rel') === 'alternate' && attr(tag, 'type') === 'application/rss+xml'), `${page}：缺少 RSS 声明`);
  const localStyles = elements.filter((tag) => /^<link\b/i.test(tag) && attr(tag, 'rel') === 'stylesheet' && !/^(?:https?:)?\/\//i.test(attr(tag, 'href') ?? ''));
  requireThat(localStyles.length === 1 && attr(localStyles[0], 'href')?.endsWith('assets/site.css'), `${page}：必须只引入一个本地 site.css`);
  requireThat(!elements.some((tag) => /^<link\b/i.test(tag) && attr(tag, 'rel') === 'stylesheet' && /^(?:https?:)?\/\//i.test(attr(tag, 'href') ?? '')), `${page}：不得引入阻塞首屏的远程样式表`);
  const scripts = elements.filter((tag) => /^<script\b/i.test(tag));
  requireThat(scripts.length <= 1 && scripts.every((tag) => attr(tag, 'src')?.endsWith('assets/app.js')), `${page}：出现额外脚本或内联脚本`);
  for (const image of elements.filter((tag) => /^<img\b/i.test(tag))) {
    requireThat(Boolean(attr(image, 'width') && attr(image, 'height')), `${page}：图片缺少明确 width/height`);
  }
  for (const anchor of elements.filter((tag) => /^<a\b/i.test(tag) && /^https?:/i.test(attr(tag, 'href') ?? ''))) {
    requireThat(attr(anchor, 'target') === '_blank' && /(?:^|\s)noopener(?:\s|$)/.test(attr(anchor, 'rel') ?? ''), `${page}：外部链接缺少新窗口或 noopener：${attr(anchor, 'href')}`);
  }
}

let checkedLinks = 0;
for (const [page, html] of htmlByFile) {
  for (const tag of tags(html)) {
    if (!/^<(?:a|link|img|script|source)\b/i.test(tag)) continue;
    for (const key of ['href', 'src']) {
      const value = attr(tag, key);
      if (value === null || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) continue;
      requireThat(!value.startsWith('/'), `${page}：内部地址必须为相对路径：${value}`);
      requireThat(!value.includes('\\'), `${page}：URL 不应含反斜杠：${value}`);
      if (!value || value.startsWith('/')) continue;
      checkedLinks += 1;
      let targetUrl;
      try { targetUrl = new URL(value, baseByFile.get(page)); }
      catch { errors.push(`${page}：URL 格式无效：${value}`); continue; }
      let path;
      requireThat(targetUrl.pathname.startsWith(projectPrefix), `${page}：链接丢失 GitHub Pages 项目前缀：${value}`);
      try { path = decodeURIComponent(targetUrl.pathname.slice(projectPrefix.length)); }
      catch { errors.push(`${page}：URL 编码无效：${value}`); continue; }
      let target = resolve(root, path);
      requireThat(target === root || target.startsWith(root + sep), `${page}：链接越出仓库：${value}`);
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
      requireThat(existsSync(target), `${page}：链接目标不存在：${value}`);
      if (!existsSync(target)) continue;
      const targetRelative = relative(root, target).split(sep).join('/');
      if (targetUrl.hash && extname(target) === '.html') {
        let id;
        try { id = decodeURIComponent(targetUrl.hash.slice(1)); }
        catch { errors.push(`${page}：锚点编码无效：${value}`); continue; }
        if (!idsByFile.has(targetRelative)) {
          idsByFile.set(targetRelative, new Set(tags(read(targetRelative)).map((element) => attr(element, 'id')).filter((id) => id !== null)));
        }
        requireThat(idsByFile.get(targetRelative).has(id), `${page}：锚点不存在：${value}`);
      }
    }
  }
}

for (const date of dates) {
  const issue = JSON.parse(read(`content/${date}.json`));
  const length = issue.sections.reduce((total, section) => total + section.items.length, 0);
  const html = htmlByFile.get(`${date}/index.html`);
  if (!html) continue;
  const ids = idsByFile.get(`${date}/index.html`);
  const fullSection = tags(html).find((tag) => /\sdata-full-only(?:\s|>|=)/i.test(tag));
  requireThat(fullSection && !/\shidden(?:\s|>|=)/i.test(fullSection), `${date}：完整版不得在静态 HTML 中隐藏，需支持无 JS 阅读`);
  const disclosures = tags(html).filter((tag) => /^<details\b/i.test(tag) && /(?:^|\s)b-story(?:\s|$)/.test(attr(tag, 'class') ?? ''));
  requireThat(disclosures.length === length && disclosures.every((tag) => /\sopen(?:\s|>|=)/i.test(tag)), `${date}：每条完整正文必须默认展开并支持原生收起`);
  for (let number = 1; number <= length; number += 1) {
    requireThat(ids.has(`n${String(number).padStart(2, '0')}`), `${date}：缺少完整正文锚点 n${String(number).padStart(2, '0')}`);
  }
  for (const item of issue.sections.flatMap((section) => section.items)) {
    const plain = decode(html.replace(/<[^>]*>/g, ''));
    requireThat(plain.includes(item.text), `${date}：有条目正文未完整写入 HTML`);
  }
  const mapHtml = htmlByFile.get(`${date}/map/index.html`);
  if (mapHtml) {
    const rows = tags(mapHtml).filter((tag) => /\sdata-feed-row(?:\s|>|=)/i.test(tag));
    requireThat(rows.length === length, `${date}/map/：必须在 HTML 中预先输出全部条目列表`);
    requireThat(rows.every((tag) => !/\shidden(?:\s|>|=)/i.test(tag)), `${date}/map/：无 JS 时所有列表条目应可见`);
  }
}

for (const file of ['feed.xml', 'sitemap.xml', 'assets/site.css', 'assets/app.js', 'assets/map-h.svg', 'assets/og-card.png', '.nojekyll']) {
  requireThat(existsSync(join(root, file)), `缺少输出或部署文件：${file}`);
}
if (existsSync(join(root, 'feed.xml'))) {
  const feed = read('feed.xml');
  requireThat(/<rss\b[^>]*version=["']2\.0["']/.test(feed) && /<channel>/.test(feed), 'feed.xml：RSS 2.0 结构不完整');
  requireThat((feed.match(/<item>/g) ?? []).length === dates.length, 'feed.xml：每期必须恰有一个 item');
  requireThat((feed.match(/<pubDate>/g) ?? []).length >= dates.length, 'feed.xml：缺少发布时间');
  for (const date of dates) requireThat(feed.includes(new URL(`${date}/`, config.baseUrl).href), `feed.xml：缺少 ${date} 链接`);
}
if (existsSync(join(root, 'sitemap.xml'))) {
  const sitemap = read('sitemap.xml');
  requireThat(/<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/.test(sitemap), 'sitemap.xml：缺少 sitemap 命名空间');
  for (const page of pages.filter((file) => file !== '404.html')) {
    const route = page === 'index.html' ? '' : page.replace(/index\.html$/, '');
    requireThat(sitemap.includes(new URL(route, config.baseUrl).href), `sitemap.xml：缺少 ${route || '首页'}`);
  }
}

const sizes = {};
for (const file of ['index.html', 'assets/site.css', 'assets/app.js', 'assets/map-h.svg']) {
  if (!existsSync(join(root, file))) continue;
  const data = readFileSync(join(root, file));
  sizes[file] = { raw: data.byteLength, gzip: gzipSync(data, { level: 9 }).byteLength };
}
if (sizes['assets/app.js']) requireThat(sizes['assets/app.js'].gzip <= 15 * 1024, 'app.js gzip 超过 15KB');
if (sizes['assets/map-h.svg']) requireThat(sizes['assets/map-h.svg'].raw <= 150 * 1024, '地图底图超过 150KB');
const homeGzip = ['index.html', 'assets/site.css', 'assets/app.js'].reduce((total, file) => total + (sizes[file]?.gzip ?? 0), 0);
requireThat(homeGzip <= 150 * 1024, '首页 HTML + CSS + JS gzip 总和超过 150KB');

console.log(`静态检查：${dates.length} 期，${pages.length} 个 HTML 页面，${checkedLinks} 个内部资源/链接。`);
for (const [file, size] of Object.entries(sizes)) console.log(`${file}: ${size.raw.toLocaleString('en-US')} B，gzip ${size.gzip.toLocaleString('en-US')} B`);
console.log(`首页 HTML + CSS + JS gzip：${homeGzip.toLocaleString('en-US')} B / 153,600 B。`);
if (errors.length) {
  console.error(`未通过 ${errors.length} 项：\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('通过：路由、相对链接、锚点、完整正文、SEO、XML 和体积预算。');
}

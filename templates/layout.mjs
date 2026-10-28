import { escapeHtml as e, relativeUrl, absoluteUrl } from '../lib/urls.mjs';
import { clockBar } from './components.mjs';

function header(ctx, issue) {
  const { page, config, url } = ctx;
  const isMap = page === 'map';
  const mapTarget = issue && !ctx.latest ? `${issue.date}/map/` : 'map/';
  const logo = `<span class="brand-mark" aria-hidden="true"></span>${e(config.title)}`;
  return `<a class="skip-link" href="#main">跳到正文</a><header class="site-header${isMap ? ' site-header--map' : ''}"><div class="header-inner ${isMap ? 'wrap-map' : 'wrap'}"><a class="brand" href="${url('index.html')}">${logo}</a><nav class="site-nav" aria-label="主导航"><a href="${url('index.html')}"${page === 'issue' && ctx.latest ? ' aria-current="page"' : ''}>今日</a><a href="${url(mapTarget)}"${isMap ? ' aria-current="page"' : ''}>地图</a><a href="${url('archive/')}"${page === 'archive' ? ' aria-current="page"' : ''}>往期</a></nav>${isMap ? `<a class="map-date" href="${url(`${issue.date}/`)}"><span>${issue.day}</span><span>${issue.month}月 · ${issue.weekday} · 第 ${issue.issueNumber} 期</span></a>` : `<a class="subscribe-link" href="${url('subscribe/')}"><span class="subscribe-desktop">订阅早报</span><span class="subscribe-mobile">订阅</span></a>`}</div>${page === 'issue' ? clockBar(issue) : ''}</header>`;
}

function footer(ctx) {
  return `<footer class="site-footer"><div class="footer-inner wrap"><div class="footer-brand"><a class="brand" href="${ctx.url('index.html')}"><span class="brand-mark" aria-hidden="true"></span>${e(ctx.config.title)}</a><p>军事 / 防务每日简报 · 每条注明来源与可信度</p></div><div class="footer-details"><p>可信度分档：一档＝官方／一手事实；二档＝有来源的专业解读；三档＝有立场的评论；四档＝仅线索、未证实。</p><p>${e(ctx.config.disclaimer)}</p><nav class="footer-links" aria-label="页脚"><a href="${ctx.url('archive/')}">往期</a><a href="${ctx.url('about/')}">可信度说明</a><a href="${ctx.url('sources/')}">信源目录</a><a href="${ctx.url('feed.xml')}">RSS</a></nav></div></div></footer>`;
}

export function context(config, file, page, { latest = false } = {}) {
  return { config, file, page, latest, url: target => relativeUrl(file, target) };
}

export function layout(ctx, { title, description, canonical = '', content, issue = null }) {
  const { config } = ctx;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">${ctx.page === '404' ? `<base href="${e(new URL(config.baseUrl).pathname)}">` : ''}<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="defense-brief-build"><title>${e(title)}</title><meta name="description" content="${e([...description].slice(0, 120).join(''))}"><meta name="theme-color" content="#FF4F00"><link rel="canonical" href="${e(absoluteUrl(config, canonical))}"><meta property="og:type" content="${ctx.page === 'issue' ? 'article' : 'website'}"><meta property="og:locale" content="zh_CN"><meta property="og:site_name" content="${e(config.title)}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e([...description].slice(0, 120).join(''))}"><meta property="og:url" content="${e(absoluteUrl(config, canonical))}"><meta property="og:image" content="${e(absoluteUrl(config, 'assets/og-card.png'))}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="防务早知道，军事与防务每日简报">${issue ? `<meta property="article:published_time" content="${e(issue.publishedAt)}">` : ''}<link rel="alternate" type="application/rss+xml" title="防务早知道 RSS" href="${ctx.url('feed.xml')}"><link rel="icon" href="${ctx.url('assets/favicon.svg')}" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&amp;family=Noto+Sans+SC:wght@400;500;700;900&amp;display=swap"><link rel="stylesheet" href="${ctx.url('assets/site.css')}"><script src="${ctx.url('assets/app.js')}" defer></script></head><body data-page="${ctx.page}">${header(ctx, issue)}${content}${ctx.page === 'map' ? '' : footer(ctx)}</body></html>`;
}

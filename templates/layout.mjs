import { escapeHtml as e, relativeUrl, absoluteUrl } from '../lib/urls.mjs';
import { versionedAsset } from '../lib/assets.mjs';
import { cspPolicy, scriptIntegrity } from '../lib/security.mjs';

function header(ctx, issue) {
  const { page, config, url } = ctx;
  const isMap = page === 'map';
  const mapTarget = issue && !ctx.latest ? `${issue.date}/map/` : 'map/';
  const logo = `<span class="brand-mark b-brand-mark" aria-hidden="true"></span>${e(config.title)}`;
  const mapEdition = isMap && issue ? `<div class="b-edition b-container"><p><a href="${url(`${issue.date}/`)}">${issue.month}月${+issue.day}日 · ${e(issue.weekday)} · 第 ${issue.issueNumber} 期</a></p><p>本期地图</p></div>` : '';
  return `<a class="skip-link" href="#main">跳到正文</a><header class="site-header b-header"><div class="header-inner b-container b-header-inner"><a class="brand b-brand" href="${url('./')}">${logo}</a><span class="b-brand-note">军事 / 防务每日简报</span><nav class="site-nav b-nav" aria-label="主导航"><a href="${url('./')}"${page === 'issue' && ctx.latest ? ' aria-current="page"' : ''}>今日</a><a href="${url(mapTarget)}"${isMap ? ' aria-current="page"' : ''}>地图</a><a href="${url('archive/')}"${page === 'archive' ? ' aria-current="page"' : ''}>往期</a><a href="${url('sources/')}"${page === 'sources' ? ' aria-current="page"' : ''}>信源</a></nav><a class="b-search" href="${url('archive/')}">搜索简报 <span aria-hidden="true">↗</span></a></div></header>${mapEdition}`;
}

function footer(ctx) {
  return `<footer class="b-footer"><div class="b-container b-footer-inner"><div><a class="brand b-brand" href="${ctx.url('./')}"><span class="brand-mark b-brand-mark" aria-hidden="true"></span>${e(ctx.config.title)}</a><p>军事 / 防务每日简报 · 每条注明来源</p></div><div><nav aria-label="页脚"><a href="${ctx.url('archive/')}">往期</a><a href="${ctx.url('sources/')}">信源目录</a><a href="${ctx.url('about/')}">可信度说明</a><a href="${ctx.url('subscribe/')}">订阅</a><a href="${ctx.url('feed.xml')}">RSS</a></nav><p>${e(ctx.config.disclaimer)}</p></div></div></footer>`;
}

export function context(config, file, page, { latest = false } = {}) {
  return { config, file, page, latest, url: target => relativeUrl(file, target) };
}

export function layout(ctx, { title, description, canonical = '', content, issue = null }) {
  const { config } = ctx;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${e(cspPolicy())}"><meta name="referrer" content="strict-origin-when-cross-origin">${ctx.page === '404' ? `<base href="${e(new URL(config.baseUrl).pathname)}">` : ''}<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="defense-brief-build"><title>${e(title)}</title><meta name="description" content="${e([...description].slice(0, 120).join(''))}"><meta name="theme-color" content="#FF4F00"><link rel="canonical" href="${e(absoluteUrl(config, canonical))}"><meta property="og:type" content="${ctx.page === 'issue' ? 'article' : 'website'}"><meta property="og:locale" content="zh_CN"><meta property="og:site_name" content="${e(config.title)}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e([...description].slice(0, 120).join(''))}"><meta property="og:url" content="${e(absoluteUrl(config, canonical))}"><meta property="og:image" content="${e(absoluteUrl(config, 'assets/og-card.png'))}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="防务早知道，军事与防务每日简报">${issue ? `<meta property="article:published_time" content="${e(issue.publishedAt)}">` : ''}<link rel="alternate" type="application/rss+xml" title="防务早知道 RSS" href="${ctx.url('feed.xml')}"><link rel="icon" href="${ctx.url('assets/favicon.svg')}" type="image/svg+xml"><link rel="stylesheet" href="${versionedAsset(ctx, 'assets/site.css')}"><script src="${versionedAsset(ctx, 'assets/app.js')}" integrity="${scriptIntegrity}" defer></script></head><body class="v2-brand" data-page="${ctx.page}">${header(ctx, issue)}${content}${ctx.page === 'map' ? '' : footer(ctx)}</body></html>`;
}

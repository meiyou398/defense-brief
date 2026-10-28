import { escapeHtml as e } from '../lib/urls.mjs';
import { tierChip } from './components.mjs';
import { layout } from './layout.mjs';

export function aboutPage(ctx) {
  return layout(ctx, {
    title: '防务早知道｜可信度说明', description: '了解防务早知道的四档来源分类、核实原则和阅读注意事项。', canonical: 'about/',
    content: `<main id="main" class="info-page wrap"><div class="page-heading"><p class="eyebrow">SOURCES &amp; TRUST</p><h1>可信度说明</h1><p>每条注明来源，区分事实、分析、立场与线索。</p></div><div class="prose"><section aria-labelledby="tiers-heading"><h2 id="tiers-heading">四档来源分类</h2><p>分档帮助判断信息来源及核实程度。官方口径和厂商宣称仍应与其他证据对照阅读。</p><div class="tier-definitions">${Object.entries(ctx.config.tiers).map(([number, tier]) => `<article class="tier-definition">${tierChip(+number)}<div><h3>${e(tier.short)}</h3><p>${e(tier.long)}</p></div></article>`).join('')}</div><p>一条要闻可能同时包含多种来源。标签与首页数量采用主分档：优先使用编辑指定的 tier，否则取原文中最先出现的分档。没有明确分档的条目不显示标签。</p></section><section aria-labelledby="principles-heading"><h2 id="principles-heading">来源原则</h2><ul><li>保留原始来源链接与必要的来源说明，方便读者直接核对。</li><li>区分正式发布、媒体分析与评论；未核实的图片和匿名消息仅作为线索。</li><li>对官方口径、利益相关方和厂商性能宣称注明限制。相互冲突的说法需要交叉验证。</li><li>“为什么重要”和投资视角属于对公开信息的解读；标为“推断”的内容应与事实分开阅读。</li></ul></section><section aria-labelledby="disclaimer-heading"><h2 id="disclaimer-heading">免责声明</h2><p>${e(ctx.config.disclaimer)}军事与防务信息可能持续更新，来源的发布不代表内容已经过独立核实。请以原始文件和后续更正为准。</p></section><p><a class="text-link" href="${ctx.url('index.html')}">返回今日简报 →</a></p></div></main>`
  });
}

export function subscribePage(ctx) {
  return layout(ctx, {
    title: '防务早知道｜订阅早报', description: '邮件订阅暂未开放，可通过 RSS 订阅防务早知道每日简报。', canonical: 'subscribe/',
    content: `<main id="main" class="info-page wrap"><div class="page-heading"><p class="eyebrow">SUBSCRIBE</p><h1>订阅早报</h1></div><div class="prose"><p class="intro">邮件订阅暂未开放。</p><p>现在可以把 RSS 地址添加到你使用的阅读器，获取每天的新一期简报。</p><p><a class="button-link" href="${ctx.url('feed.xml')}">打开 RSS 订阅源 →</a></p><p><a class="text-link" href="${ctx.url('index.html')}">返回今日简报</a> · <a class="text-link" href="${ctx.url('archive/')}">浏览往期</a></p></div></main>`
  });
}

export function notFoundPage(ctx) {
  return layout(ctx, {
    title: '防务早知道｜页面未找到', description: '这个地址暂时没有简报，请返回首页或从往期列表查找。', canonical: '404.html',
    content: `<main id="main" class="not-found wrap"><p class="error-number" aria-hidden="true">404</p><h1>这个地址暂时没有简报。</h1><p>从最新一期继续阅读，或到往期查找。</p><div class="error-links"><a class="button-link" href="${ctx.url('index.html')}">返回首页 →</a><a class="button-link button-link--outline" href="${ctx.url('archive/')}">浏览往期</a></div></main>`
  });
}

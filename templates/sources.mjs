import { escapeHtml as e } from '../lib/urls.mjs';
import { tierChip } from './components.mjs';
import { layout } from './layout.mjs';

export function sourcesPage(ctx, catalog) {
  const count = catalog.groups.reduce((total, group) => total + group.sources.length, 0);
  return layout(ctx, {
    title: '防务早知道｜信源目录',
    description: `防务早知道日常跟踪的 ${count} 个公开信源、默认可信度分档与使用规则。`,
    canonical: 'sources/',
    content: `<main id="main" class="info-page source-catalog wrap"><div class="page-heading"><p class="eyebrow">SOURCE DIRECTORY</p><h1>信源目录</h1><p>共 ${count} 个信源 · 更新于 <time datetime="${e(catalog.updatedAt)}">${e(catalog.updatedAt)}</time></p></div><div class="prose"><p>${e(catalog.intro)}</p><section aria-labelledby="source-tiers"><h2 id="source-tiers">可信度分档</h2><div class="tier-definitions">${catalog.tiers.map(tier => `<article class="tier-definition">${tierChip(tier.tier)}<div><h3>${e(tier.label)}</h3><p>${e(tier.description)}</p></div></article>`).join('')}</div><p><a href="${ctx.url('about/')}">阅读可信度说明 →</a></p></section><section aria-labelledby="source-rules"><h2 id="source-rules">使用规则</h2><ul>${catalog.rules.map(rule => `<li>${e(rule)}</li>`).join('')}</ul></section><nav class="source-catalog-nav" aria-label="信源分类"><ul>${catalog.groups.map(group => `<li><a href="#${e(group.id)}">${e(group.title)} <span>(${group.sources.length})</span></a></li>`).join('')}</ul></nav>${catalog.groups.map(group => `<section class="source-category" aria-labelledby="${e(group.id)}"><h2 id="${e(group.id)}">${e(group.title)} <span class="source-category-count">${group.sources.length} 个</span></h2>${group.sources.map(source => `<article class="source-record"><div class="source-record-heading">${tierChip(source.tier)}<h3><a href="${e(source.url)}" target="_blank" rel="noopener">${e(source.name)} <span aria-hidden="true">↗</span><span class="sr-only">（新窗口）</span></a></h3><span class="source-language">${e(source.lang)}</span></div><p class="source-description">${e(source.description)}</p>${source.note ? `<p class="source-note">${e(source.note)}</p>` : ''}</article>`).join('')}</section>`).join('')}</div></main>`
  });
}

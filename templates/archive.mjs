import { escapeHtml as e } from '../lib/urls.mjs';
import { tierCounts } from './components.mjs';
import { layout } from './layout.mjs';

export function archivePage(ctx, issues) {
  const months = new Map();
  for (const issue of [...issues].reverse()) {
    const month = issue.date.slice(0, 7);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(issue);
  }
  const corpus = issue => [issue.date, issue.coverage, issue.summary, ...issue.highlights.flatMap(h => [h.lead, h.text]), ...issue.stats.flatMap(s => [s.value, s.unit, s.label]), ...issue.items.flatMap(i => [i.headline, i.text, i.whyItMatters, i.caution, i.theater.title, i.domain.label, i.locationLabel, i.sourceNote, i.tierText, ...i.entities, ...i.links.flatMap(l => [l.name, l.url])]), ...issue.invest].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase('zh-CN');
  return layout(ctx, {
    title: '防务早知道｜往期简报', description: '按月份浏览防务早知道往期简报，全文搜索正文、来源和投资视角。', canonical: 'archive/',
    content: `<main id="main" class="archive-page wrap"><div class="page-heading"><p class="eyebrow">ARCHIVE</p><h1>往期简报</h1><p>每天一份，回看防务事件与产业变化。</p></div><form class="archive-search" role="search" data-enhanced><label for="archive-query">全文搜索</label><div class="archive-search-control"><input type="search" id="archive-query" name="q" data-archive-search placeholder="搜索要闻、装备、机构或来源" autocomplete="off"><button type="submit">搜索</button></div><p data-search-status role="status" aria-live="polite">共 ${issues.length} 期</p></form><noscript><p class="search-noscript">以下列出全部往期。启用 JavaScript 可搜索每期全文；也可直接打开一期阅读。</p></noscript><div class="archive-empty" data-search-empty hidden><p>没有找到符合条件的简报，请尝试其他关键词。</p></div>${[...months].map(([month, entries]) => `<section class="archive-month" data-archive-month aria-labelledby="month-${month}"><h2 id="month-${month}">${month.slice(0, 4)} 年 ${+month.slice(5)} 月</h2><ol class="archive-list">${entries.map(issue => `<li class="archive-row" data-archive-row data-search="${e(corpus(issue))}"><a class="archive-link" href="${ctx.url(`${issue.date}/`)}"><span class="archive-date"><span class="archive-day">${issue.day}</span><span>${issue.weekday}</span><time datetime="${issue.date}">${issue.date}</time></span><span class="archive-copy"><strong>${e(issue.highlights[0]?.lead || issue.items[0].headline)}</strong><span>${e(issue.highlights[0]?.text || issue.items[0].headline)}</span><span class="archive-meta">第 ${issue.issueNumber} 期 · ${issue.items.length} 条要闻</span></span>${tierCounts(issue)}<span class="archive-arrow" aria-hidden="true">→</span></a></li>`).join('')}</ol></section>`).join('')}</main>`
  });
}

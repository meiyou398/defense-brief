import { layout } from './layout.mjs';
import { editorialContent } from './editorial.mjs';

export function issuePage(ctx, issue, previous = null, next = null) {
  const nav = ctx.latest ? '' : `<nav class="b-issue-nav issue-nav" aria-label="期次导航">${previous ? `<a href="${ctx.url(`${previous.date}/`)}">← 上一期 <span>${previous.date}</span></a>` : '<span>已到最早一期</span>'}${next ? `<a href="${ctx.url(`${next.date}/`)}">下一期 <span>${next.date}</span> →</a>` : '<span>已是最新一期</span>'}</nav>`;
  return layout(ctx, { title: `防务早知道｜${issue.month}月${+issue.day}日 ${issue.weekday}`, description: issue.summary, canonical: ctx.latest ? '' : `${issue.date}/`, issue, content: `<main id="main" class="b-container">${nav}${editorialContent(ctx, issue)}</main>` });
}

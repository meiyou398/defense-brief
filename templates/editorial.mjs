import { escapeHtml as e } from '../lib/urls.mjs';
import { entityText, pad, sourceLabel, tierName } from './components.mjs';

// Keep equipment names together while leaving the rest of a Chinese headline free to wrap.
const headlineMarkup = text => e(text).replace(/\b[A-Z][A-Z0-9]*-\d+[A-Z0-9]*\b/g, '<span class="b-nowrap">$&</span>');

function sourceLink(link, className = '') {
  return `<a${className ? ` class="${className}"` : ''} href="${e(link.url)}" target="_blank" rel="noopener">${e(sourceLabel(link))}<span aria-hidden="true"> ↗</span><span class="b-sr-only">（新窗口）</span></a>`;
}

function story(item, itemsByNumber) {
  const related = item.related.map(number => itemsByNumber.get(number)).filter(Boolean);
  const tierText = item.tierText || (item.tier ? tierName(item.tier) : '');
  return `<details class="b-story" open>
    <summary><span class="b-story-number">${pad(item.number)}</span><h3>${headlineMarkup(item.headline)}</h3><span class="b-disclosure" aria-hidden="true"></span></summary>
    <div class="b-story-body" id="${e(item.anchor)}" data-item-card tabindex="-1">
      <p class="b-prose">${entityText(item.text, item.entities)}</p>
      ${item.whyItMatters ? `<p class="b-analysis"><strong>为什么重要</strong>${e(item.whyItMatters)}</p>` : ''}
      ${item.caution ? `<p class="b-caution"><strong>核实提醒</strong>${e(item.caution)}</p>` : ''}
      ${item.links.length ? `<div class="b-sources"><span>来源</span><div>${item.links.map(link => sourceLink(link)).join('')}</div></div>` : ''}
      ${item.sourceNote || tierText ? `<div class="b-evidence">${item.sourceNote ? `<p>来源说明：${e(item.sourceNote)}</p>` : ''}${tierText ? `<p>原始分档：${e(tierText)}</p>` : ''}</div>` : ''}
      ${related.length ? `<p class="b-related"><strong>相关条目</strong>${related.map(item => `<a href="#${e(item.anchor)}">${pad(item.number)} · ${e(item.headline)}</a>`).join('')}</p>` : ''}
    </div>
  </details>`;
}

function highlights(issue, itemsByNumber) {
  const highlights = issue.highlights.map(highlight => ({ ...highlight, story: itemsByNumber.get(highlight.item) })).filter(highlight => highlight.story);
  if (!highlights.length) return '';
  return `<section id="highlights" class="b-highlights" aria-labelledby="highlights-heading">
    <div class="b-section-heading"><h2 id="highlights-heading">今日${highlights.length === 6 ? '六件事' : `${highlights.length}件事`}</h2><span>一分钟浏览 · 点击阅读完整条目</span></div>
    <ol class="b-highlight-grid">${highlights.map((highlight, index) => {
      const { story } = highlight;
      const text = highlight.text || (highlight.lead && highlight.lead !== story.headline ? story.headline : '');
      return `<li><a class="b-highlight-main" href="#${e(story.anchor)}"><span class="b-highlight-number">${pad(index + 1)}</span><span><strong>${e(highlight.lead || story.headline)}</strong>${text ? `<span class="b-highlight-text">${e(text)}</span>` : ''}</span><span class="b-highlight-arrow" aria-hidden="true">↗</span></a>${story.links[0] ? sourceLink(story.links[0], 'b-highlight-source') : ''}</li>`;
    }).join('')}</ol>
  </section>`;
}

function stats(issue, itemsByNumber) {
  const stats = issue.stats.filter(stat => itemsByNumber.has(stat.item));
  if (!stats.length) return '';
  return `<section class="b-stats" aria-labelledby="stats-heading"><div class="b-small-heading"><h2 id="stats-heading">本期数字</h2><span>数字来自正文，点击核对上下文</span></div><div class="b-stat-grid">${stats.map(stat => `<a href="#${e(itemsByNumber.get(stat.item).anchor)}" class="b-stat"><span class="b-stat-number"><strong>${e(stat.value)}</strong><span>${e(stat.unit || '')}</span></span><span class="b-stat-label">${e(stat.label)}</span><span class="b-stat-reference">第 ${pad(stat.item)} 条 ↗</span></a>`).join('')}</div></section>`;
}

function industry(issue) {
  if (!issue.invest.length) return '';
  return `<section id="industry" class="b-industry" aria-labelledby="industry-heading"><div class="b-industry-heading"><h2 id="industry-heading">产业观察</h2><p>基于本期公开信息整理，仅供参考，不构成投资建议。</p></div><ol>${issue.invest.map((text, index) => `<li><span>${pad(index + 1)}</span><p>${e(text)}</p></li>`).join('')}</ol></section>`;
}

export function editorialContent(ctx, issue) {
  const itemsByNumber = new Map(issue.items.map(item => [item.number, item]));
  const groups = issue.groups.filter(group => group.items.length);
  const firstHighlightItem = itemsByNumber.get(issue.highlights[0]?.item);
  const headline = issue.headline?.trim() || firstHighlightItem?.headline || issue.items[0]?.headline || '本期防务简报';
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long', timeZone: 'Asia/Shanghai' }).format(new Date(`${issue.date}T12:00:00+08:00`));
  const cutoff = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Shanghai' }).format(new Date(issue.publishedAt));
  const groupLinks = (overview = false) => groups.map(group => `<a href="#${e(overview ? group.items[0].anchor : `theater-${group.id}`)}"><span>${e(group.title)}</span><span>${group.items.length}</span></a>`).join('');
  const sections = groups.map(group => `<section class="b-news-group" aria-labelledby="theater-${e(group.id)}"><div class="b-group-heading"><h2 id="theater-${e(group.id)}">${e(group.title)}</h2><span>${group.items.length} 条</span></div>${group.items.map(item => story(item, itemsByNumber)).join('')}</section>`).join('');

  return `<div class="b-edition"><p><time datetime="${e(issue.date)}">${issue.month}月${+issue.day}日</time><span>${e(weekday)}</span><span>第 ${issue.issueNumber} 期</span></p><p>${e(cutoff)} 截稿 · UTC+8</p></div>
    <section class="b-hero" aria-labelledby="headline"><div class="b-hero-copy"><p class="b-kicker"><i aria-hidden="true"></i>今日主线</p><h1 id="headline">${headlineMarkup(headline)}</h1><p class="b-intro">${e(issue.summary)}</p>${issue.coverage ? `<p class="b-coverage">${e(issue.coverage)}</p>` : ''}<div class="b-hero-actions"><a class="b-read-link" href="#full">阅读本期 ${issue.items.length} 条要闻 <span aria-hidden="true">↓</span></a><a class="b-secondary-link" href="#highlights">先看${issue.highlights.length === 6 ? '六件事' : '本期要点'}</a></div><div class="b-mode-toggle mode-toggle" role="group" aria-label="阅读模式" data-enhanced><button type="button" data-mode-button="brief" aria-pressed="false">一分钟版</button><button type="button" data-mode-button="full" aria-pressed="true">完整版 · 约 ${issue.readingMinutes} 分钟</button></div></div><aside class="b-hero-guide"><span class="b-mini-heading">本期关注</span><nav aria-label="本期概览">${groupLinks(true)}</nav><p>正文与来源完整保留。<br>涉及机构、厂商和交战方的说法，请结合原始报道核对。</p></aside></section>
    ${highlights(issue, itemsByNumber)}
    ${stats(issue, itemsByNumber)}
    <div class="b-reading-layout"><div class="b-main-column"><section id="full" class="b-full" data-full-only aria-labelledby="full-heading"><div class="b-section-heading"><h2 id="full-heading">本期全部要闻</h2><span>${issue.items.length} 条 · 正文完整展开</span></div><p class="b-reading-note">点击标题可收起正文。下列原始来源与分档供阅读参考，不代表已获独立核实。</p>${sections}</section>${industry(issue)}</div><aside class="b-reading-sidebar" data-full-only><div class="b-sticky"><details class="b-contents" open><summary>本期目录 <span aria-hidden="true">⌄</span></summary><nav aria-label="正文板块">${groupLinks()}${issue.invest.length ? '<a href="#industry"><span>产业观察</span><span>↓</span></a>' : ''}</nav></details><div class="b-map-entry"><span class="b-mini-heading">地图与位置</span><p>按地区查看本期报道。位置记录仍需结合正文核对。</p><a href="${ctx.url(`${issue.date}/map/`)}">打开本期地图 ↗</a></div><a class="b-top-link" href="#headline">回到今日主线 ↑</a></div></aside></div>`.replace(/[ \t]+$/gm, '');
}

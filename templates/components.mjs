import { escapeHtml as e } from '../lib/urls.mjs';

export const pad = n => String(n).padStart(2, '0');
const tierNames = { 1: '一档', 2: '二档', 3: '三档', 4: '四档' };
export const tierName = tier => tierNames[tier] || '未分档';
export function tierChip(tier, count) {
  if (!tier) return '';
  return `<span class="tier tier--${tier}">${tierName(tier)}${count === undefined ? '' : ` ${count}`}${tier === 4 ? ' · 仅线索' : ''}</span>`;
}

const sourceAliases = { 'The War Zone': 'TWZ', 'USNI News': 'USNI', '台湾国防部 Taiwan MND': '台湾国防部' };
export function sourceChips(item) {
  return item.links.map(link => `<a class="source-chip" href="${e(link.url)}" target="_blank" rel="noopener">${e(sourceAliases[link.name] || link.name)} <span aria-hidden="true">↗</span><span class="sr-only">（新窗口）</span></a>`).join('');
}

export function entityText(text = '', entities = []) {
  const matches = [...new Set(entities.filter(Boolean))].map(value => ({ value, index: text.indexOf(value) })).filter(m => m.index >= 0).sort((a, b) => a.index - b.index || b.value.length - a.value.length);
  let end = 0, out = '';
  for (const match of matches) {
    if (match.index < end) continue;
    out += e(text.slice(end, match.index)) + `<strong>${e(match.value)}</strong>`;
    end = match.index + match.value.length;
  }
  return out + e(text.slice(end));
}

export function tierCounts(issue) {
  return `<div class="tier-counts" aria-label="按主分档统计的条目数">${[1, 2, 3, 4].filter(t => issue.counts[t]).map(t => tierChip(t, issue.counts[t])).join('')}</div>`;
}

export function clockBar(issue) {
  return `<div class="clock-bar"><div class="clock-inner wrap"><span class="clock-label">截稿时各地时间</span>${issue.clocks.map(c => `<span class="clock-city"><span class="clock-face${c.night ? ' is-night' : ''}" aria-hidden="true" style="--hour:${c.hourAngle}deg;--minute:${c.minuteAngle}deg"><span class="clock-hour"></span><span class="clock-minute"></span></span><span>${e(c.city)}</span><b>${c.time}</b></span>`).join('')}</div></div>`;
}

export function hero(issue) {
  return `<section class="hero wrap" aria-labelledby="issue-title"><div class="hero-date"><span class="date-number">${issue.day}</span><span class="date-sub"><span>${issue.monthLabel} ${issue.year}</span><span class="date-weekday"> · ${issue.weekday}</span><span class="mobile-issue">${issue.weekday} · 第 ${issue.issueNumber} 期</span></span></div><div class="hero-main"><p class="issue-meta"><span>第 ${issue.issueNumber} 期</span>${issue.coverage ? `<span>${e(issue.coverage)}</span>` : ''}</p><h1 id="issue-title">今天的 ${issue.items.length} 条防务要闻</h1><div class="mode-and-tiers"><div class="mode-toggle" role="group" aria-label="阅读模式" data-enhanced><button type="button" data-mode-button="brief" aria-pressed="false">一分钟版</button><button type="button" data-mode-button="full" aria-pressed="true">完整版 · 约 ${issue.readingMinutes} 分钟</button></div>${tierCounts(issue)}</div></div></section>`;
}

export function briefCards(issue) {
  return `<section class="section brief-section" aria-labelledby="brief-heading"><div class="wrap"><div class="section-heading"><h2 id="brief-heading">今日${issue.highlights.length === 6 ? '六件事' : `${issue.highlights.length}件事`}</h2><span class="section-note">一分钟读完</span></div><ol class="brief-grid">${issue.highlights.map((h, i) => {
    const item = issue.items[h.item - 1];
    return `<li class="brief-card"><a class="brief-main" href="#${item.anchor}"><span class="brief-number">${i + 1}</span><span class="brief-copy"><strong class="brief-lead">${e(h.lead)}</strong><span class="brief-text">${entityText(h.text, item.entities)}</span></span></a><span class="brief-sources">${sourceChips(item)}${tierChip(item.tier)}</span></li>`;
  }).join('')}</ol></div></section>`;
}

export function statStrip(issue) {
  if (!issue.stats.length) return '';
  return `<section class="stat-strip" aria-label="今日数字"><div class="stat-inner wrap">${issue.stats.map(s => `<a class="stat-cell" href="#n${pad(s.item)}"><span class="stat-value">${e(s.value)}<span class="stat-unit">${e(s.unit || '')}</span></span><span class="stat-label">${e(s.label)}</span></a>`).join('')}</div></section>`;
}

export function itemCard(item, issue, { full = false } = {}) {
  const related = item.related.map(n => issue.items[n - 1]).filter(Boolean);
  return `<article class="item-card"${full ? ` id="${item.anchor}" data-item-card tabindex="-1"` : ''}><div class="item-meta"><span><span class="item-number">${pad(item.number)}</span><span class="item-theater">${e(item.theater.short)}</span></span>${tierChip(item.tier)}</div><h3 class="item-title">${e(item.headline)}</h3><p class="item-body"><strong>发生了什么：</strong>${entityText(item.text, item.entities)} <span class="item-inline-sources">${sourceChips(item)}</span></p>${item.whyItMatters ? `<p class="item-body"><strong>为什么重要：</strong>${e(item.whyItMatters)}</p>` : ''}${item.caution ? `<p class="item-caution"><strong>注意：</strong>${e(item.caution)}</p>` : ''}${related.length ? `<p class="item-related"><strong>关联：</strong>${related.map(r => `<a href="#${r.anchor}">${pad(r.number)} · ${e(r.headline)}</a>`).join('')}</p>` : ''}${full && (item.sourceNote || item.tierText) ? `<p class="item-source-note">${item.sourceNote ? `来源：${e(item.sourceNote)}` : ''}${item.sourceNote && item.tierText ? ' · ' : ''}${item.tierText ? `可信度：${e(item.tierText)}` : ''}</p>` : ''}</article>`;
}

export function investment(issue) {
  if (!issue.invest.length) return '';
  return `<section class="invest-band" aria-labelledby="invest-title"><div class="invest-layout wrap"><div class="invest-intro"><h2 id="invest-title">投资视角</h2><p>仅供参考，不构成投资建议</p></div><div class="invest-grid">${issue.invest.map(text => {
    const clean = text.replace(/[（(]这是推断[）)]/g, '\u0000');
    const split = clean.search(/[。！？]/u);
    const firstEnd = split >= 0 ? split + 1 : clean.length;
    const html = `<strong>${e(clean.slice(0, firstEnd))}</strong>${e(clean.slice(firstEnd))}`;
    return `<p>${html.replace(/\u0000/g, '<span class="inference-tag">推断</span>')}</p>`;
  }).join('')}</div></div></section>`;
}

export const domainSquare = (item, extra = '') => `<span class="domain-square${item.tier === 4 ? ' domain-square--unverified' : ''} ${extra}" aria-hidden="true">${e(item.domain.char)}</span>`;
export const sourceLine = item => item.links.map(l => l.name).join('；') || item.sourceNote || '来源未注明';
export const mapTitle = item => `${pad(item.number)} ${e(item.headline)}`;
export const mapMeta = item => `${e(item.locationLabel)} · ${e(sourceLine(item))}${item.tier ? ` · ${tierName(item.tier)}` : ''}`;

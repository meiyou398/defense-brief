import { escapeHtml as e } from '../lib/urls.mjs';
import { layout } from './layout.mjs';
import { tierName, pad, domainSquare, sourceLine, mapTitle, mapMeta } from './components.mjs';

const attrs = item => `data-item="${item.number}" data-theater="${e(item.theater.id)}" data-domain="${item.domain.id}" data-tier="${item.tier || ''}"`;
const itemUrl = (ctx, issue, item, preview) => preview ? `#${item.anchor}` : ctx.url(`${issue.date}/#${item.anchor}`);

export function mapWidget(ctx, issue, { preview = false } = {}) {
  const mapped = issue.items.filter(item => item.position);
  const markerGroups = issue.markerGroups;
  const us = issue.items.filter(item => item.location?.offMap === 'us');
  const unlocated = issue.items.filter(item => !item.position && item.location?.offMap !== 'us');
  const defaultNumber = issue.defaultItem || issue.items[0]?.number;
  const rootId = preview ? 'today-map' : 'issue-map';
  const groupFor = new Map(markerGroups.flatMap(group => group.map(item => [item.number, group])));
  const choiceList = item => {
    const group = groupFor.get(item.number) || [];
    if (group.length < 2) return '';
    return `<div class="map-group-choices" role="group" aria-label="同处地图位置的条目">${group.map(member => `<button type="button" data-group-choice ${attrs(member)} aria-pressed="${member.number === item.number}" aria-label="第 ${pad(member.number)} 条，${e(member.headline)}"><span>${pad(member.number)}</span> ${e(member.headline)}</button>`).join('')}</div>`;
  };
  const offmap = (label, items, kind) => items.length ? `<div class="map-offmap map-offmap--${kind}" data-offmap><span>${label}：</span>${items.map(item => `<button type="button" class="offmap-item" data-offmap-item ${attrs(item)} aria-pressed="false" aria-label="第 ${pad(item.number)} 条，${e(item.locationLabel)}，${tierName(item.tier)}">${pad(item.number)}</button>`).join('<span aria-hidden="true"> · </span>')}</div>` : '';
  const feed = issue.items.map(item => `<li class="map-feed-row" data-feed-row ${attrs(item)}><a href="${itemUrl(ctx, issue, item, preview)}" data-select-item data-item="${item.number}">${domainSquare(item)}<span class="map-feed-copy"><span class="map-feed-title">${mapTitle(item)}</span><span class="map-feed-meta">${mapMeta(item)}</span></span></a></li>`).join('');
  const markers = markerGroups.map(group => {
    const first = group[0];
    const label = group.length > 1 ? `${pad(first.number)}+${group.length - 1}，第 ${group.map(item => pad(item.number)).join('、')} 条，${e(first.locationLabel)}，共 ${group.length} 条，点击选择` : `第 ${pad(first.number)} 条，${e(first.locationLabel)}，${tierName(first.tier)}`;
    return `<button type="button" class="map-marker tier--${first.tier || 2}${group.length > 1 ? ' map-marker--group' : ''}" data-marker ${attrs(first)} data-items="${group.map(item => item.number).join(' ')}" data-group-id="g${pad(first.number)}" style="left:${first.position.left}%;top:${first.position.top}%" aria-pressed="false" aria-haspopup="dialog" aria-label="${label}"><span class="map-marker-glyph">${group.map((item, index) => `<span data-marker-label data-item="${item.number}" data-label="第 ${pad(item.number)} 条，${e(item.locationLabel)}，${tierName(item.tier)}"${index ? ' hidden' : ''}>${pad(item.number)}</span>`).join('')}</span><span class="map-marker-count" data-marker-count${group.length < 2 ? ' hidden' : ''} aria-hidden="true">+${group.length - 1}</span></button>`;
  }).join('');
  const popups = mapped.map(item => `<div class="map-popup" data-popup data-item="${item.number}" role="dialog" aria-label="第 ${pad(item.number)} 条详情" style="left:${item.position.left}%;top:${item.position.top}%" hidden><span class="map-popup-meta">${pad(item.number)} · ${e(item.locationLabel)} · ${e(item.theater.short)}</span><strong class="map-popup-title">${e(item.headline)}</strong>${choiceList(item)}<span class="map-popup-bottom"><span>${e(sourceLine(item))}${item.tier ? ` · ${tierName(item.tier)}` : ''}</span><a href="${itemUrl(ctx, issue, item, preview)}">读全文 →</a></span></div>`).join('');
  const detail = `<div class="map-mobile-detail map-selection-detail" data-mobile-detail data-selection-detail data-show-offmap="false" aria-live="polite">${issue.items.map(item => `<article class="map-mobile-item map-selection-item" data-mobile-item data-item="${item.number}"${item.number !== defaultNumber ? ' hidden' : ''}><a class="map-detail-link map-selection-link" data-detail-full href="${itemUrl(ctx, issue, item, preview)}">${domainSquare(item)}<span class="map-mobile-copy"><strong>${mapTitle(item)}</strong><span class="map-feed-meta">${mapMeta(item)}</span><span class="map-detail-action">读全文 →</span></span></a>${choiceList(item)}</article>`).join('')}</div>`;
  const zoomControls = variant => `<div class="map-zoom map-zoom--${variant}" data-enhanced aria-label="地图缩放"><button type="button" data-zoom="in" aria-label="放大地图">+</button><button type="button" data-zoom="out" aria-label="缩小地图">−</button></div>`;
  return `<div class="map-widget" data-map data-preview="${preview}" data-default-item="${defaultNumber || ''}">${preview ? '' : filterBar(issue, ctx.config)}<div class="map-layout${preview ? ' map-layout--preview' : ''}"><div class="map-visual"><figure class="map-panel" aria-labelledby="${rootId}-caption"><figcaption id="${rootId}-caption" class="sr-only">本期 ${mapped.length} 条已定位要闻，合成 ${markerGroups.length} 个地图标记；${us.length} 条在美国本土，${unlocated.length} 条未定位。旁边列表提供全部文字内容。</figcaption><div class="map-stage" data-map-stage><div class="map-canvas" data-map-canvas><div role="img" aria-label="本期防务要闻分布图，底图为自然地球投影" data-map-image><img src="${ctx.url('assets/map-h.svg')}" width="900" height="640" alt="" decoding="async"></div>${markers}</div>${popups}${preview ? '' : zoomControls('overlay')}<div class="map-offmaps">${offmap('← 美国本土', us, 'us')}${offmap('未定位', unlocated, 'unknown')}</div><div class="map-legend" aria-label="地图标记图例">${[1, 2, 3, 4].filter(tier => issue.counts[tier]).map(tier => `<span><i class="legend-square tier--${tier}" aria-hidden="true"></i>${tierName(tier)}</span>`).join('')}</div></div>${preview ? '' : zoomControls('mobile')}</figure>${detail}</div><aside class="map-feed${preview ? ' map-feed-preview' : ''}" aria-label="${preview ? '今日地图条目' : '本期全部条目'}">${preview ? '' : '<h2 class="map-feed-heading">本期条目<span>点条目，地图跟着定位</span></h2>'}<ol class="map-feed-list">${feed}</ol><div class="map-empty" data-empty hidden><p>没有符合条件的条目</p><button type="button" data-clear-filters>清除筛选</button></div>${preview && (us.length || unlocated.length) ? `<p class="map-offmap-note">未在图上：${us.map(item => pad(item.number)).join(' · ')}${us.length ? '（美国本土）' : ''}${us.length && unlocated.length ? '，' : ''}${unlocated.map(item => pad(item.number)).join(' · ')}${unlocated.length ? '（未定位）' : ''}</p>` : ''}</aside></div></div>`;
}

function filterBar(issue, config) {
  const theater = `<div class="filter-group" data-filter-group="theater" role="group" aria-label="战区"><button class="filter-chip" type="button" data-filter data-filter-key="theater" data-filter-value="" aria-pressed="true">全部 ${issue.items.length}</button>${issue.groups.map(g => `<button class="filter-chip" type="button" data-filter data-filter-key="theater" data-filter-value="${e(g.id)}" aria-pressed="false">${e(g.short)} ${g.items.length}</button>`).join('')}</div>`;
  const domains = [...config.domains, { id: 'other', label: '其他', char: '·' }].filter(d => issue.items.some(i => i.domain.id === d.id));
  return `<div class="filter-bar" data-enhanced>${theater}<span class="filter-divider" aria-hidden="true"></span><div class="filter-group" data-filter-group="domain" role="group" aria-label="领域">${domains.map(d => `<button class="filter-chip filter-chip--domain" type="button" data-filter data-filter-key="domain" data-filter-value="${d.id}" aria-pressed="false"><span class="domain-square" aria-hidden="true">${e(d.char)}</span>${e(d.label)} ${issue.items.filter(i => i.domain.id === d.id).length}</button>`).join('')}</div></div>`;
}

export function mapPage(ctx, issue) {
  return layout(ctx, { title: `防务早知道｜${issue.month}月${+issue.day}日 ${issue.weekday} · 地图`, description: issue.summary, canonical: ctx.latest ? 'map/' : `${issue.date}/map/`, issue, content: `<main id="main" class="map-page wrap-map"><h1 class="sr-only">${issue.month}月${+issue.day}日防务要闻地图</h1>${mapWidget(ctx, issue)}</main>` });
}

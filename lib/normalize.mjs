import { makeProjection, markerPosition, groupMarkers } from './projection.mjs';

const han = { 一: 1, 二: 2, 三: 3, 四: 4 };
export const excerpt = (text = '', length = 120) => [...text].slice(0, length).join('');

export function parseTiers(item = {}) {
  const parsed = [...(item.tierText || '').matchAll(/([一二三四1-4])\s*档/g)].map(m => han[m[1]] || +m[1]);
  const explicit = Number.isInteger(item.tier) && item.tier >= 1 && item.tier <= 4 ? item.tier : null;
  return { tier: explicit || parsed[0] || null, tiers: [...new Set([...(explicit ? [explicit] : []), ...parsed])] };
}

export function fallbackHeadline(text = '') {
  // Keep decimal numbers and numeric thousands separators intact.
  const boundary = [...text.matchAll(/[，。,.]/gu)].find(match => !/[,.]/.test(match[0]) || !/\d/.test(text[match.index - 1] || '') || !/\d/.test(text[match.index + 1] || ''));
  const first = (boundary ? text.slice(0, boundary.index) : text).trim() || text.trim();
  return [...first].length > 28 ? `${excerpt(first, 27)}…` : first;
}

export function deriveSummary(raw) {
  return raw.summary?.trim() || excerpt(raw.sections.flatMap(s => s.items)[0]?.text || '', 120);
}

export function normalizeIssue(raw, config) {
  const projection = makeProjection();
  const groups = [];
  const items = [];
  let unknown = 0;
  for (const section of raw.sections) {
    let group = groups.find(g => g.title === section.title);
    if (!group) {
      const theater = config.theaters.find(t => t.title === section.title) || { title: section.title, id: `s${++unknown}`, short: section.title, code: '' };
      group = { ...theater, items: [] };
      groups.push(group);
    }
    const { items: _items, ...theater } = group;
    for (const source of section.items) {
      const number = items.length + 1;
      const item = {
        ...source,
        ...parseTiers(source),
        number,
        anchor: `n${String(number).padStart(2, '0')}`,
        headline: source.headline?.trim() || fallbackHeadline(source.text),
        entities: source.entities || [],
        links: source.links || [],
        related: source.related || [],
        theater,
        domain: config.domains.find(d => d.id === source.domain) || { id: 'other', label: '其他', char: '·' },
        location: source.location || null,
        position: markerPosition(source.location, projection),
        locationLabel: source.location?.name || '未定位'
      };
      items.push(item);
      group.items.push(item);
    }
  }
  const publishedAt = raw.publishedAt || `${raw.date}T08:00:00+08:00`;
  const date = new Date(`${raw.date}T00:00:00+08:00`);
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: 'Asia/Shanghai' }).format(date);
  const clocks = config.clocks.map(({ city, tz }) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(publishedAt));
    const hour = +parts.find(p => p.type === 'hour').value;
    const minute = +parts.find(p => p.type === 'minute').value;
    return { city, tz, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, hourAngle: (hour % 12) * 30 + minute * .5, minuteAngle: minute * 6, night: hour >= 18 || hour < 6 };
  });
  const highlights = raw.highlights?.length ? raw.highlights : items.slice(0, 6).map(item => ({ lead: item.headline, text: '', item: item.number }));
  const featured = (raw.featured || items.filter(i => i.tier === 1).slice(0, 2).map(i => i.number)).map(n => items[n - 1]);
  const counts = Object.fromEntries([1, 2, 3, 4].map(t => [t, items.filter(i => i.tier === t).length]));
  const bodyLength = items.reduce((sum, item) => sum + [...item.text.replace(/\s/g, '')].length, 0);
  const markerGroups = groupMarkers(items.filter(item => item.position).map(item => ({ ...item.position, item }))).map(group => group.map(marker => marker.item));
  return {
    ...raw, summary: deriveSummary(raw), publishedAt, weekday, clocks, items, groups, markerGroups, highlights, featured, counts,
    stats: raw.stats || [], invest: raw.invest || [],
    day: raw.date.slice(8), month: +raw.date.slice(5, 7), year: raw.date.slice(0, 4),
    monthLabel: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'Asia/Shanghai' }).format(date).toUpperCase(),
    readingMinutes: Math.max(1, Math.ceil(bodyLength / 400)),
    defaultItem: highlights.map(h => items[h.item - 1]).find(i => i.position)?.number || items.find(i => i.position)?.number || null
  };
}

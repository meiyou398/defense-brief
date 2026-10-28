(() => {
  'use strict';
  const doc = document, html = doc.documentElement;
  const all = (selector, scope = doc) => [...scope.querySelectorAll(selector)];
  const one = (selector, scope = doc) => scope.querySelector(selector);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = () => reduced() ? 'instant' : 'smooth';
  const currentURL = () => new URL(window.location.href);
  const writeURL = (url, push = false) => {
    if (url.href !== window.location.href) {
      history[push ? 'pushState' : 'replaceState'](null, '', url.pathname + url.search + url.hash);
    }
  };
  const modeKey = 'defense-brief:mode';
  const savedMode = () => {
    try { return localStorage.getItem(modeKey) === 'full' ? 'full' : 'brief'; }
    catch { return 'brief'; }
  };
  const isItemHash = hash => /^#n\d+$/i.test(hash);
  const forcedFull = () => location.hash === '#full' || isItemHash(location.hash);
  const modeButtons = all('[data-mode-button]');
  let targetTimer, targetCard;
  let refreshMaps = () => {};
  function setMode(mode, remember = false, preserveScroll = false) {
    const y = window.scrollY, x = window.scrollX;
    html.dataset.mode = mode;
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.modeButton === mode)));
    if (remember) {
      try { localStorage.setItem(modeKey, mode); } catch {}
    }
    if (preserveScroll) {
      window.scrollTo({ left: x, top: y, behavior: 'instant' });
      requestAnimationFrame(() => window.scrollTo({ left: x, top: y, behavior: 'instant' }));
    }
    requestAnimationFrame(refreshMaps);
  }
  function showTarget(animate = true) {
    if (!isItemHash(location.hash)) return;
    const number = String(Number(location.hash.slice(2))).padStart(2, '0');
    const card = doc.getElementById('n' + number);
    if (!card) return;
    if (targetCard) targetCard.classList.remove('is-target');
    clearTimeout(targetTimer);
    targetCard = card;
    card.classList.add('is-target');
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'start', behavior: animate ? behavior() : 'instant' });
    targetTimer = setTimeout(() => { card.classList.remove('is-target'); }, 2000);
  }
  function restoreMode(animate = false) {
    if (!modeButtons.length) return;
    setMode(forcedFull() ? 'full' : savedMode());
    if (isItemHash(location.hash)) requestAnimationFrame(() => showTarget(animate));
  }

  function setupMap(root) {
    const stage = one('[data-map-stage]', root), canvas = one('[data-map-canvas]', root);
    const markers = all('[data-marker]', root), rows = all('[data-feed-row]', root);
    const offmap = all('[data-offmap-item]', root), popups = all('[data-popup]', root);
    const mobileItems = all('[data-mobile-item]', root), filters = all('[data-filter]', root);
    const choices = all('[data-group-choice]', root), detail = one('[data-selection-detail]', root);
    const zoomButtons = all('[data-zoom]', root), empty = one('[data-empty]', root);
    const records = new Map();
    let selected = null, zoom = 1, origin = { x: 50, y: 50 };
    const active = { theater: '', domain: '' };
    rows.forEach(row => records.set(row.dataset.item, { id: row.dataset.item, theater: row.dataset.theater, domain: row.dataset.domain, tier: row.dataset.tier || '2', row, visible: true }));
    offmap.forEach(el => { const item = records.get(el.dataset.item); if (item) item.offmap = el; });
    popups.forEach(el => { const item = records.get(el.dataset.item); if (item) item.popup = el; });
    mobileItems.forEach(el => { const item = records.get(el.dataset.item); if (item) item.mobile = el; });
    const groups = markers.map(el => {
      const group = { el, labels: all('[data-marker-label]', el), badge: one('[data-marker-count]', el), members: (el.dataset.items || el.dataset.item).split(' ').map(id => records.get(id)).filter(Boolean) };
      group.members.forEach(item => { item.marker = el; item.group = group; });
      return group;
    });
    const ordered = [...records.values()].sort((a, b) => Number(a.id) - Number(b.id));
    const allowed = key => new Set(filters.filter(button => button.dataset.filterKey === key).map(button => button.dataset.filterValue));
    const allowedValues = { theater: allowed('theater'), domain: allowed('domain') };
    const visibleMembers = group => group.members.filter(item => item.visible);
    const point = item => ({ x: parseFloat(item?.marker?.style.left) || 0, y: parseFloat(item?.marker?.style.top) || 0 });
    function renderGroups() {
      groups.forEach(group => {
        const members = visibleMembers(group), chosen = members.find(item => item.id === selected) || members[0] || group.members[0];
        const on = members.some(item => item.id === selected);
        group.el.disabled = members.length === 0;
        group.el.classList.toggle('is-filtered', !members.length);
        group.el.classList.toggle('is-selected', on);
        group.el.setAttribute('aria-pressed', String(on));
        group.el.setAttribute('aria-expanded', String(on));
        group.el.dataset.activeItem = chosen.id;
        for (let tier = 1; tier <= 4; tier++) group.el.classList.toggle('tier--' + tier, String(tier) === chosen.tier);
        group.labels.forEach(label => { label.hidden = label.dataset.item !== chosen.id; });
        const label = group.labels.find(label => label.dataset.item === chosen.id)?.dataset.label || '';
        group.el.setAttribute('aria-label', members.length > 1 ? chosen.id.padStart(2, '0') + '+' + (members.length - 1) + '，' + label + '；同组条目 ' + members.map(item => item.id.padStart(2, '0')).join('、') + '，再次按下切换' : label);
        if (group.badge) { group.badge.hidden = members.length < 2; group.badge.textContent = '+' + Math.max(0, members.length - 1); }
      });
      choices.forEach(button => {
        button.hidden = !records.get(button.dataset.item)?.visible;
        button.setAttribute('aria-pressed', String(button.dataset.item === selected));
      });
    }
    function placePopup() {
      const item = records.get(selected), popup = item?.popup;
      popups.forEach(el => { el.hidden = true; });
      if (!popup || !item.marker || !stage || window.innerWidth < 760 || !stage.clientWidth) return;
      popup.hidden = false;
      popup.style.transform = 'none';
      const stageBox = stage.getBoundingClientRect(), markerBox = item.marker.getBoundingClientRect();
      const width = stage.clientWidth, height = stage.clientHeight;
      const x = markerBox.left - stageBox.left + markerBox.width / 2, y = markerBox.top - stageBox.top + markerBox.height / 2;
      const pw = popup.offsetWidth, ph = popup.offsetHeight, gap = 26;
      const blocks = groups.filter(group => group.el !== item.marker && !group.el.disabled).map(group => {
        const b = one('.map-marker-glyph', group.el).getBoundingClientRect();
        return { x: b.left - stageBox.left - 3, y: b.top - stageBox.top - 3, w: b.width + 6, h: b.height + 6 };
      });
      all('.map-legend,.map-offmaps,.map-zoom', stage).forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width && b.height) blocks.push({ x: b.left - stageBox.left, y: b.top - stageBox.top, w: b.width, h: b.height });
      });
      const candidates = [[x + gap, y - ph / 2], [x - pw - gap, y - ph / 2], [x - pw / 2, y + gap], [x - pw / 2, y - ph - gap], [x - pw + 14, y + gap], [x - 14, y + gap], [x - pw + 14, y - ph - gap], [x - 14, y - ph - gap]];
      for (const px of [8, (width - pw) / 2, width - pw - 8]) for (const py of [8, (height - ph) / 2, height - ph - 8]) candidates.push([px, py]);
      const placed = candidates.map(([left, top]) => {
        left = Math.max(8, Math.min(width - pw - 8, left)); top = Math.max(8, Math.min(height - ph - 8, top));
        let score = Math.hypot(left + pw / 2 - x, top + ph / 2 - y);
        for (const b of blocks) {
          const overlap = Math.max(0, Math.min(left + pw, b.x + b.w) - Math.max(left, b.x)) * Math.max(0, Math.min(top + ph, b.y + b.h) - Math.max(top, b.y));
          score += overlap * 1000;
        }
        if (x > left && x < left + pw && y > top && y < top + ph) score += 1e7;
        return { left, top, score };
      }).sort((a, b) => a.score - b.score);
      const best = placed[0];
      popup.classList.toggle('is-left', best.left < x - pw / 2);
      popup.style.left = best.left + 'px'; popup.style.top = best.top + 'px';
    }
    function renderCanvas() {
      const item = records.get(selected);
      origin = zoom === 1 ? { x: 50, y: 50 } : item?.marker ? point(item) : origin;
      if (canvas) {
        canvas.style.transformOrigin = `${origin.x}% ${origin.y}%`;
        canvas.style.transform = zoom === 1 ? 'none' : `scale(${zoom})`;
        canvas.style.setProperty('--marker-scale', String(1 / zoom));
        canvas.style.setProperty('--map-zoom', String(zoom));
      }
      zoomButtons.forEach(button => { button.disabled = button.dataset.zoom === 'in' ? zoom >= 2 : zoom <= 1; });
      placePopup();
    }
    function scrollRow(row) {
      if (!row) return;
      let container = row.parentElement;
      while (container && container !== root) {
        const style = getComputedStyle(container);
        if (/(auto|scroll)/.test(style.overflowY) && container.scrollHeight > container.clientHeight) {
          const a = row.getBoundingClientRect(), b = container.getBoundingClientRect();
          const top = a.top < b.top ? a.top - b.top : a.bottom > b.bottom ? a.bottom - b.bottom : 0;
          if (top) container.scrollBy({ top, behavior: behavior() });
          return;
        }
        container = container.parentElement;
      }
    }
    function select(id, scroll = false) {
      selected = records.get(id)?.visible ? id : null;
      ordered.forEach(item => {
        const on = selected === item.id;
        item.row.classList.toggle('is-selected', on);
        const anchor = one('[data-select-item]', item.row);
        if (on) anchor.setAttribute('aria-current', 'true'); else anchor.removeAttribute('aria-current');
        if (item.offmap) { item.offmap.classList.toggle('is-selected', on); item.offmap.setAttribute('aria-pressed', String(on)); }
        if (item.mobile) item.mobile.hidden = !on;
      });
      const offMapSelection = Boolean(selected && !records.get(selected).marker);
      root.classList.toggle('has-offmap-selection', offMapSelection);
      if (detail) detail.dataset.showOffmap = String(offMapSelection);
      renderGroups(); renderCanvas();
      if (scroll) scrollRow(records.get(selected)?.row);
    }
    const firstVisible = () => ordered.find(item => item.visible && item.marker) || ordered.find(item => item.visible);
    function applyFilters(initial = false) {
      let count = 0;
      ordered.forEach(item => {
        item.visible = (!active.theater || item.theater === active.theater) && (!active.domain || item.domain === active.domain);
        if (item.visible) count++;
        item.row.hidden = !item.visible;
        if (item.offmap) { item.offmap.disabled = !item.visible; item.offmap.classList.toggle('is-filtered', !item.visible); }
      });
      filters.forEach(button => button.setAttribute('aria-pressed', String(active[button.dataset.filterKey] === button.dataset.filterValue)));
      if (empty) empty.hidden = count > 0;
      let next = initial && records.get(root.dataset.defaultItem)?.visible ? root.dataset.defaultItem : selected;
      if (!records.get(next)?.visible) next = firstVisible()?.id || null;
      select(next, !initial);
    }
    function restoreFilters(initial = false) {
      const params = currentURL().searchParams;
      ['theater', 'domain'].forEach(key => { const value = params.get(key) || ''; active[key] = allowedValues[key].has(value) ? value : ''; });
      applyFilters(initial);
    }
    function updateFilterURL() {
      const url = currentURL();
      ['theater', 'domain'].forEach(key => { if (active[key]) url.searchParams.set(key, active[key]); else url.searchParams.delete(key); });
      writeURL(url);
    }
    root.addEventListener('click', event => {
      let target = event.target.closest('button, a');
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (target?.matches('[data-filter]')) {
        const key = target.dataset.filterKey, value = target.dataset.filterValue;
        if (!(key in active)) return;
        active[key] = active[key] === value ? '' : value;
        applyFilters(); updateFilterURL();
      } else if (target?.matches('[data-clear-filters]')) {
        active.theater = ''; active.domain = ''; applyFilters(); updateFilterURL();
      } else if (target?.matches('[data-zoom]')) {
        zoom = Math.max(1, Math.min(2, zoom + (target.dataset.zoom === 'in' ? .5 : -.5))); renderCanvas();
      } else if (target?.matches('[data-marker], [data-offmap-item], [data-select-item], [data-group-choice]')) {
        let id = target.dataset.item;
        if (target.matches('[data-marker]')) {
          if (event.detail > 0) {
            let nearest = Infinity;
            groups.forEach(group => {
              if (group.el.disabled) return;
              const r = group.el.getBoundingClientRect();
              if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) return;
              const distance = (event.clientX - r.left - r.width / 2) ** 2 + (event.clientY - r.top - r.height / 2) ** 2;
              if (distance < nearest) { nearest = distance; target = group.el; }
            });
          }
          const members = visibleMembers(groups.find(group => group.el === target));
          if (!members.length) return;
          const index = members.findIndex(item => item.id === selected);
          id = members[index < 0 ? 0 : (index + 1) % members.length].id;
          target.focus({ preventScroll: true });
        }
        const item = records.get(id);
        if (!item?.visible || target.disabled) return;
        if (target.matches('[data-select-item]') && selected === id) return;
        event.preventDefault();
        select(id, !target.matches('[data-select-item]'));
      } else if (stage?.contains(event.target) && !event.target.closest('[data-popup], [data-offmap], [data-zoom],.map-legend')) select(null);
    });
    root.addEventListener('keydown', event => {
      const trigger = event.target.closest('[data-marker]');
      if (trigger && event.key === 'ArrowDown') {
        const link = records.get(selected)?.popup?.querySelector('a[href]');
        if (link && !records.get(selected).popup.hidden) { event.preventDefault(); link.focus(); }
      }
    });
    restoreFilters(true);
    return { restore: () => restoreFilters(), resize: placePopup, close: () => {
      const item = records.get(selected);
      if (doc.activeElement?.closest('[data-popup]')) item?.marker?.focus({ preventScroll: true });
      select(null);
    } };
  }

  function setupArchive() {
    const input = one('[data-archive-search]');
    if (!input) return null;
    const rows = all('[data-archive-row]'), groups = all('[data-archive-month]');
    const status = one('[data-search-status]'), empty = one('[data-search-empty]');
    const normalize = value => value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim();
    const searchText = new Map(rows.map(row => [row, normalize(row.dataset.search || '')]));
    function apply(updateURL = false) {
      const query = input.value.trim(), terms = normalize(query).split(' ').filter(Boolean);
      let visible = 0;
      rows.forEach(row => {
        row.hidden = !terms.every(term => searchText.get(row).includes(term));
        if (!row.hidden) visible++;
      });
      groups.forEach(group => { group.hidden = !all('[data-archive-row]', group).some(row => !row.hidden); });
      if (status) status.textContent = query ? `找到 ${visible} 期` : `共 ${visible} 期`;
      if (empty) empty.hidden = visible > 0;
      if (updateURL) {
        const url = currentURL();
        if (query) url.searchParams.set('q', query);
        else url.searchParams.delete('q');
        writeURL(url);
      }
    }
    function restore() { input.value = currentURL().searchParams.get('q') || ''; apply(); }
    input.addEventListener('input', () => apply(true));
    input.form?.addEventListener('submit', event => { event.preventDefault(); apply(true); });
    restore();
    return { restore };
  }

  try {
    const maps = all('[data-map]').map(setupMap), archive = setupArchive();
    refreshMaps = () => maps.forEach(map => map.resize());
    modeButtons.forEach(button => button.addEventListener('click', () => {
      const mode = button.dataset.modeButton;
      if (!['brief', 'full'].includes(mode)) return;
      setMode(mode, true, true);
      const url = currentURL();
      if (mode === 'full') url.hash = 'full';
      else if (url.hash === '#full' || isItemHash(url.hash)) url.hash = '';
      writeURL(url, true);
    }));
    doc.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !modeButtons.length) return;
      const anchor = event.target.closest('a[href]');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || (!isItemHash(url.hash) && url.hash !== '#full')) return;
      event.preventDefault();
      setMode('full'); writeURL(url, true);
      requestAnimationFrame(() => {
        if (url.hash === '#full') doc.getElementById('full')?.scrollIntoView({ block: 'start', behavior: behavior() });
        else showTarget();
      });
    });
    const restore = () => { restoreMode(); maps.forEach(map => map.restore()); archive?.restore(); };
    window.addEventListener('popstate', restore);
    window.addEventListener('hashchange', () => restoreMode(true));
    window.addEventListener('resize', () => maps.forEach(map => map.resize()));
    doc.fonts?.ready.then(refreshMaps);
    doc.fonts?.addEventListener('loadingdone', refreshMaps);
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(refreshMaps);
      all('[data-map-stage], [data-popup]').forEach(el => observer.observe(el));
    }
    doc.addEventListener('keydown', event => { if (event.key === 'Escape') maps.forEach(map => map.close()); });
    restoreMode();
    html.classList.add('js');
    requestAnimationFrame(() => maps.forEach(map => map.resize()));
  } catch (error) {
    html.classList.remove('js');
    all('[data-feed-row], [data-archive-row], [data-archive-month]').forEach(element => { element.hidden = false; });
    all('[data-marker], [data-offmap-item]').forEach(element => { element.disabled = false; element.classList.remove('is-filtered'); });
    all('[data-popup], [data-mobile-item], [data-empty], [data-search-empty]').forEach(element => { element.hidden = true; });
    console.error('页面增强未启用，已保留完整静态内容。', error);
  }
})();

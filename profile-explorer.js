/* Unified, paginated profile explorer. Scoring remains owned by the existing profile engine. */
(() => {
  'use strict';
  const PAGE_SIZE = 30;
  const TYPES = ['ideology', 'party', 'figure', 'user'];
  const TYPE_LABELS = { ideology: 'Ideologia', party: 'Partia', figure: 'Figura polityczna', user: 'Użytkownik' };
  const TYPE_ICONS = { ideology: '◈', party: '▣', figure: '◉', user: '●' };
  const root = () => document.querySelector('#results-rankings .ideologies-parties-container');
  const state = { category: 'all', perspective: 'closest', sort: 'score-desc', query: '', view: 'cards', page: 1, selected: new Set(), profiles: [], revision: 0 };
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pl');
  const hasScore = profile => profile.percent !== null && profile.percent !== undefined && profile.percent !== '' && Number.isFinite(Number(profile.percent));
  const safeLogo = profile => profile.logo || (profile.avatar ? `images/IUsers/${profile.avatar}` : 'images/ALogo.svg');

  function profileItems() {
    const data = window.getPoliticalProfiles?.() || window.politicalProfiles || {};
    const answers = window.getCurrentUserAnswers?.() || window.userAnswers || [];
    const list = [];
    for (const type of ['ideology', 'party', 'figure']) {
      const key = type === 'ideology' ? 'ideologies' : type === 'party' ? 'parties' : 'figures';
      const modernScores = window.isModernProfileMatching?.() && typeof window.getModernRanking === 'function' ? new Map(window.getModernRanking(type).map(item => [item.name, item])) : new Map();
      for (const profile of Array.isArray(data[key]) ? data[key] : []) {
        const score = modernScores.get(profile.name) || window.compareAnswersToReferenceProfile?.(answers, profile);
        list.push({ ...profile, ...modernScores.get(profile.name), type, id: `${type}:${profile.key || profile.id || profile.name}`, percent: score?.percent ?? null, compared: score?.compared || score?.involved || 0 });
      }
    }
    const userRanks = typeof window.getUserRankingItems === 'function' ? window.getUserRankingItems() : [];
    for (const user of userRanks) {
      const p = user.profile || user;
      list.push({ ...p, ...user, type: 'user', id: `user:${p.key || p.id || p.name}`, name: user.name || p.name, percent: user.percent, compared: user.involved || 0, logo: user.logo || p.logo || (user.avatar ? `images/IUsers/${user.avatar}` : '') });
    }
    const unique = new Map();
    list.forEach(item => { if (item.name && !unique.has(item.id)) unique.set(item.id, item); });
    return [...unique.values()];
  }

  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function openProfile(profile) {
    if (typeof window.showModernProfilePopup === 'function' && profile.type !== 'user') return window.showModernProfilePopup(profile);
    if (profile.type === 'party' && typeof window.showPartyPopup === 'function') return window.showPartyPopup(profile.name, profile.description || '');
    if (profile.type === 'ideology' && typeof window.showIdeologyPopup === 'function') return window.showIdeologyPopup(profile.name, profile.description || '');
    if (typeof window.showModernProfilePopup === 'function') return window.showModernProfilePopup(profile);
    window.showPopup?.(`${profile.name}\n\n${profile.description || 'Brak opisu.'}`);
  }
  function filtered() {
    let rows = state.profiles.filter(p => state.category === 'all' || p.type === state.category);
    const q = norm(state.query);
    if (q) rows = rows.filter(p => norm(`${p.name} ${TYPE_LABELS[p.type]} ${(p.tags || []).join(' ')}`).includes(q));
    if (state.perspective === 'closest') rows = rows.filter(hasScore).sort((a, b) => b.percent - a.percent);
    else if (state.perspective === 'different') rows = rows.filter(hasScore).sort((a, b) => a.percent - b.percent);
    else if (state.sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    else if (state.sort === 'score-asc') rows.sort((a, b) => (a.percent ?? -1) - (b.percent ?? -1));
    else rows.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
    return rows;
  }
  function avatar(profile) {
    const image = make('img', 'profile-explorer-avatar');
    image.src = safeLogo(profile); image.alt = ''; image.loading = 'lazy';
    image.addEventListener('error', () => { image.src = 'images/ALogo.svg'; }, { once: true });
    return image;
  }
  function card(profile) {
    const card = make('article', `profile-explorer-card type-${profile.type}`);
    const select = make('input', 'profile-explorer-select'); select.type = 'checkbox'; select.checked = state.selected.has(profile.id); select.setAttribute('aria-label', `Wybierz ${profile.name} do porównania`);
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('change', () => { select.checked ? state.selected.add(profile.id) : state.selected.delete(profile.id); updateCompare(); });
    const open = make('button', 'profile-explorer-open'); open.type = 'button'; open.setAttribute('aria-label', `Szczegóły profilu: ${profile.name}`);
    const top = make('span', 'profile-explorer-card-top'); top.append(make('span', 'profile-explorer-category', `${TYPE_ICONS[profile.type]} ${TYPE_LABELS[profile.type]}`), select);
    const identity = make('span', 'profile-explorer-identity'); identity.append(avatar(profile));
    const labels = make('span', 'profile-explorer-labels'); labels.append(make('strong', 'profile-explorer-name', profile.name), make('small', '', (profile.tags || []).slice(0, 2).join(' · ') || profile.description || 'Otwórz szczegóły profilu'));
    identity.append(labels);
    const score = make('span', 'profile-explorer-score');
    score.append(make('strong', '', hasScore(profile) ? `${Math.round(profile.percent)}%` : '—'), make('small', '', 'zgodności'));
    const meter = make('span', 'profile-explorer-meter'); const fill = make('span'); fill.style.width = `${Math.max(0, Math.min(100, Number(profile.percent) || 0))}%`; meter.append(fill);
    open.append(top, identity, score, meter); open.addEventListener('click', () => openProfile(profile)); card.append(open);
    return card;
  }
  function updateCompare() {
    const button = document.querySelector('.profile-explorer-compare');
    if (!button) return;
    button.disabled = state.selected.size < 2;
    button.textContent = `Porównaj wybrane (${state.selected.size})`;
  }
  function toolbar(host) {
    const bar = make('div', 'profile-explorer-toolbar');
    const search = make('input', 'profile-explorer-search'); search.type = 'search'; search.placeholder = 'Szukaj profilu lub tagu…'; search.setAttribute('aria-label', 'Szukaj profilu'); search.value = state.query;
    search.addEventListener('input', () => { state.query = search.value; state.page = 1; renderResults(host); });
    const category = make('select', 'profile-explorer-category-select'); category.setAttribute('aria-label', 'Kategoria profili');
    [['all', 'Wszystkie kategorie'], ...TYPES.map(type => [type, TYPE_LABELS[type]])].forEach(([value, name]) => { const opt = make('option', '', name); opt.value = value; category.append(opt); }); category.value = state.category;
    category.addEventListener('change', () => { state.category = category.value; state.page = 1; renderResults(host); });
    const perspective = make('select', 'profile-explorer-perspective'); perspective.setAttribute('aria-label', 'Perspektywa rankingu');
    [['closest', 'Największa zgodność'], ['different', 'Największa niezgodność'], ['spectrum', 'Pełne spektrum'], ['custom', 'Własne sortowanie']].forEach(([value, name]) => { const opt = make('option', '', name); opt.value = value; perspective.append(opt); }); perspective.value = state.perspective;
    perspective.addEventListener('change', () => { state.perspective = perspective.value; state.page = 1; renderResults(host); });
    const sort = make('select', 'profile-explorer-sort'); sort.setAttribute('aria-label', 'Sortuj profile');
    [['score-desc', 'Zgodność: od najwyższej'], ['score-asc', 'Zgodność: od najniższej'], ['name', 'Nazwa: A–Z']].forEach(([value, name]) => { const opt = make('option', '', name); opt.value = value; sort.append(opt); }); sort.value = state.sort;
    sort.addEventListener('change', () => { state.sort = sort.value; state.perspective = 'custom'; perspective.value = 'custom'; state.page = 1; renderResults(host); });
    const details = make('details', 'profile-explorer-filters'); const summary = make('summary', '', 'Filtry i sortowanie');
    const options = make('div', 'profile-explorer-filter-options'); options.append(perspective, sort); details.append(summary, options);
    const view = make('div', 'profile-explorer-view-switch');
    [['cards', 'Karty'], ['map', 'Mapa']].forEach(([value, title]) => { const b = make('button', '', title); b.type = 'button'; b.setAttribute('aria-pressed', String(state.view === value)); b.addEventListener('click', () => { state.view = value; view.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderResults(host); }); view.append(b); });
    const compare = make('button', 'profile-explorer-compare', `Porównaj wybrane (${state.selected.size})`); compare.type = 'button'; compare.disabled = state.selected.size < 2;
    compare.addEventListener('click', () => { const params = new URLSearchParams(); params.set('profiles', [...state.selected].join(',')); location.href = `comparison.html?${params}`; });
    bar.append(search, category, details, view, compare); return bar;
  }
  function renderMap(host, rows) {
    const stage = make('div', 'profile-explorer-map');
    const legend = make('div', 'profile-explorer-legend');
    TYPES.forEach(type => { const label = make('label'); const toggle = make('input'); toggle.type = 'checkbox'; toggle.checked = true; toggle.dataset.type = type; label.append(toggle, make('span', `legend-${type}`, `${TYPE_ICONS[type]} ${TYPE_LABELS[type]}`)); legend.append(label); });
    const viewport = make('div', 'profile-explorer-map-viewport'); viewport.setAttribute('role', 'img'); viewport.setAttribute('aria-label', 'Mapa punktowa profili. Odległości pokazują położenie na kompasie i nie stanowią wyniku zgodności.');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '-110 -110 220 220'); svg.setAttribute('class', 'profile-explorer-scatter');
    const axes = document.createElementNS(svg.namespaceURI, 'g'); axes.setAttribute('class', 'scatter-axes');
    [['line', {x1:-100,y1:0,x2:100,y2:0}], ['line',{x1:0,y1:-100,x2:0,y2:100}], ['circle',{cx:0,cy:0,r:100}]].forEach(([tag, attrs]) => { const node = document.createElementNS(svg.namespaceURI, tag); Object.entries(attrs).forEach(([k,v]) => node.setAttribute(k,String(v))); axes.append(node); }); svg.append(axes);
    const nodes = [];
    let revision = ++state.revision;
    const coordsFn = window.getEntityCoordinates;
    Promise.all(rows.map(async p => {
      let coords = null;
      try { if (typeof coordsFn === 'function') coords = await coordsFn(p.key || p.name, p.type); } catch (_) {}
      return { p, x: Number(coords?.x) || 0, y: Number(coords?.y) || 0 };
    })).then(points => {
      if (revision !== state.revision || !svg.isConnected) return;
      points.forEach(({p,x,y}) => {
        const g = document.createElementNS(svg.namespaceURI, 'g'); g.setAttribute('class', `scatter-point point-${p.type}`); g.setAttribute('transform', `translate(${Math.max(-95,Math.min(95,x*9.5))} ${Math.max(-95,Math.min(95,-y*9.5))})`); g.dataset.type = p.type;
        const circle = document.createElementNS(svg.namespaceURI, 'circle'); circle.setAttribute('r', p.type === 'user' ? '2.5' : '2'); g.append(circle);
        const title = document.createElementNS(svg.namespaceURI, 'title'); title.textContent = `${p.name} · ${TYPE_LABELS[p.type]} · ${hasScore(p) ? `${Math.round(p.percent)}% zgodności` : 'brak wyniku'}`; g.append(title);
        g.setAttribute('tabindex','0'); g.setAttribute('role','button'); g.setAttribute('aria-label', title.textContent); g.addEventListener('click', () => openProfile(p)); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(p); } }); svg.append(g); nodes.push(g);
      });
      const mePoint=window.currentUserCoords||{x:0,y:0};
      const me = document.createElementNS(svg.namespaceURI, 'g'); me.setAttribute('class','scatter-point point-me'); me.setAttribute('transform',`translate(${Math.max(-95,Math.min(95,(Number(mePoint.x)||0)*9.5))} ${Math.max(-95,Math.min(95,-(Number(mePoint.y)||0)*9.5))})`); const mc = document.createElementNS(svg.namespaceURI,'circle'); mc.setAttribute('r','4'); me.append(mc); const mt = document.createElementNS(svg.namespaceURI,'title'); mt.textContent='Twój profil'; me.append(mt); svg.append(me);
    });
    legend.addEventListener('change', e => { if (e.target.matches('input')) nodes.filter(n => n.dataset.type === e.target.dataset.type).forEach(n => n.hidden = !e.target.checked); });
    let scale = 1, panX = 0, panY = 0, drag = null;
    const apply = () => svg.style.transform = `translate(${panX}px,${panY}px) scale(${scale})`;
    viewport.addEventListener('wheel', e => { e.preventDefault(); scale = Math.max(.7,Math.min(4,scale * (e.deltaY < 0 ? 1.12 : .89))); apply(); }, {passive:false});
    viewport.addEventListener('pointerdown', e => { if (e.target.closest('.scatter-point')) return; drag = [e.clientX-panX,e.clientY-panY]; viewport.setPointerCapture(e.pointerId); });
    viewport.addEventListener('pointermove', e => { if (!drag) return; panX=e.clientX-drag[0]; panY=e.clientY-drag[1]; apply(); });
    viewport.addEventListener('pointerup', () => { drag=null; });
    const search = make('input','profile-explorer-map-search'); search.type='search'; search.placeholder='Znajdź profil na mapie…'; search.setAttribute('aria-label','Szukaj profilu na mapie');
    const searchResults=make('div','profile-explorer-map-search-results');
    const updateSearch = () => {
      const q=norm(search.value); nodes.forEach(n => { const match=norm(n.getAttribute('aria-label')).includes(q); n.classList.toggle('is-search-match',!!q&&match); });
      searchResults.replaceChildren();
      if(!q)return;
      rows.filter(p=>norm(`${p.name} ${TYPE_LABELS[p.type]}`).includes(q)).slice(0,8).forEach(p=>{
        const row=make('label','profile-explorer-map-search-result'); const check=make('input');check.type='checkbox';check.checked=state.selected.has(p.id);check.setAttribute('aria-label',`Wybierz ${p.name} do porównania`);
        check.addEventListener('change',()=>{check.checked?state.selected.add(p.id):state.selected.delete(p.id);updateCompare();});
        row.append(check,avatar(p),make('span','',`${p.name} · ${TYPE_LABELS[p.type]}`));
        const open=make('button','','Szczegóły');open.type='button';open.addEventListener('click',()=>openProfile(p));row.append(open);searchResults.append(row);
      });
      if(!searchResults.childElementCount)searchResults.append(make('span','','Nie znaleziono profilu.'));
    };
    search.addEventListener('input',updateSearch);
    stage.append(search, searchResults, legend, viewport); viewport.append(svg);
    return stage;
  }
  function renderResults(host) {
    const rows = filtered();
    host.querySelector('.profile-explorer-results')?.remove();
    const result = make('div','profile-explorer-results');
    const status = make('p','profile-explorer-status',`Profile: ${rows.length} · Mapa pokazuje położenie na kompasie; procent zgodności pochodzi z algorytmu testu.`); result.append(status);
    if (state.view === 'map') result.append(renderMap(host, rows));
    else {
      const grid = make('div','profile-explorer-grid');
      const shown = rows.slice(0, state.page * PAGE_SIZE); shown.forEach(p => grid.append(card(p)));
      result.append(grid);
      if (shown.length < rows.length) { const more = make('button','profile-explorer-more','Pokaż kolejne profile'); more.type='button'; more.addEventListener('click',()=>{state.page++;renderResults(host);}); result.append(more); }
    }
    const note=make('p','profile-explorer-user-note');note.append(document.createTextNode('Chcesz dołączyć do publicznego rankingu użytkowników? '));
    const mail=make('a','','Napisz do autora');mail.href='mailto:autystykx@gmail.com';note.append(mail);result.append(note);
    host.append(result);
  }
  function mount() {
    const host = root(); if (!host) return;
    state.profiles = profileItems();
    host.classList.add('has-profile-explorer');
    host.querySelector('.profile-explorer-toolbar')?.remove();
    host.prepend(toolbar(host)); renderResults(host);
  }
  document.addEventListener('neoAutystykResultsReady', mount);
  document.addEventListener('DOMContentLoaded', () => { if (document.querySelector('#results-container')?.style.display !== 'none') mount(); });
})();

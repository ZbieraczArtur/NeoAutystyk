(() => {
  'use strict';

  const TYPES = { party: 'parties', ideology: 'ideologies', figure: 'figures', user: 'users' };
  const TYPE_LABEL = { party: 'Partie', ideology: 'Ideologie', figure: 'Postacie', user: 'Użytkownicy' };
  const TYPE_SINGULAR = { party: 'Partia polityczna', ideology: 'Ideologia', figure: 'Postać polityczna', user: 'Profil użytkownika' };
  const LABELS = {
    party: { intro: 'Wprowadzenie i geneza', history: 'Historia partii', program: 'Ideologia, program i postulaty', elections: 'Działalność wyborcza i parlamentarna', government: 'Udział w rządzeniu i realizacja programu', opposition: 'Działalność opozycyjna', politicians: 'Kierownictwo, frakcje i najważniejsi politycy' },
    ideology: { intro: 'Wstęp', history: 'Geneza i rozwój historyczny', values: 'Główne założenia i postulowany porządek społeczny', currents: 'Główne nurty i spory wewnętrzne', impact: 'Wpływ na praktykę polityczną', representatives: 'Najważniejsi przedstawiciele', organizations: 'Partie i organizacje', readings: 'Najważniejsze teksty i literatura', terms: 'Glosariusz i kluczowe pojęcia' },
    figure: { intro: 'Wprowadzenie', history: 'Historia', views: 'Poglądy', publicActivity: 'Działalność publiczna', readings: 'Lektury', legacy: 'Dziedzictwo', quotes: 'Cytaty' }
  };
  const FIELD_LABEL = { birth: 'Data urodzenia', birthdate: 'Data urodzenia', born: 'Data urodzenia', death: 'Data śmierci', deathdate: 'Data śmierci', died: 'Data śmierci', country: 'Kraj', founded: 'Data założenia', headquarters: 'Siedziba', leader: 'Lider', ideology: 'Ideologia', status: 'Status', type: 'Typ', party: 'Partia', name: 'Nazwa', website: 'Strona internetowa' };
  const $ = selector => document.querySelector(selector);
  const root = $('#album-grid');
  const dialog = $('#profile-dialog');
  const view = $('#profile-view');
  const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true });
  const selectedTags = new Map();
  let db = null;
  let active = 'party';
  let activeTagTab = null;
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem('neoAutystykFavorites') || '[]')); } catch (_) { /* local storage can be unavailable */ }

  const profiles = () => db?.[TYPES[active]] || [];
  const allProfiles = () => Object.values(TYPES).flatMap(key => db?.[key] || []);
  const profileId = profile => String(profile.id || profile.key || profile.name);
  const humanize = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  const fieldLabel = value => FIELD_LABEL[humanize(value).toLowerCase().replace(/\s/g, '')] || humanize(value).replace(/^./, character => character.toLocaleUpperCase('pl'));
  const profileTags = profile => {
    const info = Object.values(profile.infobox || {}).flatMap(value => Array.isArray(value) ? value : [value]);
    return [...(profile.tags || []), ...info, profile.country, profile.ideology, profile.religion].filter(Boolean).map(String);
  };
  const make = (tag, className, content) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  };

  function image(profile, className) {
    const initial = (profile.name || '?').trim().slice(0, 1).toLocaleUpperCase('pl');
    if (!profile.logo) return make('div', `profile-placeholder ${className || ''}`, initial);
    const img = document.createElement('img');
    img.className = className || '';
    img.src = profile.logo;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => img.replaceWith(make('div', `profile-placeholder ${className || ''}`, initial)), { once: true });
    return img;
  }

  function dateValue(profile) {
    const info = profile.infobox || {};
    const candidates = [profile.date, profile.founded, profile.foundationDate, profile.established, profile.birthDate, profile.birthdate, profile.born, info.birthDate, info.birthdate, info.born, info.founded, info.foundationDate, info.established];
    for (const value of candidates) {
      const match = String(value || '').match(/(?:^|\D)((?:1[0-9]{3}|20[0-9]{2}))(?:\D|$)/);
      if (match) return Number(match[1]);
    }
    return null;
  }

  function dateDescription(profile) {
    const info = profile.infobox || {};
    const source = profile.birthDate || profile.birthdate || profile.born || info.birthDate || info.birthdate || info.born || profile.founded || profile.foundationDate || profile.established || info.founded || info.foundationDate || info.established;
    if (!source) return '';
    return profile.type === 'figure' || profile.type === 'user' ? `ur. ${String(source).replace(/\s*r\.?(?=$|\s)/, '').trim()}` : String(source);
  }

  function tagGroups() {
    const catalog = window.NeoTagCatalog?.catalog || {};
    // Karty filtrów pokazują wyłącznie właściwe tagi, nie długie pola opisowe z infoboksu.
    const present = new Set(profiles().flatMap(profile => profile.tags || []));
    const groups = Object.entries(catalog)
      .map(([name, tags]) => [name, tags.filter(tag => present.has(tag))])
      .filter(([, tags]) => tags.length);
    const catalogTags = new Set(Object.values(catalog).flat());
    const others = [...present].filter(tag => !catalogTags.has(tag)).sort(collator.compare);
    if (others.length) groups.push(['Pozostałe', others]);
    return groups;
  }

  function selectedTagCount() { return [...selectedTags.values()].reduce((sum, tags) => sum + tags.size, 0); }
  function matchesSelectedTags(profile) {
    const ownTags = new Set(profileTags(profile));
    return [...selectedTags.values()].every(tags => !tags.size || [...tags].some(tag => ownTags.has(tag)));
  }

  function renderTags() {
    const groups = tagGroups();
    const tabs = $('#album-tag-tabs');
    const choices = $('#album-tags');
    const status = $('#tag-filter-status');
    const clear = $('#clear-tags');
    tabs.replaceChildren(); choices.replaceChildren();
    if (!groups.length) {
      activeTagTab = null;
      choices.append(make('p', 'tag-empty', 'Brak tagów dla tej kategorii.'));
      status.textContent = 'Ta kategoria nie ma jeszcze tagów.';
      clear.disabled = true;
      return;
    }
    if (!groups.some(([name]) => name === activeTagTab)) activeTagTab = groups[0][0];
    groups.forEach(([name, tags]) => {
      const button = make('button', 'tag-tab', name);
      button.type = 'button';
      button.setAttribute('role', 'tab');
      const isActive = name === activeTagTab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      const chosen = selectedTags.get(name)?.size || 0;
      if (chosen) button.append(make('span', 'tag-tab-count', String(chosen)));
      button.onclick = () => { activeTagTab = name; renderTags(); };
      tabs.append(button);
      if (!isActive) return;
      const selected = selectedTags.get(name) || new Set();
      tags.forEach(tag => {
        const chip = make('button', 'tag-chip', tag);
        chip.type = 'button';
        const isSelected = selected.has(tag);
        chip.classList.toggle('active', isSelected);
        chip.setAttribute('aria-pressed', String(isSelected));
        chip.onclick = () => {
          const next = new Set(selectedTags.get(name) || []);
          next.has(tag) ? next.delete(tag) : next.add(tag);
          next.size ? selectedTags.set(name, next) : selectedTags.delete(name);
          renderTags(); renderGrid();
        };
        choices.append(chip);
      });
    });
    const count = selectedTagCount();
    status.textContent = count ? `${count} ${count === 1 ? 'aktywny tag' : 'aktywne tagi'} · zakładki łączą się ze sobą.` : 'Wybierz tagi w zakładkach. W jednej zakładce możesz wybrać kilka opcji.';
    clear.disabled = !count;
  }

  function filtered() {
    const query = $('#album-search').value.trim().toLocaleLowerCase('pl');
    const imageOnly = $('#album-with-image').checked;
    const favoritesOnly = $('#album-favorites-only').checked;
    const sort = $('#album-sort').value;
    const result = profiles().filter(profile => {
      const haystack = [profile.name, profile.description, ...profileTags(profile)].join(' ').toLocaleLowerCase('pl');
      return (!query || haystack.includes(query)) && (!imageOnly || profile.logo) && (!favoritesOnly || favorites.has(profileId(profile))) && matchesSelectedTags(profile);
    });
    result.sort((a, b) => {
      if (sort === 'name') return collator.compare(a.name, b.name);
      const first = dateValue(a); const second = dateValue(b);
      if (first === null && second === null) return collator.compare(a.name, b.name);
      if (first === null) return 1;
      if (second === null) return -1;
      const order = sort === 'date-desc' ? second - first : first - second;
      return order || collator.compare(a.name, b.name);
    });
    return result;
  }

  function toggleFavorite(profile, button) {
    const id = profileId(profile);
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    localStorage.setItem('neoAutystykFavorites', JSON.stringify([...favorites]));
    const saved = favorites.has(id);
    button.classList.toggle('saved', saved);
    button.textContent = saved ? '♥' : '♡';
    button.setAttribute('aria-label', saved ? 'Usuń z zapisanych' : 'Zapisz profil');
    button.setAttribute('aria-pressed', String(saved));
    if ($('#album-favorites-only').checked) renderGrid();
  }

  function renderGrid() {
    const list = filtered();
    const sort = $('#album-sort').value;
    $('#album-count').textContent = `${list.length} ${list.length === 1 ? 'profil' : 'profili'} · ${TYPE_LABEL[active].toLocaleLowerCase('pl')}`;
    $('#album-order-note').textContent = sort === 'date-asc' ? 'Od najstarszej dostępnej daty' : sort === 'date-desc' ? 'Od najnowszej dostępnej daty' : '';
    root.replaceChildren();
    if (!list.length) { root.append(make('p', 'album-empty', 'Nie znaleziono profili. Zmień wyszukiwanie lub filtry.')); return; }
    list.forEach(profile => {
      const card = make('article', 'profile-card');
      const open = document.createElement('button');
      open.type = 'button'; open.className = 'profile-card-main';
      open.setAttribute('aria-label', `Otwórz profil: ${profile.name}`);
      const media = make('div', 'profile-card-media'); media.append(image(profile, 'profile-card-image'));
      const body = make('div', 'profile-card-body');
      body.append(make('span', 'profile-card-type', TYPE_SINGULAR[profile.type] || TYPE_SINGULAR[active]), make('strong', 'profile-card-name', profile.name));
      const meta = dateDescription(profile) || (profile.tags || []).slice(0, 2).join(' · ') || TYPE_LABEL[active];
      body.append(make('small', 'profile-card-meta', meta));
      open.append(media, body); open.onclick = () => openProfile(profileId(profile));
      const favorite = make('button', 'profile-favorite', favorites.has(profileId(profile)) ? '♥' : '♡');
      favorite.type = 'button'; favorite.classList.toggle('saved', favorites.has(profileId(profile)));
      favorite.setAttribute('aria-pressed', String(favorites.has(profileId(profile))));
      favorite.setAttribute('aria-label', favorites.has(profileId(profile)) ? 'Usuń z zapisanych' : 'Zapisz profil');
      favorite.onclick = () => toggleFavorite(profile, favorite);
      card.append(open, favorite); root.append(card);
    });
  }

  function openProfile(id) {
    const profile = allProfiles().find(item => profileId(item) === id);
    if (!profile) return;
    view.replaceChildren(); view.className = 'profile-full';
    const hero = make('header', 'profile-hero');
    const heroMedia = make('div', 'profile-hero-media'); heroMedia.append(image(profile, 'profile-hero-image'));
    const heroCopy = make('div', 'profile-hero-copy');
    heroCopy.append(make('p', 'profile-type', TYPE_SINGULAR[profile.type] || 'Profil'), make('h1', '', profile.name));
    heroCopy.querySelector('h1').id = 'profile-title';
    if (profile.description) heroCopy.append(make('p', 'profile-description', profile.description));
    const actions = make('nav', 'profile-actions'); actions.setAttribute('aria-label', 'Akcje profilu');
    const key = encodeURIComponent(profile.key || profile.id || profile.name);
    const simulation = document.createElement('a'); simulation.href = `index.html?simulate=${key}`; simulation.target = '_blank'; simulation.rel = 'noopener'; simulation.textContent = 'Symuluj w teście ↗';
    const compare = document.createElement('a'); compare.href = `comparison.html?profile=${key}`; compare.target = '_blank'; compare.rel = 'noopener'; compare.textContent = 'Porównaj ↗';
    const copy = make('button', 'profile-copy-link', 'Kopiuj link'); copy.type = 'button';
    copy.onclick = async () => { const url = new URL(`album.html#${encodeURIComponent(profileId(profile))}`, location.href).href; try { await navigator.clipboard.writeText(url); copy.textContent = 'Skopiowano'; setTimeout(() => { copy.textContent = 'Kopiuj link'; }, 1600); } catch (_) { location.hash = encodeURIComponent(profileId(profile)); copy.textContent = 'Link w pasku adresu'; } };
    actions.append(simulation, compare, copy); heroCopy.append(actions); hero.append(heroMedia, heroCopy);
    const main = make('main', 'profile-main');
    const sections = LABELS[profile.type] || {};
    let sectionCount = 0;
    Object.entries(sections).forEach(([field, label]) => {
      if (typeof profile[field] !== 'string' || !profile[field].trim()) return;
      const block = make('section', 'profile-block'); block.append(make('h2', '', label), make('p', '', profile[field])); main.append(block); sectionCount += 1;
    });
    if (!sectionCount) main.append(make('p', 'album-empty', 'Ten profil nie ma jeszcze rozwiniętych sekcji.'));
    const aside = make('aside', 'profile-infobox');
    const info = profile.infobox && typeof profile.infobox === 'object' ? Object.entries(profile.infobox).filter(([, value]) => value !== null && value !== undefined && String(value).trim()) : [];
    if (info.length) {
      aside.append(make('h2', 'infobox-title', 'Najważniejsze informacje'));
      const dl = document.createElement('dl');
      info.forEach(([field, value]) => dl.append(make('dt', '', fieldLabel(field)), make('dd', '', String(value))));
      aside.append(dl);
    } else aside.append(make('p', 'album-hint', 'Brak dodatkowych informacji.'));
    const layout = make('div', 'profile-layout'); layout.append(main, aside);
    view.append(hero, layout);
    location.hash = encodeURIComponent(profileId(profile));
    dialog.scrollTop = 0; dialog.showModal();
  }

  function setType(type) {
    active = type; selectedTags.clear(); activeTagTab = null;
    document.querySelectorAll('[data-type]').forEach(button => {
      const chosen = button.dataset.type === type;
      button.classList.toggle('active', chosen); button.setAttribute('aria-selected', String(chosen));
    });
    renderTags(); renderGrid();
  }

  document.querySelectorAll('[data-type]').forEach(button => { button.onclick = () => setType(button.dataset.type); });
  $('#album-search').addEventListener('input', renderGrid);
  $('#album-sort').addEventListener('change', renderGrid);
  $('#album-with-image').addEventListener('change', renderGrid);
  $('#album-favorites-only').addEventListener('change', renderGrid);
  $('#clear-tags').onclick = () => { selectedTags.clear(); renderTags(); renderGrid(); };
  $('.dialog-close').onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { history.replaceState(null, '', location.pathname); });

  window.loadPoliticalProfiles().then(data => {
    const enrichments = window.NeoProfileEnrichments || {};
    Object.values(TYPES).forEach(collection => (data[collection] || []).forEach(profile => {
      if (enrichments[profile.id]) Object.assign(profile, enrichments[profile.id]);
    }));
    db = data;
    const hash = decodeURIComponent(location.hash.slice(1));
    const profile = allProfiles().find(item => [profileId(item), item.id, item.key, item.name].includes(hash));
    if (profile) { active = profile.type; setType(active); openProfile(profileId(profile)); } else setType(active);
  }).catch(() => { root.textContent = 'Nie udało się wczytać bazy profili.'; });
})();

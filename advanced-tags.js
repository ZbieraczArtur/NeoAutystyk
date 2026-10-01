/* One shared taxonomy and predictable multi-criterion filtering for rankings,
 * compass overlays and the profile album.  Different tabs are ANDed; multiple
 * choices within the same tab are ORed. */
(function () {
  'use strict';
  const CATALOG = window.NeoTagCatalog?.catalog || Object.freeze({
    'Zawód / dziedzina': ['Filozof','Ekonomista','Polityk','Rewolucjonista','Wojskowy','Prawnik','Duchowny','Socjolog','Publicysta','Pisarz','Lekarz','Przedsiębiorca','Akademik','Planista','Politolog','Historyk','Działacz związkowy'],
    'Rola / urząd': ['Prezydent','Premier','Monarcha','Papież','Dyktator','Parlamentarzysta','Myśliciel społeczny','Kanclerz','Reformator','Założyciel partii/ruchu','Lider partii','Wiceprezydent / Zastępca szefa państwa','Minister','Dyplomata','Arystokrata','Dysydent','Samorządowiec'],
    'Narodowość': ['Amerykańska','Polska','Brytyjska','Niemiecka','Francuska','Rosyjska','Włoska','Austriacka','Ukraińska','Indyjska','Hiszpańska','Kanadyjska','Chińska','Holenderska','Argentyńska','Czeska','Izraelska','Australijska','Japońska','Chilijska','Inna'],
    'Status': ['Żyje','Martwy'],
    'Płeć': ['Kobieta','Mężczyzna'],
    'Okres życia': ['XVII wiek','XVIII wiek','XIX wiek','XX wiek','XX1 wiek'],
    'Ideologia': ['Liberalizm','Liberalizm klasyczny','Socjalliberalizm','Ordoliberalizm','Liberalizm gospodarczy','Libertarianizm','Anarchizm','Konserwatyzm','Chrześcijańska demokracja','Tradycjonalizm','Reakcjonizm','Fundamentalizm religijny','Agraryzm','Monarchizm','Republikanizm','Socjalizm','Socjalizm demokratyczny','Socjaldemokracja','Komunizm','Marksizm','Marksizm-Leninizm','Faszyzm','Nacjonalizm','Ekologizm','Korporacjonizm','Technokracja','Autorytaryzm','Demokracja'],
    'Kontynent działalności': ['Afryka','Ameryka Północna','Ameryka Południowa','Azja','Europa','Australia'],
    'Sposób dojścia do władzy / legitymizacja': ['Wybory demokratyczne','Zamach stanu / Coup','Dziedziczenie','Rewolucja','Nominacja / Kooptacja','Okupacja / Interwencja zewnętrzna'],
    'Religia': ['Chrześcijaństwo','Katolicyzm','Prawosławie','Protestantyzm','Islam','Sunnizm','Szyizm','Ibadizm','Hinduizm','Buddyzm','Judaizm','Judaizm ortodoksyjny','Sikhizm','Taoizm','Konfucjanizm','Islamizm']
  });
  const chosen = new Map();
  let activeTab = Object.keys(CATALOG)[0];

  function profileTags(profile) {
    const info = Object.values(profile?.infobox || {}).flatMap(value => Array.isArray(value) ? value : [value]);
    return new Set([...(profile?.tags || []), ...info, profile?.country, profile?.ideology, profile?.religion].filter(Boolean).map(String));
  }
  function match(profile) {
    const tags = profileTags(profile);
    return [...chosen].every(([, values]) => !values.size || [...values].some(value => tags.has(value)));
  }
  function count() { return [...chosen.values()].reduce((sum, values) => sum + values.size, 0); }
  function allProfiles() { return [...(politicalProfiles?.parties || []), ...(politicalProfiles?.ideologies || []), ...(politicalProfiles?.figures || []), ...(politicalProfiles?.users || [])]; }
  function findProfile(name) { return allProfiles().find(profile => [profile.name, profile.key, profile.id].includes(name)); }

  function refreshRankings() {
    document.querySelectorAll('.ranking-item').forEach(row => {
      const name = row.dataset.profileName || row.querySelector('.rank-name')?.textContent?.trim();
      const profile = findProfile(name);
      if (profile) row.hidden = !match(profile);
    });
    document.querySelectorAll('.ranking-section').forEach(section => {
      const rows = [...section.querySelectorAll('.ranking-item')];
      if (rows.length) section.classList.toggle('is-filtered-empty', count() > 0 && rows.every(row => row.hidden));
    });
  }

  async function coords(profile, type) {
    if (type !== 'figure') return getEntityCoordinates(profile.key || profile.name, type);
    const rows = parseExportCode(profile.exportCode || '').filter(row => !row.noteOnly && row.answerData);
    if (!rows.length) return null;
    const values = buildUserValuesMap(computeScoresForAnswers(rows, currentScoringMode).pairResults);
    return computeCoordinatesFromValues(values, currentCompassMode, currentCreativeConfig);
  }
  function enabled(type, modal) {
    const prefix = modal ? 'modal-' : '';
    return document.getElementById(`${prefix}toggle-${type === 'party' ? 'parties' : `${type}s`}`)?.checked;
  }
  async function renderOverlays(_parties, _ideologies, instance) {
    if (!instance?.clearOverlays || !politicalProfiles) return;
    instance.clearOverlays(); const modal = instance === window.modalCompassInstance;
    const collections = { party: politicalProfiles.parties || [], ideology: politicalProfiles.ideologies || [], user: politicalProfiles.users || [], figure: politicalProfiles.figures || [] };
    for (const [type, profiles] of Object.entries(collections)) {
      if (!enabled(type, modal)) continue;
      for (const profile of profiles) {
        if (!match(profile)) continue;
        const point = await coords(profile, type); if (!point) continue;
        const logo = profile.logo || (type === 'party' ? getPartyLogoUrl(profile.name) : type === 'ideology' ? getIdeologyLogoUrl(profile.name) : profile.avatar ? `images/IUsers/${profile.avatar}` : 'images/ALogo.svg');
        instance.addOverlay(logo, point.x, point.y, type, profile.name, profile.description || '');
      }
    }
  }
  function refresh() { refreshRankings(); renderOverlays(null, null, window.compassInstance); renderOverlays(null, null, window.modalCompassInstance); }

  function tabButton(label) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'advanced-tag-tab'; button.textContent = label;
    button.classList.toggle('active', label === activeTab); button.setAttribute('aria-selected', String(label === activeTab));
    button.onclick = () => { activeTab = label; renderControls(); };
    return button;
  }
  function renderControls() {
    const root = document.getElementById('compass-tag-filters'); if (!root) return;
    root.replaceChildren(); root.dataset.ready = 'true'; root.className = 'advanced-tag-filter';
    const heading = document.createElement('div'); heading.className = 'advanced-tag-heading'; heading.innerHTML = `<div><strong>Filtry profili i nakładek</strong><small>${count() ? `${count()} aktywne — zakładki łączą się ze sobą` : 'Wybierz tagi w dowolnych zakładkach'}</small></div>`;
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'advanced-tag-clear'; clear.textContent = 'Wyczyść'; clear.disabled = !count(); clear.onclick = () => { chosen.clear(); renderControls(); refresh(); }; heading.append(clear);
    const tabs = document.createElement('div'); tabs.className = 'advanced-tag-tabs'; tabs.setAttribute('role', 'tablist'); Object.keys(CATALOG).forEach(label => tabs.append(tabButton(label)));
    const choices = document.createElement('div'); choices.className = 'advanced-tag-choices'; const selected = chosen.get(activeTab) || new Set();
    CATALOG[activeTab].forEach(tag => { const button = document.createElement('button'); button.type = 'button'; button.className = 'advanced-tag-chip'; button.textContent = tag; button.classList.toggle('active', selected.has(tag)); button.setAttribute('aria-pressed', String(selected.has(tag))); button.onclick = () => { const values = chosen.get(activeTab) || new Set(); values.has(tag) ? values.delete(tag) : values.add(tag); values.size ? chosen.set(activeTab, values) : chosen.delete(activeTab); renderControls(); refresh(); }; choices.append(button); });
    root.append(heading, tabs, choices);
  }
  function bindToggles() { ['toggle-parties','toggle-ideologies','toggle-users','toggle-figures','modal-toggle-parties','modal-toggle-ideologies','modal-toggle-users','modal-toggle-figures'].forEach(id => document.getElementById(id)?.addEventListener('change', () => renderOverlays(null, null, id.startsWith('modal') ? window.modalCompassInstance : window.compassInstance))); }
  function start() {
    if (typeof politicalProfiles === 'undefined' || !politicalProfiles) return false;
    renderControls(); bindToggles();
    window.loadOverlays = renderOverlays;
    try { loadOverlays = renderOverlays; } catch (_) { /* app can call the window hook */ }
    refresh(); return true;
  }
  window.NeoTagCatalog = Object.assign(window.NeoTagCatalog || {}, { catalog: CATALOG, profileTags, matches: match });
  document.addEventListener('neoAutystykResultsReady', () => { renderControls(); refreshRankings(); });
  const timer = setInterval(() => { if (start()) clearInterval(timer); }, 100);
})();

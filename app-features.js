/* NeoAutystyk: landing page, profile tags, figures ranking and filtered compass overlays. */
(function () {
  'use strict';

  const TAG_CATALOG = {
    figures: {
      'Zawód / dziedzina': [
        'Filozof', 'Ekonomista', 'Polityk', 'Rewolucjonista',
        'Wojskowy', 'Prawnik', 'Przedsiębiorca', 'Duchowny',
        'Socjolog', 'Publicysta', 'Pisarz', 'Ekolog',
        'Akademik', 'Planista', 'Politolog', 'Historyk', 'Działacz związkowy'
      ],
      'Rola / urząd': [
        'Autokrata', 'Prezydent', 'Premier', 'Monarcha',
        'Papież', 'Dyktator', 'Parlamentarzysta',
        'Myśliciel społeczny', 'Kanclerz',
        'Reformator', 'Założyciel partii/ruchu', 'Lider partii',
        'Wiceprezydent / Zastępca szefa państwa', 'Dyplomata',
        'Arystokrata', 'Dysydent', 'Samorządowiec', 'Minister'
      ],
        'Narodowość': [
        'Amerykańska', 'Polska', 'Brytyjska', 'Niemiecka',
        'Francuska', 'Rosyjska', 'Włoska', 'Austriacka',
        'Ukraińska', 'Indyjska', 'Hiszpańska',
        'Kanadyjska', 'Chińska', 'Holenderska', 'Argentyńska',
        'Czeska', 'Izraelska', 'Australijska', 'Japońska',
        'Chilijska', "Inna"
      ],
      Status: ['Żyje', 'Martwy'],
      'Płeć': ['Kobieta', 'Mężczyzna'],
      'Okres życia': ['XVII wiek', 'XVIII wiek', 'XIX wiek', 'XX wiek', 'XXI wiek'],
      Ideologia: [
        'Liberalizm', 'Libertarianizm', 'Konserwatyzm', 'Socjalizm',
        'Komunizm', 'Faszyzm', 'Nacjonalizm', 'Monarchizm',
        'Anarchizm', 'Republikanizm',
        'Socjalliberalizm', 'Ordoliberalizm', 'Liberalizm gospodarczy',
        'Chrześcijańska demokracja', 'Tradycjonalizm', 'Agraryzm',
        'Socjaldemokracja', 'Ekologizm', 'Korporacjonizm',
        'Fundamentalizm religijny', 'Technokracja', 'Autorytaryzm'
      ],
      'Kontynent działalności': [
        'Afryka', 'Ameryka Północna', 'Ameryka Południowa',
        'Azja', 'Europa', 'Australia'
      ],
      'Sposób dojścia do władzy / legitymizacja': [
        'Wybory demokratyczne', 'Zamach stanu / Coup',
        'Dziedziczenie', 'Rewolucja', 'Nominacja / Kooptacja',
        'Okupacja / Interwencja zewnętrzna'
      ]
    },
    parties: { Status: ['Parlamentarne', 'Pozaparlamentarne'] },
    ideologies: {
      Kierunek: [
        'Lewicowe', 'Prawicowe', 'Centrowe', 'Liberalne',
        'Konserwatywne', 'Socjalistyczne', 'Libertariańskie',
        'Anarchistyczne', 'Monarchistyczne'

      ]
    }
  };
  const selectedTags = new Set();
  let showAllTags = true;
  const originalCreateRankingSection = window.createRankingSection || createRankingSection;
  const originalComputeAndDisplayResults = window.computeAndDisplayResults || computeAndDisplayResults;
  const originalLoadOverlays = window.loadOverlays || loadOverlays;

  function allProfiles() {
    return [
      ...(politicalProfiles?.parties || []),
      ...(politicalProfiles?.ideologies || []),
      ...(politicalProfiles?.users || []),
      ...(politicalProfiles?.figures || [])
    ];
  }
  const crossCategoryTags = new Set(['Parlamentarne', 'Pozaparlamentarne', 'Lewicowe', 'Prawicowe', 'Centrowe', 'Liberalne', 'Konserwatywne', 'Socjalistyczne', 'Libertariańskie', 'Anarchistyczne', 'Monarchistyczne']);
  function profileTags(profile) {
    const tags = Array.isArray(profile?.tags) ? profile.tags : [];
    return (profile?.type === 'figure' || profile?.type === 'user') ? tags.filter(tag => !crossCategoryTags.has(tag)) : tags;
  }
  function matchesSelectedTags(profile) { return showAllTags || [...selectedTags].every(tag => profileTags(profile).includes(tag)); }
  function findProfile(name) { return allProfiles().find(p => p.name === name || p.key === name || p.id === name); }
  function profileLogo(profile) { return profile?.logo || 'images/ALogo.svg'; }

  function decorateRanking(section, items, type) {
    const rows = section.querySelectorAll('.ranking-item');
    rows.forEach((row, index) => {
      const profile = items[index]?.profile || findProfile(items[index]?.name);
      if (!profile) return;
      row.dataset.profileName = profile.name;
      row.hidden = !matchesSelectedTags(profile);
      const tags = profileTags(profile);
      if (tags.length) {
        const tagsEl = document.createElement('div');
        tagsEl.className = 'profile-tags';
        tags.forEach(tag => { const el = document.createElement('span'); el.className = 'profile-tag'; el.textContent = tag; tagsEl.appendChild(el); });
        row.appendChild(tagsEl);
      }
      if (type === 'user') {
        row.querySelector('.friend-dot')?.remove();
        const image = document.createElement('img');
        image.src = profileLogo(profile); image.alt = `Avatar ${profile.name}`; image.className = 'user-logo-small';
        row.insertBefore(image, row.firstChild);
        row.addEventListener('click', event => {
          event.stopImmediatePropagation();
          window.showModernProfilePopup?.(profile);
        }, true);
      }
    });
    section.classList.toggle('is-filtered-empty', !!selectedTags.size && ![...rows].some(row => !row.hidden));
  }

  createRankingSection = function (title, items, type) {
    const section = originalCreateRankingSection(title, items, type);
    decorateRanking(section, items, type);
    return section;
  };
  window.createRankingSection = createRankingSection;

  function figureRanking() {
    return (politicalProfiles?.figures || []).map(profile => ({
      name: profile.name, percent: compareAnswersToReferenceProfile(userAnswers, profile).percent,
      description: profile.description || '', logo: profile.logo || '', profile
    })).sort((a, b) => b.percent - a.percent);
  }
  function renderFiguresRanking() {
    const target = document.getElementById('figures-results');
    if (!target) return;
    target.innerHTML = '';
    const items = figureRanking();
    const section = createRankingSection('👤 Figury polityczne', items, 'figure');
    section.querySelectorAll('.ranking-item').forEach((row, index) => {
      const profile = items[index].profile;
      const image = document.createElement('img');
      image.src = profileLogo(profile); image.alt = `Portret ${profile.name}`; image.className = 'user-logo-small';
      row.insertBefore(image, row.firstChild);
      row.addEventListener('click', event => {
        event.stopImmediatePropagation();
        window.showModernProfilePopup?.(profile);
      }, true);
    });
    target.appendChild(section);
  }

  computeAndDisplayResults = function () {
    originalComputeAndDisplayResults();
    renderFiguresRanking();
  };
  window.computeAndDisplayResults = computeAndDisplayResults;

  async function filteredOverlays(showParties, showIdeologies, compassInstance) {
    if (!compassInstance?.clearOverlays || !politicalProfiles) return;
    compassInstance.clearOverlays();
    const modal = compassInstance === window.modalCompassInstance;
    const enabled = {
      party: modal ? document.getElementById('modal-toggle-parties')?.checked : showParties,
      ideology: modal ? document.getElementById('modal-toggle-ideologies')?.checked : showIdeologies,
      user: modal ? document.getElementById('modal-toggle-users')?.checked : document.getElementById('toggle-users')?.checked,
      figure: modal ? document.getElementById('modal-toggle-figures')?.checked : document.getElementById('toggle-figures')?.checked
    };
    const collections = { party: politicalProfiles.parties || [], ideology: politicalProfiles.ideologies || [], user: politicalProfiles.users || [], figure: politicalProfiles.figures || [] };
    for (const [type, profiles] of Object.entries(collections)) {
      if (!enabled[type]) continue;
      for (const profile of profiles) {
        if (!matchesSelectedTags(profile)) continue;
        if (type === 'figure' && !figureMatchesYear(profile, compassInstance === window.modalCompassInstance ? document.getElementById('modal-figure-year-filter')?.value : document.getElementById('figure-year-filter')?.value)) continue;
        let coords;
        if (type === 'figure') {
          const parsed = parseExportCode(profile.exportCode || '').filter(answer => !answer.noteOnly && answer.answerData);
          if (!parsed.length) continue;
          const scores = computeScoresForAnswers(parsed, currentScoringMode);
          coords = computeCoordinatesFromValues(buildUserValuesMap(scores.pairResults), currentCompassMode, currentCreativeConfig);
        } else coords = await getEntityCoordinates(profile.key || profile.name, type);
        if (coords) compassInstance.addOverlay(profileLogo(profile), coords.x, coords.y, type, profile.name, profile.description || '');
      }
    }
  }

  function figureLifeRange(profile) {
    const field = (...keys) => keys.map(key => profile?.[key] ?? profile?.metadata?.[key]).find(value => value !== undefined && value !== null && String(value).trim());
    const fromFields = [field('birthDate', 'born', 'birth', 'dateOfBirth'), field('deathDate', 'died', 'death', 'dateOfDeath')];
    const text = String(profile?.description || ''); const match = text.match(/[([](?:ur\.\s*)?(\d{4})(?:\s*[–-]\s*(\d{4}))?/i);
    const year = value => { const found = String(value || '').match(/\d{4}/); return found ? Number(found[0]) : null; };
    return { birth: year(fromFields[0]) || Number(match?.[1]) || null, death: year(fromFields[1]) || Number(match?.[2]) || null };
  }
  function figureMatchesYear(profile, raw) {
    const value = String(raw || '').trim(); if (!value) return true;
    const match = value.match(/^(\d{1,4})(?:\s*-\s*(\d{1,4}))?$/); if (!match) return true;
    const start = Number(match[1]), end = Number(match[2] || match[1]); const life = figureLifeRange(profile);
    if (!life.birth) return false;
    return life.birth <= end && (life.death || Infinity) >= start;
  }
  loadOverlays = filteredOverlays;
  window.loadOverlays = filteredOverlays;

  function refreshVisibleProfiles() {
    document.querySelectorAll('.ranking-item[data-profile-name]').forEach(row => { row.hidden = !matchesSelectedTags(findProfile(row.dataset.profileName)); });
    document.querySelectorAll('.ranking-section').forEach(section => {
      const rows = [...section.querySelectorAll('.ranking-item[data-profile-name]')];
      if (rows.length) section.classList.toggle('is-filtered-empty', !!selectedTags.size && !rows.some(row => !row.hidden));
    });
    if (window.compassInstance) filteredOverlays(document.getElementById('toggle-parties')?.checked, document.getElementById('toggle-ideologies')?.checked, window.compassInstance);
    if (window.modalCompassInstance) filteredOverlays(document.getElementById('modal-toggle-parties')?.checked, document.getElementById('modal-toggle-ideologies')?.checked, window.modalCompassInstance);
  }
  function bindOverlayToggles() {
    ['toggle-parties', 'toggle-ideologies', 'toggle-users', 'toggle-figures',
      'modal-toggle-parties', 'modal-toggle-ideologies', 'modal-toggle-users', 'modal-toggle-figures']
      .forEach(id => {
        const toggle = document.getElementById(id);
        if (!toggle || toggle.dataset.overlayRefreshBound === 'true') return;
        toggle.dataset.overlayRefreshBound = 'true';
        toggle.addEventListener('change', refreshVisibleProfiles);
      });
    ['figure-year-filter', 'modal-figure-year-filter'].forEach(id => document.getElementById(id)?.addEventListener('input', refreshVisibleProfiles));
  }

  function renderTagFilters(container) {
    if (!container || container.dataset.ready) return;
    container.dataset.ready = 'true';
    container.dataset.simpleUi = 'true';

    const panel = document.createElement('details');
    panel.className = 'overlay-filter-panel';
    const summary = document.createElement('summary');
    summary.textContent = 'Filtry nakładek';
    panel.appendChild(summary);
    const body = document.createElement('div'); body.className = 'overlay-filter-body';

    const allChip = document.createElement('label'); allChip.className = 'tag-chip tag-chip-all';
    const allInput = document.createElement('input'); allInput.type = 'checkbox'; allInput.value = '__all__'; allInput.checked = true;
    allInput.addEventListener('change', () => {
      if (!allInput.checked) { allInput.checked = true; return; }
      showAllTags = true; selectedTags.clear();
      document.querySelectorAll('.tag-chip input').forEach(input => { input.checked = input.value === '__all__'; });
      refreshVisibleProfiles();
    });
    allChip.append(allInput, document.createTextNode('Pokaż wszystkie')); body.appendChild(allChip);

    const title = document.createElement('p'); title.className = 'tag-filter-title';
    title.textContent = 'Wybierz tagi — profil musi spełniać wszystkie zaznaczone warunki.'; body.appendChild(title);
    Object.entries(TAG_CATALOG).forEach(([kind, groups]) => Object.entries(groups).forEach(([group, tags]) => {
      const row = document.createElement('details'); row.className = 'compact-filter-group';
      const label = document.createElement('summary'); label.textContent = `${kind === 'figures' ? 'Figury' : kind === 'parties' ? 'Partie' : 'Ideologie'} · ${group}`; row.appendChild(label);
      const options = document.createElement('div'); options.className = 'tag-options';
      tags.forEach(tag => {
        const chip = document.createElement('label'); chip.className = 'tag-chip';
        const input = document.createElement('input'); input.type = 'checkbox'; input.value = tag;
        input.addEventListener('change', () => {
          showAllTags = false;
          input.checked ? selectedTags.add(tag) : selectedTags.delete(tag);
          document.querySelectorAll(`.tag-chip input[value="${CSS.escape(tag)}"]`).forEach(other => other.checked = input.checked);
          document.querySelectorAll('.tag-chip input[value="__all__"]').forEach(all => all.checked = false);
          refreshVisibleProfiles();
        });
        chip.append(input, document.createTextNode(tag)); options.appendChild(chip);
      });
      row.appendChild(options); body.appendChild(row);
    }));
    panel.appendChild(body); container.appendChild(panel);
  }
  function initLandingAndTheme() {
    if (location.hash !== '#results') document.body.classList.add('landing-active');
    document.getElementById('start-full-test')?.addEventListener('click', () => { document.body.classList.remove('landing-active'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    const floating = document.getElementById('floating-theme-toggle');
    floating?.addEventListener('click', () => { document.getElementById('theme-toggle')?.click(); setTimeout(() => { floating.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙'; }, 0); });
  }
  initLandingAndTheme();

  // Kompas działa na osobnej stronie; wynik jest przenoszony jako kod eksportu,
  // więc powrót przeglądarki nie resetuje odpowiedzi.
  document.addEventListener('click', event => {
    const openCompass = event.target.closest('#open-compass-modal');
    if (!openCompass) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (resultsDiv.style.display === 'none' || !userAnswers.length) {
      showPopup('Najpierw pokaż wyniki testu, aby otworzyć kompas.');
      return;
    }
    const code = generateExportCode();
    sessionStorage.setItem('neoAutystykExportCode', code);
    localStorage.setItem('neoAutystykExportCode', code);
    location.href = 'compass.html';
  }, true);

  let tries = 0;
  const waitForProfiles = setInterval(async () => {
    if (politicalProfiles || ++tries > 100) {
      clearInterval(waitForProfiles);
      renderTagFilters(document.getElementById('compass-tag-filters'));
      renderTagFilters(document.getElementById('modal-compass-tag-filters'));
      bindOverlayToggles();
      const savedCode = sessionStorage.getItem('neoAutystykExportCode');
      if (location.hash === '#results' && savedCode && !userAnswers.length) {
        await importAnswersFromExportCode(savedCode);
        computeAndDisplayResults();
        setTimeout(() => resultsDiv.scrollIntoView({ block: 'start' }), 0);
      }
    }
  }, 100);
})();

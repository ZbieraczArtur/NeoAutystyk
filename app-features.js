/* NeoAutystyk: landing page, profile tags, figures ranking and filtered compass overlays. */
(function () {
  'use strict';

  const TAG_CATALOG = {
    figures: {
      'Zawód / dziedzina': [
        'Filozof', 'Ekonomista', 'Polityk', 'Rewolucjonista',
        'Wojskowy', 'Prawnik', 'Przedsiębiorca', 'Duchowny',
        'Socjolog', 'Publicysta', 'Pisarz', 'Ekolog'
      ],
      'Rola / urząd': [
        'Autokrata', 'Prezydent', 'Premier', 'Monarcha',
        'Papież', 'Dyktator', 'Parlamentarzysta',
        'Myśliciel społeczny', 'Kanclerz', 'Więzień polityczny',
        'Reformator', 'Założyciel partii/ruchu', 'Lider partii'
      ],
      'Narodowość': [
        'Amerykanin', 'Brytyjczyk', 'Niemiec', 'Polak',
        'Francuz', 'Rosjanin', 'Argentyńczyk', 'Włoch', 'Chińczyk'
      ],
      Status: ['Żyje', 'Martwy'],
      Płeć: ['Kobieta', 'Mężczyzna'],
      'Okres życia': ['XVII wiek', 'XVIII wiek', 'XIX wiek', 'XX wiek', 'XXI wiek'],
      Ideologia: [
        'Liberalizm', 'Libertarianizm', 'Konserwatyzm', 'Socjalizm',
        'Komunizm', 'Faszyzm', 'Nacjonalizm', 'Monarchizm',
        'Anarchizm', 'Republikanizm'
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
  function profileTags(profile) { return Array.isArray(profile?.tags) ? profile.tags : []; }
  function matchesSelectedTags(profile) { return [...selectedTags].every(tag => profileTags(profile).includes(tag)); }
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
          popup.querySelector('.popup-logo-img')?.remove();
          const avatar = image.cloneNode(); avatar.className = 'popup-logo-img';
          avatar.style.cssText = 'display:block;max-width:120px;max-height:120px;margin:0 auto 16px;object-fit:cover;border-radius:50%;';
          popup.querySelector('.popup-content').insertBefore(avatar, popupText);
          popupText.textContent = `${profile.name}\n\n${profile.description || 'Brak opisu.'}`;
          popup.classList.remove('hidden');
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
        const oldImage = popup.querySelector('.popup-logo-img'); if (oldImage) oldImage.remove();
        const portrait = image.cloneNode(); portrait.className = 'popup-logo-img';
        portrait.style.cssText = 'display:block;max-width:120px;max-height:120px;margin:0 auto 16px;object-fit:cover;border-radius:50%;';
        popup.querySelector('.popup-content').insertBefore(portrait, popupText);
        popupText.textContent = `${profile.name}\n\n${profile.description || 'Brak opisu.'}`;
        popup.classList.remove('hidden');
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
  function renderTagFilters(container) {
    if (!container || container.dataset.ready) return;
    container.dataset.ready = 'true';
    const title = document.createElement('div'); title.className = 'tag-filter-title'; title.textContent = 'Filtruj profile według tagów (wszystkie wybrane tagi muszą pasować)'; container.appendChild(title);
    Object.entries(TAG_CATALOG).forEach(([kind, groups]) => Object.entries(groups).forEach(([group, tags]) => {
      const row = document.createElement('div'); row.className = 'tag-filter-group';
      const label = document.createElement('strong'); label.textContent = `${kind === 'figures' ? 'Figury' : kind === 'parties' ? 'Partie' : 'Ideologie'} · ${group}:`; row.appendChild(label);
      tags.forEach(tag => {
        const chip = document.createElement('label'); chip.className = 'tag-chip';
        const input = document.createElement('input'); input.type = 'checkbox'; input.value = tag;
        input.addEventListener('change', () => { input.checked ? selectedTags.add(tag) : selectedTags.delete(tag); document.querySelectorAll(`.tag-chip input[value="${CSS.escape(tag)}"]`).forEach(other => other.checked = input.checked); refreshVisibleProfiles(); });
        chip.append(input, document.createTextNode(tag)); row.appendChild(chip);
      }); container.appendChild(row);
    }));
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
  const waitForProfiles = setInterval(() => {
    if (politicalProfiles || ++tries > 100) {
      clearInterval(waitForProfiles);
      renderTagFilters(document.getElementById('compass-tag-filters'));
      renderTagFilters(document.getElementById('modal-compass-tag-filters'));
      const savedCode = sessionStorage.getItem('neoAutystykExportCode');
      if (location.hash === '#results' && savedCode && !userAnswers.length) {
        importAnswersFromExportCode(savedCode);
        computeAndDisplayResults();
        setTimeout(() => resultsDiv.scrollIntoView({ block: 'start' }), 0);
      }
    }
  }, 100);
})();

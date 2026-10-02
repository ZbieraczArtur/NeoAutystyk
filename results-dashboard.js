/* Reorganizes the existing result output without taking ownership of scoring. */
(function () {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);

  function resultTop(type) {
    const row = $(`#${type}-results .ranking-item:not([hidden])`);
    return { name: $('.rank-name', row)?.textContent.trim() || '—', score: $('.rank-percent', row)?.textContent.trim() || '—' };
  }
  function makeSection(id, eyebrow, title, description = '') {
    const section = document.createElement('section');
    section.id = id; section.className = `results-section results-${id}`;
    const heading = document.createElement('div'); heading.className = 'results-section-heading';
    const label = document.createElement('p'); label.className = 'results-eyebrow'; label.textContent = eyebrow;
    const h = document.createElement('h3'); h.textContent = title; heading.append(label, h);
    if (description) { const p = document.createElement('p'); p.className = 'results-section-description'; p.textContent = description; heading.append(p); }
    section.append(heading); return section;
  }
  function arrange() {
    const results = $('#results-container'), values = $('#values-results'), rankings = $('.ideologies-parties-container', results);
    const compass = $('#compass-container'), controls = $('.compass-controls', results);
    if (!results || !values || !rankings || !compass || !controls) return;
    let dashboard = $('#results-dashboard');
    if (!dashboard) {
      dashboard = document.createElement('div'); dashboard.id = 'results-dashboard'; dashboard.className = 'results-dashboard';
      const nav = document.createElement('nav'); nav.className = 'results-nav'; nav.setAttribute('aria-label', 'Nawigacja po wynikach');
      nav.innerHTML = '<a href="#results-summary">Podsumowanie</a><a href="#results-compass">Kompas</a><a href="#results-values">Wartości</a><a href="#results-rankings">Rankingi</a><a href="#results-badges">Odznaki</a>';
      const summary = makeSection('results-summary', 'PODSUMOWANIE', 'Twój wynik w pigułce', 'Cztery najważniejsze informacje o Twoim profilu.');
      const stats = document.createElement('div'); stats.className = 'result-stat-grid'; stats.setAttribute('aria-live', 'polite'); summary.append(stats);
      const compassSection = makeSection('results-compass', 'MAPA POGLĄDÓW', 'Kompas polityczny', 'Położenie profilu oraz porównania z wybranymi profilami.');
      const compassLayout = document.createElement('div'); compassLayout.className = 'result-compass-layout';
      const stage = document.createElement('div'); stage.className = 'result-compass-stage'; stage.append(compass);
      const config = document.createElement('aside'); config.className = 'result-compass-config'; config.setAttribute('aria-label', 'Informacje i konfiguracja kompasu');
      const info = document.createElement('div'); info.className = 'compass-live-info'; info.innerHTML = '<h4>Aktualny profil</h4><div class="compass-coordinates"></div><div class="compass-pairs"></div>';
      config.append(info, controls); compassLayout.append(stage, config); compassSection.append(compassLayout);
      const valuesSection = makeSection('results-values', 'ANALIZA OSI', 'Bilans wartości', 'Procenty pokazują rozkład każdej pary wartości.'); valuesSection.append(values);
      const rankingsSection = makeSection('results-rankings', 'DOPASOWANIA', 'Najbliższe profile', 'Najwyższy wynik oznacza największe podobieństwo odpowiedzi.'); rankingsSection.append(rankings);
      const tools = $('.results-tools', results), share = $('#share-card-section', results);
      const compareSection = makeSection('results-compare', 'DALSZA ANALIZA', 'Porównywarka i udostępnianie');
      if (tools) compareSection.append(tools);
      if (share) compareSection.append(share);
      const badgesSection = makeSection('results-badges', 'OSIĄGNIĘCIA', 'Odznaki');
      const extra = document.createElement('div'); extra.className = 'results-extra';
      const mode = $('.mode-selector', results); if (mode) extra.append(mode);
      const exportPanel = $('#export-answers-section', results); if (exportPanel) extra.append(exportPanel);
      const explanation = [...results.children].find(el => /method|metodolog|wyjaśn|interpretac/i.test(`${el.id} ${el.className} ${el.textContent.slice(0,100)}`) && el !== dashboard);
      if (explanation && explanation !== mode) extra.append(explanation);
      const title = $('#resultsTitle'); title?.insertAdjacentElement('afterend', nav); nav.after(dashboard);
      dashboard.append(summary, compassSection, valuesSection, rankingsSection, compareSection, badgesSection, extra);
    }
    const badge = $('.badges-section', results), badgeZone = $('#results-badges', dashboard);
    if (badge && badgeZone && badge.parentElement !== badgeZone) badgeZone.append(badge);
    const share = $('#share-card-section', results), compareZone = $('#results-compare', dashboard);
    if (share && compareZone && share.parentElement !== compareZone) compareZone.append(share);
    const exportPanel = $('#export-answers-section', results), extraZone = $('.results-extra', dashboard);
    if (exportPanel && extraZone && exportPanel.parentElement !== extraZone) extraZone.append(exportPanel);
    updateSummary(dashboard); updateCompassInfo(dashboard); enhanceRankings(dashboard);
    window.NeoShareCard?.mount();
    const mountedShare = $('#share-card-section', results);
    if (mountedShare && compareZone && mountedShare.parentElement !== compareZone) compareZone.append(mountedShare);
    document.dispatchEvent(new CustomEvent('neoAutystykResultsReady'));
    if (window.parent !== window) {
      const publishHeight = () => window.parent.postMessage({ type: 'neo-profile-results-height', height: document.documentElement.scrollHeight }, location.origin);
      publishHeight();
      if (!window.__neoResultHeightObserver && window.ResizeObserver) { window.__neoResultHeightObserver = new ResizeObserver(publishHeight); window.__neoResultHeightObserver.observe(dashboard); }
    }
  }
  function updateSummary(dashboard) {
    const stats = $('.result-stat-grid', dashboard); if (!stats) return;
    const answered = typeof userAnswers === 'undefined' ? 0 : userAnswers.filter(row => row?.answerData && !row.noteOnly).length;
    const ideology = resultTop('ideologies'), party = resultTop('parties'), figure = resultTop('figures');
    const cards = [
      ['ODPOWIEDZI', String(answered), 'uzupełnione odpowiedzi'],
      ['NAJBLIŻSZA IDEOLOGIA', ideology.name, ideology.score === '—' ? 'brak dopasowania' : `podobieństwo ${ideology.score}`],
      ['NAJBLIŻSZA PARTIA', party.name, party.score === '—' ? 'brak dopasowania' : `podobieństwo ${party.score}`],
      ['NAJBLIŻSZA FIGURA POLITYCZNA', figure.name, figure.score === '—' ? 'brak dopasowania' : `podobieństwo ${figure.score}`]
    ];
    stats.replaceChildren(...cards.map(([label, value, detail]) => { const card = document.createElement('article'); card.className = 'result-stat'; const name = document.createElement('span'); name.textContent = label; const strong = document.createElement('strong'); strong.textContent = value; const small = document.createElement('small'); small.textContent = detail; card.append(name, strong, small); return card; }));
  }
  function updateCompassInfo(dashboard) {
    const info = $('.compass-live-info', dashboard); if (!info) return;
    const point = window.currentUserCoords || window.compassInstance?.userCoords || { x: 0, y: 0 };
    $('.compass-coordinates', info).textContent = `Współrzędne: ${Number(point.x || 0).toFixed(1)}, ${Number(point.y || 0).toFixed(1)} · tryb ${document.getElementById('compass-mode-select')?.selectedOptions[0]?.textContent.trim() || 'wagowy'}`;
    const pairs = typeof computeScores === 'function' ? computeScores(typeof currentScoringMode === 'undefined' ? 'full' : currentScoringMode).pairResults.slice(0, 3) : [];
    const host = $('.compass-pairs', info); host.replaceChildren();
    pairs.forEach(pair => { const row = document.createElement('p'); row.textContent = `${pair.left} ${Math.round(pair.leftPercent)}% · ${Math.round(pair.rightPercent)}% ${pair.right}`; host.append(row); });
  }
  function enhanceRankings(dashboard) {
    $$('.ranking-section', dashboard).forEach(section => {
      const list = $('.ranking-list', section); if (!list || section.dataset.dashboardReady) return;
      section.dataset.dashboardReady = 'true'; [...list.children].forEach((row, index) => { row.dataset.rank = String(index + 1); row.classList.toggle('top-three', index < 3); if (index >= 5) row.hidden = true; });
      if (list.children.length > 5) { const button = document.createElement('button'); button.type = 'button'; button.className = 'ranking-more'; button.textContent = 'Zobacz więcej'; button.onclick = () => { const open = button.dataset.open !== 'true'; button.dataset.open = String(open); [...list.children].forEach((row, index) => { if (index >= 5) row.hidden = !open; }); button.textContent = open ? 'Pokaż mniej' : 'Zobacz więcej'; }; section.append(button); }
    });
  }
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const original = window.computeAndDisplayResults;
  window.computeAndDisplayResults = function (...args) {
    const output = original?.apply(this, args);
    try { if (typeof simulatedEntity === 'undefined' || !simulatedEntity) localStorage.setItem('neoAutystykExportCode', generateExportCode()); } catch (_) { }
    requestAnimationFrame(arrange); return output;
  };
  try { computeAndDisplayResults = window.computeAndDisplayResults; } catch (_) { }
  document.addEventListener('change', event => { if (event.target.closest('#compass-controls, .compass-controls')) requestAnimationFrame(() => updateCompassInfo($('#results-dashboard'))); });
  document.addEventListener('DOMContentLoaded', () => { if ($('#results-container')?.style.display !== 'none') arrange(); });
})();

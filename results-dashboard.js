/* Results-page composition.  The scoring engine retains ownership of its
 * result containers; this module only places them in a responsive dashboard. */
(function () {
  'use strict';

  function resultTop(type) {
    const row = document.querySelector(`#${type}-results .ranking-item:not([hidden])`);
    return row ? { name: row.querySelector('.rank-name')?.textContent?.trim() || '—', score: row.querySelector('.rank-percent')?.textContent?.trim() || '—' } : { name: '—', score: '—' };
  }

  function arrange() {
    const results = document.getElementById('results-container');
    const values = document.getElementById('values-results');
    const rankings = results?.querySelector('.ideologies-parties-container');
    const compass = document.getElementById('compass-container');
    const controls = results?.querySelector('.compass-controls');
    const tools = results?.querySelector('.results-tools');
    if (!results || !values || !rankings || !compass || !controls) return;

    let dashboard = document.getElementById('results-dashboard');
    if (!dashboard) {
      dashboard = document.createElement('section'); dashboard.id = 'results-dashboard'; dashboard.className = 'results-dashboard';
      dashboard.innerHTML = '<section class="result-summary" aria-label="Skrót wyniku"><div class="result-summary-copy"><p class="results-tools-eyebrow">PODSUMOWANIE PROFILU</p><h3>Twój wynik w pigułce</h3><p>Porównuj dominanty, przełączaj nakładki i eksploruj osie bez przewijania między oddzielnymi widokami.</p></div><div class="result-stat-grid" aria-live="polite"></div></section><div class="result-main-grid"><section class="result-compass-column"><div class="result-panel-heading"><p class="results-tools-eyebrow">MAPA POGLĄDÓW</p><h3>Kompas polityczny</h3></div></section><section class="result-insights-column"><div class="result-panel-heading"><p class="results-tools-eyebrow">ANALIZA OSI</p><h3>Bilans wartości</h3></div></section></div><section class="result-ranking-zone"><div class="result-panel-heading"><p class="results-tools-eyebrow">DOPASOWANIA</p><h3>Rankingi profili</h3></div></section>';
      document.getElementById('resultsTitle')?.insertAdjacentElement('afterend', dashboard);
      dashboard.querySelector('.result-compass-column').append(compass, controls);
      dashboard.querySelector('.result-insights-column').append(values);
      dashboard.querySelector('.result-ranking-zone').append(rankings);
      if (tools) dashboard.append(tools);
    }
    updateSummary(dashboard);
    window.NeoShareCard?.mount();
    document.dispatchEvent(new CustomEvent('neoAutystykResultsReady'));
  }

  function updateSummary(dashboard) {
    const stats = dashboard.querySelector('.result-stat-grid'); if (!stats) return;
    const answered = typeof userAnswers === 'undefined' ? 0 : userAnswers.filter(row => row?.answerData && !row.noteOnly).length;
    const total = typeof config !== 'undefined' ? config.questions?.length || 0 : 0;
    const ideology = resultTop('ideologies'), party = resultTop('parties');
    const point = window.currentUserCoords || { x: 0, y: 0 };
    const quadrant = `${Number(point.x || 0) >= 0 ? '→' : '←'} ${Number(point.y || 0) >= 0 ? '↓' : '↑'}`;
    const cards = [
      ['ODPOWIEDZI', total ? `${answered}/${total}` : String(answered), 'uzupełnione w tym teście'],
      ['NAJBLIŻSZA IDEOLOGIA', ideology.score, ideology.name],
      ['NAJBLIŻSZA PARTIA', party.score, party.name],
      ['POŁOŻENIE', quadrant, 'aktualny tryb kompasu']
    ];
    stats.replaceChildren(...cards.map(([label, value, description]) => {
      const card = document.createElement('article'); card.className = 'result-stat'; card.innerHTML = `<span>${label}</span><strong>${value}</strong><small>${description}</small>`; return card;
    }));
  }

  const baseCompute = window.computeAndDisplayResults;
  window.computeAndDisplayResults = function enhancedComputeAndDisplayResults(...args) {
    const outcome = baseCompute?.apply(this, args);
    requestAnimationFrame(arrange);
    return outcome;
  };
  try { computeAndDisplayResults = window.computeAndDisplayResults; } catch (_) { /* function is accessed through window in isolated builds */ }
  document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('results-container')?.style.display !== 'none') arrange(); });
})();

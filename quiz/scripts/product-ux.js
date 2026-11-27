/* UI-only conveniences: local progress, keyboard navigation and clear test state. */
(() => {
  'use strict';
  const storageKey = 'neoAutystykInProgressV1';
  const safeRead = () => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } };
  const persist = () => {
    const answers = window.NeoDataParts?.getUserAnswers?.() || [];
    if (!document.body.dataset.testMode || !Array.isArray(answers) || !answers.length) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ mode: document.body.dataset.testMode, view: document.body.dataset.testView || 'tabs', answers, savedAt: Date.now() })); updateContinue(); } catch { /* storage can be unavailable in private contexts */ }
  };
  function updateContinue() {
    const saved = safeRead(), button = document.getElementById('continue-test');
    if (!button) return;
    button.hidden = !(saved?.answers?.length && window.NeoTestModes?.beginTest);
    if (!button.hidden) button.textContent = `↗ Kontynuuj ostatni test · ${saved.answers.length} odpowiedzi`;
  }
  function createProgress() {
    const top = document.querySelector('.header-top');
    if (!top || document.getElementById('test-progress-pill')) return;
    const pill = document.createElement('button');
    pill.id = 'test-progress-pill'; pill.type = 'button'; pill.className = 'test-progress-pill';
    pill.title = 'Przejdź do przeglądu odpowiedzi';
    pill.addEventListener('click', () => document.querySelector('.question-review')?.scrollIntoView({ behavior:'smooth', block:'center' }));
    top.querySelector('.header-controls')?.before(pill);
    refreshProgress();
  }
  function refreshProgress() {
    const pill = document.getElementById('test-progress-pill');
    if (!pill || !window.config?.questions) return;
    const active = document.querySelectorAll('.question-card:not(.developer-inactive-question)').length;
    const answered = new Set((window.NeoDataParts?.getUserAnswers?.() || []).filter(row => !row.noteOnly && (row.answerData || row.neither)).map(row => Number(row.questionId))).size;
    pill.textContent = `Postęp ${Math.min(answered, active)}/${active || '—'}`;
    pill.setAttribute('aria-label', `Postęp testu: ${Math.min(answered, active)} z ${active || 0} pytań`);
  }
  function renderResultSummary() {
    const results = document.getElementById('results-container');
    if (!results || results.style.display === 'none') return;
    const answers = window.NeoDataParts?.getUserAnswers?.() || [];
    const responseRows = answers.filter(row => !row.noteOnly && (row.answerData || row.neither));
    const skipped = responseRows.filter(row => !row.neither && Number(row.answerValue) === 0 && /pomin|skip/i.test(String(row.answerData?.label || ''))).length;
    const answered = responseRows.filter(row => !row.neither && Number(row.answerValue) !== 0).length;
    const top = [...results.querySelectorAll('.ranking-section')].map(section => ({ title: section.querySelector('h3')?.textContent || '', row: section.querySelector('.ranking-item') })).find(item => item.row && item.row.querySelector('.rank-percent')?.textContent !== 'Brak danych');
    let summary = document.getElementById('results-summary-grid');
    if (!summary) { summary = document.createElement('section'); summary.id = 'results-summary-grid'; summary.className = 'results-summary-grid'; summary.setAttribute('aria-label', 'Podsumowanie odpowiedzi'); results.querySelector('#resultsTitle')?.insertAdjacentElement('afterend', summary); }
    let navigation = document.getElementById('results-quick-nav');
    if (!navigation) {
      navigation = document.createElement('nav'); navigation.id = 'results-quick-nav'; navigation.className = 'results-quick-nav'; navigation.setAttribute('aria-label', 'Przejdź do części wyników');
      [['values-results','Osie wartości'],['ideologies-results','Rankingi'],['compass-container','Kompas'],['open-comparison-page','Porównywarka']].forEach(([id,label]) => {
        const link = document.createElement('a'); link.href = `#${id}`; link.textContent = label;
        link.addEventListener('click', event => { event.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' }); });
        navigation.appendChild(link);
      });
      summary.insertAdjacentElement('afterend', navigation);
    }
    summary.innerHTML = `<article><span>ODPOWIEDZI</span><strong>${answered}</strong><small>udzielonych odpowiedzi</small></article><article><span>POMINIĘTE</span><strong>${skipped}</strong><small>świadomie oznaczone · bez wpływu na wynik</small></article><article class="summary-match"><span>NAJBLIŻSZE DOPASOWANIE</span><strong>${top?.row.querySelector('.rank-name')?.textContent?.trim() || '—'}</strong><small>${top?.title.replace(/[👤🏛️💡🐻]/g, '').trim() || (answered ? 'brak wspólnych odpowiedzi z profilami' : 'odpowiedz na pytania, aby zobaczyć dopasowanie')}</small></article>`;
  }
  document.addEventListener('click', event => {
    if (event.target.closest('.answer-option, #simulateBtn, #restoreBtn, #importBtn')) setTimeout(() => { persist(); refreshProgress(); }, 60);
    if (event.target.closest('#submitBtn')) setTimeout(renderResultSummary, 120);
  });
  document.addEventListener('input', event => { if (event.target.matches('.answer-note')) setTimeout(persist, 120); });
  document.addEventListener('keydown', event => {
    if (event.altKey && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      const action = event.key === 'ArrowRight' ? 'next' : 'previous';
      const button = document.querySelector(`[data-page-action="${action}"]:not(:disabled)`);
      if (button) { event.preventDefault(); button.click(); }
    }
  });
  document.getElementById('hub-theme-toggle')?.addEventListener('click', () => document.getElementById('floating-theme-toggle')?.click());
  document.getElementById('continue-test')?.addEventListener('click', async () => {
    const saved = safeRead();
    if (!saved?.answers?.length || !window.NeoTestModes?.beginTest) return;
    try { await window.NeoTestModes.beginTest(saved.mode || 'balanced', saved.view || 'tabs', saved.answers); }
    catch (error) { console.error(error); window.showPopup?.('Nie udało się przywrócić zapisanego testu.'); }
  });
  window.addEventListener('neoAutystykTestStarted', () => { createProgress(); refreshProgress(); });
  const observer = new MutationObserver(() => refreshProgress());
  observer.observe(document.documentElement, { childList:true, subtree:true });
  setTimeout(updateContinue, 400);
})();

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
    const skipped = responseRows.filter(row => row.neither || Number(row.answerValue) === 0).length;
    const active = document.querySelectorAll('.question-card:not(.developer-inactive-question)').length;
    const answered = responseRows.length - skipped;
    const top = [...results.querySelectorAll('.ranking-section')].map(section => ({ title: section.querySelector('h3')?.textContent || '', name: section.querySelector('.ranking-item .rank-name')?.textContent?.trim() })).find(item => item.name);
    let summary = document.getElementById('results-summary-grid');
    if (!summary) { summary = document.createElement('section'); summary.id = 'results-summary-grid'; summary.className = 'results-summary-grid'; summary.setAttribute('aria-label', 'Podsumowanie odpowiedzi'); results.querySelector('#resultsTitle')?.insertAdjacentElement('afterend', summary); }
    summary.innerHTML = `<article><span>ODPOWIEDZI</span><strong>${answered}</strong><small>udzielonych odpowiedzi</small></article><article><span>POMINIĘTE</span><strong>${skipped}</strong><small>bez wpływu na wynik</small></article><article><span>POKRYCIE</span><strong>${active ? Math.round((responseRows.length / active) * 100) : 0}%</strong><small>aktywnych pytań</small></article><article class="summary-match"><span>NAJBLIŻSZE DOPASOWANIE</span><strong>${top?.name || '—'}</strong><small>${top?.title?.replace(/[👤🏛️💡🐻]/g, '').trim() || 'ranking profili'}</small></article>`;
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

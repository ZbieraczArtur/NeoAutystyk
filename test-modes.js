/* Warianty testu oraz leniwa, wielostronicowa nawigacja po sześciu częściach. */
(() => {
  const modeFiles = { short: 'tests/skrocony.json', balanced: 'tests/zbalansowany.json' };
  let modes = null;
  let started = false;
  let pages = [];
  let currentPage = 0;
  let navigation = null;
  let viewMode = 'tabs';
  let viewChoiceDialog = null;

  async function loadModes() {
    const entries = await Promise.all(Object.entries(modeFiles).map(async ([key, file]) => {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`Nie udało się wczytać ${file}`);
      return [key, await response.json()];
    }));
    return Object.fromEntries(entries);
  }
  function idsFromDefinition(definition) {
    if (Array.isArray(definition.questionIds)) return new Set(definition.questionIds.map(Number));
    const range = definition.questionIds;
    return new Set(Array.from({ length: range.to - range.from + 1 }, (_, index) => range.from + index));
  }
  function idsFor(mode) {
    const all = window.NeoDataParts.allQuestionIds();
    return mode === 'full' ? all : all.filter(id => idsFromDefinition(modes[mode]).has(Number(id)));
  }
  function updateCounts() {
    ['full', 'balanced', 'short'].forEach(mode => {
      document.querySelectorAll(`[data-question-count="${mode}"]`).forEach(node => node.textContent = idsFor(mode).length);
    });
  }
  function createNavigation() {
    navigation?.remove();
    navigation = document.createElement('nav');
    navigation.className = 'test-page-navigation';
    navigation.setAttribute('aria-label', 'Części testu');
    const tabs = document.createElement('div'); tabs.className = 'test-page-tabs';
    pages.forEach((page, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = `Część ${index + 1}`; button.dataset.pageIndex = index;
      button.addEventListener('click', () => showPage(index)); tabs.appendChild(button);
    });
    const controls = document.createElement('div'); controls.className = 'test-page-controls';
    const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = '← Poprzednia część'; previous.dataset.pageAction = 'previous'; previous.addEventListener('click', () => showPage(currentPage - 1));
    const status = document.createElement('span'); status.className = 'test-page-status'; status.setAttribute('aria-live', 'polite');
    const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Następna część →'; next.dataset.pageAction = 'next'; next.addEventListener('click', () => showPage(currentPage + 1));
    controls.append(previous, status, next); navigation.append(tabs, controls);
    questionsContainer.before(navigation);
  }

  function createViewChoiceDialog() {
    if (viewChoiceDialog) return viewChoiceDialog;
    const dialog = document.createElement('dialog');
    dialog.className = 'test-view-choice-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="test-view-choice-card">
        <h2>Jak chcesz wykonywać test?</h2>
        <p>Wybierz układ pytań, który będzie dla Ciebie wygodniejszy.</p>
        <div class="test-view-choice-options">
          <button type="button" data-test-view="continuous">
            <strong>Jedna ciągła lista</strong>
            <span>Wszystkie pytania jedno pod drugim, bez zakładek.</span>
          </button>
          <button type="button" data-test-view="tabs">
            <strong>6 zakładek tematycznych</strong>
            <span>Pytania podzielone na części z dotychczasową nawigacją.</span>
          </button>
        </div>
        <button type="submit" class="test-view-choice-cancel">Wróć</button>
      </form>`;
    document.body.appendChild(dialog);
    viewChoiceDialog = dialog;
    return dialog;
  }
  function updateNavigation() {
    if (!navigation) return;
    navigation.querySelectorAll('[data-page-index]').forEach(button => button.classList.toggle('active', Number(button.dataset.pageIndex) === currentPage));
    navigation.querySelector('[data-page-action="previous"]').disabled = currentPage === 0;
    navigation.querySelector('[data-page-action="next"]').disabled = currentPage >= pages.length - 1;
    navigation.querySelector('.test-page-status').textContent = `Część ${currentPage + 1} z ${pages.length} · ${pages[currentPage].ids.length} pytań`;
  }
  async function showPage(index) {
    if (index < 0 || index >= pages.length) return;
    currentPage = index;
    questionsContainer.setAttribute('aria-busy', 'true');
    try {
      await window.NeoDataParts.activateQuestions(pages[index].ids);
      renderQuestions();
      updateNavigation();
      navigation?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } finally { questionsContainer.removeAttribute('aria-busy'); }
  }
  function pageComplete(page) {
    const answered = new Set(userAnswers.filter(answer => answer.answerData).map(answer => Number(answer.questionId)));
    return page.ids.length > 0 && page.ids.every(id => answered.has(Number(id)));
  }
  let scheduledAdvance = false;
  function maybeAdvance() {
    if (scheduledAdvance || !pageComplete(pages[currentPage]) || currentPage >= pages.length - 1) return;
    scheduledAdvance = true;
    setTimeout(() => { scheduledAdvance = false; if (pageComplete(pages[currentPage])) showPage(currentPage + 1); }, 180);
  }
  window.NeoTestPages = { maybeAdvance, showPage };

  async function beginTest(mode, selectedView) {
    const selectedIds = [...new Set(idsFor(mode).map(Number))];
    const selected = new Set(selectedIds);
    const manifest = await window.NeoDataParts.initialize();
    viewMode = selectedView;
    pages = viewMode === 'continuous'
      ? [{ id: 'all', ids: selectedIds }]
      : manifest.parts.map(part => ({ id: part.id, ids: part.questionIds.map(Number).filter(id => selected.has(id)) })).filter(page => page.ids.length);
    window.__selectedTestQuestionIds = selectedIds;
    userAnswers = [];
    window.resetQuestionReview?.(); window.resetQuestionPagination?.();
    document.body.classList.remove('landing-active'); document.body.dataset.testMode = mode; document.body.dataset.testView = viewMode;
    if (viewMode === 'tabs') createNavigation(); else { navigation?.remove(); navigation = null; }
    if (!started) {
      started = true;
      initApp(); setupSimulation(); setupMatchingModeSelector(); setupModeSelector(); setupImportExport(); setupLanguageSelector();
    } else resultsDiv.style.display = 'none';
    await showPage(0);
  }

  function chooseViewAndBegin(mode) {
    const dialog = createViewChoiceDialog();
    dialog.querySelectorAll('[data-test-view]').forEach(button => {
      button.onclick = async () => {
        dialog.close();
        try { await beginTest(mode, button.dataset.testView); }
        catch (error) { console.error(error); showPopup?.('Nie udało się uruchomić wybranego widoku testu.'); }
      };
    });
    dialog.showModal();
  }
  async function initializeTestModes() {
    try {
      await window.NeoDataParts.initialize(); modes = await loadModes(); updateCounts();
      document.querySelectorAll('[data-test-mode]').forEach(button => { button.disabled = false; button.addEventListener('click', () => chooseViewAndBegin(button.dataset.testMode)); });
    } catch (error) {
      console.error(error);
      document.querySelector('.test-mode-selector')?.insertAdjacentHTML('beforeend', '<p class="test-mode-error">Nie udało się wczytać wariantów testu.</p>');
    }
  }
  window.addEventListener('neoAutystykConfigReady', initializeTestModes, { once: true });
})();

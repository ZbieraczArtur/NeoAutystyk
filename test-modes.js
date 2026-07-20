/* Warianty testu są lekkimi listami ID; pełna treść pytań pozostaje tylko w data.json. */
(() => {
  const modeFiles = {
    short: 'tests/skrocony.json',
    balanced: 'tests/zbalansowany.json'
  };
  let modes = null;
  let started = false;

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

  function questionsFor(mode) {
    if (mode === 'full') return configBase.questions.slice();
    const ids = idsFromDefinition(modes[mode]);
    return configBase.questions.filter(question => ids.has(Number(question.id)));
  }

  function updateCounts() {
    ['full', 'balanced', 'short'].forEach(mode => {
      const count = questionsFor(mode).length;
      document.querySelectorAll(`[data-question-count="${mode}"]`).forEach(node => node.textContent = count);
    });
  }

  function beginTest(mode) {
    config = { ...configBase, questions: questionsFor(mode) };
    window.__selectedTestQuestionIds = config.questions.map(question => Number(question.id));
    userAnswers = [];
    window.resetQuestionPagination?.();
    document.body.classList.remove('landing-active');
    document.body.dataset.testMode = mode;
    if (!started) {
      started = true;
      initApp();
      setupSimulation();
      setupMatchingModeSelector();
      setupModeSelector();
      setupImportExport();
      setupLanguageSelector();
    } else {
      resultsDiv.style.display = 'none';
      renderQuestions();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function initializeTestModes() {
    try {
      modes = await loadModes();
      updateCounts();
      document.querySelectorAll('[data-test-mode]').forEach(button => {
        button.disabled = false;
        button.addEventListener('click', () => beginTest(button.dataset.testMode));
      });
    } catch (error) {
      console.error(error);
      document.querySelector('.test-mode-selector')?.insertAdjacentHTML('beforeend', '<p class="test-mode-error">Nie udało się wczytać wariantów testu.</p>');
    }
  }

  window.addEventListener('neoAutystykConfigReady', initializeTestModes, { once: true });
})();

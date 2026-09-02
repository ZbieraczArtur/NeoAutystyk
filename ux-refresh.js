/* UX additions: complete question catalogue and shared compass overlay sizing. */
(() => {
  'use strict';
  const sizeInputs = ['overlay-size-range', 'modal-overlay-size-range'];
  const sizeOutputs = ['overlay-size-value', 'modal-overlay-size-value'];
  const storageKey = 'neoAutystykOverlaySize';

  function setOverlaySize(value) {
    const size = Math.max(16, Math.min(52, Number(value) || 24));
    document.querySelectorAll('.compass-wrapper').forEach(node => node.style.setProperty('--overlay-size', `${size}px`));
    sizeInputs.forEach(id => { const input = document.getElementById(id); if (input) input.value = size; });
    sizeOutputs.forEach(id => { const output = document.getElementById(id); if (output) output.value = `${size} px`; });
    try { localStorage.setItem(storageKey, String(size)); } catch (_) {}
  }

  function bindOverlaySizeControls() {
    const initial = Number(localStorage.getItem(storageKey)) || 24;
    setOverlaySize(initial);
    sizeInputs.forEach(id => document.getElementById(id)?.addEventListener('input', event => setOverlaySize(event.target.value)));
    document.querySelectorAll('[data-overlay-size-step]').forEach(button => button.addEventListener('click', () => {
      const source = button.closest('.overlay-size-controls')?.querySelector('input[type="range"]');
      setOverlaySize((Number(source?.value) || initial) + Number(button.dataset.overlaySizeStep));
    }));
  }

  function questionLine(question, showDescriptions) {
    const item = document.createElement('li');
    item.className = 'catalog-question';
    const text = document.createElement('span');
    text.className = 'catalog-question-text';
    text.textContent = `${question.id}. ${question.text}`;
    item.appendChild(text);
    if (showDescriptions && question.description) {
      const description = document.createElement('p');
      description.className = 'catalog-question-description';
      description.textContent = question.description;
      item.appendChild(description);
    }
    return item;
  }

  function catalogueText(parts, showDescriptions) {
    return parts.map(part => {
      const lines = [`Część ${part.id}`];
      part.questions.forEach(question => {
        lines.push(`${question.id}. ${question.text}`);
        if (showDescriptions && question.description) lines.push(`   ${question.description}`);
      });
      return lines.join('\n');
    }).join('\n\n');
  }

  async function setupCatalogue() {
    const details = document.getElementById('question-catalog');
    const content = document.getElementById('question-catalog-content');
    const status = document.getElementById('question-catalog-status');
    const descriptionToggle = document.getElementById('catalog-show-descriptions');
    const sortSelect = document.getElementById('catalog-sort');
    const copyButton = document.getElementById('catalog-copy-btn');
    const diagnostics = document.getElementById('question-catalog-diagnostics');
    if (!details || !content || !window.NeoDataParts) return;
    let parts = null;

    function render() {
      if (!parts) return;
      const sort = sortSelect?.value || 'default';
      const shownParts = sort === 'default' ? parts : [{ id: 'Wszystkie tezy', questions: parts.flatMap(part => part.questions).sort((a, b) => sort === 'id-asc' ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id)) }];
      const fragment = document.createDocumentFragment();
      shownParts.forEach(part => {
        const section = document.createElement('section');
        section.className = 'catalog-part';
        const heading = document.createElement('h3');
        heading.textContent = `Część ${part.id}`;
        const count = document.createElement('span'); count.textContent = `${part.questions.length} pytań`;
        heading.appendChild(count);
        const list = document.createElement('ol');
        list.className = 'catalog-question-list';
        part.questions.forEach(question => list.appendChild(questionLine(question, descriptionToggle.checked)));
        section.append(heading, list); fragment.appendChild(section);
      });
      content.replaceChildren(fragment);
      status.textContent = `Łącznie: ${parts.reduce((sum, part) => sum + part.questions.length, 0)} pytań, w tym pytania warunkowe i ukryte.`;
      renderDiagnostics();
    }

    function renderDiagnostics() {
      if (!diagnostics || !parts) return;
      const manifestIds = [...new Set(parts.flatMap(part => part.questions.map(question => Number(question.id))).filter(Number.isFinite))].sort((a, b) => a - b);
      const sourceQuestions = new Map((window.__catalogueSourceQuestions || []).map(question => [Number(question.id), question]));
      const missing = [];
      for (let id = manifestIds[0]; id <= manifestIds.at(-1); id++) if (!manifestIds.includes(id)) missing.push(id);
      diagnostics.hidden = missing.length === 0;
      diagnostics.replaceChildren();
      if (!missing.length) return;
      const title = document.createElement('h3'); title.textContent = '⚠ Brakujące tezy'; diagnostics.appendChild(title);
      missing.forEach(id => {
        const item = document.createElement('p'); const source = sourceQuestions.get(id);
        const before = manifestIds.filter(value => value < id).at(-1); const after = manifestIds.find(value => value > id);
        item.textContent = source
          ? `ID ${id}: teza istnieje w bazie (${source.text || 'bez treści'}), ale nie została dodana do manifest.json. Kolejność: ID ${before} → ID ${after}.`
          : `ID ${id}: teza nie istnieje w bazie. Kolejność: ID ${before} → ID ${after}.`;
        diagnostics.appendChild(item);
      });
    }

    async function load() {
      if (parts) return;
      status.textContent = 'Wczytywanie kompletnej listy pytań…';
      try {
        const manifest = await window.NeoDataParts.initialize();
        const loadedParts = await Promise.all(manifest.parts.map(async entry => {
          const data = await window.NeoDataParts.loadPart(entry.id);
          return { id: entry.id, questions: data.questions || [] };
        }));
        // Manifest określa kolejność wyświetlania, ale nie jest źródłem danych
        // pytania. Indeks obejmuje wszystkie pliki, więc błędne przypisanie
        // pytania do części nie powoduje fałszywego komunikatu o braku treści.
        const allQuestionsById = new Map();
        loadedParts.forEach(part => part.questions.forEach(question => {
          const id = Number(question.id);
          if (!allQuestionsById.has(id)) allQuestionsById.set(id, question);
        }));
        window.__catalogueSourceQuestions = [...allQuestionsById.values()];
        parts = manifest.parts.map(entry => ({
          id: entry.id,
          questions: entry.questionIds.map(Number).map(id => allQuestionsById.get(id) || { id, text: "[Brak treści pytania w pliku źródłowym]", missing: true })
        }));
        render();
      } catch (error) {
        console.error(error);
        status.textContent = 'Nie udało się wczytać listy pytań.';
      }
    }

    details.addEventListener('toggle', () => { if (details.open) load(); });
    descriptionToggle?.addEventListener('change', render);
    sortSelect?.addEventListener('change', render);
    copyButton?.addEventListener('click', async () => {
      await load();
      if (!parts) return;
      const label = copyButton.textContent;
      try {
        await navigator.clipboard.writeText(catalogueText(parts, descriptionToggle.checked));
        copyButton.textContent = 'Skopiowano';
      } catch (_) {
        const area = document.createElement('textarea'); area.value = catalogueText(parts, descriptionToggle.checked); document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); copyButton.textContent = 'Skopiowano';
      }
      setTimeout(() => { copyButton.textContent = label; }, 1600);
    });
  }

  window.addEventListener('neoAutystykConfigReady', () => { bindOverlaySizeControls(); setupCatalogue(); }, { once: true });
})();

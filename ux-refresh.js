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
    const copyButton = document.getElementById('catalog-copy-btn');
    if (!details || !content || !window.NeoDataParts) return;
    let parts = null;

    function render() {
      if (!parts) return;
      const fragment = document.createDocumentFragment();
      parts.forEach(part => {
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
    }

    async function load() {
      if (parts) return;
      status.textContent = 'Wczytywanie kompletnej listy pytań…';
      try {
        const manifest = await window.NeoDataParts.initialize();
        parts = await Promise.all(manifest.parts.map(async entry => {
          const data = await window.NeoDataParts.loadPart(entry.id);
          const byId = new Map((data.questions || []).map(question => [Number(question.id), question]));
          return { id: entry.id, questions: entry.questionIds.map(Number).map(id => byId.get(id) || { id, text: "[Brak treści pytania w pliku źródłowym]", missing: true }) };
        }));
        render();
      } catch (error) {
        console.error(error);
        status.textContent = 'Nie udało się wczytać listy pytań.';
      }
    }

    details.addEventListener('toggle', () => { if (details.open) load(); });
    descriptionToggle?.addEventListener('change', render);
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
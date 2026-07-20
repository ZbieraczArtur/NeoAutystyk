/* NeoAutystyk – dynamic questions, developer tools and compact UI controls. */
(function () {
  'use strict';

  // Publiczna flaga: można ją również ustawić przed uruchomieniem w konsoli.
  window.DEV_MODE = Boolean(window.DEV_MODE);
  const NEITHER = 'Neither';
  let bearClickTimer = null;

  const idOf = value => Number(value);
  const questionById = id => config?.questions?.find(question => idOf(question.id) === idOf(id));
  const answerRows = id => userAnswers.filter(row => idOf(row.questionId) === idOf(id) && !row.noteOnly);
  const primaryAnswer = id => answerRows(id).find(row => !row.neither) || answerRows(id)[0] || null;
  const isPositive = row => row && !row.neither && Number(row.answerValue) > 0;
  const isNegative = row => row && !row.neither && Number(row.answerValue) < 0;

  function isQuestionVisible(question) {
    const yes = Array.isArray(question.require_yes) ? question.require_yes : [];
    const no = Array.isArray(question.require_no) ? question.require_no : [];
    return yes.every(id => answerRows(id).some(isPositive)) && no.every(id => answerRows(id).some(isNegative));
  }

  function reconcileDynamicAnswers() {
    if (!config?.questions) return;
    const visible = new Set(config.questions.filter(isQuestionVisible).map(question => idOf(question.id)));
    userAnswers = userAnswers.filter(row => !(row.isAutoNeither && visible.has(idOf(row.questionId))));
    for (const question of config.questions) {
      if (visible.has(idOf(question.id))) continue;
      // Pytanie, które ponownie staje się ukryte, nie może zachować dawnej
      // odpowiedzi użytkownika: zastępujemy ją automatycznym Neither.
      userAnswers = userAnswers.filter(row => idOf(row.questionId) !== idOf(question.id));
      userAnswers.push({ questionId: question.id, answerIndex: -1, answerValue: 0, answerData: null, neither: true, isAutoNeither: true });
    }
  }

  function notify(message) {
    let toast = document.getElementById('developer-toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'developer-toast'; toast.className = 'developer-toast'; document.body.appendChild(toast); }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), 2200);
  }

  function ensureBear() {
    if (document.getElementById('developer-bear')) return;
    const bear = document.createElement('button');
    bear.id = 'developer-bear'; bear.type = 'button'; bear.title = ''; bear.setAttribute('aria-label', ''); bear.textContent = '🐻';
    bear.addEventListener('click', () => { clearTimeout(bearClickTimer); bearClickTimer = setTimeout(() => {}, 260); });
    bear.addEventListener('dblclick', event => {
      event.preventDefault(); clearTimeout(bearClickTimer); window.DEV_MODE = !window.DEV_MODE;
      notify(window.DEV_MODE ? 'Tryb deweloperski włączony' : 'Tryb deweloperski wyłączony');
      renderQuestions();
      document.getElementById('comparison-panel')?.remove();
      if (resultsDiv?.style.display !== 'none') computeAndDisplayResults();
    });
    document.body.appendChild(bear);
  }

  function profileAnswerNames(questionId, answerLabel) {
    const result = { ideologies: [], parties: [], users: [], figures: [] };
    const groups = { ideologies: politicalProfiles?.ideologies || [], parties: politicalProfiles?.parties || [], users: politicalProfiles?.users || [], figures: politicalProfiles?.figures || [] };
    const expression = new RegExp(`(?:^|;)\\s*${questionId}:\\(([^)]*)\\)`, 'i');
    for (const [kind, profiles] of Object.entries(groups)) {
      result[kind] = profiles.filter(profile => {
        const match = String(profile.exportCode || '').match(expression);
        return match && match[1].split(',').some(label => label.trim() === answerLabel);
      }).map(profile => profile.name);
    }
    return result;
  }

  function developerPanel(question) {
    const details = document.createElement('details'); details.className = 'developer-data';
    const summary = document.createElement('summary'); summary.textContent = 'Dane źródłowe'; details.appendChild(summary);
    question.answers.forEach(answer => {
      const block = document.createElement('div'); block.className = 'developer-answer-data';
      const maps = [
        ['Wartości', [...(answer.values_for || []), ...(answer.values_against || []).map(value => `− ${value}`)]],
        ['Ideologie', [...(answer.ideologies_for || []), ...(answer.ideologies_against || []).map(value => `− ${value}`)]],
        ['Partie', [...(answer.parties_for || []), ...(answer.parties_against || []).map(value => `− ${value}`)]]
      ];
      const profileMaps = profileAnswerNames(question.id, answer.label);
      block.innerHTML = `<strong>${answer.label}</strong> <small>(${answer.value})</small>`;
      maps.forEach(([title, values]) => { const line = document.createElement('p'); line.textContent = `${title}: ${values.length ? values.join(', ') : '—'}`; block.appendChild(line); });
      [['Użytkownicy', profileMaps.users], ['Figury', profileMaps.figures]].forEach(([title, values]) => { const line = document.createElement('p'); line.textContent = `${title}: ${values.length ? values.join(', ') : '—'}`; block.appendChild(line); });
      details.appendChild(block);
    });
    return details;
  }

  function markSelections() {
    document.querySelectorAll('.answer-option').forEach(element => element.classList.remove('selected'));
    userAnswers.filter(row => !row.neither && !row.noteOnly).forEach(row => document.querySelector(`.question-card[data-id="${row.questionId}"] .answer-option[data-answer-index="${row.answerIndex}"]`)?.classList.add('selected'));
  }

  function setAnswer(question, index, answer) {
    const rows = answerRows(question.id);
    if (window.DEV_MODE) {
      const existing = rows.find(row => row.answerIndex === index && !row.neither);
      userAnswers = userAnswers.filter(row => idOf(row.questionId) !== idOf(question.id) || (!row.neither && row.answerIndex !== index));
      if (!existing) userAnswers.push({ questionId: question.id, answerIndex: index, answerValue: answer.value, answerData: answer });
    } else {
      const note = primaryAnswer(question.id)?.note || '';
      userAnswers = userAnswers.filter(row => idOf(row.questionId) !== idOf(question.id));
      userAnswers.push({ questionId: question.id, answerIndex: index, answerValue: answer.value, answerData: answer, note });
    }
    reconcileDynamicAnswers(); renderQuestions();
  }

  function setNeither(question) {
    const note = primaryAnswer(question.id)?.note || '';
    userAnswers = userAnswers.filter(row => idOf(row.questionId) !== idOf(question.id));
    userAnswers.push({ questionId: question.id, answerIndex: -1, answerValue: 0, answerData: null, neither: true, note });
    reconcileDynamicAnswers(); renderQuestions();
  }

  function renderModernQuestions() {
    if (!config) return;
    reconcileDynamicAnswers(); questionsContainer.innerHTML = '';
    const visibleQuestions = config.questions.filter(question => window.DEV_MODE || isQuestionVisible(question));
    visibleQuestions.forEach((question, position) => {
      const active = isQuestionVisible(question);
      const card = document.createElement('article'); card.className = `question-card${!active ? ' developer-inactive-question' : ''}`; card.dataset.id = question.id;
      const title = document.createElement('div'); title.className = 'question-text'; title.textContent = `${position + 1}. ${question.text}`; card.appendChild(title);
      const tools = document.createElement('div'); tools.className = 'question-tools-row';
      const expand = document.createElement('button'); expand.type = 'button'; expand.className = 'expand-btn'; expand.textContent = translations?.ui?.expandBtn || 'Rozwiń tezę';
      const description = document.createElement('div'); description.className = 'description'; description.textContent = question.description || translations?.ui?.noDescription || 'Brak dodatkowego opisu.';
      expand.addEventListener('click', () => { description.classList.toggle('visible'); expand.textContent = description.classList.contains('visible') ? (translations?.ui?.collapseBtn || 'Zwiń tezę') : (translations?.ui?.expandBtn || 'Rozwiń tezę'); }); tools.appendChild(expand);
      if (question.comment) { const comment = document.createElement('button'); comment.type = 'button'; comment.className = 'comment-badge'; comment.textContent = translations?.ui?.skipIfBadge || 'Pomiń jeśli'; comment.addEventListener('click', () => showPopup(question.comment)); tools.appendChild(comment); }
      card.append(tools, description);
      const answers = document.createElement('div'); answers.className = 'answers';
      question.answers.forEach((answer, index) => {
        const option = document.createElement('button'); option.type = 'button'; option.className = 'answer-option'; option.dataset.answerIndex = index; option.textContent = answer.label;
        if (Number(answer.value) > 1) option.classList.add('answer-strong-agree'); else if (Number(answer.value) > 0) option.classList.add('answer-mild-agree'); else if (Number(answer.value) < -1) option.classList.add('answer-strong-disagree'); else if (Number(answer.value) < 0) option.classList.add('answer-mild-disagree'); else option.classList.add('answer-skip');
        if (answerRows(question.id).some(row => row.answerIndex === index && !row.neither)) option.classList.add('selected');
        option.addEventListener('click', () => setAnswer(question, index, answer)); answers.appendChild(option);
      });
      if (window.DEV_MODE) { const neither = document.createElement('button'); neither.type = 'button'; neither.className = 'answer-option answer-neither'; neither.textContent = NEITHER; if (answerRows(question.id).some(row => row.neither && !row.isAutoNeither)) neither.classList.add('selected'); neither.addEventListener('click', () => setNeither(question)); answers.appendChild(neither); }
      card.appendChild(answers);
      const note = document.createElement('div'); note.className = 'answer-note-wrap'; note.innerHTML = `<label for="answer-note-${question.id}">Uzasadnienie odpowiedzi</label><textarea id="answer-note-${question.id}" class="answer-note" rows="3" maxlength="3000"></textarea>`;
      const input = note.querySelector('textarea'); input.value = primaryAnswer(question.id)?.note || ''; input.addEventListener('input', () => { const row = primaryAnswer(question.id); if (row) row.note = input.value; }); card.appendChild(note);
      if (window.DEV_MODE) card.appendChild(developerPanel(question));
      questionsContainer.appendChild(card);
    });
    ensureBear(); markSelections();
  }

  function answerText(question) {
    const rows = answerRows(question.id);
    if (!rows.length) return 'Brak odpowiedzi';
    if (rows.some(row => row.neither)) return NEITHER;
    return rows.map(row => row.answerData?.label).filter(Boolean).join(', ') || 'Brak odpowiedzi';
  }

  function generateModernExport() {
    reconcileDynamicAnswers();
    if (window.DEV_MODE) return config.questions.map(question => `${question.id}:(${answerText(question)});`).join(' ');
    const date = getCurrentDateTime();
    return `Data wykonania testu: ${date}\n\n${config.questions.map(question => `${question.id}. ${question.text} [id:${question.id}]: (${answerText(question)});`).join('\n')}\n`;
  }

  function parseAnyExport(raw) {
    const rows = []; const text = String(raw || '');
    const expression = /(?:\[id:|(?:^|[;\n])\s*)(\d+)\]?\s*:\s*\(([^)]*)\)/g; let match;
    while ((match = expression.exec(text))) {
      const question = questionById(match[1]); if (!question) continue;
      const labels = match[2].split(',').map(value => value.trim()).filter(Boolean);
      labels.forEach(label => {
        if (/^brak odpowiedzi$/i.test(label)) return;
        if (/^neither$/i.test(label)) { rows.push({ questionId: question.id, answerIndex: -1, answerValue: 0, answerData: null, neither: true }); return; }
        const index = question.answers.findIndex(answer => answer.label === label || String(answer.label).toLowerCase() === label.toLowerCase());
        if (index >= 0) rows.push({ questionId: question.id, answerIndex: index, answerValue: question.answers[index].value, answerData: question.answers[index] });
      });
    }
    return rows;
  }

  function importModernExport(raw) {
    const rows = parseAnyExport(raw); if (!rows.length) return false;
    userAnswers = rows; reconcileDynamicAnswers(); renderQuestions();
    if (resultsDiv.style.display !== 'none') computeAndDisplayResults(); else notify(`Zaimportowano ${rows.length} odpowiedzi.`);
    return true;
  }

  function appendTagsToPopup(profile) {
    const content = popup.querySelector('.popup-content');
    content.querySelector('.popup-profile-tags')?.remove();
    const tags = Array.isArray(profile?.tags) ? profile.tags : []; if (!tags.length) return;
    const list = document.createElement('div'); list.className = 'popup-profile-tags'; list.innerHTML = '<strong>Tagi</strong>';
    tags.forEach(tag => { const chip = document.createElement('span'); chip.className = 'profile-tag'; chip.textContent = tag; list.appendChild(chip); }); content.insertBefore(list, content.querySelector('#closePopup'));
  }

  function bindRankingPopups() {
    document.querySelectorAll('.ranking-item[data-profile-name]').forEach(row => {
      row.querySelector('.profile-tags')?.remove();
      if (row.dataset.modernPopup) return; row.dataset.modernPopup = 'true';
      row.addEventListener('click', () => setTimeout(() => {
        const name = row.dataset.profileName; const profile = [...(politicalProfiles?.parties || []), ...(politicalProfiles?.ideologies || []), ...(politicalProfiles?.users || []), ...(politicalProfiles?.figures || [])].find(item => item.name === name || item.key === name || item.id === name);
        appendTagsToPopup(profile);
      }), 0);
    });
  }

  const originalResults = window.computeAndDisplayResults || computeAndDisplayResults;
  window.computeAndDisplayResults = function () { reconcileDynamicAnswers(); originalResults(); bindRankingPopups(); };
  computeAndDisplayResults = window.computeAndDisplayResults;
  window.renderQuestions = renderModernQuestions; renderQuestions = renderModernQuestions;
  window.generateExportCode = generateModernExport; generateExportCode = generateModernExport;
  window.importAnswersFromExportCode = importModernExport; importAnswersFromExportCode = importModernExport;

  // Compact, grouped tag filters: existing checkbox logic is retained, only presentation changes.
  function compactFilters() {
    document.querySelectorAll('.tag-filters[data-ready="true"]').forEach(container => {
      if (container.dataset.compact) return; container.dataset.compact = 'true';
      const groups = [...container.querySelectorAll('.tag-filter-group')]; if (!groups.length) return;
      const title = container.querySelector('.tag-filter-title'); if (title) title.textContent = 'Filtry nakładek';
      groups.forEach(group => { const fold = document.createElement('details'); fold.className = 'compact-filter-group'; const summary = document.createElement('summary'); summary.textContent = group.querySelector('strong')?.textContent || 'Filtr'; fold.appendChild(summary); [...group.querySelectorAll('.tag-chip')].forEach(chip => fold.appendChild(chip)); group.replaceWith(fold); });
    });
  }
  const filterObserver = new MutationObserver(compactFilters); filterObserver.observe(document.body, { childList: true, subtree: true });
  setInterval(compactFilters, 500);

  const originalCompare = window.compareAnswersToReferenceProfile || compareAnswersToReferenceProfile;
  window.compareAnswersToReferenceProfile = function (answers, profile) {
    const result = originalCompare(answers, profile);
    const neitherRows = (answers || []).filter(row => row.neither);
    if (!neitherRows.length || !config) return result;
    const source = String(profile?.exportCode || ''); let adjustment = 0;
    neitherRows.forEach(row => { const question = questionById(row.questionId); const match = source.match(new RegExp(`(?:^|;)\\s*${question?.id}:\\(([^)]*)\\)`, 'i')); if (match && !/pomiń|skip|brak odpowiedzi/i.test(match[1])) adjustment -= 1; });
    const percent = Math.max(0, Math.min(100, result.percent + adjustment * 100 / Math.max(1, config.questions.length)));
    return { ...result, score: result.score + adjustment, percent };
  };
  compareAnswersToReferenceProfile = window.compareAnswersToReferenceProfile;

  /* Porównywarka wyników i importowane profile. */
  const importedComparisons = JSON.parse(localStorage.getItem('neoAutystykComparisonProfiles') || '[]');
  let comparisonLimit = 50;
  const comparisonEscape = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const allComparisonProfiles = () => [
    ...(politicalProfiles?.ideologies || []).map(profile => ({ ...profile, type: 'ideology' })),
    ...(politicalProfiles?.parties || []).map(profile => ({ ...profile, type: 'party' })),
    ...(politicalProfiles?.users || []).map(profile => ({ ...profile, type: 'user' })),
    ...(politicalProfiles?.figures || []).map(profile => ({ ...profile, type: 'figure' })),
    ...importedComparisons.map(profile => ({ ...profile, type: 'friend' }))
  ];
  const profileRows = profile => Array.isArray(profile.answers) ? profile.answers : parseAnyExport(profile.exportCode || '');
  const rowLabel = row => row?.neither ? NEITHER : row?.answerData?.label || 'Brak odpowiedzi';
  const profileLogo = profile => profile.logo || profile.avatar || 'images/ALogo.svg';

  function saveComparisonProfiles() { localStorage.setItem('neoAutystykComparisonProfiles', JSON.stringify(importedComparisons)); }
  function selectedComparisonProfile() { return allComparisonProfiles().find(profile => profile.type === document.getElementById('comparison-profile')?.selectedOptions?.[0]?.dataset.type && profile.name === document.getElementById('comparison-profile')?.value) || null; }
  function answerFor(rows, id) { return rows.find(row => idOf(row.questionId) === idOf(id) && !row.noteOnly) || null; }
  function similarity(first, second) {
    if (!first || !second || first.neither || second.neither || !first.answerData || !second.answerData) return null;
    const distance = Math.abs(Number(first.answerValue) - Number(second.answerValue));
    return distance === 0 ? 100 : distance <= 1 ? 67 : distance <= 2 ? 17 : 0;
  }
  function questionMatchesValue(question, value) {
    if (!value) return true;
    const mine = answerFor(userAnswers, question.id);
    return Boolean(mine?.answerData && ([...(mine.answerData.values_for || []), ...(mine.answerData.values_against || [])].includes(value)));
  }
  function profilePopup(profile) {
    popup.querySelector('.popup-logo-img')?.remove();
    const logo = document.createElement('img'); logo.src = profileLogo(profile); logo.className = 'popup-logo-img'; logo.alt = profile.name; popup.querySelector('.popup-content').insertBefore(logo, popupText);
    popupText.textContent = `${profile.name}\n\n${profile.description || 'Brak opisu.'}`; appendTagsToPopup(profile); popup.classList.remove('hidden');
  }
  function profileAnswerGroups(question, answer) {
    const groups = [['Ideologie', 'ideology'], ['Partie', 'party'], ['Użytkownicy', 'user'], ['Figury', 'figure']];
    const profiles = allComparisonProfiles().filter(profile => profile.type !== 'friend');
    return groups.map(([label, type]) => {
      const matches = profiles.filter(profile => profile.type === type && profileRows(profile).some(row => idOf(row.questionId) === idOf(question.id) && rowLabel(row) === answer.label));
      if (!matches.length) return '';
      const logos = matches.map(profile => `<button type="button" class="comparison-profile-logo" data-profile-type="${type}" data-profile-name="${comparisonEscape(profile.name)}" title="${comparisonEscape(profile.name)}"><img src="${comparisonEscape(profileLogo(profile))}" alt="${comparisonEscape(profile.name)}"></button>`).join('');
      return `<details class="comparison-source-group"><summary>${label} (${matches.length})</summary><div>${logos}</div></details>`;
    }).join('');
  }
  function comparisonQuestion(question, index, profile, mode) {
    const mine = answerFor(userAnswers, question.id); const theirs = answerFor(profileRows(profile), question.id); const sim = similarity(mine, theirs);
    const answers = question.answers.map(answer => `<div class="comparison-scale${rowLabel(mine) === answer.label ? ' comparison-mine' : ''}${rowLabel(theirs) === answer.label ? ' comparison-theirs' : ''}"><span>${comparisonEscape(answer.label)}</span>${mode === 'catalogue' ? `<div class="comparison-source-groups">${profileAnswerGroups(question, answer)}</div>` : ''}</div>`).join('');
    const state = sim === null ? 'brak danych' : sim === 100 ? 'zgodne' : sim >= 50 ? 'częściowo zgodne' : 'niezgodne';
    const notes = (mine?.note || theirs?.note) ? `<div class="comparison-notes">${mine?.note ? `<p><strong>Uzasadnienie swojej odpowiedzi:</strong> ${comparisonEscape(mine.note)}</p>` : ''}${theirs?.note ? `<p><strong>Uzasadnienie odpowiedzi ${comparisonEscape(profile.name)}:</strong> ${comparisonEscape(theirs.note)}</p>` : ''}</div>` : '';
    return `<details class="comparison-question" data-state="${state}" data-value-match="${questionMatchesValue(question, document.getElementById('comparison-value-filter')?.value) ? 'yes' : 'no'}"><summary>${index + 1}. ${comparisonEscape(question.text)}</summary><div class="comparison-question-body"><p class="comparison-full-question">${comparisonEscape(question.text)}</p>${mode === 'friend' ? `<div class="comparison-answer-pair"><span><strong>Ty:</strong> ${comparisonEscape(rowLabel(mine))}</span><span><strong>${comparisonEscape(profile.name)}:</strong> ${comparisonEscape(rowLabel(theirs))}</span><b class="comparison-state ${state.replaceAll(' ', '-')}">${state}</b></div>` : `<p><strong>${comparisonEscape(profile.name)}:</strong> ${comparisonEscape(rowLabel(theirs))}</p>`}<div class="comparison-scale-list">${answers}</div>${notes}</div></details>`;
  }
  function renderComparison() {
    const panel = document.getElementById('comparison-panel'); if (!panel || !config) return;
    const tab = panel.querySelector('input[name="comparison-tab"]:checked')?.value || 'catalogue';
    const select = document.getElementById('comparison-profile'); const profile = selectedComparisonProfile();
    const filter = document.getElementById('comparison-difference-filter')?.value || 'all';
    const value = document.getElementById('comparison-value-filter')?.value || '';
    const source = tab === 'friend' ? allComparisonProfiles().filter(item => item.type === 'friend') : allComparisonProfiles().filter(item => item.type !== 'friend');
    if (select) {
      const current = profile?.name || ''; select.innerHTML = '';
      source.forEach(item => { const option = document.createElement('option'); option.value = item.name; option.dataset.type = item.type; option.textContent = `${item.type === 'friend' ? 'Znajomy' : item.type}: ${item.name}`; select.appendChild(option); });
      if ([...select.options].some(option => option.value === current)) select.value = current;
    }
    const chosen = selectedComparisonProfile(); const body = panel.querySelector('.comparison-results');
    if (!chosen) { body.innerHTML = `<p class="muted-small">${tab === 'friend' ? 'Dodaj kod znajomego, aby rozpocząć porównanie.' : 'Brak dostępnych profili.'}</p>`; return; }
    const theirs = profileRows(chosen); const rows = config.questions.filter(question => questionMatchesValue(question, window.DEV_MODE ? value : '')).filter(question => {
      if (tab !== 'friend' || filter === 'all') return true; const state = similarity(answerFor(userAnswers, question.id), answerFor(theirs, question.id)); return filter === 'same' ? state === 100 : state !== null && state < 100;
    });
    const average = tab === 'friend' ? Math.round(rows.map(question => similarity(answerFor(userAnswers, question.id), answerFor(theirs, question.id))).filter(Number.isFinite).reduce((sum, item, _, array) => sum + item / array.length, 0)) : null;
    body.innerHTML = `${tab === 'friend' ? `<div class="comparison-summary"><strong>${average || 0}% zgodności z ${comparisonEscape(chosen.name)}</strong><span><i style="width:${average || 0}%"></i></span></div>` : ''}<div class="comparison-list">${rows.slice(0, comparisonLimit).map((question, index) => comparisonQuestion(question, index, chosen, tab)).join('') || '<p class="muted-small">Brak pytań dla wybranego filtra.</p>'}</div>`;
    body.querySelectorAll('.comparison-profile-logo').forEach(button => button.addEventListener('click', () => profilePopup(allComparisonProfiles().find(item => item.type === button.dataset.profileType && item.name === button.dataset.profileName))));
  }
  function ensureComparisonPanel() {
    if (document.getElementById('comparison-panel') || !resultsDiv) return;
    const panel = document.createElement('section'); panel.id = 'comparison-panel'; panel.className = 'comparison-panel';
    const values = [...new Set(config?.questions?.flatMap(question => question.answers.flatMap(answer => [...(answer.values_for || []), ...(answer.values_against || [])])) || [])].sort();
    panel.innerHTML = `<h3>Porównywarka</h3><div class="comparison-tabs"><label><input type="radio" name="comparison-tab" value="catalogue" checked> Porównaj z...</label><label><input type="radio" name="comparison-tab" value="friend"> Ze znajomym</label></div><div class="comparison-import"><input id="comparison-friend-name" maxlength="40" placeholder="Nazwa wyniku / znajomego"><textarea id="comparison-friend-code" rows="2" placeholder="Wklej kod importowy znajomego lub starego wyniku"></textarea><button id="comparison-add-friend" type="button">Dodaj wynik</button></div><div class="comparison-controls"><select id="comparison-profile"></select><select id="comparison-difference-filter"><option value="all">Wszystkie pytania</option><option value="same">Tylko zgodne</option><option value="different">Tylko różne</option></select>${window.DEV_MODE ? `<select id="comparison-value-filter"><option value="">Wszystkie wartości</option>${values.map(value => `<option>${comparisonEscape(value)}</option>`).join('')}</select>` : ''}<button type="button" data-comparison-limit="more">+50 pytań</button><button type="button" data-comparison-limit="all">Pokaż wszystko</button><button type="button" data-comparison-expand="all">Rozwiń wszystkie</button></div><div class="comparison-results"></div>`;
    resultsDiv.appendChild(panel);
    panel.addEventListener('change', renderComparison);
    panel.querySelector('#comparison-add-friend').addEventListener('click', () => {
      const raw = panel.querySelector('#comparison-friend-code').value.trim(); const answers = parseAnyExport(raw); if (!answers.length) { showPopup('Nie znaleziono prawidłowych odpowiedzi w kodzie.'); return; }
      const name = panel.querySelector('#comparison-friend-name').value.trim() || `Znajomy ${importedComparisons.length + 1}`;
      importedComparisons.push({ name, answers, description: 'Wynik dodany do porównywarki.', logo: 'images/ALogo.svg' }); saveComparisonProfiles(); panel.querySelector('#comparison-friend-code').value = ''; panel.querySelector('#comparison-friend-name').value = ''; comparisonLimit = 50; renderComparison(); refreshComparisonOverlays();
    });
    panel.querySelectorAll('[data-comparison-limit]').forEach(button => button.addEventListener('click', () => { comparisonLimit = button.dataset.comparisonLimit === 'all' ? Infinity : comparisonLimit + 50; renderComparison(); }));
    panel.querySelector('[data-comparison-expand]').addEventListener('click', event => { const details = panel.querySelectorAll('.comparison-question'); const open = event.currentTarget.dataset.comparisonExpand === 'all'; details.forEach(item => item.open = open); event.currentTarget.dataset.comparisonExpand = open ? 'none' : 'all'; event.currentTarget.textContent = open ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'; });
    renderComparison();
  }
  function refreshComparisonOverlays(compassOverride) {
    const compass = compassOverride || window.compassInstance || window.modalCompassInstance; if (!compass?.addOverlay) return;
    importedComparisons.forEach(profile => { const scores = computeScoresForAnswers(profile.answers.filter(row => row.answerData), currentScoringMode); const coords = computeCoordinatesFromValues(buildUserValuesMap(scores.pairResults), currentCompassMode, currentCreativeConfig); compass.addOverlay(profile.logo, coords.x, coords.y, 'user', profile.name, profile.description); });
  }
  const baseOverlaysWithComparisons = window.loadOverlays || loadOverlays;
  window.loadOverlays = async function (...args) { const result = await baseOverlaysWithComparisons(...args); refreshComparisonOverlays(args[2]); return result; };
  loadOverlays = window.loadOverlays;
  const baseResultsWithComparison = computeAndDisplayResults;
  window.computeAndDisplayResults = function () { baseResultsWithComparison(); ensureComparisonPanel(); renderComparison(); refreshComparisonOverlays(); };
  computeAndDisplayResults = window.computeAndDisplayResults;

  const baseSetupSimulationWithFigures = window.setupSimulation || setupSimulation;
  window.setupSimulation = function () { baseSetupSimulationWithFigures(); const select = document.getElementById('simulateSelect'); if (!select || !politicalProfiles?.figures?.length || select.querySelector('optgroup[data-figures]')) return; const group = document.createElement('optgroup'); group.label = 'Figury polityczne'; group.dataset.figures = 'true'; politicalProfiles.figures.forEach(profile => { const option = document.createElement('option'); option.value = `figure:${profile.name}`; option.textContent = profile.name; group.appendChild(option); }); select.appendChild(group); };
  setupSimulation = window.setupSimulation;
  const baseSimulateWithFigures = window.simulateAnswers || simulateAnswers;
  window.simulateAnswers = function (selected) { if (String(selected).startsWith('figure:')) { const name = String(selected).slice(7); const figure = (politicalProfiles?.figures || []).find(profile => profile.name === name); const rows = figure && profileRows(figure).filter(row => row.answerData); if (rows?.length) { simulatedEntity = { type: 'figure', name }; userAnswers = rows; renderQuestions(); computeAndDisplayResults(); return; } } baseSimulateWithFigures(selected); };
  simulateAnswers = window.simulateAnswers;

  document.addEventListener('DOMContentLoaded', () => { ensureBear(); });
})();

(() => {
  'use strict';
  const state = { questions: [], profiles: [], friends: [], mine: new Map(), selected: new Set(), expanded: false };
  const $ = id => document.getElementById(id);
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const label = type => ({ ideology:'Ideologia', party:'Partia', user:'Użytkownik', figure:'Figura', friend:'Import' })[type] || 'Profil';
  const profiles = () => state.profiles.concat(state.friends);
  const chosen = () => profiles().filter(p => state.selected.has(p.id));

  function theme() { const dark = localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && matchMedia('(prefers-color-scheme: dark)').matches); document.body.classList.toggle('dark', dark); $('comparison-theme').textContent = dark ? '☀️' : '🌙'; }
  function parse(raw) {
    const map = new Map(), notes = new Map(), source = String(raw || ''); let m;
    const note = /(?:^|[;\n])\s*(\d+)#(?:opis|note)\s*:\s*([^\r\n;]*)/gi;
    while ((m = note.exec(source))) { try { notes.set(+m[1], decodeURIComponent(m[2])); } catch (_) { notes.set(+m[1], m[2]); } }
    const answer = /(?:\[id:|(?:^|[;\n])\s*)(\d+)\]?\s*:\s*\(([^)]*)\)/g;
    while ((m = answer.exec(source))) map.set(+m[1], { label: m[2].split(',').map(v => v.trim()).find(Boolean) || '', note: notes.get(+m[1]) || '' });
    return map;
  }
  function mapFor(profile) {
    if (profile.answerMap) return profile.answerMap;
    if (Array.isArray(profile.answers)) return new Map(profile.answers.map(row => [+row.questionId, { label: row.answerData?.label || row.label || '', note: row.note || '' }]));
    return parse(profile.exportCode);
  }
  function answer(question, raw) {
    if (!raw?.label || /^(brak odpowiedzi|neither|pomiń|skip)$/i.test(raw.label)) return null;
    const item = question.answers.find(a => norm(a.label) === norm(raw.label));
    return item ? Object.assign({}, item, { note: raw.note || '' }) : null;
  }
  function similarity(first, second) { if (!first || !second) return null; const distance = Math.abs(+first.value - +second.value); return distance === 0 ? 100 : distance <= 1 ? 67 : distance <= 2 ? 17 : 0; }
  function scoreState(score) { return score === null ? ['brak danych','state-empty'] : score === 100 ? ['zgodne','state-same'] : score >= 50 ? ['częściowo zgodne','state-partial'] : ['różne','state-different']; }
  function activeTypes() { return new Set([...document.querySelectorAll('.profile-type-toggles input:checked')].map(input => input.value)); }

  function picker() {
    const root = $('profile-picker'), query = norm($('profile-search').value), types = activeTypes();
    root.replaceChildren();
    profiles().filter(p => types.has(p.type)).filter(p => !query || norm(p.name + ' ' + p.type + ' ' + (p.tags || []).join(' ')).includes(query)).forEach(p => {
      const row = document.createElement('label'); row.className = 'profile-choice' + (state.selected.has(p.id) ? ' selected' : '');
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = state.selected.has(p.id);
      input.onchange = () => { input.checked ? state.selected.add(p.id) : state.selected.delete(p.id); picker(); render(); };
      const image = document.createElement('img'); image.src = p.logo || 'images/ALogo.svg'; image.alt = ''; image.loading = 'lazy';
      const words = document.createElement('span'); words.innerHTML = '<strong>' + esc(p.name) + '</strong><small>' + label(p.type) + '</small>';
      row.append(input, image, words); root.append(row);
    });
    if (!root.children.length) root.textContent = 'Brak profili dla tego wyszukiwania.';
  }
  function valueMatch(question, mine) {
    const value = $('value-filter').value, kind = document.querySelector('input[name="mapping"]:checked').value;
    if (!value) return true;
    const present = a => a && (kind === 'for' ? [a.values_for] : kind === 'against' ? [a.values_against] : [a.values_for, a.values_against]).some(list => (list || []).includes(value));
    return $('value-scope').value === 'my-answer' ? present(mine) : question.answers.some(present);
  }
  function visible(row, selected) {
    const query = norm($('comparison-search').value), mode = $('comparison-filter').value;
    if (query && !norm(row.question.text + ' ' + (row.question.description || '')).includes(query)) return false;
    const scores = selected.map(p => similarity(row.mine, answer(row.question, mapFor(p).get(+row.question.id))));
    if (mode === 'same' && (!scores.length || !scores.every(score => score === 100))) return false;
    if (mode === 'different' && !scores.some(score => score !== null && score < 100)) return false;
    if (mode === 'answered' && !row.mine) return false;
    if (mode === 'notes' && !row.mine?.note && !selected.some(p => answer(row.question, mapFor(p).get(+row.question.id))?.note)) return false;
    return valueMatch(row.question, row.mine);
  }
  function cards(rows, selected) {
    const root = $('comparison-scorecards'); root.replaceChildren();
    selected.forEach(p => {
      const scores = rows.map(row => similarity(row.mine, answer(row.question, mapFor(p).get(+row.question.id)))).filter(Number.isFinite);
      const percent = scores.length ? Math.round(scores.reduce((a,b) => a + b, 0) / scores.length) : 0;
      const card = document.createElement('article'); card.className = 'comparison-scorecard';
      card.innerHTML = '<img src="' + esc(p.logo || 'images/ALogo.svg') + '" alt=""><div><strong>' + esc(p.name) + '</strong><small>' + scores.length + ' wspólnych odpowiedzi</small></div><b>' + percent + '%</b>';
      root.append(card);
    });
  }
  function answerBlock(profile, theirs) {
    const score = similarity(null, theirs), status = scoreState(score);
    return '<article class="profile-answer"><header><img src="' + esc(profile.logo || 'images/ALogo.svg') + '" alt=""><strong>' + esc(profile.name) + '</strong><small>' + label(profile.type) + '</small></header><p>' + esc(theirs?.label || 'Brak odpowiedzi') + '</p>' + (theirs?.note ? '<aside class="answer-note"><small>Uzasadnienie</small>' + esc(theirs.note) + '</aside>' : '') + '</article>';
  }
  function rowHTML(row, index, selected) {
    const comparisons = selected.map(p => answerBlock(p, answer(row.question, mapFor(p).get(+row.question.id)))).join('');
    const values = [...(row.mine?.values_for || []).map(v => '<span class="value-chip for">+ ' + esc(v) + '</span>'), ...(row.mine?.values_against || []).map(v => '<span class="value-chip against">− ' + esc(v) + '</span>')].join('');
    const overall = selected.length ? similarity(row.mine, answer(row.question, mapFor(selected[0]).get(+row.question.id))) : null, stateLabel = scoreState(overall);
    return '<details class="comparison-row"' + (state.expanded ? ' open' : '') + '><summary><span class="question-index">' + (index + 1) + '</span><span class="question-summary">' + esc(row.question.text) + (values ? '<span class="question-values">' + values + '</span>' : '') + '</span><b class="comparison-state-pill ' + stateLabel[1] + '">' + stateLabel[0] + '</b></summary><div class="comparison-row-body"><p class="comparison-question-description">' + esc(row.question.description || 'Brak dodatkowego opisu tezy.') + '</p><div class="my-answer"><small>Twoja odpowiedź</small><strong>' + esc(row.mine?.label || 'Brak odpowiedzi') + '</strong>' + (row.mine?.note ? '<aside class="answer-note"><small>Twoje uzasadnienie</small>' + esc(row.mine.note) + '</aside>' : '') + '</div><div class="profile-answer-grid">' + comparisons + '</div></div></details>';
  }
  function render() {
    const selected = chosen(), rows = state.questions.map(question => ({ question, mine: answer(question, state.mine.get(+question.id)) })).filter(row => visible(row, selected));
    $('comparison-title').textContent = selected.length ? 'Ty i ' + selected.length + (selected.length === 1 ? ' profil' : ' profile') : 'Wybierz profile do porównania';
    $('comparison-subtitle').textContent = selected.length ? selected.slice(0, 3).map(p => p.name).join(' · ') + (selected.length > 3 ? ' +' + (selected.length - 3) : '') : 'Zaznacz co najmniej jeden profil po lewej stronie.';
    cards(rows, selected); $('comparison-status').textContent = 'Pokazano ' + rows.length + ' z ' + state.questions.length + ' pytań' + (selected.length ? ' · porównanie z ' + selected.length + ' profilami.' : '.');
    $('comparison-list').innerHTML = !selected.length ? '<p class="comparison-empty">Wybierz jeden lub kilka profili. Możesz łączyć ideologie, partie, figury, użytkowników i importowane wyniki.</p>' : !rows.length ? '<p class="comparison-empty">Nie znaleziono pytań spełniających wybrane filtry.</p>' : rows.map((row, index) => rowHTML(row, index, selected)).join('');
  }
  function values() { [...new Set(state.questions.flatMap(q => q.answers.flatMap(a => (a.values_for || []).concat(a.values_against || []))))].sort((a,b) => a.localeCompare(b, 'pl')).forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; $('value-filter').append(option); }); }
  function addFriend() {
    const name = $('friend-name').value.trim() || 'Znajomy ' + (state.friends.length + 1), answerMap = parse($('friend-code').value);
    if (!answerMap.size) { $('friend-message').textContent = 'Nie rozpoznano odpowiedzi w kodzie eksportu.'; return; }
    const friend = { id: 'friend:' + Date.now(), type: 'friend', name, answerMap, logo: 'images/ALogo.svg' }; state.friends.push(friend); state.selected.add(friend.id);
    localStorage.setItem('neoAutystykComparisonProfiles', JSON.stringify(state.friends.map(p => ({ name:p.name, exportCode:[...p.answerMap].map(item => item[0] + ':(' + item[1].label + ');' + (item[1].note ? '\n' + item[0] + '#opis:' + encodeURIComponent(item[1].note) : '')).join('\n'), logo:p.logo }))));
    $('friend-name').value = ''; $('friend-code').value = ''; $('friend-message').textContent = 'Dodano „' + name + '” do aktywnego porównania.'; picker(); render();
  }
  async function load() {
    try {
      const manifest = await fetch('data-parts/manifest.json').then(r => r.json()), profileData = await fetch('political_profiles.json').then(r => r.json()), parts = await Promise.all(manifest.parts.map(part => fetch(part.file).then(r => r.json())));
      state.questions = parts.flatMap(part => part.questions || []);
      state.profiles = [['ideology',profileData.ideologies],['party',profileData.parties],['user',profileData.users],['figure',profileData.figures]].flatMap(pair => (pair[1] || []).map((p, index) => Object.assign({}, p, { type:pair[0], id:pair[0] + ':' + (p.key || p.name || index) })));
      state.friends = JSON.parse(localStorage.getItem('neoAutystykComparisonProfiles') || '[]').map((p, index) => Object.assign({}, p, { type:'friend', id:'friend:saved:' + index, answerMap:mapFor(p) }));
      state.mine = parse(sessionStorage.getItem('neoAutystykExportCode') || localStorage.getItem('neoAutystykExportCode') || ''); values(); picker(); render();
    } catch (error) { console.error(error); $('comparison-title').textContent = 'Nie udało się wczytać porównywarki'; $('comparison-status').textContent = 'Odśwież stronę po uruchomieniu aplikacji przez serwer HTTP.'; }
  }
  $('comparison-theme').onclick = () => { localStorage.setItem('theme', document.body.classList.contains('dark') ? 'light' : 'dark'); theme(); };
  $('profile-search').oninput = picker; document.querySelectorAll('.profile-type-toggles input').forEach(input => input.onchange = picker);
  ['comparison-search','comparison-filter','value-filter','value-scope'].forEach(id => $(id).addEventListener(id === 'comparison-search' ? 'input' : 'change', render)); document.querySelectorAll('input[name="mapping"]').forEach(input => input.onchange = render);
  $('clear-profiles').onclick = () => { state.selected.clear(); picker(); render(); }; $('clear-filters').onclick = () => { $('comparison-search').value = ''; $('comparison-filter').value = 'all'; $('value-filter').value = ''; $('value-scope').value = 'my-answer'; document.querySelector('input[name="mapping"][value="any"]').checked = true; render(); };
  $('expand-all').onclick = () => { state.expanded = !state.expanded; $('expand-all').textContent = state.expanded ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'; render(); }; $('copy-view').onclick = async () => { try { await navigator.clipboard.writeText($('comparison-list').innerText); $('copy-view').textContent = 'Skopiowano'; setTimeout(() => $('copy-view').textContent = 'Kopiuj widok', 1200); } catch (_) {} }; $('friend-add').onclick = addFriend;
  theme(); load();
})();

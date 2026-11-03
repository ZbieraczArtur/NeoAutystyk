/* Wybór wariantu testu, tryb listy i tryb pojedynczych kart. */
(() => {
    const modeFiles = {
        short: 'tests/skrocony.json',
        balanced: 'tests/zbalansowany.json'
    };
    const SESSION_KEY = 'neoAutystyk.session.v1';
    let modes = null,
        started = false,
        navigation = null,
        viewMode = 'cards',
        viewChoiceDialog = null;
    let selectedIds = [],
        queue = [],
        currentId = null,
        postponed = new Set(),
        autoAdvance = false,
        listFilter = 'all',
        navOnlyPostponed = false;
    let settingsDialog;
    async function loadModes() {
        const entries = await Promise.all(Object.entries(modeFiles).map(async ([key, file]) => {
            const response = await fetch(file);
            if (!response.ok) throw new Error(`Nie udało się wczytać ${file}`);
            return [key, await response.json()];
        }));
        return Object.fromEntries(entries);
    }

    function idsFromDefinition(d) {
        if (Array.isArray(d.questionIds)) return new Set(d.questionIds.map(Number));
        const r = d.questionIds;
        return new Set(Array.from({
            length: r.to - r.from + 1
        }, (_, i) => r.from + i));
    }

    function idsFor(mode) {
        const all = window.NeoDataParts.allQuestionIds();
        return mode === 'full' ? all : all.filter(id => idsFromDefinition(modes[mode]).has(Number(id)));
    }

    function updateCounts() {
        ['full', 'balanced', 'short'].forEach(mode => document.querySelectorAll(`[data-question-count="${mode}"]`).forEach(n => n.textContent = idsFor(mode).length));
    }

    function answerRows() {
        return window.NeoDataParts.getUserAnswers();
    }

    function answered(id) {
        return answerRows().some(a => Number(a.questionId) === Number(id) && a.answerData);
    }

    function skipped(id) {
        const a = answerRows().find(a => Number(a.questionId) === Number(id) && a.answerData);
        return !!a && Number(a.answerValue) === 0;
    }

    function visibleQuestionIds() {
        const visible = window.__visibleTestQuestionIds;
        if (!Array.isArray(visible)) return selectedIds;
        const visibleSet = new Set(visible.map(Number));
        return selectedIds.filter(id => visibleSet.has(Number(id)));
    }

    function countLabel(count, singular, few, many) {
        const n = Math.abs(Number(count)) % 100;
        const last = n % 10;
        const form = n === 1 ? singular : last >= 2 && last <= 4 && (n < 12 || n > 14) ? few : many;
        return `${count} ${form}`;
    }

    function saveSession() {
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                mode: document.body.dataset.testMode,
                view: viewMode,
                selectedIds,
                queue,
                currentId,
                postponed: [...postponed],
                autoAdvance,
                listFilter,
                largeText: document.body.classList.contains('large-question-text'),
                reducedMotion: document.body.classList.contains('reduced-motion'),
                answers: answerRows()
            }));
            document.body.dataset.saved = 'true';
            if (navigation?.querySelector('[data-save-status]')) navigation.querySelector('[data-save-status]').textContent = 'Zapisano na tym urządzeniu';
        } catch (_) {
            if (navigation?.querySelector('[data-save-status]')) navigation.querySelector('[data-save-status]').textContent = 'Zapis niedostępny';
        }
    }

    function loadSession() {
        try {
            return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        } catch (_) {
            return null;
        }
    }

    function metadata() {
        return {
            mode: document.body.dataset.testMode || 'full',
            view: viewMode,
            selectedIds,
            queue,
            currentId,
            postponed: [...postponed],
            autoAdvance,
            listFilter,
            largeText: document.body.classList.contains('large-question-text'),
            reducedMotion: document.body.classList.contains('reduced-motion')
        };
    }

    function applyMetadata(meta) {
        if (meta && Array.isArray(meta.selectedIds)) window.__pendingSessionMeta = meta;
    }

    function createViewChoiceDialog() {
        if (viewChoiceDialog) return viewChoiceDialog;
        const d = document.createElement('dialog');
        d.className = 'test-view-choice-dialog';
        d.innerHTML = `<form method="dialog" class="test-view-choice-card"><button class="choice-back" type="submit" aria-label="Wróć">←</button><p class="section-eyebrow">WYBIERZ SPOSÓB PRACY</p><h2>Jak chcesz rozwiązywać test?</h2><p>Możesz w każdej chwili zmienić odpowiedź i wrócić do wcześniejszego pytania.</p><div class="test-view-choice-options"><button type="button" data-test-view="continuous"><span class="choice-icon">▤</span><strong>Tryb listy</strong><span>Wszystkie pytania kolejno na jednej stronie.</span><small>Przewijaj, porównuj i odpowiadaj we własnym rytmie.</small></button><button type="button" data-test-view="cards"><span class="choice-icon">▣</span><strong>Tryb kart</strong><span>Jedno pytanie na ekranie.</span><small>Skup się na tezie i przechodź dalej nawigacją.</small></button></div></form>`;
        document.body.appendChild(d);
        viewChoiceDialog = d;
        return d;
    }

    function ensureNavigation() {
        navigation?.remove();
        navigation = document.createElement('section');
        navigation.className = `card-navigation ${viewMode === 'cards' ? 'cards-navigation' : 'list-navigation'}`;
        navigation.innerHTML = viewMode === 'cards'
            ? `<div class="card-nav-top"><span data-progress aria-live="polite"></span><div class="progress-track" aria-label="Postęp testu"><span></span></div></div><div class="card-nav-tools" aria-label="Narzędzia testu"><button type="button" data-action="pause">Ⅱ Pauza</button><button type="button" data-action="settings">⚙ Ustawienia</button><button type="button" data-action="toggle-panel" aria-expanded="false">☷ Nawiguj po pytaniach</button><span data-save-status aria-live="polite">Zapisywanie…</span></div><div class="question-nav-panel" hidden><div class="nav-search-row"><input type="search" placeholder="Szukaj po treści, ID lub numerze" aria-label="Szukaj pytania"><button type="button" data-action="postponed" aria-pressed="false">Pokaż odłożone</button></div><div class="nav-shortcuts"><button type="button" data-jump="-5">−5</button><button type="button" data-jump="-1">−1</button><button type="button" data-action="current">Aktualne</button><button type="button" data-jump="1">+1</button><button type="button" data-jump="5">+5</button></div><div class="question-nav-results"></div><p class="status-legend">○ Bez odpowiedzi　✓ Odpowiedziano　– Pominięto　↪ Odłożono</p></div><div class="card-nav-bottom"><button type="button" data-action="prev">← Poprzednie</button><button type="button" data-action="next">Następne →</button></div>`
            : `<div class="list-progress-summary"><span data-progress aria-live="polite"></span><div class="progress-track" aria-label="Postęp odpowiedzi"><span></span></div></div><div class="list-filter-bar" role="group" aria-label="Filtruj pytania">${[['all','Wszystkie'],['unanswered','Bez odpowiedzi'],['answered','Odpowiedziane'],['skipped','Pominięte'],['postponed','Odłożone']].map(([key,label]) => `<button type="button" data-list-filter="${key}" aria-pressed="${key === listFilter}"><span>${label}</span><b data-filter-count="${key}">0</b></button>`).join('')}</div><div class="list-nav-tools"><button type="button" data-action="pause">Ⅱ Pauza i eksport</button><span data-save-status aria-live="polite">Zapisywanie…</span></div>`;
        questionsContainer.before(navigation);
        const $ = (s) => navigation.querySelector(s);
        $('[data-action="pause"]').onclick = pauseTest;
        if (viewMode === 'cards') {
            $('[data-action="prev"]').onclick = () => jumpRelative(-1);
            $('[data-action="next"]').onclick = () => {
                if (currentIndex() >= queue.length - 1) document.getElementById('submitBtn')?.click();
                else jumpRelative(1);
            };
            $('[data-action="settings"]').onclick = showSettings;
            $('[data-action="toggle-panel"]').onclick = (e) => {
                const panel = $('.question-nav-panel');
                panel.hidden = !panel.hidden;
                e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
                if (!panel.hidden) renderNavResults();
            };
            $('[data-action="current"]').onclick = () => jumpTo(currentId);
            $('[data-action="postponed"]').onclick = (e) => {
                navOnlyPostponed = !navOnlyPostponed;
                e.currentTarget.setAttribute('aria-pressed', String(navOnlyPostponed));
                e.currentTarget.textContent = navOnlyPostponed ? 'Pokaż wszystkie' : 'Pokaż odłożone';
                renderNavResults();
            };
            navigation.querySelectorAll('[data-jump]').forEach(b => b.onclick = () => jumpRelative(Number(b.dataset.jump)));
            $('[type="search"]').oninput = () => renderNavResults();
        } else {
            navigation.querySelectorAll('[data-list-filter]').forEach(button => {
                button.onclick = () => {
                    listFilter = button.dataset.listFilter;
                    updateNavigation();
                    saveSession();
                };
            });
        }
    }

    function currentIndex() {
        return Math.max(0, queue.indexOf(Number(currentId)));
    }

    function updateNavigation({ preserveQuestionId = null } = {}) {
        if (!navigation) return;
        const listIds = viewMode === 'continuous' ? visibleQuestionIds() : selectedIds;
        const rows = answerRows().filter(a => a.answerData && listIds.includes(Number(a.questionId)));
        const skippedCount = rows.filter(a => Number(a.answerValue) === 0).length;
        const answeredCount = rows.length - skippedCount;
        const total = listIds.length;
        const postponedCount = listIds.filter(id => postponed.has(id)).length;
        if (viewMode === 'cards') {
            const i = currentIndex();
            navigation.querySelector('[data-progress]').textContent = `Pytanie ${i + 1} z ${queue.length} · ${countLabel(rows.length, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')}`;
            navigation.querySelector('.progress-track span').style.width = `${queue.length ? ((i + 1) / queue.length) * 100 : 0}%`;
            navigation.querySelector('[data-action="prev"]').disabled = i === 0;
            navigation.querySelector('[data-action="next"]').textContent = i >= queue.length - 1 ? 'Zakończ test' : 'Następne →';
        } else {
            navigation.querySelector('[data-progress]').textContent = `${countLabel(answeredCount, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')} · ${countLabel(skippedCount, 'pytanie pominięte', 'pytania pominięte', 'pytań pominiętych')} · ${countLabel(postponedCount, 'pytanie odłożone', 'pytania odłożone', 'pytań odłożonych')}`;
            navigation.querySelector('.progress-track span').style.width = `${total ? (rows.length / total) * 100 : 0}%`;
            const counts = {
                all: total,
                unanswered: listIds.filter(id => !answered(id)).length,
                answered: listIds.filter(id => answered(id) && !skipped(id)).length,
                skipped: listIds.filter(id => skipped(id)).length,
                postponed: listIds.filter(id => postponed.has(id)).length
            };
            navigation.querySelectorAll('[data-list-filter]').forEach(button => {
                const filter = button.dataset.listFilter;
                button.setAttribute('aria-pressed', String(filter === listFilter));
                button.querySelector('[data-filter-count]').textContent = counts[filter];
            });
            applyListFilter(preserveQuestionId);
        }
    }
    async function showQuestion(id) {
        if (!selectedIds.includes(Number(id))) return;
        currentId = Number(id);
        await window.NeoDataParts.activateQuestions(viewMode === 'cards' ? [currentId] : selectedIds);
        renderQuestions();
        questionsContainer.classList.toggle('cards-view', viewMode === 'cards');
        questionsContainer.classList.toggle('list-view', viewMode === 'continuous');
        if (viewMode === 'cards') {
            const card = questionsContainer.querySelector('.question-card');
            const ordinal = selectedIds.indexOf(currentId) + 1;
            const label = card?.querySelector('.question-text');
            if (label) label.innerText = `${ordinal}. ${window.NeoDataParts.getQuestion(currentId)?.text||label.innerText.replace(/^\d+\.\s*/,'')}`;
            addPostponeControls(card ? [card] : []);
        } else {
            addPostponeControls([...questionsContainer.querySelectorAll('.question-card')]);
        }
        updateNavigation();
        saveSession();
    }
    async function showList() {
        if (!selectedIds.includes(Number(currentId))) currentId = queue[0] ?? selectedIds[0];
        await window.NeoDataParts.activateQuestions(selectedIds);
        renderQuestions();
        questionsContainer.classList.add('list-view');
        questionsContainer.classList.remove('cards-view');
        addPostponeControls([...questionsContainer.querySelectorAll('.question-card')]);
        updateNavigation();
        saveSession();
    }

    function jumpRelative(delta) {
        if (viewMode !== 'cards') return;
        const next = Math.max(0, Math.min(queue.length - 1, currentIndex() + delta));
        showQuestion(queue[next]);
    }

    function jumpTo(id) {
        if (viewMode === 'continuous') {
            currentId = Number(id);
            document.querySelector(`.question-card[data-id="${Number(id)}"]`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            updateNavigation();
            saveSession();
            return;
        }
        showQuestion(Number(id));
    }
    function addPostponeControls(cards) {
        cards.forEach(card => {
            const id = Number(card.dataset.id);
            if (!Number.isFinite(id) || card.querySelector('.defer-question')) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'defer-question';
            button.dataset.questionId = String(id);
            button.setAttribute('aria-pressed', String(postponed.has(id)));
            button.textContent = postponed.has(id) ? '↪ Odłożone · przywróć' : '↪ Odłóż na później';
            button.onclick = () => togglePostponed(id);
            card.querySelector('.question-text')?.after(button);
        });
    }

    function togglePostponed(id) {
        id = Number(id);
        const wasPostponed = postponed.has(id);
        if (wasPostponed) postponed.delete(id);
        else postponed.add(id);

        let next;
        if (viewMode === 'cards' && !wasPostponed && autoAdvance && id === Number(currentId) && currentIndex() < queue.length - 1) {
            const current = currentIndex();
            queue = queue.filter(x => x !== id);
            queue.push(id);
            next = queue[current];
        } else if (viewMode === 'cards' && wasPostponed) {
            queue.sort((a, b) => selectedIds.indexOf(a) - selectedIds.indexOf(b));
        }

        questionsContainer.querySelectorAll(`.defer-question[data-question-id="${id}"]`).forEach(button => {
            button.setAttribute('aria-pressed', String(postponed.has(id)));
            button.textContent = postponed.has(id) ? '↪ Odłożone · przywróć' : '↪ Odłóż na później';
        });
        saveSession();
        if (next !== undefined) showQuestion(next);
        else updateNavigation();
    }

    function applyListFilter(preserveQuestionId = null) {
        if (viewMode !== 'continuous') return;
        questionsContainer.querySelectorAll('.question-card').forEach(card => {
            const id = Number(card.dataset.id);
            const hasAnswer = answered(id) || skipped(id);
            const matches = listFilter === 'all'
                || (listFilter === 'unanswered' && !hasAnswer)
                || (listFilter === 'answered' && answered(id) && !skipped(id))
                || (listFilter === 'skipped' && skipped(id))
                || (listFilter === 'postponed' && postponed.has(id));
            card.hidden = !matches && (preserveQuestionId == null || id !== Number(preserveQuestionId));
        });
    }
    async function renderNavResults(onlyPostponed = false) {
        const box = navigation.querySelector('.question-nav-results'),
            query = navigation.querySelector('[type="search"]').value.trim().toLocaleLowerCase('pl');
        await window.NeoDataParts.ensureQuestions(selectedIds);
        const matches = selectedIds.map((id, i) => ({
            id,
            i,
            q: window.NeoDataParts.getQuestion(id)
        })).filter(x => (!navOnlyPostponed || postponed.has(x.id)) && (!query || String(x.id).includes(query) || String(x.i + 1) === query || String(x.q?.text || '').toLocaleLowerCase('pl').includes(query))).slice(0, 100);
        box.replaceChildren();
        matches.forEach(({
            id,
            i,
            q
        }) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'nav-question';
            const status = postponed.has(id) ? '↪ Odłożono' : skipped(id) ? '– Pominięto' : answered(id) ? '✓ Odpowiedziano' : '○ Bez odpowiedzi';
            b.innerHTML = `<b>${i+1} · ID ${id}</b><span>${status}</span><small>${(q?.text||'').slice(0,160)}</small>`;
            b.onclick = () => {
                if (viewMode === 'cards') {
                    queue = queue.filter(x => x !== id);
                    queue.splice(Math.min(i, queue.length), 0, id);
                }
                jumpTo(id);
                box.closest('.question-nav-panel').hidden = true;
            };
            box.appendChild(b);
        });
        if (!matches.length) box.textContent = 'Brak pasujących pytań.';
    }

    function onAnswerSelected(id, { isNewAnswer = false } = {}) {
        id = Number(id);
        updateNavigation({ preserveQuestionId: viewMode === 'continuous' ? id : null });
        saveSession();
        if (viewMode === 'cards' && autoAdvance && isNewAnswer) setTimeout(() => {
            if (Number(currentId) === id && currentIndex() < queue.length - 1) jumpRelative(1);
        }, 0);
    }
    document.addEventListener('neoAnswerSelected', event => {
        onAnswerSelected(event.detail?.questionId, event.detail || {});
    });
    document.addEventListener('neoQuestionDeferred', event => {
        const id = Number(event.detail?.questionId);
        if (Number.isFinite(id)) togglePostponed(id);
    });

    function deferCurrent() {
        togglePostponed(currentId);
    }

    function pauseTest() {
        saveSession();
        const dialog = document.createElement('dialog');
        dialog.className = 'pause-dialog';
        let code = '';
        let exportError = '';
        try {
            code = typeof generateExportCode === 'function' ? generateExportCode() : '';
            if (!code) throw new Error('Generator kodu odpowiedzi nie jest dostępny.');
        } catch (error) {
            exportError = error?.message || 'Nie udało się przygotować kodu wznowienia.';
        }
        const progress = viewMode === 'cards'
            ? `pytanie ${currentIndex() + 1} z ${queue.length}`
            : `${answerRows().filter(a => a.answerData && selectedIds.includes(Number(a.questionId))).length} odpowiedzi w trybie listy`;
        dialog.innerHTML = `<form method="dialog"><p class="section-eyebrow">POSTĘP ZAPISANY</p><h2>Test wstrzymany</h2><p>${answerRows().filter(a=>a.answerData).length} odpowiedzi · ${progress}</p><label for="pause-code">Kod wznowienia</label><textarea id="pause-code" readonly rows="5" aria-describedby="pause-export-status"></textarea><p id="pause-export-status" class="pause-export-status" role="status" aria-live="polite"></p><div class="pause-actions"><button type="button" data-copy>Kopiuj kod</button><button value="resume" class="primary">Wróć do testu</button></div></form>`;
        dialog.querySelector('textarea').value = code;
        const status = dialog.querySelector('[data-export-status], #pause-export-status');
        const copyButton = dialog.querySelector('[data-copy]');
        if (exportError) {
            status.textContent = `Błąd eksportu: ${exportError}`;
            status.dataset.state = 'error';
            copyButton.disabled = true;
        } else {
            status.textContent = 'Kod NA4 gotowy. Zawiera zapisane odpowiedzi, pominięcia, odłożone pytania i uzasadnienia.';
            status.dataset.state = 'success';
        }
        copyButton.onclick = async () => {
            try {
                await navigator.clipboard.writeText(code);
                copyButton.textContent = 'Skopiowano ✓';
                status.textContent = 'Kod został skopiowany do schowka.';
                status.dataset.state = 'success';
            } catch (_) {
                dialog.querySelector('textarea').select();
                status.textContent = 'Nie udało się skopiować automatycznie. Kod został zaznaczony — skopiuj go ręcznie.';
                status.dataset.state = 'error';
            }
        };
        document.body.appendChild(dialog);
        dialog.addEventListener('close', () => dialog.remove());
        dialog.showModal();
    }

    function showSettings() {
        if (!settingsDialog) {
            settingsDialog = document.createElement('dialog');
            settingsDialog.className = 'pause-dialog';
            settingsDialog.innerHTML = `<form method="dialog"><p class="section-eyebrow">DOPASUJ DO SIEBIE</p><h2>Ustawienia testu</h2><label data-auto-row><input type="checkbox" data-auto> Automatycznie przechodź po wyborze odpowiedzi</label><label><input type="checkbox" data-large> Większy tekst pytań</label><label><input type="checkbox" data-reduced> Ogranicz animacje</label><div class="pause-actions"><button value="close" class="primary">Gotowe</button></div></form>`;
            document.body.appendChild(settingsDialog);
            settingsDialog.querySelector('[data-auto]').onchange = e => {
                autoAdvance = e.target.checked;
                if (navigation.querySelector('.auto-setting input')) navigation.querySelector('.auto-setting input').checked = autoAdvance;
                saveSession();
            };
            settingsDialog.querySelector('[data-large]').onchange = e => {
                document.body.classList.toggle('large-question-text', e.target.checked);
                saveSession();
            };
            settingsDialog.querySelector('[data-reduced]').onchange = e => {
                document.body.classList.toggle('reduced-motion', e.target.checked);
                saveSession();
            };
        }
        settingsDialog.querySelector('[data-auto]').checked = autoAdvance;
        settingsDialog.querySelector('[data-auto-row]').hidden = viewMode !== 'cards';
        settingsDialog.querySelector('[data-large]').checked = document.body.classList.contains('large-question-text');
        settingsDialog.querySelector('[data-reduced]').checked = document.body.classList.contains('reduced-motion');
        settingsDialog.showModal();
    }
    async function beginTest(mode, selectedView, restored = null, meta = null) {
        selectedIds = [...new Set(idsFor(mode).map(Number))];
        const selected = new Set(selectedIds);
        const manifest = await window.NeoDataParts.initialize();
        viewMode = selectedView || 'cards';
        window.__selectedTestQuestionIds = selectedIds;
        window.NeoQuestionQueue?.reset?.();
        userAnswers = Array.isArray(restored) ? restored : [];
        queue = meta?.queue?.map(Number).filter(id => selected.has(id)) || [...selectedIds];
        selectedIds.forEach(id => {
            if (!queue.includes(id)) queue.push(id);
        });
        postponed = new Set((meta?.postponed || []).map(Number).filter(id => selected.has(id)));
        autoAdvance = viewMode === 'cards' && !!meta?.autoAdvance;
        listFilter = ['all', 'unanswered', 'answered', 'skipped', 'postponed'].includes(meta?.listFilter) ? meta.listFilter : 'all';
        document.body.classList.toggle('large-question-text', !!meta?.largeText);
        document.body.classList.toggle('reduced-motion', !!meta?.reducedMotion);
        window.resetQuestionReview?.();
        window.resetQuestionPagination?.();
        document.body.classList.remove('landing-active');
        document.body.dataset.testMode = mode;
        document.body.dataset.testView = viewMode;
        ensureNavigation();
        if (!started) {
            started = true;
            initApp();
            setupSimulation();
            setupMatchingModeSelector();
            setupModeSelector();
            setupImportExport();
            setupLanguageSelector();
        } else resultsDiv.style.display = 'none';
        currentId = Number(meta?.currentId) || queue[0] || selectedIds[0];
        if (!queue.includes(currentId)) currentId = queue[0];
        if (viewMode === 'cards') await showQuestion(currentId);
        else await showList();
        document.getElementById('submitBtn').hidden = viewMode === 'cards';
        document.getElementById('disclaimer').hidden = false;
        window.dispatchEvent(new CustomEvent('neoAutystykTestStarted', {
            detail: {
                mode,
                view: viewMode,
                restored: !!restored
            }
        }));
        saveSession();
    }
    window.NeoTestModes = {
        beginTest,
        metadata,
        applyMetadata,
        onAnswerSelected,
        saveSession,
        goTo: (id) => jumpTo(id),
        pause: pauseTest,
        resumeImported: (rows, meta) => beginTest(meta?.mode || 'full', meta?.view || 'cards', rows, meta),
        isPostponed: id => postponed.has(Number(id))
    };

    function chooseViewAndBegin(mode) {
        const d = createViewChoiceDialog();
        d.querySelectorAll('[data-test-view]').forEach(b => b.onclick = async () => {
            d.close();
            try {
                await beginTest(mode, b.dataset.testView);
            } catch (e) {
                console.error(e);
                showPopup?.('Nie udało się uruchomić wybranego widoku testu.');
            }
        });
        d.showModal();
    }
    async function initializeTestModes() {
        try {
            await window.NeoDataParts.initialize();
            modes = await loadModes();
            updateCounts();
            document.querySelectorAll('[data-test-mode]').forEach(b => {
                b.disabled = false;
                b.addEventListener('click', () => chooseViewAndBegin(b.dataset.testMode));
            });
            const session = loadSession();
            if (session?.mode) {
                const c = document.getElementById('continue-test');
                c.hidden = false;
                c.onclick = () => beginTest(session.mode, session.view, session.answers, session);
            }
        } catch (e) {
            console.error(e);
            document.querySelector('.test-mode-selector')?.insertAdjacentHTML('beforeend', '<p class="test-mode-error">Nie udało się wczytać wariantów testu.</p>');
        }
    }
    window.addEventListener('neoAutystykConfigReady', initializeTestModes, {
        once: true
    });
    window.addEventListener('keydown', e => {
        if (viewMode !== 'cards' || document.body.classList.contains('landing-active') || e.target.matches('input,textarea,select,[contenteditable="true"]')) return;
        if (e.key === 'ArrowLeft') jumpRelative(-1);
        if (e.key === 'ArrowRight') jumpRelative(1);
    });
})();

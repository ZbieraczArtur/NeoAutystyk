(() => {
    'use strict';
    const state = {
        questions: [],
        profiles: [],
        mine: new Map(),
        selected: new Set(),
        expanded: false,
        maps: new Map()
    };
    const $ = id => document.getElementById(id);
    const esc = value => String(value || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    } [c]));
    const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const label = type => ({
        ideology: 'Ideologia',
        party: 'Partia',
        figure: 'Figura',
        user: 'Użytkownik'
    })[type] || 'Profil';
    const selected = () => state.profiles.filter(p => state.selected.has(p.id));

    function applyTheme() {
        const dark = localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && matchMedia('(prefers-color-scheme: dark)').matches);
        document.body.classList.toggle('dark', dark);
        $('comparison-theme').textContent = dark ? '☀️' : '🌙';
    }

    function parse(raw) {
        const map = new Map();
        let m;
        const re = /(?:\[id:|(?:^|[;\n])\s*)(\d+)\]?\s*:\s*\(([^)]*)\)/g;
        while ((m = re.exec(String(raw || '')))) map.set(+m[1], {
            label: m[2].split(',').map(x => x.trim()).find(Boolean) || ''
        });
        return map;
    }

    function profileMap(profile) {
        if (!state.maps.has(profile.id)) state.maps.set(profile.id, parse(profile.exportCode));
        return state.maps.get(profile.id);
    }

    function answer(question, raw) {
        if (!raw?.label) return null;
        if (/^neither$/i.test(raw.label)) return localStorage.getItem('neoAutystykDeveloperMode') === 'true' ? {
            label: 'Neither',
            neither: true
        } : null;
        if (/^(brak odpowiedzi|pomiń|skip)$/i.test(raw.label)) return {
            label: 'Pomiń',
            skipped: true
        };
        return question.answers.find(a => norm(a.label) === norm(raw.label)) || {
            label: raw.label,
            unavailable: true
        };
    }

    function profileAnswer(question, profile) {
        return answer(question, profileMap(profile).get(+question.id));
    }

    function activeTypes() {
        return new Set([...document.querySelectorAll('.profile-type-toggles input:checked')].map(x => x.value));
    }

    function picker() {
        const root = $('profile-picker'),
            query = norm($('profile-search').value),
            types = activeTypes();
        root.replaceChildren();
        state.profiles.filter(p => types.has(p.type)).filter(p => !query || norm(`${p.name} ${p.type} ${(p.tags || []).join(' ')}`).includes(query)).forEach(p => {
            const row = document.createElement('label');
            row.className = 'profile-choice' + (state.selected.has(p.id) ? ' selected' : '');
            row.innerHTML = `<input type="checkbox" ${state.selected.has(p.id)?'checked':''}><img src="${esc(p.logo||'images/ALogo.svg')}" alt=""><span><strong>${esc(p.name)}</strong><small>${label(p.type)}</small></span>`;
            row.querySelector('input').onchange = e => {
                e.target.checked ? state.selected.add(p.id) : state.selected.delete(p.id);
                picker();
                render();
            };
            root.append(row);
        });
        if (!root.children.length) root.textContent = 'Brak profili dla tego wyszukiwania.';
    }

    function visible(question) {
        const query = norm($('comparison-search').value),
            mode = $('comparison-filter').value,
            mine = answer(question, state.mine.get(+question.id));
        if (query && !norm(`${question.id} ${question.text} ${question.description||''}`).includes(query)) return false;
        if (mode === 'answered' && !mine) return false;
        if (mode === 'different' && selected().length && !selected().some(p => {
                const a = profileAnswer(question, p);
                return a && mine && a.value !== mine.value;
            })) return false;
        return true;
    }

    function icon(profile) {
        return `<button class="comparison-profile-icon" type="button" data-profile="${esc(profile.id)}" title="${esc(profile.name)}"><img src="${esc(profile.logo||'images/ALogo.svg')}" alt="${esc(profile.name)}"><span>${esc(profile.name)}</span></button>`;
    }

    function row(question) {
        const mine = answer(question, state.mine.get(+question.id)),
            groups = new Map();
        state.profiles.forEach(p => {
            const a = profileAnswer(question, p);
            if (!a) return;
            const key = a.neither ? 'Neither' : a.skipped ? 'Pomiń' : a.label;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(p);
        });
        const lanes = [...groups].map(([name, people]) => `<div class="comparison-answer-lane"><div class="comparison-answer-label"><strong>${esc(name)}</strong><small>${people.length} profili</small></div><div class="comparison-icon-strip">${people.map(icon).join('')}</div></div>`).join('') || '<p class="comparison-empty">Brak zapisanych stanowisk profili dla tej tezy.</p>';
        return `<details class="comparison-row" ${state.expanded?'open':''}><summary><span class="question-index">#${esc(question.id)}</span><span class="question-summary">${esc(question.text)}</span>${mine?`<b class="comparison-state-pill">Twoja: ${esc(mine.label)}</b>`:''}</summary><div class="comparison-row-body"><p class="comparison-question-description">${esc(question.description||'Brak dodatkowego opisu tezy.')}</p><div class="comparison-answer-groups">${lanes}</div></div></details>`;
    }

    function cards() {
        const root = $('comparison-scorecards');
        root.replaceChildren();
        selected().forEach(p => {
            let total = 0,
                count = 0;
            state.questions.forEach(q => {
                const a = answer(q, state.mine.get(+q.id)),
                    b = profileAnswer(q, p);
                if (!a || !b || !Number.isFinite(a.value) || !Number.isFinite(b.value)) return;
                count++;
                total += a.value === b.value ? 100 : Math.abs(a.value - b.value) <= 1 ? 67 : Math.abs(a.value - b.value) <= 2 ? 17 : 0;
            });
            const c = document.createElement('article');
            c.className = 'comparison-scorecard';
            c.innerHTML = `<img src="${esc(p.logo||'images/ALogo.svg')}" alt=""><div><strong>${esc(p.name)}</strong><small>${count} wspólnych odpowiedzi</small></div><b>${count?Math.round(total/count)+'%':'—'}</b>`;
            root.append(c);
        });
    }

    function openProfile(id) {
        const p = state.profiles.find(x => x.id === id);
        if (!p) return;
        $('profile-modal-title').textContent = p.name;
        $('profile-modal-type').textContent = label(p.type);
        $('profile-modal-description').textContent = p.description || 'Brak opisu.';
        $('profile-modal-image').src = p.logo || 'images/ALogo.svg';
        $('profile-modal').showModal();
    }

    function render() {
        const rows = state.questions.filter(visible),
            n = selected().length;
        $('comparison-title').textContent = n ? `Porównanie: ${n} ${n===1?'profil':'profili'}` : 'Wszystkie tezy i stanowiska';
        $('comparison-subtitle').textContent = n ? 'Wybrane profile są podsumowane wyżej; niżej nadal widać całą bazę.' : 'Wybór profilu nie jest wymagany — rozwiń tezę, aby przejrzeć wszystkie stanowiska.';
        cards();
        $('comparison-status').textContent = `Pokazano ${rows.length} z ${state.questions.length} tez · profile są pogrupowane według odpowiedzi.`;
        $('comparison-list').innerHTML = rows.length ? rows.map(row).join('') : '<p class="comparison-empty">Nie znaleziono tez spełniających filtr.</p>';
        $('comparison-list').querySelectorAll('[data-profile]').forEach(b => b.onclick = () => openProfile(b.dataset.profile));
    }
    async function load() {
        try {
            const [manifest, data] = await Promise.all([fetch('data-parts/manifest.json').then(r => r.json()), fetch('political_profiles.json').then(r => r.json())]);
            const parts = await Promise.all(manifest.parts.map(x => fetch(x.file).then(r => r.json())));
            state.questions = parts.flatMap(x => x.questions || []).sort((a, b) => Number(a.id) - Number(b.id));
            state.profiles = [
                ['ideology', data.ideologies],
                ['party', data.parties],
                ['user', data.users],
                ['figure', data.figures]
            ].flatMap(([type, list]) => (list || []).map((p, i) => ({
                ...p,
                type,
                id: `${type}:${p.key||p.name||i}`
            })));
            state.mine = parse(sessionStorage.getItem('neoAutystykExportCode') || localStorage.getItem('neoAutystykExportCode') || '');
            picker();
            render();
        } catch (e) {
            console.error(e);
            $('comparison-title').textContent = 'Nie udało się wczytać porównywarki';
        }
    }
    $('comparison-theme').onclick = () => {
        localStorage.setItem('theme', document.body.classList.contains('dark') ? 'light' : 'dark');
        applyTheme();
    };
    $('profile-search').oninput = picker;
    document.querySelectorAll('.profile-type-toggles input').forEach(x => x.onchange = picker);
    ['comparison-search', 'comparison-filter'].forEach(id => $(id).addEventListener(id === 'comparison-search' ? 'input' : 'change', render));
    $('clear-profiles').onclick = () => {
        state.selected.clear();
        picker();
        render();
    };
    $('clear-filters').onclick = () => {
        $('comparison-search').value = '';
        $('comparison-filter').value = 'all';
        render();
    };
    $('expand-all').onclick = () => {
        state.expanded = !state.expanded;
        $('expand-all').textContent = state.expanded ? 'Zwiń wszystkie' : 'Rozwiń wszystkie';
        render();
    };
    $('copy-view').onclick = () => navigator.clipboard?.writeText($('comparison-list').innerText);
    $('profile-modal-close').onclick = () => $('profile-modal').close();
    applyTheme();
    load();
})();

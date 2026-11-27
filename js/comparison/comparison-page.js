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

    function profileRows(profile) {
        const rows = new Map();
        state.questions.forEach(q => {
            const a = profileAnswer(q, profile);
            if (a && !a.skipped && !a.neither && Number.isFinite(Number(a.value)) && Number(a.value) !== 0) rows.set(+q.id, a);
        });
        return rows;
    }
    function userRows() {
        const rows = new Map();
        state.questions.forEach(q => {
            const a = answer(q, state.mine.get(+q.id));
            if (a && !a.skipped && !a.neither && Number.isFinite(Number(a.value)) && Number(a.value) !== 0) rows.set(+q.id, a);
        });
        return rows;
    }
    function answerKind(a) {
        const text = norm(a?.label);
        if (/zdecydowanie.*zgadzam/.test(text) && !/nie zgadzam/.test(text)) return 'sa';
        if (/czesciowo.*zgadzam/.test(text) && !/nie zgadzam/.test(text)) return 'pa';
        if (/czesciowo.*nie zgadzam/.test(text)) return 'pd';
        if (/zdecydowanie.*nie zgadzam/.test(text)) return 'sd';
        const v = Number(a?.value);
        return Math.abs(v-1.5)<.01?'sa':Math.abs(v-.5)<.01?'pa':Math.abs(v+.5)<.01?'pd':Math.abs(v+1.5)<.01?'sd':null;
    }
    function pairScore(a,b) {
        const ak=answerKind(a), bk=answerKind(b);
        if (!ak || !bk) return norm(a?.label)===norm(b?.label) ? 1.5 : Math.sign(Number(a?.value))!==Math.sign(Number(b?.value)) ? -1.5 : 0;
        const table={sa:{sa:1.5,pa:.5,pd:-1,sd:-1.5},pa:{sa:1,pa:1.5,pd:-.5,sd:-1},pd:{sa:-1,pa:-.5,pd:1.5,sd:1},sd:{sa:-1.5,pa:-1,pd:.5,sd:1.5}};
        return table[bk][ak];
    }
    function compareRows(left,right) {
        let score=0,max=0,compared=0,agreements=0,differences=0;
        const details=[];
        state.questions.forEach(q=>{
            const a=left.get(+q.id),b=right.get(+q.id);
            if(!a||!b)return;
            const weight=Number(q.weight||1)*Math.abs(Number(a.value));
            const part=pairScore(a,b);
            score+=part*weight;max+=1.5*weight;compared++;
            if(part>0)agreements++; else if(part<0)differences++;
            const topics=[...new Set([...(a.values_for||[]),...(a.values_against||[]),...(b.values_for||[]),...(b.values_against||[])])];
            details.push({question:q,a,b,part,weight,topics});
        });
        const categories=new Map();
        details.forEach(item=>(item.topics.length?item.topics:['Tezy ogólne']).forEach(topic=>{
            const rec=categories.get(topic)||{score:0,max:0,count:0};rec.score+=item.part*item.weight;rec.max+=1.5*item.weight;rec.count++;categories.set(topic,rec);
        }));
        return {percent:max?Math.round(((score+max)/(2*max))*100):null,compared,agreements,differences,score,max,details,categories:[...categories].map(([name,r])=>({name,count:r.count,percent:Math.round(((r.score+r.max)/(2*r.max))*100)})).sort((a,b)=>b.count-a.count)};
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
        const mine=userRows();
        selected().forEach(p => {
            const result=compareRows(mine,profileRows(p));
            const c = document.createElement('article');
            c.className = 'comparison-scorecard';
            c.innerHTML = `<img src="${esc(p.logo||'images/ALogo.svg')}" alt=""><div><strong>${esc(p.name)}</strong><small>${result.compared} wspólnych tez · ${result.agreements} podobnych · ${result.differences} rozbieżnych</small></div><b>${result.percent===null?'—':result.percent+'%'}</b>`;
            c.title='Wynik liczony wyłącznie z tez, na które odpowiedziały obie strony.';
            root.append(c);
        });
        detailComparisons(mine);
    }

    function detailComparisons(mine) {
        const root=$('comparison-detail'); if(!root)return;
        root.replaceChildren();
        const people=selected();
        if(!people.length){root.textContent='Wybierz co najmniej jeden profil, aby zobaczyć zgodności, różnice i wspólne odpowiedzi.';return;}
        people.forEach(p=>{
            const result=compareRows(mine,profileRows(p));
            const details=document.createElement('details'); details.className='comparison-profile-detail';
            const summary=document.createElement('summary'); summary.textContent=`${p.name} · ${result.percent===null?'brak wspólnych odpowiedzi':`${result.percent}% zgodności`} · ${result.compared} wspólnych tez`;
            details.append(summary);
            const stats=document.createElement('div'); stats.className='comparison-detail-stats';
            stats.innerHTML=`<span><b>${result.compared}</b> wspólnych odpowiedzi</span><span><b>${result.agreements}</b> podobnych</span><span><b>${result.differences}</b> rozbieżnych</span><span><b>${Math.max(0,state.questions.length-result.compared)}</b> pominiętych lub bez wspólnej odpowiedzi</span>`; details.append(stats);
            const categoryDetails=document.createElement('details');categoryDetails.className='comparison-category-results';const categoryTitle=document.createElement('summary');categoryTitle.textContent='Wyniki według wartości przypisanych do wspólnych tez';categoryDetails.append(categoryTitle);
            const categoryList=document.createElement('div');categoryList.className='comparison-category-list';result.categories.forEach(category=>{const row=document.createElement('div');row.innerHTML=`<span>${esc(category.name)} <small>${category.count} tez</small></span><b>${category.percent}%</b>`;categoryList.append(row);});categoryDetails.append(categoryList);details.append(categoryDetails);
            const insights=document.createElement('div'); insights.className='comparison-insights';
            [['Największe podobieństwa',result.details.filter(x=>x.part>0).sort((a,b)=>b.part-a.part).slice(0,5)],['Największe różnice',result.details.filter(x=>x.part<0).sort((a,b)=>a.part-b.part).slice(0,5)]].forEach(([title,items])=>{
                const section=document.createElement('section'); const h=document.createElement('h4');h.textContent=title;section.append(h);
                const ul=document.createElement('ul');items.forEach(x=>{const li=document.createElement('li');li.textContent=`${x.question.text} · Ty: ${x.a.label} · ${p.name}: ${x.b.label}`;ul.append(li);});
                if(!items.length){const li=document.createElement('li');li.textContent='Brak danych.';ul.append(li);}section.append(ul);insights.append(section);
            }); details.append(insights);
            const shared=document.createElement('details');shared.className='comparison-shared-answers';const sh=document.createElement('summary');sh.textContent=`Wszystkie wspólne tezy (${result.compared})`;shared.append(sh);
            const list=document.createElement('div');list.className='comparison-shared-list';result.details.forEach(x=>{const row=document.createElement('article');row.innerHTML=`<strong>#${esc(x.question.id)} ${esc(x.question.text)}</strong><span>Ty: ${esc(x.a.label)} · ${esc(p.name)}: ${esc(x.b.label)}</span><small>Waga w porównaniu: ${Number(x.weight.toFixed(2))} · ${x.part>0?'podobne':x.part<0?'rozbieżne':'bez punktów'}</small>`;list.append(row);});shared.append(list);details.append(shared);
            root.append(details);
        });
        if(people.length>1){
            const h=document.createElement('h3');h.textContent='Porównanie wybranych profili między sobą';root.prepend(h);
            const pairGrid=document.createElement('div');pairGrid.className='comparison-pair-grid';
            for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){
                const a=people[i],b=people[j],r=compareRows(profileRows(a),profileRows(b));
                const card=document.createElement('article');card.innerHTML=`<strong>${esc(a.name)} ↔ ${esc(b.name)}</strong><b>${r.percent===null?'—':r.percent+'%'}</b><small>${r.compared} wspólnych tez · ${r.agreements} podobnych · ${r.differences} rozbieżnych</small>`;pairGrid.append(card);
            }
            root.insertBefore(pairGrid,root.children[1]||null);
        }
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
            const [manifest, data] = await Promise.all([fetch('data-parts/manifest.json').then(r => r.json()), window.loadPoliticalProfiles()]);
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
                id: `${type}:${p.key||p.id||p.name||i}`
            })));
            state.mine = parse(sessionStorage.getItem('neoAutystykExportCode') || localStorage.getItem('neoAutystykExportCode') || '');
            const params = new URLSearchParams(location.search);
            const preset = params.get('profile');
            const presetProfile = state.profiles.find(profile => profile.id === preset || profile.key === preset || profile.name === preset);
            if (presetProfile) state.selected.add(presetProfile.id);
            const presetIds = new Set((params.get('profiles') || '').split(',').filter(Boolean));
            state.profiles.filter(profile => presetIds.has(profile.id)).forEach(profile => state.selected.add(profile.id));
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

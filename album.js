(() => {
  'use strict';
  const TYPES = { party:'parties', ideology:'ideologies', figure:'figures', user:'users' };
  const LABELS = {
    party:{intro:'Wprowadzenie',history:'Historia',program:'Program',politicians:'Politycy'},
    ideology:{intro:'Wprowadzenie',history:'Historia',values:'Wartości',impact:'Wpływ',representatives:'Przedstawiciele',readings:'Lektury',terms:'Pojęcia'},
    figure:{intro:'Wprowadzenie',history:'Historia',views:'Poglądy',publicActivity:'Działalność publiczna',readings:'Lektury',legacy:'Dziedzictwo',quotes:'Cytaty'}
  };
  const TYPE_LABEL = { party:'Partie', ideology:'Ideologie', figure:'Figury', user:'Użytkownicy' };
  const FIELD_LABEL = {birth:'Data urodzenia',birthdate:'Data urodzenia',born:'Data urodzenia',death:'Data śmierci',deathdate:'Data śmierci',died:'Data śmierci',country:'Kraj',founded:'Data założenia',headquarters:'Siedziba',leader:'Lider',ideology:'Ideologia',status:'Status',type:'Typ',party:'Partia',name:'Nazwa',website:'Strona internetowa'};
  const $ = selector => document.querySelector(selector);
  const root = $('#album-grid'), dialog = $('#profile-dialog'), view = $('#profile-view');
  let db = null, active = 'party';
  const selectedTags = new Set();
  // A second, tabbed filter can be supplied by album-advanced-filters.js.
  let advancedTagFilter = () => true;
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem('neoAutystykFavorites') || '[]')); } catch { favorites = new Set(); }
  const profiles = () => db?.[TYPES[active]] || [];
  const allProfiles = () => Object.values(TYPES).flatMap(key => db?.[key] || []);
  const profileId = profile => String(profile.id || profile.key || profile.name);
  const escLabel = value => String(value || '').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').trim();
  const fieldLabel = value => FIELD_LABEL[escLabel(value).toLowerCase().replace(/\s/g,'')] || escLabel(value).replace(/^./, c => c.toLocaleUpperCase('pl'));
  function make(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function image(profile, className) {
    if (!profile.logo) return make('div', `profile-placeholder ${className || ''}`, (profile.name || '?').trim().slice(0,1).toLocaleUpperCase('pl'));
    const img = document.createElement('img'); img.className = className || ''; img.src = profile.logo; img.alt = ''; img.loading = 'lazy';
    img.addEventListener('error', () => { const fallback = make('div', `profile-placeholder ${className || ''}`, (profile.name || '?').trim().slice(0,1).toLocaleUpperCase('pl')); img.replaceWith(fallback); }, {once:true});
    return img;
  }
  function saveFavorites() { localStorage.setItem('neoAutystykFavorites', JSON.stringify([...favorites])); }
  function renderTags() {
    const tags = [...new Set(profiles().flatMap(profile => Array.isArray(profile.tags) ? profile.tags : []))].sort((a,b) => a.localeCompare(b,'pl'));
    const list = $('#album-tags'); list.replaceChildren();
    if (!tags.length) { list.append(make('small','album-hint','Brak tagów w tej kategorii.')); return; }
    tags.forEach(tag => {
      const button = make('button','tag-filter-chip',tag); button.type='button'; button.classList.toggle('active',selectedTags.has(tag)); button.setAttribute('aria-pressed',String(selectedTags.has(tag)));
      button.onclick = () => { selectedTags.has(tag) ? selectedTags.delete(tag) : selectedTags.add(tag); renderTags(); renderGrid(); };
      list.append(button);
    });
  }
  function filtered() {
    const query = $('#album-search').value.trim().toLocaleLowerCase('pl'), imageOnly = $('#album-with-image').checked, favoritesOnly = $('#album-favorites-only').checked;
    return profiles().filter(profile => {
      const haystack = [profile.name,profile.description,profile.country,...(profile.tags||[]),...Object.values(profile.infobox||{})].join(' ').toLocaleLowerCase('pl');
      return (!query || haystack.includes(query)) && (!imageOnly || profile.logo) && (!favoritesOnly || favorites.has(profileId(profile))) && [...selectedTags].every(tag => (profile.tags||[]).includes(tag)) && advancedTagFilter(profile);
    }).sort((a,b) => $('#album-sort').value==='type' ? String(a.type).localeCompare(String(b.type),'pl') || a.name.localeCompare(b.name,'pl') : a.name.localeCompare(b.name,'pl'));
  }
  function toggleFavorite(profile, button) {
    const id = profileId(profile);
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    saveFavorites(); button.classList.toggle('saved',favorites.has(id)); button.textContent = favorites.has(id) ? '♥' : '♡';
    button.setAttribute('aria-pressed',String(favorites.has(id))); button.setAttribute('aria-label',favorites.has(id)?'Usuń z zapisanych':'Zapisz profil');
    if ($('#album-favorites-only').checked) renderGrid();
  }
  function renderGrid() {
    const list = filtered(); $('#album-count').textContent = `${list.length} ${list.length===1?'profil':'profili'} · ${TYPE_LABEL[active].toLocaleLowerCase('pl')}`; root.replaceChildren();
    if (!list.length) { root.append(make('p','album-empty','Nie znaleziono profili. Zmień wyszukiwanie lub filtry.')); return; }
    list.forEach(profile => {
      const card = make('article','profile-card');
      const open = document.createElement('button'); open.type='button'; open.className='profile-card-main'; open.setAttribute('aria-label',`Otwórz profil: ${profile.name}`);
      open.append(image(profile,'profile-card-image'), make('strong','',profile.name), make('small','',(profile.tags||[]).slice(0,2).join(' · ') || TYPE_LABEL[active])); open.onclick=()=>openProfile(profileId(profile));
      const favorite=make('button','profile-favorite',favorites.has(profileId(profile))?'♥':'♡');favorite.type='button';favorite.classList.toggle('saved',favorites.has(profileId(profile)));favorite.setAttribute('aria-pressed',String(favorites.has(profileId(profile))));favorite.setAttribute('aria-label',favorites.has(profileId(profile))?'Usuń z zapisanych':'Zapisz profil');favorite.onclick=()=>toggleFavorite(profile,favorite);
      card.append(open,favorite); root.append(card);
    });
  }
  function openProfile(id) {
    const profile=allProfiles().find(item=>profileId(item)===id); if(!profile)return;
    view.replaceChildren(); view.className='profile-full';
    const main=make('main','profile-main'), hero=make('header','profile-hero');
    const type=make('span','profile-type',({party:'Partia polityczna',ideology:'Ideologia',figure:'Figura polityczna',user:'Profil użytkownika'})[profile.type]||'Profil');
    hero.append(type,make('h1','',profile.name)); if(profile.description) hero.append(make('p','',profile.description));
    const actions=make('nav','profile-actions'); actions.setAttribute('aria-label','Akcje profilu');
    const key=encodeURIComponent(profile.key||profile.id||profile.name);
    const simulation=document.createElement('a'); simulation.href=`index.html?simulate=${key}`; simulation.target='_blank'; simulation.rel='noopener'; simulation.textContent='Symuluj w teście głównym ↗';
    const compare=document.createElement('a'); compare.href=`comparison.html?profile=${key}`; compare.target='_blank'; compare.rel='noopener'; compare.textContent='Porównaj odpowiedzi ↗';
    const copy=make('button','profile-copy-link','Kopiuj link'); copy.type='button'; copy.onclick=async()=>{const url=new URL(`album.html#${encodeURIComponent(profileId(profile))}`,location.href).href;try{await navigator.clipboard.writeText(url);copy.textContent='Skopiowano';setTimeout(()=>copy.textContent='Kopiuj link',1600);}catch{location.hash=encodeURIComponent(profileId(profile));copy.textContent='Link w pasku adresu';}};
    actions.append(simulation,compare,copy); hero.append(actions); main.append(hero);
    const sections=LABELS[profile.type]||{}; let sectionCount=0;
    Object.entries(sections).forEach(([field,label])=>{if(typeof profile[field]!=='string'||!profile[field].trim())return;const block=make('section','profile-block');block.append(make('h2','',label),make('p','',profile[field]));main.append(block);sectionCount++;});
    if(!sectionCount) main.append(make('p','album-hint','Ten profil nie ma jeszcze rozwiniętych sekcji.'));
    const resultSection=make('section','profile-test-result');
    resultSection.append(make('h2','','Wynik z testu głównego'),make('p','album-hint','Kompas, bilans wartości i dopasowania wyliczone z odpowiedzi tego profilu.'));
    const preview=document.createElement('iframe'); preview.className='profile-result-frame'; preview.title=`Wynik testu głównego: ${profile.name}`; preview.loading='lazy';
    preview.src=`index.html?simulate=${encodeURIComponent(profile.key||profile.id||profile.name)}&embed=1`;
    preview.addEventListener('load',()=>{try{preview.contentWindow.postMessage({type:'neo-profile-results-height-request'},location.origin);}catch(_){}});
    resultSection.append(preview); main.append(resultSection);
    const aside=make('aside','profile-infobox'); aside.append(image(profile,'profile-infobox-image'));
    const info=profile.infobox && typeof profile.infobox==='object' ? Object.entries(profile.infobox).filter(([,value])=>value!==null&&value!==undefined&&String(value).trim()) : [];
    if(info.length){const dl=document.createElement('dl');info.forEach(([field,value])=>{dl.append(make('dt','',fieldLabel(field)),make('dd','',String(value)));});aside.append(dl);}
    view.append(main,aside); location.hash=encodeURIComponent(profileId(profile)); view.scrollTop=0; dialog.scrollTop=0; dialog.showModal();
  }
  function setType(type) { active=type; selectedTags.clear(); document.querySelectorAll('[data-type]').forEach(button=>{const chosen=button.dataset.type===type;button.classList.toggle('active',chosen);button.setAttribute('aria-current',chosen?'page':'false');});renderTags();renderGrid(); }
  document.querySelectorAll('[data-type]').forEach(button=>button.onclick=()=>setType(button.dataset.type));
  window.NeoAlbum = {
    setAdvancedTagFilter(predicate) { advancedTagFilter = typeof predicate === 'function' ? predicate : () => true; renderGrid(); },
    getProfiles: () => profiles(),
    getActiveType: () => active
  };
  $('#album-search').addEventListener('input',renderGrid); $('#album-sort').addEventListener('change',renderGrid); $('#album-with-image').addEventListener('change',renderGrid); $('#album-favorites-only').addEventListener('change',renderGrid);
  $('.dialog-close').onclick=()=>dialog.close(); dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}); dialog.addEventListener('close',()=>{history.replaceState(null,'',location.pathname);});
  window.addEventListener('message',event=>{if(event.origin!==location.origin||event.data?.type!=='neo-profile-results-height')return;const frame=view.querySelector('.profile-result-frame');if(frame&&event.source===frame.contentWindow)frame.style.height=`${Math.max(720,Number(event.data.height)||900)}px`;});
  window.loadPoliticalProfiles().then(data=>{db=data;const hash=decodeURIComponent(location.hash.slice(1));const profile=allProfiles().find(item=>profileId(item)===hash||item.id===hash||item.key===hash||item.name===hash);if(profile){active=profile.type;setType(active);openProfile(profileId(profile));}else setType(active);}).catch(()=>{root.textContent='Nie udało się wczytać bazy profili.';});
})();

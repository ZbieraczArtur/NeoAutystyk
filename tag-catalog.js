/*
 * Central tag taxonomy and profile filtering helpers.
 * Add or rename shared tags here; the album, results filters and compass read
 * the same catalog and matching rules.
 */
(function () {
  'use strict';

  const FIGURE_TAGS = {
    'Zawód / dziedzina': ['Filozof', 'Ekonomista', 'Polityk', 'Rewolucjonista', 'Wojskowy', 'Prawnik', 'Duchowny', 'Socjolog', 'Publicysta', 'Pisarz', 'Lekarz', 'Przedsiębiorca', 'Akademik', 'Planista', 'Politolog', 'Historyk', 'Działacz związkowy'],
    'Rola / urząd': ['Prezydent', 'Premier', 'Monarcha', 'Papież', 'Dyktator', 'Parlamentarzysta', 'Myśliciel społeczny', 'Kanclerz', 'Reformator', 'Założyciel partii/ruchu', 'Lider partii', 'Wiceprezydent / Zastępca szefa państwa', 'Minister', 'Dyplomata', 'Arystokrata', 'Dysydent', 'Samorządowiec'],
    Narodowość: ['Amerykańska', 'Polska', 'Brytyjska', 'Niemiecka', 'Francuska', 'Rosyjska', 'Włoska', 'Austriacka', 'Ukraińska', 'Indyjska', 'Hiszpańska', 'Kanadyjska', 'Chińska', 'Holenderska', 'Argentyńska', 'Czeska', 'Izraelska', 'Australijska', 'Japońska', 'Chilijska', 'Inna'],
    Status: ['Żyje', 'Martwy'],
    Płeć: ['Kobieta', 'Mężczyzna'],
    'Okres życia': ['XVII wiek', 'XVIII wiek', 'XIX wiek', 'XX wiek', 'XXI wiek'],
    Ideologia: ['Liberalizm', 'Liberalizm klasyczny', 'Socjalliberalizm', 'Ordoliberalizm', 'Liberalizm gospodarczy', 'Konserwatywny liberalizm', 'Libertarianizm', 'Anarchizm', 'Konserwatyzm', 'Chrześcijańska demokracja', 'Tradycjonalizm', 'Reakcjonizm', 'Fundamentalizm religijny', 'Agraryzm', 'Monarchizm', 'Republikanizm', 'Socjalizm', 'Socjalizm demokratyczny', 'Socjaldemokracja', 'Komunizm', 'Marksizm', 'Marksizm-Leninizm', 'Faszyzm', 'Nacjonalizm', 'Ekologizm', 'Korporacjonizm', 'Technokracja', 'Autorytaryzm', 'Demokracja'],
    'Kontynent działalności': ['Afryka', 'Ameryka Północna', 'Ameryka Południowa', 'Azja', 'Europa', 'Australia'],
    'Sposób dojścia do władzy / legitymizacja': ['Wybory demokratyczne', 'Zamach stanu / Coup', 'Dziedziczenie', 'Rewolucja', 'Nominacja / Kooptacja', 'Okupacja / Interwencja zewnętrzna'],
    Religia: ['Chrześcijaństwo', 'Katolicyzm', 'Prawosławie', 'Protestantyzm', 'Islam', 'Sunnizm', 'Szyizm', 'Ibadizm', 'Hinduizm', 'Buddyzm', 'Judaizm', 'Judaizm ortodoksyjny', 'Sikhizm', 'Taoizm', 'Konfucjanizm', 'Islamizm']
  };

  const IDEOLOGY_TAGS = {
    'Rodzina ideologiczna': ['Liberalizm', 'Konserwatyzm', 'Socjalizm', 'Nacjonalizm', 'Anarchizm', 'Libertarianizm', 'Faszyzm', 'Feminizm', 'Ekologizm', 'Fundamentalizm religijny', 'Agraryzm'],
    'Sposób koordynacji gospodarki': ['Gospodarka rynkowa', 'Gospodarka planowa', 'Gospodarka mieszana', 'Gospodarka zdecentralizowana', 'Gospodarka scentralizowana', 'Gospodarka pieniężna', 'Gospodarka bezpieniężna'],
    'Model gospodarczy i organizacja rynku': ['Kapitalizm', 'Wolny rynek', 'Leseferyzm', 'Interwencjonizm gospodarczy', 'Regulacjonizm gospodarczy', 'Korporacjonizm', 'Protekcjonizm', 'Wolny handel'],
    'Organizacja własności i produkcji': ['Prymat własności prywatnej', 'Prymat własności społecznej', 'Prymat własności państwowej', 'Uspołecznienie środków produkcji', 'Kolektywna organizacja produkcji', 'Samorządność pracownicza', 'Samorządność gospodarcza', 'Akumulacja kapitału', 'Rozproszenie własności'],
    'Rola państwa': ['Antyetatyzm', 'Etatyzm', 'Decentralizacja polityczna', 'Centralizacja polityczna', 'Ograniczony zakres państwa', 'Rozbudowany zakres państwa', 'Abolicja państwa', 'Pluralizm polityczny', 'Monopol polityczny'],
    'Podmiotowość społeczna': ['Indywidualizm', 'Kolektywizm', 'Komunitaryzm', 'Solidaryzm', 'Walka klas', 'Paternalizm społeczny'],
    'Metoda przemian politycznych': ['Reformizm', 'Rewolucjonizm', 'Gradualizm', 'Restauracjonizm', 'Reakcjonizm', 'Insurekcjonizm', 'Legalizm', 'Illegalizm']
  };

  const PARTY_TAGS = {
    'Status organizacyjny': ['Aktywna', 'Nieaktywna', 'Rozwiązana', 'Zdelegalizowana', 'Historyczna'],
    'Reprezentacja parlamentarna': ['Reprezentacja parlamentarna', 'Brak reprezentacji parlamentarnej', 'Reprezentacja regionalna', 'Reprezentacja lokalna', 'Reprezentacja w Parlamencie Europejskim', 'Reprezentacja w rządzie', 'Udział w koalicji rządowej'],
    'Sposób uczestnictwa w wyborach': ['Startuje w wyborach', 'Nie startuje w wyborach', 'Bojkot wyborów', 'Udział w koalicji wyborczej'],
    'Organizacja i zasięg działania': ['Partia ogólnokrajowa', 'Partia regionalna', 'Partia lokalna', 'Partia transnarodowa', 'Partia kadrowa', 'Partia masowa', 'Partia personalistyczna', 'Partia awangardowa'],
    'Pozycja w systemie partyjnym': ['Partia rządząca', 'Partia opozycyjna', 'Partia wspierająca rząd', 'Partia antysystemowa', 'Partia systemowa'],
    Ideologia: ['Liberalizm', 'Liberalizm klasyczny', 'Socjalliberalizm', 'Ordoliberalizm', 'Liberalizm gospodarczy', 'Konserwatywny liberalizm', 'Libertarianizm', 'Anarchizm', 'Konserwatyzm', 'Chrześcijańska demokracja', 'Tradycjonalizm', 'Reakcjonizm', 'Fundamentalizm religijny', 'Agraryzm', 'Monarchizm', 'Republikanizm', 'Socjalizm', 'Socjalizm demokratyczny', 'Socjaldemokracja', 'Komunizm', 'Marksizm', 'Marksizm-Leninizm', 'Faszyzm', 'Nacjonalizm', 'Ekologizm', 'Korporacjonizm', 'Technokracja', 'Autorytaryzm', 'Demokracja']
  };

  const CATALOG_BY_TYPE = {
    figure: FIGURE_TAGS,
    party: PARTY_TAGS,
    ideology: IDEOLOGY_TAGS,
    user: { ...FIGURE_TAGS, ...PARTY_TAGS, ...IDEOLOGY_TAGS }
  };

  // Backward-compatible union for existing result-page controls.
  const catalog = {};
  Object.values(CATALOG_BY_TYPE).forEach(groups => Object.entries(groups).forEach(([name, tags]) => {
    catalog[name] = [...new Set([...(catalog[name] || []), ...tags])];
  }));

  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pl').trim();

  function parseTemporalTag(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(.*?)\s*\(([^()]*)\)\s*\)?$/);
    if (!match) return { label: raw, temporal: false, ranges: [] };
    const ranges = [];
    for (const token of match[2].split(',').map(item => item.trim()).filter(Boolean)) {
      const period = token.match(/^(\d{1,4})\s*(?:[-–—]\s*(\d{1,4}|obecnie))?$/i);
      if (!period) return { label: raw, temporal: false, ranges: [] };
      const start = Number(period[1]);
      const end = period[2] ? (normalize(period[2]) === 'obecnie' ? new Date().getFullYear() : Number(period[2])) : start;
      ranges.push([Math.min(start, end), Math.max(start, end)]);
    }
    return ranges.length ? { label: match[1].trim(), temporal: true, ranges } : { label: raw, temporal: false, ranges: [] };
  }

  function parseYearQuery(value) {
    const match = String(value || '').trim().match(/^(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?$/);
    if (!match) return null;
    const first = Number(match[1]);
    const last = Number(match[2] || match[1]);
    return [Math.min(first, last), Math.max(first, last)];
  }

  function tagIsActive(tag, yearRange) {
    const parsed = parseTemporalTag(tag);
    if (!yearRange || !parsed.temporal) return true;
    return parsed.ranges.some(([start, end]) => start <= yearRange[1] && end >= yearRange[0]);
  }

  function profileType(profile) {
    const type = profile?.kind || profile?.type || '';
    return type === 'figures' ? 'figure' : type === 'parties' ? 'party' : type === 'ideologies' ? 'ideology' : type;
  }

  function profileTags(profile, options = {}) {
    const yearRange = options.year ? parseYearQuery(options.year) : null;
    const values = [];
    const add = value => {
      if (value === null || value === undefined) return;
      if (Array.isArray(value)) { value.forEach(add); return; }
      if (typeof value === 'object') { Object.values(value).forEach(add); return; }
      const parsed = parseTemporalTag(value);
      if (options.year && !yearRange) return;
      if (parsed.temporal && yearRange && !tagIsActive(value, yearRange)) return;
      values.push(parsed.label || String(value).trim());
    };
    add(profile?.tags || []);
    Object.values(profile?.tagGroups || {}).forEach(add);
    if (options.includeInfobox !== false) {
      Object.values(profile?.infobox || {}).forEach(add);
      add(profile?.country);
      add(profile?.ideology);
      add(profile?.religion);
    }
    return new Set(values.filter(Boolean));
  }

  function lifeRangeMatches(profile, yearRange) {
    const query = yearRange.join('-');
    if (window.NeoProfileLife?.matchesYear) return window.NeoProfileLife.matchesYear(profile, query);
    return false;
  }

  function matchesYear(profile, value) {
    const raw = String(value || '').trim();
    if (!raw) return true;
    const yearRange = parseYearQuery(raw);
    if (!yearRange) return false;
    const type = profileType(profile);
    if (type === 'figure' || type === 'user') return lifeRangeMatches(profile, yearRange);
    if (type !== 'party') return false;
    return (profile?.tags || []).some(tag => {
      const parsed = parseTemporalTag(tag);
      return parsed.temporal && parsed.ranges.some(([start, end]) => start <= yearRange[1] && end >= yearRange[0]);
    });
  }

  function matches(profile, selected, options = {}) {
    const groups = [...(selected instanceof Map ? selected : new Map([['tagi', selected || []]]))]
      .map(([group, tags]) => [group, [...(tags || [])]]).filter(([, tags]) => tags.length);
    const chosen = groups.flatMap(([, tags]) => tags);
    if (!chosen.length) return true;
    const own = new Set([...profileTags(profile, { year: options.year })].map(normalize));
    const hit = tag => own.has(normalize(tag));
    const count = chosen.filter(hit).length;
    const logic = options.logic || 'conditional';
    if (logic === 'or') return count > 0;
    if (logic === 'and') return count === chosen.length;
    if (logic === 'not') return count === 0;
    if (logic === 'threshold') return count >= Math.min(Number(options.minimumTags) || 1, chosen.length);
    return groups.every(([group, tags]) => {
      const found = tags.filter(hit).length;
      const operation = options.groupLogic?.get?.(group) || 'or';
      if (operation === 'and') return found === tags.length;
      if (operation === 'not') return found === 0;
      return found > 0;
    });
  }

  function groupsFor(type) {
    return CATALOG_BY_TYPE[type] || CATALOG_BY_TYPE.user;
  }

  window.NeoTagCatalog = Object.assign(window.NeoTagCatalog || {}, {
    catalog,
    catalogByType: CATALOG_BY_TYPE,
    groupsFor,
    profileTags,
    parseTemporalTag,
    parseYearQuery,
    matchesYear,
    matches
  });
})();

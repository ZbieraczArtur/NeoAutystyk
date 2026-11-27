// Stan aplikacji oraz leniwe ładowanie danych pytań.
let config = null;
let configBase = null;      // oryginalne dane z data.json (wartości, mapowania)
let politicalProfiles = null;
let translations = null;    // aktualne tłumaczenia (teksty)
let currentLanguage = 'pl';
let userAnswers = [];
let currentScoringMode = 'full';   // 'full' lub 'affirmative'
let currentMatchingMode = 'modern'; // 'modern' lub 'legacy'
let simulatedEntity = null;         // { type: 'party'|'ideology', name: string }
let answersBeforeSimulation = null;
// Dane pytań są ładowane na żądanie i pozostają w pamięci tylko raz.
let dataManifest = null;
const questionById = new Map();
const dataPartCache = new Map();
const dataPartRequests = new Map();
let conditionAnswerSource = null;
let conditionAnswerLength = -1;
let conditionAnswerState = new Map();

function registerDataPart(part) {
  (part?.questions || []).forEach(question => questionById.set(Number(question.id), question));
  return part;
}
async function initializeDataParts() {
  if (dataManifest) return dataManifest;
  const response = await fetch('data-parts/manifest.json');
  if (!response.ok) throw new Error('Nie udało się wczytać manifestu części testu');
  dataManifest = await response.json();
  return dataManifest;
}
async function loadDataPart(partId) {
  if (dataPartCache.has(partId)) return dataPartCache.get(partId);
  if (dataPartRequests.has(partId)) return dataPartRequests.get(partId);
  const request = (async () => {
    const manifest = await initializeDataParts();
    const entry = manifest.parts.find(part => Number(part.id) === Number(partId));
    if (!entry) throw new Error(`Nie znaleziono części testu ${partId}`);
    const response = await fetch(entry.file);
    if (!response.ok) throw new Error(`Nie udało się wczytać ${entry.file}`);
    const part = registerDataPart(await response.json());
    dataPartCache.set(partId, part);
    return part;
  })();
  dataPartRequests.set(partId, request);
  try { return await request; } finally { dataPartRequests.delete(partId); }
}
async function ensureQuestionData(questionIds) {
  const manifest = await initializeDataParts();
  const needed = new Set((questionIds || []).map(Number));
  await Promise.all(manifest.parts.filter(part => part.questionIds.some(id => needed.has(Number(id)))).map(part => loadDataPart(part.id)));
}
function conditionIsMet(condition) {
  if (conditionAnswerSource !== userAnswers || conditionAnswerLength !== userAnswers.length) {
    conditionAnswerSource = userAnswers;
    conditionAnswerLength = userAnswers.length;
    conditionAnswerState = new Map();
    userAnswers.forEach(row => {
      if (row.noteOnly || row.neither) return;
      const id = Number(row.questionId);
      const state = conditionAnswerState.get(id) || { positive: false, negative: false };
      if (Number(row.answerValue) > 0) state.positive = true;
      if (Number(row.answerValue) < 0) state.negative = true;
      conditionAnswerState.set(id, state);
    });
  }
  const positive = questionId => conditionAnswerState.get(Number(questionId))?.positive || false;
  const negative = questionId => conditionAnswerState.get(Number(questionId))?.negative || false;
  return normalizeConditionRequirements(condition).some(requirement =>
    requirement.yes.every(positive) && requirement.no.every(negative)
  );
}

// Pomocnik dla starszego zapisu: [1, 2] oznacza 1 AND 2, a
// [[1], [2, 3]] oznacza 1 OR (2 AND 3).
function normalizeRequirementGroups(requirement) {
  if (!Array.isArray(requirement) || !requirement.length) return [];
  return requirement.some(Array.isArray)
    ? requirement.filter(Array.isArray).map(group => group.map(Number).filter(Number.isFinite)).filter(group => group.length)
    : [requirement.map(Number).filter(Number.isFinite)];
}

function normalizeConditionIds(ids) {
  return Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite) : [];
}

// Nowy format jest listą alternatyw (OR). W każdej alternatywie wszystkie
// pozycje yes oraz no są wymagane jednocześnie (AND). Pozostawiamy pełną
// zgodność ze starymi require_yes / require_no, łącznie z ich grupami OR.
function normalizeConditionRequirements(condition) {
  if (Array.isArray(condition?.require)) {
    const alternatives = condition.require
      .filter(requirement => requirement && typeof requirement === 'object' && !Array.isArray(requirement))
      .map(requirement => ({
        yes: normalizeConditionIds(requirement.yes),
        no: normalizeConditionIds(requirement.no)
      }));
    return alternatives.length ? alternatives : [{ yes: [], no: [] }];
  }

  const yesGroups = normalizeRequirementGroups(condition?.require_yes);
  const noGroups = normalizeRequirementGroups(condition?.require_no);
  const yesAlternatives = yesGroups.length ? yesGroups : [[]];
  const noAlternatives = noGroups.length ? noGroups : [[]];
  return yesAlternatives.flatMap(yes => noAlternatives.map(no => ({ yes, no })));
}
function conditionQuestionIds(condition) {
  return normalizeConditionRequirements(condition).flatMap(requirement => [...requirement.yes, ...requirement.no]);
}
function hasConditionalDependency(questionId) {
  const id = Number(questionId);
  return (dataManifest?.conditionalQuestions || []).some(condition =>
    conditionQuestionIds(condition).some(dependencyId => Number(dependencyId) === id)
  );
}
function getCondition(questionId) {
  return dataManifest?.conditionalQuestions?.find(condition => Number(condition.id) === Number(questionId)) || null;
}
function activeQuestionIds(baseIds) {
  const manifest = dataManifest || { parts: [], conditionalQuestions: [] };
  const selected = new Set((window.__selectedTestQuestionIds || manifest.parts.flatMap(part => part.questionIds)).map(Number));
  const conditional = new Set((manifest.conditionalQuestions || []).map(condition => Number(condition.id)));
  // Pytania warunkowe nie mogą znaleźć się na liście tylko dlatego, że są w
  // manifeście. Dodajemy je wyłącznie po spełnieniu wymagań.
  const active = new Set(baseIds.map(Number).filter(id => !conditional.has(id)));
  (manifest.conditionalQuestions || []).forEach(condition => {
    if (selected.has(Number(condition.id)) && conditionIsMet(condition)) active.add(Number(condition.id));
  });
  return [...active];
}
async function activateQuestionData(questionIds) {
  const baseIds = (questionIds || []).map(Number);
  window.__baseTestQuestionIds = baseIds;
  await ensureQuestionData(baseIds);
  const ids = activeQuestionIds(baseIds);
  await ensureQuestionData(ids);
  // Konfiguracja zawiera wszystkie wybrane pytania, aby tryb deweloperski mógł
  // obejrzeć również ukryte tezy. Widok użytkownika opiera się na osobnej,
  // wyliczonej liście i nie renderuje ich przed spełnieniem requires.
  window.__activeTestQuestionIds = [...new Set(baseIds)];
  window.__visibleTestQuestionIds = ids;
  applyTranslationsToConfig();
}
async function refreshDynamicQuestionData() {
  return activateQuestionData(window.__baseTestQuestionIds || window.__activeTestQuestionIds || []);
}
window.NeoDataParts = {
  initialize: initializeDataParts, loadPart: loadDataPart, ensureQuestions: ensureQuestionData,
  activateQuestions: activateQuestionData, refreshDynamicQuestions: refreshDynamicQuestionData,
  getQuestion: questionId => questionById.get(Number(questionId)),
  getCondition, conditionIsMet, normalizeRequirementGroups, normalizeConditionRequirements, conditionQuestionIds,
  hasConditionalDependency,
  allQuestionIds: () => dataManifest?.parts.flatMap(part => part.questionIds.map(Number)) || [],
  // Read-only UI hook for progress persistence; it deliberately exposes no scoring internals.
  getUserAnswers: () => userAnswers
};

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
  const rowsFor = questionId => userAnswers.filter(row => Number(row.questionId) === Number(questionId) && !row.noteOnly);
  const positive = questionId => rowsFor(questionId).some(row => !row.neither && Number(row.answerValue) > 0);
  const negative = questionId => rowsFor(questionId).some(row => !row.neither && Number(row.answerValue) < 0);
  return (condition.require_yes || []).every(positive) && (condition.require_no || []).every(negative);
}
function activeQuestionIds(baseIds) {
  const selected = new Set((window.__selectedTestQuestionIds || dataManifest.parts.flatMap(part => part.questionIds)).map(Number));
  const active = new Set(baseIds.map(Number));
  (dataManifest.conditionalQuestions || []).forEach(condition => {
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
  window.__activeTestQuestionIds = ids;
  applyTranslationsToConfig();
}
async function refreshDynamicQuestionData() {
  return activateQuestionData(window.__baseTestQuestionIds || window.__activeTestQuestionIds || []);
}
window.NeoDataParts = {
  initialize: initializeDataParts, loadPart: loadDataPart, ensureQuestions: ensureQuestionData,
  activateQuestions: activateQuestionData, refreshDynamicQuestions: refreshDynamicQuestionData,
  getQuestion: questionId => questionById.get(Number(questionId)),
  allQuestionIds: () => dataManifest?.parts.flatMap(part => part.questionIds.map(Number)) || []
};

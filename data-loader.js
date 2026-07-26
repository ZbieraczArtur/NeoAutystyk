// Stan aplikacji oraz leniwe ładowanie danych pytań.
let config = null;
let configBase = null;      // oryginalne dane z data.json (wartoĹ›ci, mapowania)
let politicalProfiles = null;
let translations = null;    // aktualne tĹ‚umaczenia (teksty)
let currentLanguage = 'pl';
let userAnswers = [];
let currentScoringMode = 'full';   // 'full' lub 'affirmative'
let currentMatchingMode = 'modern'; // 'modern' lub 'legacy'
let simulatedEntity = null;         // { type: 'party'|'ideology', name: string }
let answersBeforeSimulation = null;
// Dane pytaĹ„ sÄ… Ĺ‚adowane na ĹĽÄ…danie i pozostajÄ… w pamiÄ™ci tylko raz.
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
  if (!response.ok) throw new Error('Nie udaĹ‚o siÄ™ wczytaÄ‡ manifestu czÄ™Ĺ›ci testu');
  dataManifest = await response.json();
  return dataManifest;
}
async function loadDataPart(partId) {
  if (dataPartCache.has(partId)) return dataPartCache.get(partId);
  if (dataPartRequests.has(partId)) return dataPartRequests.get(partId);
  const request = (async () => {
    const manifest = await initializeDataParts();
    const entry = manifest.parts.find(part => Number(part.id) === Number(partId));
    if (!entry) throw new Error(`Nie znaleziono czÄ™Ĺ›ci testu ${partId}`);
    const response = await fetch(entry.file);
    if (!response.ok) throw new Error(`Nie udaĹ‚o siÄ™ wczytaÄ‡ ${entry.file}`);
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
async function activateQuestionData(questionIds) {
  const ids = (questionIds || []).map(Number);
  await ensureQuestionData(ids);
  window.__activeTestQuestionIds = ids;
  applyTranslationsToConfig();
}
window.NeoDataParts = {
  initialize: initializeDataParts, loadPart: loadDataPart, ensureQuestions: ensureQuestionData,
  activateQuestions: activateQuestionData,
  allQuestionIds: () => dataManifest?.parts.flatMap(part => part.questionIds.map(Number)) || []
};

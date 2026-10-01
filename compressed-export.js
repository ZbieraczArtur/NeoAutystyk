/*
 * Compact answer codes (NA2)
 * --------------------------
 * The payload stores a question id and a choice index (0–6), never answer
 * labels.  Optional notes live in a separate dictionary.  Prefixing the
 * compressed Base64 with `NA2:` makes the format self-identifying and leaves
 * all previous, human-readable export codes untouched.
 */
(function () {
  'use strict';

  const PREFIX = 'NA2:';
  const FORMAT_VERSION = 2;
  const legacyGenerate = window.generateExportCode;
  const legacyImport = window.importAnswersFromExportCode;
  const legacyParse = window.parseExportCode;
  const legacyCompare = window.compareAnswersToReferenceProfile;

  function compactText(value) {
    return String(value || '').replace(/\s+/g, '');
  }

  function isCompactCode(value) {
    return compactText(value).startsWith(PREFIX);
  }

  function requireLzString() {
    if (!window.LZString || typeof window.LZString.compressToBase64 !== 'function') {
      throw new Error('Biblioteka LZ-String nie została wczytana. Sprawdź połączenie z internetem i odśwież stronę.');
    }
    return window.LZString;
  }

  function decodePayload(rawCode) {
    const source = compactText(rawCode);
    if (!source.startsWith(PREFIX)) return null;
    const decoded = requireLzString().decompressFromBase64(source.slice(PREFIX.length));
    if (!decoded) throw new Error('Kod NA2 jest uszkodzony lub niekompletny.');
    const payload = JSON.parse(decoded);
    if (!payload || payload.v !== FORMAT_VERSION || !Array.isArray(payload.a)) {
      throw new Error('To nie jest obsługiwany kod odpowiedzi NeoAutystyk.');
    }
    return payload;
  }

  function questionList() {
    return typeof config !== 'undefined' && Array.isArray(config?.questions) ? config.questions : [];
  }

  function currentAnswers() {
    return typeof userAnswers !== 'undefined' ? userAnswers : (window.userAnswers || []);
  }

  function rowsFromPayload(payload, questions = questionList()) {
    const byId = new Map(questions.map(question => [Number(question.id), question]));
    const notes = payload.d && typeof payload.d === 'object' ? payload.d : {};
    const rows = [];
    const seen = new Set();
    payload.a.forEach(entry => {
      if (!Array.isArray(entry) || entry.length < 2) return;
      const questionId = Number(entry[0]);
      const choice = Number(entry[1]);
      const question = byId.get(questionId);
      if (!question || !Number.isInteger(choice) || choice < 0 || choice > 6 || !question.answers?.[choice] || seen.has(questionId)) return;
      seen.add(questionId);
      rows.push({
        questionId,
        answerIndex: choice,
        answerValue: Number(question.answers[choice].value),
        answerData: question.answers[choice],
        note: typeof notes[questionId] === 'string' ? notes[questionId].slice(0, 500) : ''
      });
    });
    return rows;
  }

  function createPayload() {
    const descriptions = {};
    const answers = currentAnswers()
      .filter(answer => answer && !answer.noteOnly && Number.isInteger(Number(answer.answerIndex)))
      .map(answer => [Number(answer.questionId), Number(answer.answerIndex)])
      .filter(([questionId, choice]) => Number.isFinite(questionId) && choice >= 0 && choice <= 6);

    currentAnswers().forEach(answer => {
      const note = String(answer?.note || '').trim();
      if (note && Number.isFinite(Number(answer.questionId))) descriptions[Number(answer.questionId)] = note.slice(0, 500);
    });
    return { v: FORMAT_VERSION, a: answers, d: descriptions };
  }

  function generateCompactExportCode() {
    const json = JSON.stringify(createPayload());
    return PREFIX + requireLzString().compressToBase64(json);
  }

  async function readAllQuestions() {
    if (typeof withCompleteTestConfig === 'function') {
      return withCompleteTestConfig(fullConfig => fullConfig.questions || []);
    }
    return questionList();
  }

  async function importCompactExportCode(rawCode) {
    const payload = decodePayload(rawCode);
    const questions = await readAllQuestions();
    const rows = rowsFromPayload(payload, questions);
    if (!rows.length) throw new Error('W kodzie nie znaleziono odpowiedzi pasujących do bieżącej wersji testu.');

    // Keep the same shape as the legacy importer, so scoring and profiles use
    // exactly the same downstream data.
    userAnswers = rows;
    try { answersBeforeSimulation = null; } catch (_) { /* simulation state is optional */ }
    if (typeof updateDOMSelections === 'function') updateDOMSelections();
    if (typeof activateQuestionData === 'function' && typeof getSelectedQuestionIds === 'function') {
      await activateQuestionData(getSelectedQuestionIds());
    }
    if (typeof resultsDiv !== 'undefined' && resultsDiv.style.display !== 'none' && typeof computeAndDisplayResults === 'function') {
      computeAndDisplayResults();
    } else if (typeof showPopup === 'function') {
      showPopup(`Zaimportowano ${rows.length} odpowiedzi w nowym, skompresowanym formacie.`);
    }
    return true;
  }

  // Both the main importer and profile engines call this parser.  Returning
  // legacy rows for non-NA2 input is the backwards-compatibility boundary.
  function parseAnyExportCode(rawCode) {
    if (!isCompactCode(rawCode)) return typeof legacyParse === 'function' ? legacyParse(rawCode) : [];
    try { return rowsFromPayload(decodePayload(rawCode)); }
    catch (error) { console.warn('[NeoAutystyk] Nie można odczytać kodu NA2:', error); return []; }
  }

  function scaleIndex(value) {
    const scale = [1.5, 0.5, -0.5, -1.5];
    return scale.findIndex(item => Math.abs(item - Number(value)) < 0.01);
  }

  function scorePair(mine, reference) {
    const mineIndex = scaleIndex(mine);
    const referenceIndex = scaleIndex(reference);
    if (mineIndex < 0 || referenceIndex < 0) return 0;
    return [1.5, 0.5, -1, -1.5][Math.abs(mineIndex - referenceIndex)] || 0;
  }

  function compareCompactProfile(answers, profile) {
    const reference = parseAnyExportCode(profile?.exportCode || '').filter(row => !row.noteOnly && row.answerData);
    if (!reference.length) return { percent: 0, score: 0, maxPossible: 0, compared: 0 };
    const mine = new Map((answers || []).filter(row => !row.noteOnly).map(row => [Number(row.questionId), row]));
    let score = 0;
    reference.forEach(row => { score += scorePair(mine.get(Number(row.questionId))?.answerValue, row.answerValue); });
    const maxPossible = reference.length * 1.5;
    return { percent: Math.max(0, Math.min(100, Math.round(((score + maxPossible) / (2 * maxPossible)) * 100))), score, maxPossible, compared: reference.length };
  }

  window.NeoAnswerCode = Object.freeze({ PREFIX, createPayload, decodePayload, generateCompactExportCode, parseAnyExportCode, isCompactCode });
  window.parseExportCode = parseAnyExportCode;
  try { parseExportCode = parseAnyExportCode; } catch (_) { /* parser is exposed through window in module builds */ }

  window.generateExportCode = generateCompactExportCode;
  try { generateExportCode = generateCompactExportCode; } catch (_) { /* see note above */ }

  window.importAnswersFromExportCode = async function importAnyExportCode(rawCode) {
    if (!isCompactCode(rawCode)) return legacyImport(rawCode);
    try { return await importCompactExportCode(rawCode); }
    catch (error) {
      if (typeof window.showPopup === 'function') window.showPopup(error.message || 'Nie udało się odczytać kodu NA2.');
      return false;
    }
  };
  try { importAnswersFromExportCode = window.importAnswersFromExportCode; } catch (_) { /* see note above */ }

  // Reference profiles can now store either old text exports or compact NA2
  // exports in their ExportCode field.
  window.compareAnswersToReferenceProfile = function compareAnyProfile(answers, profile) {
    return isCompactCode(profile?.exportCode) ? compareCompactProfile(answers, profile) : legacyCompare(answers, profile);
  };
  try { compareAnswersToReferenceProfile = window.compareAnswersToReferenceProfile; } catch (_) { /* see note above */ }
})();

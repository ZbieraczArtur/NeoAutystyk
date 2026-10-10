/*
 * Compact answer codes (NA3, with NA2 backwards compatibility)
 * --------------------------
 * The payload stores a question id and a choice index (0–6), never answer
 * labels.  Optional notes live in a separate dictionary.  Prefixing the
 * compressed Base64 with `NA3:` makes the format self-identifying; the decoder
 * still accepts old NA2 and human-readable export codes.
 */
(function () {
  'use strict';

  const PREFIX = 'NA3:';
  const LEGACY_PREFIX = 'NA2:';
  const FORMAT_VERSION = 3;
  const legacyGenerate = window.generateExportCode;
  const legacyImport = window.importAnswersFromExportCode;
  const legacyParse = window.parseExportCode;
  const legacyCompare = window.compareAnswersToReferenceProfile;

  function compactText(value) {
    return String(value || '').replace(/\s+/g, '');
  }

  function isCompactCode(value) {
    const source = compactText(value);
    return source.startsWith(PREFIX) || source.startsWith(LEGACY_PREFIX);
  }

  function decodeBase64Utf8(value) {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }

  function requireLzString() {
    if (!window.LZString || typeof window.LZString.compressToBase64 !== 'function') {
      throw new Error('Biblioteka LZ-String nie została wczytana. Sprawdź połączenie z internetem i odśwież stronę.');
    }
    return window.LZString;
  }

  function decodePayload(rawCode) {
    const source = compactText(rawCode);
    const prefix = source.startsWith(PREFIX) ? PREFIX : source.startsWith(LEGACY_PREFIX) ? LEGACY_PREFIX : null;
    if (!prefix) return null;
    const encoded = source.slice(prefix.length);
    let payload = null;
    if (prefix === LEGACY_PREFIX) {
      const decoded = requireLzString().decompressFromBase64(encoded);
      if (decoded) payload = JSON.parse(decoded);
    } else {
      try {
        const decoded = window.LZString?.decompressFromBase64?.(encoded);
        if (decoded) payload = JSON.parse(decoded);
      } catch (_) { /* Try native Base64 below. */ }
      if (!payload) {
        try { payload = JSON.parse(decodeBase64Utf8(encoded)); } catch (_) { /* malformed compact export */ }
      }
    }
    if (!payload) throw new Error('Kod NA3 jest uszkodzony lub niekompletny.');
    if (!payload || ![2, FORMAT_VERSION].includes(payload.v) || !Array.isArray(payload.a)) {
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
        note: typeof notes[questionId] === 'string' ? notes[questionId] : ''
      });
    });
    Object.entries(notes).forEach(([rawId, note]) => {
      const questionId = Number(rawId);
      if (typeof note !== 'string' || !note.length || seen.has(questionId) || !byId.has(questionId)) return;
      rows.push({ questionId, note, noteOnly: true });
    });
    return rows;
  }

  function createPayload() {
    const descriptions = {};
    const questions = new Map(questionList().map(question => [Number(question.id), question]));
    const answerById = new Map();
    currentAnswers().forEach(answer => {
      if (!answer || answer.noteOnly || !Number.isFinite(Number(answer.questionId)) || !answer.answerData) return;
      const questionId = Number(answer.questionId), question = questions.get(questionId);
      let choice = Number.isInteger(answer.answerIndex) ? answer.answerIndex : -1;
      if (choice < 0 || choice > 6 || (question && !question.answers?.[choice])) {
        choice = question?.answers?.findIndex(item => item === answer.answerData || (Number(item.value) === Number(answer.answerValue) && item.label === answer.answerData?.label)) ?? -1;
      }
      if (choice >= 0 && choice <= 6) answerById.set(questionId, [questionId, choice]);
    });
    const answers = [...answerById.values()];

    currentAnswers().forEach(answer => {
      const note = String(answer?.note || '');
      if (note.length && Number.isFinite(Number(answer.questionId))) descriptions[Number(answer.questionId)] = note;
    });
    return { v: FORMAT_VERSION, a: answers, d: descriptions, s: window.NeoTestModes?.metadata?.() || null };
  }

  function generateCompactExportCode() {
    const json = JSON.stringify(createPayload());
    const compressed = window.LZString?.compressToBase64?.(json);
    return PREFIX + (compressed || encodeBase64Utf8(json));
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
    if (!rows.length && !payload.s) throw new Error('W kodzie nie znaleziono odpowiedzi pasujących do bieżącej wersji testu.');

    // Keep the same shape as the legacy importer, so scoring and profiles use
    // exactly the same downstream data.
    userAnswers = rows;
    try { answersBeforeSimulation = null; } catch (_) { /* simulation state is optional */ }
    if (payload.s && window.NeoTestModes?.resumeImported) {
      await window.NeoTestModes.resumeImported(rows, payload.s);
      return true;
    }
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
    catch (error) { console.warn('[NeoAutystyk] Nie można odczytać kodu skróconego:', error); return []; }
  }

  window.NeoAnswerCode = Object.freeze({ PREFIX, LEGACY_PREFIX, createPayload, decodePayload, generateCompactExportCode, parseAnyExportCode, isCompactCode });
  window.generateFullExportCode = (...args) => typeof legacyGenerate === 'function' ? legacyGenerate(...args) : '';
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

  // Reference profiles can now store either old text exports or compact NA2/NA3
  // exports in their ExportCode field.
  window.compareAnswersToReferenceProfile = function compareAnyProfile(answers, profile) {
    // The shared profile engine parses both formats. Reusing its exact scoring
    // path keeps compact codes numerically identical to full text exports.
    return legacyCompare(answers, profile);
  };
  try { compareAnswersToReferenceProfile = window.compareAnswersToReferenceProfile; } catch (_) { /* see note above */ }
})();

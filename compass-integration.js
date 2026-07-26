// Integracja zmian odpowiedzi z kompasem.
// PrzeĹ‚adowanie funkcji symulacji, aby po symulacji odĹ›wieĹĽyÄ‡ kompas
const originalSimulateAnswers = simulateAnswers;
simulateAnswers = async function(selectedName) {
  await originalSimulateAnswers(selectedName);
  // Po symulacji odpowiedzi, przelicz wartoĹ›ci dla kompasu
  const { pairResults } = computeScores(currentScoringMode);
  compassUserValues = buildUserValuesMap(pairResults);
  updateCompassDisplay();
  const showParties = document.getElementById('toggle-parties')?.checked || false;
  const showIdeologies = document.getElementById('toggle-ideologies')?.checked || false;
  loadOverlays(showParties, showIdeologies, window.compassInstance);
  if (window.modalCompassInstance) {
    const modalShowParties = document.getElementById('modal-toggle-parties')?.checked || false;
    const modalShowIdeologies = document.getElementById('modal-toggle-ideologies')?.checked || false;
    loadOverlays(modalShowParties, modalShowIdeologies, window.modalCompassInstance);
  }
};

const originalRestoreUserAnswers = restoreUserAnswers;
restoreUserAnswers = function() {
  originalRestoreUserAnswers();
  const { pairResults } = computeScores(currentScoringMode);
  compassUserValues = buildUserValuesMap(pairResults);
  updateCompassDisplay();
  const showParties = document.getElementById('toggle-parties')?.checked || false;
  const showIdeologies = document.getElementById('toggle-ideologies')?.checked || false;
  loadOverlays(showParties, showIdeologies, window.compassInstance);
  if (window.modalCompassInstance) {
    const modalShowParties = document.getElementById('modal-toggle-parties')?.checked || false;
    const modalShowIdeologies = document.getElementById('modal-toggle-ideologies')?.checked || false;
    loadOverlays(modalShowParties, modalShowIdeologies, window.modalCompassInstance);
  }
};

// Dodatkowo, po imporcie odpowiedzi, teĹĽ odĹ›wieĹĽamy kompas
const originalImportAnswers = importAnswersFromExportCode;
importAnswersFromExportCode = async function(rawCode) {
  const success = await originalImportAnswers(rawCode);
  if (success) {
    const { pairResults } = computeScores(currentScoringMode);
    compassUserValues = buildUserValuesMap(pairResults);
    updateCompassDisplay();
    const showParties = document.getElementById('toggle-parties')?.checked || false;
    const showIdeologies = document.getElementById('toggle-ideologies')?.checked || false;
    loadOverlays(showParties, showIdeologies, window.compassInstance);
    if (window.modalCompassInstance) {
      const modalShowParties = document.getElementById('modal-toggle-parties')?.checked || false;
      const modalShowIdeologies = document.getElementById('modal-toggle-ideologies')?.checked || false;
      loadOverlays(modalShowParties, modalShowIdeologies, window.modalCompassInstance);
    }
  }
  return success;
};


window.loadPoliticalProfiles = async function () {
  const response = await fetch('political_profiles/manifest.json');
  if (!response.ok) throw new Error('Nie udało się wczytać manifestu profili.');
  const manifest = await response.json();
  const figureLetters = [...'ABCDEFGHIJKLMNOPRSTUVWXYZ'];
  const expectedFigureFiles = figureLetters.map(letter => `figures-${letter}.json`);
  if (Number(manifest.version) >= 3 && JSON.stringify(manifest.files?.figures) !== JSON.stringify(expectedFigureFiles)) {
    throw new Error('Manifest figur musi wskazywać 25 plików alfabetycznych (A–Z).');
  }
  const initialOf = value => String(value || '').trim().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[Łł]/g, 'L').toLocaleUpperCase('pl')[0] || '';
  const entries = await Promise.all(Object.entries(manifest.files || {}).map(async ([key, files]) => {
    const chunks = await Promise.all((Array.isArray(files) ? files : [files]).map(async file => {
      const part = await fetch(`political_profiles/${file}`);
      if (!part.ok) throw new Error(`Nie udało się wczytać ${file}.`);
      return part.json();
    }));
    if (key === 'figures' && Number(manifest.version) >= 3) {
      chunks.forEach((profiles, index) => {
        const expectedInitial = figureLetters[index];
        if (!Array.isArray(profiles) || profiles.some(profile => initialOf(profile.name) !== expectedInitial)) {
          throw new Error(`Plik ${expectedFigureFiles[index]} zawiera figurę z niewłaściwą literą.`);
        }
      });
    }
    return [key, chunks.flat()];
  }));
  return { version: manifest.version, defaultMatchingMode: manifest.defaultMatchingMode, exportCodeFormat: manifest.exportCodeFormat, logoSources: manifest.logoSources, ...Object.fromEntries(entries) };
};

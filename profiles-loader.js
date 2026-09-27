window.loadPoliticalProfiles = async function () {
  const response = await fetch('political_profiles/manifest.json');
  if (!response.ok) throw new Error('Nie udało się wczytać manifestu profili.');
  const manifest = await response.json();
  const entries = await Promise.all(Object.entries(manifest.files || {}).map(async ([key, files]) => {
    const chunks = await Promise.all((Array.isArray(files) ? files : [files]).map(async file => {
      const part = await fetch(`political_profiles/${file}`);
      if (!part.ok) throw new Error(`Nie udało się wczytać ${file}.`);
      return part.json();
    }));
    return [key, chunks.flat()];
  }));
  return { version: manifest.version, defaultMatchingMode: manifest.defaultMatchingMode, exportCodeFormat: manifest.exportCodeFormat, logoSources: manifest.logoSources, ...Object.fromEntries(entries) };
};

(() => {
    'use strict';

    const scriptUrl = document.currentScript?.src || new URL('js/shared/profiles-loader.js', document.baseURI).href;
    const appRootUrl = new URL('../../', scriptUrl);
    const manifestUrl = new URL('data/political_profiles/manifest.json', appRootUrl);
    const profileDirectoryUrl = new URL('.', manifestUrl);
    let profilesRequest = null;
    let exportCodesRequest = null;

    async function loadBaseProfiles() {
        if (profilesRequest) return profilesRequest;
        profilesRequest = (async () => {
            const response = await fetch(manifestUrl);
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
                    const partUrl = new URL(file, profileDirectoryUrl);
                    const part = await fetch(partUrl);
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
            return {
                version: manifest.version,
                defaultMatchingMode: manifest.defaultMatchingMode,
                exportCodeFormat: manifest.exportCodeFormat,
                logoSources: manifest.logoSources,
                ...Object.fromEntries(entries)
            };
        })().catch(error => {
            profilesRequest = null;
            throw error;
        });
        return profilesRequest;
    }

    async function loadExportCodes() {
        if (exportCodesRequest) return exportCodesRequest;
        const url = new URL('export-codes.json', profileDirectoryUrl);
        exportCodesRequest = fetch(url).then(response => {
            if (!response.ok) throw new Error('Nie udało się wczytać oddzielnego pliku kodów profili.');
            return response.json();
        }).catch(error => {
            exportCodesRequest = null;
            throw error;
        });
        return exportCodesRequest;
    }

    window.loadPoliticalProfiles = async function loadPoliticalProfiles(options = {}) {
        const profiles = await loadBaseProfiles();
        if (options.includeExportCodes === false) return profiles;

        const codes = await loadExportCodes();
        const withCodes = {};
        for (const [collection, entries] of Object.entries(profiles)) {
            if (!Array.isArray(entries)) {
                withCodes[collection] = entries;
                continue;
            }
            withCodes[collection] = entries.map(profile => {
                const key = [profile.key, profile.id, profile.name].find(candidate => candidate && Object.prototype.hasOwnProperty.call(codes, candidate));
                return { ...profile, exportCode: key ? String(codes[key] ?? '') : '' };
            });
        }
        return withCodes;
    };
})();

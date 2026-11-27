/* Tabbed album filter.  It delegates drawing to album.js and only supplies a
 * deterministic predicate, so favorites, search and sorting still combine. */
(function() {
    'use strict';
    const chosen = new Map();
    let activeTab = Object.keys(window.NeoTagCatalog.groupsFor?.('party') || window.NeoTagCatalog.catalog)[0];

    function matches(profile) {
        return window.NeoTagCatalog.matches?.(profile, chosen, { logic: 'conditional' }) ?? true;
    }

    function render() {
        const host = document.getElementById('album-tags');
        if (!host || !window.NeoAlbum) return;
        host.replaceChildren();
        const root = document.createElement('section');
        root.className = 'album-advanced-tags';
        const heading = document.createElement('div');
        heading.className = 'advanced-tag-heading';
        heading.innerHTML = '<div><strong>Tagi według kategorii</strong><small>Zakładki łączą się ze sobą, wybory w jednej zakładce są alternatywami.</small></div>';
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'advanced-tag-clear';
        clear.textContent = 'Wyczyść';
        clear.onclick = () => {
            chosen.clear();
            render();
            window.NeoAlbum.setAdvancedTagFilter(matches);
        };
        heading.append(clear);
        const tabs = document.createElement('div');
        tabs.className = 'advanced-tag-tabs';
        const catalog = window.NeoTagCatalog.groupsFor?.(profileType()) || window.NeoTagCatalog.catalog;
        if (!catalog[activeTab]) activeTab = Object.keys(catalog)[0];
        Object.keys(catalog).forEach(category => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'advanced-tag-tab';
            button.textContent = category;
            button.classList.toggle('active', category === activeTab);
            button.onclick = () => {
                activeTab = category;
                render();
            };
            tabs.append(button);
        });
        const options = document.createElement('div');
        options.className = 'advanced-tag-choices';
        const values = chosen.get(activeTab) || new Set();
        catalog[activeTab].forEach(tag => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'advanced-tag-chip';
            button.textContent = tag;
            button.classList.toggle('active', values.has(tag));
            button.onclick = () => {
                const next = chosen.get(activeTab) || new Set();
                next.has(tag) ? next.delete(tag) : next.add(tag);
                next.size ? chosen.set(activeTab, next) : chosen.delete(activeTab);
                window.NeoAlbum.setAdvancedTagFilter(matches);
                render();
            };
            options.append(button);
        });
        root.append(heading, tabs, options);
        host.append(root);
    }
    function profileType() { return document.querySelector('[data-type].active')?.dataset.type || 'party'; }
    const timer = setInterval(() => {
        if (window.NeoAlbum) {
            clearInterval(timer);
            render();
        }
    }, 50);
})();

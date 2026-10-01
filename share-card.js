/* Social-card generator.  It uses Canvas only, so the generated PNG is stable
 * regardless of the user's browser theme, fonts, or external screenshots. */
(function () {
  'use strict';
  const SIZE = { width: 1080, height: 1350 };

  function ranking(type) {
    const root = document.getElementById(`${type}-results`);
    const row = root?.querySelector('.ranking-item:not([hidden])');
    return {
      name: row?.querySelector('.rank-name')?.textContent?.trim() || '—',
      percent: row?.querySelector('.rank-percent')?.textContent?.trim() || '—'
    };
  }

  function themeForPoint(point) {
    const x = Number(point?.x || 0), y = Number(point?.y || 0);
    if (x >= 0 && y < 0) return { colors: ['#4c1d95', '#ec4899'], title: 'profil północno-wschodni' };
    if (x < 0 && y < 0) return { colors: ['#991b1b', '#f97316'], title: 'profil północno-zachodni' };
    if (x >= 0 && y >= 0) return { colors: ['#065f46', '#06b6d4'], title: 'profil południowo-wschodni' };
    return { colors: ['#0f3f8c', '#6366f1'], title: 'profil południowo-zachodni' };
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function text(ctx, content, x, y, options = {}) {
    ctx.save();
    ctx.fillStyle = options.color || '#fff';
    ctx.font = `${options.weight || 500} ${options.size || 28}px system-ui, sans-serif`;
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = options.baseline || 'alphabetic';
    ctx.fillText(String(content), x, y);
    ctx.restore();
  }

  function drawWrapped(ctx, content, x, y, maxWidth, lineHeight, options = {}) {
    ctx.save();
    ctx.font = `${options.weight || 700} ${options.size || 42}px system-ui, sans-serif`;
    const words = String(content).split(/\s+/); let line = ''; let row = 0;
    words.forEach(word => {
      const next = `${line}${line ? ' ' : ''}${word}`;
      if (line && ctx.measureText(next).width > maxWidth) { text(ctx, line, x, y + row * lineHeight, options); line = word; row++; }
      else line = next;
    });
    if (line) text(ctx, line, x, y + row * lineHeight, options);
    ctx.restore();
    return y + (row + 1) * lineHeight;
  }

  function drawCompass(ctx, point, x, y, size) {
    const mid = x + size / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(mid, y); ctx.lineTo(mid, y + size); ctx.moveTo(x, y + size / 2); ctx.lineTo(x + size, y + size / 2); ctx.stroke();
    for (let index = 1; index < 4; index++) { const offset = size * index / 4; ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.beginPath(); ctx.moveTo(x + offset, y); ctx.lineTo(x + offset, y + size); ctx.moveTo(x, y + offset); ctx.lineTo(x + size, y + offset); ctx.stroke(); }
    const markerX = x + ((Number(point?.x || 0) + 100) / 200) * size;
    const markerY = y + ((Number(point?.y || 0) + 100) / 200) * size;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(Math.max(x + 16, Math.min(x + size - 16, markerX)), Math.max(y + 16, Math.min(y + size - 16, markerY)), 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#172033'; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
  }

  function generateShareCard() {
    const canvas = document.createElement('canvas'); canvas.width = SIZE.width; canvas.height = SIZE.height;
    const ctx = canvas.getContext('2d');
    const point = window.currentUserCoords || { x: 0, y: 0 };
    const theme = themeForPoint(point);
    const gradient = ctx.createLinearGradient(0, 0, SIZE.width, SIZE.height); gradient.addColorStop(0, theme.colors[0]); gradient.addColorStop(1, theme.colors[1]); ctx.fillStyle = gradient; ctx.fillRect(0, 0, SIZE.width, SIZE.height);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(990, 120, 250, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(40, 1270, 300, 0, Math.PI * 2); ctx.fill();
    text(ctx, 'NEOAUTYSTYK', 78, 100, { size: 26, weight: 800, color: 'rgba(255,255,255,.76)' });
    text(ctx, 'MÓJ PROFIL POLITYCZNY', 78, 160, { size: 42, weight: 800 });
    text(ctx, theme.title.toUpperCase(), 78, 208, { size: 22, weight: 750, color: 'rgba(255,255,255,.8)' });

    roundedRect(ctx, 68, 258, 944, 322, 36); ctx.fillStyle = 'rgba(10,18,35,.27)'; ctx.fill();
    drawCompass(ctx, point, 112, 304, 230);
    const ideology = ranking('ideologies'), party = ranking('parties');
    text(ctx, 'NAJBLIŻSZA IDEOLOGIA', 390, 334, { size: 21, weight: 800, color: 'rgba(255,255,255,.7)' });
    const nextLine = drawWrapped(ctx, ideology.name, 390, 390, 560, 53, { size: 46, weight: 800 });
    text(ctx, ideology.percent, 390, Math.max(505, nextLine + 22), { size: 42, weight: 800 });
    text(ctx, `Najbliższa partia: ${party.name}  ${party.percent}`, 390, 548, { size: 21, weight: 650, color: 'rgba(255,255,255,.84)' });

    const pairs = typeof computeScores === 'function' ? computeScores(currentScoringMode).pairResults.slice(0, 5) : [];
    text(ctx, 'NAJWAŻNIEJSZE OSIE', 78, 662, { size: 25, weight: 800, color: 'rgba(255,255,255,.76)' });
    pairs.forEach((pair, index) => {
      const y = 724 + index * 100;
      text(ctx, pair.left, 78, y, { size: 22, weight: 700 });
      text(ctx, pair.right, 1002, y, { size: 22, weight: 700, align: 'right' });
      roundedRect(ctx, 78, y + 20, 924, 22, 11); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
      const left = Math.max(0, Math.min(100, Number(pair.leftPercent || 50)));
      roundedRect(ctx, 78, y + 20, 924 * left / 100, 22, 11); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
      text(ctx, `${Math.round(left)}%`, 78, y + 76, { size: 18, weight: 800, color: 'rgba(255,255,255,.82)' });
      text(ctx, `${Math.round(Number(pair.rightPercent || 50))}%`, 1002, y + 76, { size: 18, weight: 800, align: 'right', color: 'rgba(255,255,255,.82)' });
    });
    text(ctx, 'Wynik jest mapą wartości — nie gotową etykietą.', 540, 1260, { size: 24, weight: 650, align: 'center', color: 'rgba(255,255,255,.86)' });
    text(ctx, 'neoautystyk', 540, 1305, { size: 21, weight: 800, align: 'center', color: 'rgba(255,255,255,.66)' });
    return canvas;
  }

  function saveCanvas(canvas) {
    const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = 'neoautystyk-karta-wyniku.png'; link.click();
  }

  function mount() {
    const results = document.getElementById('results-container');
    if (!results || document.getElementById('share-card-section')) return;
    const section = document.createElement('section'); section.id = 'share-card-section'; section.className = 'share-card-section';
    section.innerHTML = '<div><p class="results-tools-eyebrow">UDOSTĘPNIJ WYNIK</p><h3>Karta do mediów społecznościowych</h3><p>Wygeneruj pionową kartę PNG z kompasem, najbliższą ideologią i kluczowymi osiami.</p></div><div class="share-card-actions"><button type="button" data-share-card="download">Pobierz kartę PNG</button><button type="button" data-share-card="share" class="share-card-secondary">Udostępnij</button></div>';
    section.querySelector('[data-share-card="download"]').onclick = () => saveCanvas(generateShareCard());
    section.querySelector('[data-share-card="share"]').onclick = async () => {
      const canvas = generateShareCard();
      if (!navigator.share || !canvas.toBlob) return saveCanvas(canvas);
      canvas.toBlob(async blob => { try { await navigator.share({ title: 'Mój profil NeoAutystyk', files: [new File([blob], 'neoautystyk-karta-wyniku.png', { type: 'image/png' })] }); } catch (_) { /* user cancelled the system share sheet */ } });
    };
    results.querySelector('#resultsTitle')?.insertAdjacentElement('afterend', section);
  }

  window.NeoShareCard = Object.freeze({ generate: generateShareCard, mount });
  document.addEventListener('DOMContentLoaded', mount);
})();

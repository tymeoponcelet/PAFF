// ========================================
// FLAPPY BIRD - Popup résultat + Mise
// static/js/jeux/flappy-popup.js
// ========================================

// ── Afficher la popup de résultat ──────────────────────────────────────────
function showFlappyResultPopup({ score, recompense, meilleurScore, mise, estNouveauRecord, estVictoire }) {
    const overlay   = document.getElementById('flappyResultOverlay');
    const title     = document.getElementById('flappyResultTitle');
    const subtitle  = document.getElementById('flappyResultSubtitle');
    const bird      = document.getElementById('flappyResultBird');
    const statScore = document.getElementById('flappyStatScore');
    const statRec   = document.getElementById('flappyStatRecompense');
    const statBest  = document.getElementById('flappyStatBest');
    const betInfo   = document.getElementById('flappyResultBetInfo');
    const record    = document.getElementById('flappyResultRecord');
    const replayBtn = document.getElementById('flappyResultReplay');
    const closeBtn  = document.getElementById('flappyResultClose');

    if (!overlay) return;

    // ── Contenu selon résultat ──
    if (estVictoire || recompense > 0) {
        title.textContent = 'BIEN JOUÉ !';
        title.className   = 'flappy-result-title is-win';
        subtitle.textContent = score >= 80 ? '🔥 Score légendaire !' :
                               score >= 50 ? '⭐ Excellent vol !'   :
                               score >= 20 ? '👍 Beau parcours !'   : '🐦 Continue comme ça !';
        bird.textContent  = '🎉';
        spawnParticles(true);
    } else {
        title.textContent = 'GAME OVER';
        title.className   = 'flappy-result-title is-lose';
        subtitle.textContent = score === 0 ? 'Pas de chance, retente ta chance !' :
                               `${score} tuyau${score > 1 ? 'x' : ''} passé${score > 1 ? 's' : ''} !`;
        bird.textContent  = '💥';
        spawnParticles(false);
    }

    // ── Stats ──
    statScore.textContent = score;
    statBest.textContent  = meilleurScore;

    // Récompense avec multiplicateur
    const recompenseTotale = recompense; // déjà calculée serveur-side (mise × palier)
    if (recompenseTotale > 0) {
        statRec.textContent = `+${recompenseTotale} pts`;
        document.getElementById('flappyStatRecompenseWrap').style.display = '';
    } else {
        statRec.textContent = '—';
        document.getElementById('flappyStatRecompenseWrap').style.background = 'rgba(255,255,255,0.04)';
        document.getElementById('flappyStatRecompenseWrap').style.borderColor = 'rgba(255,255,255,0.08)';
    }

    // Info mise
    if (mise > 0) {
        betInfo.textContent = `Mise : ${mise} pts${recompenseTotale > 0 ? ` · Gain net : +${recompenseTotale - mise} pts` : ' · Perdue'}`;
    } else {
        betInfo.textContent = '';
    }

    // Nouveau record
    if (estNouveauRecord && score > 0) {
        record.classList.add('visible');
    } else {
        record.classList.remove('visible');
    }

    // ── Boutons ──
    const newReplay = replayBtn.cloneNode(true);
    replayBtn.replaceWith(newReplay);
    newReplay.addEventListener('click', () => {
        closeFlappyResultPopup();
        // Déclencher rejouer dans flappy.js
        if (typeof window._flappyRejouer === 'function') window._flappyRejouer();
    });

    const newClose = closeBtn.cloneNode(true);
    closeBtn.replaceWith(newClose);
    newClose.addEventListener('click', closeFlappyResultPopup);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFlappyResultPopup();
    }, { once: true });

    overlay.classList.add('active');
}

function closeFlappyResultPopup() {
    const overlay = document.getElementById('flappyResultOverlay');
    if (overlay) overlay.classList.remove('active');
    // Nettoyer particules
    const p = document.getElementById('flappyParticles');
    if (p) p.innerHTML = '';
}

// ── Particules victoire/défaite ────────────────────────────────────────────
function spawnParticles(win) {
    const container = document.getElementById('flappyParticles');
    if (!container) return;
    container.innerHTML = '';

    const colors = win
        ? ['#4ade80','#facc15','#60a5fa','#f472b6','#a78bfa']
        : ['#f87171','#fb923c','#fbbf24'];

    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'flappy-particle';
        p.style.cssText = `
            left: ${Math.random() * 100}%;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            width: ${4 + Math.random() * 6}px;
            height: ${4 + Math.random() * 6}px;
            animation-duration: ${2 + Math.random() * 3}s;
            animation-delay: ${Math.random() * 2}s;
        `;
        container.appendChild(p);
    }
}

// ── Initialisation popup ───────────────────────────────────────────────────
function initFlappyResultPopup() {
    // rien à faire, les events sont attachés à l'ouverture
}

// ── Exposer en global ──────────────────────────────────────────────────────
window.showFlappyResultPopup  = showFlappyResultPopup;
window.closeFlappyResultPopup = closeFlappyResultPopup;
window.initFlappyResultPopup  = initFlappyResultPopup;
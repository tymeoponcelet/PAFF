// ========================================
// FLAPPY BIRD CLIENT - v2 avec mise
// static/js/jeux/flappy-client.js
// ========================================

const FLAPPY_API = '/actions/flappy';

// ── Multiplicateurs par palier ─────────────────────────────────────────────
function getMultiplicateur(score) {
    if (score >= 80) return 20;
    if (score >= 70) return 10;
    if (score >= 60) return 5;
    if (score >= 50) return 3;
    if (score >= 30) return 2;
    if (score >= 20) return 1;
    if (score >= 5) return 0.5;
    return 0;
}

// ── Récupérer la mise courante ─────────────────────────────────────────────
function getMiseCourante() {
    // Pas de mise pendant un duel (voir static/js/duel-client.js)
    if (window.duelEnCours && window.duelEnCours.jeu === 'flappy') return 0;

    const input = document.getElementById('flappyBetInput');
    if (!input) return 0;
    const val = parseInt(input.value);
    return isNaN(val) ? 0 : Math.max(10, val);
}

// ── Soumettre le score + mise au serveur ───────────────────────────────────
async function soumettreScoreFlappy(score) {
    const mise = getMiseCourante();
    const token = window._flappySessionToken || null; // ← récupérer le token


    try {
        const response = await fetch(`${FLAPPY_API}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ score, mise, token })
        });

        const data = await response.json();

        // Fin d'une partie de duel : affiche où en est le duel
        if (data.duel && typeof window.finirModeDuel === 'function') {
            window.finirModeDuel(data.duel);
        }

        if (!data.success) {
            console.warn('⚠️ Flappy score non enregistré :', data.message);
            return null;
        }

        // Mettre à jour le solde affiché
        if (typeof window.updateUserBalance === 'function') {
            window.updateUserBalance(data.nouveauxPoints);
        }

        // Key drop
        if (data.keyDropped && typeof window.showKeyDropPopup === 'function') {
            window.showKeyDropPopup();
        }
        if (data.keyDropped && typeof window.updateUserKeys === 'function' && data.userKeys != null) {
            window.updateUserKeys(data.userKeys);
        }

        // Sync localStorage
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            user.points = data.nouveauxPoints;
            localStorage.setItem('user', JSON.stringify(user));
        }
        if (data.estNouveauRecord) {
            localStorage.setItem('flappyBestScore', data.meilleurScore.toString());
        }

        return data;

    } catch (err) {
        console.error('❌ Erreur soumission score Flappy :', err);
        return null;
    }
}

// ── Charger le meilleur score ──────────────────────────────────────────────
async function chargerMeilleurScoreFlappy() {
    try {
        const response = await fetch(`${FLAPPY_API}/best-score`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('flappyBestScore', data.meilleurScore.toString());
            return data.meilleurScore;
        }
        return parseInt(localStorage.getItem('flappyBestScore') || '0');
    } catch (err) {
        return parseInt(localStorage.getItem('flappyBestScore') || '0');
    }
}

// ── Initialiser les contrôles de mise ──────────────────────────────────────
function initFlappyBetControls() {
    const input = document.getElementById('flappyBetInput');
    const btnMinus = document.getElementById('flappyBetMinus');
    const btnPlus = document.getElementById('flappyBetPlus');
    const presets = document.querySelectorAll('.flappy-preset-btn');

    if (!input) return;

    const clamp = (v) => Math.min(500, Math.max(10, v));

    btnMinus && btnMinus.addEventListener('click', () => {
        const step = parseInt(input.value) >= 100 ? 50 : 10;
        input.value = clamp(parseInt(input.value) - step);
        updateActivePreset(input.value);
    });

    btnPlus && btnPlus.addEventListener('click', () => {
        const step = parseInt(input.value) >= 100 ? 50 : 10;
        input.value = clamp(parseInt(input.value) + step);
        updateActivePreset(input.value);
    });

    input.addEventListener('change', () => {
        input.value = clamp(parseInt(input.value) || 10);
        updateActivePreset(input.value);
    });

    presets.forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.dataset.amount;
            updateActivePreset(btn.dataset.amount);
        });
    });

    function updateActivePreset(val) {
        presets.forEach(b => b.classList.toggle('active', b.dataset.amount == val));
    }

    updateActivePreset(input.value);
}

// ── Exposer en global ──────────────────────────────────────────────────────
window.soumettreScoreFlappy = soumettreScoreFlappy;
window.chargerMeilleurScoreFlappy = chargerMeilleurScoreFlappy;
window.getMiseCourante = getMiseCourante;
window.getMultiplicateur = getMultiplicateur;
window.initFlappyBetControls = initFlappyBetControls;

// Auto-init des contrôles quand le DOM est prêt
document.addEventListener('DOMContentLoaded', initFlappyBetControls);
document.addEventListener('flappyModalLoaded', initFlappyBetControls);
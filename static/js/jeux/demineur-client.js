// ========================================
// DÉMINEUR CLIENT - ISOLÉ
// ========================================

(function () {
  'use strict';

  // ========================================
  // VARIABLES GLOBALES
  // ========================================
  let sessionId = null;
  let partieActive = false;
  let betAmount = 100;
  let intervalleTemps = null;
  let secondesEcoulees = 0;
  let minesRestantes = 10;
  let grilleLocale = [];
  let modeDrapeau = false; // ← mode drapeau actif ou non

  const LIGNES = 9;
  const COLONNES = 9;
  const NOMBRE_MINES = 15;

  // ========================================
  // INITIALISATION
  // ========================================
  window.initDemineur = function () {
    const modal = document.getElementById('demineurModal');
    if (!modal) return;

    const closeButtons = document.querySelectorAll('.js-close-demineur');
    const startBtn = document.getElementById('demineurStartBtn');
    const resetBtn = document.getElementById('demineurResetBtn');
    const flagBtn = document.getElementById('demineurFlagBtn');

    // Reset état local
    sessionId = null;
    partieActive = false;
    modeDrapeau = false;
    grilleLocale = [];
    arreterChrono();

    // Rendu initial
    renderGrilleVide();
    majAffichageMines(NOMBRE_MINES);
    majAffichageTemps(0);
    cacherResultat();
    majBoutonDrapeau();

    const betInput = document.getElementById('demineurBetAmount');
    if (betInput) {
      betInput.addEventListener('change', () => {
        let val = parseInt(betInput.value);
        if (isNaN(val)) val = 100;
        betInput.value = Math.max(50, Math.min(300, val));
      });
    }

    // --- Bouton Démarrer ---
    if (startBtn) {
      const newStartBtn = startBtn.cloneNode(true);
      startBtn.replaceWith(newStartBtn);
      document.getElementById('demineurStartBtn').addEventListener('click', () => {
        demarrerPartie();
        document.getElementById('demineurStartBtn').style.display = 'none';
      });
      document.getElementById('demineurStartBtn').style.display = 'block';
    }

    // --- Bouton Reset ---
    if (resetBtn) {
      const newResetBtn = resetBtn.cloneNode(true);
      resetBtn.replaceWith(newResetBtn);
      document.getElementById('demineurResetBtn').addEventListener('click', resetPartie);
      document.getElementById('demineurResetBtn').disabled = true;
    }

    // --- Bouton Drapeau ---
    if (flagBtn) {
      const newFlagBtn = flagBtn.cloneNode(true);
      flagBtn.replaceWith(newFlagBtn);
      document.getElementById('demineurFlagBtn').addEventListener('click', () => {
        if (!partieActive) return;
        modeDrapeau = !modeDrapeau;
        majBoutonDrapeau();
      });
      document.getElementById('demineurFlagBtn').disabled = true;
    }

    // --- Fermeture ---
    closeButtons.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.replaceWith(newBtn);
    });
    document.querySelectorAll('.js-close-demineur').forEach(btn =>
      btn.addEventListener('click', fermerModal)
    );
    modal.addEventListener('click', (e) => {
      if (e.target === modal) fermerModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) fermerModal();
    });
  };

  // ========================================
  // DÉMARRER UNE PARTIE
  // ========================================
  async function demarrerPartie() {
    const betInput = document.getElementById('demineurBetAmount');
    betAmount = betInput ? parseInt(betInput.value) : 100;

    if (isNaN(betAmount) || betAmount < 50 || betAmount > 300) {
      alert('Mise entre 50 et 300 points');
      document.getElementById('demineurStartBtn').style.display = 'block';
      return;
    }

    try {
      const response = await fetch('/actions/demineur/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ betAmount })
      });

      const data = await response.json();

      if (!data.success) {
        alert(data.message || 'Erreur lors du démarrage');
        document.getElementById('demineurStartBtn').style.display = 'block';
        return;
      }

      sessionId = data.sessionId;
      partieActive = true;
      modeDrapeau = false;
      minesRestantes = NOMBRE_MINES;
      secondesEcoulees = 0;

      majAffichageMines(minesRestantes);
      majAffichageTemps(0);
      majAffichageRestantes(data.casesRestantes);
      updatePointsDisplay(data.newPoints);
      majBoutonDrapeau();

      if (data.keyDropped) {
        if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
        if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
          window.updateUserKeys(data.userKeys);
        }
      }

      cacherResultat();
      renderGrilleVide();

      const resetBtn = document.getElementById('demineurResetBtn');
      if (resetBtn) resetBtn.disabled = false;

      const flagBtn = document.getElementById('demineurFlagBtn');
      if (flagBtn) flagBtn.disabled = false;

    } catch (err) {
      console.error('❌ [DEMINEUR] Erreur démarrage:', err);
      alert('Impossible de démarrer la partie');
      document.getElementById('demineurStartBtn').style.display = 'block';
    }
  }

  // ========================================
  // CLIC SUR UNE CASE (RÉVÉLER ou DRAPEAU selon mode)
  // ========================================
  async function clicCase(ligne, colonne) {
    if (!partieActive || !sessionId) return;

    // Mode drapeau actif → poser/enlever drapeau
    if (modeDrapeau) {
      await poserDrapeau(ligne, colonne);
      return;
    }

    try {
      const response = await fetch('/actions/demineur/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, ligne, colonne })
      });

      const data = await response.json();
      if (!data.success) return;

      if (secondesEcoulees === 0 && !intervalleTemps) {
        demarrerChrono();
      }

      grilleLocale = data.grille;
      renderGrille(data.grille);

      if (data.casesRestantes !== undefined) majAffichageRestantes(data.casesRestantes);
      if (data.multiplicateur !== undefined) majAffichageMultiplicateur(data.multiplicateur);

      if (data.result === 'lose') {
        arreterChrono();
        partieActive = false;
        modeDrapeau = false;
        majBoutonDrapeau();
        afficherResultat('lose', data.message);
        document.getElementById('demineurResetBtn').disabled = false;
        document.getElementById('demineurFlagBtn').disabled = true;
      }

      if (data.result === 'win') {
        arreterChrono();
        partieActive = false;
        modeDrapeau = false;
        majBoutonDrapeau();
        updatePointsDisplay(data.newPoints);
        afficherResultat('win', data.message);
        document.getElementById('demineurResetBtn').disabled = false;
        document.getElementById('demineurFlagBtn').disabled = true;
      }

    } catch (err) {
      console.error('❌ [DEMINEUR] Erreur révélation:', err);
    }
  }

  // ========================================
  // POSER / ENLEVER UN DRAPEAU
  // ========================================
  async function poserDrapeau(ligne, colonne) {
    if (!partieActive || !sessionId) return;

    try {
      const response = await fetch('/actions/demineur/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, ligne, colonne })
      });

      const data = await response.json();
      if (!data.success) return;

      minesRestantes = data.minesRestantes;
      majAffichageMines(minesRestantes);

      const caseEl = document.querySelector(
        `[data-ligne="${ligne}"][data-colonne="${colonne}"]`
      );
      if (caseEl) {
        if (data.marquee) {
          caseEl.classList.add('demineur__cell--flag');
          caseEl.textContent = '🚩';
        } else {
          caseEl.classList.remove('demineur__cell--flag');
          caseEl.textContent = '';
        }
      }

    } catch (err) {
      console.error('❌ [DEMINEUR] Erreur drapeau:', err);
    }
  }

  // ========================================
  // RENDU DE LA GRILLE
  // ========================================
  function renderGrilleVide() {
    const board = document.getElementById('demineurBoard');
    if (!board) return;

    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${COLONNES}, 1fr)`;

    for (let l = 0; l < LIGNES; l++) {
      for (let c = 0; c < COLONNES; c++) {
        board.appendChild(creerElementCase(l, c));
      }
    }
  }

  function renderGrille(grille) {
    const board = document.getElementById('demineurBoard');
    if (!board) return;

    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${COLONNES}, 1fr)`;

    grille.forEach((ligne, l) => {
      ligne.forEach((case_, c) => {
        const caseEl = creerElementCase(l, c);

        if (case_.etat === 'revealed') {
          caseEl.classList.add('demineur__cell--revelee');
          if (case_.voisins > 0) {
            caseEl.textContent = case_.voisins;
            caseEl.dataset.voisins = case_.voisins;
            caseEl.classList.add(`demineur__cell--nombre-${case_.voisins}`);
          }
          caseEl.style.cursor = 'default';

        } else if (case_.etat === 'mine') {
          caseEl.classList.add('demineur__cell--mine');
          caseEl.textContent = '💣';
          caseEl.style.cursor = 'default';

        } else if (case_.etat === 'flag') {
          caseEl.classList.add('demineur__cell--flag');
          caseEl.textContent = '🚩';
        }

        board.appendChild(caseEl);
      });
    });
  }

  function creerElementCase(ligne, colonne) {
    const caseEl = document.createElement('div');
    caseEl.className = 'demineur__cell';
    caseEl.dataset.ligne = ligne;
    caseEl.dataset.colonne = colonne;

    if (partieActive) {
      // Clic droit desktop → toujours drapeau, quel que soit le mode
      caseEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        poserDrapeau(ligne, colonne);
      });

      // Clic gauche → révéler ou drapeau selon modeDrapeau
      caseEl.addEventListener('click', () => clicCase(ligne, colonne));
    }

    return caseEl;
  }

  // ========================================
  // BOUTON DRAPEAU - mise à jour visuelle
  // ========================================
  function majBoutonDrapeau() {
    const flagBtn = document.getElementById('demineurFlagBtn');
    if (!flagBtn) return;

    if (modeDrapeau) {
      flagBtn.classList.add('demineur__btn--flag-active');
      flagBtn.textContent = '🚩 ON';
    } else {
      flagBtn.classList.remove('demineur__btn--flag-active');
      flagBtn.textContent = '🚩';
    }
  }

  // ========================================
  // CHRONOMÈTRE
  // ========================================
  function demarrerChrono() {
    arreterChrono();
    intervalleTemps = setInterval(() => {
      secondesEcoulees++;
      majAffichageTemps(secondesEcoulees);
      majAffichageMultiplicateur(calculerMultiplicateurLocal(secondesEcoulees));
    }, 1000);
  }

  function arreterChrono() {
    if (intervalleTemps) {
      clearInterval(intervalleTemps);
      intervalleTemps = null;
    }
  }

  function calculerMultiplicateurLocal(secondes) {
    if (secondes < 30) return 3;
    if (secondes < 60) return 2;
    if (secondes < 120) return 1.5;
    return 1;
  }

  // ========================================
  // RESET
  // ========================================
  function resetPartie() {
    arreterChrono();
    sessionId = null;
    partieActive = false;
    modeDrapeau = false;
    grilleLocale = [];
    secondesEcoulees = 0;
    minesRestantes = NOMBRE_MINES;

    majAffichageMines(NOMBRE_MINES);
    majAffichageTemps(0);
    majAffichageMultiplicateur(3);
    majBoutonDrapeau();
    cacherResultat();
    renderGrilleVide();

    const startBtn = document.getElementById('demineurStartBtn');
    if (startBtn) startBtn.style.display = 'block';

    const resetBtn = document.getElementById('demineurResetBtn');
    if (resetBtn) resetBtn.disabled = true;

    const flagBtn = document.getElementById('demineurFlagBtn');
    if (flagBtn) flagBtn.disabled = true;
  }

  // ========================================
  // FERMETURE MODALE
  // ========================================
  function fermerModal() {
    arreterChrono();
    sessionId = null;
    partieActive = false;
    modeDrapeau = false;

    const modal = document.getElementById('demineurModal');
    if (modal) modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // ========================================
  // AFFICHAGE / UI
  // ========================================
  function afficherResultat(type, message) {
    const el = document.getElementById('demineurResult');
    if (!el) return;
    el.textContent = message;
    el.className = 'demineur__result';
    if (type === 'win') el.classList.add('demineur__result--win');
    if (type === 'lose') el.classList.add('demineur__result--lose');
    el.style.display = 'block';
  }

  function cacherResultat() {
    const el = document.getElementById('demineurResult');
    if (el) el.style.display = 'none';
  }

  function majAffichageMines(count) {
    const el = document.getElementById('demineurMinesCount');
    if (el) el.textContent = count;
  }

  function majAffichageTemps(secondes) {
    const el = document.getElementById('demineurTimer');
    if (!el) return;
    const m = Math.floor(secondes / 60).toString().padStart(2, '0');
    const s = (secondes % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
  }

  function majAffichageRestantes(count) {
    const el = document.getElementById('demineurRemaining');
    if (el) el.textContent = count;
  }

  function majAffichageMultiplicateur(multi) {
    const el = document.getElementById('demineurMultiplier');
    if (el) el.textContent = `x${multi}`;
  }

  function updatePointsDisplay(newPoints) {
    if (newPoints === undefined || newPoints === null) return;

    document.querySelectorAll('[data-user-points]').forEach(el => {
      el.textContent = `${newPoints} pts`;
    });

    if (typeof window.updateUserBalance === 'function') {
      window.updateUserBalance(newPoints);
    }

    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      user.points = newPoints;
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  // ========================================
  // INITIALISATION AU CHARGEMENT
  // ========================================
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('demineurModal')) {
      window.initDemineur();
    }
  });

})();
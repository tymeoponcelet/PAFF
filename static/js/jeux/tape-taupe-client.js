// ========================================
// TAPE TAUPE CLIENT - VERSION DYNAMIQUE
// ========================================

(function() {
  'use strict';

  // Configuration
  const API_BASE = '/actions/whackmole';

  let currentSessionId = null;
  let gameActive = false;
  let timerInterval = null;
  let spawnInterval = null;
  let timeLeft = 30;
  let currentScore = 0;
  let currentCombo = 0;
  let currentBet = 0;

  // Variables DOM (seront initialisées dans initTapeTaupe)
  let modal;
  let betSection;
  let gameSection;
  let endSection;
  let betInput;
  let startBtn;
  let restartBtn;
  let scoreDisplay;
  let timerDisplay;
  let betDisplay;
  let holes;

  // ========================================
  // INITIALISATION
  // ========================================

  /**
   * Initialise le jeu Tape-Taupe (appelé au chargement de la modale)
   */
  window.initTapeTaupe = function() {
   //console.log('🔨 Initialisation Tape-Taupe...');

    // Récupérer les éléments DOM
    modal = document.getElementById('modal-tapetaupe');
    if (!modal) {
     //console.warn('⚠️ [TAPE-TAUPE] Modal non trouvé');
      return;
    }

    betSection = document.getElementById('whack-bet-section');
    gameSection = document.getElementById('whack-game');
    endSection = document.getElementById('whack-end');

    betInput = document.getElementById('whack-bet-input');
    startBtn = document.getElementById('whack-start-btn');
    restartBtn = document.getElementById('whack-restart-btn');

    scoreDisplay = document.getElementById('whack-score');
    timerDisplay = document.getElementById('whack-timer');
    betDisplay = document.getElementById('whack-bet');

    holes = document.querySelectorAll('.whack-hole');

    if (!betSection || !gameSection || !endSection) {
     //console.error('❌ Sections du jeu Tape-Taupe manquantes');
      return;
    }

    // Supprimer les anciens événements des boutons
    if (startBtn) {
      const newStartBtn = startBtn.cloneNode(true);
      startBtn.replaceWith(newStartBtn);
      startBtn = newStartBtn;
      startBtn.addEventListener('click', startGame);
    }

    if (restartBtn) {
      const newRestartBtn = restartBtn.cloneNode(true);
      restartBtn.replaceWith(newRestartBtn);
      restartBtn = newRestartBtn;
      restartBtn.addEventListener('click', restartGame);
    }

    // FIX: Fermer le modal avec la croix
    const closeButton = modal.querySelector('.modal__close');
    if (closeButton) {
      const newCloseButton = closeButton.cloneNode(true);
      closeButton.replaceWith(newCloseButton);
      newCloseButton.addEventListener('click', closeModal);
    }

    // FIX: Fermer aussi avec les autres boutons de fermeture
    const closeButtons = modal.querySelectorAll('.js-close-modal');


    // Boutons de mise
    document.querySelectorAll('.bet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = parseInt(btn.dataset.amount);
        adjustBet(amount);
      });
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = parseInt(btn.dataset.amount);
        setBet(amount);
      });
    });

    // Clic sur les taupes
    holes.forEach(hole => {
      hole.addEventListener('click', () => whackMole(hole));
    });

    // Réinitialiser l'état du jeu
    resetGame();

   //console.log('✅ Tape-Taupe initialisé');
  };

  // ========================================
  // DÉMARRER UNE PARTIE
  // ========================================

  // Duel en cours sur ce jeu (voir static/js/duel-client.js)
  function duelActif() {
    return window.duelEnCours && window.duelEnCours.jeu === 'tapetaupe' ? window.duelEnCours : null;
  }

  async function startGame() {
    if (duelActif()) return startDuelGame();

    const betAmount = parseInt(betInput.value);

    // VALIDATION COMPLÈTE
    if (isNaN(betAmount)) {
      showToast('Veuillez entrer une mise valide', 'danger');
      return;
    }

    if (betAmount < 50) {
      showToast('Mise minimum : 50 points', 'danger');
      betInput.value = 50;
      return;
    }

    if (betAmount > 300) {
      showToast('Mise maximum : 300 points', 'danger');
      betInput.value = 300;
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betAmount })
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message, 'danger');
        return;
      }

      lancerPartie(data);
    } catch (error) {
     //console.error('❌ Erreur startGame:', error);
      showToast('Erreur réseau', 'danger');
    }
  }

  // Partie de duel : pas de mise, une seule tentative
  async function startDuelGame() {
    const duel = duelActif();
    try {
      const response = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duelId: duel.id })
      });
      const data = await response.json();

      if (!data.success) {
        showToast(data.message, 'danger');
        if (typeof window.finirModeDuel === 'function') window.finirModeDuel(null);
        resetGame();
        return;
      }

      lancerPartie(data);
    } catch (error) {
      showToast('Erreur réseau', 'danger');
    }
  }

  function lancerPartie(data) {
    // Initialiser la partie
    currentSessionId = data.sessionId;
    currentBet = data.betAmount;
    currentScore = 0;
    currentCombo = 0;
    timeLeft = data.duration;
    gameActive = true;

    // Mettre à jour le solde
    if (data.newPoints !== undefined) {
      if (typeof window.updateUserBalance === 'function') {
        window.updateUserBalance(data.newPoints);
      }

      // Mettre à jour le localStorage
      const user = JSON.parse(localStorage.getItem('user'));
      if (user) {
        user.points = data.newPoints;
        localStorage.setItem('user', JSON.stringify(user));
      }
    }

    // Afficher la section de jeu
    betSection.style.display = 'none';
    gameSection.style.display = 'block';
    endSection.style.display = 'none';

    updateDisplay();

    // Démarrer le timer
    startTimer();

    // Démarrer le spawn des taupes
    startMoleSpawning();
  }

  // ========================================
  // TIMER
  // ========================================

  function startTimer() {
    timerDisplay.textContent = timeLeft;

    timerInterval = setInterval(() => {
      timeLeft--;
      timerDisplay.textContent = timeLeft;

      // Changement de couleur quand il reste peu de temps
      if (timeLeft <= 10) {
        timerDisplay.style.color = '#ff4757';
      } else if (timeLeft <= 20) {
        timerDisplay.style.color = '#ffa502';
      }

      if (timeLeft <= 0) {
        endGame();
      }
    }, 1000);
  }

  // ========================================
  // SPAWN DES TAUPES
  // ========================================

  function startMoleSpawning() {
    spawnMole(); // Premier spawn immédiat

    const scheduleNext = () => {
      if (!gameActive) return;

      // Entre 300ms et 1100ms (délai variable)
      const delay = Math.random() * (800 - 300) + 300;

      spawnInterval = setTimeout(() => {
        spawnMole();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  async function spawnMole() {
    if (!gameActive || !currentSessionId) return;

    const availableHoles = Array.from(holes).filter(hole => !hole.classList.contains('active'));
    if (availableHoles.length === 0) return;

    const randomHole = availableHoles[Math.floor(Math.random() * availableHoles.length)];
    const holeIndex = Array.from(holes).indexOf(randomHole);

    try {
      const response = await fetch(`${API_BASE}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          holeIndex
        })
      });

      const data = await response.json();

      if (!data.success) {
       //console.warn('⚠️ Spawn échoué:', data.message);
        return;
      }

      // Passer la vitesse à showMole
      showMole(randomHole, data.moleType, data.points, holeIndex, data.speed);

    } catch (error) {
     //console.error('❌ Erreur spawn:', error);
    }
  }

  // ========================================
  // AFFICHER UNE TAUPE - AVEC VITESSES
  // ========================================

  function showMole(hole, moleType, points, holeIndex, speed) {
    const moleElement = hole.querySelector('.mole');

    if (!moleElement) {
     //console.error('❌ Élément .mole introuvable dans', hole);
      return;
    }

    // Nettoyer les anciennes classes
    moleElement.classList.remove('normal', 'golden', 'bomb', 'speed', 'speed-slow', 'speed-normal', 'speed-fast');

    // Ajouter le type de taupe
    moleElement.classList.add(moleType);

    // Ajouter la classe de vitesse
    if (speed) {
      moleElement.classList.add(`speed-${speed}`);
    } else {
      moleElement.classList.add('speed-normal');
    }

    // Activer le trou
    hole.classList.add('active');

    // Stocker les données
    hole.dataset.holeIndex = holeIndex;
    hole.dataset.molePoints = points;
    hole.dataset.moleType = moleType;
    hole.dataset.moleSpeed = speed || 'normal';

    // Temps d'affichage selon la vitesse
    const showTimes = {
      'slow': 2000,
      'normal': 1200,
      'fast': 700
    };
    const showTime = showTimes[speed] || 1200;

    // Notifier le backend quand la taupe expire
    const timeout = setTimeout(async () => {
      if (hole.classList.contains('active')) {
        const missedHoleIndex = parseInt(hole.dataset.holeIndex);
        const missedMoleType = hole.dataset.moleType;

        // Ne reset le combo QUE si ce n'est PAS une bombe
        if (missedMoleType !== 'bomb') {
          await notifyMoleMissed(missedHoleIndex);
        }

        hole.classList.remove('active');

        setTimeout(() => {
          moleElement.classList.remove('normal', 'golden', 'bomb', 'speed', 'speed-slow', 'speed-normal', 'speed-fast');
          delete hole.dataset.holeIndex;
          delete hole.dataset.molePoints;
          delete hole.dataset.moleType;
          delete hole.dataset.moleSpeed;
        }, 300);
      }
    }, showTime);

    hole.dataset.timeout = timeout;
  }

  // ========================================
  // NOTIFIER UNE TAUPE RATÉE
  // ========================================

  async function notifyMoleMissed(holeIndex) {
    if (!gameActive || !currentSessionId) return;

    try {
      const response = await fetch(`${API_BASE}/miss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          holeIndex
        })
      });

      const data = await response.json();

      if (data.success) {
        // Mettre à jour le combo côté frontend
        currentCombo = data.combo;
        updateDisplay();
      }
    } catch (error) {
     //console.error('❌ Erreur notifyMoleMissed:', error);
    }
  }

  // ========================================
  // FRAPPER UNE TAUPE
  // ========================================

  async function whackMole(hole) {
    if (!gameActive) return;

    // Détecter les clics sur cases vides
    if (!hole.classList.contains('active')) {
      await notifyMoleMissed(-1);
      hole.classList.add('missed');
      setTimeout(() => hole.classList.remove('missed'), 300);
      return;
    }

    const holeIndex = parseInt(hole.dataset.holeIndex);

    // Animation de frappe immédiate
    hole.classList.add('hit');

    // Annuler le timeout de disparition
    if (hole.dataset.timeout) {
      clearTimeout(parseInt(hole.dataset.timeout));
    }

    // Position pour les popups
    const rect = hole.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    try {
      const response = await fetch(`${API_BASE}/hit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          holeIndex
        })
      });

      const data = await response.json();

      if (!data.success) {
       //console.warn('⚠️ Hit échoué:', data.message);
        setTimeout(() => {
          hole.classList.remove('active', 'hit', 'normal', 'golden', 'bomb', 'speed');
        }, 300);
        return;
      }

      // Mettre à jour le score et le combo
      currentScore = data.totalScore;
      currentCombo = data.combo;

      updateDisplay();

      // Afficher les points gagnés/perdus
      showScorePopup(data.earnedPoints, x, y, hole.dataset.moleType);

      // Afficher le combo si > 1
      if (currentCombo > 1 && data.earnedPoints > 0) {
        setTimeout(() => {
          showComboPopup(x, y);
        }, 200);
      }

      // Retirer la taupe après l'animation
      setTimeout(() => {
        hole.classList.remove('active', 'hit', 'normal', 'golden', 'bomb', 'speed');
        delete hole.dataset.holeIndex;
        delete hole.dataset.molePoints;
      }, 300);

    } catch (error) {
     //console.error('❌ Erreur hit:', error);
      setTimeout(() => {
        hole.classList.remove('active', 'hit', 'normal', 'golden', 'bomb', 'speed');
      }, 300);
    }
  }

  // ========================================
  // AFFICHER POPUP COMBO
  // ========================================

  function showComboPopup(x, y) {
    const existingPopups = document.querySelectorAll('.score-popup.combo');
    if (existingPopups.length > 5) {
      existingPopups[0].remove();
    }

    const comboPopup = document.createElement('div');
    const comboClass = currentCombo >= 10 ? 'mega' : '';
    comboPopup.className = `score-popup combo ${comboClass}`.trim();
    comboPopup.textContent = currentCombo;

    const offsetX = (Math.random() * 40 - 20);
    const offsetY = (Math.random() * 40 - 20);

    comboPopup.style.setProperty('--popup-x', (x + offsetX) + 'px');
    comboPopup.style.setProperty('--popup-y', (y + offsetY) + 'px');
    comboPopup.style.transform = 'translate3d(0, 0, 0)';

    document.body.appendChild(comboPopup);

    const duration = currentCombo >= 10 ? 2000 : 1500;
    setTimeout(() => {
      comboPopup.remove();
    }, duration);
  }

  // ========================================
  // AFFICHER POPUP DE POINTS
  // ========================================

  function showScorePopup(points, x, y, moleType) {
    const popup = document.createElement('div');
    const isNegative = points < 0;
    popup.className = `score-popup ${isNegative ? 'negative' : ''}`;
    popup.textContent = (points > 0 ? '+' : '') + points;

    const offsetX = (Math.random() * 60 - 30);
    const offsetY = (Math.random() * 60 - 30);

    popup.style.setProperty('--popup-x', (x + offsetX) + 'px');
    popup.style.setProperty('--popup-y', (y + offsetY) + 'px');
    popup.style.transform = 'translate3d(0, 0, 0)';

    document.body.appendChild(popup);

    setTimeout(() => {
      popup.remove();
    }, 800);
  }

  // ========================================
  // TERMINER LA PARTIE
  // ========================================

  async function endGame() {
    // FIX: Empêcher les appels multiples
    if (!gameActive || !currentSessionId) return;

    gameActive = false;

    // FIX: Capturer le score AVANT de stopper
    const finalScore = currentScore;
    const finalBet = currentBet;
    const finalSessionId = currentSessionId;

    //console('🏁 endGame - Score final:', finalScore, 'Mise:', finalBet);

    stopGame();

    try {
      const response = await fetch(`${API_BASE}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: finalSessionId })
      });

      const data = await response.json();

      if (!data.success) {
        showToast(data.message, 'danger');
        return;
      }

      // Mettre à jour le solde
      if (data.newPoints !== undefined) {
  if (typeof window.updateUserBalance === 'function') {
    window.updateUserBalance(data.newPoints);
  }
  if (data.keyDropped) {
  if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
  if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
    window.updateUserKeys(data.userKeys);
  }
}
  
  // Mettre à jour le localStorage
  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    user.points = data.newPoints;
    localStorage.setItem('user', JSON.stringify(user));
  }
}

      // Afficher l'écran de fin
      gameSection.style.display = 'none';
      endSection.style.display = 'block';
      restartBtn.style.display = 'inline-flex';

      // Partie de duel : pas de gain, on affiche où en est le duel
      if (data.duel) {
        afficherFinDuel(data);
        if (typeof window.finirModeDuel === 'function') window.finirModeDuel(data.duel);
        currentSessionId = null;
        return;
      }

      // FIX: Utiliser les valeurs du serveur
      document.getElementById('end-score').textContent = data.finalScore;
      document.getElementById('end-bet-end').textContent = data.betAmount;

      const resultElement = document.getElementById('end-result');
      resultElement.textContent = (data.result >= 0 ? '+' : '') + data.result;
      resultElement.className = 'end-value ' + (data.result >= 0 ? 'positive' : 'negative');

      const endTitle = document.getElementById('end-title');
      if (data.result > data.betAmount * 0.5) {
        endTitle.textContent = '🎉 Incroyable ! 🎉';
      } else if (data.result > 0) {
        endTitle.textContent = '✨ Bien joué ! ✨';
      } else if (data.result === 0) {
        endTitle.textContent = '😐 Pas de gain';
      } else {
        endTitle.textContent = '💥 Réessaye !';
      }

      currentSessionId = null;

    } catch (error) {
     //console.error('❌ Erreur endGame:', error);
      showToast('Erreur réseau', 'danger');
    }
  }

  function afficherFinDuel(data) {
    const duel = data.duel;
    document.getElementById('end-score').textContent = data.finalScore;
    document.getElementById('end-bet-end').textContent = 'Duel (sans mise)';

    const resultElement = document.getElementById('end-result');
    const endTitle = document.getElementById('end-title');
    resultElement.className = 'end-value';

    if (duel.statut === 'termine') {
      resultElement.textContent = `${duel.monScore ?? 0} à ${duel.scoreAdversaire ?? 0}`;
      if (duel.resultat === 'victoire') {
        endTitle.textContent = `🏆 Victoire contre ${duel.adversaire} !`;
        resultElement.classList.add('positive');
      } else if (duel.resultat === 'defaite') {
        endTitle.textContent = `❌ Défaite contre ${duel.adversaire}`;
        resultElement.classList.add('negative');
      } else {
        endTitle.textContent = `🤝 Égalité avec ${duel.adversaire}`;
      }
    } else {
      endTitle.textContent = 'Score enregistré !';
      resultElement.textContent = `En attente de ${duel.adversaire}`;
    }
  }

  // ========================================
  // ARRÊTER LE JEU
  // ========================================

  function stopGame() {
    // FIX: Ne pas remettre gameActive à false ici (déjà fait dans endGame)

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (spawnInterval) {
      clearTimeout(spawnInterval);
      spawnInterval = null;
    }

    // Nettoyer toutes les taupes actives
    holes.forEach(hole => {
      if (hole.dataset.timeout) {
        clearTimeout(parseInt(hole.dataset.timeout));
      }
      hole.classList.remove('active', 'hit', 'normal', 'golden', 'bomb', 'speed');
      delete hole.dataset.holeIndex;
      delete hole.dataset.molePoints;
      delete hole.dataset.timeout;
    });
  }

  // ========================================
  // RÉINITIALISER LE JEU
  // ========================================

  function resetGame() {
    stopGame();

    currentScore = 0;
    currentCombo = 0;
    currentBet = 0;
    timeLeft = 30;
    currentSessionId = null;
    gameActive = false;

    // En duel, pas de mise : on cache la zone de mise
    betSection.style.display = duelActif() ? 'none' : 'block';
    gameSection.style.display = 'none';
    endSection.style.display = 'none';
    startBtn.style.display = 'inline-flex';
    restartBtn.style.display = 'none';

    updateDisplay();
    timerDisplay.textContent = 30;
    timerDisplay.style.color = 'var(--primary-purple)';
  }

  function restartGame() {
    // FIX: Simplement retourner à l'écran de mise
    betSection.style.display = 'block';
    gameSection.style.display = 'none';
    endSection.style.display = 'none';
    startBtn.style.display = 'inline-flex';
    restartBtn.style.display = 'none';

    currentScore = 0;
    currentCombo = 0;
    updateDisplay();
    timerDisplay.textContent = 30;
    timerDisplay.style.color = 'var(--primary-purple)';
  }

  // ========================================
  // MISE À JOUR DE L'AFFICHAGE
  // ========================================

  function updateDisplay() {
    if (scoreDisplay) scoreDisplay.textContent = currentScore;
    if (betDisplay) betDisplay.textContent = currentBet;
  }

  // ========================================
  // GESTION DES MISES
  // ========================================

  function adjustBet(amount) {
    const currentBetValue = parseInt(betInput.value) || 100;
    const newBet = Math.max(100, currentBetValue + amount);
    setBet(newBet);
  }

  function setBet(amount) {
    betInput.value = Math.max(100, amount);
  }

  // ========================================
  // UTILITAIRES
  // ========================================

  function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      if (type === 'danger') {
        alert('❌ ' + message);
      } else if (type === 'success') {
        alert('✅ ' + message);
      } else {
        alert('ℹ️ ' + message);
      }
    }
  }

  function openModal() {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    resetGame();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    stopGame();
  }

  // Utilisé par duel-client.js pour remettre le jeu à zéro avant une partie de duel
  window.reinitialiserTapeTaupe = function () {
    if (betSection) resetGame();
  };

  // ========================================
  // INITIALISATION AU CHARGEMENT
  // ========================================

  // Initialiser si la modale existe déjà au chargement
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('modal-tapetaupe')) {
      window.initTapeTaupe();
    }
  });

  // Écouter l'événement de chargement dynamique
  document.addEventListener('tapetaupeModalLoaded', () => {
    window.initTapeTaupe();
  });

})();
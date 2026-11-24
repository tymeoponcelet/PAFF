// ========================================
// PUISSANCE 4 CLIENT - ISOLÉ
// ========================================

(function () {
  'use strict';

  // ========================================
  // CONSTANTES DU JEU
  // ========================================
  const ROWS = 6;
  const COLS = 7;
  const PLAYER = 1;
  const AI = 2;

  // ========================================
  // VARIABLES GLOBALES
  // ========================================
  let board = [];
  let currentPlayer = PLAYER;
  let gameActive = false;
  let betAmount = 100;
  let sessionId = null;

  // ========================================
  // INITIALISATION
  // ========================================

  /**
   * Initialise le jeu Puissance 4 (appelé au chargement de la modale)
   */
  window.initPuissance4 = function () {
    ////console('🔴🟡 Initialisation Puissance 4...');

    const openTriggers = document.querySelectorAll('.js-open-table-puissance4');
    const modal = document.getElementById('puissance4Modal');
    const closeButtons = document.querySelectorAll('.js-close-p4-modal');
    const startBtn = document.getElementById('p4StartBtn');
    const resetBtn = document.getElementById('p4ResetBtn');

    if (!modal) {
      //console.warn('⚠️ [PUISSANCE4] Modale non trouvée');
      return;
    }

    // FIX: Initialiser la grille dès l'ouverture
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    sessionId = null;
    gameActive = false;
    currentPlayer = PLAYER;

    // FIX: Rendre la grille immédiatement
    renderBoard();
    updateTurnDisplay();
    hideResult();

    // Supprimer les anciens événements des boutons
    if (startBtn) {
      const newStartBtn = startBtn.cloneNode(true);
      startBtn.replaceWith(newStartBtn);
      document.getElementById('p4StartBtn').addEventListener('click', () => {
        startGame();
        document.getElementById('p4StartBtn').style.display = 'none';
      });
      // FIX: S'assurer que le bouton est visible
      document.getElementById('p4StartBtn').style.display = 'block';
    }

    if (resetBtn) {
      const newResetBtn = resetBtn.cloneNode(true);
      resetBtn.replaceWith(newResetBtn);
      document.getElementById('p4ResetBtn').addEventListener('click', () => {
        const startBtn = document.getElementById('p4StartBtn');
        if (startBtn) startBtn.style.display = 'block';
        document.getElementById('p4ResetBtn').disabled = true;
        hideResult();

        board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
        sessionId = null;
        gameActive = false;
        currentPlayer = PLAYER;
        renderBoard();
        updateTurnDisplay();
      });
      document.getElementById('p4ResetBtn').disabled = true;
    }

    // Fermeture du modal
    closeButtons.forEach(btn => btn.addEventListener('click', closeModal));


    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    ////console('✅ Puissance 4 initialisé');
  };

  // ========================================
  // DEMARRAGE DU JEU (AVEC APPEL SERVEUR)
  // ========================================
  async function startGame() {
    const betInput = document.getElementById('p4BetAmount');
    betAmount = betInput ? parseInt(betInput.value) : 100;
    const minBet = betInput ? parseInt(betInput.min) || 50 : 50;

    // Dans startGame(), remplace la validation existante par :
    if (isNaN(betAmount) || betAmount < minBet || betAmount > 500) {
      alert(`Mise entre ${minBet} et 500 points`);
      const startBtn = document.getElementById('p4StartBtn');
      if (startBtn) startBtn.style.display = 'block';
      return;
    }

    try {
      // Appel au serveur pour démarrer la partie
      const response = await fetch('/actions/puissance4/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ betAmount })
      });

      const data = await response.json();

      if (!data.success) {
        alert(data.message || 'Erreur lors du démarrage de la partie');
        const startBtn = document.getElementById('p4StartBtn');
        if (startBtn) startBtn.style.display = 'block';
        return;
      }

      // Récupérer les données du serveur
      sessionId = data.sessionId;
      board = convertServerBoard(data.board);
      currentPlayer = PLAYER;
      gameActive = true;

      // Mettre à jour les points affichés
      updatePointsDisplay(data.newPoints);
      if (data.keyDropped) {
        if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
        if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
          window.updateUserKeys(data.userKeys);
        }
      }

      hideResult();
      renderBoard();
      updateTurnDisplay();

    } catch (error) {
      //console.error('❌ [PUISSANCE4] Erreur startGame:', error);
      alert('Impossible de démarrer la partie');
      const startBtn = document.getElementById('p4StartBtn');
      if (startBtn) startBtn.style.display = 'block';
    }
  }

  // ========================================
  // CONVERSION DU PLATEAU SERVEUR
  // ========================================
  function convertServerBoard(serverBoard) {
    return serverBoard.map(row =>
      row.map(cell => {
        if (cell === 'red') return PLAYER;
        if (cell === 'yellow') return AI;
        return 0;
      })
    );
  }

  // ========================================
  // UTILITAIRE : Trouver la ligne disponible
  // ========================================
  function getAvailableRow(col) {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row][col] === 0) return row;
    }
    return -1;
  }

  // ========================================
  // AFFICHAGE DU PLATEAU
  // ========================================
  function renderBoard(newRow = null, newCol = null) {
    const boardElement = document.getElementById('p4Board');
    if (!boardElement) return;

    boardElement.innerHTML = '';

    // Créer toutes les cellules du plateau
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = document.createElement('div');
        cell.className = 'puissance4__cell';
        cell.dataset.row = row;
        cell.dataset.col = col;

        // Ajouter la classe correspondant au joueur
        if (board[row][col] === PLAYER) {
          cell.classList.add('puissance4__cell--red', 'puissance4__cell--filled');
          if (row === newRow && col === newCol) {
            cell.style.animation = 'dropCoin 0.6s ease-out';
          }
        } else if (board[row][col] === AI) {
          cell.classList.add('puissance4__cell--yellow', 'puissance4__cell--filled');
          if (row === newRow && col === newCol) {
            cell.style.animation = 'dropCoin 0.6s ease-out';
          }
        }

        boardElement.appendChild(cell);
      }
    }

    // Ajouter les écouteurs de clic si c'est le tour du joueur
    if (gameActive && currentPlayer === PLAYER) {
      addColumnListeners();
    }
  }

  // ========================================
  // GESTION DES CLICS
  // ========================================
  function addColumnListeners() {
    const boardElement = document.getElementById('p4Board');
    if (!boardElement) return;

    for (let col = 0; col < COLS; col++) {
      const columnCells = Array.from(boardElement.querySelectorAll(`[data-col="${col}"]`));
      const isColumnFull = getAvailableRow(col) === -1;

      if (!isColumnFull) {
        columnCells.forEach(cell => {
          if (!cell.classList.contains('puissance4__cell--filled')) {
            cell.style.cursor = 'pointer';

            cell.addEventListener('mouseenter', () => {
              columnCells.forEach(c => {
                if (!c.classList.contains('puissance4__cell--filled')) {
                  c.classList.add('puissance4__cell--hover');
                }
              });
            });

            cell.addEventListener('mouseleave', () => {
              columnCells.forEach(c => c.classList.remove('puissance4__cell--hover'));
            });

            cell.addEventListener('click', () => handleColumnClick(col));
          }
        });
      }
    }
  }

  // ========================================
  // GESTION DU COUP (AVEC APPEL SERVEUR)
  // ========================================
  async function handleColumnClick(col) {
    if (!gameActive || currentPlayer !== PLAYER || !sessionId) {
      return;
    }

    const row = getAvailableRow(col);
    if (row === -1) {
      return;
    }

    // Afficher immédiatement le jeton du joueur
    board[row][col] = PLAYER;
    renderBoard(row, col);

    // Désactiver les clics pendant le traitement
    gameActive = false;
    currentPlayer = AI;
    updateTurnDisplay();

    try {
      const response = await fetch('/actions/puissance4/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, col })
      });

      const data = await response.json();

      if (!data.success) {
        board[row][col] = 0;
        renderBoard();
        alert(data.message || 'Erreur lors du coup');
        gameActive = true;
        currentPlayer = PLAYER;
        updateTurnDisplay();
        return;
      }

      board = convertServerBoard(data.board);

      await new Promise(resolve => setTimeout(resolve, 650));

      if (data.aiMove) {
        renderBoard(data.aiMove.row, data.aiMove.col);
      }

      if (data.result) {
        await new Promise(resolve => setTimeout(resolve, 650));
        updatePointsDisplay(data.newPoints);
        endGame(data.result, data.message);
      } else {
        await new Promise(resolve => setTimeout(resolve, 650));
        gameActive = true;
        currentPlayer = PLAYER;
        updateTurnDisplay();
        renderBoard();
      }

    } catch (error) {
      //console.error('❌ [PUISSANCE4] Erreur handleColumnClick:', error);
      board[row][col] = 0;
      renderBoard();
      alert('Impossible de jouer ce coup');
      gameActive = true;
      currentPlayer = PLAYER;
      updateTurnDisplay();
    }
  }

  // ========================================
  // AFFICHAGE DE L'ETAT DU JEU
  // ========================================
  function updateTurnDisplay() {
    const turnElement = document.getElementById('p4TurnText');
    if (!turnElement) return;

    if (currentPlayer === PLAYER) {
      turnElement.textContent = '🔴 Votre tour';
      turnElement.style.color = '#ef4444';
    } else {
      turnElement.textContent = '🟡 Tour du robot...';
      turnElement.style.color = '#fbbf24';
    }
  }

  function endGame(result, message) {
    gameActive = false;

    const resultElement = document.getElementById('p4Result');
    if (!resultElement) return;

    resultElement.textContent = message;

    if (result === 'win') {
      resultElement.className = 'puissance4__result puissance4__result--win';
    } else if (result === 'lose') {
      resultElement.className = 'puissance4__result puissance4__result--lose';
    } else {
      resultElement.className = 'puissance4__result puissance4__result--draw';
    }

    resultElement.style.display = 'block';

    const resetBtn = document.getElementById('p4ResetBtn');
    if (resetBtn) resetBtn.disabled = false;
  }

  function hideResult() {
    const resultElement = document.getElementById('p4Result');
    if (resultElement) resultElement.style.display = 'none';

    const resetBtn = document.getElementById('p4ResetBtn');
    if (resetBtn) resetBtn.disabled = true;
  }

  function updatePointsDisplay(newPoints) {
    if (newPoints === undefined || newPoints === null) return;

    // Mettre à jour l'affichage local dans le jeu
    const pointsElements = document.querySelectorAll('[data-user-points]');
    pointsElements.forEach(el => {
      el.textContent = `${newPoints} pts`;
    });

    // ✅ METTRE À JOUR LA NAVBAR EN TEMPS RÉEL
    if (typeof window.updateUserBalance === 'function') {
      window.updateUserBalance(newPoints);
    }

    // Mettre à jour le localStorage
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      user.points = newPoints;
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  // ========================================
  // INITIALISATION AU CHARGEMENT
  // ========================================

  // Initialiser si la modale existe déjà au chargement
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('puissance4Modal')) {
      window.initPuissance4();
    }
  });

  // Écouter l'événement de chargement dynamique
  document.addEventListener('puissance4ModalLoaded', () => {
    window.initPuissance4();
  });

})();
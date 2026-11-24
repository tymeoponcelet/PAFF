// ========================================
// MINES CLIENT (remplace Mastermind)
// (isolé pour éviter les collisions globales)
// ========================================

(function () {
  "use strict";
  const MINES_API_BASE = "/actions/mastermind"; // même route côté serveur

  let currentSessionId = null;
  let minesState = {
    rows: 0,
    cols: 0,
    totalMines: 0,
    totalSafe: 0,
    safeRevealed: 0,
    multiplier: 1,
    potentialWin: 0,
    betAmount: 50,
    gameOver: false,
  };

  // ========================================
  // DÉMARRER UNE PARTIE MINES
  // ========================================

  async function startMastermind() {
    //console.log(" Démarrage du jeu Mines...");
    const startBtn = document.getElementById("startMastermindBtn");
    if (!startBtn) return;

    startBtn.disabled = true;

    // Récupérer le nombre de mines choisi
    const mineInput = document.getElementById("mineCountInput");
    const chosenMines = parseInt(mineInput.value, 10) || 5; // fallback 5 si vide

    try {
      const response = await fetch(`${MINES_API_BASE}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ totalMines: chosenMines }),
      });

      const data = await response.json();

      if (!data.success) {
        alert(`❌ ${data.message}`);
        startBtn.disabled = false;
        return;
      }

      currentSessionId = data.sessionId;
      minesState = {
        rows: data.rows,
        cols: data.cols,
        totalMines: data.totalMines,
        totalSafe: data.totalSafe,
        safeRevealed: 0,
        multiplier: data.initialMultiplier || 1,
        potentialWin: data.potentialWin || 0,
        betAmount: data.betAmount,
        gameOver: false,
      };

      updatePoints(data.newPoints);
      showGameArea();
      renderMinesGrid();
      updateMinesStats();

    } catch (error) {
      alert("❌ Erreur de connexion au serveur");
      startBtn.disabled = false;
    }
  }

  // ========================================
  // CLIQUER SUR UNE CASE
  // ========================================

  async function handleCellClick(row, col) {
    if (!currentSessionId || minesState.gameOver) return;

    try {
      const response = await fetch(`${MINES_API_BASE}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId: currentSessionId,
          row,
          col,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert(`❌ ${data.message}`);
        return;
      }

      // Mettre à jour l'état (sans opérateur ?? pour compatibilité)
      minesState.safeRevealed =
        data.safeRevealed !== undefined && data.safeRevealed !== null
          ? data.safeRevealed
          : minesState.safeRevealed;
      minesState.multiplier =
        data.multiplier !== undefined && data.multiplier !== null
          ? data.multiplier
          : minesState.multiplier;
      minesState.potentialWin =
        data.potentialWin !== undefined && data.potentialWin !== null
          ? data.potentialWin
          : minesState.potentialWin;
      minesState.gameOver = data.gameOver || false;

      // Mettre à jour la grille visuellement
      applyRevealOnGrid(data);
      updateMinesStats();

      if (data.gameOver) {
        handleEndOfGameFromServer(data);
      }
    } catch (error) {
      console.error("❌ Erreur handleCellClick:", error);
      alert("❌ Erreur de connexion au serveur");
    }
  }

  function applyRevealOnGrid(data) {
    const boardEl = document.getElementById("mastermindBoard");
    if (!boardEl) return;

    // Case cliquée
    if (data.revealedCell) {
      const { row, col } = data.revealedCell;
      const cell = boardEl.querySelector(
        `[data-row="${row}"][data-col="${col}"]`,
      );
      if (cell) {
        if (data.bomb) {
          cell.classList.add("mines__cell--bomb");
        } else {
          cell.classList.add("mines__cell--safe");
        }
      }
    }

    // Fin de partie : révéler toutes les mines
    if (data.gameOver && Array.isArray(data.mines)) {
      data.mines.forEach(({ row, col }) => {
        const cell = boardEl.querySelector(
          `[data-row="${row}"][data-col="${col}"]`,
        );
        if (cell && !cell.classList.contains("mines__cell--safe")) {
          cell.classList.add("mines__cell--bomb");
        }
      });

      // Désactiver tous les clics
      boardEl
        .querySelectorAll(".mines__cell")
        .forEach((cell) => (cell.style.pointerEvents = "none"));
    }
  }

  // ========================================
  // CASHOUT (ENCAISSER)
  // ========================================

  async function submitGuess() {
    // Réutilisation du bouton "Valider" pour encaisser
    if (!currentSessionId || minesState.gameOver) return;

    try {
      const response = await fetch(`${MINES_API_BASE}/cashout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: currentSessionId }),
      });

      const data = await response.json();

      if (!data.success) {
        alert(`❌ ${data.message}`);
        return;
      }

      minesState.gameOver = true;
      updatePoints(data.newPoints);
      if (data.keyDropped) {
  if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
  if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
    window.updateUserKeys(data.userKeys);
  }
}
      handleEndOfGameFromServer(data);
    } catch (error) {
      console.error("❌ Erreur cashout:", error);
      alert("❌ Erreur de connexion au serveur");
    }
  }

  // ========================================
  // ABANDONNER LA PARTIE
  // ========================================

  async function forfeitGame() {
    if (!currentSessionId || minesState.gameOver) return;

    if (
      !confirm(
        "⚠️ Abandonner la partie Mines ? Vous perdrez définitivement votre mise.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`${MINES_API_BASE}/forfeit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: currentSessionId }),
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message || "Partie abandonnée.");
        minesState.gameOver = true;
        resetGame();
      }
    } catch (error) {
      console.error("❌ Erreur forfeit Mines:", error);
      alert("❌ Erreur de connexion");
    }
  }

  // ========================================
  // FIN DE PARTIE (POPUP)
  // ========================================

  function handleEndOfGameFromServer(data) {
    const won = !!data.won;
    const newBalance = data.newPoints;
    const profit = data.profit ?? 0;
    const multiplier = data.multiplier ?? minesState.multiplier;
    const totalWin = data.totalWin ?? minesState.potentialWin;

      if (data.keyDropped) {
    if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
    if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
      window.updateUserKeys(data.userKeys);
    }
  }

    // Afficher la popup directement dans le DOM
    const overlay = document.getElementById("mastermindWinPopupOverlay");
    if (overlay) {
      overlay.classList.add("active");

      // Icône et titre
      const icon = document.getElementById("mastermindPopupIcon");
      const title = document.getElementById("mastermindPopupTitle");
      if (icon) icon.textContent = won ? "🎉" : "😢";
      if (title) title.textContent = won ? "BRAVO !" : "PERDU";

      // Montant gagné/perdu
      const amountEl = document.getElementById("mastermindPopupAmount");
      if (amountEl)
        amountEl.textContent = `${profit >= 0 ? "+" : ""}${profit} pts`;

      // Multiplicateur
      const multiplierEl = document.getElementById("mastermindPopupMultiplier");
      if (multiplierEl) multiplierEl.textContent = `x${multiplier.toFixed(2)}`;

      // Gain total
      const totalWinEl = document.getElementById("mastermindPopupTotalWin");
      if (totalWinEl) totalWinEl.textContent = `${totalWin} pts`;

      // Nouveau solde
      const balanceEl = document.getElementById("mastermindPopupBalance");
      if (balanceEl) balanceEl.textContent = `${newBalance || 0} pts`;

      // Cases sûres révélées
      const attemptsEl = document.getElementById("mastermindPopupAttempts");
      if (attemptsEl)
        attemptsEl.textContent = `${data.safeRevealed}/${minesState.totalSafe}`;

      // Message
      const messageEl = document.getElementById("mastermindPopupMessage");
      if (messageEl)
        messageEl.textContent =
          data.message ||
          (won ? "Vous avez encaissé votre gain !" : "Partie terminée");
    }

    // Désactiver les boutons
    ["submitGuessBtn", "forfeitBtn", "clearGuessBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = true;
    });

    // Réinitialiser la partie après quelques secondes
    setTimeout(() => resetGame(), 4000);
  }

  // ========================================
  // RENDU DE LA GRILLE MINES
  // ========================================

  function renderMinesGrid() {
    const boardEl = document.getElementById("mastermindBoard");
    if (!boardEl) return;

    boardEl.innerHTML = "";
    boardEl.className = "mines__board";
    boardEl.style.setProperty("--mines-rows", minesState.rows);
    boardEl.style.setProperty("--mines-cols", minesState.cols);

    for (let r = 0; r < minesState.rows; r++) {
      for (let c = 0; c < minesState.cols; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "mines__cell";
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.addEventListener("click", () => handleCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }
  }

  function updateMinesStats() {
    const betEl = document.getElementById("minesBet");
    const multiEl = document.getElementById("minesMultiplier");
    const potentialEl = document.getElementById("minesPotentialWin");
    const revealedEl = document.getElementById("minesRevealed");
    const minesEl = document.getElementById("minesMines");

    if (betEl) betEl.textContent = `${minesState.betAmount} pts`;
    if (multiEl)
      multiEl.textContent = `x${(minesState.multiplier || 1).toFixed(2)}`;
    if (potentialEl)
      potentialEl.textContent = `${minesState.potentialWin || 0} pts`;
    if (revealedEl)
      revealedEl.textContent = `${minesState.safeRevealed}/${
        minesState.totalSafe
      }`;
    if (minesEl) minesEl.textContent = `${minesState.totalMines} mines cachées`;
  }

  // ========================================
  // AFFICHER / MASQUER LES ZONES
  // ========================================

  function showGameArea() {
    const startArea = document.getElementById("mastermindStart");
    const gameArea = document.getElementById("mastermindGame");

    if (startArea) startArea.style.display = "none";
    if (gameArea) gameArea.style.display = "block";

    const submitBtn = document.getElementById("submitGuessBtn");
    const forfeitBtn = document.getElementById("forfeitBtn");
    const clearBtn = document.getElementById("clearGuessBtn");

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Encaisser";
    }
    if (forfeitBtn) forfeitBtn.disabled = false;
    if (clearBtn) {
      clearBtn.disabled = true;
      clearBtn.style.display = "none";
    }
  }

  // ========================================
  // RÉINITIALISER LA PARTIE
  // ========================================

  function resetGame() {
    currentSessionId = null;
    minesState = {
      rows: 0,
      cols: 0,
      totalMines: 0,
      totalSafe: 0,
      safeRevealed: 0,
      multiplier: 1,
      potentialWin: 0,
      betAmount: 50,
      gameOver: false,
    };

    const startArea = document.getElementById("mastermindStart");
    const gameArea = document.getElementById("mastermindGame");
    const boardEl = document.getElementById("mastermindBoard");

    if (startArea) startArea.style.display = "block";
    if (gameArea) gameArea.style.display = "none";
    if (boardEl) boardEl.innerHTML = "";

    const startBtn = document.getElementById("startMastermindBtn");
    if (startBtn) startBtn.disabled = false;
  }

  // ========================================
  // FONCTIONS UTILITAIRES
  // ========================================

  function updatePoints(newPoints) {
    if (newPoints === undefined || newPoints === null) return;

    const pointsDisplay = document.querySelector("[data-user-points]");
    if (pointsDisplay) {
      pointsDisplay.textContent = `${newPoints} pts`;
    }

    if (typeof window.updateUserBalance === "function") {
      window.updateUserBalance(newPoints);
    }

    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user) {
        user.points = newPoints;
        localStorage.setItem("user", JSON.stringify(user));
      }
    } catch (e) {
      console.error("Erreur localStorage:", e);
    }
  }

  // ========================================
  // INITIALISATION
  // ========================================

  function initMastermind() {
    //console.log(" Initialisation Mines (ex‑Mastermind)...");

    const modal = document.getElementById("mastermindModal");
    if (!modal) {
      //console.warn(" Modale Mines introuvable");
      return;
    }

    resetGame();

    const minusBtn = document.getElementById("mineCountMinus");
    const plusBtn = document.getElementById("mineCountPlus");
    const countDisplay = document.getElementById("mineCountDisplay");
    const countInput = document.getElementById("mineCountInput");

    if (minusBtn && plusBtn) {
      // Cloner pour supprimer les anciens listeners
      const newMinus = minusBtn.cloneNode(true);
      const newPlus = plusBtn.cloneNode(true);
      minusBtn.parentNode.replaceChild(newMinus, minusBtn);
      plusBtn.parentNode.replaceChild(newPlus, plusBtn);

      newMinus.addEventListener("click", () => {
        let v = parseInt(countInput.value) - 1;
        if (v < 1) v = 1;
        countInput.value = v;
        countDisplay.textContent = v;
      });
      newPlus.addEventListener("click", () => {
        let v = parseInt(countInput.value) + 1;
        if (v > 24) v = 24;
        countInput.value = v;
        countDisplay.textContent = v;
      });
    }

    const startBtn = document.getElementById("startMastermindBtn");
    if (startBtn) {
      const newStartBtn = startBtn.cloneNode(true);
      startBtn.parentNode.replaceChild(newStartBtn, startBtn);
      newStartBtn.addEventListener("click", startMastermind);
    }

    const submitBtn = document.getElementById("submitGuessBtn");
    if (submitBtn) {
      const newSubmitBtn = submitBtn.cloneNode(true);
      submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
      newSubmitBtn.addEventListener("click", submitGuess);
    }

    const clearBtn = document.getElementById("clearGuessBtn");
    if (clearBtn) {
      const newClearBtn = clearBtn.cloneNode(true);
      clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
    }

    const forfeitBtn = document.getElementById("forfeitBtn");
    if (forfeitBtn) {
      const newForfeitBtn = forfeitBtn.cloneNode(true);
      forfeitBtn.parentNode.replaceChild(newForfeitBtn, forfeitBtn);
      newForfeitBtn.addEventListener("click", forfeitGame);
    }

    const closeButtons = modal.querySelectorAll(".js-close-modal");
    closeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.classList.remove("is-open");
        setTimeout(() => {
          resetGame();
        }, 400);
      });
    });;
  }

  // ========================================
  //  EXPOSITION 
  // ========================================

  window.initMastermind = initMastermind;
  window.startMastermind = startMastermind;
  window.submitGuess = submitGuess;
  window.forfeitGame = forfeitGame;

  // ========================================
  // ÉVÉNEMENTS DOM
  // ========================================

  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("mastermindModal")) {
      initMastermind();
    }
  });

  document.addEventListener("mastermindModalLoaded", initMastermind);
})();

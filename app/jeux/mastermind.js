const express = require("express");
const router = express.Router();
const db = require("../../config");
const { requireAuth, checkBalance } = require("../middleware/auth");
const checkTime = require("../middleware/checktime");
const { tryKeyDrop } = require('../key-drop');
router.use(checkTime);

// ========================================
// ⚙️ CONFIGURATION MINES
// ========================================

const GRID_ROWS = 5; // 7 lignes
const GRID_COLS = 5; // 5 colonnes (comme 5 rouleaux)
const MINES_COUNT = 5; // Nombre de mines par grille
const BET_AMOUNT = 50; // Mise fixe par partie (comme Mastermind)

// Sessions de jeu actives en mémoire
// session = {
//   userId,
//   mines: Set<'row,col'>,
//   revealed: Set<'row,col'>,
//   safeRevealed,
//   betAmount,
//   totalSafe,
//   gameActive,
//   startTime
// }
const activeSessions = new Map();

// Génère aléatoirement la position des mines
function generateMines(count) {
  const mines = new Set();
  while (mines.size < count) {
    const row = Math.floor(Math.random() * GRID_ROWS);
    const col = Math.floor(Math.random() * GRID_COLS);
    mines.add(`${row},${col}`);
  }
  return mines;
}

// Courbe de multiplicateur : augmente de plus en plus vite
// Retourne un multiplicateur >= 1 (1 = simple remboursement)
function computeMultiplier(safeRevealed, totalMines) {
  if (safeRevealed <= 0) return 1;

  const totalCells = GRID_ROWS * GRID_COLS; // 25
  const totalSafe  = totalCells - totalMines;

  // Probabilité de survivre à chaque révélation successive
  // P = (totalSafe / totalCells) * ((totalSafe-1) / (totalCells-1)) * ...
  let probability = 1;
  for (let i = 0; i < safeRevealed; i++) {
    probability *= (totalSafe - i) / (totalCells - i);
  }

  // Multiplicateur = 1 / probabilité, avec une marge maison de 3%
  const houseEdge = 0.97;
  return (1 / probability) * houseEdge;
}

function minesToArray(minesSet) {
  return Array.from(minesSet).map((key) => {
    const [row, col] = key.split(",").map(Number);
    return { row, col };
  });
}

// ========================================
// 🚀 DÉMARRER UNE PARTIE MINES
// ========================================

router.post("/start", requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const userPoints = req.session.user.points;

  if (userPoints < BET_AMOUNT) {
    return res.status(400).json({
      success: false,
      message: `Points insuffisants. Mise requise : ${BET_AMOUNT} pts`,
    });
  }

  const sessionId = `${userId}_${Date.now()}`;

  // Récupérer le nombre de mines choisi par le joueur, sinon utiliser la valeur par défaut
  let minesCount = parseInt(req.body.totalMines, 10);

  if (isNaN(minesCount) || minesCount < 1) {
    minesCount = MINES_COUNT;
  }

  const maxCells = GRID_ROWS * GRID_COLS - 1;

  if (minesCount > maxCells) {
    minesCount = maxCells;
  }

  const mines = generateMines(minesCount);
  const totalSafe = GRID_ROWS * GRID_COLS - minesCount;

  // Déduire la mise
  try {
    // Déduire les points
    const updateStmt = db.prepare(
      "UPDATE compte SET points = points - ? WHERE id = ?",
    );
    const updateResult = updateStmt.run(BET_AMOUNT, userId);

    if (updateResult.changes === 0) {
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la mise",
      });
    }

    // Logger la mise
    const logStmt = db.prepare(
      "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)",
    );
    logStmt.run(userId, -BET_AMOUNT, `Mines - Mise : ${BET_AMOUNT} pts`);

    // Récupérer le nouveau solde
    const getStmt = db.prepare("SELECT points FROM compte WHERE id = ?");
    const user = getStmt.get(userId);

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "Erreur de récupération des points",
      });
    }

    req.session.user.points = user.points;

    activeSessions.set(sessionId, {
      userId,
      mines,
      revealed: new Set(),
      safeRevealed: 0,
      betAmount: BET_AMOUNT,
      totalSafe,
      totalMines: minesCount,
      gameActive: true,
      startTime: Date.now(),
    });

    res.json({
      success: true,
      sessionId,
      rows: GRID_ROWS,
      cols: GRID_COLS,
      totalMines: minesCount,
      totalSafe,
      betAmount: BET_AMOUNT,
      newPoints: user.points,
      initialMultiplier: 1,
      potentialWin: 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
    });
  }
});

// ========================================
// 💣 RÉVÉLER UNE CASE
// ========================================

router.post("/reveal", requireAuth, (req, res) => {
  const { sessionId, row, col } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId || !session.gameActive) {
    return res.status(400).json({
      success: false,
      message: "Session invalide ou partie terminée",
    });
  }

  const r = parseInt(row, 10);
  const c = parseInt(col, 10);

  if (
    Number.isNaN(r) ||
    Number.isNaN(c) ||
    r < 0 ||
    r >= GRID_ROWS ||
    c < 0 ||
    c >= GRID_COLS
  ) {
    return res.status(400).json({
      success: false,
      message: "Coordonnées invalides",
    });
  }

  const key = `${r},${c}`;

  if (session.revealed.has(key)) {
    return res.status(400).json({
      success: false,
      message: "Case déjà révélée",
    });
  }

  // Mine touchée -> défaite immédiate
  if (session.mines.has(key)) {
    session.gameActive = false;
    activeSessions.delete(sessionId);

    try {
      const logStmt = db.prepare(
        "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)",
      );

      logStmt.run(
        userId,
        0,
        `Mines - Mine touchée : -${session.betAmount} pts`,
      );
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Erreur lors de l’enregistrement du log",
      });
    }

    tryKeyDrop(db, userId, session.betAmount, 'mines', (errDrop, dropResult) => {
      if (errDrop) dropResult = { dropped: false, userKeys: null };
      return res.json({
        success: true,
        bomb: true,
        gameOver: true,
        won: false,
        revealedCell: { row: r, col: c },
        mines: minesToArray(session.mines),
        safeRevealed: session.safeRevealed,
        totalSafe: session.totalSafe,
        totalMines: session.totalMines,
        message: "💥 Vous avez touché une mine ! Mise perdue.",
        keyDropped: dropResult && dropResult.dropped,
        userKeys: dropResult && dropResult.userKeys
      });
    });
    return;
  }

  // Case safe
  session.revealed.add(key);
  session.safeRevealed += 1;

  const multiplier = computeMultiplier(
    session.safeRevealed,
    session.totalMines,
  );
  const roundedMultiplier = Number(multiplier.toFixed(2));
  const potentialWin = Math.round(session.betAmount * multiplier);
  const allSafeRevealed = session.safeRevealed >= session.totalSafe;

  // Toutes les cases safe sont trouvées -> cashout automatique
  if (allSafeRevealed) {
    session.gameActive = false;
    activeSessions.delete(sessionId);

    const payout = potentialWin;
    const variation = payout - session.betAmount;

    try {
      const transaction = db.transaction(() => {
        // Ajouter les gains
        const updateStmt = db.prepare(
          "UPDATE compte SET points = points + ? WHERE id = ?",
        );
        const result = updateStmt.run(payout, userId);

        if (result.changes === 0) {
          throw new Error("Compte introuvable");
        }

        // Log
        const logStmt = db.prepare(
          "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)",
        );
        logStmt.run(
          userId,
          variation,
          `Mines - Grille complète : +${variation} pts`,
        );

        // Récupérer nouveau solde
        const getStmt = db.prepare("SELECT points FROM compte WHERE id = ?");
        return getStmt.get(userId);
      });

      const user = transaction();

      req.session.user.points = user.points;

tryKeyDrop(db, userId, session.betAmount, 'mines', (errDrop, dropResult) => {
  if (errDrop) dropResult = { dropped: false, userKeys: null };
  return res.json({
    success: true,
    bomb: false,
    autoCashout: true,
    gameOver: true,
    won: true,
    revealedCell: { row: r, col: c },
    mines: minesToArray(session.mines),
    safeRevealed: session.safeRevealed,
    totalSafe: session.totalSafe,
    totalMines: session.totalMines,
    multiplier: roundedMultiplier,
    totalWin: payout,
    profit: variation,
    newPoints: user.points,
    message: "🎉 Incroyable ! Vous avez nettoyé toute la mine.",
    keyDropped: dropResult && dropResult.dropped,
    userKeys: dropResult && dropResult.userKeys
  });
});
return;
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        message: "Erreur serveur lors du paiement",
      });
    }
  }

  // Partie continue : on renvoie juste l’état mis à jour
  return res.json({
    success: true,
    bomb: false,
    gameOver: false,
    revealedCell: { row: r, col: c },
    safeRevealed: session.safeRevealed,
    totalSafe: session.totalSafe,
    totalMines: session.totalMines,
    multiplier: roundedMultiplier,
    potentialWin,
    message: "✅ Case sûre révélée, vous pouvez continuer ou encaisser.",
  });
});

// ========================================
// 💰 CASHOUT (ENCAISSER LES GAINS)
// ========================================

router.post("/cashout", requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId || !session.gameActive) {
    return res.status(400).json({
      success: false,
      message: "Session invalide ou partie déjà terminée",
    });
  }

  const multiplier = computeMultiplier(
    session.safeRevealed,
    session.totalMines,
  );
  const roundedMultiplier = Number(multiplier.toFixed(2));
  const payout = Math.round(session.betAmount * multiplier);
  const variation = payout - session.betAmount; // gain net par rapport à la mise initiale

  session.gameActive = false;
  activeSessions.delete(sessionId);

  try {
    const transaction = db.transaction(() => {
      // Update des points
      const updateStmt = db.prepare(
        "UPDATE compte SET points = points + ? WHERE id = ?",
      );
      const result = updateStmt.run(payout, userId);

      if (result.changes === 0) {
        throw new Error("Compte introuvable");
      }

      // Log
      const logStmt = db.prepare(
        "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)",
      );
      logStmt.run(
        userId,
        variation,
        `Mines - Cashout après ${session.safeRevealed} cases : ${
          variation >= 0 ? "+" : ""
        }${variation} pts`,
      );

      // Nouveau solde
      const getStmt = db.prepare("SELECT points FROM compte WHERE id = ?");
      return getStmt.get(userId);
    });

    const user = transaction();

    req.session.user.points = user.points;

    tryKeyDrop(db, userId, session.betAmount, 'mines', (errDrop, dropResult) => {
      if (errDrop) dropResult = { dropped: false, userKeys: null };
      return res.json({
        success: true,
        gameOver: true,
        won: variation >= 0,
        safeRevealed: session.safeRevealed,
        totalSafe: session.totalSafe,
        totalMines: session.totalMines,
        multiplier: roundedMultiplier,
        totalWin: payout,
        profit: variation,
        newPoints: user.points,
        mines: minesToArray(session.mines),
        message: session.safeRevealed > 0
          ? "💰 Vous avez encaissé vos gains à temps !"
          : "⛏️ Partie annulée, mise remboursée.",
        keyDropped: dropResult && dropResult.dropped,
        userKeys: dropResult && dropResult.userKeys
      });
    });
    return;
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors du cashout",
    });
  }
});

// ========================================
// 🚫 ABANDON (PERTE DE LA MISE)
// ========================================

router.post("/forfeit", requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId) {
    return res.status(400).json({
      success: false,
      message: "Session invalide",
    });
  }

  activeSessions.delete(sessionId);

  try {
    const insertLogStmt = db.prepare(
      "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)",
    );

    insertLogStmt.run(userId, 0, `Mines - Abandon : -${session.betAmount} pts`);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l’enregistrement de l’abandon",
    });
  }

  return res.json({
    success: true,
    message: "🙈 Vous avez abandonné la partie. La mise est perdue.",
  });
});

// Nettoyage automatique des sessions inactives (toutes les minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.startTime > 900000) {
      activeSessions.delete(sessionId);
    }
  }
}, 60000);

module.exports = router;

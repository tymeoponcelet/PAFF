const express = require('express');
const router = express.Router();
const db = require('../../config');
const { requireAuth, checkBalance } = require('../middleware/auth');
const checkTime = require('../middleware/checktime'); // ✅ IMPORTER
const { tryKeyDrop } = require('../key-drop');

// ✅ APPLIQUER LE MIDDLEWARE À TOUTES LES ROUTES
router.use(checkTime);

// Configuration du jeu
const ROWS = 6;
const COLS = 7;
const PLAYER = 'red';
const AI = 'yellow';

// Sessions de jeu actives en mémoire
const activeSessions = new Map();

// ========================================
// UTILITAIRES DE JEU
// ========================================

// Crée une grille vide de 6 lignes x 7 colonnes
function createBoard() {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
}

// Trouve la ligne la plus basse disponible dans une colonne
function getLowestEmptyRow(board, col) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === null) return row;
  }
  return -1;
}

// Place un jeton dans la grille
function dropToken(board, col, player) {
  const row = getLowestEmptyRow(board, col);
  if (row === -1) return null;

  board[row][col] = player;
  return { row, col };
}

// Vérifie si un joueur a gagné à partir d'une position donnée
function checkWinner(board, row, col, player) {
  return (
    checkDirection(board, row, col, player, 0, 1) ||  // Horizontal
    checkDirection(board, row, col, player, 1, 0) ||  // Vertical
    checkDirection(board, row, col, player, 1, 1) ||  // Diagonal /
    checkDirection(board, row, col, player, 1, -1)    // Diagonal \
  );
}

// Vérifie une direction spécifique pour 4 jetons alignés
function checkDirection(board, row, col, player, dRow, dCol) {
  let count = 1;

  // Direction positive
  let r = row + dRow;
  let c = col + dCol;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
    count++;
    r += dRow;
    c += dCol;
  }

  // Direction négative
  r = row - dRow;
  c = col - dCol;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
    count++;
    r -= dRow;
    c -= dCol;
  }

  return count >= 4;
}

// Vérifie si la grille est complètement remplie
function isBoardFull(board) {
  return board[0].every(cell => cell !== null);
}

// ========================================
// INTELLIGENCE ARTIFICIELLE AVANCEE
// ========================================

// Détermine le meilleur coup pour l'IA selon une hiérarchie de priorités
// Évalue la qualité d'une position pour l'IA (heuristique existante améliorée)
function evaluateBoard(board) {
  let score = 0;
  const centerCol = Math.floor(COLS / 2);

  // Bonus colonne centrale
  for (let r = 0; r < ROWS; r++) {
    if (board[r][centerCol] === AI) score += 4;
    if (board[r][centerCol] === PLAYER) score -= 4;
  }

  // Fenêtres horizontales
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const w = [board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]];
      score += scoreWindow(w);
    }
  }

  // Fenêtres verticales
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const w = [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]];
      score += scoreWindow(w);
    }
  }

  // Diagonales
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const w = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
      score += scoreWindow(w);
    }
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const w = [board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]];
      score += scoreWindow(w);
    }
  }

  return score;
}

// Score d'une fenêtre de 4 cellules
function scoreWindow(w) {
  const aiCount = w.filter(c => c === AI).length;
  const plCount = w.filter(c => c === PLAYER).length;
  const empty = w.filter(c => c === null).length;

  if (aiCount === 4) return 100;
  if (aiCount === 3 && empty === 1) return 6;
  if (aiCount === 2 && empty === 2) return 2;
  if (plCount === 3 && empty === 1) return -8;  // bloquer fort
  if (plCount === 2 && empty === 2) return -1;
  return 0;
}

function isWinningPosition(board, player) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === player && checkWinner(board, r, c, player)) return true;
    }
  }
  return false;
}

function minimaxLight(board, depth, alpha, beta, maximizing) {
  // Vérifie si la position actuelle est déjà gagnée/perdue
  if (isWinningPosition(board, AI)) return { col: null, score: 100000 + depth };
  if (isWinningPosition(board, PLAYER)) return { col: null, score: -100000 - depth };
  if (depth === 0 || isBoardFull(board)) return { col: null, score: evaluateBoard(board) };

  const colOrder = [3, 2, 4, 1, 5, 0, 6].filter(c => getLowestEmptyRow(board, c) !== -1);

  if (maximizing) {
    let best = { col: colOrder[0], score: -Infinity };
    for (const col of colOrder) {
      const row = getLowestEmptyRow(board, col);
      board[row][col] = AI;
      const result = minimaxLight(board, depth - 1, alpha, beta, false);
      board[row][col] = null;
      if (result.score > best.score) best = { col, score: result.score };
      alpha = Math.max(alpha, best.score);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = { col: colOrder[0], score: +Infinity };
    for (const col of colOrder) {
      const row = getLowestEmptyRow(board, col);
      board[row][col] = PLAYER;
      const result = minimaxLight(board, depth - 1, alpha, beta, true);
      board[row][col] = null;
      if (result.score < best.score) best = { col, score: result.score };
      beta = Math.min(beta, best.score);
      if (alpha >= beta) break;
    }
    return best;
  }
}

function getAIMove(board) {
  // Niveau 1 : gagner immédiatement (toujours)
  const winMove = findWinningMove(board, AI);
  if (winMove !== -1) return winMove;

  // Niveau 2 : bloquer victoire immédiate (toujours)
  const blockMove = findWinningMove(board, PLAYER);
  if (blockMove !== -1) return blockMove;

  // Niveau 3 : minimax profondeur 4 — voit 4 coups devant
  // Change 4 → 3 pour un bot plus facile, 5 pour plus fort
  return minimaxLight(board, 4, -Infinity, +Infinity, true).col;
}

// ========================================
// FONCTIONS D'ANALYSE AVANCEES
// ========================================

// Trouve un coup permettant de gagner immédiatement
function findWinningMove(board, player) {
  for (let col = 0; col < COLS; col++) {
    const row = getLowestEmptyRow(board, col);
    if (row === -1) continue;

    // Simule le coup
    board[row][col] = player;
    const isWin = checkWinner(board, row, col, player);
    board[row][col] = null;

    if (isWin) return col;
  }
  return -1;
}

// Évalue une position selon plusieurs critères stratégiques
function evaluatePosition(board, row, col, player) {
  let score = 0;

  // Bonus pour la proximité du centre (colonnes centrales sont stratégiques)
  const centerDistance = Math.abs(col - Math.floor(COLS / 2));
  score += (COLS - centerDistance) * 3;

  // Analyse des alignements possibles
  board[row][col] = player;

  const directions = [
    [0, 1],  // Horizontal
    [1, 0],  // Vertical
    [1, 1],  // Diagonal /
    [1, -1]  // Diagonal \
  ];

  for (const [dRow, dCol] of directions) {
    const count = countInDirection(board, row, col, player, dRow, dCol);

    // Bonus pour les débuts d'alignements
    if (count === 2) score += 5;
    if (count === 3) score += 20;

    // Pénalité si ce coup permet à l'adversaire de créer un alignement de 3
    const opponentCount = countInDirection(board, row, col, PLAYER, dRow, dCol);
    if (opponentCount === 3) score -= 15;
  }

  board[row][col] = null;

  return score;
}

// Compte les jetons alignés dans une direction donnée
function countInDirection(board, row, col, player, dRow, dCol) {
  let count = 1;

  // Compte dans le sens positif
  let r = row + dRow;
  let c = col + dCol;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
    count++;
    r += dRow;
    c += dCol;
  }

  // Compte dans le sens négatif
  r = row - dRow;
  c = col - dCol;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
    count++;
    r -= dRow;
    c -= dCol;
  }

  return count;
}

// ========================================
// ROUTES API
// ========================================

// Route : Démarrer une nouvelle partie
router.post('/start', requireAuth, (req, res) => {
  const { betAmount } = req.body;
  const userId = req.session.user.id;

  // Validation de la mise minimum
  // Dans router.post('/start'), remplace la validation existante par :
  if (!betAmount || betAmount < 50 || betAmount > 500) {
    return res.status(400).json({
      success: false,
      message: "Mise entre 50 et 500 points"
    });
  }

  try {
    // Vérifier les points de l'utilisateur
    const user = db.prepare(
      "SELECT points FROM compte WHERE id = ?"
    ).get(userId);

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "Erreur de connexion"
      });
    }

    if (user.points < betAmount) {
      return res.status(400).json({
        success: false,
        message: `Points insuffisants (vous avez ${user.points} pts)`
      });
    }

    const board = createBoard();
    const sessionId = `${userId}_${Date.now()}`;

    // Débiter la mise
    db.prepare(
      "UPDATE compte SET points = points - ? WHERE id = ?"
    ).run(betAmount, userId);

    // Logger la transaction
    db.prepare(
      "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
    ).run(userId, -betAmount, `Puissance 4 - Mise : ${betAmount} pts`);

    const newPoints = user.points - betAmount;
    req.session.user.points = newPoints;

    // Créer la session de jeu
    activeSessions.set(sessionId, {
      userId,
      betAmount,
      board,
      currentPlayer: PLAYER,
      gameActive: true,
      startTime: Date.now()
    });

    tryKeyDrop(db, userId, betAmount, 'puissance4', (errDrop, dropResult) => {
      if (errDrop) dropResult = { dropped: false, userKeys: null };

      return res.json({
        success: true,
        sessionId,
        board,
        currentPlayer: PLAYER,
        newPoints,
        keyDropped: dropResult && dropResult.dropped,
        userKeys: dropResult && dropResult.userKeys
      });
    });

  } catch (err) {
    console.error('❌ Erreur mise Puissance 4:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la mise"
    });
  }
});

// Route : Jouer un coup
router.post('/play', requireAuth, (req, res) => {
  const { sessionId, col } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  // Validation de la session
  if (!session || session.userId !== userId || !session.gameActive) {
    return res.status(400).json({
      success: false,
      message: "Session invalide"
    });
  }

  if (session.currentPlayer !== PLAYER) {
    return res.status(400).json({
      success: false,
      message: "Ce n'est pas votre tour"
    });
  }

  if (col < 0 || col >= COLS) {
    return res.status(400).json({
      success: false,
      message: "Colonne invalide"
    });
  }

  // Jouer le coup du joueur
  const playerMove = dropToken(session.board, col, PLAYER);
  if (!playerMove) {
    return res.status(400).json({
      success: false,
      message: "Colonne pleine"
    });
  }

  // Vérifier si le joueur a gagné
  // Vérifier si le joueur a gagné
  if (checkWinner(session.board, playerMove.row, playerMove.col, PLAYER)) {
    session.gameActive = false;
    const winnings = session.betAmount * 1.5;

    try {
      if (userId !== 64) {
        db.prepare(
          "UPDATE compte SET points = points + ? WHERE id = ?"
        ).run(winnings, userId);
      }

      db.prepare(
        "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
      ).run(userId, session.betAmount, `Puissance 4 - Victoire : +${session.betAmount} pts`);

      const user = db.prepare(
        "SELECT points FROM compte WHERE id = ?"
      ).get(userId);

      if (!user) {
        return res.status(500).json({
          success: false,
          message: "Erreur de récupération des points"
        });
      }

      req.session.user.points = user.points;
      activeSessions.delete(sessionId);

      return res.json({
        success: true,
        board: session.board,
        playerMove,
        result: 'win',
        message: 'Vous avez gagné !',
        newPoints: user.points
      });

    } catch (err) {
      console.error('❌ Erreur victoire Puissance 4:', err);
      return res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }
  }

  // Vérifier si la grille est pleine (match nul)
  if (isBoardFull(session.board)) {
    session.gameActive = false;
    const refund = session.betAmount;

    if (userId !== 64) {
      db.prepare("UPDATE compte SET points = points + ? WHERE id = ?").run(refund, userId);
    }

    db.prepare(
      "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
    ).run(userId, 0, `Puissance 4 - Match nul : remboursement ${refund} pts`);

    const user = db.prepare(
      "SELECT points FROM compte WHERE id = ?"
    ).get(userId);

    if (!user) {
      return res.status(500).json({ success: false, message: "Erreur" });
    }

    req.session.user.points = user.points;
    activeSessions.delete(sessionId);

    res.json({
      success: true,
      board: session.board,
      playerMove,
      result: 'draw',
      message: 'Match nul !',
      newPoints: user.points
    });
    return;
  }

  // Tour de l'IA
  session.currentPlayer = AI;

  setTimeout(() => {
    const aiCol = getAIMove(session.board);
    const aiMove = dropToken(session.board, aiCol, AI);

    if (!aiMove) {
      return res.status(500).json({
        success: false,
        message: "Erreur IA"
      });
    }

    // Vérifier si l'IA a gagné
    if (checkWinner(session.board, aiMove.row, aiMove.col, AI)) {
      session.gameActive = false;

      db.prepare(
        "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
      ).run(userId, 0, `Puissance 4 - Défaite : -${session.betAmount} pts`);


      activeSessions.delete(sessionId);

      return res.json({
        success: true,
        board: session.board,
        playerMove,
        aiMove,
        result: 'lose',
        message: 'Le robot a gagné...',
        newPoints: req.session.user.points
      });
    }

    // Vérifier match nul après coup de l'IA
    if (isBoardFull(session.board)) {
      session.gameActive = false;
      const refund = session.betAmount;

      db.prepare(
        "UPDATE compte SET points = points + ? WHERE id = ?"
      ).run(refund, userId);

      db.prepare(
        "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
      ).run(userId, 0, `Puissance 4 - Match nul : remboursement ${refund} pts`);

      const user = db.prepare(
        "SELECT points FROM compte WHERE id = ?"
      ).get(userId);

      if (!user) {
        return res.status(500).json({ success: false, message: "Erreur" });
      }

      req.session.user.points = user.points;
      activeSessions.delete(sessionId);

      res.json({
        success: true,
        board: session.board,
        playerMove,
        aiMove,
        result: 'draw',
        message: 'Match nul !',
        newPoints: user.points
      });
      return;
    }

    // Continuer la partie
    session.currentPlayer = PLAYER;

    res.json({
      success: true,
      board: session.board,
      playerMove,
      aiMove,
      currentPlayer: PLAYER
    });

  }, 300);
});

// Nettoyage automatique des sessions inactives (toutes les minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    // Supprimer les sessions de plus de 10 minutes
    if (now - session.startTime > 600000) {
      activeSessions.delete(sessionId);
    }
  }
}, 60000);

module.exports = router;

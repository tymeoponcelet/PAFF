// ========================================
// SCRATCH GAME — ROUTE SERVEUR CORRIGÉE
// routes/actions/scratch.js
// ========================================

const express = require('express');
const router = express.Router();
const db = require('../../config');
const { requireAuth } = require('../middleware/auth');
const checkTime = require('../middleware/checktime');

router.use(checkTime);

// ----------------------------------------
// RÉCOMPENSES FLAT (points fixes, pas de multiplicateur)
// Doit être identique à SCRATCH_SYMBOLS côté client
// ----------------------------------------

const SYMBOL_CONFIG = {
  diamond: { gain: 500, weight: 1  },
  gold:    { gain: 200, weight: 3  },
  silver:  { gain: 100, weight: 6  },
  bronze:  { gain: 50,  weight: 10 },
  star:    { gain: 25,  weight: 15 },
  lose:    { gain: 0,   weight: 65 },
};

const SYMBOLS = Object.keys(SYMBOL_CONFIG);
const TOTAL_WEIGHT = Object.values(SYMBOL_CONFIG).reduce((s, c) => s + c.weight, 0);

const scratchSessions = new Map();

// ----------------------------------------
// UTILITAIRES
// ----------------------------------------

function pickSymbol() {
  let rand = Math.random() * TOTAL_WEIGHT;
  for (const [sym, cfg] of Object.entries(SYMBOL_CONFIG)) {
    rand -= cfg.weight;
    if (rand <= 0) return sym;
  }
  return 'lose';
}

function generateGrid() {
  const WIN_CHANCE = 0.25;
  const hasWin = Math.random() < WIN_CHANCE;

  if (hasWin) {
    const winnableSymbols = SYMBOLS.filter(s => s !== 'lose');
    const winWeights = winnableSymbols.map(s => SYMBOL_CONFIG[s].weight);
    const totalW = winWeights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let winSym = winnableSymbols[winnableSymbols.length - 1];
    for (let i = 0; i < winnableSymbols.length; i++) {
      r -= winWeights[i];
      if (r <= 0) { winSym = winnableSymbols[i]; break; }
    }

    const positions = [0,1,2,3,4,5,6,7,8];
    shuffleArray(positions);
    const winPositions = new Set(positions.slice(0, 3));

    return Array.from({ length: 9 }, (_, i) => {
      if (winPositions.has(i)) return winSym;
      let sym, attempts = 0;
      do { sym = pickSymbol(); attempts++; } while (sym === winSym && attempts < 10);
      return sym === winSym ? 'lose' : sym;
    });
  }

  let grid, safetyBreak = 0;
  do {
    grid = Array.from({ length: 9 }, () => pickSymbol());
    safetyBreak++;
    if (safetyBreak > 50) break;
  } while (hasTriple(grid));

  return grid;
}

function hasTriple(grid) {
  const counts = {};
  for (const sym of grid) {
    counts[sym] = (counts[sym] || 0) + 1;
    if (sym !== 'lose' && counts[sym] >= 3) return true;
  }
  return false;
}

function findWinningSymbol(grid) {
  const counts = {};
  for (const sym of grid) {
    if (sym === 'lose') continue;
    counts[sym] = (counts[sym] || 0) + 1;
  }
  for (const [sym, count] of Object.entries(counts)) {
    if (count >= 3) return sym;
  }
  return null;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ----------------------------------------
// ROUTE : Acheter un ticket
// POST /actions/scratch/buy
// ----------------------------------------

router.post('/buy', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  const user = db.prepare('SELECT points FROM compte WHERE id = ?').get(userId);
  if (!user) return res.status(500).json({ success: false, message: 'Erreur serveur' });

  // Bloquer si >= 500 pts
  if (user.points >= 500) {
    return res.status(403).json({
      success: false,
      message: 'Le Scratch est réservé aux joueurs avec moins de 500 points.'
    });
  }

  try {
    db.prepare('INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)')
      .run(userId, 0, 'Scratch - Ticket gratuit (solde < 500 pts)');

    req.session.user.points = user.points;

    const grid = generateGrid();
    const sessionId = `scratch_${userId}_${Date.now()}`;

    scratchSessions.set(sessionId, {
      userId,
      grid,
      resolved: false,
      startTime: Date.now()
    });

    return res.json({
      success: true,
      sessionId,
      grid,
      newPoints: user.points,
      isFree: true
    });

  } catch (err) {
    console.error('❌ Scratch /buy:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ----------------------------------------
// ROUTE : Résoudre le ticket
// POST /actions/scratch/resolve
// ----------------------------------------

router.post('/resolve', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = scratchSessions.get(sessionId);

  if (!session || session.userId !== userId) {
    return res.status(400).json({ success: false, message: 'Session invalide' });
  }

  if (session.resolved) {
    return res.status(400).json({ success: false, message: 'Ticket déjà résolu' });
  }

  session.resolved = true;
  scratchSessions.delete(sessionId);

  try {
    const winningSymbol = findWinningSymbol(session.grid);
    const won = winningSymbol !== null;
    let gain = 0;

    if (won) {
      // Gain flat : points fixes définis dans SYMBOL_CONFIG
      gain = SYMBOL_CONFIG[winningSymbol].gain;

      db.prepare('UPDATE compte SET points = points + ? WHERE id = ?').run(gain, userId);
      db.prepare('INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)')
        .run(userId, gain, `Scratch - Victoire (${winningSymbol}) : +${gain} pts`);
    } else {
      db.prepare('INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)')
        .run(userId, 0, 'Scratch - Pas de chance');
    }

    const finalUser = db.prepare('SELECT points FROM compte WHERE id = ?').get(userId);
    req.session.user.points = finalUser.points;

    return res.json({
      success: true,
      won,
      winningSymbol: won ? winningSymbol : null,
      gain,
      newPoints: finalUser.points
    });

  } catch (err) {
    console.error('❌ Scratch /resolve:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ----------------------------------------
// Nettoyage automatique (sessions > 10 min)
// ----------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of scratchSessions.entries()) {
    if (now - session.startTime > 600_000) scratchSessions.delete(id);
  }
}, 60_000);

module.exports = router;
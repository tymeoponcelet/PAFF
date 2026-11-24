// ========================================
// CRASH GAME - BACKEND (crash.js)
// ========================================

const express = require('express');
const router = express.Router();
const db = require('../../config');
const { requireAuth, checkBalance } = require('../middleware/auth');
const checkTime = require('../middleware/checktime');
const { tryKeyDrop } = require('../key-drop');

// ✅ APPLIQUER LE MIDDLEWARE À TOUTES LES ROUTES
router.use(checkTime);

// ========================================
// LOGIQUE DE JEU
// ========================================

/**
 * Génère un point de crash aléatoire entre 1.00x et 50.00x
 * Utilise une distribution exponentielle pour favoriser les crashs bas
 */
function generateCrashPoint() {
  const e = Math.random();

  // 4% house edge — crash instantané
  if (Math.random() < 0.08) return 1.00;

  // Formule correcte
  const crashPoint = (1 - 0.08) / (1 - e);

  return Math.max(1.00, parseFloat(Math.min(crashPoint, 1000).toFixed(2)));
}

/**
 * Calcule le multiplicateur actuel basé sur le temps écoulé
 */
function calculateMultiplier(startTime) {
  const elapsed = Math.max(0, (Date.now() - startTime) / 1000);
  return parseFloat(Math.max(1.0, 1 + elapsed * elapsed * 0.02).toFixed(2));
}

// ========================================
// SESSIONS DE JEU ACTIVES
// ========================================

const activeSessions = new Map();

const crashHistory = new Map(); // userId => [{...}, ...]
const HISTORY_MAX = 20;

function addToHistory(userId, entry) {
  if (!crashHistory.has(userId)) crashHistory.set(userId, []);
  const history = crashHistory.get(userId);
  history.unshift(entry); // plus récent en premier
  if (history.length > HISTORY_MAX) history.pop();
}

// ========================================
// ROUTE : DÉMARRER UNE PARTIE
// ========================================

router.post('/start', requireAuth, checkBalance, (req, res) => {
  const { betAmount, minBet = 10 } = req.body;
  const userId = req.session.user.id;

  // Vérification de la mise minimale
  if (betAmount < minBet) {
    return res.status(400).json({
      success: false,
      message: `Mise minimale : ${minBet} points`
    });
  }

  if (isNaN(betAmount) || betAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Mise invalide'
    });
  }

  // Vérifier qu'il n'y a pas déjà une session active
  const existingSession = Array.from(activeSessions.values())
    .find(s => s.userId === userId && s.gameActive);

  if (existingSession) {
    return res.status(400).json({
      success: false,
      message: 'Une partie est déjà en cours'
    });
  }

  try {
    // Déduire la mise
    db.prepare(
      "UPDATE compte SET points = points - ? WHERE id = ?"
    ).run(betAmount, userId);

    // Logger la mise
    db.prepare(
      "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
    ).run(userId, -betAmount, `Crash - Mise : ${betAmount} pts`);


    const user = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
    if (!user) return res.status(500).json({ success: false, message: "Erreur" });

    req.session.user.points = user.points;

    const sessionId = `crash_${userId}_${Date.now()}`;
    const crashPoint = generateCrashPoint();
    const startTime = Date.now();

    activeSessions.set(sessionId, {
      userId, betAmount, crashPoint,
      startTime,
      gameActive: true, cashedOut: false, cashOutMultiplier: null
    });

    return res.json({
      success: true,
      sessionId,
      startTime,
      requestSentTime: req.body.requestSentTime,
      newPoints: user.points
    });

  } catch (err) {
    console.error('❌ Erreur mise Crash:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la mise"
    });
  }
});

// ========================================
// ROUTE : RÉCUPÉRER L'ÉTAT DU JEU
// ========================================

router.post('/status', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  // Vérification de la session
  if (!session || session.userId !== userId) {
    return res.status(400).json({
      success: false,
      message: "Session invalide"
    });
  }

  const currentMultiplier = calculateMultiplier(session.startTime);
  const hasCrashed = currentMultiplier >= session.crashPoint;

  // Si le jeu a crashé et qu'on n'a pas encore traité la fin
  if (hasCrashed && session.gameActive) {
    session.gameActive = false;

    // Si le joueur n'a pas retiré, c'est une défaite
    if (!session.cashedOut) {
      try {
        db.prepare(
          "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
        ).run(userId, 0, `Crash - Défaite à ${session.crashPoint}x : -${session.betAmount} pts`);

      } catch (err) {
        console.error('❌ Erreur log défaite Crash:', err);
      }

      // historique
      addToHistory(userId, {
        result: 'lose',
        crash_point: session.crashPoint,
        cashed_out: false,
        cash_out_multiplier: null,
        bet_amount: session.betAmount,
        created_at: new Date().toISOString()
      });

      tryKeyDrop(db, userId, session.betAmount, 'crash', (errDrop, dropResult) => {
        if (errDrop) dropResult = { dropped: false, userKeys: null };

        return res.json({
          success: true,
          crashed: true,
          crashPoint: session.crashPoint,
          currentMultiplier: session.crashPoint,
          cashedOut: false,
          result: 'lose',
          message: `💥 Crash à ${session.crashPoint}x !`,
          newPoints: req.session.user.points,
          keyDropped: dropResult && dropResult.dropped,
          userKeys: dropResult && dropResult.userKeys
        });
      });
      return;
    }
  }

  res.json({
    success: true,
    crashed: hasCrashed,
    crashPoint: hasCrashed ? session.crashPoint : null,
    currentMultiplier: hasCrashed ? session.crashPoint : currentMultiplier,
    cashedOut: session.cashedOut,
    cashOutMultiplier: session.cashOutMultiplier
  });
});

// ========================================
// ROUTE : RETIRER (CASH OUT)
// ========================================

router.post('/cashout', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  // Vérification de la session
  if (!session || session.userId !== userId || !session.gameActive) {
    return res.status(400).json({
      success: false,
      message: "Session invalide ou partie terminée"
    });
  }

  // Vérifier si déjà retiré
  if (session.cashedOut) {
    return res.status(400).json({
      success: false,
      message: "Vous avez déjà retiré"
    });
  }
  const currentMultiplier = calculateMultiplier(session.startTime);

  // Vérifier si le jeu a déjà crashé
  if (currentMultiplier >= session.crashPoint) {
    session.gameActive = false;

    db.prepare(
      "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
    ).run(userId, 0, `Crash - Défaite à ${session.crashPoint}x : -${session.betAmount} pts`);

    // ✅ ICI — dans le callback
    addToHistory(userId, {
      result: 'lose',
      crash_point: session.crashPoint,
      cashed_out: false,
      cash_out_multiplier: null,
      bet_amount: session.betAmount,
      created_at: new Date().toISOString()
    });

    tryKeyDrop(db, userId, session.betAmount, 'crash', (errDrop, dropResult) => {
      if (errDrop) dropResult = { dropped: false, userKeys: null };

      return res.json({
        success: false,
        crashed: true,
        crashPoint: session.crashPoint,
        message: `💥 Trop tard ! Crash à ${session.crashPoint}x`,
        result: 'lose',
        newPoints: req.session.user.points,
        keyDropped: dropResult && dropResult.dropped,
        userKeys: dropResult && dropResult.userKeys
      });
    });
    return;
  }

  // Retrait réussi
  session.cashedOut = true;
  session.cashOutMultiplier = currentMultiplier;
  session.gameActive = false;

  const winnings = Math.floor(session.betAmount * currentMultiplier);
  const profit = winnings - session.betAmount;

  // Créditer les gains
  try {
    db.prepare(
      "UPDATE compte SET points = points + ? WHERE id = ?"
    ).run(winnings, userId);

    db.prepare(
      "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
    ).run(userId, profit, `Crash - Victoire à ${currentMultiplier}x : +${profit} pts`);

    const user = db.prepare(
      "SELECT points FROM compte WHERE id = ?"
    ).get(userId);

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "Erreur de récupération"
      });
    }


    tryKeyDrop(db, userId, session.betAmount, 'crash', (errDrop, dropResult) => {
      if (errDrop) dropResult = { dropped: false, userKeys: null };

      const user = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
      req.session.user.points = user.points;

      // ✅ ICI — dans le callback
      addToHistory(userId, {
        result: 'win',
        crash_point: session.crashPoint,
        cashed_out: true,
        cash_out_multiplier: currentMultiplier,
        bet_amount: session.betAmount,
        created_at: new Date().toISOString()
      });

      return res.json({
        success: true,
        cashedOut: true,
        multiplier: currentMultiplier,
        crashPoint: session.crashPoint,
        winnings,
        profit,
        result: 'win',
        message: `🎉 Retiré à ${currentMultiplier}x ! +${profit} pts`,
        newPoints: user.points,
        keyDropped: dropResult && dropResult.dropped,
        userKeys: dropResult && dropResult.userKeys
      });
    });
    return;

  } catch (err) {
    console.error('❌ Erreur cashout Crash:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
});

// ========================================
// ROUTE : ABANDONNER LA PARTIE
// ========================================

router.post('/cancel', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId) {
    return res.status(400).json({
      success: false,
      message: "Session invalide"
    });
  }

  activeSessions.delete(sessionId);

  res.json({
    success: true,
    message: "Partie annulée"
  });
});


// ========================================
// ROUTE : RÉCUPÉRER LE SOLDE
// ========================================

router.get('/balance', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  try {
    const user = db.prepare(
      "SELECT points FROM compte WHERE id = ?"
    ).get(userId);

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "Erreur de récupération"
      });
    }

    req.session.user.points = user.points;

    return res.json({
      success: true,
      points: user.points
    });

  } catch (err) {
    console.error('❌ Erreur récupération points:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur de récupération"
    });
  }
});

router.get('/history', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const history = crashHistory.get(userId) || [];
  return res.json({ success: true, history });
});

// ========================================
// NETTOYAGE AUTOMATIQUE DES SESSIONS
// ========================================

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    // ← ignorer les sessions sans startTime (pendant countdown)
    if (!session.startTime) continue;
    const sessionAge = now - session.startTime;
    if (sessionAge > 120000) {
      activeSessions.delete(sessionId);
    }
  }
}, 30000);// Toutes les 30 secondes

module.exports = router;


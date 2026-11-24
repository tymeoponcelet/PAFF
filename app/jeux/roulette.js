const express = require("express");
const router = express.Router();
const db = require("../../config");
const { requireAuth } = require("../middleware/auth");
const checkTime = require("../middleware/checktime");
const { tryKeyDrop } = require('../key-drop');
router.use(checkTime);

// ========================================
// ⚙️ CONFIGURATION ROULETTE
// ========================================

const MIN_BET = 10;
const MAX_BET = 500000;

// Numéros rouges de la roulette européenne
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

// Retourne la couleur d'un numéro
function getColor(num) {
  if (num === 0) return 'green';
  return RED_NUMBERS.has(num) ? 'red' : 'black';
}

// Vérifie si une mise est gagnante et retourne le multiplicateur
// Types de mises :
//   { type: 'color', value: 'red'|'black' }         -> x2
//   { type: 'parity', value: 'even'|'odd' }         -> x2
//   { type: 'straight', value: 0-36 }               -> x36
//   { type: 'dozen', value: 1|2|3 }                 -> x3
function evaluateBet(bet, result) {
  switch (bet.type) {
    case 'color':
      if (result === 0) return 0;
      if (getColor(result) === bet.value) return 2;
      return 0;

    case 'parity':
      if (result === 0) return 0;
      if (bet.value === 'even' && result % 2 === 0) return 2;
      if (bet.value === 'odd'  && result % 2 === 1) return 2;
      return 0;

    case 'straight':
      if (parseInt(bet.value, 10) === result) return 36;
      return 0;

    case 'dozen':
      if (result === 0) return 0;
      const dozen = Math.ceil(result / 12);
      if (dozen === parseInt(bet.value, 10)) return 3;
      return 0;

    default:
      return 0;
  }
}

// Valide une liste de mises envoyées par le client
function validateBets(bets) {
  if (!Array.isArray(bets) || bets.length === 0) return false;
  if (bets.length > 20) return false; // limite anti-spam

  for (const bet of bets) {
    if (!bet || typeof bet.amount !== 'number' || bet.amount < MIN_BET || bet.amount > MAX_BET) return false;
    if (!Number.isInteger(bet.amount)) return false;

    switch (bet.type) {
      case 'color':
        if (!['red', 'black'].includes(bet.value)) return false;
        break;
      case 'parity':
        if (!['even', 'odd'].includes(bet.value)) return false;
        break;
      case 'straight': {
        const n = parseInt(bet.value, 10);
        if (isNaN(n) || n < 0 || n > 36) return false;
        break;
      }
      case 'dozen': {
        const d = parseInt(bet.value, 10);
        if (![1, 2, 3].includes(d)) return false;
        break;
      }
      default:
        return false;
    }
  }
  return true;
}

// ========================================
// 🎰 JOUER À LA ROULETTE
// ========================================

router.post("/spin", requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const userPoints = req.session.user.points;
  const { bets } = req.body;

  // Validation des mises
  if (!validateBets(bets)) {
    return res.status(400).json({ success: false, message: "Mises invalides." });
  }

  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);

  if (totalBet > userPoints) {
    return res.status(400).json({ success: false, message: `Points insuffisants. Mise totale : ${totalBet} pts` });
  }

  if (totalBet < MIN_BET) {
    return res.status(400).json({ success: false, message: `Mise minimale : ${MIN_BET} pts` });
  }

  if (totalBet > MAX_BET * bets.length) {
    return res.status(400).json({ success: false, message: "Mise trop élevée." });
  }

  // Tirage aléatoire
  const result = Math.floor(Math.random() * 37); // 0 à 36

  // Calcul des gains par mise
  let totalPayout = 0;
  const betResults = bets.map(bet => {
    const multiplier = evaluateBet(bet, result);
    const payout = bet.amount * multiplier;
    totalPayout += payout;
    return {
      ...bet,
      multiplier,
      payout,
      won: multiplier > 0,
    };
  });

  const netVariation = totalPayout - totalBet;

  try {
    const transaction = db.transaction(() => {
      // Déduire la mise
      const deductStmt = db.prepare("UPDATE compte SET points = points - ? WHERE id = ?");
      const deductResult = deductStmt.run(totalBet, userId);
      if (deductResult.changes === 0) throw new Error("Compte introuvable");

      // Ajouter les gains si présents
      if (totalPayout > 0) {
        const addStmt = db.prepare("UPDATE compte SET points = points + ? WHERE id = ?");
        addStmt.run(totalPayout, userId);
      }

      // Logger la transaction
      const logStmt = db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)");
      logStmt.run(
        userId,
        netVariation,
        `Roulette - Numéro ${result} (${getColor(result)}) : ${netVariation >= 0 ? '+' : ''}${netVariation} pts`
      );

      // Nouveau solde
      const getStmt = db.prepare("SELECT points FROM compte WHERE id = ?");
      return getStmt.get(userId);
    });

    const user = transaction();
    req.session.user.points = user.points;

    tryKeyDrop(db, userId, totalBet, 'roulette', (errDrop, dropResult) => {
      if (errDrop) dropResult = { dropped: false, userKeys: null };
      return res.json({
        success: true,
        result,
        color: getColor(result),
        totalBet,
        totalPayout,
        netVariation,
        won: netVariation > 0,
        betResults,
        newPoints: user.points,
        keyDropped: dropResult && dropResult.dropped,
        userKeys: dropResult && dropResult.userKeys,
      });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

module.exports = router;
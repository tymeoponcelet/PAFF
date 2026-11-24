const express = require('express');
const router = express.Router();
const db = require('../../config');
const { requireAuth, checkBalance } = require('../middleware/auth');
const checkTime = require('../middleware/checktime'); // ✅ IMPORTER
const crypto = require('crypto');
const { tryKeyDrop } = require('../key-drop');
const duels = require('../services/duel');

// ✅ APPLIQUER LE MIDDLEWARE À TOUTES LES ROUTES
router.use(checkTime);

// Sessions de jeu actives
const activeSessions = new Map();

// Renvoie la session de jeu seulement si elle appartient au joueur connecté
function sessionDuJoueur(req) {
  const session = activeSessions.get(req.body.sessionId);
  if (!session || session.userId !== req.session.user.id) return null;
  return session;
}

// Pas de mise en duel : on ne vérifie le solde que pour une partie normale
function verifierMiseSiBesoin(req, res, next) {
  if (req.body && req.body.duelId) return next();
  return checkBalance(req, res, next);
}

// Configuration du jeu
const GAME_CONFIG = {
  DURATION: 30,
  MIN_BET: 50,
  MOLE_TYPES: {
    normal: { points: 10, probability: 0.55 },
    golden: { points: 45, probability: 0.20 },
    bomb: { points: -100, probability: 0.15 },
    speed: { points: 35, probability: 0.10 }
  }
};

// Générer un type de taupe aléatoire AVEC VITESSE
function getRandomMoleType() {
  const random = Math.random();
  let cumulative = 0;

  for (const [type, properties] of Object.entries(GAME_CONFIG.MOLE_TYPES)) {
    cumulative += properties.probability;
    if (random <= cumulative) {
      // ✅ Déterminer la vitesse selon le type
      let speed;

      if (type === 'bomb') {
        speed = 'slow'; // 🐢 Bombes lentes (2s)
      } else if (type === 'golden') {
        speed = 'fast'; // 🚀 Dorées rapides (0.7s)
      } else if (type === 'speed') {
        speed = 'fast'; // 🚀 Speed rapides (0.7s)
      } else {
        // Normales : mélange de vitesses
        const speedRandom = Math.random();
        if (speedRandom < 0.4) {
          speed = 'normal'; // 40% normales
        } else if (speedRandom < 0.7) {
          speed = 'fast'; // 30% rapides
        } else {
          speed = 'slow'; // 30% lentes
        }
      }

      return {
        type,
        points: properties.points,
        speed // ✅ NOUVEAU
      };
    }
  }

  return { type: 'normal', points: 10, speed: 'normal' };
}


// ========================================
// NETTOYAGE AUTO DES TAUPES
// ========================================

function cleanExpiredMoles() {
  const now = Date.now();
  let totalCleaned = 0;

  activeSessions.forEach((session, sessionId) => {
    let cleaned = 0;

    session.activeMoles.forEach((mole, holeIndex) => {
      const age = now - mole.timestamp;

      // Supprimer si > 2 secondes
      if (age > 2000) {
        session.activeMoles.delete(holeIndex);
        cleaned++;
        totalCleaned++;
      }
    });

    if (cleaned > 0) {
      //console(`🧹 [TAPE-TAUPE] Session ${sessionId.substring(0, 8)}...: ${cleaned} taupes nettoyées`);
    }
  });

  if (totalCleaned > 0) {
    //console(`🧹 Total: ${totalCleaned} taupes expirées supprimées`);
  }
}

// Lancer le nettoyage toutes les secondes
setInterval(cleanExpiredMoles, 1000);

// ========================================
// ROUTE : DÉMARRER UNE PARTIE
// ========================================


router.post('/start', requireAuth, verifierMiseSiBesoin, (req, res) => {
  const { betAmount } = req.body;
  const userId = req.session.user.id;

  // Partie de duel : pas de mise, une seule partie par joueur et par duel
  const duelId = parseInt(req.body.duelId, 10) || null;
  if (duelId) {
    const manche = duels.commencerManche(duelId, userId, 'tapetaupe');
    if (!manche.ok) {
      return res.status(400).json({ success: false, message: manche.message });
    }

    const sessionId = crypto.randomUUID();
    activeSessions.set(sessionId, {
      userId, betAmount: 0, duelId, score: 0, combo: 0,
      startTime: Date.now(), activeMoles: new Map(), lastHit: Date.now()
    });

    return res.json({ success: true, sessionId, betAmount: 0, duelId, duration: GAME_CONFIG.DURATION });
  }

  // Validation de la mise
  if (!betAmount || betAmount < GAME_CONFIG.MIN_BET) {
    return res.status(400).json({
      success: false,
      message: `Mise minimale : ${GAME_CONFIG.MIN_BET} points`
    });
  }

  // Vérifier le solde
  const user = db.prepare(
    "SELECT points FROM compte WHERE id = ?"
  ).get(userId);

  if (!user) {
    return res.status(500).json({
      success: false,
      message: "Erreur de récupération du compte"
    });
  }

  if (user.points < betAmount) {
    return res.status(400).json({
      success: false,
      message: "Solde insuffisant"
    });
  }

  // Déduire la mise
  db.prepare(
    "UPDATE compte SET points = points - ? WHERE id = ?"
  ).run(betAmount, userId);

    const sessionId = crypto.randomUUID();
    const session = {
      userId, betAmount, score: 0, combo: 0,
      startTime: Date.now(), activeMoles: new Map(), lastHit: Date.now()
    };

    activeSessions.set(sessionId, session);

    const updatedUser = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);

    return res.json({
      success: true,
      sessionId,
      betAmount,
      duration: GAME_CONFIG.DURATION,
      newPoints: updatedUser ? updatedUser.points : user.points - betAmount
    });

});

// ========================================
// ROUTE : SPAWNER UNE TAUPE
// ========================================

router.post('/spawn', requireAuth, (req, res) => {
  const { sessionId, holeIndex } = req.body;
  const session = sessionDuJoueur(req);

  if (!session) {
    return res.status(400).json({
      success: false,
      message: "Session invalide"
    });
  }

  const elapsed = (Date.now() - session.startTime) / 1000;
  if (elapsed >= GAME_CONFIG.DURATION) {
    return res.status(400).json({
      success: false,
      message: "Temps écoulé"
    });
  }

  // Nettoyer les vieilles taupes
  const now = Date.now();
  session.activeMoles.forEach((mole, index) => {
    if (now - mole.timestamp > 2000) {
      session.activeMoles.delete(index);
    }
  });

  if (session.activeMoles.has(holeIndex)) {
    return res.status(400).json({
      success: false,
      message: "Trou occupé"
    });
  }

  // Générer une taupe
  const mole = getRandomMoleType();
  session.activeMoles.set(holeIndex, {
    ...mole,
    timestamp: Date.now()
  });

  res.json({
    success: true,
    holeIndex,
    moleType: mole.type,
    points: mole.points,
    speed: mole.speed //
  });
});



// ========================================
// ROUTE : FRAPPER UNE TAUPE
// ========================================

router.post('/hit', requireAuth, (req, res) => {
  const { sessionId, holeIndex } = req.body;
  const session = sessionDuJoueur(req);

  if (!session) {
    return res.status(400).json({
      success: false,
      message: "Session invalide"
    });
  }

  // Vérifier que la taupe existe
  const mole = session.activeMoles.get(holeIndex);
  if (!mole) {
    return res.status(400).json({
      success: false,
      message: "Aucune taupe à cet emplacement"
    });
  }

  // Anti-triche : vérifier le délai entre les clics (minimum 100ms)
  const timeSinceLastHit = Date.now() - session.lastHit;
  if (timeSinceLastHit < 100) {
    return res.status(400).json({
      success: false,
      message: "Clics trop rapides détectés"
    });
  }

  session.lastHit = Date.now();

  // Vérifier que la taupe n'est pas trop vieille (max 2 secondes)
  const moleAge = Date.now() - mole.timestamp;
  if (moleAge > 2000) {
    session.activeMoles.delete(holeIndex);
    return res.status(400).json({
      success: false,
      message: "Taupe expirée"
    });
  }

  // Calculer les points avec combo
  let earnedPoints = mole.points;

  if (mole.points > 0) {
    session.combo++;
    const comboMultiplier = 1 + (session.combo - 1) * 0.08;
    earnedPoints = Math.floor(mole.points * comboMultiplier);
  } else {
    session.combo = 0;
  }

  session.score += earnedPoints;
  session.activeMoles.delete(holeIndex);

  res.json({
    success: true,
    earnedPoints,
    totalScore: session.score,
    combo: session.combo
  });
});

// ========================================
// ROUTE : TAUPE RATÉE (RESET COMBO)
// ========================================

router.post('/miss', requireAuth, (req, res) => {
  const { sessionId, holeIndex } = req.body;
  const session = sessionDuJoueur(req);

  if (!session) {
    return res.status(400).json({
      success: false,
      message: "Session invalide"
    });
  }

  // ✅ Réinitialiser le combo
  const previousCombo = session.combo;
  session.combo = 0;

  // Si holeIndex >= 0, c'est une taupe qui a expiré
  // Si holeIndex === -1, c'est un clic sur case vide
  const reason = holeIndex === -1 ? 'clic vide' : 'taupe expirée';

  //console(`💔 [TAPE-TAUPE] Combo perdu (${reason}): ${previousCombo} → 0 | Session: ${sessionId.substring(0, 8)}...`);

  // Supprimer la taupe si elle existe encore
  if (holeIndex >= 0 && session.activeMoles.has(holeIndex)) {
    session.activeMoles.delete(holeIndex);
  }

  res.json({
    success: true,
    combo: 0,
    reason
  });
});


// ========================================
// ROUTE : TERMINER LA PARTIE
// ========================================

router.post('/end', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const session = sessionDuJoueur(req);

  if (!session) {
    return res.status(400).json({ success: false, message: "Session invalide" });
  }

  const userId = session.userId;
  activeSessions.delete(sessionId);

  // Historique (classement par jeu)
  duels.enregistrerPartie(userId, 'tapetaupe', session.score, session.duelId || null);

  // Partie de duel : pas de mise, on enregistre seulement le score
  if (session.duelId) {
    const duel = duels.enregistrerScore(session.duelId, userId, session.score);
    const user = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
    return res.json({
      success: true,
      finalScore: session.score,
      betAmount: 0,
      totalReturn: 0,
      result: 0,
      newPoints: user ? user.points : null,
      keyDropped: false,
      userKeys: null,
      duel
    });
  }

  const scoreRatio = session.score / 618;
  const multiplier = Math.max(0, scoreRatio);
  const totalReturn = Math.floor(session.betAmount * multiplier);
  const result = totalReturn - session.betAmount;

  db.prepare("UPDATE compte SET points = points + ? WHERE id = ?").run(totalReturn, userId);

  const user = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);


  tryKeyDrop(db, userId, session.betAmount, 'tape-taupe', (errDrop, dropResult) => {
    if (errDrop) dropResult = { dropped: false, userKeys: null };

    return res.json({
      success: true,
      finalScore: session.score,
      betAmount: session.betAmount,
      totalReturn,
      result,
      newPoints: user ? user.points : null,
      keyDropped: dropResult && dropResult.dropped,   
      userKeys: dropResult && dropResult.userKeys       
    });
  });
});

// ========================================
// NETTOYAGE DES SESSIONS EXPIRÉES
// ========================================

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    const elapsed = (now - session.startTime) / 1000;
    if (elapsed > GAME_CONFIG.DURATION + 10) {
      activeSessions.delete(sessionId);
      //console(`[WHACK-A-MOLE] Session expirée: ${sessionId}`);
    }
  }
}, 60000); // Toutes les minutes

module.exports = router;

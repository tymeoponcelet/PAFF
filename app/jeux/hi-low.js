const express = require('express');
const router = express.Router();
const db = require('../../config');
const { requireAuth, checkBalance } = require('../middleware/auth');
const { tryKeyDrop } = require('../key-drop');
const checkTime = require('../middleware/checktime');

router.use(checkTime);

// ========================================
// LOGIQUE DE JEU
// ========================================

const suits = ['♠', '♥', '♦', '♣'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Valeur numérique d'une carte (2 = plus faible, As = plus forte)
function cardNumericValue(card) {
  return values.indexOf(card.value); // 0 à 12
}

function createDeck() {
  const deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ suit, value });
    }
  }
  // Shuffle Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Sessions actives en mémoire
const activeSessions = new Map();

// Nettoyage automatique des sessions inactives (toutes les minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.startTime > 600000) {
      activeSessions.delete(sessionId);
    }
  }
}, 60000);

// ========================================
// ROUTE : Démarrer / Tirer la première carte
// ========================================
router.post('/start', requireAuth, checkBalance, (req, res) => {
  const { betAmount } = req.body;
  const userId = req.session.user.id;

  if (!betAmount || isNaN(betAmount) || betAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Mise invalide' });
  }

  const deck = createDeck();
  const currentCard = deck.pop();
  const sessionId = `hilow_${userId}_${Date.now()}`;

  try {
    // Déduire la mise
    db.prepare("UPDATE compte SET points = points - ? WHERE id = ?").run(betAmount, userId);
    db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
      .run(userId, -betAmount, `Hi-Low - Mise : ${betAmount} pts`);

    // Tenter un drop de clé
    tryKeyDrop(db, userId, betAmount, 'hilow', (errDrop, dropResult) => {
      if (errDrop) dropResult = { dropped: false, userKeys: null };

      const user = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
      if (!user) return res.status(500).json({ success: false, message: 'Erreur serveur' });

      req.session.user.points = user.points;

      activeSessions.set(sessionId, {
        userId,
        betAmount,
        deck,
        currentCard,
        gameActive: true,
        streak: 0,
        cumulativeMultiplier: 1.0,
        startTime: Date.now()
      });

      // Calculer les 3 multiplicateurs possibles pour la prochaine carte
      const nextMultipliers = {
        higher: getMultiplier('higher', currentCard, deck),
        lower: getMultiplier('lower', currentCard, deck),
        equal: getMultiplier('equal', currentCard, deck)
      };

      return res.json({
        success: true,
        sessionId,
        currentCard,
        cardValue: cardNumericValue(currentCard),
        newPoints: user.points,
        keyDropped: dropResult && dropResult.dropped,
        userKeys: dropResult && dropResult.userKeys,
        nextMultipliers
      });
    });

  } catch (err) {
    console.error('❌ Erreur Hi-Low /start:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ========================================
// ROUTE : Deviner (higher / lower / equal)
// ========================================
// ========================================
// FONCTION MULTIPLICATEUR
// ========================================

function getMultiplier(guess, prevCard, deck) {
  const prevValue = cardNumericValue(prevCard);
  const remaining = deck.length;

  if (remaining === 0) return 1.05;

  let favorable = 0;
  for (const card of deck) {
    const v = cardNumericValue(card);
    if (guess === 'higher' && v > prevValue) favorable++;
    if (guess === 'lower' && v < prevValue) favorable++;
    if (guess === 'equal' && v === prevValue) favorable++;
  }

  if (favorable === 0) return 10.0;
  if (favorable >= remaining) return 1.05;

  const prob = favorable / remaining;
  const multiplier = Math.max(1.05, Math.min(10.0, 0.95 / prob));
  return Math.round(multiplier * 100) / 100;
}

// ========================================
// ROUTE : Deviner (higher / lower / equal)
// ========================================
router.post('/guess', requireAuth, (req, res) => {
  const { sessionId, guess } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId || !session.gameActive) {
    return res.status(400).json({ success: false, message: 'Session invalide' });
  }

  if (!['higher', 'lower', 'equal'].includes(guess)) {
    return res.status(400).json({ success: false, message: 'Guess invalide' });
  }

  const prevCard = session.currentCard;

  // Calculer le multiplicateur AVANT de tirer la carte (deck intact)
  const multiplier = getMultiplier(guess, prevCard, session.deck);

  const nextCard = session.deck.pop();
  const prevValue = cardNumericValue(prevCard);
  const nextValue = cardNumericValue(nextCard);

  let correctGuess;
  if (guess === 'higher') correctGuess = nextValue > prevValue;
  else if (guess === 'lower') correctGuess = nextValue < prevValue;
  else correctGuess = nextValue === prevValue;
  if (correctGuess) {
    session.streak++;
    session.currentCard = nextCard;

    // Cumuler les multiplicateurs
    session.cumulativeMultiplier = Math.round(session.cumulativeMultiplier * multiplier * 100) / 100;

    // Gain = mise × multiplicateur CUMULÉ
    const gain = Math.floor(session.betAmount * session.cumulativeMultiplier);
    session.pendingGain = gain;

    // Calculer les 3 multiplicateurs possibles pour la prochaine carte
    const nextMultipliers = {
      higher: getMultiplier('higher', session.currentCard, session.deck),
      lower: getMultiplier('lower', session.currentCard, session.deck),
      equal: getMultiplier('equal', session.currentCard, session.deck)
    };

    return res.json({
      success: true,
      correct: true,
      prevCard,
      nextCard,
      streak: session.streak,
      multiplier,                              // multiplicateur de CE tour
      cumulativeMultiplier: session.cumulativeMultiplier, // total cumulé
      pendingGain: gain,
      canContinue: session.deck.length > 0,
      nextMultipliers
    });
  } else {
    session.gameActive = false;

    db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
      .run(userId, 0, `Hi-Low - Défaite (streak ${session.streak}) : -${session.betAmount} pts`);

    activeSessions.delete(sessionId);

    return res.json({
      success: true,
      correct: false,
      prevCard,
      nextCard,
      streak: session.streak,
      result: 'lose',
      message: `❌ Raté ! La carte était ${nextCard.value}${nextCard.suit}`,
      newPoints: req.session.user.points
    });
  }
});

// ========================================
// ROUTE : Encaisser les gains (Cash Out)
// ========================================
router.post('/cashout', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId || !session.gameActive) {
    return res.status(400).json({ success: false, message: 'Session invalide' });
  }

  if (session.streak === 0 || !session.pendingGain) {
    // Aucune bonne réponse encore : rembourser simplement la mise
    session.gameActive = false;
    activeSessions.delete(sessionId);
    return res.json({
      success: true,
      result: 'push',
      message: '🤝 Remboursé !',
      gain: session.betAmount,
      newPoints: req.session.user.points
    });
  }

  const gain = session.pendingGain;
  session.gameActive = false;

  try {
    db.prepare("UPDATE compte SET points = points + ? WHERE id = ?").run(gain, userId);
    const net = gain - session.betAmount;
    db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
      .run(userId, net, `Hi-Low - Encaissement (streak ${session.streak}) : +${net} pts`);

    const user = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
    req.session.user.points = user.points;
    activeSessions.delete(sessionId);

    return res.json({
      success: true,
      result: 'win',
      message: `💰 Encaissé ! +${net} pts`,
      gain,
      netGain: net,
      streak: session.streak,
      newPoints: user.points
    });

  } catch (err) {
    console.error('❌ Erreur Hi-Low /cashout:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ========================================
// ROUTE : Abandonner (retour à la mise si streak=0)
// ========================================
router.post('/forfeit', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId) {
    return res.status(400).json({ success: false, message: 'Session invalide' });
  }

  session.gameActive = false;
  activeSessions.delete(sessionId);

  // Pas de remboursement si on a déjà commencé à jouer
  return res.json({
    success: true,
    result: 'forfeit',
    message: 'Partie abandonnée',
    newPoints: req.session.user.points
  });
});

module.exports = router;
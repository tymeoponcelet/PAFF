const express = require('express');
const router = express.Router();
const db = require('../../config');
const { requireAuth, checkBalance } = require('../middleware/auth');
const { tryKeyDrop } = require('../key-drop');
const checkTime = require('../middleware/checktime'); // ✅ IMPORTER

// ✅ APPLIQUER LE MIDDLEWARE À TOUTES LES ROUTES
router.use(checkTime);

// Logique de jeu serveur
const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Crée et mélange un nouveau paquet de cartes
function createDeck() {
  const newDeck = [];
  for (let suit of suits) {
    for (let value of values) {
      newDeck.push({ suit, value });
    }
  }
  // Shuffle Fisher-Yates
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

// Retourne la valeur d'une carte
function cardValue(card) {
  if (card.value === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  return parseInt(card.value);
}

// Calcule le score d'une main en gérant les As
function calculateScore(hand) {
  let score = 0;
  let aces = 0;

  // Première passe : compter les cartes et les As
  for (let card of hand) {
    const value = card.value;

    if (value === 'A') {
      aces++;
      score += 11; // On compte l'As comme 11 au départ
    } else if (['J', 'Q', 'K'].includes(value)) {
      score += 10;
    } else {
      score += parseInt(value);
    }
  }

  // Deuxième passe : ajuster les As si nécessaire
  while (score > 21 && aces > 0) {
    score -= 10; // Convertir un As de 11 à 1
    aces--;
  }

  return score;
}


// Sessions de jeu actives en mémoire
const activeSessions = new Map();

// Route : Démarrer une partie
router.post('/start', requireAuth, checkBalance, (req, res) => {
  const { betAmount, minBet = 0 } = req.body;
  const userId = req.session.user.id;

  // Vérification de la mise minimale
  if (betAmount < minBet) {
    return res.status(400).json({
      success: false,
      message: `Mise minimale : ${minBet} points`
    });
  }

  const deck = createDeck();
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];
  const sessionId = `${userId}_${Date.now()}`;

  // Déduire la mise une seule fois au début de la partie
  try {
    db.prepare(
      "UPDATE compte SET points = points - ? WHERE id = ?"
    ).run(betAmount, userId);

    // Logger la mise dans l'historique
    db.prepare(
      "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
    ).run(userId, -betAmount, `Blackjack - Mise : ${betAmount} pts`);

    // Tenter un drop de clé (mise >= 100 pts)
    tryKeyDrop(db, userId, betAmount, 'blackjack', (errDrop, dropResult) => {
      if (errDrop) dropResult = { dropped: false, userKeys: null };

      try {
        // Récupérer le nouveau solde de points
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

        // Sauvegarder la session de jeu
        activeSessions.set(sessionId, {
          userId,
          betAmount,
          deck,
          playerHand,
          dealerHand,
          gameActive: true,
          startTime: Date.now()
        });

        const playerScore = calculateScore(playerHand);
        const dealerVisibleScore = cardValue(dealerHand[0]);
        const isBlackjack = playerScore === 21 && playerHand.length === 2;

        // Gestion du Blackjack naturel (21 avec 2 cartes)
        if (isBlackjack) {
          const dealerScore = calculateScore(dealerHand);
          const dealerBlackjack = dealerScore === 21;

          activeSessions.delete(sessionId);

          if (dealerBlackjack) {
            // Égalité : rembourser la mise
            const refund = betAmount;

            db.prepare(
              "UPDATE compte SET points = points + ? WHERE id = ?"
            ).run(refund, userId);

            db.prepare(
              "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
            ).run(userId, 0, `Blackjack - Égalité : remboursement ${betAmount} pts`);

            return res.json({
              success: true,
              sessionId,
              playerHand,
              dealerHand,
              playerScore,
              dealerScore,
              result: 'push',
              message: '🤝 Égalité ! Deux Blackjacks',
              newPoints: user.points + refund,
              keyDropped: dropResult && dropResult.dropped,
              userKeys: dropResult && dropResult.userKeys
            });

          } else {
            // Blackjack gagne avec un paiement 3:2
            const winnings = Math.floor(betAmount * 2.5);

            db.prepare(
              "UPDATE compte SET points = points + ? WHERE id = ?"
            ).run(winnings, userId);

            const netGain = Math.floor(betAmount * 1.5);
            db.prepare(
              "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
            ).run(userId, netGain, `Blackjack - BLACKJACK : +${netGain} pts`);

            return res.json({
              success: true,
              sessionId,
              playerHand,
              dealerHand,
              playerScore,
              dealerScore,
              result: 'blackjack',
              message: '🎉 BLACKJACK ! Vous gagnez 3:2',
              newPoints: user.points + winnings,
              keyDropped: dropResult && dropResult.dropped,
              userKeys: dropResult && dropResult.userKeys
            });
          }
        }

        // Partie normale : masquer la deuxième carte du croupier
        return res.json({
          success: true,
          sessionId,
          playerHand,
          dealerHand: [dealerHand[0], { hidden: true }],
          playerScore,
          dealerScore: dealerVisibleScore,
          newPoints: user.points,
          keyDropped: dropResult && dropResult.dropped,
          userKeys: dropResult && dropResult.userKeys
        });

      } catch (err) {
        console.error('❌ Erreur:', err);
        return res.status(500).json({
          success: false,
          message: "Erreur serveur"
        });
      }
    });

  } catch (err) {
    console.error('❌ Erreur:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la mise"
    });
  }
});

// Route : Tirer une carte (Hit)
router.post('/hit', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  // Vérification de la session
  if (!session || session.userId !== userId || !session.gameActive) {
    return res.status(400).json({
      success: false,
      message: "Session invalide"
    });
  }

  const newCard = session.deck.pop();
  session.playerHand.push(newCard);

  const playerScore = calculateScore(session.playerHand);
  const busted = playerScore > 21;

  if (busted) {
    session.gameActive = false;
    activeSessions.delete(sessionId);

    const dealerScore = calculateScore(session.dealerHand);

    // Logger la défaite (la mise a déjà été déduite)
    db.prepare(
      "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
    ).run(userId, 0, `Blackjack - Défaite (bust) : -${session.betAmount} pts`);


    return res.json({
      success: true,
      newCard,
      playerHand: session.playerHand,
      dealerHand: session.dealerHand,
      playerScore,
      dealerScore,
      busted: true,
      result: 'bust',
      message: '💥 Vous avez dépassé 21 !',
      newPoints: req.session.user.points
    });
  }

  // Partie continue
  res.json({
    success: true,
    newCard,
    playerHand: session.playerHand,
    playerScore,
    busted: false
  });
});

// Route : Rester (Stand)
router.post('/stand', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  // Vérification de la session
  if (!session || session.userId !== userId || !session.gameActive) {
    return res.status(400).json({
      success: false,
      message: "Session invalide"
    });
  }

  session.gameActive = false;

  // Le croupier tire des cartes jusqu'à atteindre au moins 17
  while (calculateScore(session.dealerHand) < 17) {
    session.dealerHand.push(session.deck.pop());
  }

  const playerScore = calculateScore(session.playerHand);
  const dealerScore = calculateScore(session.dealerHand);

  let result, message, winnings = 0, variation = 0;

  // Détermination du résultat
  if (dealerScore > 21 || playerScore > dealerScore) {
    result = 'win';
    message = dealerScore > 21
      ? '🎉 Le croupier a dépassé 21 ! Vous gagnez !'
      : '🎉 Vous gagnez !';
    winnings = session.betAmount * 2;
    variation = session.betAmount;
  } else if (playerScore < dealerScore) {
    result = 'lose';
    message = '😢 Le croupier gagne...';
    winnings = 0;
    variation = 0;
  } else {
    result = 'push';
    message = '🤝 Égalité !';
    winnings = session.betAmount;
    variation = 0;
  }

  activeSessions.delete(sessionId);

  // Créditer les gains si victoire ou égalité
  if (winnings > 0) {
    try {
      db.prepare(
        "UPDATE compte SET points = points + ? WHERE id = ?"
      ).run(winnings, userId);

      db.prepare(
        "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
      ).run(userId, variation, `Blackjack - ${result === 'win' ? 'Victoire' : 'Égalité'} : ${variation > 0 ? '+' : ''}${variation} pts`);

      const user = db.prepare(
        "SELECT points FROM compte WHERE id = ?"
      ).get(userId);

      if (user) req.session.user.points = user.points;

      return res.json({
        success: true,
        dealerHand: session.dealerHand,
        dealerScore,
        playerScore,
        result,
        message,
        newPoints: user ? user.points : req.session.user.points
      });

    } catch (err) {
      console.error('❌ Erreur:', err);
      return res.status(500).json({ success: false, message: "Erreur serveur" });
    }

  } else {
    // Défaite : juste logger
    db.prepare(
      "INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)"
    ).run(userId, 0, `Blackjack - Défaite : -${session.betAmount} pts`);

    return res.json({
      success: true,
      dealerHand: session.dealerHand,
      dealerScore,
      playerScore,
      result,
      message,
      newPoints: req.session.user.points
    });
  }
});

// Route : Récupérer le solde de points
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
    console.error('❌ Erreur:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur de récupération"
    });
  }
});

// Nettoyage automatique des sessions inactives (toutes les minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    // Supprime les sessions de plus de 10 minutes
    if (now - session.startTime > 600000) {
      activeSessions.delete(sessionId);
    }
  }
}, 60000);

// ============================================================
// NOUVELLES ROUTES À AJOUTER dans blackjack.js (côté serveur)
// Insérez ces routes avant la ligne : module.exports = router;
// ============================================================

// Route : Doubler (Double Down)
router.post('/double', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId || !session.gameActive) {
    return res.status(400).json({ success: false, message: "Session invalide" });
  }

  if (session.playerHand.length !== 2) {
    return res.status(400).json({ success: false, message: "Double uniquement sur les 2 premières cartes" });
  }

  const user = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
  if (!user || user.points < session.betAmount) {
    return res.status(400).json({ success: false, message: "Solde insuffisant pour doubler" });
  }

  // Déduire la mise supplémentaire égale à la mise initiale
  db.prepare("UPDATE compte SET points = points - ? WHERE id = ?").run(session.betAmount, userId);
  db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
    .run(userId, -session.betAmount, `Blackjack - Double Down : mise ${session.betAmount} pts`);

  const originalBet = session.betAmount;
  session.betAmount *= 2; // La mise totale est maintenant doublée

  // Tirer exactement 1 carte
  const newCard = session.deck.pop();
  session.playerHand.push(newCard);
  const playerScore = calculateScore(session.playerHand);
  session.gameActive = false;

  // Le croupier joue
  while (calculateScore(session.dealerHand) < 17) {
    session.dealerHand.push(session.deck.pop());
  }
  const dealerScore = calculateScore(session.dealerHand);

  let result, message, winnings = 0, variation = 0;

  if (playerScore > 21) {
    result = 'bust';
    message = '💥 Dépassé 21 !';
    db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
      .run(userId, 0, `Blackjack - Double Défaite (bust) : -${session.betAmount} pts`);
  } else if (dealerScore > 21 || playerScore > dealerScore) {
    result = 'win';
    message = dealerScore > 21 ? '🎉 Le croupier a dépassé 21 ! Vous gagnez !' : '🎉 Vous gagnez !';
    winnings = session.betAmount * 2;
    variation = session.betAmount;
    db.prepare("UPDATE compte SET points = points + ? WHERE id = ?").run(winnings, userId);
    db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
      .run(userId, variation, `Blackjack - Double Victoire : +${variation} pts`);
  } else if (playerScore < dealerScore) {
    result = 'lose';
    message = '😢 Le croupier gagne...';
    variation = -session.betAmount;
    db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
      .run(userId, variation, `Blackjack - Double Défaite : -${session.betAmount} pts`);
  } else {
    result = 'push';
    message = '🤝 Égalité !';
    winnings = session.betAmount;
    variation = 0;
    db.prepare("UPDATE compte SET points = points + ? WHERE id = ?").run(winnings, userId);
    db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
      .run(userId, variation, `Blackjack - Double Égalité : remboursement ${session.betAmount} pts`);
  }

  activeSessions.delete(sessionId);
  const finalUser = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
  req.session.user.points = finalUser.points;

  // ✅ CORRECTION
  let profit;
  if (result === 'win') profit = originalBet * 2;   // gain net = les 2 mises
  else if (result === 'lose' || result === 'bust') profit = -(originalBet * 2); // perte des 2 mises
  else profit = 0; // push = remboursé

  return res.json({
    success: true,
    newCard,
    playerHand: session.playerHand,
    dealerHand: session.dealerHand,
    playerScore,
    dealerScore,
    result,
    message,
    newPoints: finalUser.points,
    betAmount: originalBet,
    profit
  });
});

// Route : Initier un Split
router.post('/split', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId || !session.gameActive) {
    return res.status(400).json({ success: false, message: "Session invalide" });
  }

  const hand = session.playerHand;

  if (hand.length !== 2) {
    return res.status(400).json({ success: false, message: "Split uniquement avec 2 cartes" });
  }

  // Vérifier que les valeurs sont identiques (J/Q/K comptent comme identiques entre eux)
  if (hand[0].value !== hand[1].value) {
    return res.status(400).json({ success: false, message: "Les deux cartes doivent avoir la même valeur" });
  }

  const user = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
  if (!user || user.points < session.betAmount) {
    return res.status(400).json({ success: false, message: "Solde insuffisant pour splitter" });
  }

  // Déduire la 2e mise
  db.prepare("UPDATE compte SET points = points - ? WHERE id = ?").run(session.betAmount, userId);
  db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
    .run(userId, -session.betAmount, `Blackjack - Split : mise supplémentaire ${session.betAmount} pts`);

  // Créer les 2 mains avec 1 carte de départ chacune
  const hand1 = [hand[0], session.deck.pop()];
  const hand2 = [hand[1], session.deck.pop()];
  const isAceSplit = hand[0].value === 'A';

  // Stocker l'état du split dans la session
  session.isSplit = true;
  session.splitBet = session.betAmount;
  session.isAceSplit = isAceSplit;
  session.hand1Cards = hand1;
  session.hand2Cards = hand2;
  session.activeHand = 1;
  session.playerHand = hand1; // Main active = main 1
  session.hand1Result = null;
  session.hand1Winnings = 0;

  const updatedUser = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
  req.session.user.points = updatedUser.points;

  // CAS SPÉCIAL : Split d'As — une seule carte par main, résolution immédiate
  if (isAceSplit) {
    session.gameActive = false;

    while (calculateScore(session.dealerHand) < 17) {
      session.dealerHand.push(session.deck.pop());
    }
    const dealerScore = calculateScore(session.dealerHand);

    const resolveHand = (h, bet) => {
      const score = calculateScore(h);
      if (score > 21) return { score, result: 'bust', winnings: 0 };
      if (dealerScore > 21 || score > dealerScore) return { score, result: 'win', winnings: bet * 2 };
      if (score < dealerScore) return { score, result: 'lose', winnings: 0 };
      return { score, result: 'push', winnings: bet };
    };

    const r1 = resolveHand(hand1, session.betAmount);
    const r2 = resolveHand(hand2, session.splitBet);
    const totalWinnings = r1.winnings + r2.winnings;

    if (totalWinnings > 0) {
      db.prepare("UPDATE compte SET points = points + ? WHERE id = ?").run(totalWinnings, userId);
    }
    const netVariation = totalWinnings - (session.betAmount * 2); // gains - (2 mises déjà déduites)
    db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
      .run(userId, netVariation, `Blackjack - Split As : net ${netVariation >= 0 ? '+' : ''}${netVariation} pts`);

    activeSessions.delete(sessionId);
    const finalUser = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
    req.session.user.points = finalUser.points;

    // Remplace le return res.json aceSplit: true par :
    return res.json({
      success: true,
      aceSplit: true,
      hand1, hand2,
      score1: r1.score, result1: r1.result,
      score2: r2.score, result2: r2.result,
      dealerHand: session.dealerHand,
      dealerScore,
      newPoints: finalUser.points,
      profit: netVariation,
      betAmount: session.betAmount
    });
  }

  return res.json({
    success: true,
    aceSplit: false,
    hand1,
    hand2,
    score1: calculateScore(hand1),
    score2: calculateScore(hand2),
    activeHand: 1,
    newPoints: updatedUser.points
  });
});

// Route : Hit sur une main splittée
router.post('/split-hit', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId || !session.gameActive || !session.isSplit) {
    return res.status(400).json({ success: false, message: "Session invalide" });
  }

  const newCard = session.deck.pop();
  session.playerHand.push(newCard);

  // Sync la bonne main
  if (session.activeHand === 1) {
    session.hand1Cards = session.playerHand;
  } else {
    session.hand2Cards = session.playerHand;
  }

  const playerScore = calculateScore(session.playerHand);
  const busted = playerScore > 21;

  if (busted) {
    if (session.activeHand === 1) {
      // Main 1 bustée, passer à la main 2
      session.hand1Cards = session.playerHand;
      session.hand1Result = 'bust';
      session.hand1Winnings = 0;
      session.activeHand = 2;
      session.playerHand = session.hand2Cards;

      return res.json({
        success: true,
        newCard,
        activeHand: 1,
        hand1: session.hand1Cards,
        score1: playerScore,
        busted: true,
        switchToHand2: true,
        hand2: session.hand2Cards,
        score2: calculateScore(session.hand2Cards)
      });
    } else {
      // Main 2 bustée aussi : résoudre la partie
      session.hand2Cards = session.playerHand;
      session.gameActive = false;

      while (calculateScore(session.dealerHand) < 17) {
        session.dealerHand.push(session.deck.pop());
      }
      const dealerScore = calculateScore(session.dealerHand); // déjà correct ici

      const totalWinnings = (session.hand1Winnings || 0); // r2.winnings = 0
      // ⚠️ CORRECTION : betAmount est déjà la mise totale engagée (betAmount + splitBet)
      const netVariation = totalWinnings - session.betAmount - session.splitBet;

      if (totalWinnings > 0) {
        db.prepare("UPDATE compte SET points = points + ? WHERE id = ?").run(totalWinnings, userId);
      }
      db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
        .run(userId, netVariation, `Blackjack - Split résolu : net ${netVariation >= 0 ? '+' : ''}${netVariation} pts`);

      activeSessions.delete(sessionId);
      const finalUser = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
      req.session.user.points = finalUser.points;

      return res.json({
        success: true,
        newCard,
        finalResolution: true,
        hand1: session.hand1Cards,
        hand2: session.hand2Cards,
        score1: calculateScore(session.hand1Cards),
        score2: playerScore,
        result1: session.hand1Result,
        result2: 'bust',
        dealerHand: session.dealerHand,
        dealerScore,
        newPoints: finalUser.points,
        profit: netVariation,        // ← AJOUT
        betAmount: session.betAmount // ← AJOUT
      });
    }
  }

  return res.json({
    success: true,
    newCard,
    activeHand: session.activeHand,
    playerHand: session.playerHand,
    playerScore,
    busted: false
  });
});

// Route : Stand sur une main splittée
router.post('/split-stand', requireAuth, (req, res) => {
  const { sessionId } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId || !session.gameActive || !session.isSplit) {
    return res.status(400).json({ success: false, message: "Session invalide" });
  }

  if (session.activeHand === 1) {
    // Résoudre partiellement la main 1 (on attend le croupier à la fin)
    session.hand1Cards = session.playerHand;
    session.hand1Score = calculateScore(session.playerHand);
    session.hand1Result = 'pending';
    session.activeHand = 2;
    session.playerHand = session.hand2Cards;

    return res.json({
      success: true,
      switchToHand2: true,
      hand1: session.hand1Cards,
      score1: session.hand1Score,
      hand2: session.hand2Cards,
      score2: calculateScore(session.hand2Cards)
    });
  }

  // Main 2 terminée : le croupier joue et on résout tout
  session.hand2Cards = session.playerHand;
  session.gameActive = false;

  while (calculateScore(session.dealerHand) < 17) {
    session.dealerHand.push(session.deck.pop());
  }
  const dealerScore = calculateScore(session.dealerHand);

  const resolveHand = (h, bet) => {
    const score = calculateScore(h);
    if (score > 21) return { score, result: 'bust', winnings: 0, variation: -bet };
    if (dealerScore > 21 || score > dealerScore) return { score, result: 'win', winnings: bet * 2, variation: bet };
    if (score < dealerScore) return { score, result: 'lose', winnings: 0, variation: -bet };
    return { score, result: 'push', winnings: bet, variation: 0 };
  };

  const r1 = resolveHand(session.hand1Cards, session.betAmount);
  const r2 = resolveHand(session.hand2Cards, session.splitBet);
  const totalWinnings = r1.winnings + r2.winnings;
  const netVariation = r1.variation + r2.variation;

  if (totalWinnings > 0) {
    db.prepare("UPDATE compte SET points = points + ? WHERE id = ?").run(totalWinnings, userId);
  }
  db.prepare("INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)")
    .run(userId, netVariation, `Blackjack - Split résolu : net ${netVariation >= 0 ? '+' : ''}${netVariation} pts`);

  activeSessions.delete(sessionId);
  const finalUser = db.prepare("SELECT points FROM compte WHERE id = ?").get(userId);
  req.session.user.points = finalUser.points;

  return res.json({
    success: true,
    finalResolution: true,
    hand1: session.hand1Cards,
    hand2: session.hand2Cards,
    score1: r1.score,
    score2: r2.score,
    result1: r1.result,
    result2: r2.result,
    dealerHand: session.dealerHand,
    dealerScore,
    newPoints: finalUser.points,
    profit: netVariation,
    betAmount: session.betAmount
  });
});

module.exports = router;

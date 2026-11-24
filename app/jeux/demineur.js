const express = require('express');
const router = express.Router();
const db = require('../../config');
const { requireAuth } = require('../middleware/auth');
const checkTime = require('../middleware/checktime');
const { tryKeyDrop } = require('../key-drop');

router.use(checkTime);

// ========================================
// CONFIGURATION
// ========================================
const LIGNES = 9;
const COLONNES = 9;
const NOMBRE_MINES = 15;
const MISE_MIN = 50;
const MISE_MAX = 300;

// Sessions actives en mémoire
const activeSessions = new Map();

// ========================================
// UTILITAIRES DE JEU
// ========================================

/**
 * Crée une grille vide sans mines
 */
function creerGrilleVide() {
  return Array(LIGNES).fill(null).map(() =>
    Array(COLONNES).fill(null).map(() => ({
      mine: false,
      voisins: 0
    }))
  );
}

/**
 * Place les mines aléatoirement en évitant la première case cliquée
 * et son voisinage immédiat (zone sûre 3x3)
 */
function placerMines(grille, ligneExclue, colonneExclue) {
  // Construire la liste des cases exclues (zone sûre autour du premier clic)
  const exclues = new Set();
  for (let dl = -1; dl <= 1; dl++) {
    for (let dc = -1; dc <= 1; dc++) {
      const l = ligneExclue + dl;
      const c = colonneExclue + dc;
      if (l >= 0 && l < LIGNES && c >= 0 && c < COLONNES) {
        exclues.add(`${l},${c}`);
      }
    }
  }

  // Placer les mines aléatoirement
  let minesPlacees = 0;
  while (minesPlacees < NOMBRE_MINES) {
    const l = Math.floor(Math.random() * LIGNES);
    const c = Math.floor(Math.random() * COLONNES);
    if (!grille[l][c].mine && !exclues.has(`${l},${c}`)) {
      grille[l][c].mine = true;
      minesPlacees++;
    }
  }

  // Calculer le nombre de voisins minés pour chaque case
  for (let l = 0; l < LIGNES; l++) {
    for (let c = 0; c < COLONNES; c++) {
      if (!grille[l][c].mine) {
        grille[l][c].voisins = compterVoisinsMines(grille, l, c);
      }
    }
  }

  return grille;
}

/**
 * Compte les mines voisines d'une case
 */
function compterVoisinsMines(grille, ligne, colonne) {
  let count = 0;
  for (let dl = -1; dl <= 1; dl++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dl === 0 && dc === 0) continue;
      const l = ligne + dl;
      const c = colonne + dc;
      if (l >= 0 && l < LIGNES && c >= 0 && c < COLONNES && grille[l][c].mine) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Révèle une case et propage si voisins = 0 (flood fill)
 * Retourne le nombre de cases nouvellement révélées
 */
function revelerCase(grille, grilleRevelee, ligne, colonne) {
  // Déjà révélée
  if (grilleRevelee[ligne][colonne]) return 0;

  grilleRevelee[ligne][colonne] = true;
  let casesRevelees = 1;

  // Propagation si la case n'a aucun voisin miné
  if (!grille[ligne][colonne].mine && grille[ligne][colonne].voisins === 0) {
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dl === 0 && dc === 0) continue;
        const l = ligne + dl;
        const c = colonne + dc;
        if (l >= 0 && l < LIGNES && c >= 0 && c < COLONNES && !grilleRevelee[l][c]) {
          casesRevelees += revelerCase(grille, grilleRevelee, l, c);
        }
      }
    }
  }

  return casesRevelees;
}

/**
 * Compte les cases non-mines non révélées restantes
 */
function compterCasesRestantes(grille, grilleRevelee) {
  let count = 0;
  for (let l = 0; l < LIGNES; l++) {
    for (let c = 0; c < COLONNES; c++) {
      if (!grille[l][c].mine && !grilleRevelee[l][c]) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Calcule le multiplicateur selon le temps écoulé (en secondes)
 */
function calculerMultiplicateur(secondes) {
  if (secondes < 30) return 3;
  if (secondes < 60) return 2;
  if (secondes < 120) return 1.5;
  return 1;
}

/**
 * Sérialise la grille pour le client :
 * - cases non révélées → 'hidden'
 * - cases révélées mine → 'mine' (seulement en fin de partie)
 * - cases révélées → nombre de voisins (0-8)
 */
function serialiserGrillePourClient(grille, grilleRevelee, grilleMarquee, revelerTout = false) {
  return grille.map((ligne, l) =>
    ligne.map((case_, c) => {
      if (grilleMarquee[l][c] && !grilleRevelee[l][c]) {
        return { etat: 'flag' };
      }
      if (!grilleRevelee[l][c]) {
        if (revelerTout && case_.mine) {
          return { etat: 'mine' };
        }
        return { etat: 'hidden' };
      }
      if (case_.mine) {
        return { etat: 'mine' };
      }
      return { etat: 'revealed', voisins: case_.voisins };
    })
  );
}

// ========================================
// ROUTE : Démarrer une partie
// ========================================
router.post('/start', requireAuth, (req, res) => {
  const { betAmount } = req.body;
  const userId = req.session.user.id;

  // Validation mise
  if (!betAmount || betAmount < MISE_MIN || betAmount > MISE_MAX) {
    return res.status(400).json({
      success: false,
      message: `Mise entre ${MISE_MIN} et ${MISE_MAX} points`
    });
  }

  try {
    const user = db.prepare('SELECT points FROM compte WHERE id = ?').get(userId);

    if (!user) {
      return res.status(500).json({ success: false, message: 'Erreur de connexion' });
    }

    if (user.points < betAmount) {
      return res.status(400).json({
        success: false,
        message: `Points insuffisants (vous avez ${user.points} pts)`
      });
    }

    // Débiter la mise immédiatement
    db.prepare('UPDATE compte SET points = points - ? WHERE id = ?').run(betAmount, userId);
    db.prepare('INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)')
      .run(userId, -betAmount, `Démineur - Mise : ${betAmount} pts`);

    const newPoints = user.points - betAmount;
    req.session.user.points = newPoints;

    // Créer la session (grille vide, mines placées au premier clic)
    const sessionId = `demineur_${userId}_${Date.now()}`;
    const grille = creerGrilleVide();
    const grilleRevelee = Array(LIGNES).fill(null).map(() => Array(COLONNES).fill(false));
    const grilleMarquee = Array(LIGNES).fill(null).map(() => Array(COLONNES).fill(false));
    const totalCasesNonMines = LIGNES * COLONNES - NOMBRE_MINES;

    activeSessions.set(sessionId, {
      userId,
      betAmount,
      grille,
      grilleRevelee,
      grilleMarquee,
      partieActive: true,
      premiereCase: true,
      startTime: null, // Démarre au premier clic
      casesRestantes: totalCasesNonMines,
      totalCasesNonMines
    });

    tryKeyDrop(db, userId, betAmount, 'demineur', (errDrop, dropResult) => {
      if (errDrop) dropResult = { dropped: false, userKeys: null };

      return res.json({
        success: true,
        sessionId,
        lignes: LIGNES,
        colonnes: COLONNES,
        nombreMines: NOMBRE_MINES,
        casesRestantes: totalCasesNonMines,
        newPoints,
        keyDropped: dropResult && dropResult.dropped,
        userKeys: dropResult && dropResult.userKeys
      });
    });

  } catch (err) {
    console.error('❌ Erreur démarrage Démineur:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ========================================
// ROUTE : Révéler une case
// ========================================
router.post('/reveal', requireAuth, (req, res) => {
  const { sessionId, ligne, colonne } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  // Validation session
  if (!session || session.userId !== userId || !session.partieActive) {
    return res.status(400).json({ success: false, message: 'Session invalide' });
  }

  // Validation coordonnées
  if (
    ligne < 0 || ligne >= LIGNES ||
    colonne < 0 || colonne >= COLONNES
  ) {
    return res.status(400).json({ success: false, message: 'Coordonnées invalides' });
  }

  // Case déjà révélée ou marquée
  if (session.grilleRevelee[ligne][colonne]) {
    return res.status(400).json({ success: false, message: 'Case déjà révélée' });
  }

  if (session.grilleMarquee[ligne][colonne]) {
    return res.status(400).json({ success: false, message: 'Case marquée, démarquez-la d\'abord' });
  }

  try {
    // Premier clic : placer les mines et démarrer le chrono
    if (session.premiereCase) {
      session.grille = placerMines(session.grille, ligne, colonne);
      session.startTime = Date.now();
      session.premiereCase = false;
    }

    // Vérifier si c'est une mine
    if (session.grille[ligne][colonne].mine) {
      session.partieActive = false;
      activeSessions.delete(sessionId);

      // Révéler toutes les mines pour le client
      session.grilleRevelee[ligne][colonne] = true;
      const grilleClient = serialiserGrillePourClient(
        session.grille,
        session.grilleRevelee,
        session.grilleMarquee,
        true // revelerTout = true
      );

      db.prepare('INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)')
        .run(userId, 0, `Démineur - Défaite : -${session.betAmount} pts`);

      return res.json({
        success: true,
        result: 'lose',
        message: '💥 Boom ! Vous avez touché une mine...',
        grille: grilleClient,
        newPoints: req.session.user.points
      });
    }

    // Révéler la case (avec propagation)
    const casesReveleesCeCoup = revelerCase(
      session.grille,
      session.grilleRevelee,
      ligne,
      colonne
    );

    session.casesRestantes -= casesReveleesCeCoup;

    // Vérifier la victoire
    if (session.casesRestantes <= 0) {
      session.partieActive = false;

      const secondes = Math.floor((Date.now() - session.startTime) / 1000);
      const multiplicateur = calculerMultiplicateur(secondes);
      const gains = Math.floor(session.betAmount * multiplicateur);

      db.prepare('UPDATE compte SET points = points + ? WHERE id = ?').run(gains, userId);
      db.prepare('INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)')
        .run(
          userId,
          gains - session.betAmount, // variation nette (peut être positive ou nulle)
          `Démineur - Victoire x${multiplicateur} : +${gains} pts en ${secondes}s`
        );

      const user = db.prepare('SELECT points FROM compte WHERE id = ?').get(userId);
      req.session.user.points = user.points;

      activeSessions.delete(sessionId);

      const grilleClient = serialiserGrillePourClient(
        session.grille,
        session.grilleRevelee,
        session.grilleMarquee
      );

      return res.json({
        success: true,
        result: 'win',
        message: `🎉 Gagné ! x${multiplicateur} en ${secondes}s → +${gains} pts`,
        grille: grilleClient,
        casesRestantes: 0,
        secondes,
        multiplicateur,
        gains,
        newPoints: user.points
      });
    }

    // Partie continue
    const grilleClient = serialiserGrillePourClient(
      session.grille,
      session.grilleRevelee,
      session.grilleMarquee
    );

    const secondesEcoulees = session.startTime
      ? Math.floor((Date.now() - session.startTime) / 1000)
      : 0;

    return res.json({
      success: true,
      result: null,
      grille: grilleClient,
      casesRestantes: session.casesRestantes,
      secondes: secondesEcoulees,
      multiplicateur: calculerMultiplicateur(secondesEcoulees)
    });

  } catch (err) {
    console.error('❌ Erreur révélation Démineur:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ========================================
// ROUTE : Marquer / démarquer un drapeau
// ========================================
router.post('/flag', requireAuth, (req, res) => {
  const { sessionId, ligne, colonne } = req.body;
  const userId = req.session.user.id;
  const session = activeSessions.get(sessionId);

  if (!session || session.userId !== userId || !session.partieActive) {
    return res.status(400).json({ success: false, message: 'Session invalide' });
  }

  if (
    ligne < 0 || ligne >= LIGNES ||
    colonne < 0 || colonne >= COLONNES
  ) {
    return res.status(400).json({ success: false, message: 'Coordonnées invalides' });
  }

  // Ne pas marquer une case déjà révélée
  if (session.grilleRevelee[ligne][colonne]) {
    return res.status(400).json({ success: false, message: 'Case déjà révélée' });
  }

  // Toggle du drapeau
  session.grilleMarquee[ligne][colonne] = !session.grilleMarquee[ligne][colonne];

  // Compter les drapeaux posés
  let drapeauxPoses = 0;
  for (let l = 0; l < LIGNES; l++) {
    for (let c = 0; c < COLONNES; c++) {
      if (session.grilleMarquee[l][c]) drapeauxPoses++;
    }
  }

  return res.json({
    success: true,
    marquee: session.grilleMarquee[ligne][colonne],
    minesRestantes: NOMBRE_MINES - drapeauxPoses
  });
});

// ========================================
// NETTOYAGE DES SESSIONS INACTIVES
// ========================================
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    // Sessions de plus de 15 minutes → abandon = défaite (mise déjà débitée)
    if (now - (session.startTime || now) > 900000) {
      activeSessions.delete(sessionId);
    }
  }
}, 60000);

module.exports = router;
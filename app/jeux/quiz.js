// ========================================
// QUIZ ÉDUCATIFS (F4)
// ========================================
// Une partie = NB_QUESTIONS questions tirées au hasard (un thème ou tous).
// La bonne réponse n'est jamais envoyée au navigateur avant que le joueur ait répondu,
// et le temps de réponse est mesuré par le serveur (anti-triche).
// Score : 100 par bonne réponse + jusqu'à 50 de bonus de rapidité.
// Hors duel, chaque bonne réponse rapporte POINTS_PAR_BONNE points fictifs.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../../config');
const { requireAuth } = require('../middleware/auth');
const checkTime = require('../middleware/checktime');
const duels = require('../services/duel');

router.use(checkTime);

const NB_QUESTIONS = 10;
const MIN_QUESTIONS = 3;
const DUREE_QUESTION = 20;      // secondes pour répondre
const MARGE_RESEAU_MS = 1500;   // tolérance pour le temps de transport des requêtes
const POINTS_PAR_BONNE = 10;

// Parties en cours, en mémoire (comme les autres jeux)
const parties = new Map();

function tirerQuestions(theme) {
  if (theme) {
    return db.prepare(`
      SELECT * FROM quiz_question WHERE active = 1 AND theme = ? ORDER BY RANDOM() LIMIT ?
    `).all(theme, NB_QUESTIONS);
  }
  return db.prepare(`
    SELECT * FROM quiz_question WHERE active = 1 ORDER BY RANDOM() LIMIT ?
  `).all(NB_QUESTIONS);
}

// Duel : les deux joueurs ont les mêmes questions, tirées une fois et gardées dans le duel
function questionsDuDuel(duelId) {
  const duel = duels.lireDuel(duelId);
  let ids = duel.donnees ? JSON.parse(duel.donnees) : null;

  if (!ids) {
    ids = tirerQuestions(null).map(q => q.id);
    db.prepare('UPDATE duel SET donnees = ? WHERE id = ? AND donnees IS NULL')
      .run(JSON.stringify(ids), duelId);
    // Relire au cas où l'adversaire a commencé au même moment
    ids = JSON.parse(duels.lireDuel(duelId).donnees);
  }

  const lire = db.prepare('SELECT * FROM quiz_question WHERE id = ?');
  return ids.map(id => lire.get(id)).filter(Boolean);
}

// Ce que le navigateur reçoit : jamais la bonne réponse
function questionPublique(partie) {
  const q = partie.questions[partie.index];
  return {
    numero: partie.index + 1,
    total: partie.questions.length,
    theme: q.theme,
    question: q.question,
    choix: [q.choix1, q.choix2, q.choix3, q.choix4],
    duree: DUREE_QUESTION
  };
}

function partieDuJoueur(req) {
  const partie = parties.get(req.body.sessionId);
  if (!partie || partie.userId !== req.session.user.id) return null;
  return partie;
}

// ── GET /actions/quiz/themes ───────────────────────────────────────────────
router.get('/themes', requireAuth, (req, res) => {
  const themes = db.prepare(`
    SELECT theme, COUNT(*) AS nb FROM quiz_question
    WHERE active = 1 GROUP BY theme ORDER BY theme
  `).all();
  res.json({ success: true, themes, nbQuestions: NB_QUESTIONS, duree: DUREE_QUESTION, pointsParBonne: POINTS_PAR_BONNE });
});

// ── POST /actions/quiz/start ───────────────────────────────────────────────
router.post('/start', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const duelId = parseInt(req.body.duelId, 10) || null;
  const theme = typeof req.body.theme === 'string' && req.body.theme.trim() ? req.body.theme.trim() : null;

  const { nb } = db.prepare('SELECT COUNT(*) AS nb FROM quiz_question WHERE active = 1').get();
  if (nb < MIN_QUESTIONS) {
    return res.status(400).json({ success: false, message: "Pas encore assez de questions dans le quiz." });
  }

  let questions;
  if (duelId) {
    const manche = duels.commencerManche(duelId, userId, 'quiz');
    if (!manche.ok) {
      return res.status(400).json({ success: false, message: manche.message });
    }
    questions = questionsDuDuel(duelId);
    if (questions.length === 0) {
      // Toutes les questions du duel ont été supprimées entre-temps
      const duel = duels.enregistrerScore(duelId, userId, 0);
      return res.status(400).json({ success: false, message: 'Les questions de ce duel ont été supprimées.', duel });
    }
  } else {
    questions = tirerQuestions(theme);
    if (questions.length < MIN_QUESTIONS) {
      return res.status(400).json({ success: false, message: 'Pas assez de questions dans ce thème.' });
    }
  }

  const sessionId = crypto.randomUUID();
  const partie = {
    userId, duelId, questions,
    index: 0, score: 0, bonnes: 0,
    debutQuestion: Date.now(), repondu: false, creation: Date.now()
  };
  parties.set(sessionId, partie);

  res.json({ success: true, sessionId, duelId, question: questionPublique(partie) });
});

// ── POST /actions/quiz/answer ──────────────────────────────────────────────
// choix : 1 à 4, ou 0 quand le temps est écoulé
router.post('/answer', requireAuth, (req, res) => {
  const partie = partieDuJoueur(req);
  if (!partie) {
    return res.status(400).json({ success: false, message: 'Partie introuvable' });
  }
  if (partie.repondu) {
    return res.status(400).json({ success: false, message: 'Vous avez déjà répondu à cette question' });
  }

  const q = partie.questions[partie.index];
  const choix = parseInt(req.body.choix, 10);
  const ecoule = Date.now() - partie.debutQuestion;
  const dansLesTemps = ecoule <= DUREE_QUESTION * 1000 + MARGE_RESEAU_MS;
  const correct = dansLesTemps && choix === q.bonne_reponse;

  let gainQuestion = 0;
  if (correct) {
    const bonus = Math.round(50 * Math.max(0, 1 - ecoule / (DUREE_QUESTION * 1000)));
    gainQuestion = 100 + bonus;
    partie.score += gainQuestion;
    partie.bonnes++;
  }
  partie.repondu = true;

  const derniere = partie.index === partie.questions.length - 1;
  const reponse = {
    success: true,
    correct,
    horsTemps: !dansLesTemps,
    bonneReponse: q.bonne_reponse,
    explication: q.explication || null,
    gainQuestion,
    score: partie.score,
    bonnes: partie.bonnes,
    derniere
  };

  if (derniere) {
    reponse.fin = terminerPartie(req, req.body.sessionId, partie);
  }
  res.json(reponse);
});

// ── POST /actions/quiz/next ────────────────────────────────────────────────
// Question suivante : le chrono démarre à ce moment-là (pas pendant la lecture de l'explication)
router.post('/next', requireAuth, (req, res) => {
  const partie = partieDuJoueur(req);
  if (!partie) {
    return res.status(400).json({ success: false, message: 'Partie introuvable' });
  }
  if (!partie.repondu) {
    return res.status(400).json({ success: false, message: "Répondez d'abord à la question" });
  }

  partie.index++;
  partie.repondu = false;
  partie.debutQuestion = Date.now();

  res.json({ success: true, question: questionPublique(partie) });
});

function terminerPartie(req, sessionId, partie) {
  parties.delete(sessionId);
  const { userId, duelId, score, bonnes } = partie;

  duels.enregistrerPartie(userId, 'quiz', score, duelId);

  let duel = null;
  let gain = 0;
  if (duelId) {
    duel = duels.enregistrerScore(duelId, userId, score);
  } else if (bonnes > 0) {
    gain = bonnes * POINTS_PAR_BONNE;
    db.prepare('UPDATE compte SET points = points + ? WHERE id = ?').run(gain, userId);
    db.prepare('INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)')
      .run(userId, gain, `Quiz : ${bonnes}/${partie.questions.length} bonnes réponses`);
  }

  const compte = db.prepare('SELECT points FROM compte WHERE id = ?').get(userId);
  if (compte) req.session.user.points = compte.points;

  return {
    score,
    bonnes,
    total: partie.questions.length,
    gain,
    nouveauxPoints: compte ? compte.points : null,
    duel
  };
}

// Nettoyage des parties abandonnées
setInterval(() => {
  const limite = Date.now() - 30 * 60 * 1000;
  for (const [id, partie] of parties.entries()) {
    if (partie.creation < limite) parties.delete(id);
  }
}, 5 * 60 * 1000);

module.exports = router;

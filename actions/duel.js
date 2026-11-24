// ========================================
// ROUTES : DUELS 1 CONTRE 1 (F3)
// ========================================
// Monté sur /actions/duel dans server.js.
// Les parties elles-mêmes se jouent dans les routes de chaque jeu (flappy, tape-taupe),
// qui reçoivent le duelId et appellent app/services/duel.js.

const express = require('express');
const router = express.Router();
const db = require('../config');
const { requireAuth } = require('../app/middleware/auth');
const duels = require('../app/services/duel');

router.use(requireAuth);

// Liste des jeux disponibles en duel
router.get('/jeux', (req, res) => {
  const jeux = Object.entries(duels.JEUX_DUEL).map(([id, nom]) => ({ id, nom }));
  res.json({ success: true, jeux });
});

// ── Défier un joueur précis ───────────────────────────────────────────────
router.post('/defier', (req, res) => {
  const userId = req.session.user.id;
  const pseudo = String(req.body.pseudo || '').trim();
  const { jeu } = req.body;

  if (!duels.estJeuDuel(jeu)) {
    return res.status(400).json({ success: false, message: 'Jeu non disponible en duel' });
  }
  if (!pseudo) {
    return res.status(400).json({ success: false, message: 'Indiquez le pseudo du joueur à défier' });
  }

  const adversaire = db.prepare(
    'SELECT id, pseudo FROM compte WHERE pseudo = ? COLLATE NOCASE AND compte_verifie = 1'
  ).get(pseudo);

  if (!adversaire) {
    return res.status(404).json({ success: false, message: 'Aucun joueur avec ce pseudo' });
  }
  if (adversaire.id === userId) {
    return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous défier vous-même' });
  }

  // Un seul défi ouvert à la fois entre deux joueurs sur un même jeu
  const dejaOuvert = db.prepare(`
    SELECT id FROM duel
    WHERE jeu = ? AND statut IN ('en_attente', 'en_cours')
      AND ((joueur1_id = ? AND joueur2_id = ?) OR (joueur1_id = ? AND joueur2_id = ?))
  `).get(jeu, userId, adversaire.id, adversaire.id, userId);

  if (dejaOuvert) {
    return res.status(400).json({
      success: false,
      message: `Un duel ${duels.JEUX_DUEL[jeu]} est déjà ouvert avec ${adversaire.pseudo}`
    });
  }

  const resultat = db.prepare(
    'INSERT INTO duel (jeu, joueur1_id, joueur2_id) VALUES (?, ?, ?)'
  ).run(jeu, userId, adversaire.id);

  res.json({
    success: true,
    message: `Défi envoyé à ${adversaire.pseudo} !`,
    duel: duels.resumeDuel(duels.lireDuel(resultat.lastInsertRowid), userId)
  });
});

// ── Trouver un adversaire disponible (file d'attente) ─────────────────────
// Si quelqu'un attend déjà sur ce jeu, on rejoint son duel ; sinon on se met en attente.
const rejoindreFile = db.transaction((userId, jeu) => {
  const monAttente = db.prepare(`
    SELECT id FROM duel
    WHERE jeu = ? AND joueur1_id = ? AND joueur2_id IS NULL AND statut = 'en_attente'
  `).get(jeu, userId);

  if (monAttente) {
    return { dejaEnAttente: true, duelId: monAttente.id };
  }

  const libre = db.prepare(`
    SELECT id FROM duel
    WHERE jeu = ? AND joueur2_id IS NULL AND statut = 'en_attente' AND joueur1_id != ?
    ORDER BY date_creation ASC
    LIMIT 1
  `).get(jeu, userId);

  if (libre) {
    db.prepare(`
      UPDATE duel SET joueur2_id = ?, statut = 'en_cours', date_debut = datetime('now')
      WHERE id = ?
    `).run(userId, libre.id);
    return { trouve: true, duelId: libre.id };
  }

  const resultat = db.prepare(
    'INSERT INTO duel (jeu, joueur1_id) VALUES (?, ?)'
  ).run(jeu, userId);
  return { trouve: false, duelId: resultat.lastInsertRowid };
});

router.post('/file', (req, res) => {
  const userId = req.session.user.id;
  const { jeu } = req.body;

  if (!duels.estJeuDuel(jeu)) {
    return res.status(400).json({ success: false, message: 'Jeu non disponible en duel' });
  }

  const r = rejoindreFile(userId, jeu);
  const duel = duels.resumeDuel(duels.lireDuel(r.duelId), userId);

  let message;
  if (r.trouve) message = `Adversaire trouvé : ${duel.adversaire} ! À vous de jouer.`;
  else if (r.dejaEnAttente) message = 'Vous êtes déjà en attente sur ce jeu.';
  else message = "En attente d'un adversaire. Le duel apparaîtra dès que quelqu'un vous rejoint.";

  res.json({ success: true, message, duel });
});

// ── Accepter / refuser / annuler ──────────────────────────────────────────
function chargerDuelParticipant(req, res) {
  const duelId = parseInt(req.params.id, 10);
  const duel = Number.isInteger(duelId) ? duels.lireDuel(duelId) : null;

  if (!duel || !duels.estParticipant(duel, req.session.user.id)) {
    res.status(404).json({ success: false, message: 'Duel introuvable' });
    return null;
  }
  return duel;
}

router.post('/:id/accepter', (req, res) => {
  const duel = chargerDuelParticipant(req, res);
  if (!duel) return;

  if (duel.joueur2_id !== req.session.user.id || duel.statut !== 'en_attente') {
    return res.status(400).json({ success: false, message: 'Ce défi ne peut pas être accepté' });
  }

  db.prepare(`
    UPDATE duel SET statut = 'en_cours', date_debut = datetime('now')
    WHERE id = ? AND statut = 'en_attente'
  `).run(duel.id);

  res.json({ success: true, message: 'Défi accepté ! À vous de jouer.' });
});

router.post('/:id/refuser', (req, res) => {
  const duel = chargerDuelParticipant(req, res);
  if (!duel) return;

  if (duel.joueur2_id !== req.session.user.id || duel.statut !== 'en_attente') {
    return res.status(400).json({ success: false, message: 'Ce défi ne peut pas être refusé' });
  }

  db.prepare(`
    UPDATE duel SET statut = 'refuse', date_fin = datetime('now')
    WHERE id = ? AND statut = 'en_attente'
  `).run(duel.id);

  res.json({ success: true, message: 'Défi refusé.' });
});

router.post('/:id/annuler', (req, res) => {
  const duel = chargerDuelParticipant(req, res);
  if (!duel) return;

  if (duel.joueur1_id !== req.session.user.id || duel.statut !== 'en_attente') {
    return res.status(400).json({ success: false, message: 'Ce duel ne peut plus être annulé' });
  }

  db.prepare(`
    UPDATE duel SET statut = 'annule', date_fin = datetime('now')
    WHERE id = ? AND statut = 'en_attente'
  `).run(duel.id);

  res.json({ success: true, message: 'Duel annulé.' });
});

// ── Mes duels, rangés pour l'affichage ─────────────────────────────────────
router.get('/mes-duels', (req, res) => {
  const userId = req.session.user.id;

  duels.cloturerDuelsExpires();

  const ouverts = db.prepare(`
    SELECT * FROM duel
    WHERE (joueur1_id = ? OR joueur2_id = ?) AND statut IN ('en_attente', 'en_cours')
    ORDER BY date_creation DESC
  `).all(userId, userId).map(d => duels.resumeDuel(d, userId));

  const termines = db.prepare(`
    SELECT * FROM duel
    WHERE (joueur1_id = ? OR joueur2_id = ?) AND statut = 'termine'
    ORDER BY date_fin DESC
    LIMIT 10
  `).all(userId, userId).map(d => duels.resumeDuel(d, userId));

  const bilan = db.prepare(`
    SELECT
      SUM(CASE WHEN gagnant_id = ? THEN 1 ELSE 0 END)                           AS victoires,
      SUM(CASE WHEN gagnant_id IS NOT NULL AND gagnant_id != ? THEN 1 ELSE 0 END) AS defaites,
      SUM(CASE WHEN gagnant_id IS NULL THEN 1 ELSE 0 END)                       AS egalites
    FROM duel
    WHERE (joueur1_id = ? OR joueur2_id = ?) AND statut = 'termine'
  `).get(userId, userId, userId, userId);

  res.json({
    success: true,
    // Défis reçus à accepter ou refuser
    recus: ouverts.filter(d => d.statut === 'en_attente' && !d.jeSuisCreateur),
    // Défis envoyés et recherches d'adversaire pas encore acceptés
    envoyes: ouverts.filter(d => d.statut === 'en_attente' && d.jeSuisCreateur),
    // Duels acceptés : à jouer, ou en attente du score de l'adversaire
    enCours: ouverts.filter(d => d.statut === 'en_cours'),
    termines,
    bilan: {
      victoires: bilan.victoires || 0,
      defaites: bilan.defaites || 0,
      egalites: bilan.egalites || 0
    }
  });
});

module.exports = router;

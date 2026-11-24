// ========================================
// SERVICE : DUELS 1 CONTRE 1 AU SCORE (F3)
// ========================================
// Principe : chaque joueur joue SA partie du même jeu, le meilleur score gagne.
// Les deux parties n'ont pas besoin d'être jouées en même temps.
// Pas de mise : un duel ne fait gagner ni perdre de points, il compte pour le bilan
// de duels et (comme toute partie) pour le classement par jeu.
//
// Règles :
// - une seule partie par joueur et par duel ; commencer la partie la "consomme"
//   (impossible de recommencer jusqu'à obtenir un bon score) ;
// - une partie commencée et non terminée après DUREE_MAX_MANCHE compte 0 ;
// - un duel accepté doit être joué dans les DUREE_MAX_DUEL, sinon les parties
//   non jouées comptent 0 ;
// - un défi non accepté expire au bout de DUREE_MAX_ATTENTE.

const db = require('../../config');

// Jeux disponibles en duel : clé utilisée en base → nom affiché
const JEUX_DUEL = {
  flappy: 'Flappy Bird',
  tapetaupe: 'Tape-Taupe',
  quiz: 'Quiz'
};

const DUREE_MAX_MANCHE = '-30 minutes';
const DUREE_MAX_DUEL = '-48 hours';
const DUREE_MAX_ATTENTE = '-7 days';

function estJeuDuel(jeu) {
  return Object.prototype.hasOwnProperty.call(JEUX_DUEL, jeu);
}

function lireDuel(duelId) {
  return db.prepare('SELECT * FROM duel WHERE id = ?').get(duelId);
}

function estParticipant(duel, userId) {
  return duel.joueur1_id === userId || duel.joueur2_id === userId;
}

// Termine le duel si les deux parties sont finies et désigne le gagnant
function cloturerSiFini(duelId) {
  const manches = db.prepare(
    'SELECT compte_id, score, terminee FROM duel_manche WHERE duel_id = ?'
  ).all(duelId);

  if (manches.length < 2 || manches.some(m => !m.terminee)) return;

  const [a, b] = manches;
  let gagnant = null; // null = égalité
  if (a.score > b.score) gagnant = a.compte_id;
  if (b.score > a.score) gagnant = b.compte_id;

  db.prepare(`
    UPDATE duel SET statut = 'termine', gagnant_id = ?, date_fin = datetime('now')
    WHERE id = ? AND statut = 'en_cours'
  `).run(gagnant, duelId);
}

// Applique les délais (appelé avant chaque lecture de la liste des duels)
const cloturerDuelsExpires = db.transaction(() => {
  // Défis jamais acceptés
  db.prepare(`
    UPDATE duel SET statut = 'expire', date_fin = datetime('now')
    WHERE statut = 'en_attente' AND date_creation < datetime('now', ?)
  `).run(DUREE_MAX_ATTENTE);

  // Parties commencées puis abandonnées : elles comptent avec le score atteint (0)
  db.prepare(`
    UPDATE duel_manche SET terminee = 1
    WHERE terminee = 0 AND date_debut < datetime('now', ?)
  `).run(DUREE_MAX_MANCHE);

  // Duels trop anciens : les parties jamais commencées comptent 0
  const enRetard = db.prepare(`
    SELECT id, joueur1_id, joueur2_id FROM duel
    WHERE statut = 'en_cours' AND date_debut < datetime('now', ?)
  `).all(DUREE_MAX_DUEL);

  const ajouterMancheVide = db.prepare(`
    INSERT OR IGNORE INTO duel_manche (duel_id, compte_id, score, terminee)
    VALUES (?, ?, 0, 1)
  `);
  for (const duel of enRetard) {
    ajouterMancheVide.run(duel.id, duel.joueur1_id);
    ajouterMancheVide.run(duel.id, duel.joueur2_id);
    db.prepare('UPDATE duel_manche SET terminee = 1 WHERE duel_id = ?').run(duel.id);
  }

  // Clôturer tous les duels dont les deux parties sont terminées
  const aVerifier = db.prepare(`SELECT id FROM duel WHERE statut = 'en_cours'`).all();
  for (const duel of aVerifier) cloturerSiFini(duel.id);
});

// Appelé par le jeu au début d'une partie de duel.
// Renvoie { ok: true } ou { ok: false, message }.
function commencerManche(duelId, userId, jeu) {
  const duel = lireDuel(duelId);

  if (!duel || !estParticipant(duel, userId)) {
    return { ok: false, message: 'Duel introuvable' };
  }
  if (duel.jeu !== jeu) {
    return { ok: false, message: 'Ce duel se joue sur un autre jeu' };
  }
  if (duel.statut !== 'en_cours') {
    return { ok: false, message: "Ce duel n'est pas en cours" };
  }

  // La clé primaire (duel_id, compte_id) empêche de jouer deux fois
  const resultat = db.prepare(`
    INSERT OR IGNORE INTO duel_manche (duel_id, compte_id, score, terminee)
    VALUES (?, ?, 0, 0)
  `).run(duelId, userId);

  if (resultat.changes === 0) {
    return { ok: false, message: 'Vous avez déjà joué votre partie de ce duel' };
  }
  return { ok: true };
}

// Appelé par le jeu à la fin d'une partie de duel, avec le score validé par le serveur.
// Renvoie le résumé du duel pour l'afficher au joueur.
function enregistrerScore(duelId, userId, score) {
  db.prepare(`
    UPDATE duel_manche SET score = ?, terminee = 1
    WHERE duel_id = ? AND compte_id = ? AND terminee = 0
  `).run(score, duelId, userId);

  cloturerSiFini(duelId);
  return resumeDuel(lireDuel(duelId), userId);
}

// Enregistre une partie dans l'historique (classement par jeu)
function enregistrerPartie(userId, jeu, score, duelId = null) {
  db.prepare(
    'INSERT INTO partie (compte_id, jeu, score, duel_id) VALUES (?, ?, ?, ?)'
  ).run(userId, jeu, score, duelId);
}

// Vue d'un duel du point de vue d'un joueur.
// Le score de l'adversaire reste caché tant que le joueur n'a pas fini sa propre partie.
function resumeDuel(duel, userId) {
  const adversaireId = duel.joueur1_id === userId ? duel.joueur2_id : duel.joueur1_id;
  const adversaire = adversaireId
    ? db.prepare('SELECT pseudo FROM compte WHERE id = ?').get(adversaireId)
    : null;

  const manches = db.prepare(
    'SELECT compte_id, score, terminee FROM duel_manche WHERE duel_id = ?'
  ).all(duel.id);
  const maManche = manches.find(m => m.compte_id === userId);
  const sonManche = manches.find(m => m.compte_id === adversaireId);

  const jaiFini = Boolean(maManche && maManche.terminee);
  const ilAFini = Boolean(sonManche && sonManche.terminee);

  let resultat = null;
  if (duel.statut === 'termine') {
    if (duel.gagnant_id === null) resultat = 'egalite';
    else resultat = duel.gagnant_id === userId ? 'victoire' : 'defaite';
  }

  return {
    id: duel.id,
    jeu: duel.jeu,
    nomJeu: JEUX_DUEL[duel.jeu] || duel.jeu,
    statut: duel.statut,
    adversaire: adversaire ? adversaire.pseudo : null,
    jeSuisCreateur: duel.joueur1_id === userId,
    monScore: maManche ? maManche.score : null,
    jaiJoue: Boolean(maManche),
    jaiFini,
    scoreAdversaire: (jaiFini || duel.statut === 'termine') && ilAFini ? sonManche.score : null,
    adversaireAFini: ilAFini,
    resultat,
    dateCreation: duel.date_creation,
    dateFin: duel.date_fin
  };
}

module.exports = {
  JEUX_DUEL,
  estJeuDuel,
  lireDuel,
  estParticipant,
  commencerManche,
  enregistrerScore,
  enregistrerPartie,
  cloturerDuelsExpires,
  resumeDuel
};

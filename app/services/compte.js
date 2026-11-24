// ========================================
// SERVICE : COMPTES
// ========================================
// Suppression complète d'un compte et de toutes ses données (F7 administration,
// et plus tard FC3 RGPD : « supprimer mon compte »).

const db = require('../../config');

const supprimerCompte = db.transaction((compteId) => {
  // Duels du joueur : on supprime les duels entiers (l'adversaire n'a plus personne à affronter)
  const duels = db.prepare(
    'SELECT id FROM duel WHERE joueur1_id = ? OR joueur2_id = ?'
  ).all(compteId, compteId);

  const supprimerManches = db.prepare('DELETE FROM duel_manche WHERE duel_id = ?');
  const supprimerDuel = db.prepare('DELETE FROM duel WHERE id = ?');
  for (const duel of duels) {
    supprimerManches.run(duel.id);
    supprimerDuel.run(duel.id);
  }

  db.prepare('DELETE FROM partie WHERE compte_id = ?').run(compteId);
  db.prepare('DELETE FROM points_log WHERE compte_id = ?').run(compteId);
  db.prepare('DELETE FROM flappy_session WHERE compte_id = ?').run(compteId);
  db.prepare('UPDATE quiz_question SET auteur_id = NULL WHERE auteur_id = ?').run(compteId);

  return db.prepare('DELETE FROM compte WHERE id = ?').run(compteId).changes === 1;
});

module.exports = { supprimerCompte };

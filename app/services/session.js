'use strict';

const db = require('../../config');

/**
 * Ouvre la session d'un compte déjà authentifié.
 * Applique la limite de temps de jeu quotidienne (1 h par jour).
 * Renvoie { ok: true, user } ou { ok: false, status, message }.
 */
function ouvrirSession(req, compteId) {
  const row = db.prepare(`
    SELECT id, pseudo, points, classe, cles, banni,
           temps_restant_aujourdhui, derniere_reinit_temps
    FROM compte WHERE id = ?
  `).get(compteId);

  if (!row) return { ok: false, status: 401, message: 'Compte introuvable.' };
  if (row.banni) {
    return { ok: false, status: 403, message: 'Ce compte a été suspendu par un administrateur.' };
  }

  const today = new Date().toISOString().split('T')[0];
  if (row.derniere_reinit_temps !== today) {
    db.prepare(`
      UPDATE compte
      SET temps_restant_aujourdhui = 3600, derniere_reinit_temps = date('now')
      WHERE id = ?
    `).run(row.id);
  } else if (row.temps_restant_aujourdhui <= 0) {
    return {
      ok: false,
      status: 403,
      message: "⏰ Temps de jeu épuisé pour aujourd'hui. Revenez demain !",
    };
  }

  db.prepare(`
    UPDATE compte
    SET code_auth = NULL, code_expiration = NULL, compte_verifie = 1,
        dernier_login = datetime('now', 'localtime')
    WHERE id = ?
  `).run(row.id);

  req.session.user = {
    id: row.id,
    username: row.pseudo,
    pseudo: row.pseudo,
    points: row.points,
    classe: row.classe,
    cles: row.cles ?? 0,
  };
  return { ok: true, user: req.session.user };
}

module.exports = { ouvrirSession };

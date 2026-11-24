const express = require('express');
const router = express.Router();
const db = require('../config');
const INACTIVITY_TIMEOUT_SECONDS = 120;

router.get('/', (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.json({ timeRemaining: 0, expired: true, message: "Non connecté" });
  }

  try {
    const user = db.prepare(`
      SELECT
        temps_restant_aujourdhui,
        derniere_reinit_temps,
        session_debut,
        derniere_activite,
        pseudo
      FROM compte
      WHERE id = ?
    `).get(userId);  // ← derniere_activite ajouté

    if (!user) {
      return res.status(500).json({ error: true, message: "Erreur serveur" });
    }

    const now = new Date();
    const today = now.toLocaleDateString('fr-CA');

    // Nouveau jour → reset
    if (user.derniere_reinit_temps !== today) {
      db.prepare(`
        UPDATE compte
        SET temps_restant_aujourdhui = 3600,
            derniere_reinit_temps = date('now', 'localtime'),
            session_debut = NULL,
            derniere_activite = NULL
        WHERE id = ?
      `).run(userId);

      return res.json({ timeRemaining: 3600, expired: false, message: "Nouveau jour" });
    }

    // Pas de session active → retourne le temps sauvegardé tel quel
    if (!user.session_debut) {
      return res.json({
        timeRemaining: user.temps_restant_aujourdhui,
        expired: user.temps_restant_aujourdhui <= 0,
        message: "Temps disponible"
      });
    }

    // Session active → vérifier l'inactivité en premier
    const sessionStart = new Date(user.session_debut.replace(' ', 'T'));
    const sessionDate = sessionStart.toLocaleDateString('fr-CA');

    // session_debut d'un autre jour → on la nettoie
    if (sessionDate !== today) {
      db.prepare(`UPDATE compte SET session_debut = NULL, derniere_activite = NULL WHERE id = ?`).run(userId);
      return res.json({ timeRemaining: user.temps_restant_aujourdhui, expired: false });
    }

    // Vérification inactivité (heartbeat absent)
    if (user.derniere_activite) {
      const lastActivity = new Date(user.derniere_activite.replace(' ', 'T'));
      const secondsSinceActivity = Math.floor((now - lastActivity) / 1000);

      if (secondsSinceActivity > INACTIVITY_TIMEOUT_SECONDS) {
        // Gèle le temps à la dernière activité connue
        const elapsedUntilInactivity = Math.floor((lastActivity - sessionStart) / 1000);
        const frozenTime = Math.max(0, user.temps_restant_aujourdhui - elapsedUntilInactivity);

        db.prepare(`
          UPDATE compte
          SET temps_restant_aujourdhui = ?,
              session_debut = NULL,
              derniere_activite = NULL
          WHERE id = ?
        `).run(frozenTime, userId);

        return res.json({
          timeRemaining: frozenTime,
          expired: frozenTime <= 0,
          message: frozenTime <= 0 ? "Temps épuisé" : "Temps disponible"
        });
      }
    }

    // Calcul normal
    const elapsedSeconds = Math.floor((now - sessionStart) / 1000);
    const timeRemaining = Math.max(0, user.temps_restant_aujourdhui - elapsedSeconds);

    if (timeRemaining <= 0) {
      db.prepare(`
        UPDATE compte
        SET temps_restant_aujourdhui = 0,
            session_debut = NULL,
            derniere_activite = NULL
        WHERE id = ?
      `).run(userId);
    }

    return res.json({
      timeRemaining,
      expired: timeRemaining <= 0,
      message: timeRemaining <= 0 ? "Temps épuisé" : "Temps disponible"
    });

  } catch (err) {
    console.error("Erreur DB:", err.message);
    return res.status(500).json({ error: true, message: "Erreur serveur" });
  }
});

module.exports = router;
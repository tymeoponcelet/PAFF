const express = require('express');
const router = express.Router();
const db = require('../config');

router.post('/', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "ID utilisateur requis" });
  }

  try {
    const user = db.prepare(`
      SELECT temps_restant_aujourdhui, derniere_reinit_temps, session_debut
      FROM compte WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(500).json({ success: false, message: "Erreur serveur" });
    }

    // ✅ Même format partout : heure locale fr-CA
    const today = new Date().toLocaleDateString('fr-CA');
    const lastReset = user.derniere_reinit_temps;

    // Nouveau jour → reset
    if (lastReset !== today) {
      db.prepare(`
        UPDATE compte
        SET temps_restant_aujourdhui = 3600,
            derniere_reinit_temps = date('now', 'localtime'),
            session_debut = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'),
            derniere_activite = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')
        WHERE id = ?
      `).run(userId);

      return res.json({ success: true, message: "Nouveau jour", timeRemaining: 3600 });
    }

    // Temps épuisé → on ne démarre pas
    if (user.temps_restant_aujourdhui <= 0) {
      return res.json({ success: false, message: "Temps épuisé", timeRemaining: 0 });
    }

    // Session déjà active → rien à faire
    if (user.session_debut) {
      return res.json({
        success: true,
        message: "Session déjà active",
        timeRemaining: user.temps_restant_aujourdhui
      });
    }

    // ✅ Pas de session active → on en démarre une (retour mobile inclus)
    db.prepare(`
      UPDATE compte
      SET session_debut = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'),
          derniere_activite = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')
      WHERE id = ?
    `).run(userId);

    return res.json({
      success: true,
      message: "Session démarrée",
      timeRemaining: user.temps_restant_aujourdhui
    });

  } catch (err) {
    console.error('❌ Erreur:', err);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

module.exports = router;
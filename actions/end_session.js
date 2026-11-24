const express = require('express');
const router = express.Router();
const db = require('../config');

router.post('/', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "ID utilisateur requis"
    });
  }

  try {
    // ✅ Récupération utilisateur
    const user = db.prepare(`
    SELECT temps_restant_aujourdhui, session_debut, pseudo
    FROM compte
    WHERE id = ?
  `).get(userId);

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }

    if (!user.session_debut) {
      return res.json({
        success: true,
        message: "Aucune session active"
      });
    }

    // ✅ Calcul du temps écoulé
    const now = new Date();
    const sessionStartStr = user.session_debut.replace(' ', 'T');
    const sessionStart = new Date(sessionStartStr);

    const elapsedSeconds = Math.floor((now - sessionStart) / 1000);

    const newTimeRemaining = Math.max(
      0,
      user.temps_restant_aujourdhui - elapsedSeconds
    );

    // ✅ Sauvegarde
    db.prepare(`
    UPDATE compte
    SET temps_restant_aujourdhui = ?,
        session_debut = NULL
    WHERE id = ?
  `).run(newTimeRemaining, userId);

    return res.json({
      success: true,
      timeRemaining: newTimeRemaining,
      message: "Session terminée"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la fin de session"
    });
  }
});

module.exports = router;
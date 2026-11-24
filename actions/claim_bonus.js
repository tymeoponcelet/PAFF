const express = require('express');
const router = express.Router();
const db = require('../config');

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


router.post('/', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Vous devez être connecté pour récupérer le bonus."
    });
  }

  //console.log('🎁 Tentative de claim bonus pour userId:', userId);

  // Vérifier si l'utilisateur existe et récupérer son dernier bonus
  try {
    const user = db.prepare(
      "SELECT id, pseudo, points, dernier_bonus FROM compte WHERE id = ?"
    ).get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable."
      });
    }

    const now = new Date();
    const lastBonus = user.dernier_bonus
      ? new Date(user.dernier_bonus)
      : null;

    // ✅ Vérification cooldown 24h
    if (lastBonus) {
      const timeDiff = now - lastBonus;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff < 24) {
        const hoursLeft = Math.ceil(24 - hoursDiff);

        return res.json({
          success: false,
          message: `Bonus déjà récupéré. Revenez dans ${hoursLeft}h.`,
          cooldown: true,
          hoursLeft
        });
      }
    }

    // ✅ Attribution bonus
    const newPoints = user.points + 500;

    db.prepare(
      "UPDATE compte SET points = ?, dernier_bonus = datetime('now') WHERE id = ?"
    ).run(newPoints, userId);

    return res.json({
      success: true,
      message: "🎉 Bonus quotidien récupéré ! +500 points",
      newPoints,
      user: {
        id: user.id,
        pseudo: user.pseudo,
        username: user.pseudo,
        points: newPoints
      }
    });

  } catch (err) {
    console.error("Erreur DB:", err.message);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur : " + err.message
    });
  }
});

module.exports = router;
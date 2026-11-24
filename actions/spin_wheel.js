const express = require('express');
const router = express.Router();
const db = require('../config');

// Configuration des récompenses de la roue (8 cases)
const wheelRewards = [
  { points: 100, color: '#ef4444', label: '100 pts' },
  { points: 500, color: '#f59e0b', label: '500 pts' },
  { points: 250, color: '#10b981', label: '250 pts' },
  { points: 1000, color: '#8b5cf6', label: '1000 pts' },
  { points: 150, color: '#3b82f6', label: '150 pts' },
  { points: 750, color: '#ec4899', label: '750 pts' },
  { points: 300, color: '#14b8a6', label: '300 pts' },
  { points: 2000, color: '#fbbf24', label: '2000 pts' }
];

// ✅ Fonction pour obtenir la date locale du serveur
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
      message: "Vous devez être connecté pour jouer."
    });
  }

  //console.log('🎰 Tentative de spin pour userId:', userId);

  // ✅ MIGRÉ : better-sqlite3 (synchrone)

  try {
    const user = db.prepare(
      `SELECT 
      id, pseudo, points, 
      dernier_spin_roue, 
      jours_weekly_pass, 
      debut_weekly_pass 
    FROM compte 
    WHERE id = ?`
    ).get(userId);

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "Erreur serveur"
      });
    }

    const today = getLocalDate();
    const lastSpin = user.dernier_spin_roue ? user.dernier_spin_roue.substring(0, 10) : null;

    if (lastSpin === today) {
      const now = new Date();
      const hoursUntilMidnight = 24 - now.getHours();
      return res.json({
        success: false,
        message: `Roue déjà utilisée aujourd'hui. Revenez dans ${hoursUntilMidnight}h.`,
        cooldown: true,
        hoursLeft: hoursUntilMidnight
      });
    }

    let currentDay = user.jours_weekly_pass || 0;
    let weekStart = user.debut_weekly_pass;

    if (weekStart) {
      const startDate = new Date(weekStart);
      const nowDate = new Date(today);
      const daysSinceStart = Math.floor((nowDate - startDate) / (1000 * 60 * 60 * 24));

      if (daysSinceStart >= 7) {
        currentDay = 0;
        weekStart = today;
      }
    } else {
      weekStart = today;
      currentDay = 0;
    }

    const randomIndex = Math.floor(Math.random() * wheelRewards.length);
    const reward = wheelRewards[randomIndex];
    const newPoints = user.points + reward.points;
    const newDay = currentDay + 1;

    const now = new Date();
    const localDateTime = `${today} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // ✅ .run() direct sans callback
    db.prepare(
      `UPDATE compte 
    SET points = ?, 
        dernier_spin_roue = ?,
        jours_weekly_pass = ?,
        debut_weekly_pass = ?
    WHERE id = ?`
    ).run(newPoints, localDateTime, newDay, weekStart, userId);

    res.json({
      success: true,
      message: `🎉 Vous avez gagné ${reward.points} points !`,
      reward: reward,
      winIndex: randomIndex,
      newPoints: newPoints,
      dayNumber: newDay,
      daysRemaining: 7 - newDay,
      user: {
        id: user.id,
        pseudo: user.pseudo,
        points: newPoints
      }
    });

  } catch (err) {
    console.error('❌ Erreur:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
});


// Route pour vérifier le statut
router.get('/status', (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.json({ available: false });
  }

  try {
    const user = db.prepare(
      `SELECT 
        dernier_spin_roue, 
        jours_weekly_pass, 
        debut_weekly_pass 
      FROM compte 
      WHERE id = ?`
    ).get(userId);

    if (!user) {
      return res.json({ available: false });
    }

    const today = getLocalDate();
    const lastSpin = user.dernier_spin_roue ? user.dernier_spin_roue.substring(0, 10) : null;

    if (lastSpin === today) {
      const now = new Date();
      const hoursUntilMidnight = 24 - now.getHours();
      return res.json({
        available: false,
        hoursLeft: hoursUntilMidnight,
        dayNumber: user.jours_weekly_pass || 0,
        daysRemaining: 7 - (user.jours_weekly_pass || 0)
      });
    }

    let currentDay = user.jours_weekly_pass || 0;
    if (user.debut_weekly_pass) {
      const startDate = new Date(user.debut_weekly_pass);
      const nowDate = new Date(today);
      const daysSinceStart = Math.floor((nowDate - startDate) / (1000 * 60 * 60 * 24));

      if (daysSinceStart >= 7) {
        currentDay = 0;
      }
    }

    res.json({
      available: true,
      dayNumber: currentDay,
      daysRemaining: 7 - currentDay
    });

  } catch (err) {
    console.error('❌ Erreur:', err);
    return res.json({ available: false });
  }
});

module.exports = router;
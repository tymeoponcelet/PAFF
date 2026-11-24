const express = require('express');
const router = express.Router();
const db = require('../config');

router.get('/', (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.json({
      available: false,
      hoursLeft: 0
    });
  }

  try {
    const user = db.prepare(
      "SELECT dernier_bonus FROM compte WHERE id = ?"
    ).get(userId);

    if (!user) {
      return res.json({ available: false, hoursLeft: 0 });
    }

    const now = new Date();
    const lastBonus = user.dernier_bonus
      ? new Date(user.dernier_bonus)
      : null;

    if (!lastBonus) {
      return res.json({ available: true, hoursLeft: 0 });
    }

    const timeDiff = now - lastBonus;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff >= 24) {
      return res.json({ available: true, hoursLeft: 0 });
    } else {
      const hoursLeft = 24 - hoursDiff;

      return res.json({
        available: false,
        hoursLeft: Math.ceil(hoursLeft),
        minutesLeft: Math.ceil(
          (hoursLeft - Math.floor(hoursLeft)) * 60
        )
      });
    }

  } catch (err) {
    console.error("Erreur DB:", err.message);
    return res.json({ available: false, hoursLeft: 0 });
  }

});

module.exports = router;
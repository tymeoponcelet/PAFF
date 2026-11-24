const express = require('express');
const router = express.Router();
const db = require('../config');

router.post('/', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false });

  try {
    const user = db.prepare(`
      SELECT session_debut, temps_restant_aujourdhui
      FROM compte WHERE id = ?
    `).get(userId);

    if (!user || !user.session_debut) {
      return res.json({ success: true, active: false });
    }

    // Met à jour le timestamp de dernière activité
    db.prepare(`
      UPDATE compte SET derniere_activite = datetime('now', 'localtime')
      WHERE id = ?
    `).run(userId);

    return res.json({ success: true, active: true });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
});

module.exports = router;
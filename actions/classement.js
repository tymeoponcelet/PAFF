const express = require('express');
const router = express.Router();
const db = require('../config');
const { estJeuDuel } = require('../app/services/duel');

// ========================================
// IDs des joueurs bannis du classement
// ========================================
const BANNED_IDS = ['Arkane', 'shari', 'Shyphem', 'Nemesise', '67 uhq ezzzz', 'ethblue'];
// ========================================

router.get('/classe', (req, res) => {
  try {
    let rows = db.prepare(`
      SELECT classe, total_points, moyenne_points, membres
      FROM classement_classe
      ORDER BY total_points DESC
    `).all();

    if (BANNED_IDS.length > 0) {
      const placeholders = BANNED_IDS.map(() => '?').join(',');

      // Récupère les points des bannis depuis la table compte
      const bannedPlayers = db.prepare(`
        SELECT pseudo, points, classe
        FROM compte
        WHERE pseudo IN (${placeholders})
      `).all(BANNED_IDS);

      rows = rows.map(classeRow => {
        const bannisDansClasse = bannedPlayers.filter(p => p.classe === classeRow.classe);
        const pointsARetirer = bannisDansClasse.reduce((sum, p) => sum + p.points, 0);
        const membresARetirer = bannisDansClasse.length;

        const nouveauTotal = classeRow.total_points - pointsARetirer;
        const nouveauxMembres = classeRow.membres - membresARetirer;
        const nouvelleMoyenne = nouveauxMembres > 0 ? nouveauTotal / nouveauxMembres : 0;

        return {
          ...classeRow,
          total_points: nouveauTotal,
          moyenne_points: nouvelleMoyenne,
          membres: nouveauxMembres
        };
      });

      rows.sort((a, b) => b.total_points - a.total_points);
    }

    res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur base de données', details: err.message });
  }
});

router.get('/individuel', (req, res) => {
  try {
    let rows;

    if (BANNED_IDS.length === 0) {
      rows = db.prepare(`
        SELECT pseudo, points, classe, position
        FROM classement_individuel
        ORDER BY position ASC
        LIMIT 100
      `).all();
    } else {
      const placeholders = BANNED_IDS.map(() => '?').join(',');
      rows = db.prepare(`
        SELECT pseudo, points, classe, position
        FROM classement_individuel
        WHERE pseudo NOT IN (${placeholders})
        ORDER BY position ASC
        LIMIT 100
      `).all(BANNED_IDS);
    }

    // Recalcule les positions après exclusion des bannis
    rows = rows.map((row, index) => ({
      ...row,
      position: index + 1
    }));

    return res.json(rows);
  } catch (err) {
    console.error('Erreur:', err.message);
    return res.status(500).json({ error: 'Erreur base de données', details: err.message });
  }
});

// Classement par jeu : meilleur score de chaque joueur sur un jeu à score
router.get('/jeu/:jeu', (req, res) => {
  const { jeu } = req.params;

  if (!estJeuDuel(jeu)) {
    return res.status(404).json({ error: 'Jeu sans classement' });
  }

  try {
    const placeholders = BANNED_IDS.map(() => '?').join(',');
    const exclusion = BANNED_IDS.length > 0 ? `AND pseudo NOT IN (${placeholders})` : '';

    const rows = db.prepare(`
      SELECT pseudo, classe, meilleur_score, parties
      FROM classement_par_jeu
      WHERE jeu = ? ${exclusion}
      ORDER BY meilleur_score DESC, parties ASC
      LIMIT 100
    `).all(jeu, ...BANNED_IDS);

    return res.json(rows.map((row, index) => ({ ...row, position: index + 1 })));
  } catch (err) {
    console.error('Erreur:', err.message);
    return res.status(500).json({ error: 'Erreur base de données', details: err.message });
  }
});

module.exports = router;
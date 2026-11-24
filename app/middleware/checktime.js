// ========================================
// MIDDLEWARE : VÉRIFICATION DU TEMPS
// ========================================

const db = require('../../config');

function checkTimeMiddleware(req, res, next) {
  const userId = req.session?.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Non connecté',
      expired: false
    });
  }

  const user = db.prepare(
    `SELECT temps_restant_aujourdhui, derniere_reinit_temps, session_debut
   FROM compte WHERE id = ?`
  ).get(userId);

  if (!user) {
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      expired: false
    });
  }

  const today = new Date().toISOString().split('T')[0];

  // Nouveau jour = OK
  if (user.derniere_reinit_temps !== today) {
    return next();
  }

  // Calculer le temps restant
  let timeRemaining = user.temps_restant_aujourdhui;

  if (user.session_debut) {
    const now = new Date();
    const sessionStart = new Date(user.session_debut.replace(' ', 'T'));
    const elapsed = Math.floor((now - sessionStart) / 1000);
    timeRemaining = Math.max(0, user.temps_restant_aujourdhui - elapsed);
  }

  // Temps épuisé = BLOQUER
  if (timeRemaining <= 0) {
    return res.status(403).json({
      success: false,
      message: 'Temps de jeu quotidien épuisé',
      expired: true,
      timeRemaining: 0
    });
  }

  // Temps OK = continuer
  next();
}

module.exports = checkTimeMiddleware;
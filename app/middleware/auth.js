// Les administrateurs sont désignés dans .env (ADMIN_EMAILS, séparés par des virgules) :
// personne ne peut se donner ce rôle depuis le site.
function estAdmin(email) {
  if (!email) return false;
  const liste = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return liste.includes(String(email).toLowerCase());
}

// Middleware pour vérifier si l'utilisateur est connecté.
// Relit le compte en base : un compte supprimé ou suspendu est déconnecté aussitôt.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Vous devez être connecté pour jouer."
    });
  }

  const db = require('../../config');
  const compte = db.prepare('SELECT email, banni FROM compte WHERE id = ?').get(req.session.user.id);

  if (!compte || compte.banni) {
    req.session.destroy(() => {});
    return res.status(403).json({
      success: false,
      message: compte ? "Ce compte a été suspendu par un administrateur." : "Compte introuvable."
    });
  }

  req.compte = compte;
  next();
}

// Middleware réservé aux administrateurs (à placer après requireAuth)
function requireAdmin(req, res, next) {
  if (!req.compte || !estAdmin(req.compte.email)) {
    return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
  }
  next();
}

// Middleware pour vérifier les points suffisants
function checkBalance(req, res, next) {
  const { betAmount } = req.body;
  const user = req.session.user;

  if (!betAmount || betAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Mise invalide."
    });
  }

  // Vérifier en temps réel dans la BDD (pas juste la session)
  const db = require('../../config');
  const row = db.prepare(
    "SELECT points FROM compte WHERE id = ?"
  ).get(user.id);

  if (!row) {
    return res.status(500).json({
      success: false,
      message: "Erreur de vérification des points."
    });
  }

  if (row.points < betAmount) {
    return res.status(400).json({
      success: false,
      message: `Points insuffisants. Vous avez ${row.points} pts.`
    });
  }

  // Mettre à jour la session avec les points réels
  req.session.user.points = row.points;
  next();
}

module.exports = { requireAuth, requireAdmin, estAdmin, checkBalance };

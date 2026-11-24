const express = require('express');
const router = express.Router();
const db = require('../config');
const securite = require('../app/services/securite');
const { ouvrirSession } = require('../app/services/session');

// POST /actions/login
// Connexion par adresse mail de l'école + mot de passe (F1).
router.post('/', (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body.password;

  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({ success: false, message: 'Email et mot de passe requis.' });
  }
  if (!securite.EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Email invalide. Format : nom.p@lyceedelasalle.fr',
    });
  }
  const cle = 'login:' + email;
  if (securite.estBloque(cle)) {
    return res.status(429).json({ success: false, message: securite.MESSAGE_BLOCAGE });
  }

  try {
    const row = db.prepare(
      'SELECT id, pseudo, mot_de_passe, compte_verifie FROM compte WHERE LOWER(email) = ?'
    ).get(email);

    // Compte créé avant le passage au mot de passe
    if (row && row.compte_verifie === 1 && !row.mot_de_passe) {
      return res.status(401).json({
        success: false,
        message: 'Ce compte n\'a pas encore de mot de passe. Cliquez sur « Mot de passe oublié » pour en créer un.',
      });
    }

    if (!row || !securite.verifierMotDePasse(password, row.mot_de_passe)) {
      securite.noterEchec(cle);
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
    }

    if (row.compte_verifie === 0) {
      return res.status(401).json({
        success: false,
        message: 'Compte non vérifié : saisissez le code reçu par mail lors de l\'inscription.',
        requiresVerification: true,
      });
    }

    securite.effacerEchecs(cle);
    const session = ouvrirSession(req, row.id);
    if (!session.ok) {
      return res.status(session.status).json({ success: false, message: session.message });
    }
    return res.json({
      success: true,
      message: `Connexion réussie. Bienvenue ${row.pseudo}.`,
      user: session.user,
    });
  } catch (err) {
    console.error('❌ [CONNEXION]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;

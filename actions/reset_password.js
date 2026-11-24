const express = require('express');
const router = express.Router();
const db = require('../config');
const securite = require('../app/services/securite');
const { ouvrirSession } = require('../app/services/session');

// POST /actions/reset_password
// Choix d'un nouveau mot de passe grâce au code reçu par mail.
router.post('/', (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
  const password = req.body.password;

  if (!securite.EMAIL_REGEX.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: 'Email ou code invalide.' });
  }
  const erreurMdp = securite.validerMotDePasse(password);
  if (erreurMdp) {
    return res.status(400).json({ success: false, message: erreurMdp });
  }
  const cle = 'code:' + email;
  if (securite.estBloque(cle)) {
    return res.status(429).json({ success: false, message: securite.MESSAGE_BLOCAGE });
  }

  try {
    const row = db.prepare(
      'SELECT id, pseudo, code_auth, code_expiration FROM compte WHERE LOWER(email) = ? AND compte_verifie = 1'
    ).get(email);

    if (!row || !securite.codesEgaux(row.code_auth || '', code)) {
      securite.noterEchec(cle);
      return res.status(401).json({ success: false, message: 'Code incorrect.' });
    }
    if (securite.codeExpire(row.code_expiration)) {
      return res.status(401).json({
        success: false,
        message: 'Le code a expiré. Veuillez en demander un nouveau.',
      });
    }

    db.prepare('UPDATE compte SET mot_de_passe = ? WHERE id = ?')
      .run(securite.hacherMotDePasse(password), row.id);
    securite.effacerEchecs(cle);
    securite.effacerEchecs('login:' + email);

    const session = ouvrirSession(req, row.id);
    if (!session.ok) {
      // Mot de passe bien changé, mais temps de jeu épuisé pour aujourd'hui
      return res.status(session.status).json({
        success: false,
        message: 'Mot de passe modifié. ' + session.message,
      });
    }
    return res.json({
      success: true,
      message: `Mot de passe modifié. Bienvenue ${row.pseudo}.`,
      user: session.user,
    });
  } catch (err) {
    console.error('❌ [REINITIALISATION]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;

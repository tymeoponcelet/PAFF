const express = require('express');
const router = express.Router();
const db = require('../config');
const securite = require('../app/services/securite');
const { ouvrirSession } = require('../app/services/session');

// POST /actions/verify_account
// Valide l'inscription avec le code reçu par mail, puis connecte le joueur.
router.post('/', (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';

  if (!securite.EMAIL_REGEX.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: 'Email ou code invalide.' });
  }
  const cle = 'code:' + email;
  if (securite.estBloque(cle)) {
    return res.status(429).json({ success: false, message: securite.MESSAGE_BLOCAGE });
  }

  try {
    const row = db.prepare(
      'SELECT id, pseudo, code_auth, code_expiration FROM compte WHERE LOWER(email) = ? AND compte_verifie = 0'
    ).get(email);

    if (!row || !securite.codesEgaux(row.code_auth || '', code)) {
      securite.noterEchec(cle);
      return res.status(401).json({ success: false, message: 'Code incorrect.' });
    }
    if (securite.codeExpire(row.code_expiration)) {
      db.prepare('DELETE FROM compte WHERE id = ? AND compte_verifie = 0').run(row.id);
      return res.status(401).json({
        success: false,
        message: 'Le code a expiré. Veuillez vous réinscrire.',
      });
    }

    securite.effacerEchecs(cle);
    const session = ouvrirSession(req, row.id);
    if (!session.ok) {
      return res.status(session.status).json({ success: false, message: session.message });
    }
    return res.json({
      success: true,
      message: `Compte vérifié avec succès ! Bienvenue ${row.pseudo}.`,
      user: session.user,
    });
  } catch (err) {
    console.error('❌ [VERIFICATION]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../config');
const securite = require('../app/services/securite');
const { envoyerCode } = require('../app/services/mailer');

// POST /actions/request_code
// « Mot de passe oublié » : envoie un code à 6 chiffres valable 10 minutes.
// La réponse est la même que le compte existe ou non, pour ne pas révéler
// quelles adresses sont inscrites.
router.post('/', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!securite.EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Email invalide. Format : nom.p@lyceedelasalle.fr',
    });
  }
  const cle = 'envoi:' + email;
  if (securite.estBloque(cle)) {
    return res.status(429).json({ success: false, message: securite.MESSAGE_BLOCAGE });
  }
  securite.noterEchec(cle);

  try {
    const code = securite.genererCode();
    const result = db.prepare(
      'UPDATE compte SET code_auth = ?, code_expiration = ? WHERE LOWER(email) = ? AND compte_verifie = 1'
    ).run(code, securite.expirationDans(10), email);

    if (result.changes > 0) {
      await envoyerCode(email, code, 'reinitialisation');
    }
    return res.json({
      success: true,
      message: 'Si un compte existe pour cette adresse, un code vient d\'être envoyé.',
    });
  } catch (err) {
    console.error('❌ [CODE]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi du code.' });
  }
});

module.exports = router;

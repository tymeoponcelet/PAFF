'use strict';

// Envoi des mails de la plateforme.
// Sans EMAIL_USER / EMAIL_PASS dans .env (poste de développement), le mail
// n'est pas envoyé : le code est affiché dans la console du serveur.
const nodemailer = require('nodemailer');

const NOM_SITE = 'P.A.F.F.';
const mailConfigure = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

let transporteur = null;
function getTransporteur() {
  if (!transporteur) {
    transporteur = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporteur;
}

function gabarit(titre, intro, code) {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
    <h2 style="color: #333;">${titre}</h2>
    <p>${intro}</p>
    <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #333; padding: 20px; background: #f5f5f5; border-radius: 8px;">
      ${code}
    </div>
    <p style="color: #888; font-size: 13px;">Ce code expire dans <strong>10 minutes</strong>.</p>
    <p style="color: #aaa; font-size: 12px;">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
    <p style="color: #aaa; font-size: 12px;">${NOM_SITE} (Play Arena For Fun) – Pôle Sup De La Salle</p>
  </div>`;
}

/**
 * Envoie un code à 6 chiffres.
 * @param {'inscription'|'reinitialisation'} type
 */
async function envoyerCode(email, code, type) {
  const estInscription = type === 'inscription';
  const sujet = estInscription
    ? `Confirmez votre inscription à ${NOM_SITE}`
    : `Réinitialisation de votre mot de passe ${NOM_SITE}`;
  const intro = estInscription
    ? 'Votre code de vérification est :'
    : 'Votre code pour choisir un nouveau mot de passe est :';

  if (!mailConfigure) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("L'envoi de mails n'est pas configuré (EMAIL_USER / EMAIL_PASS).");
    }
    console.log(`📧 [MODE DEV] Mail non envoyé. Code ${type} pour ${email} : ${code}`);
    return;
  }

  await getTransporteur().sendMail({
    from: `"${NOM_SITE}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: sujet,
    text: `${intro} ${code}\n\nCe code expire dans 10 minutes.`,
    html: gabarit(sujet, intro, code),
  });
}

module.exports = { envoyerCode, mailConfigure };

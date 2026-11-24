const express = require("express");
const router = express.Router();
const db = require("../config");
const securite = require("../app/services/securite");
const { envoyerCode } = require("../app/services/mailer");

const CLASSES = [
  "ASS1", "ASS2", "CG1", "CG2", "MCO1", "MCO2", "SIO1", "SIO2", "DCG1", "DCG2",
  "DCG3", "PECT1", "PECT2", "NDRC1", "NDRC2", "BSI", "MSI1", "MSI2",
];

// POST /actions/create_account
// Inscription : pseudo + adresse mail de l'école + classe + mot de passe (F1).
// Le compte reste inactif tant que le code reçu par mail n'a pas été saisi.
router.post("/", async (req, res) => {
  const { pseudo: rawPseudo, email: rawEmail, classe, password, accepteConditions } = req.body;
  const pseudo = typeof rawPseudo === "string" ? rawPseudo.trim() : "";
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!pseudo || !email || !classe || !password) {
    return res.status(400).json({ success: false, message: "Tous les champs sont obligatoires." });
  }
  if (pseudo.length < 3 || pseudo.length > 15) {
    return res.status(400).json({ success: false, message: "Le pseudo doit contenir entre 3 et 15 caractères." });
  }
  if (!securite.EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Email invalide. Format attendu : nom.p@lyceedelasalle.fr",
    });
  }
  if (!CLASSES.includes(classe)) {
    return res.status(400).json({ success: false, message: "Classe inconnue." });
  }
  const erreurMdp = securite.validerMotDePasse(password);
  if (erreurMdp) {
    return res.status(400).json({ success: false, message: erreurMdp });
  }
  if (accepteConditions !== true) {
    return res.status(400).json({
      success: false,
      message: "Vous devez accepter les conditions d'utilisation et la charte de bonne conduite.",
    });
  }
  if (securite.estBloque("envoi:" + email)) {
    return res.status(429).json({ success: false, message: securite.MESSAGE_BLOCAGE });
  }

  let accountId = null;
  try {
    // Libère les pseudos / mails des inscriptions jamais confirmées
    db.prepare(
      "DELETE FROM compte WHERE compte_verifie = 0 AND (code_expiration IS NULL OR code_expiration < ?)"
    ).run(securite.expirationDans(0));

    const existant = db
      .prepare("SELECT id FROM compte WHERE LOWER(pseudo) = LOWER(?) OR LOWER(email) = ?")
      .get(pseudo, email);
    if (existant) {
      return res.status(400).json({ success: false, message: "Pseudo ou email déjà utilisé." });
    }

    const code = securite.genererCode();
    const result = db.prepare(`
      INSERT INTO compte (
        pseudo, email, mot_de_passe, points, classe,
        date_creation, dernier_login,
        temps_restant_aujourdhui, derniere_reinit_temps,
        code_auth, code_expiration, compte_verifie
      ) VALUES (?, ?, ?, 5000, ?, datetime('now'), datetime('now'), 3600, date('now'), ?, ?, 0)
    `).run(pseudo, email, securite.hacherMotDePasse(password), classe, code, securite.expirationDans(10));
    accountId = result.lastInsertRowid;

    securite.noterEchec("envoi:" + email);
    await envoyerCode(email, code, "inscription");

    return res.json({
      success: true,
      message: "Un code de vérification a été envoyé à votre email. Vous avez 10 minutes pour le valider.",
      id: accountId,
      requiresVerification: true,
    });
  } catch (err) {
    // Si le mail n'a pas pu partir, on ne garde pas un compte impossible à valider
    if (accountId) {
      try { db.prepare("DELETE FROM compte WHERE id = ? AND compte_verifie = 0").run(accountId); } catch (_) {}
    }
    console.error("❌ [INSCRIPTION]", err.message);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la création du compte. Réessayez plus tard.",
    });
  }
});

module.exports = router;

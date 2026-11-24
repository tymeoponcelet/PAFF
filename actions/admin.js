// ========================================
// ROUTES : ADMINISTRATION (F7)
// ========================================
// Monté sur /api/admin. Réservé aux comptes listés dans ADMIN_EMAILS (.env).
// - comptes : chercher, renommer un pseudo (modération), suspendre / réactiver, supprimer
// - quiz : lister, ajouter, modifier, activer / désactiver, supprimer des questions

const express = require('express');
const router = express.Router();
const db = require('../config');
const { requireAuth, requireAdmin, estAdmin } = require('../app/middleware/auth');
const { supprimerCompte } = require('../app/services/compte');

router.use(requireAuth, requireAdmin);

// ── Tableau de bord ───────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const compter = (sql) => db.prepare(sql).get().nb;
  res.json({
    success: true,
    stats: {
      comptes: compter('SELECT COUNT(*) AS nb FROM compte WHERE compte_verifie = 1'),
      suspendus: compter('SELECT COUNT(*) AS nb FROM compte WHERE banni = 1'),
      partiesAujourdhui: compter("SELECT COUNT(*) AS nb FROM partie WHERE date(date_partie) = date('now')"),
      duelsTermines: compter("SELECT COUNT(*) AS nb FROM duel WHERE statut = 'termine'"),
      questionsActives: compter('SELECT COUNT(*) AS nb FROM quiz_question WHERE active = 1')
    }
  });
});

// ========================================
// COMPTES
// ========================================

function lireCompteCible(req, res) {
  const id = parseInt(req.params.id, 10);
  const compte = Number.isInteger(id)
    ? db.prepare('SELECT id, pseudo, email FROM compte WHERE id = ?').get(id)
    : null;
  if (!compte) {
    res.status(404).json({ success: false, message: 'Compte introuvable' });
    return null;
  }
  return compte;
}

// GET /api/admin/comptes?recherche=...
router.get('/comptes', (req, res) => {
  const recherche = String(req.query.recherche || '').trim();
  const motif = `%${recherche}%`;

  const comptes = db.prepare(`
    SELECT id, pseudo, email, classe, points, compte_verifie, banni, date_creation, dernier_login
    FROM compte
    WHERE pseudo LIKE ? OR email LIKE ? OR classe LIKE ?
    ORDER BY date_creation DESC
    LIMIT 100
  `).all(motif, motif, motif);

  res.json({
    success: true,
    comptes: comptes.map(c => ({ ...c, admin: estAdmin(c.email) })),
    monId: req.session.user.id
  });
});

// POST /api/admin/comptes/:id/pseudo  { pseudo }
router.post('/comptes/:id/pseudo', (req, res) => {
  const compte = lireCompteCible(req, res);
  if (!compte) return;

  const pseudo = typeof req.body.pseudo === 'string' ? req.body.pseudo.trim() : '';
  if (pseudo.length < 3 || pseudo.length > 15) {
    return res.status(400).json({ success: false, message: 'Le pseudo doit contenir entre 3 et 15 caractères.' });
  }

  const pris = db.prepare('SELECT id FROM compte WHERE LOWER(pseudo) = LOWER(?) AND id != ?')
    .get(pseudo, compte.id);
  if (pris) {
    return res.status(400).json({ success: false, message: 'Ce pseudo est déjà utilisé.' });
  }

  db.prepare('UPDATE compte SET pseudo = ? WHERE id = ?').run(pseudo, compte.id);
  console.log(`🛡️ [ADMIN] ${req.session.user.pseudo} renomme « ${compte.pseudo} » en « ${pseudo} »`);
  res.json({ success: true, message: `Pseudo modifié : ${compte.pseudo} → ${pseudo}` });
});

// POST /api/admin/comptes/:id/suspendre  { suspendu: true|false }
router.post('/comptes/:id/suspendre', (req, res) => {
  const compte = lireCompteCible(req, res);
  if (!compte) return;

  if (compte.id === req.session.user.id) {
    return res.status(400).json({ success: false, message: 'Vous ne pouvez pas suspendre votre propre compte.' });
  }

  const suspendu = req.body.suspendu === true;
  db.prepare('UPDATE compte SET banni = ? WHERE id = ?').run(suspendu ? 1 : 0, compte.id);
  console.log(`🛡️ [ADMIN] ${req.session.user.pseudo} ${suspendu ? 'suspend' : 'réactive'} « ${compte.pseudo} »`);
  res.json({
    success: true,
    message: suspendu ? `${compte.pseudo} est suspendu.` : `${compte.pseudo} est réactivé.`
  });
});

// DELETE /api/admin/comptes/:id
router.delete('/comptes/:id', (req, res) => {
  const compte = lireCompteCible(req, res);
  if (!compte) return;

  if (compte.id === req.session.user.id) {
    return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte ici.' });
  }

  supprimerCompte(compte.id);
  console.log(`🛡️ [ADMIN] ${req.session.user.pseudo} supprime le compte « ${compte.pseudo} »`);
  res.json({ success: true, message: `Compte ${compte.pseudo} supprimé.` });
});

// ========================================
// QUESTIONS DE QUIZ
// ========================================

// Vérifie et nettoie une question envoyée par le formulaire
function lireQuestionFormulaire(body) {
  const texte = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  const q = {
    theme: texte(body.theme, 50),
    question: texte(body.question, 300),
    choix: [0, 1, 2, 3].map(i => texte(Array.isArray(body.choix) ? body.choix[i] : '', 150)),
    bonne: parseInt(body.bonne, 10),
    explication: texte(body.explication, 300) || null
  };

  if (!q.theme) return { erreur: 'Le thème est obligatoire.' };
  if (!q.question) return { erreur: 'La question est obligatoire.' };
  if (q.choix.some(c => !c)) return { erreur: 'Les 4 réponses sont obligatoires.' };
  if (new Set(q.choix.map(c => c.toLowerCase())).size < 4) return { erreur: 'Les 4 réponses doivent être différentes.' };
  if (![1, 2, 3, 4].includes(q.bonne)) return { erreur: 'Indiquez la bonne réponse.' };
  return { q };
}

router.get('/questions', (req, res) => {
  const questions = db.prepare(`
    SELECT id, theme, question, choix1, choix2, choix3, choix4, bonne_reponse, explication, active
    FROM quiz_question ORDER BY theme, id
  `).all();
  res.json({ success: true, questions });
});

router.post('/questions', (req, res) => {
  const { q, erreur } = lireQuestionFormulaire(req.body);
  if (erreur) return res.status(400).json({ success: false, message: erreur });

  const r = db.prepare(`
    INSERT INTO quiz_question (theme, question, choix1, choix2, choix3, choix4, bonne_reponse, explication, auteur_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(q.theme, q.question, ...q.choix, q.bonne, q.explication, req.session.user.id);

  res.json({ success: true, message: 'Question ajoutée.', id: r.lastInsertRowid });
});

router.put('/questions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { q, erreur } = lireQuestionFormulaire(req.body);
  if (erreur) return res.status(400).json({ success: false, message: erreur });

  const r = db.prepare(`
    UPDATE quiz_question
    SET theme = ?, question = ?, choix1 = ?, choix2 = ?, choix3 = ?, choix4 = ?, bonne_reponse = ?, explication = ?
    WHERE id = ?
  `).run(q.theme, q.question, ...q.choix, q.bonne, q.explication, id);

  if (r.changes === 0) return res.status(404).json({ success: false, message: 'Question introuvable' });
  res.json({ success: true, message: 'Question modifiée.' });
});

// POST /api/admin/questions/:id/active  { active: true|false }
router.post('/questions/:id/active', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const active = req.body.active === true;
  const r = db.prepare('UPDATE quiz_question SET active = ? WHERE id = ?').run(active ? 1 : 0, id);

  if (r.changes === 0) return res.status(404).json({ success: false, message: 'Question introuvable' });
  res.json({ success: true, message: active ? 'Question activée.' : 'Question désactivée.' });
});

router.delete('/questions/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = db.prepare('DELETE FROM quiz_question WHERE id = ?').run(id);

  if (r.changes === 0) return res.status(404).json({ success: false, message: 'Question introuvable' });
  res.json({ success: true, message: 'Question supprimée.' });
});

module.exports = router;

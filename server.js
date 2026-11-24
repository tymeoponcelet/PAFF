require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const db = require('./config');
const { estAdmin } = require('./app/middleware/auth');

const createAccount = require('./actions/create_account');
const login = require('./actions/login');
const requestCode = require('./actions/request_code');
const claimBonus = require('./actions/claim_bonus');
const checkBonusStatus = require('./actions/check_bonus_status');
const classement = require('./actions/classement');
const checkSessionTime = require('./actions/check_session_time');
const startSession = require('./actions/start_session');
const endSession = require('./actions/end_session');
const spinWheel = require('./actions/spin_wheel');
const openChest = require('./actions/open_chest');

const PRODUCTION = process.env.NODE_ENV === 'production';

// Secret de session : obligatoire en production, généré à la volée en développement
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (PRODUCTION) {
    console.error('❌ SESSION_SECRET est absent du fichier .env : arrêt du serveur.');
    process.exit(1);
  }
  sessionSecret = require('crypto').randomBytes(32).toString('hex');
  console.warn('⚠️ SESSION_SECRET absent : secret temporaire généré (les sessions sont perdues au redémarrage).');
}

const app = express();

// Derrière le proxy HTTPS de l'hébergeur
if (PRODUCTION) app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sessions
app.use(session({
  name: 'paff.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 3600000,
    httpOnly: true,
    sameSite: 'lax',
    secure: PRODUCTION
  }
}));

// Fichiers statiques
app.use('/static', express.static(path.join(__dirname, 'static')));

// ========================================
// 🔥 ROUTES API (AVANT LE 404)
// ========================================
app.use('/actions/check_bonus_status', checkBonusStatus);
app.use('/actions/claim_bonus', claimBonus);
app.use('/actions/create_account', createAccount);
app.use('/actions/login', login);
app.use('/actions/request_code', requestCode);
app.use('/actions/verify_account', require('./actions/verify_account'));
app.use('/actions/reset_password', require('./actions/reset_password'));
app.use('/api/classement', classement);
app.use('/actions/blackjack', require('./app/jeux/blackjack'));
app.use('/actions/flappy', require('./app/jeux/flappy'));
app.use('/actions/crash', require('./app/jeux/crash'));
app.use('/actions/check_session_time', checkSessionTime);
app.use('/actions/start_session', startSession);
app.use('/actions/end_session', endSession);
app.use('/actions/spin_wheel', spinWheel);
app.use('/actions/open_chest', openChest);
app.use('/actions/puissance4', require('./app/jeux/puissance4'));
app.use('/actions/whackmole', require('./app/jeux/tape-taupe'));
app.use('/actions/mastermind', require('./app/jeux/mastermind'));
app.use('/actions/demineur', require ('./app/jeux/demineur'));
app.use('/actions/plinko', require('./app/jeux/plinko'));
app.use('/actions/hi-low', require('./app/jeux/hi-low'));
app.use('/actions/scratch', require('./app/jeux/scratch'))

app.use('/actions/duel', require('./actions/duel'));
app.use('/actions/quiz', require('./app/jeux/quiz'));
app.use('/api/admin', require('./actions/admin'));

app.use('/actions/heartbeat', require('./actions/heartbeat'));
app.use('/actions/roulette', require('./app/jeux/roulette'));





// ROUTE DE VÉRIFICATION DE SESSION
app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    const userId = req.session.user.id;

    try {
      const stmt = db.prepare(
        'SELECT id, pseudo, email, points, classe, cles, banni FROM compte WHERE id = ?'
      );

      const user = stmt.get(userId);

      // Compte supprimé ou suspendu : on ferme la session
      if (!user || user.banni) {
        req.session.destroy(() => {});
        return res.json({ logged: false, suspendu: Boolean(user && user.banni) });
      }

      // Mise à jour session
      req.session.user.points = user.points;
      if (user.cles != null) {
        req.session.user.cles = user.cles;
      }

      return res.json({
        logged: true,
        user: {
          id: user.id,
          username: user.pseudo,
          pseudo: user.pseudo,
          points: user.points,
          classe: user.classe,
          cles: user.cles != null ? user.cles : 0,
          admin: estAdmin(user.email)
        }
      });

    } catch (err) {
      console.error("Erreur DB:", err);
      return res.json({ logged: false });
    }

  } else {
    res.json({ logged: false });
  }
});

// ========================================
// 📄 ROUTES DE PAGES
// ========================================
// Les gabarits (modales, pages légales…) sont servis par /static/templates.
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Page d'administration : réservée aux comptes listés dans ADMIN_EMAILS.
// (Les routes /api/admin sont protégées de la même façon : la page seule ne donne aucun droit.)
app.get('/admin.html', (req, res) => {
  const compte = req.session && req.session.user
    ? db.prepare('SELECT email, banni FROM compte WHERE id = ?').get(req.session.user.id)
    : null;

  if (!compte || compte.banni || !estAdmin(compte.email)) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur lors de la déconnexion');
    }
    res.redirect('/login.html');
  });
});

// ========================================
// 404
// ========================================
app.use((req, res) => {
  res.status(404).send('Page non trouvée');
});

// ========================================
// ⏱️ JOB : GELER LES SESSIONS INACTIVES
// ========================================
const INACTIVITY_TIMEOUT_SECONDS = 90;

function gelerSessionsInactives() {
  const now = new Date();

  const sessions = db.prepare(`
    SELECT id, temps_restant_aujourdhui, session_debut, derniere_activite
    FROM compte
    WHERE session_debut IS NOT NULL
  `).all();

  for (const user of sessions) {
    if (!user.derniere_activite) continue;

    const lastActivity = new Date(user.derniere_activite.replace(' ', 'T'));
    const secondsSinceActivity = Math.floor((now - lastActivity) / 1000);

    if (secondsSinceActivity > INACTIVITY_TIMEOUT_SECONDS) {
      const sessionStart = new Date(user.session_debut.replace(' ', 'T'));
      const elapsedUntilInactivity = Math.floor((lastActivity - sessionStart) / 1000);
      const frozenTime = Math.max(0, user.temps_restant_aujourdhui - elapsedUntilInactivity);

      db.prepare(`
        UPDATE compte
        SET temps_restant_aujourdhui = ?,
            session_debut = NULL,
            derniere_activite = NULL
        WHERE id = ?
      `).run(frozenTime, user.id);

      console.log(`⏸️ Session gelée : user ${user.id} → ${frozenTime}s restants`);
    }
  }
}

setInterval(gelerSessionsInactives, 60_000);

// ========================================
// DÉMARRAGE SERVEUR
// ========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
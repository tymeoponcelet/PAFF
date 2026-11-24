const Database = require('better-sqlite3');
const path = require('path');

// Connexion (synchrone)
// DB_PATH (dans .env) doit pointer vers un emplacement persistant chez l'hébergeur.
// Ne jamais utiliser /tmp : le dossier est vidé à chaque redémarrage.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.db');

const db = new Database(dbPath);

console.log('Connecté à la base de données SQLite (better-sqlite3)');

// Création des tables et vues
try {
  db.exec(`
  CREATE TABLE IF NOT EXISTS compte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    points INTEGER DEFAULT 0,
    dernier_bonus DATETIME DEFAULT NULL,
    classe TEXT NOT NULL,
    code_expiration TEXT,
    compte_verifie INTEGER DEFAULT 0,
    code_auth TEXT,
    date_creation TEXT DEFAULT (datetime('now')),
    dernier_login TEXT DEFAULT (datetime('now')),
    temps_restant_aujourdhui INTEGER DEFAULT 3600,
    derniere_reinit_temps DATE DEFAULT (date('now')),
    session_debut DATETIME DEFAULT NULL,
    dernier_spin_roue DATETIME DEFAULT NULL,
    jours_weekly_pass INTEGER DEFAULT 1,
    debut_weekly_pass DATE DEFAULT NULL,
    flappy_best_score INTEGER DEFAULT 0,
    cles INTEGER DEFAULT 0,
    derniere_activite TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS points_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compte_id INTEGER NOT NULL,
    variation INTEGER NOT NULL,
    raison VARCHAR,
    date_action DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (compte_id) REFERENCES compte(id)
  );

  -- Partie Flappy en cours (une par joueur) : sert à vérifier la durée de la partie
  CREATE TABLE IF NOT EXISTS flappy_session (
    compte_id INTEGER PRIMARY KEY,
    token TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    duel_id INTEGER DEFAULT NULL,
    FOREIGN KEY (compte_id) REFERENCES compte(id)
  );

  -- Historique des parties à score (sert au classement par jeu)
  CREATE TABLE IF NOT EXISTS partie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compte_id INTEGER NOT NULL,
    jeu TEXT NOT NULL,
    score INTEGER NOT NULL,
    duel_id INTEGER DEFAULT NULL,
    date_partie TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (compte_id) REFERENCES compte(id)
  );

  -- Duel 1 contre 1 au score. joueur2_id NULL = en attente d'un adversaire (file d'attente).
  -- statut : en_attente, en_cours, termine, refuse, annule, expire
  CREATE TABLE IF NOT EXISTS duel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jeu TEXT NOT NULL,
    joueur1_id INTEGER NOT NULL,
    joueur2_id INTEGER DEFAULT NULL,
    statut TEXT NOT NULL DEFAULT 'en_attente',
    gagnant_id INTEGER DEFAULT NULL,
    date_creation TEXT DEFAULT (datetime('now')),
    date_debut TEXT DEFAULT NULL,
    date_fin TEXT DEFAULT NULL,
    FOREIGN KEY (joueur1_id) REFERENCES compte(id),
    FOREIGN KEY (joueur2_id) REFERENCES compte(id)
  );

  -- La partie jouée par chaque joueur dans un duel (une seule par joueur : clé primaire double)
  CREATE TABLE IF NOT EXISTS duel_manche (
    duel_id INTEGER NOT NULL,
    compte_id INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    terminee INTEGER NOT NULL DEFAULT 0,
    date_debut TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (duel_id, compte_id),
    FOREIGN KEY (duel_id) REFERENCES duel(id),
    FOREIGN KEY (compte_id) REFERENCES compte(id)
  );

  -- Questions des quiz éducatifs (F4), gérées depuis l'administration (F7)
  -- bonne_reponse : numéro du bon choix (1 à 4)
  CREATE TABLE IF NOT EXISTS quiz_question (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    theme TEXT NOT NULL,
    question TEXT NOT NULL,
    choix1 TEXT NOT NULL,
    choix2 TEXT NOT NULL,
    choix3 TEXT NOT NULL,
    choix4 TEXT NOT NULL,
    bonne_reponse INTEGER NOT NULL CHECK (bonne_reponse BETWEEN 1 AND 4),
    explication TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    auteur_id INTEGER DEFAULT NULL,
    date_creation TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_compte_classe ON compte(classe);
  CREATE INDEX IF NOT EXISTS idx_pointslog_compteid ON points_log(compte_id);
  CREATE INDEX IF NOT EXISTS idx_partie_jeu ON partie(jeu, compte_id);
  CREATE INDEX IF NOT EXISTS idx_duel_statut ON duel(statut, jeu);
  CREATE INDEX IF NOT EXISTS idx_quiz_theme ON quiz_question(theme, active);
  `);
} catch (err) {
  console.error("Erreur SQL (tables):", err.message);
}

// Migrations : colonnes ajoutées après la création initiale d'une table
// (les bases existantes ne repassent pas par le CREATE TABLE).
// Elles passent AVANT les vues, qui peuvent utiliser ces colonnes.
const migrations = [
  ['compte', 'cles INTEGER DEFAULT 0'],
  ['compte', 'mot_de_passe TEXT'],
  ['compte', 'banni INTEGER NOT NULL DEFAULT 0'],          // compte suspendu par un admin
  ['flappy_session', 'duel_id INTEGER DEFAULT NULL'],
  ['duel', 'donnees TEXT DEFAULT NULL']                    // ex. questions communes d'un duel de quiz
];
for (const [table, colonne] of migrations) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colonne}`);
  } catch (err) {
    if (!err.message.includes('duplicate')) {
      console.error(`Migration ${table}:`, err.message);
    }
  }
}

// Vues (recréées à chaque démarrage). Les comptes suspendus n'apparaissent pas dans les classements.
try {
  db.exec(`
  DROP VIEW IF EXISTS classement_par_jeu;
  CREATE VIEW classement_par_jeu AS
  SELECT
    p.jeu,
    c.pseudo,
    c.classe,
    MAX(p.score) AS meilleur_score,
    COUNT(*)     AS parties
  FROM partie p
  JOIN compte c ON c.id = p.compte_id
  WHERE c.banni = 0
  GROUP BY p.jeu, p.compte_id;

  DROP VIEW IF EXISTS compte_secure;
  CREATE VIEW compte_secure AS
  SELECT id, pseudo, email, points, dernier_bonus, classe, code_auth, date_creation, dernier_login
  FROM compte;

  DROP VIEW IF EXISTS classement_classe;
  CREATE VIEW classement_classe AS
  SELECT
    classe,
    SUM(points)           AS total_points,
    ROUND(AVG(points), 2) AS moyenne_points,
    COUNT(*)              AS membres
  FROM compte
  WHERE banni = 0 AND compte_verifie = 1
  GROUP BY classe
  ORDER BY total_points DESC;

  DROP VIEW IF EXISTS classement_individuel;
  CREATE VIEW classement_individuel AS
  SELECT
    pseudo,
    points,
    classe,
    ROW_NUMBER() OVER (ORDER BY points DESC, id ASC) AS position
  FROM compte
  WHERE banni = 0 AND compte_verifie = 1
  ORDER BY points DESC;
  `);

  console.log("Tables et vues créées avec succès");
} catch (err) {
  console.error("Erreur SQL (vues):", err.message);
}

// Questions de quiz de départ, ajoutées seulement si la table est vide
try {
  const { nb } = db.prepare('SELECT COUNT(*) AS nb FROM quiz_question').get();
  if (nb === 0) {
    const ajouter = db.prepare(`
      INSERT INTO quiz_question (theme, question, choix1, choix2, choix3, choix4, bonne_reponse, explication)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const questions = require('./app/services/quiz-questions-defaut');
    db.transaction(() => {
      for (const q of questions) {
        ajouter.run(q.theme, q.question, ...q.choix, q.bonne, q.explication || null);
      }
    })();
    console.log(`${questions.length} questions de quiz ajoutées`);
  }
} catch (err) {
  console.error('Erreur questions de quiz:', err.message);
}

module.exports = db;
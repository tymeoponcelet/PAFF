# CLAUDE.md – Contexte du projet P.A.F.F.

Ce fichier est lu automatiquement par Claude Code au démarrage. Il donne le contexte
nécessaire pour reprendre le projet sans tout relire. **Tenir la section « État d'avancement »
à jour à la fin de chaque session de travail.**

## Le projet en bref

- **P.A.F.F. (Play Arena For Fun)** : plateforme web de mini-jeux compétitifs et éducatifs
  pour les étudiants de Pôle Sup. De La Salle (Rennes), avec classements et un tournoi
  qui dure toute l'année scolaire.
- Projet annuel BTS SIO 2e année, bloc B1, groupe 2. À livrer avant la fin de l'année 2026-2027.
- Équipe : Mars RENAULT (chef de projet), Matthéo LANTRAIN (adjoint), Evan BOUYAUX,
  Mathys ROMON, Tyméo PONCELET, Hoel QUERE. Suivi des tâches sur Trello.
- Le code part de **MetaBet**, un ancien projet de jeux de type casino/arcade, adapté au
  cahier des charges. Il reste des traces de MetaBet (logo image, certains noms internes).
- Cahier des charges complet : `documentation/cahier-des-charges-PAFF.pdf`.

## Règles du cahier des charges à toujours respecter

- **Aucun argent réel** (FC5) : uniquement des points fictifs, sans valeur, non échangeables.
  Pas de paiement, pas d'achat de points, pas de récompense en argent.
- **RGPD** (FC3) : ne collecter que pseudo, mail de l'école, classe et résultats. Le joueur
  accepte les conditions à l'inscription, peut consulter ses données et supprimer son compte.
- **Réservé à l'établissement** : inscription uniquement avec une adresse `@lyceedelasalle.fr`
  (format `nom.p@lyceedelasalle.fr`, regex dans `app/services/securite.js`).
- **Site en français**, utilisable sans formation, sur ordinateur et smartphone.
- **Identité graphique P.A.F.F.** (FC4) identique sur toutes les pages (logo, couleurs, typo
  encore à créer par l'équipe).
- Marge de manœuvre prévue : le 1 contre 1 peut se faire **au score** (chacun joue sa partie,
  le meilleur score gagne) au lieu d'un affrontement en direct. Peu de jeux qui marchent bien
  valent mieux que beaucoup de jeux inachevés.

## Fonctionnalités et priorités

Essentielles (première version) :
- F1 Compte et connexion : pseudo, mail de l'école, mot de passe
- F2 Catalogue des jeux et règles
- F3 Jouer en 1 contre 1 (défier un joueur précis ou être associé à un adversaire disponible)
- F4 Quiz éducatifs (culture générale, cours)
- F5 Classements : général et **par jeu**, mis à jour après chaque partie
- F6 Tournoi annuel : inscription, calendrier des manches, résultats, classement du tournoi
- F7 Administration : gérer les comptes, modérer les pseudos, ajouter des questions de quiz,
  programmer les manches du tournoi

Souhaitables : F8 Équipes (créer/rejoindre, classement par équipe), F9 Profil (pseudo, avatar,
historique, statistiques), F10 Jeux de type casino avec points fictifs.
Optionnelle : F11 Annonces.

## État d'avancement

Dernière mise à jour : novembre 2026.

| Fonction | État |
| --- | --- |
| F1 Compte et connexion | **Fait** (mot de passe haché scrypt, code mail à l'inscription et pour « mot de passe oublié », anti-essais) |
| F2 Catalogue et règles | **Fait** (cartes de jeux, modale d'aide `help.js`) |
| F3 1 contre 1 | **Fait** au score, sur Flappy et Tape-Taupe (défi par pseudo ou file d'attente, sans mise). Testé côté serveur ; interface à tester dans le navigateur |
| F4 Quiz | **Fait** : 10 questions / 20 s, 4 thèmes de départ (28 questions), +10 pts par bonne réponse, jouable en duel (mêmes questions). Testé côté serveur ; interface à tester dans le navigateur |
| F5 Classements | Général, par classe, **par jeu** (Quiz, Flappy, Tape-Taupe : meilleur score, table `partie`) ; les comptes suspendus ou non vérifiés n'apparaissent pas |
| F6 Tournoi | À faire (dont « programmer les manches » côté admin) |
| F7 Administration | **Fait** sauf tournoi : page `/admin.html` (comptes : renommer, suspendre, supprimer ; questions de quiz : ajouter, modifier, désactiver, supprimer). Admins = `ADMIN_EMAILS` dans `.env` |
| F8 Équipes | À faire (le classement par classe peut servir de base) |
| F9 Profil | À faire |
| F10 Casino | **Fait** (11 jeux) |
| F11 Annonces | À faire |
| FC3 RGPD | Partiel : pages légales + case à cocher à l'inscription ; consultation/suppression des données à faire |
| FC4 Identité graphique | À faire : le nom est remplacé partout, mais `static/img/Logo.png` et `Icon.png` affichent encore « METABET » |

Ordre de travail convenu : (1) assainir la base ✅ → (2) 1 contre 1 au score ✅ → (3) quiz et
administration ✅ → (4) tournoi → puis équipes, profil, annonces, RGPD (consulter / supprimer
ses données : `supprimerCompte()` de `app/services/compte.js` est prêt).

### Quiz (F4) et administration (F7) – comment c'est câblé

- Quiz : `app/jeux/quiz.js` sur `/actions/quiz` (`themes`, `start`, `answer`, `next`). La bonne réponse
  n'est envoyée qu'après la réponse ; le chrono est mesuré par le serveur et redémarre à `next`.
  Questions de départ : `app/services/quiz-questions-defaut.js` (insérées si la table est vide).
  En duel, les ids des questions sont gardés dans `duel.donnees` pour que les deux joueurs aient les mêmes.
- Admin : `actions/admin.js` sur `/api/admin`, protégé par `requireAuth` + `requireAdmin`
  (`app/middleware/auth.js`). Le rôle vient uniquement de `ADMIN_EMAILS` : rien en base, rien à
  modifier depuis le site. Page `admin.html` + `static/js/admin.js` + `static/css/admin.css`.
- Suspension : colonne `compte.banni`. `requireAuth` relit le compte à chaque requête : un compte
  suspendu ou supprimé est déconnecté aussitôt, et `ouvrirSession` refuse la connexion.
- `config.js` : ordre tables → migrations → vues (les vues utilisent des colonnes ajoutées par migration).

### Duels (F3) – comment c'est câblé

- Règles et calculs : `app/services/duel.js` (jeux autorisés dans `JEUX_DUEL`, délais en haut du fichier).
- Routes : `actions/duel.js` sur `/actions/duel` (`defier`, `file`, `:id/accepter|refuser|annuler`, `mes-duels`).
- Tables : `duel` (un duel, `joueur2_id` NULL = file d'attente) et `duel_manche` (la partie de chaque
  joueur ; clé primaire `(duel_id, compte_id)` = une seule tentative). Le délai d'expiration est
  appliqué à chaque appel de `mes-duels` (`cloturerDuelsExpires`).
- Un jeu « en duel » reçoit `duelId` à son `/start` → `commencerManche()`, et appelle
  `enregistrerScore()` à la fin avec le score validé par le serveur. Aucune mise en duel.
- Navigateur : `static/js/duel-client.js` (fenêtre `duel-modal.html`, état `window.duelEnCours`
  lu par `flappy.js`, `flappy-client.js` et `tape-taupe-client.js`).
- Ajouter un jeu en duel : l'ajouter à `JEUX_DUEL`, gérer `duelId` dans son `/start` et sa fin
  (modèle : `app/jeux/tape-taupe.js`), et dans son client.

## Stack et lancement

- Node.js ≥ 20 (`.nvmrc` : 24.11.1), Express 5, SQLite via `better-sqlite3` (synchrone),
  `express-session`, `nodemailer`, `dotenv`. Front en HTML/CSS/JS **sans framework ni build**.
- Installation : `./install.sh` (Linux/macOS) ou `install.bat` (Windows), ou à la main :
  `npm install`, copier `.env.example` en `.env`.
- Lancer : `npm run dev` (nodemon) ou `npm start` → http://localhost:3000
- **Sans Gmail configuré** (`EMAIL_USER` vide), aucun mail n'est envoyé : le code à 6 chiffres
  s'affiche dans la console du serveur (`📧 [MODE DEV] ...`). C'est comme ça qu'on teste
  l'inscription en local.
- Variables `.env` : `SESSION_SECRET` (obligatoire en production), `ADMIN_EMAILS`, `EMAIL_USER`/`EMAIL_PASS`,
  `NODE_ENV`, `PORT`, `DB_PATH` (dossier persistant chez l'hébergeur, jamais `/tmp`).
- Pas de tests automatisés pour l'instant. Pour vérifier une route : lancer le serveur et
  utiliser `curl` avec un fichier de cookies (`-c cookies.txt -b cookies.txt`).

## Architecture

```
server.js              Point d'entrée : sessions, montage de toutes les routes, pages, /api/session, /logout
config.js              Ouvre la base SQLite, crée tables + vues, migrations (ALTER TABLE ... ADD COLUMN)
index.html             Page principale (SPA légère) : les jeux s'ouvrent dans des modales
login.html             Inscription, connexion, mot de passe oublié (script inline en bas de page)

actions/               Routes de compte, bonus, roue, coffres, classement, temps de jeu
app/jeux/<jeu>.js      Logique serveur de chaque jeu (un routeur Express par jeu)
app/middleware/        auth.js (requireAuth, checkBalance), checktime.js (limite 1 h/jour)
app/services/          securite.js (mdp, codes, anti-essais), mailer.js, session.js (ouvrirSession)
app/key-drop.js        Gain aléatoire de clés pour les coffres

static/js/             Scripts navigateur ; components-loader.js charge les modales à la demande
static/js/jeux/        <jeu>-client.js : interface de chaque jeu
static/templates/modals/   <jeu>-modal.html : fenêtre HTML de chaque jeu
static/templates/      game-cards.html (catalogue), leaderboard.html, legal/, aPropos/, support/
static/css/            Un fichier par page/jeu
documentation/         Cahier des charges, planification
```

### Base de données (`config.js`)

- `compte` : id, pseudo (unique), email (unique), **mot_de_passe** (format `scrypt$sel$hash`),
  points (5 000 à l'inscription), classe, compte_verifie, code_auth / code_expiration,
  temps_restant_aujourdhui, cles, flappy_best_score, champs bonus/roue/weekly pass…
- `points_log` : historique de chaque variation de points (compte_id, variation, raison, date).
- Vues : `classement_individuel`, `classement_classe`, `compte_secure`.
- Pour ajouter une colonne à `compte`, l'ajouter dans la boucle de migrations en bas de
  `config.js` (les bases existantes ne repassent pas par le `CREATE TABLE`).
- Les dates de code sont des chaînes heure de Paris (`expirationDans()` / `codeExpire()` dans
  `securite.js`) ; le reste utilise `datetime('now')` de SQLite (UTC).

### Comment un jeu est câblé (modèle à suivre pour un nouveau jeu)

1. **Serveur** `app/jeux/<jeu>.js` : routeur Express, `router.use(checkTime)`, routes protégées
   par `requireAuth` (et `checkBalance` si mise). **Toute la logique de jeu et le calcul des
   gains se font côté serveur**, jamais dans le navigateur (anti-triche). L'état d'une partie
   en cours est gardé dans une `Map` en mémoire indexée par l'id du joueur.
2. Chaque variation de points : `UPDATE compte SET points = ...` **et** `INSERT INTO points_log`.
3. Monter le routeur dans `server.js` : `app.use('/actions/<jeu>', require('./app/jeux/<jeu>'))`.
4. **Client** : `static/templates/modals/<jeu>-modal.html` + `static/js/jeux/<jeu>-client.js`
   + `static/css/<jeu>.css`, chargés via `loadModal()` de `components-loader.js`.
5. Carte du jeu dans `static/templates/game-cards.html`, règles dans `static/js/help.js`.

### Authentification

- Session Express (cookie `paff.sid`) ; `req.session.user = { id, pseudo, username, points, classe, cles }`.
- Le front garde aussi une copie dans `localStorage.user` ; **la source de vérité est toujours
  la base** (`/api/session` relit les points).
- Flux : `create_account` → code par mail → `verify_account` (ouvre la session) ;
  `login` (mail + mot de passe) ; `request_code` + `reset_password` pour l'oubli.
- `ouvrirSession()` dans `app/services/session.js` applique la limite de temps quotidienne.

## Conventions

- Code, commentaires, messages et interface **en français**.
- Réponses JSON des routes : `{ success: true|false, message, ... }`.
- Requêtes SQL toujours **préparées** (`db.prepare(...).run(?)`), jamais de concaténation.
- Pas de framework front, pas d'étape de build : rester en HTML/CSS/JS simple pour que toute
  l'équipe puisse relire.
- Ne jamais versionner `.env` ni `database.db`.
- Garder les choses simples : c'est un projet étudiant qui doit être compris et présenté
  à l'oral par l'équipe.

## Dette technique connue

- L'état des parties en cours est en mémoire : perdu au redémarrage, et ne fonctionne qu'avec
  un seul processus serveur.
- `checkBalance` vérifie le solde mais le débit se fait plus loin dans chaque jeu : deux
  requêtes simultanées pourraient passer. À sécuriser avec un `UPDATE ... WHERE points >= ?`.
- La limite de 1 h de jeu par jour vient de MetaBet ; à rediscuter avec le tournoi annuel.
- `app/jeux/puissance4.js` contient un commentaire résiduel (« remplace la validation existante »)
  vers la ligne 297.
- `requirements.txt` est un ancien fichier d'aide ; le README fait foi.
- Flappy : le score est envoyé par le navigateur (seule protection : durée minimale de partie).
  Un tricheur peut donc envoyer un faux score, y compris en duel.
- Flappy : la popup de résultat (`flappy-result-popup.html`) n'est jamais chargée dans la page,
  donc `showFlappyResultPopup` ne fait rien. En duel, le résultat s'affiche par un message (toast).
- Tape-Taupe : les gains ne sont pas écrits dans `points_log`.
- `actions/classement.js` garde une liste `BANNED_IDS` de pseudos (héritée de MetaBet) en plus de
  `compte.banni` : à remplacer en suspendant ces comptes depuis l'administration.
- Les sessions sont en mémoire (MemoryStore d'express-session) : perdues au redémarrage, non
  adapté à la production.
- `better-sqlite3` passé en 13.x (novembre 2026) : la 12.6 n'a pas de binaire précompilé pour Node 26.

# P.A.F.F. (Play Arena For Fun)

Projet annuel BTS SIO 2e année (bloc B1) – Pôle Sup De La Salle, Rennes.
Plateforme de mini-jeux en ligne avec classement et tournoi annuel, sans argent réel :
les jeux n'utilisent que des points fictifs, sans valeur et non échangeables.

Le code part du projet MetaBet (jeux de type casino et arcade), adapté au cahier des charges P.A.F.F.

---

## État d'avancement par rapport au cahier des charges

| Fonction | État |
| --- | --- |
| F1 Compte et connexion (pseudo, mail de l'école, mot de passe) | Fait |
| F2 Catalogue des jeux et règles | Fait |
| F3 Jouer en 1 contre 1 | Fait (au score, sur Flappy et Tape-Taupe : défier un pseudo ou trouver un adversaire) |
| F4 Quiz éducatifs | Fait (4 thèmes, questions gérées par les admins, jouable en duel) |
| F5 Classements | Général, par classe et par jeu (Quiz, Flappy, Tape-Taupe) |
| F6 Tournoi annuel | À faire |
| F7 Administration | Fait (comptes et questions de quiz) ; programmation des manches du tournoi à faire |
| F8 Équipes | À faire |
| F9 Profil | À faire |
| F10 Jeux de type casino (points fictifs) | Fait |
| F11 Annonces | À faire |
| FC3 RGPD | Partiel : pages légales et acceptation à l'inscription ; consultation et suppression de ses données à faire |
| FC4 Identité graphique | À faire : le nom est en place, logo, couleurs et typographie restent à créer |

---

## Stack technique

| Côté | Technologie |
| --- | --- |
| Back-end | Node.js + Express |
| Base de données | SQLite via better-sqlite3 |
| Front-end | HTML / CSS / JS sans framework |
| Authentification | Mail de l'école + mot de passe (haché avec scrypt), code par mail à l'inscription et en cas d'oubli |

---

## Installation

Prérequis : Node.js 20 ou plus récent, npm.

Le plus simple : lancer le script d'installation, qui installe les dépendances, crée le `.env`
avec un secret de session, initialise git et propose d'ouvrir Claude Code.

```bash
./install.sh              # Linux / macOS
install.bat               # Windows (double-clic possible)
```

À la main :

```bash
npm install
cp .env.example .env      # sous Windows : copy .env.example .env
npm run dev               # ou : npm start
```

### Reprendre le projet avec Claude Code

Le fichier `CLAUDE.md` donne à Claude Code tout le contexte du projet (cahier des charges,
architecture, conventions, état d'avancement). Il est lu automatiquement au lancement de `claude`
dans le dossier du projet. Deux commandes sont prêtes :

- `/reprendre` : fait le point sur l'état du projet et propose la prochaine étape ;
- `/fin-de-session` : met à jour `CLAUDE.md` et le README, puis propose un commit.

Le site est alors disponible sur http://localhost:3000.

### Sans compte mail (développement)

Si `EMAIL_USER` et `EMAIL_PASS` sont vides dans `.env`, aucun mail n'est envoyé :
le code à 6 chiffres s'affiche dans la console du serveur.

### Administration

Les administrateurs sont listés dans `.env` : `ADMIN_EMAILS=nom.p@lyceedelasalle.fr,autre.a@lyceedelasalle.fr`.
Une fois connectés, ils voient le lien « Administration » dans le menu (page `/admin.html`).

### Mise en production

Dans le `.env` de l'hébergeur :

- `NODE_ENV=production`
- `SESSION_SECRET` : obligatoire, le serveur refuse de démarrer sans lui
- `EMAIL_USER` / `EMAIL_PASS` : compte Gmail d'envoi (mot de passe d'application)
- `DB_PATH` : chemin de la base dans un dossier **persistant** (jamais `/tmp`)

Le site doit être servi en HTTPS : en production, le cookie de session n'est envoyé que sur une connexion sécurisée.

---

## Arborescence

```
├─ CLAUDE.md            Contexte du projet pour Claude Code
├─ install.sh / .bat    Installation en une commande
├─ .claude/commands/    Commandes /reprendre et /fin-de-session
├─ server.js            Point d'entrée Express : sessions, routes, pages
├─ config.js            Connexion SQLite, création des tables et migrations
├─ .env.example         Modèle de configuration
├─ index.html           Interface principale (les jeux s'ouvrent en fenêtres)
├─ login.html           Inscription, connexion, mot de passe oublié
│
├─ actions/             Routes de compte et de session
│   ├─ create_account.js   Inscription
│   ├─ verify_account.js   Validation du code d'inscription
│   ├─ login.js            Connexion par mot de passe
│   ├─ request_code.js     Mot de passe oublié : envoi du code
│   ├─ reset_password.js   Mot de passe oublié : nouveau mot de passe
│   └─ ...                 Bonus, roue, coffres, classement, temps de session
│
├─ app/
│   ├─ jeux/            Logique serveur des jeux (un fichier par jeu)
│   ├─ middleware/      Vérification de connexion et du temps de jeu
│   ├─ services/        Sécurité (mots de passe, codes, anti-essais), mails, sessions
│   └─ key-drop.js      Gain de clés pour les coffres
│
├─ static/
│   ├─ css/  img/  js/  Styles, images, scripts du navigateur
│   └─ templates/       Fenêtres des jeux, pages légales, support, à propos
│
└─ documentation/       Cahier des charges (PDF), planification du projet
```

---

## Règles du service

- Inscription réservée aux adresses `@lyceedelasalle.fr`.
- Acceptation des conditions d'utilisation et de la charte de bonne conduite à l'inscription.
- 5 essais de connexion ou de code par quart d'heure et par adresse.
- Temps de jeu limité à 1 heure par jour, avec un message de prévention.

---

Projet réalisé à des fins pédagogiques uniquement.
Contact : [renard.p@lyceedelasalle.fr](mailto:renard.p@lyceedelasalle.fr)

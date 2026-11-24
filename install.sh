#!/usr/bin/env bash
# ============================================================================
#  P.A.F.F. – Installation et reprise du projet avec Claude Code
#  Usage : ./install.sh        (depuis n'importe où)
#  Le script peut être relancé sans risque : il ne remplace jamais un .env existant.
# ============================================================================
set -e
cd "$(dirname "$0")"

vert()  { printf '\033[32m%s\033[0m\n' "$1"; }
jaune() { printf '\033[33m%s\033[0m\n' "$1"; }
rouge() { printf '\033[31m%s\033[0m\n' "$1"; }

echo "=== P.A.F.F. – Installation ==="

# 1. Node.js (version 20 ou plus)
if ! command -v node >/dev/null 2>&1; then
  rouge "Node.js n'est pas installé. Installez la version 20 ou plus : https://nodejs.org/"
  exit 1
fi
if ! node -e "process.exit(+process.versions.node.split('.')[0] >= 20 ? 0 : 1)"; then
  rouge "Node.js $(node -v) est trop ancien : il faut la version 20 ou plus (24 recommandée)."
  exit 1
fi
vert "✔ Node.js $(node -v)"

# 2. Dépendances
echo "Installation des dépendances (npm install)..."
npm install --no-audit --no-fund
vert "✔ Dépendances installées"

# 3. Fichier .env avec un secret de session généré
if [ -f .env ]; then
  vert "✔ .env déjà présent (non modifié)"
else
  node -e "
    const fs = require('fs');
    const secret = require('crypto').randomBytes(32).toString('hex');
    const modele = fs.readFileSync('.env.example', 'utf8');
    fs.writeFileSync('.env', modele.replace(/^SESSION_SECRET=.*$/m, 'SESSION_SECRET=' + secret));
  "
  vert "✔ .env créé (secret de session généré, mails en mode développement)"
fi

# 4. Dépôt git (Claude Code s'en sert pour suivre les changements)
if command -v git >/dev/null 2>&1; then
  if [ ! -d .git ]; then
    git init -q
    git add -A
    if git commit -q -m "Reprise du projet P.A.F.F." 2>/dev/null; then
      vert "✔ Dépôt git initialisé avec un premier commit"
    else
      jaune "! Dépôt git créé, mais le premier commit a échoué."
      jaune "  Configurez votre identité puis commitez :"
      jaune "    git config --global user.name \"Prénom Nom\""
      jaune "    git config --global user.email \"vous@exemple.fr\""
      jaune "    git commit -m \"Reprise du projet P.A.F.F.\""
    fi
  else
    vert "✔ Dépôt git déjà présent"
  fi
else
  jaune "! git n'est pas installé : recommandé pour suivre les changements (https://git-scm.com/)."
fi

# 5. Claude Code
if ! command -v claude >/dev/null 2>&1; then
  echo
  jaune "Claude Code n'est pas installé. Pour l'installer :"
  echo  "    curl -fsSL https://claude.ai/install.sh | bash"
  echo  "  (ou : npm install -g @anthropic-ai/claude-code)"
  echo  "Puis relancez ./install.sh, ou tapez simplement : claude"
  echo
  echo "Pour lancer le site sans Claude Code : npm run dev  →  http://localhost:3000"
  exit 0
fi
vert "✔ Claude Code $(claude --version 2>/dev/null | head -n1)"

echo
echo "Tout est prêt. Commandes utiles :"
echo "  npm run dev            lancer le site (http://localhost:3000)"
echo "  claude                 ouvrir Claude Code dans le projet"
echo "  /reprendre             (dans Claude Code) faire le point et proposer la suite"
echo "  /fin-de-session        (dans Claude Code) mettre à jour CLAUDE.md avant de commiter"
echo

if [ -t 0 ]; then
  read -r -p "Ouvrir Claude Code maintenant ? [O/n] " reponse
  case "$reponse" in
    [nN]*) exit 0 ;;
  esac
  exec claude "Lis CLAUDE.md, fais le point sur l'état du projet P.A.F.F. en quelques lignes, puis propose la prochaine étape. Attends mon accord avant de coder."
fi

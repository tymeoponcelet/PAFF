@echo off
REM ============================================================================
REM  P.A.F.F. - Installation et reprise du projet avec Claude Code (Windows)
REM  Usage : double-cliquer sur install.bat, ou le lancer depuis un terminal.
REM  Peut etre relance sans risque : un .env existant n'est jamais remplace.
REM ============================================================================
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo === P.A.F.F. - Installation ===

REM 1. Node.js (version 20 ou plus)
where node >nul 2>&1
if errorlevel 1 goto :pas_de_node
node -e "process.exit(+process.versions.node.split('.')[0] >= 20 ? 0 : 1)"
if errorlevel 1 goto :node_trop_ancien
for /f "delims=" %%v in ('node -v') do echo [OK] Node.js %%v

REM 2. Dependances
echo Installation des dependances (npm install)...
call npm install --no-audit --no-fund
if errorlevel 1 goto :erreur_npm
echo [OK] Dependances installees

REM 3. Fichier .env avec un secret de session genere
if exist .env goto :env_present
node -e "const fs=require('fs');const s=require('crypto').randomBytes(32).toString('hex');fs.writeFileSync('.env',fs.readFileSync('.env.example','utf8').replace(/^SESSION_SECRET=.*$/m,'SESSION_SECRET='+s))"
if errorlevel 1 goto :erreur_env
echo [OK] .env cree (secret de session genere, mails en mode developpement)
goto :git
:env_present
echo [OK] .env deja present (non modifie)

:git
REM 4. Depot git
where git >nul 2>&1
if errorlevel 1 goto :pas_de_git
if exist .git goto :git_present
git init -q
git add -A
git commit -q -m "Reprise du projet P.A.F.F." >nul 2>&1
if errorlevel 1 goto :git_commit_rate
echo [OK] Depot git initialise avec un premier commit
goto :claude
:git_present
echo [OK] Depot git deja present
goto :claude
:git_commit_rate
echo [!] Depot git cree, mais le premier commit a echoue. Configurez votre identite :
echo       git config --global user.name "Prenom Nom"
echo       git config --global user.email "vous@exemple.fr"
echo       git commit -m "Reprise du projet P.A.F.F."
goto :claude
:pas_de_git
echo [!] git n'est pas installe : recommande pour suivre les changements. https://git-scm.com/

:claude
REM 5. Claude Code
where claude >nul 2>&1
if errorlevel 1 goto :pas_de_claude
echo [OK] Claude Code installe
echo.
echo Tout est pret. Commandes utiles :
echo   npm run dev         lancer le site sur http://localhost:3000
echo   claude              ouvrir Claude Code dans le projet
echo   /reprendre          dans Claude Code : faire le point et proposer la suite
echo   /fin-de-session     dans Claude Code : mettre a jour CLAUDE.md avant de commiter
echo.
set /p reponse="Ouvrir Claude Code maintenant ? [O/n] "
if /i "%reponse%"=="n" goto :fin
call claude "Lis CLAUDE.md, fais le point sur l'etat du projet P.A.F.F. en quelques lignes, puis propose la prochaine etape. Attends mon accord avant de coder."
goto :fin

:pas_de_claude
echo.
echo Claude Code n'est pas installe. Dans PowerShell :
echo     irm https://claude.ai/install.ps1 ^| iex
echo   ou : npm install -g @anthropic-ai/claude-code
echo Puis relancez install.bat, ou tapez simplement : claude
echo.
echo Pour lancer le site sans Claude Code : npm run dev  puis  http://localhost:3000
goto :fin

:pas_de_node
echo [ERREUR] Node.js n'est pas installe. Installez la version 20 ou plus : https://nodejs.org/
goto :fin
:node_trop_ancien
echo [ERREUR] Node.js est trop ancien : il faut la version 20 ou plus (24 recommandee).
goto :fin
:erreur_npm
echo [ERREUR] npm install a echoue. Lisez le message ci-dessus.
goto :fin
:erreur_env
echo [ERREUR] Impossible de creer le fichier .env.
goto :fin

:fin
endlocal
pause

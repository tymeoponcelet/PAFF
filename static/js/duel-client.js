// ========================================
// DUELS 1 CONTRE 1 - CLIENT (F3)
// ========================================
// - window.ouvrirDuels(jeu?) ouvre la fenêtre des duels
// - window.duelEnCours = { id, jeu, adversaire } pendant une partie de duel :
//   Flappy et Tape-Taupe le lisent pour jouer sans mise et envoyer le duelId
// - window.finirModeDuel(duel) est appelé par le jeu à la fin de la partie
// - window.quitterModeDuel() remet le jeu en mode normal (ouverture classique d'un jeu)

(function () {
  'use strict';

  const API = '/actions/duel';
  const MODALES_JEU = { flappy: 'flappyModal', tapetaupe: 'modal-tapetaupe', quiz: 'quizModal' };

  let modal = null;
  let duelsAffiches = {};

  window.duelEnCours = null;

  // ── Utilitaires ──────────────────────────────────────────────────────────
  function echapper(texte) {
    const div = document.createElement('div');
    div.textContent = texte == null ? '' : String(texte);
    return div.innerHTML;
  }

  function toast(message, type = 'info') {
    if (typeof window.showToast === 'function') window.showToast(message, type);
    else alert(message);
  }

  function estConnecte() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      return Boolean(user && user.logged);
    } catch (e) {
      return false;
    }
  }

  async function appel(methode, url, corps) {
    try {
      const res = await fetch(url, {
        method: methode,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: corps ? JSON.stringify(corps) : undefined
      });
      return await res.json();
    } catch (e) {
      return { success: false, message: 'Erreur réseau' };
    }
  }

  // ── Ouverture / fermeture ────────────────────────────────────────────────
  window.ouvrirDuels = async function (jeu) {
    if (!estConnecte()) {
      toast('Connectez-vous pour jouer en duel.', 'info');
      return;
    }

    await loadModal('duel');
    initDuel();
    if (!modal) return;

    if (jeu) document.getElementById('duelJeu').value = jeu;

    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    rafraichir();
  };

  function fermer() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function initDuel() {
    modal = document.getElementById('duelModal');
    if (!modal || modal.dataset.init === '1') return;
    modal.dataset.init = '1';

    modal.querySelector('.js-close-duel').addEventListener('click', fermer);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) fermer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) fermer();
    });

    document.getElementById('duelFormDefi').addEventListener('submit', async (e) => {
      e.preventDefault();
      const champ = document.getElementById('duelPseudo');
      const data = await appel('POST', `${API}/defier`, {
        pseudo: champ.value.trim(),
        jeu: document.getElementById('duelJeu').value
      });
      toast(data.message, data.success ? 'success' : 'danger');
      if (data.success) champ.value = '';
      rafraichir();
    });

    document.getElementById('duelFile').addEventListener('click', async () => {
      const data = await appel('POST', `${API}/file`, {
        jeu: document.getElementById('duelJeu').value
      });
      toast(data.message, data.success ? 'success' : 'danger');
      rafraichir();
    });

    // Un seul écouteur pour tous les boutons des listes
    modal.addEventListener('click', async (e) => {
      const bouton = e.target.closest('[data-action]');
      if (!bouton) return;

      const id = bouton.dataset.id;
      const action = bouton.dataset.action;

      if (action === 'jouer') {
        jouer(duelsAffiches[id]);
        return;
      }

      bouton.disabled = true;
      const data = await appel('POST', `${API}/${id}/${action}`);
      toast(data.message, data.success ? 'success' : 'danger');
      rafraichir();
    });
  }

  // ── Affichage des listes ─────────────────────────────────────────────────
  async function rafraichir() {
    const data = await appel('GET', `${API}/mes-duels`);
    if (!data.success) {
      toast(data.message || 'Impossible de charger les duels', 'danger');
      return;
    }

    duelsAffiches = {};
    [...data.recus, ...data.enCours, ...data.envoyes, ...data.termines]
      .forEach(d => { duelsAffiches[d.id] = d; });

    document.getElementById('duelVictoires').textContent = data.bilan.victoires;
    document.getElementById('duelDefaites').textContent = data.bilan.defaites;
    document.getElementById('duelEgalites').textContent = data.bilan.egalites;

    remplir('duelRecus', data.recus, ligneRecu, 'Aucun défi reçu.');
    remplir('duelEnCours', data.enCours, ligneEnCours, 'Aucun duel en cours.');
    remplir('duelEnvoyes', data.envoyes, ligneEnvoye, 'Aucun défi en attente.');
    remplir('duelTermines', data.termines, ligneTermine, 'Pas encore de résultat.');
  }

  function remplir(idListe, duels, fabriquerLigne, messageVide) {
    const liste = document.getElementById(idListe);
    liste.innerHTML = duels.length
      ? duels.map(fabriquerLigne).join('')
      : `<li class="duel__vide">${messageVide}</li>`;
  }

  function bouton(action, id, texte, secondaire = false) {
    return `<button class="duel__bouton${secondaire ? ' duel__bouton--secondaire' : ''}"
      type="button" data-action="${action}" data-id="${id}">${texte}</button>`;
  }

  function ligne(texte, actions = '') {
    return `<li class="duel__item"><span class="duel__texte">${texte}</span>
      <span class="duel__actions">${actions}</span></li>`;
  }

  function ligneRecu(d) {
    return ligne(
      `<strong>${echapper(d.adversaire)}</strong> vous défie sur ${echapper(d.nomJeu)}`,
      bouton('accepter', d.id, 'Accepter') + bouton('refuser', d.id, 'Refuser', true)
    );
  }

  function ligneEnCours(d) {
    const qui = `${echapper(d.nomJeu)} contre <strong>${echapper(d.adversaire)}</strong>`;

    if (!d.jaiJoue) {
      const etat = d.adversaireAFini ? " (l'adversaire a déjà joué)" : '';
      return ligne(`${qui}${etat}`, bouton('jouer', d.id, '▶ Jouer ma partie'));
    }
    if (!d.jaiFini) {
      return ligne(`${qui} : partie commencée…`);
    }
    return ligne(`${qui} : votre score <strong>${d.monScore}</strong>, en attente de l'adversaire`);
  }

  function ligneEnvoye(d) {
    const texte = d.adversaire
      ? `Défi ${echapper(d.nomJeu)} envoyé à <strong>${echapper(d.adversaire)}</strong>`
      : `Recherche d'un adversaire sur ${echapper(d.nomJeu)}…`;
    return ligne(texte, bouton('annuler', d.id, 'Annuler', true));
  }

  const LIBELLES = {
    victoire: '🏆 Victoire',
    defaite: '❌ Défaite',
    egalite: '🤝 Égalité'
  };

  function ligneTermine(d) {
    return ligne(
      `<span class="duel__resultat duel__resultat--${d.resultat}">${LIBELLES[d.resultat] || ''}</span>
       contre <strong>${echapper(d.adversaire)}</strong> sur ${echapper(d.nomJeu)} :
       ${d.monScore ?? 0} à ${d.scoreAdversaire ?? 0}`
    );
  }

  // ── Lancer une partie de duel ────────────────────────────────────────────
  async function jouer(duel) {
    if (!duel || !MODALES_JEU[duel.jeu]) return;

    if (typeof checkUserTimeRemaining === 'function') {
      const aDuTemps = await checkUserTimeRemaining();
      if (!aDuTemps) return;
    }

    window.duelEnCours = { id: duel.id, jeu: duel.jeu, adversaire: duel.adversaire };
    fermer();

    await loadModal(duel.jeu);
    // Laisse le jeu finir son initialisation avant de passer en mode duel
    await new Promise(r => setTimeout(r, 300));

    afficherModeDuel(duel.jeu);
    const modaleJeu = document.getElementById(MODALES_JEU[duel.jeu]);
    if (modaleJeu) {
      modaleJeu.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }

  function afficherModeDuel(jeu) {
    const modaleJeu = document.getElementById(MODALES_JEU[jeu]);
    if (!modaleJeu) return;

    retirerBandeau();
    const bandeau = document.createElement('div');
    bandeau.className = 'duel-bandeau';
    bandeau.id = 'duelBandeau';
    bandeau.innerHTML = `⚔️ Duel contre <strong>${echapper(window.duelEnCours.adversaire)}</strong> :
      une seule tentative, aucune mise. ${jeu === 'flappy' ? 'Cliquez sur le jeu pour commencer.' : ''}`;

    const corps = modaleJeu.querySelector('.modal__body, .modal__bodyTapeTaupe');
    if (corps) corps.prepend(bandeau);

    if (jeu === 'flappy') {
      const zoneMise = document.getElementById('flappyBetZone');
      if (zoneMise) zoneMise.style.display = 'none';
    }
    if (jeu === 'tapetaupe' && typeof window.reinitialiserTapeTaupe === 'function') {
      // Remet le jeu sur l'écran de départ, sans la zone de mise
      window.reinitialiserTapeTaupe();
    }
    if (jeu === 'quiz' && typeof window.reinitialiserQuiz === 'function') {
      // Écran d'accueil du duel : pas de choix de thème, questions communes
      window.reinitialiserQuiz();
    }
  }

  function retirerBandeau() {
    const ancien = document.getElementById('duelBandeau');
    if (ancien) ancien.remove();
  }

  function remettreModeNormal() {
    window.duelEnCours = null;
    retirerBandeau();
    const zoneFlappy = document.getElementById('flappyBetZone');
    if (zoneFlappy) zoneFlappy.style.display = '';
    // La zone de mise du Tape-Taupe est réaffichée par le jeu (bouton « Rejouer »)
  }

  // Appelé par le jeu quand la partie de duel est terminée
  window.finirModeDuel = function (duel) {
    remettreModeNormal();
    if (!duel) return;

    if (duel.statut === 'termine') {
      const score = `${duel.monScore ?? 0} à ${duel.scoreAdversaire ?? 0}`;
      if (duel.resultat === 'victoire') toast(`🏆 Victoire contre ${duel.adversaire} (${score}) !`, 'success');
      else if (duel.resultat === 'defaite') toast(`❌ Défaite contre ${duel.adversaire} (${score}).`, 'danger');
      else toast(`🤝 Égalité avec ${duel.adversaire} (${score}).`, 'info');
    } else {
      toast(`Score enregistré : ${duel.monScore}. En attente de la partie de ${duel.adversaire}.`, 'success');
    }
  };

  // Appelé quand on ouvre un jeu normalement (carte du catalogue)
  window.quitterModeDuel = function () {
    if (!window.duelEnCours) return;
    const jeu = window.duelEnCours.jeu;
    remettreModeNormal();
    // Réaffiche la zone de mise du Tape-Taupe / le choix du thème du quiz
    if (jeu === 'tapetaupe' && typeof window.reinitialiserTapeTaupe === 'function') {
      window.reinitialiserTapeTaupe();
    }
    if (jeu === 'quiz' && typeof window.reinitialiserQuiz === 'function') {
      window.reinitialiserQuiz();
    }
  };

  // ── Boutons « Duels » (menu, cartes de jeux) ─────────────────────────────
  // Capture : le bouton « Défier » est dans la carte du jeu, il ne doit pas ouvrir le jeu
  document.addEventListener('click', (e) => {
    const declencheur = e.target.closest('.js-open-duel');
    if (!declencheur) return;

    e.preventDefault();
    e.stopPropagation();
    try {
      if (typeof closeMobileMenu === 'function') closeMobileMenu();
    } catch (err) { /* menu mobile absent */ }

    window.ouvrirDuels(declencheur.dataset.jeu);
  }, { capture: true });
})();

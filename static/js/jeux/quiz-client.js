// ========================================
// QUIZ ÉDUCATIFS - CLIENT (F4)
// ========================================
// Le serveur choisit les questions, mesure le temps et corrige :
// le navigateur ne connaît la bonne réponse qu'après avoir répondu.

(function () {
  'use strict';

  const API = '/actions/quiz';
  const LETTRES = ['A', 'B', 'C', 'D'];

  let modal = null;
  let sessionId = null;
  let chrono = null;
  let finChrono = 0;
  let dureeQuestion = 20;
  let attenteReponse = false;
  let resultatFinal = null;

  const $ = (id) => document.getElementById(id);

  function toast(message, type = 'info') {
    if (typeof window.showToast === 'function') window.showToast(message, type);
    else alert(message);
  }

  async function appel(url, corps) {
    try {
      const res = await fetch(url, {
        method: corps === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: corps === undefined ? undefined : JSON.stringify(corps)
      });
      return await res.json();
    } catch (e) {
      return { success: false, message: 'Erreur réseau' };
    }
  }

  // Duel en cours sur le quiz (voir static/js/duel-client.js)
  function duelActif() {
    return window.duelEnCours && window.duelEnCours.jeu === 'quiz' ? window.duelEnCours : null;
  }

  function afficherEcran(id) {
    ['quizAccueil', 'quizJeu', 'quizFin'].forEach(e => { $(e).hidden = e !== id; });
  }

  // ── Initialisation (appelée au chargement de la modale) ──────────────────
  window.initQuiz = function () {
    modal = $('quizModal');
    if (!modal) return;

    if (modal.dataset.init !== '1') {
      modal.dataset.init = '1';
      modal.querySelector('.js-close-quiz').addEventListener('click', fermer);
      modal.addEventListener('click', (e) => { if (e.target === modal) fermer(); });
      $('quizCommencer').addEventListener('click', commencer);
      $('quizSuivant').addEventListener('click', suivant);
      $('quizRejouer').addEventListener('click', () => {
        window.reinitialiserQuiz();
      });
    }

    chargerThemes();
    window.reinitialiserQuiz();
  };

  async function chargerThemes() {
    const data = await appel(`${API}/themes`);
    if (!data.success) return;

    dureeQuestion = data.duree;
    const select = $('quizTheme');
    const choisi = select.value;
    select.innerHTML = '<option value="">Tous les thèmes</option>';
    // textContent : les thèmes sont saisis par les admins
    data.themes.forEach((t) => {
      const option = document.createElement('option');
      option.value = t.theme;
      option.textContent = `${t.theme} (${t.nb})`;
      select.appendChild(option);
    });
    select.value = choisi;
    if (select.selectedIndex === -1) select.value = '';
  }

  // Remet l'écran d'accueil (aussi utilisé par duel-client.js)
  window.reinitialiserQuiz = function () {
    if (!modal) return;
    arreterChrono();
    sessionId = null;
    resultatFinal = null;

    const duel = duelActif();
    $('quizThemeChoix').hidden = Boolean(duel);
    $('quizIntro').innerHTML = duel
      ? 'Duel : vous et votre adversaire avez <strong>les mêmes 10 questions</strong>. Une seule tentative, aucune mise.'
      : '10 questions, 20 secondes par question. Plus vous répondez vite, plus vous marquez de points de score. Chaque bonne réponse rapporte <strong>10 pts</strong>.';

    afficherEcran('quizAccueil');
  };

  function fermer() {
    arreterChrono();
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // ── Déroulement d'une partie ─────────────────────────────────────────────
  async function commencer() {
    const bouton = $('quizCommencer');
    bouton.disabled = true;

    const duel = duelActif();
    const data = await appel(`${API}/start`, duel ? { duelId: duel.id } : { theme: $('quizTheme').value });
    bouton.disabled = false;

    if (!data.success) {
      toast(data.message, 'danger');
      if (duel && typeof window.finirModeDuel === 'function') {
        window.finirModeDuel(data.duel || null);
        window.reinitialiserQuiz();
      }
      return;
    }

    sessionId = data.sessionId;
    $('quizScore').textContent = '0';
    afficherEcran('quizJeu');
    afficherQuestion(data.question);
  }

  function afficherQuestion(q) {
    $('quizNumero').textContent = q.numero;
    $('quizTotal').textContent = q.total;
    $('quizThemeQuestion').textContent = q.theme;
    $('quizQuestion').textContent = q.question;
    $('quizRetour').hidden = true;

    const zone = $('quizChoix');
    zone.innerHTML = '';
    q.choix.forEach((texte, i) => {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'quiz__reponse';
      bouton.dataset.choix = String(i + 1);
      bouton.innerHTML = `<span class="quiz__lettre">${LETTRES[i]}</span><span class="quiz__texte"></span>`;
      bouton.querySelector('.quiz__texte').textContent = texte;
      bouton.addEventListener('click', () => repondre(i + 1));
      zone.appendChild(bouton);
    });

    attenteReponse = true;
    lancerChrono(q.duree || dureeQuestion);
    zone.querySelector('button').focus();
  }

  function lancerChrono(secondes) {
    arreterChrono();
    finChrono = Date.now() + secondes * 1000;
    const barre = $('quizChronoBarre');

    const maj = () => {
      const reste = Math.max(0, finChrono - Date.now());
      barre.style.width = `${(reste / (secondes * 1000)) * 100}%`;
      barre.classList.toggle('is-urgent', reste < 5000);
      $('quizSecondes').textContent = Math.ceil(reste / 1000);
      if (reste <= 0) repondre(0); // temps écoulé
    };
    maj();
    chrono = setInterval(maj, 200);
  }

  function arreterChrono() {
    if (chrono) clearInterval(chrono);
    chrono = null;
  }

  async function repondre(choix) {
    if (!attenteReponse) return;
    attenteReponse = false;
    arreterChrono();

    const boutons = [...$('quizChoix').querySelectorAll('button')];
    boutons.forEach(b => { b.disabled = true; });

    const data = await appel(`${API}/answer`, { sessionId, choix });
    if (!data.success) {
      toast(data.message, 'danger');
      return;
    }

    // Couleurs : bonne réponse en vert, mauvaise réponse choisie en rouge
    boutons.forEach(b => {
      const n = parseInt(b.dataset.choix, 10);
      if (n === data.bonneReponse) b.classList.add('is-juste');
      else if (n === choix) b.classList.add('is-faux');
    });

    const verdict = $('quizVerdict');
    if (data.correct) {
      verdict.textContent = `✅ Bonne réponse ! +${data.gainQuestion}`;
      verdict.className = 'quiz__verdict is-juste';
    } else {
      verdict.textContent = data.horsTemps || choix === 0 ? '⏰ Temps écoulé' : '❌ Mauvaise réponse';
      verdict.className = 'quiz__verdict is-faux';
    }
    $('quizExplication').textContent = data.explication || '';
    $('quizScore').textContent = data.score;

    $('quizSuivant').textContent = data.derniere ? 'Voir le résultat' : 'Question suivante';
    $('quizRetour').hidden = false;
    $('quizSuivant').focus();

    if (data.derniere) resultatFinal = data.fin;
  }

  async function suivant() {
    if (resultatFinal) {
      afficherFin(resultatFinal);
      return;
    }

    const data = await appel(`${API}/next`, { sessionId });
    if (!data.success) {
      toast(data.message, 'danger');
      return;
    }
    afficherQuestion(data.question);
  }

  function afficherFin(fin) {
    sessionId = null;
    resultatFinal = null;
    afficherEcran('quizFin');

    $('quizFinBonnes').textContent = fin.bonnes;
    $('quizFinTotal').textContent = fin.total;

    const titre = $('quizFinTitre');
    const detail = $('quizFinDetail');

    if (fin.duel) {
      const d = fin.duel;
      if (d.statut === 'termine') {
        const libelles = { victoire: '🏆 Victoire', defaite: '❌ Défaite', egalite: '🤝 Égalité' };
        titre.textContent = `${libelles[d.resultat]} contre ${d.adversaire}`;
        detail.textContent = `Score : ${d.monScore ?? 0} à ${d.scoreAdversaire ?? 0}`;
      } else {
        titre.textContent = 'Score enregistré !';
        detail.textContent = `Score : ${fin.score}. En attente de la partie de ${d.adversaire}.`;
      }
      if (typeof window.finirModeDuel === 'function') window.finirModeDuel(d);
    } else {
      titre.textContent = fin.bonnes >= fin.total * 0.8 ? '🎉 Excellent !'
        : fin.bonnes >= fin.total / 2 ? '👍 Bien joué !' : '📚 Continuez à réviser !';
      detail.textContent = `Score : ${fin.score} · ${fin.gain > 0 ? `+${fin.gain} pts gagnés` : 'aucun point gagné'}`;

      if (fin.nouveauxPoints != null) {
        if (typeof window.updateUserBalance === 'function') window.updateUserBalance(fin.nouveauxPoints);
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user) {
          user.points = fin.nouveauxPoints;
          localStorage.setItem('user', JSON.stringify(user));
        }
      }
    }
  }

  // Touches 1 à 4 ou A à D pour répondre, Entrée pour continuer
  document.addEventListener('keydown', (e) => {
    if (!modal || !modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') { fermer(); return; }
    if (!attenteReponse) return;

    const index = ['1', '2', '3', '4'].indexOf(e.key) !== -1
      ? parseInt(e.key, 10)
      : LETTRES.indexOf(e.key.toUpperCase()) + 1;
    if (index >= 1 && index <= 4) repondre(index);
  });

  document.addEventListener('quizModalLoaded', () => window.initQuiz());
})();

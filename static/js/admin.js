// ========================================
// PAGE D'ADMINISTRATION (F7)
// ========================================
// Toutes les actions passent par /api/admin, qui vérifie le rôle à chaque requête.

(function () {
  'use strict';

  const API = '/api/admin';
  const $ = (id) => document.getElementById(id);
  const LETTRES = ['A', 'B', 'C', 'D'];

  let questions = [];
  let monId = null;

  // ── Utilitaires ──────────────────────────────────────────────────────────
  function echapper(texte) {
    const div = document.createElement('div');
    div.textContent = texte == null ? '' : String(texte);
    return div.innerHTML;
  }

  function toast(message, type = 'info') {
    const conteneur = $('toastContainer');
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = message;
    conteneur.appendChild(el);
    setTimeout(() => el.classList.add('is-visible'), 10);
    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  async function appel(methode, url, corps) {
    try {
      const res = await fetch(API + url, {
        method: methode,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: corps ? JSON.stringify(corps) : undefined
      });
      if (res.status === 401 || res.status === 403) {
        // Plus connecté ou plus admin : retour au site
        window.location.href = '/';
        return { success: false };
      }
      return await res.json();
    } catch (e) {
      return { success: false, message: 'Erreur réseau' };
    }
  }

  function retour(data) {
    toast(data.message || (data.success ? 'OK' : 'Erreur'), data.success ? 'success' : 'danger');
    return data.success;
  }

  // ── Onglets ──────────────────────────────────────────────────────────────
  document.querySelectorAll('.admin__onglet').forEach(onglet => {
    onglet.addEventListener('click', () => {
      document.querySelectorAll('.admin__onglet').forEach(o => {
        const actif = o === onglet;
        o.classList.toggle('is-actif', actif);
        o.setAttribute('aria-selected', String(actif));
      });
      document.querySelectorAll('.admin__panneau').forEach(p => {
        p.hidden = p.id !== `panneau-${onglet.dataset.onglet}`;
      });
    });
  });

  // ── Chiffres clés ────────────────────────────────────────────────────────
  async function chargerStats() {
    const data = await appel('GET', '/stats');
    if (!data.success) return;
    const s = data.stats;
    const tuiles = [
      ['Comptes actifs', s.comptes],
      ['Comptes suspendus', s.suspendus],
      ["Parties aujourd'hui", s.partiesAujourdhui],
      ['Duels terminés', s.duelsTermines],
      ['Questions actives', s.questionsActives]
    ];
    $('adminStats').innerHTML = tuiles.map(([libelle, valeur]) => `
      <div class="admin__tuile">
        <span class="admin__tuile-valeur">${Number(valeur).toLocaleString('fr-FR')}</span>
        <span class="admin__tuile-libelle">${libelle}</span>
      </div>`).join('');
  }

  // ========================================
  // COMPTES
  // ========================================
  let minuterieRecherche = null;
  $('rechercheCompte').addEventListener('input', () => {
    clearTimeout(minuterieRecherche);
    minuterieRecherche = setTimeout(chargerComptes, 250);
  });

  async function chargerComptes() {
    const recherche = $('rechercheCompte').value.trim();
    const data = await appel('GET', `/comptes?recherche=${encodeURIComponent(recherche)}`);
    if (!data.success) return;
    monId = data.monId;

    const corps = $('listeComptes');
    if (data.comptes.length === 0) {
      corps.innerHTML = '<tr><td colspan="6" class="admin__vide">Aucun compte trouvé.</td></tr>';
      return;
    }

    corps.innerHTML = data.comptes.map(c => {
      const etats = [];
      if (c.admin) etats.push('<span class="admin__badge admin__badge--admin">Admin</span>');
      if (c.banni) etats.push('<span class="admin__badge admin__badge--banni">Suspendu</span>');
      if (!c.compte_verifie) etats.push('<span class="admin__badge">Non vérifié</span>');
      if (etats.length === 0) etats.push('<span class="admin__badge admin__badge--ok">Actif</span>');

      const estMoi = c.id === monId;
      const actions = estMoi ? '<span class="admin__note">(vous)</span>' : `
        <button class="duel__bouton duel__bouton--secondaire" data-action="renommer" data-id="${c.id}"
          data-pseudo="${echapper(c.pseudo)}">Renommer</button>
        <button class="duel__bouton duel__bouton--secondaire" data-action="${c.banni ? 'reactiver' : 'suspendre'}"
          data-id="${c.id}" data-pseudo="${echapper(c.pseudo)}">${c.banni ? 'Réactiver' : 'Suspendre'}</button>
        <button class="duel__bouton admin__bouton--danger" data-action="supprimer" data-id="${c.id}"
          data-pseudo="${echapper(c.pseudo)}">Supprimer</button>`;

      return `
        <tr class="${c.banni ? 'admin__ligne--banni' : ''}">
          <td><strong>${echapper(c.pseudo)}</strong></td>
          <td>${echapper(c.email)}</td>
          <td>${echapper(c.classe)}</td>
          <td class="admin__nombre">${Number(c.points).toLocaleString('fr-FR')}</td>
          <td>${etats.join(' ')}</td>
          <td class="admin__cellule-actions">${actions}</td>
        </tr>`;
    }).join('');
  }

  $('listeComptes').addEventListener('click', async (e) => {
    const bouton = e.target.closest('[data-action]');
    if (!bouton) return;
    const { action, id, pseudo } = bouton.dataset;

    if (action === 'renommer') {
      const nouveau = prompt(`Nouveau pseudo pour « ${pseudo} » (3 à 15 caractères) :`, pseudo);
      if (!nouveau || nouveau.trim() === pseudo) return;
      if (retour(await appel('POST', `/comptes/${id}/pseudo`, { pseudo: nouveau.trim() }))) chargerComptes();
    }

    if (action === 'suspendre' || action === 'reactiver') {
      const suspendre = action === 'suspendre';
      if (suspendre && !confirm(`Suspendre « ${pseudo} » ? Il ne pourra plus se connecter.`)) return;
      if (retour(await appel('POST', `/comptes/${id}/suspendre`, { suspendu: suspendre }))) {
        chargerComptes();
        chargerStats();
      }
    }

    if (action === 'supprimer') {
      if (!confirm(`Supprimer définitivement le compte « ${pseudo} » et toutes ses données (parties, duels, historique) ?`)) return;
      if (retour(await appel('DELETE', `/comptes/${id}`))) {
        chargerComptes();
        chargerStats();
      }
    }
  });

  // ========================================
  // QUESTIONS DE QUIZ
  // ========================================
  async function chargerQuestions() {
    const data = await appel('GET', '/questions');
    if (!data.success) return;
    questions = data.questions;

    // Thèmes existants : liste de suggestions + filtre
    const themes = [...new Set(questions.map(q => q.theme))].sort((a, b) => a.localeCompare(b, 'fr'));
    $('listeThemes').innerHTML = themes.map(t => `<option value="${echapper(t)}">`).join('');

    const filtre = $('filtreTheme');
    const choisi = filtre.value;
    filtre.innerHTML = '<option value="">Tous les thèmes</option>' +
      themes.map(t => `<option value="${echapper(t)}">${echapper(t)}</option>`).join('');
    filtre.value = themes.includes(choisi) ? choisi : '';

    afficherQuestions();
  }

  $('filtreTheme').addEventListener('change', afficherQuestions);

  function afficherQuestions() {
    const theme = $('filtreTheme').value;
    const liste = theme ? questions.filter(q => q.theme === theme) : questions;
    const actives = liste.filter(q => q.active).length;
    $('compteQuestions').textContent = `${liste.length} question(s), dont ${actives} active(s)`;

    const corps = $('listeQuestions');
    if (liste.length === 0) {
      corps.innerHTML = '<tr><td colspan="5" class="admin__vide">Aucune question.</td></tr>';
      return;
    }

    corps.innerHTML = liste.map(q => {
      const bonne = q[`choix${q.bonne_reponse}`];
      return `
        <tr class="${q.active ? '' : 'admin__ligne--inactive'}">
          <td>${echapper(q.theme)}</td>
          <td>${echapper(q.question)}</td>
          <td>${LETTRES[q.bonne_reponse - 1]}. ${echapper(bonne)}</td>
          <td>
            <label class="admin__interrupteur">
              <input type="checkbox" data-action="active" data-id="${q.id}" ${q.active ? 'checked' : ''}
                aria-label="Question active">
              <span>${q.active ? 'Oui' : 'Non'}</span>
            </label>
          </td>
          <td class="admin__cellule-actions">
            <button class="duel__bouton duel__bouton--secondaire" data-action="modifier" data-id="${q.id}">Modifier</button>
            <button class="duel__bouton admin__bouton--danger" data-action="supprimer" data-id="${q.id}">Supprimer</button>
          </td>
        </tr>`;
    }).join('');
  }

  $('listeQuestions').addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const id = parseInt(el.dataset.id, 10);

    if (el.dataset.action === 'active') {
      if (retour(await appel('POST', `/questions/${id}/active`, { active: el.checked }))) {
        chargerQuestions();
        chargerStats();
      } else {
        el.checked = !el.checked;
      }
    }

    if (el.dataset.action === 'modifier') {
      remplirFormulaire(questions.find(q => q.id === id));
    }

    if (el.dataset.action === 'supprimer') {
      const q = questions.find(x => x.id === id);
      if (!confirm(`Supprimer la question « ${q.question} » ?\nAstuce : la désactiver la retire du quiz sans la perdre.`)) return;
      if (retour(await appel('DELETE', `/questions/${id}`))) {
        if ($('questionId').value === String(id)) viderFormulaire();
        chargerQuestions();
        chargerStats();
      }
    }
  });

  function remplirFormulaire(q) {
    $('questionId').value = q.id;
    $('questionTheme').value = q.theme;
    $('questionTexte').value = q.question;
    [1, 2, 3, 4].forEach(i => { $(`choix${i}`).value = q[`choix${i}`]; });
    $(`bonne${q.bonne_reponse}`).checked = true;
    $('questionExplication').value = q.explication || '';

    $('formQuestionTitre').textContent = 'Modifier la question';
    $('boutonEnregistrer').textContent = 'Enregistrer les modifications';
    $('boutonAnnulerEdition').hidden = false;
    $('formQuestion').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('questionTexte').focus();
  }

  function viderFormulaire() {
    const theme = $('questionTheme').value; // on garde le thème pour enchaîner les ajouts
    $('formQuestion').reset();
    $('questionId').value = '';
    $('questionTheme').value = theme;
    $('formQuestionTitre').textContent = 'Ajouter une question';
    $('boutonEnregistrer').textContent = 'Ajouter la question';
    $('boutonAnnulerEdition').hidden = true;
  }

  $('boutonAnnulerEdition').addEventListener('click', viderFormulaire);

  $('formQuestion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const coche = document.querySelector('input[name="bonne"]:checked');
    const corps = {
      theme: $('questionTheme').value,
      question: $('questionTexte').value,
      choix: [1, 2, 3, 4].map(i => $(`choix${i}`).value),
      bonne: coche ? parseInt(coche.value, 10) : null,
      explication: $('questionExplication').value
    };

    const id = $('questionId').value;
    const data = id
      ? await appel('PUT', `/questions/${id}`, corps)
      : await appel('POST', '/questions', corps);

    if (retour(data)) {
      viderFormulaire();
      chargerQuestions();
      chargerStats();
      $('questionTexte').focus();
    }
  });

  // ── Démarrage ────────────────────────────────────────────────────────────
  chargerStats();
  chargerComptes();
  chargerQuestions();
})();

// ========================================
// GESTION DU CLASSEMENT - VERSION CLEAN
// ========================================

let currentLeaderboardTab = 'individuel';
let isLeaderboardInitialized = false;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadLeaderboard(type = 'individuel') {
  const tbody = document.getElementById(`leaderboard-${type}-body`);
  if (!tbody) return;

  const colonnes = type === 'classe' ? 5 : 4;
  tbody.innerHTML = `<tr><td colspan="${colonnes}" style="text-align: center;">Chargement...</td></tr>`;

  try {
    // Classement par jeu : le jeu est choisi dans la liste déroulante
    const url = type === 'jeu'
      ? `/api/classement/jeu/${encodeURIComponent(document.getElementById('leaderboardJeu').value)}`
      : `/api/classement/${type}`;
    const response = await fetch(url);
    const data = await response.json();

    if (type === 'individuel') {
      displayIndividualLeaderboard(data);
    } else if (type === 'jeu') {
      displayGameLeaderboard(data);
    } else {
      displayClassLeaderboard(data);
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="${colonnes}" style="text-align: center; color: red;">Erreur: ${escapeHtml(error.message)}</td></tr>`;
  }
}

// Classement par jeu : top 10 des meilleurs scores, et la ligne du joueur s'il est plus loin
function displayGameLeaderboard(data) {
  const tbody = document.getElementById('leaderboard-jeu-body');
  if (!tbody) return;

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Aucune partie jouée pour l\'instant</td></tr>';
    return;
  }

  const ligne = (player) => {
    const isCurrentUser = user.logged && user.pseudo === player.pseudo;
    const rankClass = player.position <= 3 ? `leaderboard__rank--${player.position}` : '';
    return `
      <tr class="${isCurrentUser ? 'leaderboard__row--current' : ''}">
        <td class="leaderboard__rank ${rankClass}">#${player.position}</td>
        <td class="leaderboard__name">${escapeHtml(player.pseudo)}</td>
        <td class="leaderboard__classe">${escapeHtml(player.classe)}</td>
        <td class="leaderboard__points">${player.meilleur_score.toLocaleString('fr-FR')}</td>
      </tr>
    `;
  };

  const top = data.slice(0, 10);
  let rows = top.map(ligne).join('');

  const moi = user.logged ? data.find(p => p.pseudo === user.pseudo) : null;
  if (moi && moi.position > top.length) {
    rows += `
      <tr class="leaderboard__row--separator">
        <td colspan="4" style="text-align: center; padding: 4px; opacity: 0.5;">• • •</td>
      </tr>
      ${ligne(moi)}
    `;
  }

  tbody.innerHTML = rows;
}

function displayIndividualLeaderboard(data) {
  const tbody = document.getElementById('leaderboard-individuel-body');
  if (!tbody) return;

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Aucun joueur</td></tr>';
    return;
  }

  const top5 = data.slice(0, 5);
  const currentUserData = user.logged ? data.find(player => player.pseudo === user.pseudo) : null;
  const userInTop5 = currentUserData && currentUserData.position <= 5;

  let rows = top5.map(player => {
    const isCurrentUser = user.logged && user.pseudo === player.pseudo;
    const rankClass = player.position <= 3 ? `leaderboard__rank--${player.position}` : '';
    const rowClass = isCurrentUser ? 'leaderboard__row--current' : '';

    return `
      <tr class="${rowClass}">
        <td class="leaderboard__rank ${rankClass}">#${player.position}</td>
        <td class="leaderboard__name">${escapeHtml(player.pseudo)}</td>
        <td class="leaderboard__classe">${escapeHtml(player.classe)}</td>
        <td class="leaderboard__points">${player.points.toLocaleString('fr-FR')} pts</td>
      </tr>
    `;
  }).join('');

  if (currentUserData && !userInTop5) {
    rows += `
      <tr class="leaderboard__row--separator">
        <td colspan="4" style="text-align: center; padding: 4px; opacity: 0.5;">• • •</td>
      </tr>
      <tr class="leaderboard__row--current">
        <td class="leaderboard__rank">#${currentUserData.position}</td>
        <td class="leaderboard__name">${escapeHtml(currentUserData.pseudo)}</td>
        <td class="leaderboard__classe">${escapeHtml(currentUserData.classe)}</td>
        <td class="leaderboard__points">${currentUserData.points.toLocaleString('fr-FR')} pts</td>
      </tr>
    `;
  }

  tbody.innerHTML = rows;
}

function displayClassLeaderboard(data) {
  const tbody = document.getElementById('leaderboard-classe-body');
  if (!tbody) return;

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucune classe</td></tr>';
    return;
  }

  const top5 = data.slice(0, 5);
  const currentClassData = user.logged ? data.find(classe => classe.classe === user.classe) : null;
  const currentClassPosition = currentClassData ? data.indexOf(currentClassData) + 1 : null;
  const classInTop5 = currentClassPosition && currentClassPosition <= 5;

  let rows = top5.map((classe, index) => {
    const position = index + 1;
    const isCurrentUserClass = user.logged && user.classe === classe.classe;
    const rankClass = position <= 3 ? `leaderboard__rank--${position}` : '';
    const rowClass = isCurrentUserClass ? 'leaderboard__row--current' : '';

    return `
      <tr class="${rowClass}">
        <td class="leaderboard__rank ${rankClass}">#${position}</td>
        <td class="leaderboard__name">${escapeHtml(classe.classe)}</td>
        <td>${classe.membres}</td>
        <td class="leaderboard__points">${Math.round(classe.total_points).toLocaleString('fr-FR')} pts</td>
        <td>${Math.round(classe.moyenne_points).toLocaleString('fr-FR')} pts</td>
      </tr>
    `;
  }).join('');

  if (currentClassData && !classInTop5) {
    rows += `
      <tr class="leaderboard__row--separator">
        <td colspan="5" style="text-align: center; padding: 4px; opacity: 0.5;">• • •</td>
      </tr>
      <tr class="leaderboard__row--current">
        <td class="leaderboard__rank">#${currentClassPosition}</td>
        <td class="leaderboard__name">${escapeHtml(currentClassData.classe)}</td>
        <td>${currentClassData.membres}</td>
        <td class="leaderboard__points">${Math.round(currentClassData.total_points).toLocaleString('fr-FR')} pts</td>
        <td>${Math.round(currentClassData.moyenne_points).toLocaleString('fr-FR')} pts</td>
      </tr>
    `;
  }

  tbody.innerHTML = rows;
}

// ========================================
// MODAL CLASSEMENT COMPLET
// ========================================

function createLeaderboardModal() {
  if (document.getElementById('leaderboard-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'leaderboard-modal';
  modal.style.cssText = `
    display: none;
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 9999;
    justify-content: center;
    align-items: center;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--bg-secondary, #1e1e2e);
      border-radius: 12px;
      width: 90%;
      max-width: 700px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    ">
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      ">
        <h2 style="margin: 0; color: var(--text-primary, #fff); font-size: 1.3rem;">🏆 Classement complet</h2>
        <div style="display: flex; gap: 10px; align-items: center;">
          <div style="display: flex; gap: 6px;">
            <button id="modal-tab-individuel" onclick="switchModalTab('individuel')" style="
              padding: 6px 14px;
              border-radius: 6px;
              border: none;
              cursor: pointer;
              background: var(--primary-green);
              color: white;
              font-size: 0.85rem;
            ">Individuel</button>
            <button id="modal-tab-classe" onclick="switchModalTab('classe')" style="
              padding: 6px 14px;
              border-radius: 6px;
              border: none;
              cursor: pointer;
              background: rgba(255,255,255,0.1);
              color: var(--text-primary, #fff);
              font-size: 0.85rem;
            ">Classe</button>
          </div>
          <button onclick="closeLeaderboardModal()" style="
            background: none;
            border: none;
            color: var(--text-primary, #fff);
            font-size: 1.5rem;
            cursor: pointer;
            line-height: 1;
          ">✕</button>
        </div>
      </div>
      <div id="modal-leaderboard-content" style="overflow-y: auto; padding: 16px 24px; flex: 1;">
        <p style="text-align:center; color: var(--text-secondary, #aaa);">Chargement...</p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeLeaderboardModal();
  });
}

let currentModalTab = 'individuel';
let modalDataCache = { individuel: null, classe: null };

async function openLeaderboardModal() {
  createLeaderboardModal();
  const modal = document.getElementById('leaderboard-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  currentModalTab = currentLeaderboardTab;
  modalDataCache = { individuel: null, classe: null };
  await loadModalData(currentModalTab);
}

function closeLeaderboardModal() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

async function switchModalTab(type) {
  currentModalTab = type;

  document.getElementById('modal-tab-individuel').style.background =
    type === 'individuel' ? 'var(--primary-green)' : 'rgba(255,255,255,0.1)';
  document.getElementById('modal-tab-classe').style.background =
    type === 'classe' ? 'var(--primary-green)' : 'rgba(255,255,255,0.1)';

  await loadModalData(type);
}

async function loadModalData(type) {
  const content = document.getElementById('modal-leaderboard-content');
  if (!content) return;

  if (modalDataCache[type]) {
    renderModalData(type, modalDataCache[type]);
    return;
  }

  content.innerHTML = '<p style="text-align:center; color: var(--text-secondary, #aaa);">Chargement...</p>';

  try {
    const response = await fetch(`/api/classement/${type}`);
    const data = await response.json();
    modalDataCache[type] = data;
    renderModalData(type, data);
  } catch (error) {
    content.innerHTML = `<p style="text-align:center; color: red;">Erreur: ${error.message}</p>`;
  }
}

function renderModalData(type, data) {
  const content = document.getElementById('modal-leaderboard-content');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!data || data.length === 0) {
    content.innerHTML = '<p style="text-align:center; color: var(--text-secondary, #aaa);">Aucune donnée</p>';
    return;
  }

  let html = '';

  if (type === 'individuel') {
    html = `
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr style="color: var(--text-secondary, #aaa); font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <th style="padding: 8px; text-align:left;">#</th>
            <th style="padding: 8px; text-align:left;">Joueur</th>
            <th style="padding: 8px; text-align:left;">Classe</th>
            <th style="padding: 8px; text-align:right;">Points</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(player => {
      const isCurrentUser = user.logged && user.pseudo === player.pseudo;
      const medals = ['🥇', '🥈', '🥉'];
      const rank = player.position <= 3 ? medals[player.position - 1] : `#${player.position}`;
      return `
              <tr style="
                border-bottom: 1px solid rgba(255,255,255,0.05);
                background: ${isCurrentUser ? 'rgba(16, 185, 129, 0.1)' : 'transparent'};
              ">
                <td style="padding: 10px 8px; font-weight: bold;">${rank}</td>
                <td style="padding: 10px 8px; ${isCurrentUser ? 'color: var(--primary-green); font-weight: bold;' : ''}">${escapeHtml(player.pseudo)}</td>
                <td style="padding: 10px 8px; color: var(--text-secondary, #aaa);">${escapeHtml(player.classe)}</td>
                <td style="padding: 10px 8px; text-align:right; font-weight: bold;">${player.points.toLocaleString('fr-FR')} pts</td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    `;
  } else {
    html = `
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr style="color: var(--text-secondary, #aaa); font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <th style="padding: 8px; text-align:left;">#</th>
            <th style="padding: 8px; text-align:left;">Classe</th>
            <th style="padding: 8px; text-align:center;">Membres</th>
            <th style="padding: 8px; text-align:right;">Total</th>
            <th style="padding: 8px; text-align:right;">Moyenne</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((classe, index) => {
      const position = index + 1;
      const isCurrentClass = user.logged && user.classe === classe.classe;
      const medals = ['🥇', '🥈', '🥉'];
      const rank = position <= 3 ? medals[position - 1] : `#${position}`;
      return `
              <tr style="
                border-bottom: 1px solid rgba(255,255,255,0.05);
                background: ${isCurrentClass ? 'rgba(16, 185, 129, 0.1)' : 'transparent'};
              ">
                <td style="padding: 10px 8px; font-weight: bold;">${rank}</td>
                <td style="padding: 10px 8px; ${isCurrentClass ? 'color: var(--primary-green); font-weight: bold;' : ''}">${escapeHtml(classe.classe)}</td>
                <td style="padding: 10px 8px; text-align:center;">${classe.membres}</td>
                <td style="padding: 10px 8px; text-align:right; font-weight: bold;">${Math.round(classe.total_points).toLocaleString('fr-FR')} pts</td>
                <td style="padding: 10px 8px; text-align:right; color: var(--text-secondary, #aaa);">${Math.round(classe.moyenne_points).toLocaleString('fr-FR')} pts</td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    `;
  }

  content.innerHTML = html;
}

// ========================================
// TABS & INIT
// ========================================

function setupLeaderboardTabs() {
  const tabs = document.querySelectorAll('.leaderboard__tab');
  if (tabs.length === 0) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      const tabType = this.dataset.tab;

      document.querySelectorAll('.leaderboard__tab').forEach(t => {
        t.classList.remove('leaderboard__tab--active');
      });
      this.classList.add('leaderboard__tab--active');

      document.querySelectorAll('.leaderboard__content').forEach(c => {
        c.classList.remove('leaderboard__content--active');
      });

      const target = document.getElementById(`leaderboard-${tabType}`);
      if (target) target.classList.add('leaderboard__content--active');

      currentLeaderboardTab = tabType;
      loadLeaderboard(tabType);
    });
  });
}

function setupLeaderboardRefresh() {
  const refreshBtn = document.getElementById('leaderboardRefresh');
  if (!refreshBtn) return;

  refreshBtn.addEventListener('click', () => {
    loadLeaderboard(currentLeaderboardTab);
  });
}

function setupLeaderboardModal() {
  const refreshBtn = document.getElementById('leaderboardRefresh');
  if (!refreshBtn) return;

  // Créer le bouton dynamiquement
  const btn = document.createElement('button');
  btn.id = 'leaderboardSeeAll';
  btn.textContent = 'Voir tout le classement';
  btn.style.cssText = `
    margin-top: 12px;
    width: 100%;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    color: var(--text-secondary, #aaa);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(255,255,255,0.05)';
    btn.style.color = 'var(--text-primary, #fff)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent';
    btn.style.color = 'var(--text-secondary, #aaa)';
  });

  btn.addEventListener('click', () => openLeaderboardModal());

  // Insérer après le tableau de classement
  const leaderboardContainer = refreshBtn.closest('.leaderboard') || refreshBtn.parentElement;
  leaderboardContainer.appendChild(btn);
}

function initLeaderboard() {
  if (isLeaderboardInitialized) return;

  const tbody = document.getElementById('leaderboard-individuel-body');
  if (!tbody) return;

  setupLeaderboardTabs();
  setupLeaderboardRefresh();

  const choixJeu = document.getElementById('leaderboardJeu');
  if (choixJeu) choixJeu.addEventListener('change', () => loadLeaderboard('jeu'));
  setupLeaderboardModal();
  loadLeaderboard('individuel');

  isLeaderboardInitialized = true;
}

window.initLeaderboard = initLeaderboard;
window.openLeaderboardModal = openLeaderboardModal;
window.closeLeaderboardModal = closeLeaderboardModal;
window.switchModalTab = switchModalTab;

document.addEventListener('leaderboardLoaded', () => {
  setTimeout(initLeaderboard, 300);
});

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!isLeaderboardInitialized && document.getElementById('leaderboard-individuel-body')) {
      initLeaderboard();
    }
  }, 1500);
});

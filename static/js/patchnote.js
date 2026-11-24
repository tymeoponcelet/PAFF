// ========================================
// PATCH NOTES - Données statiques
// ========================================

// trois type de type (new, fix & balance)
const PATCH_NOTES_DATA = [
    {
        version: '1.4.0',
        type: 'new',
        date: '2026-03-20',
        changes: [
            "Nouveau jeu : Roulette !",
            "Nouveau jeu : ###### (Réservé au perdant)"
        ]
    },
    {
        version: '1.4.0',
        type: 'balance',
        date: '2026-03-20',
        changes: [
            "Augmentation de la difficulté du bot de Puissance 4 (les BSI nous font faire n'importe quoi…)",
            "Réduction d'un multiplicateur dans le mode Plinko (difficile : 7x-->5x)",
            "Réduction d'un multiplicateur sur le Flappy bird (5-19pts x0.5 --> x0)"
        ]
    },
    {
        version: '1.3.2',
        type: 'fix',
        date: '2026-03-18',
        changes: [
            "Correction d'un problème qui limitait la mise maximum au blackjack",
            "Correction d'un problème qui misait plus de points que prévu au blackjack"
        ]
    },
    {
        version: '1.3.1',
        type: 'balance',
        date: '2026-03-18',
        changes: [
            "Réduction des multiplicateurs dans le mode Plinko (facile)",
            "Augmentation du multiplicateur sur le Hi-Low"
        ]
    },
    {
        version: '1.3.0',
        type: 'new',
        date: '2026-03-18',
        changes: [
            "Nouveau jeu : Hi-Low",
            "Nouveau jeu mystère à venir...",
            "Le point maximal atteint par la fusée est maintenant indiqué après un encaissement"
        ]
    },
    {
        version: '1.2.1',
        type: 'fix',
        date: '2026-03-17',
        changes: [
            "Correction d'un problème qui permettait de truquer son score sur Flappy Bird ; ceux qui ont profité de cette faille ont été sanctionnés.",
        ]
    },
    {
        version: '1.2.0',
        type: 'new',
        date: '2026-03-17',
        changes: [
            'Jeu mystère… (à venir)',
            "Ajout d'un bouton pour afficher le classement complet",
            "Ajout d'un système permettant d'ouvrir plusieurs coffre à la fois"
        ]
    },
    {
        version: '1.2.0',
        type: 'balance',
        date: '2026-03-17',
        changes: [
            'Le bot de Puissance 4 est désormais plus facile à vaincre.',
            'La logique du jeu Démineur a été modifiée.'
        ]
    },
];

// ========================================

let currentFilter = 'all';
let isPatchNotesInitialized = false;

const BADGE_LABELS = {
    new: 'Nouveauté',
    fix: 'Correction',
    balance: 'Équilibrage',
};

function escapeHtmlPN(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderPatchNotes(filter = 'all', showAll = false) {
    const list = document.getElementById('patchnotes-list');
    if (!list) return;

    const filtered = filter === 'all'
        ? PATCH_NOTES_DATA
        : PATCH_NOTES_DATA.filter(entry => entry.type === filter);

    if (filtered.length === 0) {
        list.innerHTML = '<p class="patchnotes__empty">Aucune entrée trouvée.</p>';
        return;
    }

    const visible = showAll ? filtered : filtered.slice(0, 3);
    const hasMore = filtered.length > 3;

    const items = visible.map(entry => {
        const badge = BADGE_LABELS[entry.type] || entry.type;
        const date = new Date(entry.date).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        const changes = entry.changes.map(c => `<li>${escapeHtmlPN(c)}</li>`).join('');

        return `
      <div class="patchnotes__entry" data-type="${entry.type}">
        <div class="patchnotes__entry-header">
          <span class="patchnotes__version">v${escapeHtmlPN(entry.version)}</span>
          <span class="patchnotes__badge patchnotes__badge--${entry.type}">${badge}</span>
          <span class="patchnotes__date">${date}</span>
        </div>
        <ul class="patchnotes__items">${changes}</ul>
      </div>
    `;
    }).join('');

    const button = (!showAll && hasMore)
        ? `<button class="patchnotes__show-more" onclick="renderPatchNotes('${filter}', true)">
        Afficher tout (${filtered.length})
       </button>`
        : '';

    list.innerHTML = items + button;
}

function setupPatchNotesTabs() {
    const tabs = document.querySelectorAll('.patchnotes__tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            tabs.forEach(t => t.classList.remove('patchnotes__tab--active'));
            this.classList.add('patchnotes__tab--active');
            currentFilter = this.dataset.filter;
            renderPatchNotes(currentFilter);
        });
    });
}

function initPatchNotes() {
    if (isPatchNotesInitialized) return;
    if (!document.getElementById('patchnotes-list')) return;

    setupPatchNotesTabs();
    renderPatchNotes('all');
    isPatchNotesInitialized = true;
}

document.addEventListener('DOMContentLoaded', initPatchNotes);
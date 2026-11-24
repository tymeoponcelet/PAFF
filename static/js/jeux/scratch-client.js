// ========================================
// SCRATCH GAME CLIENT — VERSION CORRIGÉE
// ========================================

const SCRATCH_API = '/actions/scratch';

// État du jeu
let scratchSessionId = null;
let scratchCells = [];
let scratchRevealed = 0;
let scratchDisabled = false;

// Récompenses flat (points fixes)
const SCRATCH_SYMBOLS = {
  diamond: { emoji: '💎', label: 'Jackpot', gain: 500 },
  gold:    { emoji: '🥇', label: 'Or',      gain: 200 },
  silver:  { emoji: '🥈', label: 'Argent',  gain: 100 },
  bronze:  { emoji: '🥉', label: 'Bronze',  gain: 50  },
  star:    { emoji: '⭐', label: 'Étoile',  gain: 25  },
  lose:    { emoji: '❌', label: '',        gain: 0   },
};

// ========================================
// ACHETER UN TICKET
// ========================================

async function scratchBuyTicket() {
  // Vérif côté client avant d'appeler le serveur
  const user = JSON.parse(localStorage.getItem('user'));
  if (user?.points >= 500) {
    scratchToast('Ce jeu est réservé aux joueurs avec moins de 500 pts.', 'danger');
    return;
  }

  document.getElementById('scratchBuyBtn').disabled = true;
  scratchDisabled = false;
  scratchRevealed = 0;

  try {
    const response = await fetch(`${SCRATCH_API}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({})
    });

    const data = await response.json();

    if (!data.success) {
      scratchToast(data.message, 'danger');
      document.getElementById('scratchBuyBtn').disabled = false;
      return;
    }

    scratchSessionId = data.sessionId;
    scratchUpdatePoints(data.newPoints);
    scratchCells = data.grid.map(sym => ({ symbol: sym, revealed: false }));
    scratchRenderGrid();

    document.getElementById('scratchRevealAllBtn').disabled = false;
    document.getElementById('scratchResetBtn').disabled = true;

    const resultEl = document.getElementById('scratchResult');
    resultEl.style.display = 'none';
    resultEl.textContent = '';

  } catch (err) {
    scratchToast('Erreur de connexion', 'danger');
    document.getElementById('scratchBuyBtn').disabled = false;
  }
}

// ========================================
// RENDRE LA GRILLE
// ========================================

function scratchRenderGrid() {
  const grid = document.getElementById('scratchGrid');
  grid.innerHTML = '';

  scratchCells.forEach((cell, index) => {
    const cellEl = document.createElement('div');
    cellEl.className = 'scratch__cell';
    cellEl.dataset.index = index;

    const sym = SCRATCH_SYMBOLS[cell.symbol] || SCRATCH_SYMBOLS.lose;

    cellEl.innerHTML = `
      <div class="scratch__cell-cover">
        <span class="scratch__cell-cover-icon"></span>
      </div>
      <div class="scratch__cell-content">
        <span class="scratch__cell-symbol">${sym.emoji}</span>
        ${sym.label ? `<span class="scratch__cell-value">${sym.label}</span>` : ''}
        ${sym.gain > 0 ? `<span class="scratch__cell-gain">+${sym.gain} pts</span>` : ''}
      </div>
    `;

    cellEl.addEventListener('click', () => scratchRevealCell(index));
    grid.appendChild(cellEl);
  });
}

// ========================================
// RÉVÉLER UNE CASE
// ========================================

function scratchRevealCell(index) {
  if (scratchDisabled) return;
  if (!scratchSessionId) return;
  if (scratchCells[index].revealed) return;

  scratchCells[index].revealed = true;
  scratchRevealed++;

  const cellEl = document.querySelector(`.scratch__cell[data-index="${index}"]`);
  cellEl.classList.add('scratch__cell--revealed');

  if (scratchRevealed === scratchCells.length) {
    scratchDisabled = true;
    document.getElementById('scratchRevealAllBtn').disabled = true;
    setTimeout(scratchResolve, 400);
  }
}

// ========================================
// TOUT RÉVÉLER
// ========================================

function scratchRevealAll() {
  if (scratchDisabled || !scratchSessionId) return;
  document.getElementById('scratchRevealAllBtn').disabled = true;
  scratchDisabled = true;

  let delay = 0;
  scratchCells.forEach((cell, i) => {
    if (!cell.revealed) {
      setTimeout(() => {
        scratchCells[i].revealed = true;
        scratchRevealed++;
        const cellEl = document.querySelector(`.scratch__cell[data-index="${i}"]`);
        if (cellEl) cellEl.classList.add('scratch__cell--revealed');
      }, delay);
      delay += 60;
    }
  });

  setTimeout(scratchResolve, delay + 400);
}

// ========================================
// RÉSOUDRE (appel serveur)
// ========================================

async function scratchResolve() {
  if (!scratchSessionId) return;

  try {
    const response = await fetch(`${SCRATCH_API}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: scratchSessionId })
    });

    const data = await response.json();

    if (!data.success) {
      scratchToast(data.message, 'danger');
      return;
    }

    if (data.winningSymbol) scratchHighlightWinners(data.winningSymbol);

    scratchUpdatePoints(data.newPoints);
    scratchShowResult(data);

    scratchSessionId = null;
    document.getElementById('scratchResetBtn').disabled = false;
    document.getElementById('scratchRevealAllBtn').disabled = true;

    document.querySelectorAll('.scratch__cell').forEach(el => {
      el.classList.add('scratch__cell--disabled');
    });

  } catch (err) {
    scratchToast('Erreur de connexion', 'danger');
  }
}

// ========================================
// HIGHLIGHT DES CASES GAGNANTES
// ========================================

function scratchHighlightWinners(winningSymbol) {
  scratchCells.forEach((cell, i) => {
    if (cell.symbol === winningSymbol) {
      const cellEl = document.querySelector(`.scratch__cell[data-index="${i}"]`);
      if (cellEl) cellEl.classList.add('scratch__cell--winner');
    }
  });
}

// ========================================
// AFFICHER LE RÉSULTAT
// ========================================

function scratchShowResult(data) {
  const resultEl = document.getElementById('scratchResult');

  if (data.won) {
    const sym = SCRATCH_SYMBOLS[data.winningSymbol] || {};
    resultEl.className = 'scratch__result scratch__result--win';
    resultEl.innerHTML = `
      🎉 ${sym.emoji || ''} Vous gagnez <strong>+${data.gain} pts</strong> !
      <br><small style="font-weight:400;opacity:.8;">${sym.label || ''} × 3 trouvés</small>
    `;
  } else {
    resultEl.className = 'scratch__result scratch__result--lose';
    resultEl.textContent = '😢 Pas de chance cette fois… Réessayez !';
  }

  resultEl.style.display = 'block';
}

// ========================================
// RESET
// ========================================

function scratchReset() {
  scratchSessionId = null;
  scratchCells = [];
  scratchRevealed = 0;
  scratchDisabled = false;

  document.getElementById('scratchGrid').innerHTML = '';
  document.getElementById('scratchResult').style.display = 'none';
  document.getElementById('scratchBuyBtn').disabled = false;
  document.getElementById('scratchRevealAllBtn').disabled = true;
  document.getElementById('scratchResetBtn').disabled = true;
}

// ========================================
// UTILITAIRES
// ========================================

function scratchUpdatePoints(newPoints) {
  if (newPoints == null) return;

  if (typeof window.updateUserBalance === 'function') {
    window.updateUserBalance(newPoints);
  }

  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    user.points = newPoints;
    localStorage.setItem('user', JSON.stringify(user));
  }
}

function scratchToast(message, type = 'info') {
  if (typeof showToast === 'function') {
    showToast(message, type);
  } else {
    const icon = type === 'danger' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    alert(`${icon} ${message}`);
  }
}

// ========================================
// INIT
// ========================================

function initScratch() {
  const modal = document.getElementById('scratchModal');
  if (!modal) return;

  const buyBtn = document.getElementById('scratchBuyBtn');
  const revealAllBtn = document.getElementById('scratchRevealAllBtn');
  const resetBtn = document.getElementById('scratchResetBtn');

  if (buyBtn) {
    buyBtn.replaceWith(buyBtn.cloneNode(true));
    document.getElementById('scratchBuyBtn').addEventListener('click', scratchBuyTicket);
  }

  if (revealAllBtn) {
    revealAllBtn.replaceWith(revealAllBtn.cloneNode(true));
    document.getElementById('scratchRevealAllBtn').addEventListener('click', scratchRevealAll);
  }

  if (resetBtn) {
    resetBtn.replaceWith(resetBtn.cloneNode(true));
    document.getElementById('scratchResetBtn').addEventListener('click', scratchReset);
  }

  const closeButtons = modal.querySelectorAll('.js-close-scratch-modal');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('is-open');
      setTimeout(scratchReset, 400);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('scratchModal')) initScratch();
});

document.addEventListener('scratchModalLoaded', initScratch);
// ========================================
// ROULETTE WIN POPUP - GESTION
// ========================================

/**
 * Affiche la popup de résultat Roulette
 * @param {Object} data - Données du spin
 * @param {number}  data.result        - Numéro sorti
 * @param {string}  data.color         - 'red'|'black'|'green'
 * @param {number}  data.totalBet      - Mise totale engagée
 * @param {number}  data.totalPayout   - Gains bruts
 * @param {number}  data.netVariation  - Gain net (peut être négatif)
 * @param {boolean} data.won           - Victoire ?
 * @param {Array}   data.betResults    - Détail des mises
 * @param {number}  data.newPoints     - Nouveau solde
 */
function showRouletteResultPopup(data) {
  const overlay = document.getElementById('rouletteWinPopupOverlay');
  if (!overlay) return;

  const icon    = document.getElementById('roulettePopupIcon');
  const title   = document.getElementById('roulettePopupTitle');
  const amount  = document.getElementById('roulettePopupAmount');
  const message = document.getElementById('roulettePopupMessage');
  const numEl   = document.getElementById('roulettePopupNumber');
  const betEl   = document.getElementById('roulettePopupBet');
  const balanceEl = document.getElementById('roulettePopupBalance');
  const detailEl  = document.getElementById('roulettePopupBetDetail');

  const won = !!data.won;
  const net = data.netVariation ?? 0;

  // Icône + titre
  if (icon)  icon.textContent  = won ? '🎉' : '😢';
  if (title) {
    title.textContent  = won ? 'GAGNÉ !' : 'PERDU';
    title.className    = `win-popup__title${won ? '' : ' win-popup__title--lose'}`;
  }

  // Montant net
  if (amount) {
    amount.textContent = `${net >= 0 ? '+' : ''}${net} pts`;
    amount.className   = `win-popup__amount${won ? '' : ' win-popup__amount--lose'}`;
  }

  // Message
  const colorLabel = data.color === 'red' ? '🔴 Rouge' : data.color === 'black' ? '⚫ Noir' : '🟢 Zéro';
  if (message) message.textContent = `Numéro ${data.result} — ${colorLabel}`;

  // Numéro tiré
  if (numEl) {
    numEl.textContent  = data.result;
    numEl.className    = `roulette-popup__number roulette-popup__number--${data.color}`;
  }

  // Détail des mises
  if (detailEl && Array.isArray(data.betResults)) {
    detailEl.innerHTML = data.betResults.map(bet => {
      const label = getBetLabelPopup(bet);
      const statusIcon = bet.won ? '✅' : '❌';
      const payoutText = bet.won ? `+${bet.payout} pts (x${bet.multiplier})` : `-${bet.amount} pts`;
      return `
        <div class="roulette-popup__bet-row ${bet.won ? 'roulette-popup__bet-row--won' : 'roulette-popup__bet-row--lost'}">
          <span>${statusIcon} ${label} (${bet.amount} pts)</span>
          <span>${payoutText}</span>
        </div>
      `;
    }).join('');
  }

  if (betEl)     betEl.textContent     = `${data.totalBet} pts`;
  if (balanceEl) balanceEl.textContent = `${data.newPoints ?? 0} pts`;

  // Confettis si gagné
  if (won) createRouletteConfetti();

  overlay.classList.add('active');
}

function getBetLabelPopup(bet) {
  switch (bet.type) {
    case 'color':   return bet.value === 'red' ? 'Rouge' : 'Noir';
    case 'parity':  return bet.value === 'even' ? 'Pair' : 'Impair';
    case 'straight': return `Plein ${bet.value}`;
    case 'dozen':
      return ['', '1-12', '13-24', '25-36'][parseInt(bet.value, 10)] || `Douzaine ${bet.value}`;
    default: return bet.type;
  }
}

function createRouletteConfetti() {
  const popup = document.querySelector('#rouletteWinPopupOverlay .win-popup');
  if (!popup) return;
  const colors = ['#ffd700','#ff6b6b','#4ecdc4','#45b7d1','#e74c3c','#2ecc71','#9b59b6'];
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDelay = Math.random() * 0.5 + 's';
      c.style.animationDuration = (Math.random() * 2 + 2) + 's';
      popup.appendChild(c);
      setTimeout(() => c.remove(), 3500);
    }, i * 30);
  }
}

function closeRouletteWinPopup() {
  const overlay = document.getElementById('rouletteWinPopupOverlay');
  if (overlay) overlay.classList.remove('active');
}

function initRouletteWinPopup() {
  const closeBtn = document.getElementById('roulettePopupCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeRouletteWinPopup);

  const overlay = document.getElementById('rouletteWinPopupOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeRouletteWinPopup();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('rouletteWinPopupOverlay')) initRouletteWinPopup();
});
document.addEventListener('rouletteWinPopupLoaded', initRouletteWinPopup);

window.showRouletteResultPopup = showRouletteResultPopup;
window.closeRouletteWinPopup   = closeRouletteWinPopup;
window.initRouletteWinPopup    = initRouletteWinPopup;
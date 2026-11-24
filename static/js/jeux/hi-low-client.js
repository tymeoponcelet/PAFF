// ========================================
// HI-LOW CLIENT
// ========================================

const HILOW_API = '/actions/hi-low';
let hilowSessionId = null;
let hilowStreak = 0;
let hilowPendingGain = 0;
let hilowBet = 0;

// ========================================
// DÉMARRER UNE PARTIE
// ========================================

async function hilowStart() {
  const betAmount = parseInt(document.getElementById('hilowBetAmount').value);
  const minBet = parseInt(document.getElementById('hilowBetAmount').min) || 50;

  if (isNaN(betAmount) || betAmount < minBet) {
    hilowToast(`Mise minimum : ${minBet} points`, 'danger');
    return;
  }

  document.getElementById('hilowDealBtn').disabled = true;
  hilowBet = betAmount;

  try {
    const response = await fetch(`${HILOW_API}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ betAmount })
    });

    const data = await response.json();

    if (!data.success) {
      hilowToast(data.message, 'danger');
      document.getElementById('hilowDealBtn').disabled = false;
      return;
    }

    hilowSessionId = data.sessionId;
    hilowStreak = 0;
    hilowPendingGain = 0;

    // Mettre à jour les points
    hilowUpdatePoints(data.newPoints);
    if (data.keyDropped && typeof window.showKeyDropPopup === 'function') {
      window.showKeyDropPopup();
    }
    if (data.keyDropped && typeof window.updateUserKeys === 'function' && data.userKeys != null) {
      window.updateUserKeys(data.userKeys);
    }

    // Afficher la carte courante
    hilowRenderCurrentCard(data.currentCard);
    hilowUpdateButtonMultipliers(data.nextMultipliers);
    hilowUpdateStreak(0, 0);
    hilowShowGuessButtons(true);
    hilowUpdateStatus('🎯 Plus haute, plus basse, ou égale ?');

  } catch (error) {
    hilowToast('Erreur de connexion', 'danger');
    document.getElementById('hilowDealBtn').disabled = false;
  }
}

// ========================================
// DEVINER
// ========================================

async function hilowGuess(guess) {
  if (!hilowSessionId) {
    hilowToast('Aucune partie en cours', 'danger');
    return;
  }

  hilowShowGuessButtons(false);
  hilowShowCashoutBtn(false);

  try {
    const response = await fetch(`${HILOW_API}/guess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: hilowSessionId, guess })
    });

    const data = await response.json();

    if (!data.success) {
      hilowToast(data.message, 'danger');
      hilowShowGuessButtons(true);
      return;
    }

    // Animer la révélation de la prochaine carte
    hilowRevealNextCard(data.prevCard, data.nextCard, data.correct, () => {
      if (data.correct) {
        hilowStreak = data.streak;
        hilowPendingGain = data.pendingGain;
        hilowUpdateStreak(data.streak, data.pendingGain);
        hilowUpdateButtonMultipliers(data.nextMultipliers);

        if (data.canContinue) {
          hilowUpdateStatus(`✅ Correct ! ×${data.multiplier} ce tour — Total ×${data.cumulativeMultiplier} — Continuez ou encaissez ?`);
          hilowShowGuessButtons(true);
          hilowShowCashoutBtn(true);
        } else {
          // Plus de cartes dans le deck : encaissement automatique
          hilowUpdateStatus('🃏 Deck épuisé — Encaissement automatique !');
          hilowCashout();
        }
      } else {
        // Défaite
        hilowSessionId = null;
        hilowUpdateStreak(data.streak, 0);
        hilowUpdatePoints(data.newPoints);
        hilowUpdateStatus(data.message);
        hilowShowResult('lose', data.streak);
        document.getElementById('hilowResetBtn').disabled = false;
      }
    });

  } catch (error) {
    hilowToast('Erreur de connexion', 'danger');
    hilowShowGuessButtons(true);
  }
}

// ========================================
// ENCAISSER
// ========================================

async function hilowCashout() {
  if (!hilowSessionId) return;

  hilowShowGuessButtons(false);
  hilowShowCashoutBtn(false);

  try {
    const response = await fetch(`${HILOW_API}/cashout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: hilowSessionId })
    });

    const data = await response.json();

    if (!data.success) {
      hilowToast(data.message, 'danger');
      return;
    }

    hilowSessionId = null;
    hilowUpdatePoints(data.newPoints);
    hilowUpdateStatus(data.message);
    hilowShowResult('win', hilowStreak, data.netGain);
    document.getElementById('hilowResetBtn').disabled = false;

  } catch (error) {
    hilowToast('Erreur de connexion', 'danger');
  }
}

// ========================================
// AFFICHAGE DES CARTES
// ========================================

/**
 * Affiche la carte courante au centre
 */
function hilowRenderCurrentCard(card) {
  const container = document.getElementById('hilowCurrentCard');
  container.innerHTML = '';
  const cardEl = hilowRenderCard(card, true);
  container.appendChild(cardEl);

  // Vider la zone "prochaine carte"
  const nextContainer = document.getElementById('hilowNextCard');
  nextContainer.innerHTML = '';
  nextContainer.innerHTML = `<div class="hilow__card-placeholder">?</div>`;
}

/**
 * Révèle la prochaine carte avec animation, puis callback
 */
function hilowRevealNextCard(prevCard, nextCard, correct, callback) {
  const nextContainer = document.getElementById('hilowNextCard');
  nextContainer.innerHTML = '';

  // Ajouter d'abord la carte dos
  const cardBack = hilowRenderCard({ hidden: true });
  nextContainer.appendChild(cardBack);

  // Après un délai, flip vers la vraie carte
  setTimeout(() => {
    nextContainer.innerHTML = '';
    const cardEl = hilowRenderCard(nextCard, true, correct);
    nextContainer.appendChild(cardEl);

    // Mettre à jour la "carte courante" après un délai
    setTimeout(() => {
      if (correct) {
        hilowRenderCurrentCard(nextCard);
      }
      if (callback) callback();
    }, 600);
  }, 500);
}

/**
 * Génère un élément carte (réutilise le même pattern que blackjack.js)
 */
function hilowRenderCard(card, flipped = false, correct = null) {
  const cardEl = document.createElement('div');
  cardEl.className = 'card card--dealing';

  // Carte cachée
  if (card.hidden === true) {
    cardEl.dataset.isHidden = 'true';
    cardEl.innerHTML = `
      <div class="card__inner">
        <div class="card__face card__face--back">
          <div class="card__pattern"></div>
        </div>
        <div class="card__face card__face--front"></div>
      </div>
    `;
    cardEl.addEventListener('animationend', () => {
      cardEl.classList.remove('card--dealing');
      cardEl.style.transform = 'none';
      cardEl.style.opacity = '1';
    }, { once: true });
    return cardEl;
  }

  if (!card.value || !card.suit) return document.createElement('div');

  const isRed = ['♥', '♦'].includes(card.suit);
  const colorClass = isRed ? 'card--red' : 'card--black';

  // Ajouter une classe de résultat visuel si applicable
  let resultClass = '';
  if (correct === true) resultClass = 'card--correct';
  else if (correct === false) resultClass = 'card--wrong';

  cardEl.className = `card card--dealing ${resultClass}`;
  cardEl.dataset.value = card.value;
  cardEl.dataset.suit = card.suit;

  cardEl.innerHTML = `
    <div class="card__inner is-flipped">
      <div class="card__face card__face--back">
        <div class="card__pattern"></div>
      </div>
      <div class="card__face card__face--front ${colorClass}">
        <div class="card__corner card__corner--top">
          <div class="card__value">${card.value}</div>
          <div class="card__suit">${card.suit}</div>
        </div>
        <div class="card__center">
          <div class="card__suit-large">${card.suit}</div>
        </div>
        <div class="card__corner card__corner--bottom">
          <div class="card__value">${card.value}</div>
          <div class="card__suit">${card.suit}</div>
        </div>
      </div>
    </div>
  `;

  cardEl.addEventListener('animationend', () => {
    cardEl.classList.remove('card--dealing');
    cardEl.style.transform = 'none';
    cardEl.style.opacity = '1';
  }, { once: true });

  return cardEl;
}

// ========================================
// RÉSULTAT FINAL
// ========================================

function hilowShowResult(type, streak, netGain = null) {
  const popup = document.getElementById('winPopupOverlay');

  if (typeof showBlackjackWinPopup === 'function' && popup) {
    // Réutiliser la popup existante si disponible
    const result = type === 'win' ? 'win' : 'lose';
    const gain = netGain !== null ? netGain : (type === 'lose' ? -hilowBet : 0);
    showBlackjackWinPopup({
      result,
      gain,
      bet: hilowBet,
      playerScore: streak,
      dealerScore: 0,
      newBalance: parseInt(document.querySelector('[data-user-points]')?.textContent) || 0,
      message: type === 'win'
        ? `💰 Encaissé après ${streak} bonne${streak > 1 ? 's' : ''} réponse${streak > 1 ? 's' : ''} !`
        : `❌ Perdu après ${streak} bonne${streak > 1 ? 's' : ''} réponse${streak > 1 ? 's' : ''}`
    });
  } else {
    // Fallback toast
    if (type === 'win') {
      hilowToast(`💰 Gagné ! +${netGain} pts (streak ×${streak})`, 'success');
    } else {
      hilowToast(`❌ Raté ! Streak : ${streak}`, 'danger');
    }
  }
}

// ========================================
// RÉINITIALISER
// ========================================

function hilowReset() {
  hilowSessionId = null;
  hilowStreak = 0;
  hilowPendingGain = 0;

  document.getElementById('hilowCurrentCard').innerHTML = `<div class="hilow__card-placeholder">🂠</div>`;
  document.getElementById('hilowNextCard').innerHTML = `<div class="hilow__card-placeholder">?</div>`;
  hilowUpdateStreak(0, 0);
  hilowUpdateStatus('💡 Pariez sur la prochaine carte !');
  hilowShowGuessButtons(false);
  hilowShowCashoutBtn(false);

  document.getElementById('hilowDealBtn').disabled = false;
  document.getElementById('hilowResetBtn').disabled = true;
}

// ========================================
// UTILITAIRES UI
// ========================================

function hilowShowGuessButtons(show) {
  const btns = document.getElementById('hilowGuessButtons');
  if (btns) btns.style.display = show ? 'flex' : 'none';
}

function hilowShowCashoutBtn(show) {
  const btn = document.getElementById('hilowCashoutBtn');
  if (btn) btn.style.display = show ? 'inline-flex' : 'none';
}

function hilowUpdateStreak(streak, pendingGain) {
  const el = document.getElementById('hilowStreak');
  if (!el) return;
  if (streak === 0) {
    el.textContent = '—';
    el.className = 'hilow__streak-value';
  } else {
    el.textContent = `×${streak}`;
    el.className = 'hilow__streak-value hilow__streak-value--active';
  }

  const gainEl = document.getElementById('hilowPendingGain');
  if (gainEl) {
    gainEl.textContent = pendingGain > 0 ? `${pendingGain} pts` : '—';
    gainEl.className = pendingGain > 0 ? 'hilow__gain-value hilow__gain-value--active' : 'hilow__gain-value';
  }
}

function hilowUpdateStatus(message) {
  const el = document.getElementById('hilowStatus');
  if (el) el.textContent = message;
}

function hilowUpdatePoints(newPoints) {
  if (newPoints === undefined || newPoints === null) return;

  const pointsDisplay = document.querySelector('[data-user-points]');
  if (pointsDisplay) pointsDisplay.textContent = `${newPoints} pts`;

  if (typeof window.updateUserBalance === 'function') {
    window.updateUserBalance(newPoints);
  }

  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    user.points = newPoints;
    localStorage.setItem('user', JSON.stringify(user));
  }
}

function hilowToast(message, type = 'info') {
  const icon = type === 'danger' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  alert(`${icon} ${message}`);
}

function hilowUpdateButtonMultipliers(multipliers) {
  const h = document.getElementById('hilowHigherBtn');
  const l = document.getElementById('hilowLowerBtn');
  const e = document.getElementById('hilowEqualBtn');

  if (h) h.innerHTML = `⬆️ Plus haute <span class="hilow__odds-badge">×${multipliers.higher}</span>`;
  if (l) l.innerHTML = `⬇️ Plus basse <span class="hilow__odds-badge">×${multipliers.lower}</span>`;
  if (e) e.innerHTML = `✌️ Égale <span class="hilow__odds-badge">×${multipliers.equal}</span>`;
}

// ========================================
// INITIALISATION
// ========================================

function initHilow() {
  const modal = document.getElementById('hilowModal');
  if (!modal) return;

  const dealBtn = document.getElementById('hilowDealBtn');
  const resetBtn = document.getElementById('hilowResetBtn');
  const cashoutBtn = document.getElementById('hilowCashoutBtn');
  const higherBtn = document.getElementById('hilowHigherBtn');
  const lowerBtn = document.getElementById('hilowLowerBtn');
  const equalBtn = document.getElementById('hilowEqualBtn');

  // Nettoyer et réattacher les events
  [dealBtn, resetBtn, cashoutBtn, higherBtn, lowerBtn, equalBtn].forEach(btn => {
    if (!btn) return;
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });

  const d = document.getElementById('hilowDealBtn');
  const r = document.getElementById('hilowResetBtn');
  const c = document.getElementById('hilowCashoutBtn');
  const h = document.getElementById('hilowHigherBtn');
  const l = document.getElementById('hilowLowerBtn');
  const e = document.getElementById('hilowEqualBtn');

  if (d) d.addEventListener('click', hilowStart);
  if (r) r.addEventListener('click', hilowReset);
  if (c) c.addEventListener('click', hilowCashout);
  if (h) h.addEventListener('click', () => hilowGuess('higher'));
  if (l) l.addEventListener('click', () => hilowGuess('lower'));
  if (e) e.addEventListener('click', () => hilowGuess('equal'));

  // Boutons de fermeture
  modal.querySelectorAll('.js-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('is-open');
      setTimeout(hilowReset, 400);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('hilowModal')) initHilow();
});
document.addEventListener('hilowModalLoaded', initHilow);
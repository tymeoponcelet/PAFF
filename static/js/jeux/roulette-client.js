// ========================================
// ROULETTE CLIENT
// ========================================

(function () {
  "use strict";

  const ROULETTE_API_BASE = "/actions/roulette";
  const MIN_BET = 10;
  const MAX_BET = 500;

  // Numéros rouges de la roulette européenne
  const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

  function getColor(num) {
    if (num === 0) return 'green';
    return RED_NUMBERS.has(num) ? 'red' : 'black';
  }

  // Mises en cours { key -> { type, value, amount } }
  // key = "color_red", "parity_even", "straight_7", "dozen_1" ...
  let currentBets = {};
  let isSpinning = false;

  // Montant de mise sélectionné par le joueur
  let selectedChipValue = 10;

  // ========================================
  // UTILITAIRES
  // ========================================

  function betKey(type, value) {
    return `${type}_${value}`;
  }

  function totalBetAmount() {
    return Object.values(currentBets).reduce((s, b) => s + b.amount, 0);
  }

  function placeBet(type, value) {
    if (isSpinning) return;
    const key = betKey(type, value);
    if (currentBets[key]) {
      currentBets[key].amount += selectedChipValue;
    } else {
      currentBets[key] = { type, value: String(value), amount: selectedChipValue };
    }
    renderBets();
    updateTotalDisplay();
  }

  function removeBet(key) {
    if (isSpinning) return;
    delete currentBets[key];
    renderBets();
    updateTotalDisplay();
  }

  function clearAllBets() {
    if (isSpinning) return;
    currentBets = {};
    renderBets();
    updateTotalDisplay();
  }

  // ========================================
  // RENDU DES MISES ACTIVES
  // ========================================

  function renderBets() {
    const container = document.getElementById("rouletteBetsList");
    if (!container) return;

    if (Object.keys(currentBets).length === 0) {
      container.innerHTML = '<p class="roulette__no-bets">Aucune mise placée</p>';
      return;
    }

    container.innerHTML = Object.entries(currentBets).map(([key, bet]) => {
      const label = getBetLabel(bet);
      return `
        <div class="roulette__bet-tag">
          <span class="roulette__bet-tag-label">${label}</span>
          <span class="roulette__bet-tag-amount">${bet.amount} pts</span>
          <button class="roulette__bet-tag-remove" data-key="${key}" title="Retirer">×</button>
        </div>
      `;
    }).join('');

    // Attacher les listeners de suppression
    container.querySelectorAll('.roulette__bet-tag-remove').forEach(btn => {
      btn.addEventListener('click', () => removeBet(btn.dataset.key));
    });

      container.scrollTop = container.scrollHeight;

  }

  function getBetLabel(bet) {
    switch (bet.type) {
      case 'color': return bet.value === 'red' ? '🔴 Rouge' : '⚫ Noir';
      case 'parity': return bet.value === 'even' ? '2️⃣ Pair' : '1️⃣ Impair';
      case 'straight': return `🎯 Plein ${bet.value}`;
      case 'dozen':
        const labels = { '1': '1ère douzaine', '2': '2ème douzaine', '3': '3ème douzaine' };
        return `📦 ${labels[bet.value] || 'Douzaine ' + bet.value}`;
      default: return bet.type;
    }
  }

  function updateTotalDisplay() {
    const totalEl = document.getElementById("rouletteTotalBet");
    const spinBtn = document.getElementById("rouletteSpinBtn");
    const total = totalBetAmount();
    if (totalEl) totalEl.textContent = `${total} pts`;
    if (spinBtn) spinBtn.disabled = total === 0 || isSpinning;
  }

  // ========================================
  // ANIMATION ROUE
  // ========================================

  // Ordre officiel des numéros sur la roulette européenne
  const WHEEL_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];

  const SEGMENT_ANGLE = 360 / 37;

function getWheelAngleForNumber(num) {
  const idx = WHEEL_ORDER.indexOf(num);
  const segmentAngle = 360 / 37;
  return -(idx * segmentAngle);
}

  function animateWheel(targetNumber, onComplete) {
  const wheelEl = document.getElementById("rouletteWheelInner");
  if (!wheelEl) { onComplete?.(); return; }

  const targetAngle = getWheelAngleForNumber(targetNumber);

  // Normalise entre 0 et 360 pour éviter les rotations négatives courtes
  const normalizedAngle = ((targetAngle % 360) + 360) % 360;

  // 6 tours complets + angle final
  const totalRotation = 360 * 6 + normalizedAngle;

  wheelEl.style.transition = 'none';
  wheelEl.style.transform = 'rotate(0deg)';
  void wheelEl.offsetWidth;

  wheelEl.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
  wheelEl.style.transform = `rotate(${totalRotation}deg)`;

  setTimeout(() => {
    wheelEl.style.transition = 'none';
    wheelEl.style.transform = `rotate(${normalizedAngle}deg)`;
    onComplete?.();
  }, 4100);
}

  function animateBall(targetNumber, onComplete) {
    const ballEl = document.getElementById("rouletteBall");
    if (!ballEl) { onComplete && onComplete(); return; }

    ballEl.style.display = 'block';
    ballEl.style.opacity = '1';

    // La balle tourne en sens inverse, plus vite au départ
    const ballWrapper = document.getElementById("rouletteBallWrapper");
    if (!ballWrapper) { onComplete && onComplete(); return; }

    const targetAngle = getWheelAngleForNumber(targetNumber);
    // Balle va dans le sens opposé, ralentit progressivement
    const ballRotation = -(360 * 8) - targetAngle;

    ballWrapper.style.transition = 'none';
    ballWrapper.style.transform = 'rotate(0deg)';
    void ballWrapper.offsetWidth;

    ballWrapper.style.transition = 'transform 4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    ballWrapper.style.transform = `rotate(${ballRotation}deg)`;

    setTimeout(() => {
      ballWrapper.style.transition = 'none';
      ballWrapper.style.transform = `rotate(${-targetAngle - (360 * 8)}deg)`;
      onComplete && onComplete();
    }, 4100);
  }

  // ========================================
  // LANCER LA ROULETTE
  // ========================================

  async function spinRoulette() {
    if (isSpinning || totalBetAmount() === 0) return;

    const betsArray = Object.values(currentBets);
    isSpinning = true;

    const modalContent = document.querySelector(".modal__body");

    if (modalContent) {
    modalContent.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const spinBtn = document.getElementById("rouletteSpinBtn");
    const clearBtn = document.getElementById("rouletteClearBtn");
    if (spinBtn) spinBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;

    try {
      const response = await fetch(`${ROULETTE_API_BASE}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bets: betsArray }),
      });

      const data = await response.json();

      if (!data.success) {
        alert(`❌ ${data.message}`);
        isSpinning = false;
        if (spinBtn) spinBtn.disabled = false;
        if (clearBtn) clearBtn.disabled = false;
        return;
      }

      // Mettre à jour l'affichage du numéro résultat
      const resultEl = document.getElementById("rouletteResultNumber");
      if (resultEl) {
        resultEl.textContent = '?';
        resultEl.className = 'roulette__result-number';
      }

      // Animer la roue
      animateWheel(data.result, () => {
        // Afficher le résultat
        if (resultEl) {
          resultEl.textContent = data.result;
          resultEl.className = `roulette__result-number roulette__result-number--${data.color}`;
        }

        // Mettre à jour les points
        updatePoints(data.newPoints);

        // Key drop
        if (data.keyDropped) {
          if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
          if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
            window.updateUserKeys(data.userKeys);
          }
        }

        // Afficher la popup de résultat
        showRouletteWinPopup(data);

        isSpinning = false;
        currentBets = {};
        renderBets();
        updateTotalDisplay();
        if (clearBtn) clearBtn.disabled = false;
      });

    } catch (error) {
      console.error("❌ Erreur spinRoulette:", error);
      alert("❌ Erreur de connexion au serveur");
      isSpinning = false;
      if (spinBtn) spinBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
    }
  }

  // ========================================
  // POPUP DE RÉSULTAT
  // ========================================

  function ensurePopupOverlay() {
    if (document.getElementById('rouletteWinPopupOverlay')) return;
    // Injecter la popup directement si elle n'a pas encore été chargée
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="win-popup-overlay" id="rouletteWinPopupOverlay">
        <div class="win-popup">
          <div class="win-popup__icon" id="roulettePopupIcon">🎰</div>
          <h2 class="win-popup__title" id="roulettePopupTitle">Résultat</h2>
          <div class="win-popup__amount" id="roulettePopupAmount">+0 pts</div>
          <div class="win-popup__details">
            <div style="display:flex;justify-content:center;margin:1rem 0;">
              <div class="roulette-popup__number" id="roulettePopupNumber">0</div>
            </div>
            <div class="roulette-popup__bet-detail" id="roulettePopupBetDetail"></div>
            <div class="win-popup__detail-row">
              <span class="win-popup__detail-label">Mise totale</span>
              <span class="win-popup__detail-value" id="roulettePopupBet">0 pts</span>
            </div>
            <div class="win-popup__detail-row">
              <span class="win-popup__detail-label">Nouveau solde</span>
              <span class="win-popup__detail-value" id="roulettePopupBalance">0 pts</span>
            </div>
          </div>
          <p class="win-popup__message" id="roulettePopupMessage"></p>
          <button class="win-popup__button" id="roulettePopupCloseBtn">Continuer</button>
        </div>
      </div>
      <style>
        .roulette-popup__number {
          width:64px;height:64px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-size:1.8rem;font-weight:900;
          border:4px solid rgba(255,255,255,0.3);
          animation:pegReveal 0.5s ease-out backwards;
        }
        .roulette-popup__number--red   { background:#c0392b; box-shadow:0 0 20px rgba(192,57,43,0.7); color:#fff; }
        .roulette-popup__number--black { background:#1a1a1a; box-shadow:0 0 20px rgba(255,255,255,0.3); color:#fff; }
        .roulette-popup__number--green { background:#1a8a1a; box-shadow:0 0 20px rgba(26,138,26,0.7); color:#fff; }
        .roulette-popup__bet-detail {
          display:flex;flex-direction:column;gap:0.4rem;
          margin:0.5rem 0;background:rgba(0,0,0,0.2);
          border-radius:8px;padding:0.75rem;font-size:0.85rem;
        }
        .roulette-popup__bet-row {
          display:flex;justify-content:space-between;align-items:center;
          padding:0.25rem 0;border-bottom:1px solid rgba(255,255,255,0.07);
        }
        .roulette-popup__bet-row:last-child { border-bottom:none; }
        .roulette-popup__bet-row--won  { color:#2ecc71; font-size: 180% }
        .roulette-popup__bet-row--lost { color:#e74c3c; font-size: 180% }
      </style>
    `;
    document.body.appendChild(div.firstElementChild);
    document.body.appendChild(div.lastElementChild);

    // Attacher fermeture
    const closeBtn = document.getElementById('roulettePopupCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeRoulettePopup);
    const overlay = document.getElementById('rouletteWinPopupOverlay');
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeRoulettePopup(); });
  }

  function closeRoulettePopup() {
    const overlay = document.getElementById('rouletteWinPopupOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function showRouletteWinPopup(data) {
    ensurePopupOverlay();

    const overlay = document.getElementById('rouletteWinPopupOverlay');
    const icon = document.getElementById('roulettePopupIcon');
    const title = document.getElementById('roulettePopupTitle');
    const amount = document.getElementById('roulettePopupAmount');
    const message = document.getElementById('roulettePopupMessage');
    const numEl = document.getElementById('roulettePopupNumber');
    const betEl = document.getElementById('roulettePopupBet');
    const balanceEl = document.getElementById('roulettePopupBalance');
    const detailEl = document.getElementById('roulettePopupBetDetail');

    if (!overlay) return;

    const won = !!data.won;
    const net = data.netVariation ?? 0;
    const colorLabel = data.color === 'red' ? '🔴 Rouge' : data.color === 'black' ? '⚫ Noir' : '🟢 Zéro';

    if (icon) icon.textContent = won ? '🎉' : '😢';
    if (title) {
      title.textContent = won ? 'GAGNÉ !' : 'PERDU';
      title.className = `win-popup__title${won ? '' : ' win-popup__title--lose'}`;
    }
    if (amount) {
      amount.textContent = `${net >= 0 ? '+' : ''}${net} pts`;
      amount.className = `win-popup__amount${won ? '' : ' win-popup__amount--lose'}`;
    }
    if (message) message.textContent = `Numéro ${data.result} — ${colorLabel}`;
    if (numEl) {
      numEl.textContent = data.result;
      numEl.className = `roulette-popup__number roulette-popup__number--${data.color}`;
    }
    if (detailEl && Array.isArray(data.betResults)) {
      detailEl.innerHTML = data.betResults.map(bet => {
        const label = getBetLabel(bet);
        const statusIcon = bet.won ? '✅' : '❌';
        const payoutText = bet.won ? `+${bet.payout} pts (x${bet.multiplier})` : `-${bet.amount} pts`;
        return `
          <div class="roulette-popup__bet-row ${bet.won ? 'roulette-popup__bet-row--won' : 'roulette-popup__bet-row--lost'}">
            <span>${statusIcon} ${label} (${bet.amount} pts)</span>
            <span>${payoutText}</span>
          </div>`;
      }).join('');
    }
    if (betEl) betEl.textContent = `${data.totalBet} pts`;
    if (balanceEl) balanceEl.textContent = `${data.newPoints ?? 0} pts`;

    if (won) {
      const popup = overlay.querySelector('.win-popup');
      if (popup) {
        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#e74c3c', '#2ecc71', '#9b59b6'];
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
    }

    overlay.classList.add('active');
  }

  // ========================================
  // MISE À JOUR DES POINTS
  // ========================================

  function updatePoints(newPoints) {
    if (newPoints === undefined || newPoints === null) return;
    const pointsDisplay = document.querySelector("[data-user-points]");
    if (pointsDisplay) pointsDisplay.textContent = `${newPoints} pts`;
    if (typeof window.updateUserBalance === "function") window.updateUserBalance(newPoints);
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user) { user.points = newPoints; localStorage.setItem("user", JSON.stringify(user)); }
    } catch (e) { }
  }

  // ========================================
  // RENDU DE LA GRILLE DE NUMÉROS
  // ========================================

  function renderNumberGrid() {
    const grid = document.getElementById("rouletteNumberGrid");
    if (!grid) return;
    grid.innerHTML = '';

    // Wrapper global
    const wrapper = document.createElement('div');
    wrapper.className = 'roulette__grid-wrapper';

    // ── Ligne zéro ──
    const zeroRow = document.createElement('div');
    zeroRow.className = 'roulette__zero-row';
    const zeroBtn = document.createElement('button');
    zeroBtn.type = 'button';
    zeroBtn.className = 'roulette__num roulette__num--green';
    zeroBtn.textContent = '0';
    zeroBtn.addEventListener('click', () => placeBet('straight', 0));
    zeroRow.appendChild(zeroBtn);
    wrapper.appendChild(zeroRow);

    // ── Grille 3 lignes × 12 colonnes ──
    // Ligne 3 : 3,6,9,12,15,18,21,24,27,30,33,36
    // Ligne 2 : 2,5,8,11,14,17,20,23,26,29,32,35
    // Ligne 1 : 1,4,7,10,13,16,19,22,25,28,31,34
    const numbersContainer = document.createElement('div');
    numbersContainer.className = 'roulette__numbers-inner';

    for (let row = 3; row >= 1; row--) {
      for (let col = 0; col < 12; col++) {
        const num = col * 3 + row;
        const color = RED_NUMBERS.has(num) ? 'red' : 'black';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `roulette__num roulette__num--${color}`;
        btn.textContent = num;
        btn.addEventListener('click', () => placeBet('straight', num));
        numbersContainer.appendChild(btn);
      }
    }
    wrapper.appendChild(numbersContainer);

    // ── Douzaines ──
    const dozensContainer = document.createElement('div');
    dozensContainer.className = 'roulette__dozens';
    [1, 2, 3].forEach(d => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'roulette__dozen-btn';
      btn.textContent = d === 1 ? '1-12' : d === 2 ? '13-24' : '25-36';
      btn.addEventListener('click', () => placeBet('dozen', d));
      dozensContainer.appendChild(btn);
    });
    wrapper.appendChild(dozensContainer);

    grid.appendChild(wrapper);
  }

  // ========================================
  // SÉLECTION DES JETONS
  // ========================================

  function initChipSelector() {
    const chips = document.querySelectorAll('#rouletteModal .roulette__chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('roulette__chip--active'));
        chip.classList.add('roulette__chip--active');
        selectedChipValue = parseInt(chip.dataset.value, 10);
      });
    });
    // Sélectionner le premier par défaut
    if (chips[0]) chips[0].classList.add('roulette__chip--active');
  }

  // ========================================
  // INITIALISATION
  // ========================================
  function buildWheelSVG() {
    const svg = document.getElementById("rouletteWheelInner");
    if (!svg) return;

    const WHEEL_ORDER = [
      0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
      5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    ];

    const total = 37;
    const angleStep = (2 * Math.PI) / total;
    const outerR = 118;
    const innerR = 40;   // rayon du centre (bouton doré)
    const textR = 94;   // rayon de placement des numéros
    const NS = "http://www.w3.org/2000/svg";

    let html = '';

    WHEEL_ORDER.forEach((num, i) => {
      const startAngle = i * angleStep - Math.PI / 2 - angleStep / 2;
      const endAngle = startAngle + angleStep;

      // Coordonnées arc extérieur
      const x1 = outerR * Math.cos(startAngle);
      const y1 = outerR * Math.sin(startAngle);
      const x2 = outerR * Math.cos(endAngle);
      const y2 = outerR * Math.sin(endAngle);

      // Coordonnées arc intérieur
      const ix1 = innerR * Math.cos(endAngle);
      const iy1 = innerR * Math.sin(endAngle);
      const ix2 = innerR * Math.cos(startAngle);
      const iy2 = innerR * Math.sin(startAngle);

      const color = num === 0 ? '#1a8a1a' : RED_NUMBERS.has(num) ? '#c0392b' : '#111111';
      const borderColor = 'rgba(255,215,0,0.25)';

      const d = [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 0 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerR} ${innerR} 0 0 0 ${ix2} ${iy2}`,
        'Z'
      ].join(' ');

      // Angle du texte (milieu du segment)
      const midAngle = startAngle + angleStep / 2;
      const tx = textR * Math.cos(midAngle);
      const ty = textR * Math.sin(midAngle);
      const textRotDeg = (midAngle * 180 / Math.PI) + 90; // texte vers l'extérieur

      html += `<path d="${d}" fill="${color}" stroke="${borderColor}" stroke-width="0.5"/>`;
      html += `<text
      x="${tx}" y="${ty}"
      text-anchor="middle"
      dominant-baseline="central"
      transform="rotate(${textRotDeg} ${tx} ${ty})"
      font-size="9"
      font-weight="700"
      font-family="sans-serif"
      fill="white"
    >${num}</text>`;
    });

    // Séparateurs dorés (lignes de segment) optionnels
    WHEEL_ORDER.forEach((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x1 = innerR * Math.cos(angle);
      const y1 = innerR * Math.sin(angle);
      const x2 = outerR * Math.cos(angle);
      const y2 = outerR * Math.sin(angle);
      html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,215,0,0.15)" stroke-width="0.5"/>`;
    });

    // Centre doré (hub)
    html += `<circle cx="0" cy="0" r="${innerR}" fill="radial-gradient(#2d1f0e,#1a1107)" stroke="#8B6914" stroke-width="2"/>`;
    html += `<circle cx="0" cy="0" r="${innerR}" fill="#1a1107" stroke="#8B6914" stroke-width="2"/>`;

    svg.innerHTML = html;
  }

  function initRoulette() {
    const modal = document.getElementById("rouletteModal");
    if (!modal) return;

    currentBets = {};
    isSpinning = false;
    selectedChipValue = 10;

    buildWheelSVG();
    renderNumberGrid();
    renderBets();
    updateTotalDisplay();
    initChipSelector();

    // Boutons de mise simple
    ['red', 'black'].forEach(color => {
      const btn = document.getElementById(`rouletteBet${color.charAt(0).toUpperCase() + color.slice(1)}`);
      if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => placeBet('color', color));
      }
    });

    ['even', 'odd'].forEach(parity => {
      const btn = document.getElementById(`rouletteBet${parity.charAt(0).toUpperCase() + parity.slice(1)}`);
      if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => placeBet('parity', parity));
      }
    });

    // Bouton Lancer
    const spinBtn = document.getElementById("rouletteSpinBtn");
    if (spinBtn) {
      const newSpinBtn = spinBtn.cloneNode(true);
      spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);
      newSpinBtn.addEventListener('click', spinRoulette);
    }

    // Bouton Effacer
    const clearBtn = document.getElementById("rouletteClearBtn");
    if (clearBtn) {
      const newClearBtn = clearBtn.cloneNode(true);
      clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
      newClearBtn.addEventListener('click', clearAllBets);
    }

    // Fermeture modale
    const closeButtons = modal.querySelectorAll(".js-close-modal");
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.classList.remove("is-open");
        setTimeout(() => resetRoulette(), 400);
      });
    });
  }

  function resetRoulette() {
    currentBets = {};
    isSpinning = false;
    selectedChipValue = 10;
    renderBets();
    updateTotalDisplay();
    const resultEl = document.getElementById("rouletteResultNumber");
    if (resultEl) { resultEl.textContent = '?'; resultEl.className = 'roulette__result-number'; }
  }

  // ========================================
  // EXPOSITION GLOBALE
  // ========================================

  window.initRoulette = initRoulette;
  window.resetRoulette = resetRoulette;

  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("rouletteModal")) initRoulette();
  });
  document.addEventListener("rouletteModalLoaded", initRoulette);

})();

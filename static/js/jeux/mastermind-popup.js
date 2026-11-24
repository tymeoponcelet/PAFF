// ========================================
// MASTERMIND WIN POPUP - GESTION
// ========================================

/**
 * Affiche la popup de résultat Mastermind
 * @param {Object} data - Données de la partie
 * @param {boolean} data.won - Victoire ou défaite
 * @param {number} data.attempts - Nombre de tentatives utilisées
 * @param {number} data.maxAttempts - Nombre maximum de tentatives
 * @param {number} data.winnings - Gains (positif ou négatif)
 * @param {Array} data.secretCode - Code secret
 * @param {number} data.newBalance - Nouveau solde
 * @param {string} data.message - Message personnalisé
 */
function showMastermindWinPopup(data) {
  //console.log('Affichage popup Mastermind:', data);

  const overlay = document.getElementById('mastermindWinPopupOverlay');
  const icon = document.getElementById('mastermindPopupIcon');
  const title = document.getElementById('mastermindPopupTitle');
  const amount = document.getElementById('mastermindPopupAmount');
  const message = document.getElementById('mastermindPopupMessage');
  const secretCodeEl = document.getElementById('mastermindPopupSecretCode');
  const attemptsEl = document.getElementById('mastermindPopupAttempts');
  const betEl = document.getElementById('mastermindPopupBet');
  const balanceEl = document.getElementById('mastermindPopupBalance');

  if (!overlay) {
    //console.error(' Popup overlay introuvable');
    return;
  }

  // Icône et titre selon le résultat
  if (data.won) {
    icon.textContent = '🎉';
    title.textContent = 'BRAVO !';
    title.className = 'win-popup__title';
    amount.className = 'win-popup__amount';
    
    // Ajouter des confettis
    createMastermindConfetti();
  } else {
    icon.textContent = '😢';
    title.textContent = 'PERDU';
    title.className = 'win-popup__title win-popup__title--lose';
    amount.className = 'win-popup__amount win-popup__amount--lose';
  }

  // Montant gagné/perdu
  const gainValue = data.winnings || 0;
  amount.textContent = `${gainValue > 0 ? '+' : ''}${gainValue} pts`;

  // Message
  message.textContent = data.message || (data.won ? 'Vous avez trouvé le code !' : 'Dommage, réessayez !');

  // Afficher le code secret avec animation
  if (secretCodeEl && data.secretCode) {
    secretCodeEl.innerHTML = data.secretCode.map(color => `
      <div class="win-popup__peg win-popup__peg--${color}"></div>
    `).join('');
  }

  // Statistiques
  attemptsEl.textContent = `${data.attempts}/${data.maxAttempts}`;
  betEl.textContent = '50 pts';
  balanceEl.textContent = `${data.newBalance || 0} pts`;

  // Afficher la popup avec la classe "active"
  overlay.classList.add('active');
}

/**
 * Crée des confettis animés pour la victoire
 */
function createMastermindConfetti() {
  const popup = document.querySelector('#mastermindWinPopupOverlay .win-popup');
  if (!popup) return;

  const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#f39c12', '#9b59b6'];
  
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = Math.random() * 0.5 + 's';
      confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
      
      popup.appendChild(confetti);

      setTimeout(() => confetti.remove(), 3500);
    }, i * 30);
  }
}

/**
 * Ferme la popup
 */
function closeMastermindWinPopup() {
  const overlay = document.getElementById('mastermindWinPopupOverlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

/**
 * Initialise les événements de la popup
 */
function initMastermindWinPopup() {
  //console.log(' Initialisation de la popup Mastermind...');

  const closeBtn = document.getElementById('mastermindPopupCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeMastermindWinPopup);
  }

  const overlay = document.getElementById('mastermindWinPopupOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeMastermindWinPopup();
      }
    });
  }

  //console.log(' Popup Mastermind initialisée');
}

// Initialiser au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('mastermindWinPopupOverlay')) {
    initMastermindWinPopup();
  }
});

// Initialiser si la popup est chargée dynamiquement
document.addEventListener('mastermindWinPopupLoaded', initMastermindWinPopup);

// Exposer les fonctions globalement
window.showMastermindWinPopup = showMastermindWinPopup;
window.closeMastermindWinPopup = closeMastermindWinPopup;
window.initMastermindWinPopup = initMastermindWinPopup;
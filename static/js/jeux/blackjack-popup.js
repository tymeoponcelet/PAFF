// ========================================
// POPUP DE RÉSULTAT BLACKJACK
// ========================================

/**
 * Affiche la popup de résultat du Blackjack
 * @param {Object} options - Options de la popup
 * @param {string} options.result - 'win', 'lose', 'push', 'blackjack'
 * @param {number} options.gain - Montant gagné (peut être négatif)
 * @param {number} options.bet - Mise initiale
 * @param {number} options.playerScore - Score du joueur
 * @param {number} options.dealerScore - Score du croupier
 * @param {number} options.newBalance - Nouveau solde
 * @param {string} options.message - Message personnalisé
 */
function showBlackjackWinPopup(options) {
  const overlay = document.getElementById('winPopupOverlay');
  const icon = document.getElementById('winPopupIcon');
  const title = document.getElementById('winPopupTitle');
  const amount = document.getElementById('winPopupAmount');
  const bet = document.getElementById('winPopupBet');
  const playerScore = document.getElementById('winPopupPlayerScore');
  const dealerScore = document.getElementById('winPopupDealerScore');
  const newBalance = document.getElementById('winPopupNewBalance');
  const message = document.getElementById('winPopupMessage');

  // Vérifier que tous les éléments existent
  if (!overlay || !icon || !title || !amount) {
    return;
  }

  // Configuration selon le résultat
  const configs = {
    win: {
      icon: '🎉',
      title: 'Victoire !',
      titleClass: '',
      amountClass: ''
    },
    blackjack: {
      icon: '💎',
      title: 'BLACKJACK !',
      titleClass: '',
      amountClass: ''
    },
    lose: {
      icon: '😢',
      title: 'Défaite',
      titleClass: 'win-popup__title--lose',
      amountClass: 'win-popup__amount--lose'
    },
    push: {
      icon: '🤝',
      title: 'Égalité',
      titleClass: 'win-popup__title--push',
      amountClass: 'win-popup__amount--push'
    }
  };

  const config = configs[options.result] || configs.win;

  // Mettre à jour le contenu
  icon.textContent = config.icon;
  title.textContent = config.title;
  title.className = `win-popup__title ${config.titleClass}`;
  
  // Formatage du montant
  const gainText = options.gain >= 0 ? `+${options.gain}` : `${options.gain}`;
  amount.textContent = `${gainText} pts`;
  amount.className = `win-popup__amount ${config.amountClass}`;
  
  if (bet) bet.textContent = `${options.bet} pts`;
  if (playerScore) playerScore.textContent = options.playerScore;
  if (dealerScore) dealerScore.textContent = options.dealerScore;
  if (newBalance) newBalance.textContent = `${options.newBalance} pts`;
  if (message) message.textContent = options.message || '';

  // Ajouter des confettis pour les victoires
  if (options.result === 'win' || options.result === 'blackjack') {
    createConfetti();
  }

  // Afficher la popup
  overlay.classList.add('active');
}

/**
 * Ferme la popup
 */
function closeBlackjackWinPopup() {
  const overlay = document.getElementById('winPopupOverlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
  
  // Nettoyer les confettis
  const confettis = document.querySelectorAll('.confetti');
  confettis.forEach(c => c.remove());
}

/**
 * Crée des confettis animés
 */
function createConfetti() {
  const popup = document.querySelector('.win-popup');
  if (!popup) return;
  
  const colors = ['#ffd700', '#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
  
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = `${Math.random() * 2}s`;
    confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
    popup.appendChild(confetti);
  }
}

/**
 * Initialise la popup de résultat Blackjack
 */
function initBlackjackWinPopup() {
  
  const button = document.getElementById('winPopupButton');
  const overlay = document.getElementById('winPopupOverlay');

  if (!button || !overlay) {
    return;
  }

  // Supprimer les anciens événements
  const newButton = button.cloneNode(true);
  button.replaceWith(newButton);

  // Attacher les nouveaux événements
  document.getElementById('winPopupButton').addEventListener('click', closeBlackjackWinPopup);

  document.getElementById('winPopupOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'winPopupOverlay') {
      closeBlackjackWinPopup();
    }
  });

}
// Initialiser si la popup existe déjà au chargement
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (document.getElementById('winPopupOverlay')) {
      initBlackjackWinPopup();
    }
  }, 500);
});

// Écouter l'événement de chargement dynamique
document.addEventListener('blackjackModalLoaded', () => {
  setTimeout(() => {
    if (document.getElementById('winPopupOverlay')) {
      initBlackjackWinPopup();
    } else {
    }
  }, 300);
});

// Écouter spécifiquement le chargement de la popup
document.addEventListener('blackjackWinPopupLoaded', () => {
  setTimeout(initBlackjackWinPopup, 100);
});
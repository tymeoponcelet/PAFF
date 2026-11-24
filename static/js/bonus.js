// ========================================
// BONUS QUOTIDIEN - VERSION DYNAMIQUE
// ========================================

(function () {
  'use strict';

  let bonusCountdownInterval = null;

  // ========================================
  // INITIALISATION
  // ========================================

  /**
   * Initialise le système de bonus (appelé au chargement de la modale)
   */
  window.initBonus = function () {
    //console.log('🎁 Initialisation modale Bonus...');

    const bonusModal = document.getElementById('bonusModal');
    if (!bonusModal) {
      //console.warn('⚠️ Modale Bonus introuvable');
      return;
    }

    // Boutons de fermeture
    const closeButtons = bonusModal.querySelectorAll('.js-close-bonus');
    closeButtons.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.replaceWith(newBtn);
      newBtn.addEventListener('click', closeBonus);
    });

    // Fermer en cliquant sur l'overlay
    bonusModal.addEventListener('click', (e) => {
      if (e.target === bonusModal) {
        closeBonus();
      }
    });

    //console.log('✅ Modale Bonus initialisée');
  };

  function closeBonus() {
    const bonusModal = document.getElementById('bonusModal');
    if (bonusModal) {
      bonusModal.classList.remove('is-open');
      bonusModal.classList.remove('active'); // Au cas où
      document.body.style.overflow = '';
    }
  }

  // ========================================
  // VÉRIFICATION DU STATUT DU BONUS
  // ========================================

  async function checkBonusStatus() {
    const user = JSON.parse(localStorage.getItem('user'));

    if (!user || !user.logged) {
      return;
    }

    try {
      const response = await fetch(`/actions/check_bonus_status?userId=${user.id}`);
      const result = await response.json();

      const bonusCard = document.getElementById('dailyBonusCard');
      const lockOverlay = document.getElementById('bonusLockOverlay');
      const timeLeftSpan = document.getElementById('bonusTimeLeft');

      if (!result.available) {
        bonusCard.classList.add('locked');
        lockOverlay.style.display = 'flex';

        const hours = result.hoursLeft;
        const minutes = result.minutesLeft || 0;

        if (hours > 1) {
          timeLeftSpan.textContent = `${hours}h`;
        } else if (hours === 1) {
          timeLeftSpan.textContent = `${hours}h ${minutes}min`;
        } else {
          timeLeftSpan.textContent = `${minutes}min`;
        }

        startBonusCountdown(user.id);
      } else {
        bonusCard.classList.remove('locked');
        lockOverlay.style.display = 'none';
      }
    } catch (error) {
      //console.error('Erreur lors de la vérification du bonus:', error);
    }
  }

  // ========================================
  // COMPTE À REBOURS
  // ========================================

  function startBonusCountdown(userId) {
    if (bonusCountdownInterval) {
      clearInterval(bonusCountdownInterval);
    }

    bonusCountdownInterval = setInterval(async () => {
      try {
        const response = await fetch(`/actions/check_bonus_status?userId=${userId}`);
        const result = await response.json();

        const timeLeftSpan = document.getElementById('bonusTimeLeft');
        const bonusCard = document.getElementById('dailyBonusCard');
        const lockOverlay = document.getElementById('bonusLockOverlay');

        if (result.available) {
          clearInterval(bonusCountdownInterval);
          bonusCard.classList.remove('locked');
          lockOverlay.style.display = 'none';
          showToast('🎉 Votre bonus quotidien est maintenant disponible !', 'success');
        } else {
          const hours = result.hoursLeft;
          const minutes = result.minutesLeft || 0;

          if (hours > 1) {
            timeLeftSpan.textContent = `${hours}h`;
          } else if (hours === 1) {
            timeLeftSpan.textContent = `${hours}h ${minutes}min`;
          } else {
            timeLeftSpan.textContent = `${minutes}min`;
          }
        }
      } catch (error) {
        //console.error('Erreur countdown:', error);
      }
    }, 60000);
  }

  // ========================================
  // GESTION DU BONUS
  // ========================================

  function setupBonusButton() {
    const bonusButtons = document.querySelectorAll('.js-open-bonus');

    if (bonusButtons.length === 0) {
      //console.warn('❌ Boutons bonus introuvables');
      return;
    }

    bonusButtons.forEach(bonusButton => {
      // Supprimer les anciens événements
      const newButton = bonusButton.cloneNode(true);
      bonusButton.replaceWith(newButton);

      newButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const user = JSON.parse(localStorage.getItem('user'));

        if (!user || !user.logged || !user.id) {
          showToast('Vous devez être connecté pour récupérer le bonus.', 'error');
          setTimeout(() => {
            window.location.href = '/login.html';
          }, 2000);
          return;
        }

        const bonusCard = document.getElementById('dailyBonusCard');
        if (bonusCard && bonusCard.classList.contains('locked')) {
          showToast('⏰ Bonus déjà récupéré aujourd\'hui. Revenez plus tard !', 'warning');
          return;
        }

        try {
          const response = await fetch('/actions/claim_bonus', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: user.id })
          });

          const result = await response.json();

          if (result.success) {
            user.points = result.newPoints;
            localStorage.setItem('user', JSON.stringify(user));

            const userBalance = document.getElementById('userBalance');
            if (userBalance) {
              userBalance.textContent = `💎 ${result.newPoints.toLocaleString('fr-FR')} pts`;
            }

            if (bonusCard) {
              const lockOverlay = document.getElementById('bonusLockOverlay');
              bonusCard.classList.add('locked');
              if (lockOverlay) {
                lockOverlay.style.display = 'flex';
                const timeLeftSpan = document.getElementById('bonusTimeLeft');
                if (timeLeftSpan) {
                  timeLeftSpan.textContent = '24h';
                }
              }

              startBonusCountdown(user.id);
            }

            // FIX: Ouvrir la modale correctement
            const bonusModal = document.getElementById('bonusModal');
            if (bonusModal) {
              bonusModal.classList.add('is-open'); // Utiliser is-open au lieu de active
            }

            showToast(result.message, 'success');
          } else {
            if (result.cooldown) {
              showToast(result.message, 'warning');
              checkBonusStatus();
            } else {
              showToast(result.message, 'error');
            }
          }
        } catch (error) {
          //console.error('❌ Erreur:', error);
          showToast('Erreur lors de la récupération du bonus.', 'error');
        }
      });
    });
  }

  // ========================================
  // UTILITAIRES
  // ========================================

  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('toast--visible'), 10);

    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ========================================
  // CHARGEMENT
  // ========================================

  document.addEventListener('DOMContentLoaded', () => {
    setupBonusButton();
    checkBonusStatus();

    // Initialiser la modale si elle existe déjà
    if (document.getElementById('bonusModal')) {
      window.initBonus();
    }
  });

  // Écouter l'événement de chargement dynamique
  document.addEventListener('bonusModalLoaded', () => {
    window.initBonus();
  });

  // Réattacher les événements quand les cartes sont rechargées
  document.addEventListener('gameCardsLoaded', () => {
    setupBonusButton();
  });

})();
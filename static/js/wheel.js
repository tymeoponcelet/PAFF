    // ========================================
  // ROUE DE LA FORTUNE - WEEKLY PASS
  // ========================================

  (function() {
    'use strict';

    const wheelConfig = [
      { points: 100, color: '#ef4444', label: '100' },
      { points: 500, color: '#f59e0b', label: '500' },
      { points: 250, color: '#10b981', label: '250' },
      { points: 1000, color: '#8b5cf6', label: '1000' },
      { points: 150, color: '#3b82f6', label: '150' },
      { points: 750, color: '#ec4899', label: '750' },
      { points: 300, color: '#14b8a6', label: '300' },
      { points: 2000, color: '#fbbf24', label: '2000' }
    ];

    let isSpinning = false;
    let canvas, ctx;

    // ========================================
    // INITIALISATION - MÊME SYSTÈME QUE BONUS
    // ========================================

    window.initWheel = function() {
    //console.log('🎰 Initialisation modale Roue...');

      const wheelModal = document.getElementById('wheelResultModal');
      if (!wheelModal) {
      //console.warn('⚠️ Modale Roue introuvable');
        return;
      }

      // S'assurer que la modale est cachée au départ
      wheelModal.classList.remove('is-open');

      // Boutons de fermeture
      const closeButtons = wheelModal.querySelectorAll('.js-close-wheel-result, .modal__close');
      closeButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.replaceWith(newBtn);
      });

      // Réattacher les événements sur les NOUVEAUX boutons
      const newCloseButtons = wheelModal.querySelectorAll('.js-close-wheel-result, .modal__close');
      newCloseButtons.forEach(btn => {
        btn.addEventListener('click', closeWheelModal);
      });

      // Fermer en cliquant sur l'overlay
      wheelModal.addEventListener('click', (e) => {
        if (e.target === wheelModal) {
          closeWheelModal();
        }
      });

    //console.log('✅ Modale Roue initialisée');
    };

    function closeWheelModal() {
      const wheelModal = document.getElementById('wheelResultModal');
      if (wheelModal) {
        wheelModal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    }

    function setupWheel() {
      canvas = document.getElementById('wheelCanvas');
      if (!canvas) {
      //console.warn('⚠️ Canvas de la roue introuvable');
        return;
      }

      ctx = canvas.getContext('2d');
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 180;

      drawWheel(ctx, centerX, centerY, radius, 0);

      const spinButton = document.getElementById('spinButton');
      if (spinButton) {
        const newButton = spinButton.cloneNode(true);
        spinButton.replaceWith(newButton);
        document.getElementById('spinButton').addEventListener('click', spinWheel);
      }

      checkWheelStatus();
    }

    function drawWheel(ctx, centerX, centerY, radius, rotation) {
      const segments = wheelConfig.length;
      const anglePerSegment = (Math.PI * 2) / segments;

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      wheelConfig.forEach((segment, index) => {
        const startAngle = rotation + (index * anglePerSegment);
        const endAngle = startAngle + anglePerSegment;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = segment.color;
        ctx.fill();

        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + anglePerSegment / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Orbitron';
        ctx.fillText(segment.label, radius * 0.7, 8);
        ctx.restore();
      });

      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX, 19);
      ctx.lineTo(centerX - 10, 0);
      ctx.lineTo(centerX + 10, 0);
      ctx.closePath();
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    async function spinWheel() {
      if (isSpinning) return;

      const user = JSON.parse(localStorage.getItem('user'));
      if (!user || !user.logged) {
        showToast('Vous devez être connecté pour jouer.', 'error');
        setTimeout(() => window.location.href = '/login.html', 2000);
        return;
      }

      const spinButton = document.getElementById('spinButton');
      spinButton.disabled = true;
      isSpinning = true;

      try {
        const response = await fetch('/actions/spin_wheel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });

        const result = await response.json();
      //console.log('📊 Résultat du serveur:', result);

        if (result.success) {
          await animateWheel(result.winIndex);

          user.points = result.newPoints;
          localStorage.setItem('user', JSON.stringify(user));

          const userBalance = document.getElementById('userBalance');
          if (userBalance) {
            userBalance.textContent = `💎 ${result.newPoints.toLocaleString('fr-FR')} pts`;
          }

          showWheelResult(result);
          lockWheel(result.dayNumber, result.daysRemaining);

        } else {
          showToast(result.message, 'warning');
          if (result.cooldown) {
            lockWheel();
          }
        }

      } catch (error) {
      //console.error('❌ Erreur spin:', error);
        showToast('Erreur lors du spin', 'error');
      } finally {
        isSpinning = false;
        spinButton.disabled = false;
      }
    }

    function animateWheel(winIndex) {
      return new Promise((resolve) => {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 180;

        const segments = wheelConfig.length;
        const anglePerSegment = (Math.PI * 2) / segments;

        const arrowAngle = -Math.PI / 2;
        const segmentCenterAngle = (winIndex * anglePerSegment) + (anglePerSegment / 2);
        const targetRotation = arrowAngle - segmentCenterAngle;
        const spins = 5;
        const totalRotation = (Math.PI * 2 * spins) + targetRotation;

        let currentRotation = 0;
        const duration = 4000;
        const startTime = Date.now();

        function animate() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          currentRotation = totalRotation * eased;

          drawWheel(ctx, centerX, centerY, radius, currentRotation);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            resolve();
          }
        }

        animate();
      });
    }

    // ========================================
    // AFFICHAGE DU RÉSULTAT - MÊME SYSTÈME QUE BONUS
    // ========================================

    function showWheelResult(result) {
    //console.log('🎉 Affichage résultat roue');

      const modal = document.getElementById('wheelResultModal');

      if (!modal) {
      //console.error('❌ Modal introuvable !');
        const winningSegment = wheelConfig[result.winIndex];
        alert(`🎉 Félicitations !\n\nVous avez gagné ${winningSegment.points} points !`);
        return;
      }

      const winningSegment = wheelConfig[result.winIndex];
    //console.log('🎯 Segment gagnant:', winningSegment);

      const pointsText = document.getElementById('wheelResultPoints');
      const messageText = document.getElementById('wheelResultMessage');
      const dayText = document.getElementById('wheelResultDay');

      //  METTRE À JOUR LE CONTENU AVANT D'OUVRIR
      if (pointsText) {
        pointsText.textContent = `+${winningSegment.points} points`;
        pointsText.style.color = winningSegment.color;
      //console.log(' Points mis à jour:', winningSegment.points);
      }

      if (messageText) {
        messageText.textContent = result.message || 'Vous avez gagné :';
      }

      if (dayText) {
        dayText.textContent = `Jour ${result.dayNumber}/7 • ${result.daysRemaining} jour(s) restant(s)`;
      }

      // ✅ OUVRIR APRÈS UN MICRO-DÉLAI pour être sûr que le DOM est à jour
      setTimeout(() => {
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      //console.log('✅ Modal affichée');
      }, 50);
  }

    function lockWheel(dayNumber, daysRemaining) {
      const wheelCard = document.getElementById('wheelCard');
      const lockOverlay = document.getElementById('wheelLockOverlay');
      const spinButton = document.getElementById('spinButton');

      if (wheelCard) wheelCard.classList.add('locked');
      if (lockOverlay) {
        lockOverlay.style.display = 'flex';
        const timeText = document.getElementById('wheelTimeLeft');
        if (timeText) {
          const now = new Date();
          const hoursLeft = 24 - now.getHours();
          timeText.textContent = `${hoursLeft}h`;
        }
      }
      if (spinButton) spinButton.disabled = true;

      if (dayNumber !== undefined) {
        updateWeeklyProgress(dayNumber, daysRemaining);
      }
    }

    function updateWeeklyProgress(dayNumber, daysRemaining) {
      const progressText = document.getElementById('weeklyProgress');
      if (progressText) {
        progressText.textContent = `Jour ${dayNumber}/7`;
      }

      for (let i = 1; i <= 7; i++) {
        const dayCircle = document.getElementById(`day-${i}`);
        if (dayCircle) {
          if (i <= dayNumber) {
            dayCircle.classList.add('completed');
          } else {
            dayCircle.classList.remove('completed');
          }
        }
      }
    }

    async function checkWheelStatus() {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user || !user.logged) return;

      try {
        const response = await fetch(`/actions/spin_wheel/status?userId=${user.id}`);
        const result = await response.json();

        if (!result.available) {
          lockWheel(result.dayNumber, result.daysRemaining);
        } else {
          updateWeeklyProgress(result.dayNumber, result.daysRemaining);
        }
      } catch (error) {
      }
    }

    function showToast(message, type = 'info') {
      if (typeof window.showToast === 'function') {
        window.showToast(message, type);
      } else {
        alert(message);
      }
    }

    // ========================================
    // CHARGEMENT - MÊME SYSTÈME QUE BONUS
    // ========================================

    document.addEventListener('DOMContentLoaded', () => {
      setupWheel();

      if (document.getElementById('wheelResultModal')) {
        window.initWheel();
      }
    });

    document.addEventListener('wheelModalLoaded', () => {
      window.initWheel();
    });

    // Échap pour fermer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('wheelResultModal');
        if (modal && modal.classList.contains('is-open')) {
          closeWheelModal();
        }
      }
    });

    window.closeWheelModal = closeWheelModal;

  })();
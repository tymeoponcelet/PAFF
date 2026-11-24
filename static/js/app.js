// ========================================
// HELPERS
// ========================================

/**
 * Popup stylée quand le joueur obtient une clé (drop)
 */
function showKeyDropPopup() {
  const existing = document.getElementById('keyDropPopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'keyDropPopup';
  popup.className = 'key-drop-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Clé obtenue');
  popup.innerHTML = `
    <div class="key-drop-popup__backdrop"></div>
    <div class="key-drop-popup__card">
      <div class="key-drop-popup__icon">🔑</div>
      <div class="key-drop-popup__glow"></div>
      <h3 class="key-drop-popup__title">Clé obtenue !</h3>
      <p class="key-drop-popup__sub">Une clé a été ajoutée à votre inventaire</p>
    </div>
  `;

  document.body.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add('key-drop-popup--visible'));

  const close = () => {
    popup.classList.remove('key-drop-popup--visible');
    setTimeout(() => popup.remove(), 400);
  };

  popup.addEventListener('click', close);
  setTimeout(close, 2500);
}

window.showKeyDropPopup = showKeyDropPopup;

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('is-visible'), 10);

  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========================================
// TOP BAR
// ========================================
const topBar = document.getElementById('topBar');
const topBarClose = document.getElementById('topBarClose');

topBarClose?.addEventListener('click', () => {
  topBar.classList.add('is-hidden');
});

// ========================================
// MOBILE MENU
// ========================================
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
const menuClose = document.getElementById('menuClose');

menuToggle?.addEventListener('click', () => {
  mobileMenu.classList.add('is-open');
  menuToggle.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
});

menuClose?.addEventListener('click', closeMobileMenu);
mobileMenu?.addEventListener('click', (e) => {
  if (e.target === mobileMenu) closeMobileMenu();
});

function closeMobileMenu() {
  if (!mobileMenu) return;
  mobileMenu.classList.remove('is-open');
  if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

// ========================================
// BONUS MODAL
// ========================================
const bonusModal = document.getElementById('bonusModal');
const bonusTriggers = document.querySelectorAll('.js-open-bonus');
const bonusCloseBtns = document.querySelectorAll('.js-close-bonus');

bonusTriggers.forEach(btn => {
  btn.addEventListener('click', () => {
    bonusModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    showToast('Bonus de 500 points crédité !', 'success');
  });
});

bonusCloseBtns.forEach(btn => {
  btn.addEventListener('click', closeBonusModal);
});

bonusModal?.addEventListener('click', (e) => {
  if (e.target === bonusModal) closeBonusModal();
});

function closeBonusModal() {
  bonusModal.classList.remove('is-open');
  document.body.style.overflow = '';
}

// ========================================
// SMOOTH SCROLL
// ========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;

    e.preventDefault();
    const target = document.querySelector(href);

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      closeMobileMenu();
    }
  });
});

// ========================================
// GESTION BOUTON AIDE BLACKJACK
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  const boutonAide = document.querySelector('.table-card__help-btn');
  const infobulle = document.querySelector('.table-card__help-tooltip');

  if (boutonAide && infobulle) {
    boutonAide.addEventListener('click', (evenement) => {
      evenement.stopPropagation();
      evenement.preventDefault();
      infobulle.style.display = infobulle.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (evenement) => {
      if (!evenement.target.closest('.table-card__bet')) {
        infobulle.style.display = 'none';
      }
    });
  }
  
  // ✅ Vérifier la session
  if (typeof checkSession === 'function') {
    checkSession();
  }
  
  // ✅ Vérifier le statut du bonus (si la fonction existe)
  if (typeof checkBonusStatus === 'function') {
    checkBonusStatus();
  }
});
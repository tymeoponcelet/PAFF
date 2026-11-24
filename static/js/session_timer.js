// ========================================
// GESTION DU TIMER DE SESSION
// ========================================

let sessionTimerInterval = null;   // Décompte local (1s)
let serverSyncInterval   = null;   // Sync serveur (10s)
let sessionTimeRemaining = 0;
let warningShown = { fiveMin: false, oneMin: false, finalCountdown: false };

// ========================================
// DÉMARRER LE SUIVI DE SESSION
// ========================================
async function startSessionTracking() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user.logged) return;

  try {
    await fetch('/actions/start_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
  } catch (_) {}

  displaySessionTimer();
  await syncWithServer();   // Première sync immédiate

  // Décompte local chaque seconde (aucune requête réseau)
  clearInterval(sessionTimerInterval);
  sessionTimerInterval = setInterval(() => {
    if (sessionTimeRemaining > 0) {
      sessionTimeRemaining--;
      updateTimerDisplay(sessionTimeRemaining);
      checkWarnings();
      if (sessionTimeRemaining <= 0) handleSessionExpired();
    }
  }, 1000);

  // Resync avec le serveur toutes les 10 secondes
  clearInterval(serverSyncInterval);
  serverSyncInterval = setInterval(syncWithServer, 10_000);
}

// ========================================
// SYNC SERVEUR (toutes les 10s)
// ========================================
async function syncWithServer() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || !user.logged) return;

  try {
    const response = await fetch(`/actions/check_session_time?userId=${user.id}`);
    const data = await response.json();

    const serverTime = Math.max(0, data.timeRemaining);

    // On accepte la valeur serveur seulement si l'écart est > 3s
    // (évite les sauts visuels liés à la latence réseau)
    if (Math.abs(serverTime - sessionTimeRemaining) > 3) {
      sessionTimeRemaining = serverTime;
      updateTimerDisplay(sessionTimeRemaining);
    }

    if (serverTime <= 0 || data.expired) {
      handleSessionExpired();
    }
  } catch (_) {}
}

// ========================================
// AVERTISSEMENTS
// ========================================
function checkWarnings() {
  if (sessionTimeRemaining <= 300 && sessionTimeRemaining > 60 && !warningShown.fiveMin) {
    warningShown.fiveMin = true;
    showSessionWarningModal('fiveMin');
  }
  if (sessionTimeRemaining <= 60 && sessionTimeRemaining > 0 && !warningShown.oneMin) {
    warningShown.oneMin = true;
    showSessionWarningModal('oneMin');
  }
  if (sessionTimeRemaining <= 5 && sessionTimeRemaining > 0 && !warningShown.finalCountdown) {
    warningShown.finalCountdown = true;
    showFinalCountdownModal(sessionTimeRemaining);
  }
}

// ========================================
// MODALE DE WARNING (5min / 1min)
// ========================================
function showSessionWarningModal(type) {
  // Supprimer une éventuelle modale déjà présente
  document.querySelector('.session-warning-modal')?.remove();

  const isFive = type === 'fiveMin';
  const accent = isFive ? '#f59e0b' : '#ef4444';
  const icon   = isFive ? '⏳' : '🚨';
  const title  = isFive ? 'Plus que 5 minutes' : 'Dernière minute !';
  const body   = isFive
    ? 'Votre session se terminera dans <strong>5 minutes</strong>.<br>'
    : 'Votre session expire dans <strong>moins d\'une minute</strong>.<br>Vous allez être déconnecté automatiquement.';

  injectWarningStyles();

  const modal = document.createElement('div');
  modal.className = 'session-warning-modal';
  modal.innerHTML = `
    <div class="swm-card" style="--accent:${accent}">
      <button class="swm-close" aria-label="Fermer">✕</button>
      <div class="swm-icon">${icon}</div>
      <h3 class="swm-title">${title}</h3>
      <p class="swm-body">${body}</p>
      <div class="swm-bar">
        <div class="swm-bar-fill" style="--duration:${isFive ? 300 : 60}s"></div>
      </div>
      <button class="swm-btn">OK, compris</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Fermeture
  const close = () => modal.remove();
  modal.querySelector('.swm-close').addEventListener('click', close);
  modal.querySelector('.swm-btn').addEventListener('click', close);
  // Auto-fermeture après 8s
  setTimeout(close, 8_000);
}

// ========================================
// STYLES DE LA MODALE (injectés une seule fois)
// ========================================
function injectWarningStyles() {
  if (document.getElementById('swm-styles')) return;

  const style = document.createElement('style');
  style.id = 'swm-styles';
  style.textContent = `
    .session-warning-modal {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 999990;
      animation: swmSlideIn .4s cubic-bezier(.34,1.56,.64,1) both;
    }
    @keyframes swmSlideIn {
      from { opacity:0; transform: translateY(2rem) scale(.92); }
      to   { opacity:1; transform: translateY(0)    scale(1);   }
    }
    .swm-card {
      position: relative;
      width: 320px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border: 1.5px solid var(--accent);
      border-radius: 16px;
      padding: 1.75rem 1.5rem 1.5rem;
      box-shadow: 0 0 40px color-mix(in srgb, var(--accent) 30%, transparent),
                  0 20px 40px rgba(0,0,0,.5);
      font-family: 'Orbitron', 'Courier New', monospace;
      overflow: hidden;
    }
    .swm-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 60%);
      pointer-events: none;
    }
    .swm-close {
      position: absolute;
      top: .75rem; right: .75rem;
      background: rgba(255,255,255,.06);
      border: none;
      color: #64748b;
      width: 28px; height: 28px;
      border-radius: 50%;
      cursor: pointer;
      font-size: .8rem;
      display: flex; align-items: center; justify-content: center;
      transition: color .2s, background .2s;
    }
    .swm-close:hover { color: #fff; background: rgba(255,255,255,.12); }
    .swm-icon {
      font-size: 2.4rem;
      margin-bottom: .75rem;
      animation: swmPulse 1.4s ease-in-out infinite;
    }
    @keyframes swmPulse {
      0%,100% { transform: scale(1);    }
      50%      { transform: scale(1.12); }
    }
    .swm-title {
      color: var(--accent);
      font-size: 1.1rem;
      font-weight: 700;
      margin: 0 0 .5rem;
      letter-spacing: .04em;
    }
    .swm-body {
      color: #94a3b8;
      font-size: .82rem;
      line-height: 1.6;
      margin: 0 0 1.25rem;
      font-family: -apple-system, system-ui, sans-serif;
    }
    .swm-body strong { color: #e2e8f0; }
    .swm-bar {
      height: 4px;
      background: rgba(255,255,255,.08);
      border-radius: 99px;
      overflow: hidden;
      margin-bottom: 1.25rem;
    }
    .swm-bar-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 99px;
      width: 100%;
      animation: swmBarShrink var(--duration, 60s) linear forwards;
    }
    @keyframes swmBarShrink {
      from { width: 100%; }
      to   { width: 0%;   }
    }
    .swm-btn {
      width: 100%;
      padding: .65rem;
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      border: 1.5px solid var(--accent);
      color: var(--accent);
      border-radius: 10px;
      font-family: 'Orbitron', monospace;
      font-size: .82rem;
      font-weight: 700;
      letter-spacing: .06em;
      cursor: pointer;
      transition: background .2s, color .2s;
    }
    .swm-btn:hover {
      background: var(--accent);
      color: #0f172a;
    }
  `;
  document.head.appendChild(style);
}

// ========================================
// AFFICHER LE TIMER DANS LA NAVBAR
// ========================================
function displaySessionTimer() {
  const navbar = document.querySelector('.navbar__actions');
  if (!navbar || document.getElementById('session-timer')) return;

  const timerElement = document.createElement('div');
  timerElement.id = 'session-timer';
  timerElement.className = 'navbar__timer';
  timerElement.setAttribute('aria-label', 'Temps de connexion restant');
  timerElement.style.cssText = `
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: var(--space-2) var(--space-2);
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    font-family: 'Orbitron', monospace;
    font-weight: bold;
  `;

  navbar.appendChild(timerElement);
}

// ========================================
// METTRE À JOUR L'AFFICHAGE DU TIMER
// ========================================
function updateTimerDisplay(seconds) {
  const timerElement = document.getElementById('session-timer');
  if (!timerElement) return;

  const minutes = Math.floor(seconds / 60);
  const secs    = seconds % 60;
  const timeString = `${minutes}:${secs.toString().padStart(2, '0')}`;

  let color = '#10b981';
  if (seconds <= 300 && seconds > 60) color = '#f59e0b';
  if (seconds <= 60)                  color = '#ef4444';

  timerElement.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
         fill="none" stroke="${color}" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
    <span style="color:${color};">${timeString}</span>
  `;
}

// ========================================
// GÉRER L'EXPIRATION
// ========================================
async function handleSessionExpired() {
  clearInterval(sessionTimerInterval);
  clearInterval(serverSyncInterval);
  sessionTimerInterval = null;
  serverSyncInterval   = null;

  const user = JSON.parse(localStorage.getItem('user'));
  if (user?.id) {
    try {
      await fetch('/actions/end_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
    } catch (_) {}
  }

  localStorage.removeItem('user');

  document.querySelectorAll('.modal-overlay.is-open').forEach(m => {
    m.classList.remove('is-open');
  });
  document.body.style.overflow = '';

  // Si le countdown final n'a pas déjà été déclenché, l'afficher maintenant
  if (!warningShown.finalCountdown) {
    showFinalCountdownModal(5);
  } else {
    // Il est déjà affiché, on laisse son propre timer rediriger
  }
}

// ========================================
// COMPTE À REBOURS FINAL (5s, non fermable)
// ========================================
function showFinalCountdownModal(startFrom = 5) {
  document.querySelector('.session-final-countdown')?.remove();
  injectWarningStyles();

  const modal = document.createElement('div');
  modal.className = 'session-final-countdown';
  modal.style.cssText = `
    position:fixed; inset:0; z-index:9999999;
    background:rgba(0,0,0,.88);
    backdrop-filter:blur(16px);
    display:flex; align-items:center; justify-content:center;
    animation:sfcFadeIn .3s ease both;
  `;

  modal.innerHTML = `
    <style>
      @keyframes sfcFadeIn { from{opacity:0} to{opacity:1} }
      @keyframes sfcPop    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
      @keyframes sfcRing {
        0%   { box-shadow: 0 0 0   0px rgba(239,68,68,.7); }
        100% { box-shadow: 0 0 0  60px rgba(239,68,68,0);  }
      }
      .sfc-ring {
        width:160px; height:160px;
        border-radius:50%;
        background:radial-gradient(circle, #1e293b 60%, #0f172a 100%);
        border:4px solid #ef4444;
        display:flex; align-items:center; justify-content:center;
        animation:sfcRing 1s ease-out infinite;
        margin:0 auto 2rem;
        position:relative;
      }
      .sfc-ring svg {
        position:absolute; inset:0;
        transform:rotate(-90deg);
      }
      .sfc-number {
        font-family:'Orbitron',monospace;
        font-size:4.5rem;
        font-weight:900;
        color:#ef4444;
        line-height:1;
        position:relative;
        z-index:1;
        text-shadow: 0 0 30px rgba(239,68,68,.6);
        animation:sfcPop 1s ease-in-out infinite;
      }
    </style>
    <div style="text-align:center;padding:2rem;">
      <p style="
        font-family:'Orbitron',monospace;
        color:#ef4444;font-size:1rem;
        letter-spacing:.1em;text-transform:uppercase;
        margin:0 0 2rem;
        text-shadow:0 0 20px rgba(239,68,68,.5);
      ">⚠️ Déconnexion imminente</p>

      <div class="sfc-ring">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="74"
            fill="none" stroke="rgba(239,68,68,.15)" stroke-width="6"/>
          <circle id="sfc-arc" cx="80" cy="80" r="74"
            fill="none" stroke="#ef4444" stroke-width="6"
            stroke-linecap="round"
            stroke-dasharray="465"
            stroke-dashoffset="0"
            style="transition:stroke-dashoffset 1s linear;"/>
        </svg>
        <span class="sfc-number" id="sfc-num">${startFrom}</span>
      </div>

      <p style="
        color:#94a3b8;font-family:system-ui,sans-serif;
        font-size:1rem;line-height:1.7;margin:0;
      ">
        Votre heure de jeu quotidienne est écoulée.<br>
        <span style="color:#e2e8f0;">À demain ! 👋</span>
      </p>
    </div>
  `;

  document.body.appendChild(modal);

  const numEl = document.getElementById('sfc-num');
  const arcEl = document.getElementById('sfc-arc');
  const circumference = 465;
  let t = startFrom;

  // Arc initial
  if (arcEl) arcEl.style.strokeDashoffset = '0';

  const tick = setInterval(() => {
    t--;
    if (numEl) numEl.textContent = t;
    // Rétrécir l'arc proportionnellement
    if (arcEl) {
      const progress = t / startFrom;
      arcEl.style.strokeDashoffset = String(circumference * (1 - progress));
    }
    if (t <= 0) {
      clearInterval(tick);
      window.location.href = '/logout';
    }
  }, 1000);
}

// ========================================
// MODALE D'EXPIRATION FINALE
// ========================================
function showExpirationModal() {
  document.querySelector('.session-expired-modal')?.remove();
  injectWarningStyles();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay session-expired-modal';
  modal.style.cssText = `
    display:flex !important; position:fixed; inset:0;
    background:rgba(0,0,0,.92); z-index:999999;
    justify-content:center; align-items:center;
    backdrop-filter:blur(12px);
  `;

  modal.innerHTML = `
    <div style="
      max-width:520px; width:calc(100% - 2rem);
      background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);
      border:2px solid #ef4444;
      border-radius:20px;
      box-shadow:0 0 60px rgba(239,68,68,.4), 0 30px 60px rgba(0,0,0,.6);
      overflow:hidden;
      animation:swmSlideIn .5s cubic-bezier(.34,1.56,.64,1) both;
      font-family:'Orbitron',monospace;
    ">
      <!-- Header -->
      <div style="
        background:linear-gradient(135deg,#ef4444,#b91c1c);
        padding:1.75rem 2rem;
        text-align:center;
        position:relative;
      ">
        <div style="font-size:3rem;margin-bottom:.5rem;">⏰</div>
        <h2 style="color:#fff;font-size:1.4rem;margin:0;letter-spacing:.06em;">
          Temps de jeu épuisé
        </h2>
      </div>

      <!-- Body -->
      <div style="padding:2rem;text-align:center;">
        <p style="color:#e2e8f0;font-size:1rem;line-height:1.7;margin:0 0 1rem;font-family:system-ui,sans-serif;">
          Vous avez utilisé votre <strong style="color:#fbbf24;">heure de connexion quotidienne</strong>.
        </p>
        <p style="color:#64748b;font-size:.9rem;line-height:1.8;margin:0 0 1.5rem;font-family:system-ui,sans-serif;">
          Pour votre bien-être, prenez une pause 🌟<br>
          Revenez demain pour continuer à jouer.
        </p>

        <div style="
          background:rgba(251,191,36,.08);border:1.5px solid #fbbf24;
          border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.75rem;
          font-family:system-ui,sans-serif;
        ">
          <p style="color:#fbbf24;margin:0;font-size:.85rem;line-height:1.7;">
            💡 <strong>Le saviez-vous ?</strong><br>
            Des pauses régulières améliorent votre santé et vos performances !
          </p>
        </div>

        <p style="color:#ef4444;font-size:.95rem;margin:0 0 1.5rem;">
          Déconnexion dans <span id="se-countdown" style="font-size:1.4rem;font-weight:700;">5</span>s
        </p>

        <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;">
          <button id="se-info-btn" style="
            padding:.7rem 1.5rem;border-radius:10px;border:none;cursor:pointer;
            background:linear-gradient(135deg,#10b981,#059669);
            color:#fff;font-family:'Orbitron',monospace;font-size:.8rem;
            font-weight:700;letter-spacing:.04em;
            box-shadow:0 4px 15px rgba(16,185,129,.3);
            transition:transform .2s;
          ">📚 En savoir plus</button>

          <button id="se-logout-btn" style="
            padding:.7rem 1.5rem;border-radius:10px;border:none;cursor:pointer;
            background:linear-gradient(135deg,#ef4444,#dc2626);
            color:#fff;font-family:'Orbitron',monospace;font-size:.8rem;
            font-weight:700;letter-spacing:.04em;
            box-shadow:0 4px 15px rgba(239,68,68,.3);
            transition:transform .2s;
          ">🚪 Me déconnecter</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Compte à rebours
  let t = 5;
  const el = document.getElementById('se-countdown');
  const timer = setInterval(() => {
    t--;
    if (el) el.textContent = t;
    if (t <= 0) { clearInterval(timer); window.location.href = '/logout'; }
  }, 1000);

  document.getElementById('se-info-btn').addEventListener('click', () => {
    clearInterval(timer);
    window.location.href = 'https://www.drogues.gouv.fr/lessentiel-sur-les-usages-problematiques-decrans';
  });
  document.getElementById('se-logout-btn').addEventListener('click', () => {
    clearInterval(timer);
    window.location.href = '/logout';
  });
}

// ========================================
// TERMINER LA SESSION MANUELLEMENT
// ========================================
async function endSessionManually() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user?.logged) {
    try {
      await fetch('/actions/end_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
    } catch (_) {}
  }
  clearInterval(sessionTimerInterval);
  clearInterval(serverSyncInterval);
  warningShown = { fiveMin: false, oneMin: false, finalCountdown: false };
}

// ========================================
// TERMINER LA SESSION À LA FERMETURE
// ========================================
window.addEventListener('beforeunload', () => {
  const user = JSON.parse(localStorage.getItem('user'));
  clearInterval(serverSyncInterval);
  clearInterval(sessionTimerInterval);
  if (user?.logged) {
    navigator.sendBeacon(
      '/actions/end_session',
      new Blob([JSON.stringify({ userId: user.id })], { type: 'application/json' })
    );
  }
});

// ========================================
// GESTION VISIBILITÉ (mobile)
// ========================================
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') {
    clearInterval(sessionTimerInterval);
    clearInterval(serverSyncInterval);
    sessionTimerInterval = null;
    serverSyncInterval = null;
    window._heartbeat?.stop(); // ← arrête le heartbeat

    const user = JSON.parse(localStorage.getItem('user'));
    if (user?.id) {
      navigator.sendBeacon(
        '/actions/end_session',
        new Blob([JSON.stringify({ userId: user.id })], { type: 'application/json' })
      );
    }

  } else {
    clearInterval(sessionTimerInterval);
    clearInterval(serverSyncInterval);
    sessionTimerInterval = null;
    serverSyncInterval = null;

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user?.id) return;

    try {
      await fetch('/actions/start_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
    } catch (_) {}

    window._heartbeat?.start(); // ← heartbeat immédiat avant la sync
    await syncWithServer();     // ← récupère le bon temps

    sessionTimerInterval = setInterval(() => {
      if (sessionTimeRemaining > 0) {
        sessionTimeRemaining--;
        updateTimerDisplay(sessionTimeRemaining);
        checkWarnings();
        if (sessionTimeRemaining <= 0) handleSessionExpired();
      }
    }, 1000);

    serverSyncInterval = setInterval(syncWithServer, 10_000);
  }
});
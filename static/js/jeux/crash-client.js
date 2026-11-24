// ========================================
// CRASH GAME - CLIENT COMPLET (Canvas + Backend)
// ========================================

const CRASH_API_BASE = '/actions/crash';
const CRASH_CANVAS_WIDTH = 800;
const CRASH_CANVAS_HEIGHT = 500;
const CRASH_MAX_TIME = 10;
const CRASH_MIN_MULT = 1.05;
const CRASH_MAX_MULT = 50.0;

let crashGameStarted = false;
let crashCountdownInterval = null;
let crashStatusInterval = null;
let canvas, ctx;
let crashSessionId = null;
let crashStartTime = null;
let crashAnimationFrame = null;
let crashGameState = 'idle'; // idle, running, crashed, won
let pathPoints = [];
let crashPoint = null;
let currentMultiplier = 1.0;

// ========================================
// CANVAS - FONCTIONS DE DESSIN
// ========================================

function mapTimeToX(t, xMax) {
  const paddingLeft = 60;
  const paddingRight = 30;
  const width = CRASH_CANVAS_WIDTH - paddingLeft - paddingRight;
  return paddingLeft + (t / xMax) * width;
}

function mapMultToY(m, yMax) {
  const paddingTop = 40;
  const paddingBottom = 50;
  const height = CRASH_CANVAS_HEIGHT - paddingTop - paddingBottom;
  const clamped = Math.min(m, yMax);
  const ratio = (clamped - 1) / (yMax - 1);
  return CRASH_CANVAS_HEIGHT - paddingBottom - ratio * height;
}

function drawBackground() {
  const w = CRASH_CANVAS_WIDTH;
  const h = CRASH_CANVAS_HEIGHT;
  const gradient = ctx.createRadialGradient(w / 2, h / 3, 50, w / 2, h / 2, Math.max(w, h));
  gradient.addColorStop(0, '#0a1628');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function drawAxes(yMax, xMax) {
  ctx.save();
  ctx.strokeStyle = 'rgba(148,163,184,0.8)';
  ctx.lineWidth = 1.5;
  const x0 = mapTimeToX(0, xMax);
  const xEnd = mapTimeToX(xMax, xMax);
  const y0 = mapMultToY(1, yMax);
  const yTop = mapMultToY(yMax, yMax);

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(xEnd, y0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x0, yTop);
  ctx.lineTo(x0, y0);
  ctx.stroke();
  ctx.restore();
}

function drawGrid(yMax, xMax) {
  ctx.save();
  ctx.strokeStyle = 'rgba(148,163,184,0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);

  for (let t = 0; t <= xMax; t += Math.max(1, Math.floor(xMax / 10))) {
    const x = mapTimeToX(t, xMax);
    ctx.beginPath();
    ctx.moveTo(x, mapMultToY(1, yMax));
    ctx.lineTo(x, mapMultToY(yMax, yMax));
    ctx.stroke();
  }

  for (let m = 1; m <= yMax + 0.001; m += 0.5) {
    const y = mapMultToY(m, yMax);
    ctx.beginPath();
    ctx.moveTo(mapTimeToX(0, xMax), y);
    ctx.lineTo(mapTimeToX(xMax, xMax), y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function drawPlane(x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const s = 0.7;
  ctx.scale(s, s);

  // Ombre portée légère
  ctx.shadowColor = 'rgba(0,200,100,0.4)';
  ctx.shadowBlur = 10;

  // Aile principale gauche
  ctx.beginPath();
  ctx.moveTo(10, -10);
  ctx.lineTo(-18, -40);
  ctx.lineTo(-26, -10);
  ctx.closePath();
  ctx.fillStyle = '#3b7dd8';
  ctx.fill();

  // Aile principale droite
  ctx.beginPath();
  ctx.moveTo(10, 10);
  ctx.lineTo(-18, 40);
  ctx.lineTo(-26, 10);
  ctx.closePath();
  ctx.fillStyle = '#3b7dd8';
  ctx.fill();

  // Empennage horizontal gauche
  ctx.beginPath();
  ctx.moveTo(-34, -4);
  ctx.lineTo(-50, -18);
  ctx.lineTo(-46, -4);
  ctx.closePath();
  ctx.fillStyle = '#2a6bc2';
  ctx.fill();

  // Empennage horizontal droit
  ctx.beginPath();
  ctx.moveTo(-34, 4);
  ctx.lineTo(-50, 18);
  ctx.lineTo(-46, 4);
  ctx.closePath();
  ctx.fillStyle = '#2a6bc2';
  ctx.fill();

  // Dérive verticale (rouge)
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(-50, -28);
  ctx.lineTo(-42, 0);
  ctx.closePath();
  ctx.fillStyle = '#d93025';
  ctx.fill();

  // Fuselage principal
  ctx.beginPath();
  ctx.ellipse(0, 0, 52, 11, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e8e8e8';
  ctx.fill();

  // Nez arrondi
  ctx.beginPath();
  ctx.ellipse(48, 0, 10, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#d0d0d0';
  ctx.fill();

  // Liseré bleu sur le fuselage
  ctx.beginPath();
  ctx.moveTo(-40, -3);
  ctx.lineTo(52, -3);
  ctx.strokeStyle = '#3b7dd8';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Réacteur gauche
  ctx.beginPath();
  ctx.ellipse(-6, -22, 12, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#555';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-6, -22, 6, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();

  // Réacteur droit
  ctx.beginPath();
  ctx.ellipse(-6, 22, 12, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#555';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-6, 22, 6, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();

  // Hublots (rangée gauche)
  [20, 8, -4].forEach(px => {
    ctx.beginPath();
    ctx.ellipse(px, -7, 3.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#87ceeb';
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Hublots (rangée droite)
  [20, 8, -4].forEach(px => {
    ctx.beginPath();
    ctx.ellipse(px, 7, 3.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#87ceeb';
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  ctx.restore();
}



function drawCurveAndPlane(yMax, xMax) {
  if (pathPoints.length < 2) return;

  // Courbe verte
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#00ff88';
  ctx.shadowColor = 'rgba(0,255,136,0.8)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  pathPoints.forEach((p, i) => {
    const x = mapTimeToX(p.t, xMax);
    const y = mapMultToY(p.m, yMax);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();

  // Position et angle du bout de la courbe
  const last = pathPoints[pathPoints.length - 1];
  const prev = pathPoints[pathPoints.length - 2] || last;
  const x = mapTimeToX(last.t, xMax);
  const y = mapMultToY(last.m, yMax);
  const angle = Math.atan2(
    mapMultToY(last.m, yMax) - mapMultToY(prev.m, yMax),
    mapTimeToX(last.t, xMax) - mapTimeToX(prev.t, xMax)
  );

  if (crashGameState === 'crashed') {
    // Explosion — cercles concentriques, universel et sans emoji
    ctx.save();
    ctx.translate(x, y);
    [
      { r: 22, color: '#ff4b4b', alpha: 0.9 },
      { r: 14, color: '#f97316', alpha: 0.95 },
      { r: 7, color: '#facc15', alpha: 1.0 },
    ].forEach(({ r, color, alpha }) => {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  } else {
    drawPlane(x, y, angle);
  }
}

function drawMultiplierText(mult, color, realCrashPoint) {
  ctx.save();
  ctx.font = 'bold 72px "Orbitron", system-ui, monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillText(`${mult.toFixed(2)}x`, CRASH_CANVAS_WIDTH / 2, CRASH_CANVAS_HEIGHT / 2);

  if (realCrashPoint === -1) {
    ctx.font = '18px "Orbitron", system-ui, monospace';
    ctx.fillStyle = 'rgba(255, 75, 75, 0.6)';
    ctx.shadowColor = 'rgba(255, 75, 75, 0.3)';
    ctx.shadowBlur = 10;
    ctx.fillText('partie perdue', CRASH_CANVAS_WIDTH / 2, CRASH_CANVAS_HEIGHT / 2 + 55);
  } else if (realCrashPoint !== null && realCrashPoint !== undefined) {
    ctx.font = '18px "Orbitron", system-ui, monospace';
    ctx.fillStyle = 'rgba(250, 204, 21, 0.6)';
    ctx.shadowColor = 'rgba(250, 204, 21, 0.3)';
    ctx.shadowBlur = 10;
    ctx.fillText(`crash réel : ${realCrashPoint.toFixed(2)}x`, CRASH_CANVAS_WIDTH / 2, CRASH_CANVAS_HEIGHT / 2 + 55);
  }

  ctx.restore();
}

function renderCanvas() {
  if (!ctx) return;

  const yMax = Math.min(Math.max(crashPoint || 4, currentMultiplier, 2), CRASH_MAX_MULT);

  const elapsed = pathPoints.length > 0 ? pathPoints[pathPoints.length - 1].t : 0;
  const xMax = Math.max(10, elapsed * 1.2);

  ctx.clearRect(0, 0, CRASH_CANVAS_WIDTH, CRASH_CANVAS_HEIGHT);
  drawBackground();
  drawGrid(yMax, xMax);
  drawAxes(yMax, xMax);
  drawCurveAndPlane(yMax, xMax);

  if (crashGameState === 'running' && pathPoints.length) {
    const last = pathPoints[pathPoints.length - 1];
    drawMultiplierText(last.m, '#00ff88', null);
  } else if (crashGameState === 'crashed') {
    drawMultiplierText(currentMultiplier, '#ff4b4b', -1);
  } else if (crashGameState === 'won') {
    drawMultiplierText(currentMultiplier, '#facc15', crashPoint);
  }
}

// ========================================
// ANIMATION LOOP
// ========================================

function animateMultiplier(timestamp) {
  if (crashGameState !== 'running' || !crashStartTime) {
    if (crashAnimationFrame) {
      cancelAnimationFrame(crashAnimationFrame);
      crashAnimationFrame = null;
    }
    return;
  }

  const elapsed = Math.max(0, (Date.now() - crashStartTime) / 1000);
  currentMultiplier = Math.max(1.0, 1 + elapsed * elapsed * 0.02);

  // Éviter les points dupliqués ou régressifs
  const lastPoint = pathPoints[pathPoints.length - 1];
  if (!lastPoint || elapsed > lastPoint.t) {
    pathPoints.push({ t: elapsed, m: currentMultiplier });
  }

  const multiplierEl = document.getElementById('crashMultiplier');
  if (multiplierEl) multiplierEl.textContent = `${currentMultiplier.toFixed(2)}x`;

  const potentialGainEl = document.getElementById('crashPotentialGain');
  const betInput = document.getElementById('crashBetAmount');
  if (potentialGainEl && betInput) {
    const betAmount = parseInt(betInput.value, 10) || 0;
    potentialGainEl.textContent = `${Math.floor(betAmount * currentMultiplier)} pts`;
  }

  renderCanvas();

  crashAnimationFrame = requestAnimationFrame(animateMultiplier);
}

// ========================================
// API BACKEND
// ========================================

async function startCrashGame() {
  if (crashGameState === 'running') return;

  const betInput = document.getElementById('crashBetAmount');
  if (!betInput) return;

  const betAmount = parseInt(betInput.value, 10);
  const minBet = parseInt(betInput.min || '10', 10) || 10;

  if (isNaN(betAmount) || betAmount <= 0) { showCrashToast('Mise invalide', 'danger'); return; }
  if (betAmount < minBet) { showCrashToast(`Mise minimum : ${minBet} points`, 'danger'); return; }

  document.getElementById('crashStartBtn').disabled = true;
  document.getElementById('crashCashOutBtn').disabled = true;

  try {
    const requestSentAt = Date.now(); // ← noter l'heure d'envoi

    const response = await fetch(`${CRASH_API_BASE}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ betAmount, minBet })
    });

    const receivedAt = Date.now(); // ← noter l'heure de réception
    const data = await response.json();

    if (!data.success) {
      showCrashToast(data.message || 'Erreur lors du démarrage', 'danger');
      document.getElementById('crashStartBtn').disabled = false;
      return;
    }

    const rtt = receivedAt - requestSentAt;
    const networkDelay = Math.max(0, rtt / 2);

    // Le serveur a démarré à data.startTime.
    // On recule crashStartTime de networkDelay pour que l'elapsed client
    // soit aligné avec l'elapsed serveur au moment de la réception.
    crashStartTime = data.startTime - networkDelay; // ← CORRECTION CLÉ

    crashSessionId = data.sessionId;
    crashGameState = 'running';
    crashGameStarted = true;
    pathPoints = [];
    currentMultiplier = 1.0;

    updateCrashPoints(data.newPoints);

    setCrashAppState('running');
    document.getElementById('crashCashOutBtn').disabled = false;
    document.getElementById('crashResetBtn').disabled = true;

    const resultEl = document.getElementById('crashResult');
    if (resultEl) resultEl.style.display = 'none';

    const statusEl = document.getElementById('crashStatus');
    if (statusEl) statusEl.textContent = 'En vol... Cliquez sur ENCAISSER avant le crash !';

    const betDisplay = document.getElementById('crashBetDisplay');
    if (betDisplay) betDisplay.textContent = `${betAmount} pts`;

    if (crashAnimationFrame) cancelAnimationFrame(crashAnimationFrame);
    crashAnimationFrame = requestAnimationFrame(animateMultiplier);

    if (crashStatusInterval) clearInterval(crashStatusInterval);
    crashStatusInterval = setInterval(() => {
      if (crashGameState === 'running') checkCrashStatus();
      else { clearInterval(crashStatusInterval); crashStatusInterval = null; }
    }, 200);

  } catch (error) {
    showCrashToast('Erreur de connexion au serveur', 'danger');
    document.getElementById('crashStartBtn').disabled = false;
    crashGameState = 'idle';
    crashGameStarted = false;
  }
}

async function checkCrashStatus() {
  if (!crashSessionId || crashGameState !== 'running' || !crashGameStarted) return;

  try {
    const response = await fetch(`${CRASH_API_BASE}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: crashSessionId })
    });

    const data = await response.json();
    if (!data.success) return;

    if (data.crashed && !data.cashedOut) {
      crashGameState = 'crashed';
      crashPoint = data.crashPoint;
      currentMultiplier = data.crashPoint;
      crashPoint = data.crashPoint;


      if (crashAnimationFrame) {
        cancelAnimationFrame(crashAnimationFrame);
        crashAnimationFrame = null;
      }

      const multiplierEl = document.getElementById('crashMultiplier');
      if (multiplierEl) {
        multiplierEl.textContent = `${data.crashPoint.toFixed(2)}x`;
      }

      renderCanvas();

      showCrashResult(data.message || `💥 Crash à ${data.crashPoint}x !`, 'danger');

      const app = document.querySelector('.crash-app');
      setCrashAppState('crashed')

      document.getElementById('crashStartBtn').disabled = false;
      document.getElementById('crashCashOutBtn').disabled = true;
      document.getElementById('crashResetBtn').disabled = false;

      if (data.newPoints !== undefined) {
        updateCrashPoints(data.newPoints);
      }
      loadCrashHistory();

      if (data.keyDropped) {
        if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
        if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
          window.updateUserKeys(data.userKeys);
        }
      }
    }
  } catch (error) {
    // Erreur silencieuse
  }
}

async function crashCashOut() {
  if (!crashSessionId || crashGameState !== 'running') {
    showCrashToast('Aucune partie en cours', 'danger');
    return;
  }

  const cashBtn = document.getElementById('crashCashOutBtn');
  cashBtn.disabled = true;

  try {
    const response = await fetch(`${CRASH_API_BASE}/cashout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: crashSessionId })
    });

    const data = await response.json();

    if (!data.success) {
      if (data.crashed) {
        crashGameState = 'crashed';
        crashPoint = data.crashPoint;
        currentMultiplier = data.crashPoint;

        if (data.keyDropped) {
          if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
          if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
            window.updateUserKeys(data.userKeys);
          }
        }

        if (crashAnimationFrame) {
          cancelAnimationFrame(crashAnimationFrame);
          crashAnimationFrame = null;
        }

        const multiplierEl = document.getElementById('crashMultiplier');
        if (multiplierEl) {
          multiplierEl.textContent = `${data.crashPoint.toFixed(2)}x`;
        }

        renderCanvas();

        showCrashResult(data.message || `💥 Crash à ${data.crashPoint}x`, 'danger');

        const app = document.querySelector('.crash-app');
        setCrashAppState('crashed')

        document.getElementById('crashStartBtn').disabled = false;
        document.getElementById('crashResetBtn').disabled = false;

        if (data.newPoints !== undefined) {
          updateCrashPoints(data.newPoints);
        }
        loadCrashHistory();

        if (data.keyDropped) {
          if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
          if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
            window.updateUserKeys(data.userKeys);
          }
        }
      } else {
        showCrashToast(data.message || 'Cashout refusé', 'danger');
        cashBtn.disabled = false;
      }
      return;
    }

    crashGameState = 'won';
    currentMultiplier = data.multiplier;
    crashPoint = data.crashPoint;

    if (crashAnimationFrame) {
      cancelAnimationFrame(crashAnimationFrame);
      crashAnimationFrame = null;
    }

    const multiplierEl = document.getElementById('crashMultiplier');
    if (multiplierEl) {
      multiplierEl.textContent = `${data.multiplier.toFixed(2)}x`;
    }

    renderCanvas();

    showCrashResult(
      data.message || `🎉 Retiré à ${data.multiplier.toFixed(2)}x ! +${data.profit} pts`,
      'success'
    );

    updateCrashPoints(data.newPoints);
    loadCrashHistory();


    if (data.keyDropped) {
      if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
      if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
        window.updateUserKeys(data.userKeys);
      }
    }

    setCrashAppState('');
    document.getElementById('crashStartBtn').disabled = false;
    document.getElementById('crashResetBtn').disabled = false;

  } catch (error) {
    showCrashToast('Erreur de connexion', 'danger');
    cashBtn.disabled = false;
  }
}

function resetCrashGame() {
  crashSessionId = null;
  crashStartTime = null;
  crashGameState = 'idle';
  crashPoint = null;
  currentMultiplier = 1.0;
  crashGameStarted = false;
  pathPoints = [{ t: 0, m: 1.0 }];

  if (crashAnimationFrame) {
    cancelAnimationFrame(crashAnimationFrame);
    crashAnimationFrame = null;
  }

  if (crashCountdownInterval) {
    clearInterval(crashCountdownInterval);
    crashCountdownInterval = null;
  }

  if (crashStatusInterval) {
    clearInterval(crashStatusInterval);
    crashStatusInterval = null;
  }

  const multiplierEl = document.getElementById('crashMultiplier');
  if (multiplierEl) multiplierEl.textContent = '1.00x';

  const resultEl = document.getElementById('crashResult');
  if (resultEl) { resultEl.style.display = 'none'; resultEl.textContent = ''; }

  const statusEl = document.getElementById('crashStatus');
  if (statusEl) statusEl.textContent = 'En attente…';

  // Utiliser .crash-layout comme racine d'état (ou body de la modal)
  const app = document.querySelector('.crash-layout');
  if (app) {
    app.classList.remove('running', 'crashed');
    // Remonter sur .crash-app si elle existe encore
  }
  // Compatibilité avec l'ancienne classe .crash-app
  document.querySelector('.crash-app')?.classList.remove('running', 'crashed');

  document.getElementById('crashStartBtn').disabled = false;
  document.getElementById('crashCashOutBtn').disabled = true;
  document.getElementById('crashResetBtn').disabled = true;

  if (ctx) { ctx.clearRect(0, 0, CRASH_CANVAS_WIDTH, CRASH_CANVAS_HEIGHT); drawBackground(); }
}

// ========================================
// UTILITAIRES
// ========================================

function setCrashAppState(state) {
  // 'running' | 'crashed' | ''
  const targets = [
    document.querySelector('.crash-app'),
    document.querySelector('.crash-layout'),
    document.getElementById('crashModal'),
  ].filter(Boolean);

  targets.forEach(el => {
    el.classList.remove('running', 'crashed');
    if (state) el.classList.add(state);
  });
}

function showCrashResult(message, type) {
  const resultEl = document.getElementById('crashResult');
  if (!resultEl) return;
  resultEl.textContent = message;
  resultEl.style.display = 'block';
  // Supporte les deux conventions (crash__result--X et crash-result--X)
  resultEl.className = `crash-result crash-result--${type} crash__result--${type}`;
}

function updateCrashPoints(newPoints) {
  if (newPoints === undefined || newPoints === null) return;

  // Mettre à jour l'affichage local dans le jeu
  const pointsDisplay = document.querySelector('[data-user-points]');
  if (pointsDisplay) {
    pointsDisplay.textContent = `${newPoints} pts`;
  }

  // ✅ METTRE À JOUR LA NAVBAR EN TEMPS RÉEL
  if (typeof window.updateUserBalance === 'function') {
    window.updateUserBalance(newPoints);
  }

  // Mettre à jour le localStorage
  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    user.points = newPoints;
    localStorage.setItem('user', JSON.stringify(user));
  }

  if (window.currentUser) {
    window.currentUser.points = newPoints;
  }
}

function showCrashToast(message, type = 'info') {
  if (typeof showToast === 'function') {
    showToast(message, type);
  } else {
    alert(message);
  }
}

// ========================================
// HISTORIQUE
// ========================================

async function loadCrashHistory() {
  const list = document.getElementById('crashHistoryList');
  if (!list) return;

  try {
    const res = await fetch(`${CRASH_API_BASE}/history`, { credentials: 'include' });
    const data = await res.json();

    if (!data.success || !data.history.length) {
      list.innerHTML = '<p class="crash-history-empty">Aucune partie jouée pour l\'instant.</p>';
      return;
    }

    list.innerHTML = data.history.map(row => {
      const isWin = row.result === 'win';
      const mainLabel = isWin
        ? `Encaissé à ${row.cash_out_multiplier.toFixed(2)}x`
        : `Crash à ${row.crash_point.toFixed(2)}x`;
      const subLabel = isWin
        ? `Crash réel : ${row.crash_point.toFixed(2)}x`
        : '—';

      return `
        <div class="crash-history-row crash-history-row--${isWin ? 'win' : 'lose'}">
          <span class="crash-history-mult crash-history-mult--${isWin ? 'win' : 'lose'}">${mainLabel}</span>
          <span class="crash-history-sub">${subLabel}</span>
          <span class="crash-history-bet">${row.bet_amount} pts</span>
          <span class="crash-history-badge crash-history-badge--${isWin ? 'win' : 'lose'}">${isWin ? 'Victoire' : 'Crash'}</span>
        </div>`;
    }).join('');

  } catch (e) {
    const list = document.getElementById('crashHistoryList');
    if (list) list.innerHTML = '<p class="crash-history-empty">Erreur de chargement.</p>';
  }
}

function drawCountdown(number) {
  if (!ctx) return;

  // Redessiner le fond propre
  ctx.clearRect(0, 0, CRASH_CANVAS_WIDTH, CRASH_CANVAS_HEIGHT);
  drawBackground();

  // Cercle semi-transparent derrière le chiffre
  ctx.save();
  ctx.beginPath();
  ctx.arc(CRASH_CANVAS_WIDTH / 2, CRASH_CANVAS_HEIGHT / 2, 80, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Chiffre
  ctx.save();
  ctx.font = 'bold 120px "Orbitron", system-ui, monospace';
  ctx.fillStyle = '#00ff88';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 40;
  ctx.fillText(number, CRASH_CANVAS_WIDTH / 2, CRASH_CANVAS_HEIGHT / 2);
  ctx.restore();

  // Texte "Préparez-vous..." en dessous
  ctx.save();
  ctx.font = '20px "Orbitron", system-ui, monospace';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Préparez-vous...', CRASH_CANVAS_WIDTH / 2, CRASH_CANVAS_HEIGHT / 2 + 110);
  ctx.restore();
}

// ========================================
// INITIALISATION
// ========================================

/**
 * Initialise le jeu Crash (appelé au chargement de la modale)
 */
function initCrash() {
  const modal = document.getElementById('crashModal');
  if (!modal) return;

  // Canvas
  canvas = document.getElementById('crashCanvas');
  if (!canvas) return;

  // Résolution interne fixe, CSS gère l'affichage
  canvas.width = CRASH_CANVAS_WIDTH;
  canvas.height = CRASH_CANVAS_HEIGHT;
  ctx = canvas.getContext('2d');
  drawBackground();

  // Boutons (suppression anciens listeners via cloneNode)
  ['crashStartBtn', 'crashCashOutBtn', 'crashResetBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true));
  });

  const handlers = {
    crashStartBtn: startCrashGame,
    crashCashOutBtn: crashCashOut,
    crashResetBtn: resetCrashGame,
  };
  Object.entries(handlers).forEach(([id, fn]) => {
    document.getElementById(id)?.addEventListener('click', fn);
  });

  // Fermeture modale
  modal.querySelectorAll('.js-close-crash').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('is-open');
      if (crashAnimationFrame) cancelAnimationFrame(crashAnimationFrame);
      resetCrashGame();
    });
  });
}

// Initialiser si la modale existe déjà au chargement
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('crashModal')) {
    initCrash();
  }
});

// Écouter l'événement de chargement dynamique
document.addEventListener('crashModalLoaded', initCrash);

// Nettoyer l'animation avant de quitter la page
window.addEventListener('beforeunload', () => {
  if (crashAnimationFrame) cancelAnimationFrame(crashAnimationFrame);
});
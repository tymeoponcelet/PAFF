(function () {
    'use strict';

    const MULT_TABLE = {
        8: [7, 3, 1.3, 0.6, 0.4, 0.6, 1.3, 3, 7],
        12: [20, 8, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 8, 20],
        16: [50, 25, 10, 5, 4, 2, 1, 0.3, 0.1, 0.3, 1, 2, 4, 5, 10, 25, 50]
    };

    function multColor(m) {
        if (m >= 50) return { bg: '#c809ee', glow: '#c809ee66', text: '#fff' };
        if (m >= 10) return { bg: '#ff3366', glow: '#ff336666', text: '#fff' };
        if (m >= 5) return { bg: '#ff6a00', glow: '#ff6a0066', text: '#fff' };
        if (m >= 2) return { bg: '#f5c400', glow: '#f5c40066', text: '#1a1a2e' };
        if (m >= 1) return { bg: '#00c896', glow: '#00c89666', text: '#1a1a2e' };
        return { bg: '#4a5568', glow: '#4a556866', text: '#cbd5e0' };
    }

    let canvas, ctx, animId;
    let dpr = 1;
    let pegPositions = [];
    let slotPositions = [];
    let activeBalls = [];
    let ballsInFlight = 0;
    let pendingResult = null;
    let enJeu = false;
    let pegGlowFrames = {};
    let particles = [];

    // ─── DELTA TIME ───────────────────────────────
    // La vitesse est exprimée en "progression par ms" pour être indépendante du framerate.
    // BALL_SPEED_PER_MS est calé pour reproduire exactement l'ancienne vitesse à 60fps.
    let lastTimestamp = null;
    const BALL_SPEED_PER_MS = 0.045 / (1000 / 60); // ≈ 0.0027 par ms

    const MAX_W = 480;
    const PEG_R = 5;
    const BALL_R = 5;

    // ─── BOARD ────────────────────────────────────
    function buildBoard() {
        const rows = getRows();
        const mults = MULT_TABLE[rows];

        dpr = window.devicePixelRatio || 1;

        const container = canvas.parentElement;
        const cssW = Math.min(container.clientWidth || MAX_W, MAX_W);
        const cssH = Math.round(cssW * 0.82);

        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const W = cssW, H = cssH;
        const PAD_X = W * 0.07;
        const PAD_TOP = H * 0.07;
        const PAD_BOTTOM = H * 0.14;
        const usableW = W - 2 * PAD_X;
        const usableH = H - PAD_TOP - PAD_BOTTOM;
        const rowGap = usableH / (rows - 1);
        const colGap = usableW / rows;

        pegPositions = [];
        for (let r = 0; r < rows; r++) {
            const nbPegs = r + 2;
            const rowW = colGap * (nbPegs - 1);
            const startX = (W - rowW) / 2;
            const y = PAD_TOP + r * rowGap;
            for (let p = 0; p < nbPegs; p++) {
                pegPositions.push({ x: startX + p * colGap, y });
            }
        }

        // Slots : alignés exactement sur les pegs de la dernière rangée
        const nbSlots = mults.length;       // rows + 1
        const lastNbPegs = rows + 1;
        const lastRowW = colGap * (lastNbPegs - 1);
        const lastStartX = (W - lastRowW) / 2;
        const slotY = H - PAD_BOTTOM / 2;

        slotPositions = [];
        for (let s = 0; s < nbSlots; s++) {
            slotPositions.push({
                cx: lastStartX + s * colGap,
                y: slotY,
                w: colGap * 0.90,
                mult: mults[s],
                flash: 0
            });
        }

        drawBoard();
    }

    // ─── BACKGROUND ───────────────────────────────
    function drawBackground(W, H) {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0a0e1a');
        grad.addColorStop(0.5, '#0d1528');
        grad.addColorStop(1, '#060910');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 0.5;
        const step = 28;
        for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.restore();
    }

    // ─── PEG ──────────────────────────────────────
    function drawPeg(p, idx) {
        const glowing = (pegGlowFrames[idx] || 0) > 0;
        const cx = p.x, cy = p.y;

        if (glowing) {
            const halo = ctx.createRadialGradient(cx, cy, PEG_R, cx, cy, PEG_R * 4);
            halo.addColorStop(0, 'rgba(100,180,255,0.55)');
            halo.addColorStop(1, 'rgba(100,180,255,0)');
            ctx.beginPath();
            ctx.arc(cx, cy, PEG_R * 4, 0, Math.PI * 2);
            ctx.fillStyle = halo;
            ctx.fill();
        }

        const g = ctx.createRadialGradient(cx - PEG_R * 0.3, cy - PEG_R * 0.3, 0.5, cx, cy, PEG_R);
        if (glowing) {
            g.addColorStop(0, '#e0f4ff'); g.addColorStop(0.4, '#64b4ff'); g.addColorStop(1, '#1a4a8a');
        } else {
            g.addColorStop(0, '#c8dcf5'); g.addColorStop(0.4, '#5a8fc4'); g.addColorStop(1, '#1c3a6a');
        }
        ctx.beginPath(); ctx.arc(cx, cy, PEG_R, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();

        ctx.beginPath(); ctx.arc(cx - PEG_R * 0.28, cy - PEG_R * 0.28, PEG_R * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
    }

    // ─── SLOT ─────────────────────────────────────
    function drawSlot(s) {
        const palette = multColor(s.mult);
        const x = s.cx - s.w / 2, h = 26, y = s.y - h / 2, r = 6;
        const flash = s.flash || 0;

        ctx.save();
        if (flash > 0) { ctx.shadowColor = palette.bg; ctx.shadowBlur = 18 * flash; }

        const slotGrad = ctx.createLinearGradient(x, y, x, y + h);
        slotGrad.addColorStop(0, shadeColor(palette.bg, 30));
        slotGrad.addColorStop(0.5, palette.bg);
        slotGrad.addColorStop(1, shadeColor(palette.bg, -30));
        ctx.beginPath(); roundRect(ctx, x, y, s.w, h, r);
        ctx.fillStyle = slotGrad; ctx.globalAlpha = 0.90 + flash * 0.10; ctx.fill();

        ctx.strokeStyle = flash > 0 ? '#ffffff' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = flash > 0 ? 1.5 : 0.8;
        ctx.globalAlpha = flash > 0 ? 0.8 : 0.4; ctx.stroke();

        const refGrad = ctx.createLinearGradient(x, y, x, y + h * 0.45);
        refGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
        refGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath(); roundRect(ctx, x + 1, y + 1, s.w - 2, h * 0.45, r);
        ctx.fillStyle = refGrad; ctx.globalAlpha = 1; ctx.fill();
        ctx.restore();

        const fontSize = Math.max(9, Math.min(13, s.w * 0.26));
        ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
        ctx.fillStyle = palette.text; ctx.globalAlpha = flash > 0 ? 1 : 0.95;
        ctx.fillText(`${s.mult}x`, s.cx, s.y);
        ctx.restore();
    }

    // ─── BALL ─────────────────────────────────────
    function drawBall(b) {
        const cx = b.x, cy = b.y;

        if (b.trail) {
            b.trail.forEach((pt, i) => {
                const alpha = (i / b.trail.length) * 0.35;
                const r2 = BALL_R * (i / b.trail.length) * 0.7;
                ctx.beginPath(); ctx.arc(pt.x, pt.y, r2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(231,76,60,${alpha})`; ctx.fill();
            });
        }

        const halo = ctx.createRadialGradient(cx, cy, BALL_R * 0.5, cx, cy, BALL_R * 2.2);
        halo.addColorStop(0, 'rgba(231,76,60,0.30)');
        halo.addColorStop(1, 'rgba(231,76,60,0)');
        ctx.beginPath(); ctx.arc(cx, cy, BALL_R * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = halo; ctx.fill();

        const g = ctx.createRadialGradient(cx - BALL_R * 0.32, cy - BALL_R * 0.32, 0.5, cx, cy, BALL_R);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.25, '#ff6b6b');
        g.addColorStop(0.65, '#e74c3c');
        g.addColorStop(1, '#8b1a1a');
        ctx.beginPath(); ctx.arc(cx, cy, BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();

        ctx.beginPath(); ctx.arc(cx - BALL_R * 0.3, cy - BALL_R * 0.3, BALL_R * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
    }

    // ─── PARTICLES ────────────────────────────────
    function spawnParticles(x, y, color) {
        for (let i = 0; i < 14; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.2 + Math.random() * 3;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
                life: 1, decay: 0.045 + Math.random() * 0.03,
                r: 2 + Math.random() * 3, color
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.12; p.vx *= 0.97;
            p.life -= p.decay;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
            ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0');
            ctx.fill();
        }
    }

    // ─── DRAW BOARD ───────────────────────────────
    function drawBoard() {
        if (!ctx) return;
        const W = canvas.width / dpr, H = canvas.height / dpr;
        drawBackground(W, H);

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 0.8;
        const rows = getRows(); let offset = 0;
        for (let r = 0; r < rows - 1; r++) {
            const nbPegs = r + 2;
            for (let p = 0; p < nbPegs; p++) {
                const cur = pegPositions[offset + p];
                const nxt1 = pegPositions[offset + nbPegs + p];
                const nxt2 = pegPositions[offset + nbPegs + p + 1];
                if (cur && nxt1) { ctx.beginPath(); ctx.moveTo(cur.x, cur.y); ctx.lineTo(nxt1.x, nxt1.y); ctx.stroke(); }
                if (cur && nxt2) { ctx.beginPath(); ctx.moveTo(cur.x, cur.y); ctx.lineTo(nxt2.x, nxt2.y); ctx.stroke(); }
            }
            offset += nbPegs;
        }
        ctx.restore();

        pegPositions.forEach((p, idx) => drawPeg(p, idx));
        slotPositions.forEach(s => drawSlot(s));
        updateParticles();
        activeBalls.forEach(b => drawBall(b));
    }

    // ─── ANIMATION ────────────────────────────────
    //
    // Le timestamp fourni par requestAnimationFrame est utilisé pour calculer
    // le delta time (ms écoulées depuis la frame précédente).
    // La progression b.t avance de BALL_SPEED_PER_MS * delta ms,
    // ce qui donne une vitesse identique quel que soit le framerate (60/120/144Hz…).
    //
    function animate(timestamp) {
        animId = requestAnimationFrame(animate);

        // ── Delta time ──────────────────────────────
        // Plafonné à 100ms pour éviter un saut si l'onglet était en arrière-plan.
        if (lastTimestamp === null) lastTimestamp = timestamp;
        const delta = Math.min(timestamp - lastTimestamp, 100);
        lastTimestamp = timestamp;

        // ── Glow decay en ms (cible ~230ms de durée, soit ~14 frames à 60fps) ──
        Object.keys(pegGlowFrames).forEach(k => {
            pegGlowFrames[k] -= delta;
            if (pegGlowFrames[k] <= 0) delete pegGlowFrames[k];
        });
        slotPositions.forEach(s => { if (s.flash > 0) s.flash = Math.max(0, s.flash - 0.04 * (delta / (1000 / 60))); });

        for (let i = activeBalls.length - 1; i >= 0; i--) {
            const b = activeBalls[i];

            // Trail
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 10) b.trail.shift();

            // Avance la progression selon le temps écoulé (delta-time)
            b.t += BALL_SPEED_PER_MS * delta;

            if (b.t >= 1) {
                // Segment terminé → passe au suivant
                b.t = b.t - 1; // conserve le surplus pour ne pas perdre de progression
                b.segIdx++;

                if (b.segIdx >= b.waypoints.length - 1) {
                    // Tous les waypoints atteints → snap sur le slot et fin
                    const last = b.waypoints[b.waypoints.length - 1];
                    b.x = last.x; b.y = last.y;
                    const targetSlot = slotPositions[b.targetSlot];
                    const palette = multColor(targetSlot?.mult || 1);
                    spawnParticles(b.x, b.y, palette.bg);
                    activeBalls.splice(i, 1);
                    ballsInFlight--;
                    flashSlot(b.targetSlot);
                    if (ballsInFlight === 0) onAllBallsDone();
                    continue;
                }

                // Allume le peg qu'on vient d'atteindre
                const arrivedWp = b.waypoints[b.segIdx];
                if (arrivedWp.pegGlobalIdx != null) {
                    pegGlowFrames[arrivedWp.pegGlobalIdx] = 230; // durée en ms (~14 frames à 60fps)
                }
            }

            // Interpolation sur le segment courant avec arc parabolique
            const from = b.waypoints[b.segIdx];
            const to = b.waypoints[b.segIdx + 1];
            if (!from || !to) continue;

            const t = easeInQuad(Math.min(b.t, 1));
            b.x = from.x + (to.x - from.x) * t;
            b.y = from.y + (to.y - from.y) * t;

            // Petit arc parabolique entre deux pegs (pas sur le slot final)
            if (!to.isSlot) {
                const arc = Math.sin(Math.min(b.t, 1) * Math.PI) * 4;
                b.y -= arc;
            }
        }

        drawBoard();
    }

    function easeInQuad(t) { return t * t * (3 - 2 * t); } // smoothstep

    function flashSlot(idx) {
        const s = slotPositions[idx];
        if (s) s.flash = 1;
    }

    // ─── SPAWN BOULE ──────────────────────────────
    function spawnBall(slotIndex, delayMs, pegIndices) {
        setTimeout(() => {
            const rows = getRows();
            const waypoints = [];
            let pegOffset = 0;

            for (let r = 0; r < rows; r++) {
                const nbPegs = r + 2;
                const idx = Math.max(0, Math.min(pegIndices[r], nbPegs - 1));
                const globalIdx = pegOffset + idx;
                const peg = pegPositions[globalIdx];
                if (peg) waypoints.push({ x: peg.x, y: peg.y, pegGlobalIdx: globalIdx });
                pegOffset += nbPegs;
            }

            // Slot final
            const slot = slotPositions[slotIndex];
            if (slot) waypoints.push({ x: slot.cx, y: slot.y, isSlot: true });

            if (waypoints.length < 2) return;

            ballsInFlight++;
            activeBalls.push({
                x: waypoints[0].x,
                y: waypoints[0].y - 20,
                trail: [],
                segIdx: 0,
                t: 0,
                targetSlot: slotIndex,
                waypoints
            });
        }, delayMs);
    }

    // ─── JOUER ────────────────────────────────────
    function onPlay() {
        if (enJeu) return;
        const btn = document.getElementById('playPlinko');
        const betEl = document.getElementById('plinkoBetAmount');
        const ballsEl = document.getElementById('ballCount');
        const rowsEl = document.getElementById('rowCount');

        const betAmount = parseInt(betEl.value) || 0;
        const ballCount = parseInt(ballsEl.value) || 1;
        const rows = parseInt(rowsEl.value) || 12;

        if (betAmount < 100) return showError('Mise min. 100 pts');

        enJeu = true;
        btn.disabled = true;
        btn.innerHTML = '<span class="plinko-btn-spinner"></span> En cours…';

        fetch('/actions/plinko/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ betAmount, ballCount, rows })
        })
            .then(r => r.json())
            .then(data => {
                if (!data.success) {
                    enJeu = false;
                    return showError(data.message || 'Erreur');
                }
                pendingResult = data;

                data.resultats.forEach((res, i) => {
                    spawnBall(res.slotIndex, i * 700, res.pegIndices);
                });

                if (!animId) animate(performance.now());
            })
            .catch(() => { enJeu = false; showError('Erreur réseau'); });
    }

    function onAllBallsDone() {
        cancelAnimationFrame(animId);
        animId = null;
        lastTimestamp = null; // reset pour la prochaine animation
        enJeu = false;
        drawBoard();
        if (pendingResult) {
            updatePointsDisplay(pendingResult.newPoints);
            showResultats(pendingResult);
            pendingResult = null;
        }
        resetBtn();
    }

    // ─── RÉSULTATS ────────────────────────────────
    function showResultats(data) {
        const list = document.getElementById('historyList');
        if (!list) return;
        list.querySelector('.plinko-history-empty')?.remove();

        const item = document.createElement('div');
        item.className = 'plinko-history-item';
        const sign = data.profit >= 0 ? '+' : '';
        const color = data.profit >= 0 ? '#00c896' : '#ff4466';
        const icon = data.profit >= 0 ? '▲' : '▼';
        item.innerHTML = `
            <span class="phi-meta">${data.resultats.length} boule(s) × ${data.totalBet / data.resultats.length} pts</span>
            <span class="phi-result" style="color:${color}">${icon} ${sign}${data.profit} pts</span>
        `;
        item.style.opacity = '0'; item.style.transform = 'translateY(-8px)';
        list.prepend(item);
        requestAnimationFrame(() => {
            item.style.transition = 'opacity 0.3s, transform 0.3s';
            item.style.opacity = '1'; item.style.transform = 'translateY(0)';
        });
        while (list.children.length > 8) list.removeChild(list.lastChild);
    }

    // ─── HELPERS ──────────────────────────────────
    function getRows() {
        return parseInt(document.getElementById('rowCount')?.value) || 12;
    }

    function adjustInput(id, delta, min, max) {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = Math.max(min, Math.min(max, (parseInt(el.value) || 0) + delta));
        updateTotalBet();
    }

    function updateTotalBet() {
        const bet = parseInt(document.getElementById('plinkoBetAmount')?.value) || 100;
        const nbB = parseInt(document.getElementById('ballCount')?.value) || 1;
        const el = document.getElementById('totalBet');
        if (el) el.textContent = `${bet * nbB} pts`;
    }

    function updateBalanceDisplay() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const el = document.getElementById('playerBalance');
        if (el && user.points != null) el.textContent = `${user.points} pts`;
    }

    function updatePointsDisplay(newPoints) {
        if (newPoints == null) return;
        document.querySelectorAll('[data-user-points]').forEach(el => {
            el.textContent = `${newPoints} pts`;
        });
        if (typeof window.updateUserBalance === 'function') window.updateUserBalance(newPoints);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.points = newPoints;
        localStorage.setItem('user', JSON.stringify(user));
        updateBalanceDisplay();
    }

    function resetBtn() {
        const btn = document.getElementById('playPlinko');
        if (!btn) return;
        btn.disabled = false;
        btn.innerHTML = '▶ Lancer les boules';
    }

    function showError(msg) {
        const btn = document.getElementById('playPlinko');
        if (btn) { btn.innerHTML = `⚠ ${msg}`; setTimeout(resetBtn, 2500); }
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function shadeColor(hex, pct) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + pct));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
        const b = Math.min(255, Math.max(0, (num & 0xff) + pct));
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    }

    // ─── INIT ─────────────────────────────────────
    window.initPlinko = function () {
        const modal = document.getElementById('plinkoModal');
        if (!modal) return;

        canvas = document.getElementById('plinkoCanvas');
        ctx = canvas.getContext('2d');

        document.getElementById('decreaseBet')?.addEventListener('click', () => adjustInput('plinkoBetAmount', -50, 100, 1000));
        document.getElementById('increaseBet')?.addEventListener('click', () => adjustInput('plinkoBetAmount', +50, 100, 1000));
        document.getElementById('decreaseBalls')?.addEventListener('click', () => adjustInput('ballCount', -1, 1, 10));
        document.getElementById('increaseBalls')?.addEventListener('click', () => adjustInput('ballCount', +1, 1, 10));

        document.getElementById('plinkoBetAmount')?.addEventListener('input', () => {
            const el = document.getElementById('plinkoBetAmount');
            if (parseInt(el.value) > 1000) el.value = 1000;
            if (parseInt(el.value) < 100) el.value = 100;
            updateTotalBet();
        });
        document.getElementById('ballCount')?.addEventListener('input', updateTotalBet);
        document.getElementById('rowCount')?.addEventListener('change', () => { updateTotalBet(); buildBoard(); });
        document.getElementById('playPlinko')?.addEventListener('click', onPlay);

        modal.querySelectorAll('.js-close-plinko-modal').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        window.addEventListener('resize', () => buildBoard());

        buildBoard();
        updateTotalBet();
        updateBalanceDisplay();
    };

    function closeModal() {
        const modal = document.getElementById('plinkoModal');
        if (modal) modal.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('plinkoModal')) window.initPlinko();
    });
    document.addEventListener('plinkoModalLoaded', () => window.initPlinko());

})();
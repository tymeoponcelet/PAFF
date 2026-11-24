(function () {
  "use strict";

  const ITEM_GAP = 5;
  const TRACK_LEN = 65;

  function getItemW() {
    return window.matchMedia("(max-width: 500px)").matches ? 95 : 118;
  }

  const POOL = [
    { rarity: "common", icon: "⚙️", value: 50, label: "Commun" },
    { rarity: "common", icon: "🔩", value: 70, label: "Commun" },
    { rarity: "common", icon: "💾", value: 90, label: "Commun" },
    { rarity: "common", icon: "📡", value: 80, label: "Commun" },
    { rarity: "common", icon: "🔋", value: 60, label: "Commun" },
    { rarity: "common", icon: "🖲️", value: 100, label: "Commun" },
    { rarity: "common", icon: "🔌", value: 55, label: "Commun" },
    { rarity: "rare", icon: "💠", value: 160, label: "Rare" },
    { rarity: "rare", icon: "⚡", value: 200, label: "Rare" },
    { rarity: "rare", icon: "🔷", value: 180, label: "Rare" },
    { rarity: "rare", icon: "🌐", value: 240, label: "Rare" },
    { rarity: "rare", icon: "🛡️", value: 290, label: "Rare" },
    { rarity: "epic", icon: "🔮", value: 330, label: "Épique" },
    { rarity: "epic", icon: "🌌", value: 380, label: "Épique" },
    { rarity: "epic", icon: "💜", value: 360, label: "Épique" },
    { rarity: "epic", icon: "🧬", value: 420, label: "Épique" },
    { rarity: "legendary", icon: "👑", value: 500, label: "Légendaire" },
    { rarity: "legendary", icon: "💎", value: 480, label: "Légendaire" },
    { rarity: "legendary", icon: "⭐", value: 460, label: "Légendaire" },
    { rarity: "mythic", icon: "☣️", value: 3000, label: "Mythique" },
  ];

  const W = { common: 50, rare: 30, epic: 15, legendary: 5, mythic: 0.5 };

  const $ = (id) => document.getElementById(id);

  let keys = 0;
  let spinning = false;
  let currentQty = 1; // quantité sélectionnée
  let lastQty = 1; // quantité du dernier spin (pour replay)
  let currentSpins = []; // [{ winIdx, sub }, ...]
  let replayHandler = null;

  function pick(pool, weights) {
    const byRarity = {};
    pool.forEach((p) => {
      (byRarity[p.rarity] = byRarity[p.rarity] || []).push(p);
    });
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [rarity, weight] of Object.entries(weights)) {
      r -= weight;
      if (r <= 0) {
        const arr = byRarity[rarity];
        return arr[Math.floor(Math.random() * arr.length)];
      }
    }
    return pool[0];
  }

  function setKeys(n) {
    keys = Math.max(0, n);
    const keysEl = $("chestKeysCount");
    const replayEl = $("replayKeysCount");
    const openBtn = $("chestOpenBtn");
    const replayBtn = $("replayBtn");
    const noKeysEl = $("chestNoKeys");
    if (keysEl) keysEl.textContent = keys;
    if (replayEl) replayEl.textContent = keys;
    if (openBtn) openBtn.disabled = keys < 1 || spinning;
    if (replayBtn) replayBtn.disabled = keys < lastQty || spinning;
    if (noKeysEl) noKeysEl.style.display = keys < 1 ? "block" : "none";
    updateQtyButtons();
  }

  // ── Gestion du sélecteur de quantité ──────────────────────────────────────
  function updateQtyButtons() {
    document.querySelectorAll(".chest-qty-btn").forEach((btn) => {
      const qty = parseInt(btn.dataset.qty, 10);
      btn.disabled = qty > keys || spinning;
      btn.classList.toggle("is-active", qty === currentQty);
    });
    // Libellé du bouton principal
    const costEl = $("chestOpenCost");
    if (costEl)
      costEl.textContent = currentQty === 1 ? "1 clé" : `${currentQty} clés`;
    // Désactive le bouton si pas assez de clés
    const openBtn = $("chestOpenBtn");
    if (openBtn) openBtn.disabled = keys < currentQty || spinning;
  }

  function selectQty(qty) {
    currentQty = qty;
    for (let i = 1; i <= 3; i++) {
      const w = $(`rouletteWrapper${i}`);
      if (w) w.classList.toggle("roulette-wrapper--hidden", i > qty);
    }

    for (let i = 2; i <= qty; i++) {
      const trackEl = $(`rouletteTrack${i}`);
      if (trackEl && trackEl.children.length === 0) {
        buildTrack(trackEl, pick(POOL, W), Math.floor(TRACK_LEN / 2));
      }
    }

    updateQtyButtons();
  }

  // ── Construction de la track ───────────────────────────────────────────────
  function makeItem(data) {
    const el = document.createElement("div");
    el.className = `roulette-item roulette-item--${data.rarity}`;
    el.innerHTML = `
      <span class="roulette-item__icon">${data.icon}</span>
      <span class="roulette-item__value">+${data.value} pts</span>
      <span class="roulette-item__tag">${data.label}</span>
    `;
    return el;
  }

  function buildTrack(trackEl, winner, winIdx) {
    if (!trackEl) return;
    trackEl.innerHTML = "";
    trackEl.style.transition = "none";
    trackEl.style.transform = "translateX(0)";
    for (let i = 0; i < TRACK_LEN; i++) {
      trackEl.appendChild(makeItem(i === winIdx ? winner : pick(POOL, W)));
    }
    trackEl.getBoundingClientRect();
  }

  function easeOutQuint(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  function calcFinalX(wrapperId, winIdx, sub) {
    const wrapper = $(wrapperId);
    let ww = wrapper
      ? wrapper.getBoundingClientRect().width
      : window.innerWidth;
    if (!ww) ww = window.innerWidth;
    const itemW = getItemW();
    const itemStep = itemW + ITEM_GAP;
    const center = ww / 2 - itemW / 2;
    return -(winIdx * itemStep - center + sub);
  }

  // ── Spin d'une seule track ─────────────────────────────────────────────────
  function doSingleSpin(trackEl, wrapperId, winIdx, sub, onDone) {
    let finalX = calcFinalX(wrapperId, winIdx, sub);
    const DURATION = 5800;
    const start = performance.now();

    function frame(now) {
      const t = Math.min((now - start) / DURATION, 1);
      const eased = easeOutQuint(t);
      trackEl.style.transform = `translateX(${finalX * eased}px)`;
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        trackEl.style.transform = `translateX(${finalX}px)`;
        onDone();
      }
    }
    requestAnimationFrame(frame);
  }

  // ── Lancement de N spins simultanés ───────────────────────────────────────
  function startMultiSpin(winners) {
    const qty = winners.length;
    const area = $("rouletteArea");
    if (area) area.classList.add("is-spinning");

    currentSpins = [];
    let finishedCount = 0;
    const winIdxBase = Math.floor(TRACK_LEN * 0.72);

    for (let i = 0; i < qty; i++) {
      const trackId = `rouletteTrack${i + 1}`;
      const wrapperId = `rouletteWrapper${i + 1}`;
      const trackEl = $(trackId);
      const winIdx =
        winIdxBase + Math.floor(Math.random() * Math.floor(TRACK_LEN * 0.1));
      const sub = (Math.random() - 0.5) * 50;

      currentSpins.push({ winIdx, sub, wrapperId });
      buildTrack(trackEl, winners[i], winIdx);

      // Double rAF pour garantir le reflow
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          doSingleSpin(trackEl, wrapperId, winIdx, sub, () => {
            // Highlight de l'item gagnant
            highlightWinner(trackEl, winIdx, winners[i].rarity);
            finishedCount++;
            if (finishedCount === qty) {
              if (area) area.classList.remove("is-spinning");
              setTimeout(() => showMultiPopup(winners), 550);
            }
          });
        }),
      );
    }
  }

  function highlightWinner(trackEl, winIdx, rarity) {
    const winEl = trackEl.querySelectorAll(".roulette-item")[winIdx];
    if (!winEl) return;
    winEl.style.transition =
      "transform 0.4s cubic-bezier(0.17,0.67,0.12,1.3), box-shadow 0.4s ease";
    winEl.style.transform = "scale(1.18)";
    if (rarity === "legendary")
      winEl.style.boxShadow =
        "0 0 30px rgba(251,191,36,0.8), 0 0 60px rgba(251,191,36,0.4)";
    else if (rarity === "epic")
      winEl.style.boxShadow = "0 0 24px rgba(168,85,247,0.7)";
    else if (rarity === "rare")
      winEl.style.boxShadow = "0 0 24px rgba(56,189,248,0.7)";
    else if (rarity === "mythic")
      winEl.style.boxShadow =
        "0 0 40px rgba(239,68,68,0.9), 0 0 80px rgba(239,68,68,0.5)";
  }

  // ── Popup multi-résultats ──────────────────────────────────────────────────
  const RARITY_COLOR = {
    common: "#9ca3af",
    rare: "#38bdf8",
    epic: "#a855f7",
    legendary: "#fbbf24",
    mythic: "#ef4444",
  };

  function showMultiPopup(winners) {
    const popup = $("resultPopup");
    const resultCard = $("resultCard");
    const multiEl = $("popupMulti");
    const totalEl = $("popupTotal");
    if (!popup || !resultCard) return;

    // Détermine la rareté la plus haute pour la couleur de la card
    const rarityOrder = ["common", "rare", "epic", "legendary", "mythic"];
    const topRarity = winners.reduce((best, w) => {
      return rarityOrder.indexOf(w.rarity) > rarityOrder.indexOf(best)
        ? w.rarity
        : best;
    }, "common");
    resultCard.setAttribute("data-rarity", topRarity);

    // Lignes de résultats
    if (multiEl) {
      multiEl.innerHTML = winners
        .map(
          (w) => `
        <div class="popup-multi-row">
          <span class="popup-multi-row__icon">${w.icon}</span>
          <span class="popup-multi-row__value">+${w.value} pts</span>
          <span class="popup-multi-row__rarity" style="color:${RARITY_COLOR[w.rarity] || "#9ca3af"}">${w.label}</span>
        </div>
      `,
        )
        .join("");
    }

    // Total
    const total = winners.reduce((s, w) => s + w.value, 0);
    if (totalEl)
      totalEl.textContent = winners.length > 1 ? `Total : +${total} pts` : "";

    popup.classList.add("is-visible");
    spinning = false;
    currentSpins = [];
    setKeys(keys);
  }

  function hidePopup() {
    const popup = $("resultPopup");
    if (popup) popup.classList.remove("is-visible");
  }

  function enrichWinner(serverWinner) {
    const match = POOL.find(
      (p) => p.value === serverWinner.value && p.icon === serverWinner.icon,
    );
    return match || { ...serverWinner, label: serverWinner.rarity };
  }

  // ── Resize handler ────────────────────────────────────────────────────────
  window.addEventListener("resize", () => {
    if (!currentSpins.length) return;
    currentSpins.forEach((spin, i) => {
      const trackEl = $(`rouletteTrack${i + 1}`);
      if (!trackEl) return;
      const newFinalX = calcFinalX(spin.wrapperId, spin.winIdx, spin.sub);
      trackEl.style.transition = "none";
      trackEl.style.transform = `translateX(${newFinalX}px)`;
    });
  });

  /* ── API PUBLIQUE ── */
  window.ChestRoulette = {
    init() {
      // Initialise la première track avec un item aléatoire
      buildTrack($("rouletteTrack1"), pick(POOL, W), Math.floor(TRACK_LEN / 2));

      // Backdrop popup
      const backdrop = document.querySelector(
        "#resultPopup .roulette-result-popup__backdrop",
      );
      if (backdrop) backdrop.addEventListener("click", hidePopup);

      // Boutons de quantité
      document.querySelectorAll(".chest-qty-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (spinning || btn.disabled) return;
          selectQty(parseInt(btn.dataset.qty, 10));
        });
      });

      // Replay : attaché une seule fois
      const replayBtn = $("replayBtn");
      if (replayBtn && !replayHandler) {
        replayHandler = async () => {
          if (keys < lastQty || spinning) return;
          hidePopup();
          const results = await window.openChestMulti(lastQty);
          if (results) {
            const winners = results.winners.map(enrichWinner);
            window.ChestRoulette.setKeys(results.newKeys);
            window.ChestRoulette.openWithResults(winners);
          }
        };
        replayBtn.addEventListener("click", replayHandler);
      }
    },

    setKeys,

    // Lance N spins avec les winners fournis
    openWithResults(winners) {
      if (spinning) return;
      hidePopup();
      spinning = true;
      lastQty = winners.length;
      selectQty(winners.length);
      const openBtn = $("chestOpenBtn");
      if (openBtn) openBtn.disabled = true;
      updateQtyButtons();
      startMultiSpin(winners);
    },

    // Rétrocompatibilité (1 seul coffre)
    openWithResult(winnerData) {
      this.openWithResults([winnerData]);
    },
  };
})();

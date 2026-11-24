let lastTimeCheck = 0;
const TIME_CHECK_INTERVAL = 5000;

async function checkUserTimeRemaining() {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user || !user.logged) {
    return false;
  }

  const now = Date.now();
  if (now - lastTimeCheck < TIME_CHECK_INTERVAL) {
    return true;
  }
  lastTimeCheck = now;

  try {
    const response = await fetch(
      `/actions/check_session_time?userId=${user.id}`,
    );
    const data = await response.json();

    if (data.expired || data.timeRemaining <= 0) {
      if (typeof handleSessionExpired === "function") {
        await handleSessionExpired();
      }
      return false;
    }

    return true;
  } catch (error) {
    return true;
  }
}

function showTimeExpiredModal() {
  const oldModal = document.querySelector(".time-expired-modal");
  if (oldModal) {
    oldModal.remove();
  }

  closeAllGameModals();

  const modal = document.createElement("div");
  modal.className = "modal-overlay time-expired-modal";
  modal.style.cssText = `
    display: flex !important;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    z-index: 999999;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(10px);
  `;

  modal.innerHTML = `
    <div class="modal" style="
      max-width: 600px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 2px solid #ef4444;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(239, 68, 68, 0.5);
      animation: modalFadeIn 0.5s ease;
    ">
      <div class="modal__header" style="
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        padding: 2rem;
        border-radius: 18px 18px 0 0;
      ">
        <h2 class="modal__title" style="
          color: white;
          font-size: 2rem;
          margin: 0;
          text-align: center;
          text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        ">
          ⏰ Temps de jeu épuisé
        </h2>
      </div>

      <div class="modal__body" style="
        padding: 3rem 2rem;
        text-align: center;
      ">
        <div style="
          font-size: 6rem;
          margin-bottom: 2rem;
          animation: pulse 2s ease-in-out infinite;
        ">
          🎮
        </div>

        <p style="
          font-size: 1.4rem;
          margin-bottom: 1.5rem;
          color: #ffffff;
          font-weight: bold;
          line-height: 1.6;
        ">
          Vous avez utilisé votre <span style="color: #fbbf24;">heure de connexion quotidienne</span>
        </p>

        <p style="
          color: #94a3b8;
          margin-bottom: 2rem;
          font-size: 1.1rem;
          line-height: 1.8;
        ">
          Pour votre bien-être, prenez une pause ! 🌟<br>
          Revenez demain pour continuer à jouer.
        </p>

        <div style="
          background: rgba(251, 191, 36, 0.1);
          border: 2px solid #fbbf24;
          border-radius: 10px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        ">
          <p style="
            color: #fbbf24;
            margin: 0;
            font-size: 1rem;
          ">
            💡 <strong>Le saviez-vous ?</strong><br>
            Des pauses régulières améliorent votre santé et vos performances !
          </p>
        </div>

        <button id="redirectInfoBtn" style="
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          padding: 1rem 2.5rem;
          font-size: 1.2rem;
          font-weight: bold;
          border-radius: 10px;
          cursor: pointer;
          margin-right: 1rem;
          box-shadow: 0 5px 15px rgba(16, 185, 129, 0.4);
          transition: all 0.3s ease;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(16, 185, 129, 0.6)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 5px 15px rgba(16, 185, 129, 0.4)'">
          📚 En savoir plus sur les écrans
        </button>

        <button id="logoutBtn" style="
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          border: none;
          padding: 1rem 2.5rem;
          font-size: 1.2rem;
          font-weight: bold;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 5px 15px rgba(239, 68, 68, 0.4);
          transition: all 0.3s ease;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(239, 68, 68, 0.6)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 5px 15px rgba(239, 68, 68, 0.4)'">
          🚪 Me déconnecter
        </button>
      </div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes modalFadeIn {
      from {
        opacity: 0;
        transform: scale(0.8) translateY(-50px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.1);
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      e.stopPropagation();
    }
  });

  document
    .getElementById("redirectInfoBtn")
    .addEventListener("click", async () => {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user && user.id) {
        try {
          await fetch("/actions/end_session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id }),
          });
        } catch (error) {}
      }

      localStorage.removeItem("user");
      window.location.href =
        "https://www.drogues.gouv.fr/lessentiel-sur-les-usages-problematiques-decrans";
    });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user && user.id) {
      try {
        await fetch("/actions/end_session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
      } catch (error) {}
    }

    localStorage.removeItem("user");
    window.location.href = "/logout";
  });
}

function closeAllGameModals() {
  const modals = document.querySelectorAll(".modal-overlay.is-open");
  modals.forEach((modal) => {
    modal.classList.remove("is-open");
  });
  document.body.style.overflow = "";
}

async function openGameWithTimeCheck(gameOpenFunction) {
  const hasTime = await checkUserTimeRemaining();

  if (!hasTime) {
    return false;
  }

  gameOpenFunction();
  return true;
}

async function loadComponent(url, containerId) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);

    const html = await response.text();
    const container = document.getElementById(containerId);

    if (container) {
      container.innerHTML = html;

      if (containerId === "game-cards-container") {
        attachGameCardEvents();
        initScratchCard();
      }

      if (containerId === "leaderboard-container") {
        await new Promise((resolve) => setTimeout(resolve, 100));
        document.dispatchEvent(new Event("leaderboardLoaded"));
      }
    }
  } catch (error) {}
}

async function loadModal(modalName) {
  const modalId = `${modalName}Modal`;

  if (
    document.getElementById(modalId) ||
    document.getElementById(`modal-${modalName}`)
  ) {
    return true;
  }

  if (modalName === "blackjack-win-popup") {
    if (document.getElementById("winPopupOverlay")) {
      return true;
    }
  }

  // ✅ Vérifier pour la popup Mastermind avec le bon ID
  if (modalName === "mastermind-win-popup") {
    if (document.getElementById("mastermindWinPopupOverlay")) {
      return true;
    }
  }

  if (modalName === "roulette-win-popup") {
    if (document.getElementById("rouletteWinPopupOverlay")) {
      return true;
    }
  }

  if (modalName === "wheel") {
    if (document.getElementById("wheelResultModal")) {
      return true;
    }
  }

  if (modalName === "chest") {
    if (document.getElementById("chestOverlay")) {
      return true;
    }
  }

  try {
    let url;
    // ✅ Les popups n'ont pas -modal dans le nom de fichier
    if (
      modalName === "blackjack-win-popup" ||
      modalName === "mastermind-win-popup" ||
      modalName === "roulette-win-popup"
    ) {
      url = `/static/templates/modals/${modalName}.html`;
    } else {
      url = `/static/templates/modals/${modalName}-modal.html`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);

    const html = await response.text();

    const temp = document.createElement("div");
    temp.innerHTML = html.trim();
    document.body.appendChild(temp.firstElementChild);

    await new Promise((resolve) => setTimeout(resolve, 100));

    reinitGameEvents(modalName);

    await new Promise((resolve) => setTimeout(resolve, 100));

    return true;
  } catch (error) {
    console.error(`❌ Erreur chargement modale ${modalName}:`, error);
    return false;
  }
}

function reinitGameEvents(modalName) {
  //console.log(` Réinitialisation événements: ${modalName}`);

  if (modalName === "help") {
    if (typeof initHelp === "function") {
      initHelp();
    }
    document.dispatchEvent(new Event("helpModalLoaded"));
    return;
  }

  setTimeout(() => {
    switch (modalName) {
      case "blackjack":
        if (typeof initBlackjack === "function") {
          initBlackjack();
        }
        document.dispatchEvent(new Event("blackjackModalLoaded"));

        setTimeout(() => {
          if (typeof initBlackjackWinPopup === "function") {
            initBlackjackWinPopup();
          }
        }, 300);
        break;

      case "mastermind":
        if (typeof window.initMastermind === "function") {
          window.initMastermind();
        } else {
          console.error("❌ initMastermind() introuvable");
        }
        document.dispatchEvent(new Event("mastermindModalLoaded"));

        setTimeout(() => {
          if (typeof initMastermindWinPopup === "function") {
            initMastermindWinPopup();
          }
        }, 300);
        break;

      case "puissance4":
        if (typeof initPuissance4 === "function") {
          initPuissance4();
        }
        document.dispatchEvent(new Event("puissance4ModalLoaded"));
        break;

      case "demineur":
        if (typeof initDemineur === "function") {
          initDemineur();
        }
        document.dispatchEvent(new Event("demineurModalLoaded"));
        break;

      case "plinko":
        if (typeof window.initPlinko === "function") {
          window.initPlinko();
        }
        document.dispatchEvent(new Event("plinkoModalLoaded"));
        break;

      case "crash":
        if (typeof initCrash === "function") {
          initCrash();
        }
        document.dispatchEvent(new Event("crashModalLoaded"));
        break;

      case "flappy":
        if (typeof initFlappy === "function") {
          initFlappy();
        }
        document.dispatchEvent(new Event("flappyModalLoaded"));
        break;

      case "tapetaupe":
        if (typeof initTapeTaupe === "function") {
          initTapeTaupe();
        }
        document.dispatchEvent(new Event("tapetaupeModalLoaded"));
        break;

      case "quiz":
        // quiz-client.js écoute cet événement et appelle initQuiz()
        document.dispatchEvent(new Event("quizModalLoaded"));
        break;

      case "hi-low":
        if (typeof initHilow === "function") {
          initHilow();
        }
        document.dispatchEvent(new Event("hilowModalLoaded"));

        setTimeout(() => {
          if (typeof initBlackjackWinPopup === "function") {
            initBlackjackWinPopup();
          }
        }, 300);
        break;

      case "scratch":
        if (typeof initScratch === "function") {
          initScratch();
        }
        document.dispatchEvent(new Event("scratchModalLoaded"));

        setTimeout(() => {
          if (typeof initBlackjackWinPopup === "function") {
            initBlackjackWinPopup();
          }
        }, 300);
        break;

      case "bonus":
        if (typeof initBonus === "function") {
          initBonus();
        }
        document.dispatchEvent(new Event("bonusModalLoaded"));
        break;

      case "wheel":
        if (typeof initWheel === "function") {
          initWheel();
        }
        document.dispatchEvent(new Event("wheelModalLoaded"));
        break;

      case "chest":
        if (typeof initChest === "function") initChest();
        const chestOverlay = document.getElementById("chestOverlay");
        if (chestOverlay) chestOverlay.classList.add("is-open");
        document.dispatchEvent(new Event("chestModalLoaded"));
        break;

      case "roulette":
        if (typeof window.initRoulette === "function") {
          window.initRoulette();
        } else {
          console.error("❌ initRoulette() introuvable");
        }
        document.dispatchEvent(new Event("rouletteModalLoaded"));
        setTimeout(() => {
          if (typeof initRouletteWinPopup === "function") {
            initRouletteWinPopup();
          }
        }, 300);
        break;
    }
  }, 150);
}

function initChest() {
  const overlay = document.getElementById("chestOverlay");
  const modal = document.getElementById("chestModal");
  if (!overlay || !modal) return;

  const keysCountEl = document.getElementById("chestKeysCount");
  const keysPluralEl = document.getElementById("chestKeysPlural");
  const noKeysEl = document.getElementById("chestNoKeys");
  const openBtn = document.getElementById("chestOpenBtn");

  function getUserKeys() {
    const user = JSON.parse(localStorage.getItem("user"));
    const keys = user && user.cles != null ? user.cles : 0;
    return { user, keys };
  }

  function updateChestUIFromUser() {
    const { keys } = getUserKeys();
    if (keysCountEl) keysCountEl.textContent = keys;
    if (keysPluralEl) keysPluralEl.textContent = keys !== 1 ? "s" : "";
    if (openBtn) openBtn.disabled = keys < 1;
    if (noKeysEl) noKeysEl.style.display = keys < 1 ? "block" : "none";
  }

  updateChestUIFromUser();

  // Initialiser la roulette
  if (window.ChestRoulette && typeof window.ChestRoulette.init === "function") {
    window.ChestRoulette.init();
    window.ChestRoulette.setKeys(getUserKeys().keys);
  }

  let controller = null;
  if (
    window.PaffChest &&
    typeof window.PaffChest.attachChestCinematicToModal === "function"
  ) {
    controller = window.PaffChest.attachChestCinematicToModal(modal);
    if (controller) {
      controller.updateKeysUI(getUserKeys().keys);
    }
  }

  const closeModal = () => {
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  };

  const closeBtn = document.getElementById("chestClose");
  if (closeBtn) {
    const newBtn = closeBtn.cloneNode(true);
    closeBtn.replaceWith(newBtn);
    document.getElementById("chestClose").addEventListener("click", closeModal);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  window.openChestMulti = async function (qty = 1) {
    const { user } = getUserKeys();
    if (!user || !user.logged) return null;
    try {
      // Envoie qty dans le body — adaptez open-chest.js pour le lire
      const res = await fetch("/actions/open_chest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ qty }),
      });
      const data = await res.json();
      if (data.success) {
        if (typeof window.updateUserBalance === "function")
          window.updateUserBalance(data.newPoints);
        if (typeof window.updateUserKeys === "function")
          window.updateUserKeys(data.newKeys);
        const u = JSON.parse(localStorage.getItem("user"));
        if (u) {
          u.points = data.newPoints;
          u.cles = data.newKeys;
          localStorage.setItem("user", JSON.stringify(u));
        }
        updateChestUIFromUser();
        return {
          winners: data.winners,
          newPoints: data.newPoints,
          newKeys: data.newKeys,
        };
      } else {
        if (typeof showToast === "function")
          showToast(data.message || "Erreur", "danger");
        updateChestUIFromUser();
        return null;
      }
    } catch (err) {
      if (typeof showToast === "function") showToast("Erreur réseau", "danger");
      updateChestUIFromUser();
      return null;
    }
  };

  // Rétrocompatibilité
  window.openChestOnServer = () => window.openChestMulti(1);

  // Bouton principal
  if (!controller && openBtn) {
    openBtn.addEventListener("click", async () => {
      if (openBtn.disabled) return;
      openBtn.disabled = true;
      const qty = parseInt(
        document.querySelector(".chest-qty-btn.is-active")?.dataset.qty || "1",
        10,
      );
      const results = await window.openChestMulti(qty);
      if (results && window.ChestRoulette) {
        const winners = results.winners.map((w) => {
          // enrichit avec le label FR
          const match = window._CHEST_POOL?.find(
            (p) => p.value === w.value && p.icon === w.icon,
          );
          return match || { ...w, label: w.rarity };
        });
        window.ChestRoulette.setKeys(results.newKeys);
        window.ChestRoulette.openWithResults(winners);
      } else {
        openBtn.disabled = false;
      }
    });
  }

  if (controller) {
    controller.bindInteractions(openChestOnServer, closeModal);
  }

  // ✅ Listener unique sur le bouton principal — ni dans chest-roulette.js, ni ailleurs
  if (!controller && openBtn) {
    openBtn.addEventListener("click", async () => {
      if (openBtn.disabled) return;
      openBtn.disabled = true;
      const result = await window.openChestOnServer();
      if (result.success && window.ChestRoulette) {
        window.ChestRoulette.setKeys(result.newKeys);
        window.ChestRoulette.openWithResult(result.winner);
      } else {
        openBtn.disabled = false;
      }
    });
  }
}

function attachGameCardEvents() {
  //console.log(' Attachement des événements...');

  // BLACKJACK
  document.querySelectorAll(".js-open-table-blackjack").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      await loadModal("blackjack-win-popup");
      await loadModal("blackjack");

      const modal = document.getElementById("blackjackModal");
      if (modal) modal.classList.add("is-open");
    });
  });

  // MASTERMIND
  document.querySelectorAll(".js-open-mastermind").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      //console.log(' Clic sur Mastermind détecté');

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      //console.log(' Chargement des modales Mastermind...');
      await loadModal("mastermind-win-popup");
      await loadModal("mastermind");

      // Fallback : s'assurer que l'init du jeu est bien appelée
      if (typeof window.initMastermind === "function") {
        try {
          window.initMastermind();
        } catch (err) {
          //console.error(' Erreur lors de initMastermind() depuis le bouton carte :', err);
        }
      } else {
        //console.error(' initMastermind() introuvable après chargement de la modale Mines');
      }

      const modal = document.getElementById("mastermindModal");
      if (modal) {
        // console.log(' Ouverture de la modale Mastermind');
        modal.classList.add("is-open");
      } else {
        //console.error(' Modal Mastermind introuvable');
      }
    });
  });

  // PUISSANCE 4
  document.querySelectorAll(".js-open-table-puissance4").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      await loadModal("puissance4");
      const modal = document.getElementById("puissance4Modal");
      if (modal) modal.classList.add("is-open");
    });
  });

  // CRASH
  document.querySelectorAll(".js-open-crash").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      await loadModal("crash");
      const modal = document.getElementById("crashModal");
      if (modal) modal.classList.add("is-open");
    });
  });

  // FLAPPY
  document.querySelectorAll(".js-open-flappy").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      await loadModal("flappy");
      // Ouverture normale : on sort d'un éventuel duel non joué
      if (typeof window.quitterModeDuel === "function") window.quitterModeDuel();
      const modal = document.getElementById("flappyModal");
      if (modal) modal.classList.add("is-open");
    });
  });

  // DÉMINEUR
  document.querySelectorAll(".js-open-demineur").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      await loadModal("demineur");
      const modal = document.getElementById("demineurModal");
      if (modal) modal.classList.add("is-open");
    });
  });

  // PLINKO
  document.querySelectorAll(".js-open-table-plinko").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      //console.log(" Clic plinko détecté");
      await loadModal("plinko");
      //console.log(" loadModal plinko terminé");

      const modal = document.getElementById("plinkoModal");
      //console.log(" modal trouvé ?", modal);

      if (modal) {
        modal.style.display = "flex";
        modal.classList.add("is-open");
        window.initPlinko();
      } else {
        //console.error(" plinkoModal introuvable dans le DOM");
      }
    });
  });

  // TAPE-TAUPES
  document.querySelectorAll(".js-open-table-tapetaupe").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      await loadModal("tapetaupe");
      // Ouverture normale : on sort d'un éventuel duel non joué
      if (typeof window.quitterModeDuel === "function") window.quitterModeDuel();
      const modal = document.getElementById("modal-tapetaupe");
      if (modal) modal.classList.add("is-open");
    });
  });

  // QUIZ
  document.querySelectorAll(".js-open-quiz").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      await loadModal("quiz");
      // Ouverture normale : on sort d'un éventuel duel non joué
      if (typeof window.quitterModeDuel === "function") window.quitterModeDuel();
      if (typeof window.reinitialiserQuiz === "function") window.reinitialiserQuiz();

      const modal = document.getElementById("quizModal");
      if (modal) {
        modal.classList.add("is-open");
        document.body.style.overflow = "hidden";
      }
    });
  });

  // ROULETTE
  document.querySelectorAll(".js-open-roulette").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      await loadModal("roulette-win-popup");
      await loadModal("roulette");

      if (typeof window.initRoulette === "function") {
        try {
          window.initRoulette();
        } catch (err) {}
      }

      const modal = document.getElementById("rouletteModal");
      if (modal) modal.classList.add("is-open");
    });
  });

  // HI LOW
  document.querySelectorAll(".js-open-hilow").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      await loadModal("blackjack-win-popup");
      await loadModal("hi-low");

      const modal = document.getElementById("hilowModal");
      if (modal) modal.classList.add("is-open");
    });
  });

  // ============================================================
  // SCRATCH
  // ============================================================

  // --- Listener ouverture modal ---
  document.querySelectorAll(".js-open-scratch").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const canPlay = await checkUserTimeRemaining();
      if (!canPlay) return;

      const user = JSON.parse(localStorage.getItem("user"));
      const points =
        user?.points ??
        parseInt(document.querySelector("[data-user-points]")?.textContent) ??
        9999;

      if (points >= 500) {
        showScratchLockedMessage(points);
        return;
      }

      await loadModal("blackjack-win-popup");
      await loadModal("scratch");

      const modal = document.getElementById("scratchModal");
      if (modal) modal.classList.add("is-open");
    });
  });

  function showScratchLockedMessage(points) {
    const msg = `🔒 Le Scratch est réservé aux joueurs avec moins de 500 pts. Vous en avez ${points}.`;
    if (typeof showToast === "function") {
      showToast(msg, "info");
    } else {
      alert(msg);
    }
  }

  // --- Card lock / unlock dynamique ---
  function initScratchCard() {
    checkScratchCardAccess();

    // Observer le bon élément : #userBalance
    const pointsEl = document.getElementById("userBalance");
    if (pointsEl) {
      const observer = new MutationObserver(() => {
        checkScratchCardAccess();
      });
      observer.observe(pointsEl, { childList: true, subtree: true, characterData: true });
    }
  }

  function checkScratchCardAccess() {
    // Lire depuis localStorage EN PRIORITÉ, c'est toujours à jour
    const user = JSON.parse(localStorage.getItem("user"));
    const points = user?.points ?? 9999;

    const wrapper = document.querySelector(".scratch-card__wrapper");
    const card = wrapper
      ? wrapper.querySelector(".js-open-scratch")
      : document.querySelector(".js-open-scratch");

    if (points >= 500) {
      if (card && !wrapper) lockScratchCard(card);
    } else {
      if (wrapper) unlockScratchCard(wrapper);
    }
  }

  function lockScratchCard(card) {
    card.classList.add("scratch-card--locked");
    card.style.filter = "blur(4px)";
    card.style.pointerEvents = "none";
    card.style.userSelect = "none";

    const wrapper = document.createElement("div");
    wrapper.className = "scratch-card__wrapper";
    wrapper.classList.add(...card.classList);
    wrapper.style.position = "relative";
    wrapper.style.cursor = "not-allowed";

    card.parentNode.insertBefore(wrapper, card);
    wrapper.appendChild(card);

    const overlay = document.createElement("div");
    overlay.className = "scratch-card__lock-overlay";
    overlay.innerHTML = `
    <div class="scratch-card__lock-inner">
      <span class="scratch-card__lock-icon">🏆</span>
      <p class="scratch-card__lock-title">Réservé aux perdants</p>
      <p class="scratch-card__lock-desc">Ce jeu n'est accessible qu'aux joueurs avec moins de 500 pts.</p>
    </div>
  `;
    wrapper.appendChild(overlay);
  }

  function unlockScratchCard(wrapper) {
    const card = wrapper.querySelector(".js-open-scratch");
    if (!card) return;

    wrapper.parentNode.insertBefore(card, wrapper);
    wrapper.remove();

    card.style.filter = "";
    card.style.pointerEvents = "";
    card.style.userSelect = "";
    card.classList.remove("scratch-card--locked");
  }

  // Appel initial
  initScratchCard();

  // HELP
  document.querySelectorAll(".js-open-help").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const gameName = btn.getAttribute("data-game");

      await loadModal("help");

      if (typeof window.ouvrirModaleAide === "function") {
        window.ouvrirModaleAide(gameName);
      }
    });
  });

  // BONUS
  document.querySelectorAll(".js-open-bonus").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      await loadModal("bonus");
      const modal = document.getElementById("bonusModal");
      if (modal) modal.classList.add("is-open");
    });
  });

  //console.log(' Événements attachés avec vérification du temps');
}

function startGameTimeMonitoring() {
  setInterval(async () => {
    const openModals = document.querySelectorAll(".modal-overlay.is-open");

    if (openModals.length > 0) {
      const hasTime = await checkUserTimeRemaining();

      if (!hasTime) {
        closeAllGameModals();
      }
    }
  }, 10000);
}

document.body.addEventListener(
  "click",
  async (e) => {
    const trigger = e.target.closest(".js-open-chest");
    if (!trigger) return;

    e.preventDefault();
    e.stopPropagation();

    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || !user.logged) return;

    try {
      if (typeof closeMobileMenu === "function") closeMobileMenu();
    } catch (err) {}

    await loadModal("chest");

    const overlay = document.getElementById("chestOverlay");
    if (overlay) {
      overlay.classList.add("is-open");
      document.body.style.overflow = "hidden";
      if (typeof initChest === "function") initChest();
    }
  },
  { capture: true },
);

document.addEventListener("DOMContentLoaded", () => {
  loadComponent("/static/templates/game-cards.html", "game-cards-container");
  loadComponent("/static/templates/leaderboard.html", "leaderboard-container");

  setTimeout(() => {
    loadModal("blackjack-win-popup");
    loadModal("mastermind-win-popup");
    loadModal("roulette-win-popup");
    loadModal("wheel");
  }, 1000);

  startGameTimeMonitoring();
});

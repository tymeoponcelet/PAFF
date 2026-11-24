// ========================================
// BLACKJACK CLIENT - VERSION OPTIMISÉE
// ========================================

const API_BASE = '/actions/blackjack';
let currentSessionId = null;
let currentUser = null;

// ----------------------------------------
// VARIABLES D'ÉTAT SPLIT
// ----------------------------------------
let isSplitMode = false;
let splitActiveHand = 1;
let splitHand1 = [];
let splitHand2 = [];
let splitScore1 = 0;
let splitScore2 = 0;

// ========================================
// DÉMARRER UNE PARTIE
// ========================================

async function startGame() {
  const betAmount = parseInt(document.getElementById('betAmount').value);
  const minBet = parseInt(document.getElementById('betAmount').min) || 50;

  // Validation de la mise
  if (betAmount < minBet) {
    showToast(`Mise minimum : ${minBet} points`, 'danger');
    return;
  }

  if (isNaN(betAmount) || betAmount <= 0) {
    showToast('Mise invalide', 'danger');
    return;
  }

  // Désactiver le bouton Deal pour éviter les doubles clics
  document.getElementById('dealBtn').disabled = true;

  try {
    const response = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ betAmount })
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message, 'danger');
      document.getElementById('dealBtn').disabled = false;
      return;
    }

    currentSessionId = data.sessionId;

    // Mettre à jour l'affichage
    renderHands(data.playerHand, data.dealerHand);
    updateScores(data.playerScore, data.dealerScore);
    updatePoints(data.newPoints);
    if (data.keyDropped) {
      if (typeof window.showKeyDropPopup === 'function') window.showKeyDropPopup();
      if (typeof window.updateUserKeys === 'function' && data.userKeys != null) {
        window.updateUserKeys(data.userKeys);
      }
    }

    // Gestion du résultat immédiat (Blackjack naturel)
    if (data.result) {
      setTimeout(() => {
        revealDealerCardsWithAnimation(data.dealerHand);

        // Calculer le délai pour afficher le résultat final
        const totalDelay = data.dealerHand.length > 2
          ? ((data.dealerHand.length - 2) * 800) + 1200
          : 1200;

        setTimeout(() => {
          updateScores(data.playerScore, data.dealerScore);
          let type = data.result === 'push' ? 'info' : 'success';
          showGameResult(data.message, type, {
            playerScore: data.playerScore,
            dealerScore: data.dealerScore,
            newPoints: data.newPoints
          });
          disableGameButtons();
          document.getElementById('resetBtn').disabled = false;
          updatePoints(data.newPoints);
        }, totalDelay);
      }, 1000);
      return;
    }

    // Activer les boutons pour partie normale
    document.getElementById('hitBtn').disabled = false;
    document.getElementById('standBtn').disabled = false;
    checkAndShowSpecialButtons(data.playerHand, data.playerScore);

  } catch (error) {
    //console.error('Erreur startGame:', error);
    showToast('Erreur de connexion au serveur', 'danger');
    document.getElementById('dealBtn').disabled = false;
  }
}

// ========================================
// TIRER UNE CARTE
// ========================================

async function playerHit() {
  if (!currentSessionId) {
    showToast('Aucune partie en cours', 'danger');
    return;
  }

  // Désactiver temporairement les boutons
  const hitBtn = document.getElementById('hitBtn');
  const standBtn = document.getElementById('standBtn');
  hitBtn.disabled = true;
  standBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: currentSessionId })
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message, 'danger');
      hitBtn.disabled = false;
      standBtn.disabled = false;
      return;
    }

    // Ajouter la nouvelle carte avec animation
    addCardToPlayer(data.newCard);

    // Attendre l'animation avant de mettre à jour le score
    setTimeout(() => {
      updateScores(data.playerScore, null);
    }, 300);

    // Gestion du bust (dépassement de 21)
    if (data.busted) {
      setTimeout(() => {
        revealDealerCardsWithAnimation(data.dealerHand);

        const totalDelay = data.dealerHand.length > 2
          ? ((data.dealerHand.length - 2) * 800) + 1200
          : 1200;

        setTimeout(() => {
          updateScores(data.playerScore, data.dealerScore);
          showGameResult(data.message, 'danger', {
            playerScore: data.playerScore,
            dealerScore: data.dealerScore,
            newPoints: data.newPoints
          });
          document.getElementById('resetBtn').disabled = false;
          updatePoints(data.newPoints);
        }, totalDelay);
      }, 500);
    } else {
      // Réactiver les boutons si la partie continue
      hitBtn.disabled = false;
      standBtn.disabled = false;
      checkAndShowSpecialButtons(data.playerHand, data.playerScore);
    }

  } catch (error) {
    //console.error('Erreur playerHit:', error);
    showToast('Erreur de connexion', 'danger');
    hitBtn.disabled = false;
    standBtn.disabled = false;
  }
}

// ========================================
// RESTER
// ========================================

async function playerStand() {
  if (!currentSessionId) {
    showToast('Aucune partie en cours', 'danger');
    return;
  }

  // Désactiver immédiatement les boutons
  disableGameButtons();

  try {
    const response = await fetch(`${API_BASE}/stand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: currentSessionId })
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message, 'danger');
      return;
    }

    // Révéler les cartes du croupier avec animation
    revealDealerCardsWithAnimation(data.dealerHand);

    // Calculer le délai total pour afficher le résultat
    const totalDelay = data.dealerHand.length > 2
      ? ((data.dealerHand.length - 2) * 800) + 1200
      : 1200;

    setTimeout(() => {
      updateScores(data.playerScore, data.dealerScore);
      updatePoints(data.newPoints);

      let type;
      switch (data.result) {
        case 'win': type = 'success'; break;
        case 'lose': type = 'danger'; break;
        case 'push': type = 'info'; break;
      }

      showGameResult(data.message, type, {
        playerScore: data.playerScore,
        dealerScore: data.dealerScore,
        newPoints: data.newPoints
      });
      currentSessionId = null;
      document.getElementById('resetBtn').disabled = false;
    }, totalDelay);

  } catch (error) {
    //console.error('Erreur lors du stand:', error);
    showToast('Une erreur est survenue', 'danger');
    document.getElementById('resetBtn').disabled = false;
  }
}

// ========================================
// FONCTIONS D'AFFICHAGE DES CARTES
// ========================================

/**
 * Affiche les mains initiales du joueur et du croupier
 */
function renderHands(playerHand, dealerHand) {
  const playerCardsEl = document.getElementById('playerCards');
  const dealerCardsEl = document.getElementById('dealerCards');

  playerCardsEl.innerHTML = '';
  dealerCardsEl.innerHTML = '';

  // Animation des cartes du joueur
  playerHand.forEach((card, index) => {
    setTimeout(() => {
      playerCardsEl.appendChild(renderCard(card));
    }, index * 200);
  });

  // Animation des cartes du croupier
  dealerHand.forEach((card, index) => {
    setTimeout(() => {
      dealerCardsEl.appendChild(renderCard(card));
    }, (playerHand.length * 200) + (index * 200));
  });
}

/**
 * Ajoute une carte à la main du joueur
 */
function addCardToPlayer(card) {
  const playerCardsEl = document.getElementById('playerCards');
  const cardEl = renderCard(card);
  playerCardsEl.appendChild(cardEl);
}

/**
 * Révèle les cartes du croupier avec animation dynamique du score
 */
function revealDealerCardsWithAnimation(dealerHand) {
  const dealerCardsEl = document.getElementById('dealerCards');
  const dealerScoreEl = document.getElementById('dealerScore');

  // ÉTAPE 1 : Retourner la carte cachée
  const hiddenCard = dealerCardsEl.querySelector('[data-is-hidden="true"]');

  if (hiddenCard && dealerHand.length >= 2) {
    const realCard = dealerHand[1]; // Deuxième carte (celle qui était cachée)

    if (!realCard || !realCard.suit || !realCard.value) {
      return;
    }

    const isRed = ['♥', '♦'].includes(realCard.suit);
    const colorClass = isRed ? 'card--red' : 'card--black';
    const frontFace = hiddenCard.querySelector('.card__face--front');

    // Remplir la face avant
    frontFace.className = `card__face card__face--front ${colorClass}`;
    frontFace.innerHTML = `
      <div class="card__corner card__corner--top">
        <div class="card__value">${realCard.value}</div>
        <div class="card__suit">${realCard.suit}</div>
      </div>
      <div class="card__center">
        <div class="card__suit-large">${realCard.suit}</div>
      </div>
      <div class="card__corner card__corner--bottom">
        <div class="card__value">${realCard.value}</div>
        <div class="card__suit">${realCard.suit}</div>
      </div>
    `;

    hiddenCard.dataset.value = realCard.value;
    hiddenCard.dataset.suit = realCard.suit;
    delete hiddenCard.dataset.isHidden;

    // Flip la carte
    setTimeout(() => {
      const cardInner = hiddenCard.querySelector('.card__inner');
      if (cardInner) {
        cardInner.classList.add('is-flipped');
      }

      // Calculer le score avec les 2 premières cartes
      setTimeout(() => {
        const score = calculateClientScore([dealerHand[0], dealerHand[1]]);
        dealerScoreEl.textContent = `Score: ${score}`;
        dealerScoreEl.classList.add('score-update');
        setTimeout(() => dealerScoreEl.classList.remove('score-update'), 300);
      }, 300);
    }, 300);
  }

  // ÉTAPE 2 : Ajouter les cartes supplémentaires avec délai et recalcul du score
  if (dealerHand.length > 2) {
    let currentCards = [dealerHand[0], dealerHand[1]];

    for (let i = 2; i < dealerHand.length; i++) {
      setTimeout(() => {
        const newCard = renderCard(dealerHand[i]);
        dealerCardsEl.appendChild(newCard);

        // Recalculer le score après l'apparition de la carte
        currentCards.push(dealerHand[i]);
        setTimeout(() => {
          const newScore = calculateClientScore(currentCards);
          dealerScoreEl.textContent = `Score: ${newScore}`;
          dealerScoreEl.classList.add('score-update');
          setTimeout(() => dealerScoreEl.classList.remove('score-update'), 300);
        }, 300);
      }, (i - 1) * 800); // 800ms entre chaque carte
    }
  }
}

/**
 * Calcul du score côté client (identique au serveur)
 */
function calculateClientScore(hand) {
  let score = 0;
  let aces = 0;

  for (let card of hand) {
    const value = card.value;

    if (value === 'A') {
      aces++;
      score += 11;
    } else if (['J', 'Q', 'K'].includes(value)) {
      score += 10;
    } else {
      score += parseInt(value);
    }
  }

  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }

  return score;
}

/**
 * Génère le HTML d'une carte
 */
function renderCard(card) {
  const cardEl = document.createElement('div');
  cardEl.className = 'card card--dealing';

  // CAS 1 : Carte marquée cachée par le serveur {hidden: true}
  if (card.hidden === true) {
    cardEl.dataset.isHidden = 'true';

    cardEl.innerHTML = `
      <div class="card__inner">
        <div class="card__face card__face--back">
          <div class="card__pattern"></div>
        </div>
        <div class="card__face card__face--front">
          <!-- Face vide, sera remplie au flip -->
        </div>
      </div>
    `;

    cardEl.addEventListener('animationend', () => {
      cardEl.classList.remove('card--dealing');
      cardEl.style.transform = 'none';
      cardEl.style.opacity = '1';
    }, { once: true });

    return cardEl;
  }

  // CAS 2 : Carte invalide
  if (!card.value || !card.suit) {
    //console.error('❌ Carte invalide:', card);
    return document.createElement('div');
  }

  // CAS 3 : Carte normale
  cardEl.dataset.value = card.value;
  cardEl.dataset.suit = card.suit;

  const isRed = ['♥', '♦'].includes(card.suit);
  const colorClass = isRed ? 'card--red' : 'card--black';

  cardEl.innerHTML = `
    <div class="card__inner is-flipped">
      <div class="card__face card__face--back">
        <div class="card__pattern"></div>
      </div>
      <div class="card__face card__face--front ${colorClass}">
        <div class="card__corner card__corner--top">
          <div class="card__value">${card.value}</div>
          <div class="card__suit">${card.suit}</div>
        </div>
        <div class="card__center">
          <div class="card__suit-large">${card.suit}</div>
        </div>
        <div class="card__corner card__corner--bottom">
          <div class="card__value">${card.value}</div>
          <div class="card__suit">${card.suit}</div>
        </div>
      </div>
    </div>
  `;

  cardEl.addEventListener('animationend', () => {
    cardEl.classList.remove('card--dealing');
    cardEl.style.transform = 'none';
    cardEl.style.opacity = '1';
  }, { once: true });

  return cardEl;
}

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

function updateScores(playerScore, dealerScore) {
  if (playerScore !== null && playerScore !== undefined) {
    document.getElementById('playerScore').textContent = `Score: ${playerScore}`;
  }
  if (dealerScore !== null && dealerScore !== undefined) {
    document.getElementById('dealerScore').textContent = `Score: ${dealerScore}`;
  }
}

function updatePoints(newPoints) {
  if (newPoints === undefined || newPoints === null) return;

  const pointsDisplay = document.querySelector('[data-user-points]');
  if (pointsDisplay) {
    pointsDisplay.textContent = `${newPoints} pts`;
  }

  if (typeof window.updateUserBalance === 'function') {
    window.updateUserBalance(newPoints);
  }

  if (currentUser) {
    currentUser.points = newPoints;
  }

  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    user.points = newPoints;
    localStorage.setItem('user', JSON.stringify(user));
  }
}

function showGameResult(message, type, gameData = {}) {
  //console.log('🎯 showGameResult appelé:', { message, type, gameData });

  // Vérifier que la popup existe
  const popup = document.getElementById('winPopupOverlay');

  if (!popup) {
    //console.error('❌ Popup de résultat introuvable !');
    //console.log('Tentative de chargement de la popup...');

    // Utiliser un toast en attendant
    showToast(message, type);

    // Tenter de charger la popup
    if (typeof loadModal === 'function') {
      loadModal('blackjack-win-popup').then(() => {
        //console.log('✅ Popup chargée, nouvelle tentative...');
        setTimeout(() => showGameResult(message, type, gameData), 500);
      });
    }
    return;
  }

  //console.log('✅ Popup trouvée, affichage du résultat');

  // Déterminer le type de résultat
  let result = 'win';
  if (type === 'danger') result = 'lose';
  else if (type === 'info') result = 'push';
  else if (message.includes('BLACKJACK')) result = 'blackjack';

  // Calculer le gain
  const bet = gameData.betAmount || parseInt(document.getElementById('betAmount').value);
  let gain = 0;

  if (gameData.profit !== undefined) {
    gain = gameData.profit;
  } else {
    if (result === 'win') gain = bet;
    else if (result === 'blackjack') gain = Math.floor(bet * 1.5);
    else if (result === 'lose') gain = -bet;
    else if (result === 'push') gain = 0;
  }

  //console.log('💰 Résultat calculé:', { result, gain, bet });

  // Vérifier que la fonction existe
  if (typeof showBlackjackWinPopup !== 'function') {
    //console.error('❌ Fonction showBlackjackWinPopup introuvable !');
    showToast(message, type);
    return;
  }

  // Afficher la popup
  showBlackjackWinPopup({
    result: result,
    gain: gain,
    bet: bet,
    playerScore: gameData.playerScore || 0,
    dealerScore: gameData.dealerScore || 0,
    newBalance: gameData.newPoints || 5000,
    message: message
  });
}

function disableGameButtons() {
  document.getElementById('hitBtn').disabled = true;
  document.getElementById('standBtn').disabled = true;
}

function resetGame() {
  currentSessionId = null;
  isSplitMode = false; splitActiveHand = 1;
  hideSpecialButtons();

  document.getElementById('playerCards').innerHTML = '';
  document.getElementById('dealerCards').innerHTML = '';
  document.getElementById('playerScore').textContent = 'Score: —';
  document.getElementById('dealerScore').textContent = 'Score: —';

  const gameResult = document.getElementById('gameResult');
  if (gameResult) {
    gameResult.style.display = 'none';
  }

  document.getElementById('dealBtn').disabled = false;
  document.getElementById('hitBtn').disabled = true;
  document.getElementById('standBtn').disabled = true;
  document.getElementById('resetBtn').disabled = true;
}

function showToast(message, type = 'info') {
  const icon = type === 'danger' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  alert(`${icon} ${message}`);
}

function initBlackjack() {
  //console.log('🎰 Initialisation Blackjack...');

  const modal = document.getElementById('blackjackModal');
  if (!modal) {
    //console.warn('⚠️ Modale Blackjack introuvable');
    return;
  }

  // Attacher les boutons de jeu
  const dealBtn = document.getElementById('dealBtn');
  const hitBtn = document.getElementById('hitBtn');
  const standBtn = document.getElementById('standBtn');
  const resetBtn = document.getElementById('resetBtn');

  if (dealBtn) {
    dealBtn.replaceWith(dealBtn.cloneNode(true)); // Supprimer les anciens événements
    document.getElementById('dealBtn').addEventListener('click', startGame);
  }

  if (hitBtn) {
    hitBtn.replaceWith(hitBtn.cloneNode(true));
    document.getElementById('hitBtn').addEventListener('click', playerHit);
  }

  if (standBtn) {
    standBtn.replaceWith(standBtn.cloneNode(true));
    document.getElementById('standBtn').addEventListener('click', playerStand);
  }

  if (resetBtn) {
    resetBtn.replaceWith(resetBtn.cloneNode(true));
    document.getElementById('resetBtn').addEventListener('click', resetGame);
  }

  // Attacher les boutons de fermeture
  const closeButtons = modal.querySelectorAll('.js-close-modal');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('is-open');
      setTimeout(resetGame, 400);
    });
  });

  //console.log('✅ Blackjack initialisé');
}

function checkAndShowSpecialButtons(playerHand, playerScore) {
  const isFirstTwoCards = playerHand.length === 2;
  if (!isFirstTwoCards) {
    hideSpecialButtons();
    return;
  }

  // Double Down : toujours disponible sur 2 cartes
  showDoubleButton(true);

  // Split : disponible si les 2 cartes ont la même valeur
  const canSplit = playerHand[0].value === playerHand[1].value;
  showSplitButton(canSplit);
}

function showDoubleButton(show) {
  let btn = document.getElementById('doubleBtn');
  if (!btn) {
    btn = createSpecialButton('doubleBtn', '✌️ Double', playerDouble);
  }
  btn.style.display = show ? 'inline-flex' : 'none';
}

function showSplitButton(show) {
  let btn = document.getElementById('splitBtn');
  if (!btn) {
    btn = createSpecialButton('splitBtn', '✂️ Split', playerSplit);
  }
  btn.style.display = show ? 'inline-flex' : 'none';
}

function hideSpecialButtons() {
  const doubleBtn = document.getElementById('doubleBtn');
  const splitBtn = document.getElementById('splitBtn');
  if (doubleBtn) doubleBtn.style.display = 'none';
  if (splitBtn) splitBtn.style.display = 'none';
}

function createSpecialButton(id, label, handler) {
  const controls = document.getElementById('gameControls');
  const btn = document.createElement('button');
  btn.id = id;
  btn.className = 'blackjack__btn blackjack__btn--special';
  btn.textContent = label;
  btn.addEventListener('click', handler);
  // Insérer avant le bouton "Nouvelle partie"
  const resetBtn = document.getElementById('resetBtn');
  controls.insertBefore(btn, resetBtn);
  return btn;
}

// ----------------------------------------
// DOUBLE DOWN
// ----------------------------------------

async function playerDouble() {
  if (!currentSessionId) return;

  disableGameButtons();
  hideSpecialButtons();

  try {
    const response = await fetch(`${API_BASE}/double`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: currentSessionId })
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message, 'danger');
      // Réactiver les boutons
      document.getElementById('hitBtn').disabled = false;
      document.getElementById('standBtn').disabled = false;
      checkAndShowSpecialButtons(
        Array.from(document.getElementById('playerCards').children).map(el => ({
          value: el.dataset.value, suit: el.dataset.suit
        })), 0);
      return;
    }

    // Afficher la nouvelle carte du joueur
    addCardToPlayer(data.newCard);

    setTimeout(() => {
      updateScores(data.playerScore, null);

      // Révéler les cartes du croupier
      setTimeout(() => {
        revealDealerCardsWithAnimation(data.dealerHand);

        const totalDelay = data.dealerHand.length > 2
          ? ((data.dealerHand.length - 2) * 800) + 1200
          : 1200;

        setTimeout(() => {
          updateScores(data.playerScore, data.dealerScore);
          updatePoints(data.newPoints);

          let type;
          switch (data.result) {
            case 'win': type = 'success'; break;
            case 'bust':
            case 'lose': type = 'danger'; break;
            case 'push': type = 'info'; break;
          }

          showGameResult(data.message, type, {
            playerScore: data.playerScore,
            dealerScore: data.dealerScore,
            newPoints: data.newPoints,
            betAmount: data.betAmount,
            profit: data.profit
          });
          currentSessionId = null;
          document.getElementById('resetBtn').disabled = false;
        }, totalDelay);
      }, 400);
    }, 300);

  } catch (error) {
    showToast('Erreur de connexion', 'danger');
  }
}

// ----------------------------------------
// SPLIT
// ----------------------------------------

async function playerSplit() {
  if (!currentSessionId) return;

  disableGameButtons();
  hideSpecialButtons();

  try {
    const response = await fetch(`${API_BASE}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: currentSessionId })
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message, 'danger');
      document.getElementById('hitBtn').disabled = false;
      document.getElementById('standBtn').disabled = false;
      return;
    }

    updatePoints(data.newPoints);

    // CAS SPÉCIAL : Split d'As, résolution immédiate
    if (data.aceSplit) {
      renderSplitFinalView(data);
      return;
    }

    // Split normal : afficher les 2 mains
    isSplitMode = true;
    splitActiveHand = 1;
    splitHand1 = data.hand1;
    splitHand2 = data.hand2;
    splitScore1 = data.score1;
    splitScore2 = data.score2;

    renderSplitHands(data.hand1, data.hand2, data.score1, data.score2, 1);

    // Réactiver Hit/Stand pour la main 1
    document.getElementById('hitBtn').disabled = false;
    document.getElementById('standBtn').disabled = false;

    // Remplacer les handlers pour le mode split
    activateSplitMode();

  } catch (error) {
    showToast('Erreur de connexion', 'danger');
  }
}

/**
 * Remplace les boutons Hit/Stand par leurs versions split
 */
function activateSplitMode() {
  const hitBtn = document.getElementById('hitBtn');
  const standBtn = document.getElementById('standBtn');

  const newHit = hitBtn.cloneNode(true);
  hitBtn.replaceWith(newHit);
  document.getElementById('hitBtn').addEventListener('click', playerSplitHit);

  const newStand = standBtn.cloneNode(true);
  standBtn.replaceWith(newStand);
  document.getElementById('standBtn').addEventListener('click', playerSplitStand);
}

/**
 * Restaure les boutons Hit/Stand en mode normal
 */
function deactivateSplitMode() {
  isSplitMode = false;
  const hitBtn = document.getElementById('hitBtn');
  const standBtn = document.getElementById('standBtn');

  const newHit = hitBtn.cloneNode(true);
  hitBtn.replaceWith(newHit);
  document.getElementById('hitBtn').addEventListener('click', playerHit);

  const newStand = standBtn.cloneNode(true);
  standBtn.replaceWith(newStand);
  document.getElementById('standBtn').addEventListener('click', playerStand);
}

async function playerSplitHit() {
  if (!currentSessionId) return;

  document.getElementById('hitBtn').disabled = true;
  document.getElementById('standBtn').disabled = true;

  try {
    const response = await fetch(`${API_BASE}/split-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: currentSessionId })
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message, 'danger');
      document.getElementById('hitBtn').disabled = false;
      document.getElementById('standBtn').disabled = false;
      return;
    }

    if (data.finalResolution) {
      // Les 2 mains sont terminées
      renderSplitFinalView(data);
      return;
    }

    if (data.switchToHand2) {
      // Main 1 bustée, on passe à la main 2
      splitHand1 = data.hand1;
      splitScore1 = data.score1;
      splitActiveHand = 2;
      splitHand2 = data.hand2;
      splitScore2 = data.score2;

      renderSplitHands(data.hand1, data.hand2, data.score1, data.score2, 2);
      document.getElementById('hitBtn').disabled = false;
      document.getElementById('standBtn').disabled = false;
      return;
    }

    // Carte tirée normalement
    if (splitActiveHand === 1) {
      splitHand1 = data.playerHand;
      splitScore1 = data.playerScore;
    } else {
      splitHand2 = data.playerHand;
      splitScore2 = data.playerScore;
    }
    renderSplitHands(splitHand1, splitHand2, splitScore1, splitScore2, splitActiveHand);
    document.getElementById('hitBtn').disabled = false;
    document.getElementById('standBtn').disabled = false;

  } catch (error) {
    showToast('Erreur de connexion', 'danger');
    document.getElementById('hitBtn').disabled = false;
    document.getElementById('standBtn').disabled = false;
  }
}

async function playerSplitStand() {
  if (!currentSessionId) return;

  document.getElementById('hitBtn').disabled = true;
  document.getElementById('standBtn').disabled = true;

  try {
    const response = await fetch(`${API_BASE}/split-stand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: currentSessionId })
    });

    const data = await response.json();

    if (!data.success) {
      showToast(data.message, 'danger');
      document.getElementById('hitBtn').disabled = false;
      document.getElementById('standBtn').disabled = false;
      return;
    }

    if (data.finalResolution) {
      renderSplitFinalView(data);
      return;
    }

    if (data.switchToHand2) {
      splitHand1 = data.hand1;
      splitScore1 = data.score1;
      splitActiveHand = 2;
      splitHand2 = data.hand2;
      splitScore2 = data.score2;

      renderSplitHands(data.hand1, data.hand2, data.score1, data.score2, 2);
      document.getElementById('hitBtn').disabled = false;
      document.getElementById('standBtn').disabled = false;
    }

  } catch (error) {
    showToast('Erreur de connexion', 'danger');
    document.getElementById('hitBtn').disabled = false;
    document.getElementById('standBtn').disabled = false;
  }
}

// ----------------------------------------
// RENDU DES MAINS EN MODE SPLIT
// ----------------------------------------

/**
 * Affiche les 2 mains côte à côte avec indicateur de main active
 */
function renderSplitHands(hand1, hand2, score1, score2, activeHand) {
  const playerCardsEl = document.getElementById('playerCards');
  const playerScoreEl = document.getElementById('playerScore');

  playerCardsEl.innerHTML = '';

  // Conteneur main 1
  const hand1Container = document.createElement('div');
  hand1Container.className = `split-hand ${activeHand === 1 ? 'split-hand--active' : 'split-hand--inactive'}`;
  hand1Container.id = 'splitHand1Container';

  const hand1Label = document.createElement('div');
  hand1Label.className = 'split-hand__label';
  hand1Label.textContent = activeHand === 1 ? '▶ Main 1' : 'Main 1';
  hand1Container.appendChild(hand1Label);

  const hand1Cards = document.createElement('div');
  hand1Cards.className = 'split-hand__cards';
  hand1.forEach(card => hand1Cards.appendChild(renderCard(card)));
  hand1Container.appendChild(hand1Cards);

  const hand1Score = document.createElement('div');
  hand1Score.className = 'split-hand__score';
  hand1Score.textContent = `Score: ${score1}`;
  hand1Container.appendChild(hand1Score);

  // Séparateur
  const separator = document.createElement('div');
  separator.className = 'split-separator';
  separator.textContent = '|';

  // Conteneur main 2
  const hand2Container = document.createElement('div');
  hand2Container.className = `split-hand ${activeHand === 2 ? 'split-hand--active' : 'split-hand--inactive'}`;
  hand2Container.id = 'splitHand2Container';

  const hand2Label = document.createElement('div');
  hand2Label.className = 'split-hand__label';
  hand2Label.textContent = activeHand === 2 ? '▶ Main 2' : 'Main 2';
  hand2Container.appendChild(hand2Label);

  const hand2Cards = document.createElement('div');
  hand2Cards.className = 'split-hand__cards';
  hand2.forEach(card => hand2Cards.appendChild(renderCard(card)));
  hand2Container.appendChild(hand2Cards);

  const hand2Score = document.createElement('div');
  hand2Score.className = 'split-hand__score';
  hand2Score.textContent = `Score: ${score2}`;
  hand2Container.appendChild(hand2Score);

  playerCardsEl.appendChild(hand1Container);
  playerCardsEl.appendChild(separator);
  playerCardsEl.appendChild(hand2Container);

  playerScoreEl.textContent = `Main ${activeHand} active`;
}

/**
 * Affiche le résultat final du split avec les 2 mains résolues
 */
function renderSplitFinalView(data) {
  const resultLabels = {
    win: { icon: '🎉', text: 'Victoire', class: 'split-result--win' },
    lose: { icon: '😢', text: 'Défaite', class: 'split-result--lose' },
    bust: { icon: '💥', text: 'Bust', class: 'split-result--lose' },
    push: { icon: '🤝', text: 'Égalité', class: 'split-result--push' }
  };

  const r1 = resultLabels[data.result1] || resultLabels.lose;
  const r2 = resultLabels[data.result2] || resultLabels.lose;

  const playerCardsEl = document.getElementById('playerCards');
  playerCardsEl.innerHTML = '';

  [
    { hand: data.hand1, score: data.score1, result: r1, label: 'Main 1' },
    { hand: data.hand2, score: data.score2, result: r2, label: 'Main 2' }
  ].forEach(({ hand, score, result, label }, i) => {
    const container = document.createElement('div');
    container.className = 'split-hand split-hand--resolved';

    const lbl = document.createElement('div');
    lbl.className = 'split-hand__label';
    lbl.textContent = label;
    container.appendChild(lbl);

    const cards = document.createElement('div');
    cards.className = 'split-hand__cards';
    hand.forEach(card => cards.appendChild(renderCard(card)));
    container.appendChild(cards);

    const scorEl = document.createElement('div');
    scorEl.className = 'split-hand__score';
    scorEl.textContent = `Score: ${score}`;
    container.appendChild(scorEl);

    const res = document.createElement('div');
    res.className = `split-hand__result ${result.class}`;
    res.textContent = `${result.icon} ${result.text}`;
    container.appendChild(res);

    playerCardsEl.appendChild(container);

    if (i === 0) {
      const sep = document.createElement('div');
      sep.className = 'split-separator';
      sep.textContent = '|';
      playerCardsEl.appendChild(sep);
    }
  });

  document.getElementById('playerScore').textContent = `Main 1: ${data.score1} | Main 2: ${data.score2}`;

  // Révéler les cartes du croupier
  if (data.dealerHand) {
    revealDealerCardsWithAnimation(data.dealerHand);

    const totalDelay = data.dealerHand.length > 2
      ? ((data.dealerHand.length - 2) * 800) + 1200
      : 1200;

    setTimeout(() => {
      updateScores(null, data.dealerScore);
      updatePoints(data.newPoints);

      // Message combiné
      const msgs = [];
      if (data.result1) msgs.push(`Main 1 : ${resultLabels[data.result1]?.text || data.result1}`);
      if (data.result2) msgs.push(`Main 2 : ${resultLabels[data.result2]?.text || data.result2}`);

      const bothWin = data.result1 === 'win' && data.result2 === 'win';
      const bothLose = (data.result1 === 'lose' || data.result1 === 'bust') && (data.result2 === 'lose' || data.result2 === 'bust');
      const type = bothWin ? 'success' : bothLose ? 'danger' : 'info';

      const message = `✂️ Split — ${msgs.join(' / ')}`;
      showGameResult(message, type, {
        playerScore: data.score1,
        dealerScore: data.dealerScore,
        newPoints: data.newPoints,
        profit: data.profit,
        betAmount: data.betAmount 
      });

      deactivateSplitMode();
      currentSessionId = null;
      document.getElementById('resetBtn').disabled = false;
    }, totalDelay);
  } else {
    // Split d'As : pas d'animation supplémentaire
    updatePoints(data.newPoints);
    const bothWin = data.result1 === 'win' && data.result2 === 'win';
    const bothLose = (data.result1 === 'lose' || data.result1 === 'bust') && (data.result2 === 'lose' || data.result2 === 'bust');
    const type = bothWin ? 'success' : bothLose ? 'danger' : 'info';
    const message = `✂️ Split As — Main 1: ${data.score1} (${data.result1}) / Main 2: ${data.score2} (${data.result2})`;
    showGameResult(message, type, {
      playerScore: data.score1,
      dealerScore: data.dealerScore,
      newPoints: data.newPoints,
      profit: data.profit, 
      betAmount: data.betAmount  
    });
    currentSessionId = null;
    document.getElementById('resetBtn').disabled = false;
  }
}

// Initialiser si la modale existe déjà au chargement
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('blackjackModal')) {
    initBlackjack();
  }
});

// Écouter l'événement de chargement dynamique
document.addEventListener('blackjackModalLoaded', initBlackjack);
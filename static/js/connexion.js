/**
 * Vérification de la session utilisateur CÔTÉ SERVEUR
 */
async function checkSession() {
    const loginBtn = document.getElementById('login-btn');
    const authButtonLogin = document.getElementById('authButtonLogin');     
    const authButtonConnected = document.getElementById('authButtonConnected'); 
    const userBalance = document.getElementById('userBalance');
    const userBalanceContainer = document.getElementById('userBalanceContainer');
    const userPseudo = document.getElementById('user-pseudo');

    try {
        const response = await fetch('/api/session', { 
            credentials: 'include' 
        });
        const data = await response.json();

        if (data.logged && data.user) {
            const user = {
                logged: true,
                id: data.user.id,
                pseudo: data.user.username || data.user.pseudo,
                username: data.user.username || data.user.pseudo,
                points: data.user.points,
                classe: data.user.classe,
                cles: data.user.cles != null ? data.user.cles : 0
            };

            localStorage.setItem('user', JSON.stringify(user));

           
            if (authButtonLogin) {
                authButtonLogin.style.display = 'none';
            }

            
            if (userPseudo) {
                userPseudo.textContent = `👤 ${user.pseudo}`;
                userPseudo.style.display = 'inline-block';
            }

            
            if (userBalanceContainer) {
                userBalanceContainer.style.display = 'block';
            }

            if (userBalance) {
                userBalance.textContent = `💎 ${user.points.toLocaleString('fr-FR')} pts`;
            }

            const userKeysEl = document.getElementById('userKeys');
            if (userKeysEl && user.cles != null) {
                userKeysEl.textContent = `🔑 ${user.cles}`;
                userKeysEl.style.display = 'inline';
            }

            const navCoffreLi = document.getElementById('navCoffreLi');
            if (navCoffreLi) navCoffreLi.style.display = '';

            // Lien vers l'administration (le serveur vérifie de toute façon le rôle)
            const navAdminLi = document.getElementById('navAdminLi');
            if (navAdminLi) navAdminLi.style.display = data.user.admin ? '' : 'none';

            try {
                if (typeof startSessionTracking === 'function') {
                    await startSessionTracking();
                }
            } catch (error) {}

            
            if (authButtonConnected) {
                authButtonConnected.classList.add('logout-mode');
                authButtonConnected.setAttribute('aria-label', 'Se déconnecter');
                authButtonConnected.onclick = async (e) => {
                    e.preventDefault();
                    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
                        try {
                            if (typeof endSessionManually === 'function') {
                                await endSessionManually();
                            }
                        } catch (error) {}
                        localStorage.removeItem('user');
                        window.location.href = '/logout';
                    }
                };
            }

            return true;

        } else {
            localStorage.removeItem('user');

            if (typeof sessionTimerInterval !== 'undefined' && sessionTimerInterval) {
                clearInterval(sessionTimerInterval);
            }

            
            if (authButtonLogin) {
                authButtonLogin.style.display = 'flex';
            }

            if (userPseudo) {
                userPseudo.style.display = 'none';
            }

            if (userBalanceContainer) {
                userBalanceContainer.style.display = 'none';
            }

            const navCoffreLiOut = document.getElementById('navCoffreLi');
            if (navCoffreLiOut) navCoffreLiOut.style.display = 'none';
            const navAdminLiOut = document.getElementById('navAdminLi');
            if (navAdminLiOut) navAdminLiOut.style.display = 'none';

            if (data.suspendu && typeof showToast === 'function') {
                showToast('Ce compte a été suspendu par un administrateur.', 'danger');
            }

            if (authButtonConnected) {
                authButtonConnected.classList.remove('logout-mode');
                authButtonConnected.setAttribute('aria-label', 'Se connecter');
                authButtonConnected.onclick = null;
            }

            return false;
        }

    } catch (error) {
        localStorage.removeItem('user');
        return false;
    }
}


/**
 * Mettre à jour la balance en temps réel
 */
function updateUserBalance(newBalance) {
    const userBalance = document.getElementById('userBalance');
    const user = JSON.parse(localStorage.getItem('user'));

    if (user && user.logged && userBalance) {
        // Mettre à jour le localStorage
        user.points = newBalance;
        localStorage.setItem('user', JSON.stringify(user));

        // Animation de pulsation
        userBalance.style.animation = 'pulse 0.5s ease';
        userBalance.textContent = `💎 ${newBalance.toLocaleString('fr-FR')} pts`;

        setTimeout(() => {
            userBalance.style.animation = '';
        }, 500);
    }
}

/**
 * Mettre à jour l'affichage du nombre de clés
 */
function updateUserKeys(newKeys) {
    const userKeysEl = document.getElementById('userKeys');
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.logged && userKeysEl != null) {
        const count = newKeys != null ? newKeys : (user.cles || 0);
        user.cles = count;
        localStorage.setItem('user', JSON.stringify(user));
        userKeysEl.textContent = `🔑 ${count}`;
        userKeysEl.style.display = 'inline';
    }
}

// Rendre les fonctions accessibles globalement
window.updateUserBalance = updateUserBalance;
window.updateUserKeys = updateUserKeys;

// Quand l'utilisateur EST connecté
function onUserConnected(user) {
  // Affiche la navbar connectée
  document.getElementById("userBalanceContainer").style.display = "block";
  
  // Cache le bouton "Se connecter"
  document.getElementById("authButton") // ⚠️ Tu as deux éléments avec le même id !
  document.querySelector(".navbar__login2").style.display = "none";
  
  // Affiche le pseudo
  const pseudo = document.getElementById("user-pseudo");
  pseudo.textContent = user.pseudo;
  pseudo.style.display = "block";
}

// Quand l'utilisateur N'EST PAS connecté
function onUserDisconnected() {
  document.getElementById("userBalanceContainer").style.display = "none";
  document.querySelector(".navbar__login2").style.display = "flex"; // ou "block"
}


// ========================================
// GESTION DU FORMULAIRE DE CONNEXION
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    // ✅ VÉRIFIER QUE LE FORMULAIRE EXISTE (on est sur login.html)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('email');
            const codeInput = document.getElementById('code');
            
            // ✅ VÉRIFIER QUE LES CHAMPS EXISTENT
            if (!emailInput || !codeInput) {
               //console.warn('⚠️ Champs de formulaire introuvables (pas sur la page de login)');
                return;
            }

            const email = emailInput.value;
            const code = codeInput.value;

            try {
                const response = await fetch('/actions/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email, code })
                });

                const data = await response.json();

                if (!data.success) {
                    // Temps épuisé
                    if (data.message.includes('Temps de jeu épuisé') || data.message.includes('⏰')) {
                        
                        if (typeof showToast === 'function') {
                            showToast(data.message, 'warning');
                        } else {
                            alert(data.message);
                        }
                        
                        const now = new Date();
                        const tomorrow = new Date(now);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(0, 0, 0, 0);
                        
                        const heuresRestantes = Math.floor((tomorrow - now) / 1000 / 60 / 60);
                        const minutesRestantes = Math.floor(((tomorrow - now) / 1000 / 60) % 60);
                        
                        setTimeout(() => {
                            const timeMessage = `⏰ Retour possible dans ${heuresRestantes}h${minutesRestantes}min`;
                            if (typeof showToast === 'function') {
                                showToast(timeMessage, 'info');
                            } else {
                                alert(timeMessage);
                            }
                        }, 3000);
                        
                    } else {
                        // Autres erreurs
                        if (typeof showToast === 'function') {
                            showToast(data.message, 'error');
                        } else if (typeof showPopup === 'function') {
                            // ✅ SI ON EST SUR login.html, utiliser showPopup
                            showPopup(data.message);
                        } else {
                            alert('❌ ' + data.message);
                        }
                    }
                    
                } else {
                    // ✅ CONNEXION RÉUSSIE
                    const user = {
                        logged: true,
                        id: data.user.id,
                        pseudo: data.user.username || data.user.pseudo,
                        points: data.user.points,
                        classe: data.user.classe,
                        cles: data.user.cles != null ? data.user.cles : 0
                    };
                    
                    localStorage.setItem('user', JSON.stringify(user));
                   //console.log('✅ Connexion réussie:', user);

                    if (typeof showToast === 'function') {
                        showToast(data.message || 'Connexion réussie !', 'success');
                    } else if (typeof showPopup === 'function') {
                        showPopup(data.message || 'Connexion réussie !');
                    }

                    // Rediriger vers la page d'accueil
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1000);
                }
                
            } catch (error) {
               //console.error('❌ Erreur:', error);
                if (typeof showToast === 'function') {
                    showToast('Erreur de connexion au serveur', 'error');
                } else if (typeof showPopup === 'function') {
                    showPopup('❌ Erreur de connexion au serveur');
                } else {
                    alert('❌ Erreur réseau');
                }
            }
        });
    }
    
    // ✅ Démarrer le tracking de session si connecté
    checkSession().then(sessionStarted => {
        if (sessionStarted) {
           //console.log('🕐 Démarrage du timer de session');
            if (typeof startSessionTracking === 'function') {
                startSessionTracking();
            }
        }
    });
});
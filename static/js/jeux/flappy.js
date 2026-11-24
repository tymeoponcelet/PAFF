/* ========================================
   JEU FLAPPY BIRD - P.A.F.F.
   Basé sur le clone Flappy Bird par Brandon Plank
   ======================================== */

(function () {
  "use strict";

  // ========== CONFIGURATION ==========
  const CONFIG = {
    gravite: 0.08,
    vitesseSaut: -3,
    espacementTuyaux: 160,
    vitesseTuyaux: 1.5,
    intervalleCreationTuyaux: 1800, // ms
    rayonOiseau: 15,
    hauteurSol: 80,
    hauteurCiel: 400,
  };

  // ========== ÉTAT DU JEU ==========
  let etatJeu = {
    enCours: false,
    partieTerminee: false,
    score: 0,
    meilleurScore: parseInt(localStorage.getItem("flappyBestScore") || "0"),
    premierToucher: false,
    imageAnimation: null,
  };

  // ========== VARIABLES DOM ==========
  let canvas, ctx;
  let modaleFlappy;
  let jeuDemarre = false;

  // ========== VARIABLES DU JEU ==========
  let oiseau = {
    x: 100,
    y: 250,
    velocite: 0,
    rotation: 0,
    rayon: 15,
    largeur: 34,
    hauteur: 24,
    indexImage: 0,
    tempsAnimation: 0,
  };

  let tuyaux = [];
  let sol = {
    x: 0,
    y: 0,
  };

  let ciel = {
    x: 0,
    y: 0,
  };

  let textureFond = null;
  let imageFond = null;
  let textureSol = null;
  let textureTuyauHaut = null;
  let imageTuyauHaut = null;
  let textureTuyauBas = null;
  let imageTuyauBas = null;
  let imagesOiseau = [];
  let texturePartieTerminee = null;
  let texturePret = null;
  let textureCliquez = null;
  let textureTitre = null;

  // ========== INITIALISATION ==========
  window.initFlappy = function () {
    modaleFlappy = document.getElementById("flappyModal");
    if (!modaleFlappy) return;

    canvas = document.getElementById("flappyCanvas");
    if (!canvas) return;

    ctx = canvas.getContext("2d");
    configurerCanvas();
    configurerEcouteurs();
    chargerTextures();

    // ✅ AJOUTER ces 3 blocs (remplacent l'ancien chargerMeilleurScoreFlappy + dessiner)
    window._flappyRejouer = function () {
      reinitialiserJeu();
      dessiner();
    };

    if (typeof window.initFlappyBetControls === "function") {
      window.initFlappyBetControls();
    }

    window.chargerMeilleurScoreFlappy().then((score) => {
      etatJeu.meilleurScore = score;
    });

    dessiner();
  };

  function configurerCanvas() {
    canvas.width = 320;
    canvas.height = 480;
    sol.y = canvas.height - CONFIG.hauteurSol;
    oiseau.y = canvas.height / 2;
  }

  function configurerEcouteurs() {
    // Supprimer les anciens événements du canvas
    const newCanvas = canvas.cloneNode(true);
    canvas.replaceWith(newCanvas);
    canvas = newCanvas;
    ctx = canvas.getContext("2d");

    // Clic/Tap pour faire voler l'oiseau
    canvas.addEventListener("click", gererClic);
    canvas.addEventListener("touchstart", gererClic);

    // Touches clavier
    const keydownHandler = (e) => {
      if (e.code === "Space" && modaleFlappy?.classList.contains("is-open")) {
        e.preventDefault();
        gererClic(e);
      }
    };
    document.addEventListener("keydown", keydownHandler);

    // Fermeture de la modale
    const boutonsFermeture = modaleFlappy.querySelectorAll(".js-close-flappy");
    boutonsFermeture.forEach((bouton) => {
      bouton.addEventListener("click", fermerModaleFlappy);
    });
  }

  function chargerTextures() {
    creerTextures();
    chargerImagesOiseau();
    chargerImageFond();
    chargerImagesTuyaux();
  }

  function chargerImageFond() {
    textureFond = document.createElement("canvas");
    const ctxFond = textureFond.getContext("2d");
    textureFond.width = 320;
    textureFond.height = 400;
    const degrade = ctxFond.createLinearGradient(0, 0, 0, textureFond.height);
    degrade.addColorStop(0, "#4fc3f7");
    degrade.addColorStop(1, "#29b6f6");
    ctxFond.fillStyle = degrade;
    ctxFond.fillRect(0, 0, textureFond.width, textureFond.height);

    imageFond = new Image();
    imageFond.onload = () => {
      const nouveauFond = document.createElement("canvas");
      const ctxNouveauFond = nouveauFond.getContext("2d");
      nouveauFond.width = imageFond.naturalWidth || imageFond.width || 320;
      nouveauFond.height = imageFond.naturalHeight || imageFond.height || 400;
      ctxNouveauFond.imageSmoothingEnabled = false;
      ctxNouveauFond.drawImage(
        imageFond,
        0,
        0,
        nouveauFond.width,
        nouveauFond.height,
      );
      textureFond = nouveauFond;
    };

    imageFond.onerror = () => {
      //console.warn('⚠ Impossible de charger le background.png, utilisation du fond par défaut');
    };

    imageFond.src = "static/img/flappy/background.png";
  }

  function chargerImagesTuyaux() {
    imageTuyauBas = new Image();
    imageTuyauBas.onload = () => {
      const nouveauTuyauBas = document.createElement("canvas");
      const ctxTuyauBas = nouveauTuyauBas.getContext("2d");
      nouveauTuyauBas.width =
        imageTuyauBas.naturalWidth || imageTuyauBas.width || 52;
      nouveauTuyauBas.height =
        imageTuyauBas.naturalHeight || imageTuyauBas.height || 320;
      ctxTuyauBas.imageSmoothingEnabled = false;
      ctxTuyauBas.drawImage(
        imageTuyauBas,
        0,
        0,
        nouveauTuyauBas.width,
        nouveauTuyauBas.height,
      );
      textureTuyauBas = nouveauTuyauBas;
    };

    imageTuyauBas.onerror = () => {
      //console.warn('⚠ Impossible de charger tuyaux01.png');
    };

    imageTuyauBas.src = "static/img/flappy/tuyaux01.png";

    imageTuyauHaut = new Image();
    imageTuyauHaut.onload = () => {
      const nouveauTuyauHaut = document.createElement("canvas");
      const ctxTuyauHaut = nouveauTuyauHaut.getContext("2d");
      nouveauTuyauHaut.width =
        imageTuyauHaut.naturalWidth || imageTuyauHaut.width || 52;
      nouveauTuyauHaut.height =
        imageTuyauHaut.naturalHeight || imageTuyauHaut.height || 320;
      ctxTuyauHaut.imageSmoothingEnabled = false;
      ctxTuyauHaut.drawImage(
        imageTuyauHaut,
        0,
        0,
        nouveauTuyauHaut.width,
        nouveauTuyauHaut.height,
      );
      textureTuyauHaut = nouveauTuyauHaut;
    };

    imageTuyauHaut.onerror = () => {
      //console.warn('⚠ Impossible de charger tuyaux02.png');
    };

    imageTuyauHaut.src = "static/img/flappy/tuyaux02.png";
  }

  function creerImageOiseauDefaut(indexFrame) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 34;
    canvas.height = 24;

    ctx.fillStyle = "#ffeb3b";
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (indexFrame === 0) {
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(4, 6, 7, 5);
      ctx.fillRect(23, 6, 7, 5);
    } else if (indexFrame === 2) {
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(4, 13, 7, 5);
      ctx.fillRect(23, 13, 7, 5);
    } else {
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(3, 9, 7, 6);
      ctx.fillRect(24, 9, 7, 6);
    }

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(canvas.width / 2 + 5, canvas.height / 2 - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(canvas.width / 2 + 6, canvas.height / 2 - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff6f00";
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 + 10, canvas.height / 2);
    ctx.lineTo(canvas.width - 2, canvas.height / 2 - 2);
    ctx.lineTo(canvas.width - 2, canvas.height / 2 + 2);
    ctx.closePath();
    ctx.fill();

    return canvas;
  }

  function chargerImagesOiseau() {
    imagesOiseau = [];
    for (let i = 0; i < 3; i++) {
      imagesOiseau[i] = creerImageOiseauDefaut(i);
    }

    const cheminsImages = [
      "static/img/flappy/bird01.png",
      "static/img/flappy/bird02.png",
      "static/img/flappy/bird03.png",
    ];

    let imagesChargees = 0;
    const totalImages = cheminsImages.length;
    let premiereImageChargee = false;

    cheminsImages.forEach((chemin, index) => {
      const image = new Image();

      image.onload = () => {
        imagesChargees++;

        if (!premiereImageChargee) {
          premiereImageChargee = true;
          oiseau.largeur = (image.naturalWidth || image.width || 34) / 6;
          oiseau.hauteur = (image.naturalHeight || image.height || 24) / 6;
          oiseau.rayon = Math.min(oiseau.largeur, oiseau.hauteur) * 0.35;
        }

        imagesOiseau[index] = image;
      };

      image.onerror = () => {
        //console.warn(`⚠ Impossible de charger: ${chemin}`);
        imagesChargees++;
      };

      image.src = chemin;
    });
  }

  function creerTextures() {
    textureFond = null;

    textureSol = document.createElement("canvas");
    const ctxSol = textureSol.getContext("2d");
    textureSol.width = 336;
    textureSol.height = 112;

    ctxSol.fillStyle = "#deb887";
    ctxSol.fillRect(0, 0, textureSol.width, textureSol.height);

    ctxSol.fillStyle = "#228B22";
    for (let i = 0; i < textureSol.width; i += 20) {
      ctxSol.fillRect(i, 0, 2, textureSol.height);
    }

    textureTuyauHaut = document.createElement("canvas");
    const ctxTuyauHaut = textureTuyauHaut.getContext("2d");
    textureTuyauHaut.width = 52;
    textureTuyauHaut.height = 320;
    ctxTuyauHaut.fillStyle = "#0f5132";
    ctxTuyauHaut.fillRect(
      0,
      0,
      textureTuyauHaut.width,
      textureTuyauHaut.height,
    );
    ctxTuyauHaut.fillStyle = "#198754";
    ctxTuyauHaut.fillRect(
      0,
      0,
      textureTuyauHaut.width - 4,
      textureTuyauHaut.height,
    );

    textureTuyauBas = document.createElement("canvas");
    const ctxTuyauBas = textureTuyauBas.getContext("2d");
    textureTuyauBas.width = 52;
    textureTuyauBas.height = 320;
    ctxTuyauBas.fillStyle = "#0f5132";
    ctxTuyauBas.fillRect(0, 0, textureTuyauBas.width, textureTuyauBas.height);
    ctxTuyauBas.fillStyle = "#198754";
    ctxTuyauBas.fillRect(
      0,
      0,
      textureTuyauBas.width - 4,
      textureTuyauBas.height,
    );

    creerTexturesInterface();
  }

  function creerTexturesInterface() {
    texturePartieTerminee = creerTexteCanvas("PARTIE TERMINÉE", 48, "#fff");
    texturePret = creerTexteCanvas("PRÊT ?", 32, "#fff");
    textureCliquez = creerTexteCanvas("CLIQUEZ", 24, "#fff");
    textureTitre = creerTexteCanvas("FLAPPY BIRD", 36, "#fff");
  }

  function creerTexteCanvas(texte, taille, couleur) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `bold ${taille}px Arial`;
    ctx.fillStyle = couleur;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const metriques = ctx.measureText(texte);
    canvas.width = metriques.width + 20;
    canvas.height = taille + 20;

    ctx.font = `bold ${taille}px Arial`;
    ctx.fillStyle = couleur;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texte, canvas.width / 2, canvas.height / 2);

    return canvas;
  }

  // ========== GESTION DU JEU ==========
  async function demarrerJeu() {
    if (etatJeu.enCours) return;

    // Partie de duel (voir static/js/duel-client.js) : on envoie le duelId, sans mise
    const duel = window.duelEnCours && window.duelEnCours.jeu === 'flappy' ? window.duelEnCours : null;

    try {
      const res = await fetch('/actions/flappy/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duel ? { duelId: duel.id } : {})
      });
      const data = await res.json();
      if (!data.success) {
        if (duel) {
          if (typeof window.showToast === 'function') window.showToast(data.message, 'danger');
          if (typeof window.finirModeDuel === 'function') window.finirModeDuel(null);
        }
        return;
      }
      window._flappySessionToken = data.token;
    } catch (e) {
      return;
    }

    etatJeu.enCours = true;
    etatJeu.partieTerminee = false;
    etatJeu.score = 0;
    etatJeu.premierToucher = false;

    oiseau.x = 100;
    oiseau.y = canvas.height / 2;
    oiseau.velocite = 0;
    oiseau.rotation = 0;

    tuyaux = [];
    jeuDemarre = true;

    boucleJeu();
  }

  function reinitialiserJeu() {
    window._flappySessionToken = null;
    etatJeu.enCours = false;
    etatJeu.partieTerminee = false;
    etatJeu.score = 0;
    etatJeu.premierToucher = false;
    jeuDemarre = false;

    oiseau.x = 100;
    oiseau.y = canvas.height / 2;
    oiseau.velocite = 0;
    oiseau.rotation = 0;

    tuyaux = [];

    if (etatJeu.imageAnimation) {
      cancelAnimationFrame(etatJeu.imageAnimation);
      etatJeu.imageAnimation = null;
    }
  }

  // ========== SYSTÈME DE RÉCOMPENSES ==========
  function calculerRecompense(score) {
    // Vérifier les paliers de récompenses (du plus haut au plus bas)
    if (score >= 80) {
      return 500;
    } else if (score >= 70 && score <= 79) {
      return 300;
    } else if (score >= 60 && score <= 69) {
      return 100;
    } else if (score >= 50 && score <= 59) {
      return 60;
    } else if (score >= 30 && score <= 49) {
      return 40;
    } else if (score >= 20 && score <= 29) {
      return 20;
    } else if (score >= 5 && score <= 19) {
      return 5;
    }
    return 0;
  }

  function afficherRecompense(montant) {
    // Créer un élément visuel pour afficher la récompense
    const recompenseEl = document.createElement("div");
    recompenseEl.id = "flappyRecompense";
    recompenseEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: #10b981;
            padding: 20px 40px;
            border-radius: 12px;
            font-size: 24px;
            font-weight: bold;
            z-index: 10000;
            text-align: center;
            box-shadow: 0 0 30px rgba(16, 185, 129, 0.5);
        `;
    recompenseEl.innerHTML = `
            <div style="font-size: 32px; margin-bottom: 10px;">🎉</div>
            <div>+${montant} points gagnés !</div>
        `;

    document.body.appendChild(recompenseEl);

    // Supprimer après 3 secondes
    setTimeout(() => {
      recompenseEl.style.opacity = "0";
      recompenseEl.style.transition = "opacity 0.3s";
      setTimeout(() => recompenseEl.remove(), 300);
    }, 3000);
  }

  function terminerPartie() {
    if (etatJeu.partieTerminee) return;

    etatJeu.partieTerminee = true;
    etatJeu.enCours = false;

    // Sauvegarder le meilleur score localement
    if (etatJeu.score > etatJeu.meilleurScore) {
      etatJeu.meilleurScore = etatJeu.score;
      localStorage.setItem("flappyBestScore", etatJeu.meilleurScore.toString());
    }

    // Soumettre au serveur et afficher la popup
    window.soumettreScoreFlappy(etatJeu.score).then((data) => {
      const recompense = data ? data.recompense : 0;
      const meilleurScore = data ? data.meilleurScore : etatJeu.meilleurScore;
      const estNouveauRecord = data ? data.estNouveauRecord : false;
      const mise = data && data.duel ? 0 : (window.getMiseCourante ? window.getMiseCourante() : 0);

      if (typeof window.showFlappyResultPopup === "function") {
        window.showFlappyResultPopup({
          score: etatJeu.score,
          recompense,
          meilleurScore,
          mise,
          estNouveauRecord,
          estVictoire: recompense > 0,
        });
      }
    });
  }

  function gererClic(e) {
    if (!modaleFlappy || !modaleFlappy.classList.contains("is-open")) return;

    e.preventDefault();
    e.stopPropagation();

    if (etatJeu.partieTerminee) {
      const popup = document.getElementById("flappyResultOverlay");
      const popupFermee = !popup || !popup.classList.contains("active");
      if (popupFermee) {
        reinitialiserJeu();
        dessiner();
      }
      return;
    }

    if (!etatJeu.enCours && !etatJeu.partieTerminee) {
      // Premier clic - démarrer le jeu
      demarrerJeu();
      return;
    }

    if (etatJeu.enCours && !etatJeu.premierToucher) {
      // Cacher les messages de départ
      etatJeu.premierToucher = true;
    }

    if (etatJeu.enCours) {
      // Faire voler l'oiseau
      oiseau.velocite = CONFIG.vitesseSaut;
      jouerSon("aile");
    }
  }

  // ========== MÉCANIQUES DU JEU ==========
  function mettreAJour() {
    if (!etatJeu.enCours) return;

    // Appliquer la gravité
    oiseau.velocite += CONFIG.gravite;
    oiseau.y += oiseau.velocite;

    // Rotation de l'oiseau selon la vitesse
    oiseau.rotation = Math.min(Math.max(oiseau.velocite * 0.1, -0.6), 0.3);

    // Animation de l'oiseau
    oiseau.tempsAnimation++;
    if (oiseau.tempsAnimation >= 10) {
      oiseau.tempsAnimation = 0;
      oiseau.indexImage = (oiseau.indexImage + 1) % imagesOiseau.length;
    }

    // Calculer l'intervalle de création des tuyaux selon le score
    let intervalleDistance =
      CONFIG.intervalleCreationTuyaux / CONFIG.vitesseTuyaux;

    if (etatJeu.score >= 80) {
      // 80-99 points : 4 fois plus de tuyaux (intervalle divisé par 4)
      intervalleDistance =
        CONFIG.intervalleCreationTuyaux / 4 / CONFIG.vitesseTuyaux;
    } else if (etatJeu.score >= 70 && etatJeu.score < 80) {
      // 70-79 points : tuyaux enchaînés (très rapprochés)
      intervalleDistance = textureTuyauBas.width + 20; // juste un petit espace après le tuyau
    } else if (etatJeu.score >= 30) {
      // 30-69 points : 3 fois plus de tuyaux (intervalle divisé par 3)
      intervalleDistance =
        CONFIG.intervalleCreationTuyaux / 3 / CONFIG.vitesseTuyaux;
    } else if (etatJeu.score >= 20) {
      // 20-29 points : 2 fois plus de tuyaux (intervalle divisé par 2)
      intervalleDistance =
        CONFIG.intervalleCreationTuyaux / 2 / CONFIG.vitesseTuyaux;
    }
    // 0-19 points : intervalle normal (déjà défini par défaut)

    // Générer des tuyaux
    if (
      tuyaux.length === 0 ||
      canvas.width - tuyaux[tuyaux.length - 1].x > intervalleDistance
    ) {
      creerTuyau();
    }

    // Mettre à jour les tuyaux
    tuyaux.forEach((tuyau, index) => {
      tuyau.x -= CONFIG.vitesseTuyaux;

      // Faire osciller les tuyaux entre 50 et 69 points
      if (tuyau.oscillant) {
        tuyau.tempsOscillation += tuyau.vitesseOscillation;
        // Oscillation sinusoïdale
        const offsetVertical =
          Math.sin(tuyau.tempsOscillation) * tuyau.amplitude;
        tuyau.hauteurHaut = tuyau.hauteurHautInitiale + offsetVertical;

        // S'assurer que le tuyau ne sorte pas des limites
        const hauteurMin = 50;
        const hauteurMax = sol.y - CONFIG.espacementTuyaux - hauteurMin;
        tuyau.hauteurHaut = Math.max(
          hauteurMin,
          Math.min(hauteurMax, tuyau.hauteurHaut),
        );
      }

      // Vérifier les collisions
      if (!tuyau.passe && tuyau.x + textureTuyauBas.width < oiseau.x) {
        tuyau.passe = true;
        etatJeu.score++;
        jouerSon("point");
      }

      // Détection de collision
      if (verifierCollision(oiseau, tuyau) && !etatJeu.partieTerminee) {
        terminerPartie();
        jouerSon("collision");
        setTimeout(() => jouerSon("mort"), 200);
      }
    });

    // Retirer les tuyaux hors écran
    tuyaux = tuyaux.filter((tuyau) => tuyau.x + textureTuyauBas.width > 0);

    // Vérifier collision avec le sol ou le plafond
    if (oiseau.y + oiseau.rayon >= sol.y || oiseau.y - oiseau.rayon <= 0) {
      if (!etatJeu.partieTerminee) {
        terminerPartie();
        jouerSon("collision");
        setTimeout(() => jouerSon("mort"), 200);
      }
    }
  }

  function creerTuyau() {
    const espace = CONFIG.espacementTuyaux;
    const hauteurMin = 50;
    const hauteurMax = sol.y - espace - hauteurMin;

    let hauteurHaut;

    // Si on est entre 70 et 79 points, garantir une trajectoire réalisable avec variation obligatoire
    if (etatJeu.score >= 70 && etatJeu.score < 80 && tuyaux.length > 0) {
      const dernierTuyau = tuyaux[tuyaux.length - 1];
      const centreDernierGap = dernierTuyau.hauteurHaut + espace / 2;

      // Distance horizontale entre les tuyaux (très petite à 70+)
      const distanceHorizontale = textureTuyauBas.width + 20;

      // Calculer le temps nécessaire pour traverser la distance horizontale (en frames)
      const tempsTraverseeFrames = distanceHorizontale / CONFIG.vitesseTuyaux;

      // Calculer la capacité de mouvement vertical de l'oiseau pendant la traversée
      // Hauteur maximale atteignable avec un saut
      const hauteurMaxSaut =
        (CONFIG.vitesseSaut * CONFIG.vitesseSaut) / (2 * CONFIG.gravite);

      // Distance verticale que l'oiseau peut parcourir pendant la traversée
      const descenteMax =
        (CONFIG.gravite * tempsTraverseeFrames * tempsTraverseeFrames) / 2;
      const variationVerticaleMax = Math.max(hauteurMaxSaut, descenteMax);

      // Variation verticale sûre avec marge de sécurité (60% pour être sûr)
      const variationVerticaleSûre = variationVerticaleMax * 0.6;

      // Limiter la variation pour éviter des gaps trop éloignés
      const variationMax = espace * 1.5; // Maximum 1.5 fois l'espacement du gap
      const variationLimitee = Math.min(variationVerticaleSûre, variationMax);

      // CONTRAINTES DE VARIATION : imposer un écart minimum et maximum
      const ecartMin = 35; // Écart vertical minimum obligatoire entre deux gaps (évite les tunnels)
      const ecartMax = variationLimitee * 0.85; // Écart maximum (85% de la capacité pour garder une marge)

      // Calculer les limites du nouveau gap (zone accessible)
      let centreGapMinAccessible = Math.max(
        hauteurMin + espace / 2,
        centreDernierGap - variationLimitee,
      );
      let centreGapMaxAccessible = Math.min(
        hauteurMax + espace / 2,
        centreDernierGap + variationLimitee,
      );

      // Zone interdite : autour du gap précédent pour forcer la variation
      const exclusionMin = centreDernierGap - ecartMin;
      const exclusionMax = centreDernierGap + ecartMin;

      // Créer deux plages possibles (au-dessus et en-dessous de la zone interdite)
      const plageBasse = {
        min: centreGapMinAccessible,
        max: Math.min(centreGapMaxAccessible, exclusionMin),
      };
      const plageHaute = {
        min: Math.max(centreGapMinAccessible, exclusionMax),
        max: centreGapMaxAccessible,
      };

      // Vérifier quelles plages sont valides
      const plageBasseValide = plageBasse.max > plageBasse.min;
      const plageHauteValide = plageHaute.max > plageHaute.min;

      let centreGapCible;

      if (plageBasseValide && plageHauteValide) {
        // Les deux plages sont valides, choisir aléatoirement
        const plageChoisie = Math.random() < 0.5 ? plageBasse : plageHaute;
        centreGapCible =
          Math.random() * (plageChoisie.max - plageChoisie.min) +
          plageChoisie.min;
      } else if (plageBasseValide) {
        // Seule la plage basse est valide
        centreGapCible =
          Math.random() * (plageBasse.max - plageBasse.min) + plageBasse.min;
      } else if (plageHauteValide) {
        // Seule la plage haute est valide
        centreGapCible =
          Math.random() * (plageHaute.max - plageHaute.min) + plageHaute.min;
      } else {
        // Aucune plage valide (cas limite), forcer un écart minimum dans une direction
        const peutMonter = centreGapMaxAccessible > exclusionMax;
        const peutDescendre = centreGapMinAccessible < exclusionMin;

        if (peutMonter && peutDescendre) {
          // Choisir aléatoirement
          const direction = Math.random() < 0.5 ? -1 : 1;
          centreGapCible = centreDernierGap + direction * ecartMin;
        } else if (peutMonter) {
          centreGapCible = centreDernierGap + ecartMin;
        } else if (peutDescendre) {
          centreGapCible = centreDernierGap - ecartMin;
        } else {
          // Dernier recours : utiliser le centre précédent (devrait être rare)
          centreGapCible = centreDernierGap;
        }
      }

      // Clamper dans les limites acceptables
      centreGapCible = Math.max(
        hauteurMin + espace / 2,
        Math.min(hauteurMax + espace / 2, centreGapCible),
      );

      // Vérifier et forcer l'écart minimum
      const ecartActuel = Math.abs(centreGapCible - centreDernierGap);
      if (ecartActuel < ecartMin) {
        // Ajuster pour respecter l'écart minimum
        const direction = centreGapCible < centreDernierGap ? -1 : 1;
        centreGapCible = centreDernierGap + direction * ecartMin;
        // Re-clamper
        centreGapCible = Math.max(
          hauteurMin + espace / 2,
          Math.min(hauteurMax + espace / 2, centreGapCible),
        );
      }

      // Convertir le centre du gap en hauteur du tuyau du haut
      hauteurHaut = centreGapCible - espace / 2;

      // Clamper final dans les limites acceptables
      hauteurHaut = Math.max(hauteurMin, Math.min(hauteurMax, hauteurHaut));
    } else {
      // Comportement normal : génération aléatoire
      hauteurHaut = Math.random() * (hauteurMax - hauteurMin) + hauteurMin;
    }

    // Déterminer si les tuyaux doivent osciller (entre 50 et 69 points)
    const doitOsciller = etatJeu.score >= 50 && etatJeu.score < 70;

    tuyaux.push({
      x: canvas.width,
      hauteurHaut: hauteurHaut,
      hauteurHautInitiale: hauteurHaut, // Garder la hauteur initiale pour l'oscillation
      espace: espace,
      passe: false,
      oscillant: doitOsciller,
      tempsOscillation: Math.random() * Math.PI * 2, // Phase aléatoire pour que chaque tuyau oscille différemment
      amplitude: 25, // Amplitude de l'oscillation en pixels
      vitesseOscillation: 0.04, // Vitesse de l'oscillation (plus lent)
    });
  }

  function verifierCollision(oiseau, tuyau) {
    const gaucheOiseau = oiseau.x - oiseau.rayon;
    const droiteOiseau = oiseau.x + oiseau.rayon;
    const hautOiseau = oiseau.y - oiseau.rayon;
    const basOiseau = oiseau.y + oiseau.rayon;

    const gaucheTuyau = tuyau.x;
    const droiteTuyau = tuyau.x + textureTuyauBas.width;
    const basTuyauHaut = tuyau.hauteurHaut;
    const hautTuyauBas = tuyau.hauteurHaut + tuyau.espace;

    // Vérifier collision avec le tuyau du haut
    if (
      droiteOiseau > gaucheTuyau &&
      gaucheOiseau < droiteTuyau &&
      hautOiseau < basTuyauHaut
    ) {
      return true;
    }

    // Vérifier collision avec le tuyau du bas
    if (
      droiteOiseau > gaucheTuyau &&
      gaucheOiseau < droiteTuyau &&
      basOiseau > hautTuyauBas
    ) {
      return true;
    }

    return false;
  }

  // ========== RENDU ==========
  function dessiner() {
    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Si partie terminée, on dessine l'écran de fin
    if (etatJeu.partieTerminee) {
      dessinerPartieTerminee();
      return;
    }

    // Dessiner le fond
    dessinerFond();

    if (!jeuDemarre) {
      // Écran de démarrage
      dessinerEcranDemarrage();
      return;
    }

    // Dessiner les tuyaux
    dessinerTuyaux();

    // Dessiner le sol
    dessinerSol();

    // Dessiner l'oiseau
    dessinerOiseau();

    // Dessiner le score
    dessinerScore();

    // Messages de départ
    if (etatJeu.enCours && !etatJeu.premierToucher) {
      dessinerMessagesDepart();
    }
  }

  function dessinerFond() {
    // Vérifier que le fond est chargé
    if (!textureFond) {
      // Fond par défaut temporaire si l'image n'est pas encore chargée
      ctx.fillStyle = "#4fc3f7";
      ctx.fillRect(0, 0, canvas.width, canvas.height - CONFIG.hauteurSol);
      return;
    }

    // Répéter le fond (image chargée)
    const largeurFond = textureFond.width;
    const hauteurFond = textureFond.height;
    const hauteurZone = canvas.height - CONFIG.hauteurSol;

    // Calculer le nombre de répétitions nécessaires pour couvrir toute la largeur
    for (
      let x = (ciel.x % largeurFond) - largeurFond;
      x < canvas.width;
      x += largeurFond
    ) {
      ctx.drawImage(textureFond, x, 0, largeurFond, hauteurZone);
    }

    // Défilement horizontal du fond
    ciel.x -= 0.5;
  }

  function dessinerSol() {
    const largeurSol = textureSol.width;
    const hauteurSol = CONFIG.hauteurSol;

    for (
      let x = (sol.x % largeurSol) - largeurSol;
      x < canvas.width;
      x += largeurSol
    ) {
      ctx.drawImage(textureSol, x, sol.y, largeurSol, hauteurSol);
    }

    if (etatJeu.enCours) {
      sol.x -= CONFIG.vitesseTuyaux;
    }
  }

  function dessinerTuyaux() {
    tuyaux.forEach((tuyau) => {
      // Tuyau du haut
      const hauteurHaut = tuyau.hauteurHaut;
      const echelleHaut = hauteurHaut / textureTuyauHaut.height;
      ctx.save();
      ctx.scale(1, echelleHaut);
      ctx.drawImage(
        textureTuyauHaut,
        tuyau.x,
        0,
        textureTuyauHaut.width,
        textureTuyauHaut.height,
      );
      ctx.restore();

      // Tuyau du bas
      const hauteurBas = sol.y - (tuyau.hauteurHaut + tuyau.espace);
      const yBas = tuyau.hauteurHaut + tuyau.espace;
      const echelleBas = hauteurBas / textureTuyauBas.height;
      ctx.save();
      ctx.scale(1, echelleBas);
      ctx.drawImage(
        textureTuyauBas,
        tuyau.x,
        yBas / echelleBas,
        textureTuyauBas.width,
        textureTuyauBas.height,
      );
      ctx.restore();
    });
  }

  function dessinerOiseau() {
    ctx.save();
    ctx.translate(oiseau.x, oiseau.y);
    ctx.rotate(oiseau.rotation);

    const image = imagesOiseau[oiseau.indexImage];
    if (image) {
      // Désactiver le lissage pour le pixel art
      ctx.imageSmoothingEnabled = false;

      // Dessiner l'image à 1/3 de sa taille originale (selon les dimensions calculées)
      ctx.drawImage(
        image,
        -oiseau.largeur / 2,
        -oiseau.hauteur / 2,
        oiseau.largeur,
        oiseau.hauteur,
      );
    }

    ctx.restore();
  }

  function dessinerScore() {
    if (!etatJeu.enCours && !etatJeu.partieTerminee) return;

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const texteScore = etatJeu.score.toString();
    ctx.strokeText(texteScore, canvas.width / 2, 80);
    ctx.fillText(texteScore, canvas.width / 2, 80);
  }

  function dessinerEcranDemarrage() {
    // Titre Flappy Bird
    if (textureTitre) {
      ctx.drawImage(textureTitre, (canvas.width - textureTitre.width) / 2, 100);
    }

    // Instructions
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "Cliquez pour commencer",
      canvas.width / 2,
      canvas.height / 2 + 100,
    );

    // Meilleur score
    if (etatJeu.meilleurScore > 0) {
      ctx.fillStyle = "#aaa";
      ctx.font = "16px Arial";
      ctx.fillText(
        `Meilleur score: ${etatJeu.meilleurScore}`,
        canvas.width / 2,
        canvas.height - 50,
      );
    }
  }

  function dessinerMessagesDepart() {
    // Prêt
    if (texturePret) {
      ctx.drawImage(
        texturePret,
        (canvas.width - texturePret.width) / 2,
        canvas.height / 2 - 60,
      );
    }

    // Cliquez
    if (textureCliquez) {
      ctx.drawImage(
        textureCliquez,
        (canvas.width - textureCliquez.width) / 2,
        canvas.height / 2 - 20,
      );
    }
  }

  function dessinerPartieTerminee() {
    // Fond semi-transparent
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Partie Terminée
    if (texturePartieTerminee) {
      ctx.drawImage(
        texturePartieTerminee,
        (canvas.width - texturePartieTerminee.width) / 2,
        canvas.height / 2 - 120,
      );
    }

    // Score
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4;
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.strokeText(
      `Score: ${etatJeu.score}`,
      canvas.width / 2,
      canvas.height / 2 - 60,
    );
    ctx.fillText(
      `Score: ${etatJeu.score}`,
      canvas.width / 2,
      canvas.height / 2 - 60,
    );

    // Afficher la récompense
    const recompense = calculerRecompense(etatJeu.score);
    if (recompense > 0) {
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#10b981";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.strokeText(
        `+${recompense} points`,
        canvas.width / 2,
        canvas.height / 2 - 20,
      );
      ctx.fillText(
        `+${recompense} points`,
        canvas.width / 2,
        canvas.height / 2 - 20,
      );
    }

    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeText(
      `Meilleur: ${etatJeu.meilleurScore}`,
      canvas.width / 2,
      canvas.height / 2 + 10,
    );
    ctx.fillText(
      `Meilleur: ${etatJeu.meilleurScore}`,
      canvas.width / 2,
      canvas.height / 2 + 10,
    );

    // Rejouer
    ctx.fillStyle = "#aaa";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.font = "20px Arial";
    ctx.strokeText(
      "Cliquez pour rejouer",
      canvas.width / 2,
      canvas.height / 2 + 60,
    );
    ctx.fillText(
      "Cliquez pour rejouer",
      canvas.width / 2,
      canvas.height / 2 + 60,
    );
  }

  // ========== BOUCLE DE JEU ==========
  function boucleJeu() {
    mettreAJour();
    dessiner();

    if (etatJeu.enCours || (!etatJeu.partieTerminee && jeuDemarre)) {
      etatJeu.imageAnimation = requestAnimationFrame(boucleJeu);
    } else if (etatJeu.partieTerminee) {
      // Continuer à dessiner même après partie terminée
      dessiner();
    }
  }

  // ========== SONS ==========
  function jouerSon(nomSon) {
    // Implémentation basique (peut être améliorée avec des fichiers audio)
    // Pour l'instant, on peut utiliser l'API Web Audio ou simplement ignorer
    try {
      const audio = new Audio();
      // Les sons peuvent être ajoutés plus tard
      // audio.src = `static/sounds/flappy_${nomSon}.mp3`;
      // audio.play().catch(() => {});
    } catch (e) {
      // Ignorer les erreurs de son
    }
  }

  // ========== MODALES ==========
  function ouvrirModaleFlappy() {
    if (!modaleFlappy) return;

    modaleFlappy.classList.add("is-open");
    document.body.style.overflow = "hidden";

    reinitialiserJeu();
    if (ctx) dessiner();
  }

  function fermerModaleFlappy() {
    if (!modaleFlappy) return;

    modaleFlappy.classList.remove("is-open");
    document.body.style.overflow = "";

    if (typeof window.closeFlappyResultPopup === 'function') {
      window.closeFlappyResultPopup();
    }

    reinitialiserJeu();

    if (etatJeu.imageAnimation) {
      cancelAnimationFrame(etatJeu.imageAnimation);
      etatJeu.imageAnimation = null;
    }
  }

  // ========== INITIALISATION AU CHARGEMENT ==========
  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("flappyModal")) {
      window.initFlappy();
    }
  });

  // Écouter l'événement de chargement dynamique
  document.addEventListener("flappyModalLoaded", () => {
    window.initFlappy();
  });
})();

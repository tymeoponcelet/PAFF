/* ========================================
   SYSTÈME D'AIDE POUR LES JEUX
   ======================================== */

(function () {
  "use strict";

  // Données d'aide pour chaque jeu
  const donneesAide = {
    blackjack: {
      title: "🎴 Blackjack",
      content: `
        <h3>Objectif du jeu</h3>
        <p>Battez le croupier en obtenant un score le plus proche de 21 sans le dépasser.</p>

        <h4>📋 Règles de base</h4>
        <ul>
          <li><strong>Valeurs des cartes :</strong>
            <ul>
              <li>Les figures (Valet, Dame, Roi) valent <strong>10 points</strong></li>
              <li>L'As vaut <strong>11 ou 1 point</strong> (choisi automatiquement pour votre avantage)</li>
              <li>Les autres cartes valent leur valeur faciale (2 à 10)</li>
            </ul>
          </li>
          <li><strong>Actions disponibles :</strong>
            <ul>
              <li><strong>Distribuer :</strong> Commence une nouvelle partie avec 2 cartes pour vous et le croupier</li>
              <li><strong>Tirer :</strong> Demandez une carte supplémentaire</li>
              <li><strong>Rester :</strong> Terminez votre tour et laissez le croupier jouer</li>
              <li><strong>Doubler :</strong> Doublez votre mise et recevez une seule carte</li>
              <li><strong>Split :</strong> Séparez deux cartes identiques en deux mains</li>
              <li><strong>Nouvelle partie :</strong> Réinitialise le jeu</li>
            </ul>
          </li>
        </ul>

        <h4>🏆 Résultats</h4>
        <ul>
          <li><strong>Blackjack (21 dès le départ)</strong> : Victoire immédiate ! Vous gagnez <strong>x2 votre mise</strong></li>
          <li><strong>Votre score > 21</strong> : Vous perdez, le croupier gagne</li>
          <li><strong>Votre score > croupier</strong> : Vous gagnez <strong>x2 votre mise</strong></li>
          <li><strong>Égalité</strong> : Votre mise est remboursée</li>
          <li><strong>Croupier > 21</strong> : Vous gagnez automatiquement</li>
        </ul>

        <h4>💡 Astuce</h4>
        <p>Le croupier doit tirer des cartes jusqu'à atteindre au moins 17 points. Utilisez cette règle à votre avantage !</p>
      `,
    },

    puissance4: {
      title: "🟡 Puissance 4",
      content: `
        <h3>Objectif du jeu</h3>
        <p>Alignez 4 pions de votre couleur (rouge 🔴) horizontalement, verticalement ou en diagonale avant le robot (jaune 🟡).</p>

        <h4>📋 Règles de base</h4>
        <ul>
          <li><strong>Grille :</strong> 7 colonnes × 6 lignes</li>
          <li><strong>Votre couleur :</strong> Rouge 🔴</li>
          <li><strong>Couleur du robot :</strong> Jaune 🟡</li>
          <li><strong>Déroulement :</strong> Cliquez sur une colonne pour y placer votre pion. Le pion tombe dans la case la plus basse disponible.</li>
        </ul>

        <h4>🎮 Comment jouer</h4>
        <ol>
          <li>Cliquez sur <code>Commencer la partie</code> après avoir défini votre mise</li>
          <li>Cliquez sur une colonne pour placer votre pion rouge</li>
          <li>Le robot joue automatiquement après votre coup</li>
          <li>Le premier à aligner 4 pions gagne !</li>
        </ol>

        <h4>🏆 Résultats</h4>
        <ul>
          <li><strong>Victoire</strong> : Vous gagnez <strong>x2 votre mise</strong></li>
          <li><strong>Défaite</strong> : Vous perdez votre mise</li>
          <li><strong>Match nul</strong> : Votre mise est remboursée</li>
        </ul>

        <h4>💡 Astuce</h4>
        <p>Le robot essaie de gagner et de bloquer vos alignements. Pensez à bloquer ses menaces tout en créant vos propres opportunités !</p>
      `,
    },

    quiz: {
      title: "🧠 Quiz",
      content: `
        <h3>Objectif du jeu</h3>
        <p>Répondez juste et vite à 10 questions de culture générale ou de cours (informatique, économie et droit, mathématiques).</p>

        <h4>📋 Règles</h4>
        <ul>
          <li><strong>Thème :</strong> choisissez un thème ou mélangez-les tous</li>
          <li><strong>Temps :</strong> 20 secondes par question ; passé ce délai, la réponse compte comme fausse</li>
          <li><strong>Clavier :</strong> touches 1 à 4 (ou A à D) pour répondre</li>
        </ul>

        <h4>🏆 Score et points</h4>
        <ul>
          <li><strong>Score :</strong> 100 par bonne réponse + jusqu'à 50 de bonus de rapidité. Il compte pour le classement « Par jeu »</li>
          <li><strong>Points :</strong> +10 pts par bonne réponse (pas de mise, rien à perdre)</li>
        </ul>

        <h4>⚔️ En duel</h4>
        <p>Bouton <strong>Défier</strong> : les deux joueurs ont les mêmes questions, le meilleur score gagne. Une seule tentative, sans points gagnés.</p>
      `,
    },

    flappy: {
      title: "🐤 Flappy Bird",
      content: `
        <h3>Objectif du jeu</h3>
        <p>Faites voler l'oiseau en évitant les tuyaux pour obtenir le meilleur score possible.</p>

        <h4>📋 Règles de base</h4>
        <ul>
          <li><strong>Contrôles :</strong> Cliquez ou appuyez sur <code>Espace</code> pour faire voler l'oiseau</li>
          <li><strong>Score :</strong> +1 point chaque fois que vous passez entre deux tuyaux</li>
          <li><strong>Fin de partie :</strong> Si vous touchez un tuyau, le sol ou le plafond</li>
        </ul>

        <h4>🎮 Mécaniques spéciales</h4>
        <ul>
          <li><strong>0-19 points :</strong> Difficulté normale, espacement standard entre les tuyaux</li>
          <li><strong>20-29 points :</strong> 2x plus de tuyaux, espacement réduit</li>
          <li><strong>30-49 points :</strong> 3x plus de tuyaux, encore plus serrés</li>
          <li><strong>50-69 points :</strong> Les tuyaux oscillent de haut en bas !</li>
          <li><strong>70-79 points :</strong> Tuyaux enchaînés très rapprochés avec variation obligatoire</li>
          <li><strong>80-99 points :</strong> 4x plus de tuyaux, difficulté maximale</li>
        </ul>

        <h4>🏆 Récompenses selon le score</h4>
        <ul>
          <li><strong>5-19 points :</strong> +5 points</li>
          <li><strong>20-29 points :</strong> +20 points</li>
          <li><strong>30-49 points :</strong> +40 points</li>
          <li><strong>50-59 points :</strong> +60 points</li>
          <li><strong>60-69 points :</strong> +100 points</li>
          <li><strong>70-79 points :</strong> +300 points</li>
          <li><strong>99+ points :</strong> +500 points !</li>
        </ul>

        <h4>⚔️ En duel</h4>
        <p>Bouton <strong>Défier</strong> : chacun joue sa partie sans mise, le meilleur score gagne. Une seule tentative par duel.</p>

        <h4>💡 Astuce</h4>
        <p>Le rythme est la clé ! Cliquez régulièrement pour maintenir l'oiseau à une hauteur constante. Ne paniquez pas quand les tuyaux oscillent ou se rapprochent.</p>
      `,
    },

    crash: {
      title: "🚀 Crash",
      content: `
        <h3>Objectif du jeu</h3>
        <p>Placez une mise et encaissez avant que la courbe de multiplicateur ne "crash" pour gagner des points.</p>

        <h4>📋 Règles de base</h4>
        <ul>
          <li><strong>Principe :</strong> Une courbe de multiplicateur monte progressivement puis s'arrête soudainement</li>
          <li><strong>Votre mission :</strong> Encaissez vos gains avant que la courbe ne "crash"</li>
          <li><strong>Risque :</strong> Si vous n'encaissez pas à temps, vous perdez votre mise</li>
        </ul>

        <h4>🎮 Comment jouer</h4>
        <ol>
          <li>Définissez votre mise</li>
          <li>La courbe commence à monter avec un multiplicateur qui augmente</li>
          <li>Cliquez sur <code>Encaisser</code> au moment où vous voulez récupérer vos gains</li>
          <li>Si vous encaissez avant le crash : vous gagnez <strong>mise × multiplicateur</strong></li>
          <li>Si le crash arrive avant : vous perdez votre mise</li>
        </ol>

        <h4>💡 Astuce</h4>
        <p>Le moment du crash est aléatoire ! Plus vous attendez, plus le multiplicateur est élevé, mais plus le risque de crash augmente. Trouvez votre équilibre entre risque et récompense.</p>
      `,
    },

    demineur: {
      title: "💣 Démineur",
      content: `
        <h3>Objectif du jeu</h3>
        <p>Révélez toutes les cases sans mines en utilisant les chiffres qui indiquent le nombre de mines adjacentes.</p>

        <h4>📋 Règles de base</h4>
        <ul>
          <li><strong>Grille :</strong> Une grille de cases, certaines contiennent des mines</li>
          <li><strong>Chiffres :</strong> Les cases révélées affichent un chiffre indiquant le nombre de mines dans les 8 cases adjacentes</li>
          <li><strong>Actions :</strong>
            <ul>
              <li><strong>Clic gauche :</strong> Révéler une case</li>
              <li><strong>Clic droit :</strong> Marquer une case comme mine suspectée</li>
            </ul>
          </li>
        </ul>

        <h4>🎮 Comment jouer</h4>
        <ol>
          <li>Cliquez sur une case pour la révéler</li>
          <li>Si un chiffre apparaît, il indique combien de mines sont autour</li>
          <li>Utilisez la logique pour déduire où se trouvent les mines</li>
          <li>Marquez les mines suspectées avec un clic droit</li>
          <li>Révélez toutes les cases sans mines pour gagner !</li>
        </ol>

        <h4>🏆 Résultats</h4>
        <ul>
          <li><strong>Victoire :</strong> Vous gagnez des points selon la difficulté et le temps</li>
          <li><strong>Défaite :</strong> Si vous cliquez sur une mine, la partie se termine</li>
        </ul>

        <h4>💡 Astuce</h4>
        <p>Commencez par les cases qui ont le moins de mines adjacentes. Utilisez la logique déductive : si une case indique "1" et qu'une seule case adjacente n'est pas révélée, c'est forcément une mine !</p>
      `,
    },

    plinko: {
      title: "🟡 Plinko",
      content: `
        <h3>Objectif du jeu</h3>
        <p>Laissez tomber une bille depuis le haut du plateau et regardez-la rebondir sur les chevilles jusqu’à atteindre une case multiplicatrice. Le multiplicateur détermine votre gain final.</p>

        <h4>📋 Règles de base</h4>
        <ul>
          <li><strong>Plateau :</strong> pyramide de chevilles avec plusieurs cases multiplicatrices en bas</li>
          <li><strong>Mise :</strong> Points par nombre de billes</li>
          <li><strong>Objectif :</strong> faire tomber la bille dans la case avec le meilleur multiplicateur</li>
          <li><strong>Multiplicateurs :</strong> varient selon le niveau de risque choisi</li>
        </ul>

        <h4>⚡ Niveau de risque</h4>
        <p>Avant de jouer, choisissez votre niveau de risque. Plus le risque est élevé, plus les multiplicateurs extrêmes sont possibles.</p>
        <ul>
          <li><strong>Risque faible :</strong> gains fréquents mais multiplicateurs modestes</li>
          <li><strong>Risque moyen :</strong> bon équilibre entre risque et récompense</li>
          <li><strong>Risque élevé :</strong> gros multiplicateurs possibles mais beaucoup plus rares</li>
        </ul>

        <h4>🎮 Comment jouer</h4>
        <ol>
          <li>Choisissez le <strong>niveau de risque</strong></li>
          <li>Cliquez sur <code>Jouer (100 pts)</code></li>
          <li>La <strong>bille tombe automatiquement</strong> depuis le haut du plateau</li>
          <li>Elle rebondit de façon aléatoire sur les chevilles</li>
          <li>Le <strong>multiplicateur de la case finale</strong> détermine votre gain</li>
        </ol>

        <h4>💰 Exemples de gains (mise : 100 pts)</h4>
        <ul>
          <li><strong>Risque faible : </strong></li>
          <li><strong>De :</strong> x0.5 → 20 pts</li>
  
          <li><strong>à :</strong> x7 → 100 pts</li>
          <li><strong>Risque moyen : </li>
          <li>De :</strong> x0.3 → 30 pts</li>
          <li><strong>à :</strong> x20 → 2000 pts</li>

          <li><strong>Risque élevé :
          <li>De :</strong> x0.3 → 30 pts</li>
          <li><strong>à :</strong> x50 → 5000 pts</li>
        </ul>

        <h4>⚠️ Attention</h4>
        <ul>
          <li>Le résultat est <strong>entièrement aléatoire</strong></li>
          <li>Certaines cases peuvent être <strong>inférieures à votre mise</strong></li>
          <li>Les gros multiplicateurs sont <strong>très rares</strong></li>
          <li>Chaque bille est <strong>indépendante</strong></li>
        </ul>

        <h4>💡 Stratégie</h4>
        <ul>
          <li><strong>Risque faible :</strong> idéal pour jouer longtemps et limiter les pertes</li>
          <li><strong>Risque moyen :</strong> bon compromis entre risque et gains</li>
          <li><strong>Risque élevé :</strong> pour tenter de gros gains rapidement</li>
          <li>Alterner les niveaux de risque peut aider à <strong>mieux gérer votre bankroll</strong></li>
        </ul>
  
    `,
    },

    mastermind: {
      title: "💣 Mines",
      content: `
    <h3>Objectif du jeu</h3>
    <p>Révélez un maximum de cases sans tomber sur une mine. Plus vous en révélez, plus votre multiplicateur grimpe — encaissez au bon moment !</p>
    <h4>📋 Règles de base</h4>
    <ul>
      <li><strong>Grille :</strong> 5×5 cases (25 cases au total)</li>
      <li><strong>Mines :</strong> Choisissez entre 1 et 24 mines avant de commencer</li>
      <li><strong>Mise :</strong> 50 points par partie</li>
      <li><strong>Objectif :</strong> Révéler des cases sûres sans toucher une mine</li>
    </ul>
    <h4>⚡ Multiplicateur</h4>
    <p>Chaque case sûre révélée augmente votre multiplicateur. Plus il y a de mines, plus le multiplicateur monte vite !</p>
    <ul>
      <li><strong>1 mine :</strong> progression lente, risque faible</li>
      <li><strong>5 mines :</strong> progression modérée, bon équilibre</li>
      <li><strong>15 mines :</strong> progression explosive, risque très élevé</li>
    </ul>
    <h4>🎮 Comment jouer</h4>
    <ol>
      <li>Choisissez le nombre de mines avec les boutons <code>−</code> et <code>+</code></li>
      <li>Cliquez sur <code>Jouer (50 pts)</code> pour démarrer</li>
      <li>Cliquez sur les cases pour les révéler</li>
      <li>Cliquez sur <code>Encaisser</code> quand vous voulez sécuriser vos gains</li>
    </ol>
    <h4>💰 Exemples de gains (5 cases révélées)</h4>
    <ul>
      <li><strong>1 mine :</strong> ~x1.24 → 62 pts</li>
      <li><strong>3 mines :</strong> ~x1.85 → 93 pts</li>
      <li><strong>5 mines :</strong> ~x2.94 → 147 pts</li>
      <li><strong>8 mines :</strong> ~x6.13 → 307 pts</li>
      <li><strong>15 mines :</strong> ~x52 → 2600 pts</li>
    </ul>
    <h4>⚠️ Attention</h4>
    <ul>
      <li>Toucher une mine = mise perdue immédiatement</li>
      <li>Encaissez avant de prendre trop de risques</li>
      <li>Si vous révélez toutes les cases sûres, le cashout est automatique</li>
      <li>Fermer la fenêtre pendant une partie = mise perdue</li>
    </ul>
    <h4>💡 Stratégie</h4>
    <ul>
      <li>Avec peu de mines, encaissez après 10+ cases pour maximiser le gain</li>
      <li>Avec beaucoup de mines, encaissez dès 2-3 cases pour limiter le risque</li>
      <li>Le multiplicateur augmente de façon exponentielle — ne soyez pas trop gourmand !</li>
    </ul>
  `,
    },

    tapetaupe: {
      title: "🔨 Tape-Taupe",
      content: `
        <h3>Objectif du jeu</h3>
        <p>Frappez les taupes qui apparaissent pour gagner des points en 30 secondes !</p>

        <h4>📋 Types de taupes</h4>
        <ul>
          <li><strong>Taupe normale :</strong> +10 points</li>
          <li><strong>Taupe dorée :</strong> +45 points</li>
          <li><strong>Bombe :</strong> -100 points (évitez-les !)</li>
          <li><strong>Taupe rapide :</strong> +35 points (apparaît rapidement)</li>
        </ul>

        <h4>🎮 Système de combo</h4>
        <p>Frappez plusieurs taupes d'affilée sans en manquer pour activer un multiplicateur de combo (+15% par taupe)</p>

        <h4>⚔️ En duel</h4>
        <p>Bouton <strong>Défier</strong> : chacun joue sa partie de 30 secondes sans mise, le meilleur score gagne. Une seule tentative par duel.</p>

        <h4>💡 Astuce</h4>
        <p>Les bombes ne réinitialisent pas votre combo si vous les évitez ! Concentrez-vous sur les taupes dorées et rapides pour maximiser vos gains.</p>
      `,
    },
    roulette: {
      title: "🎰 Roulette",
      content: `
        <h3>Objectif du jeu</h3>
        <p>Pariez sur un ou plusieurs numéros, couleurs ou groupes de numéros, puis lancez la roue pour tenter de multiplier votre mise !</p>
 
        <h4>📋 Types de mises</h4>
        <ul>
          <li><strong>Rouge / Noir :</strong> Pariez sur la couleur du numéro tiré → <strong>x2</strong></li>
          <li><strong>Pair / Impair :</strong> Pariez sur la parité du numéro tiré → <strong>x2</strong></li>
          <li><strong>Douzaine :</strong> Pariez sur une tranche de 12 numéros (1-12, 13-24 ou 25-36) → <strong>x3</strong></li>
          <li><strong>Plein :</strong> Pariez sur un numéro exact (0 à 36) → <strong>x36</strong></li>
        </ul>
 
        <h4>⚠️ Le zéro</h4>
        <p>Si le <strong>0</strong> sort, toutes les mises Rouge/Noir, Pair/Impair et Douzaines sont perdantes. Seul un pari plein sur le 0 est gagnant.</p>
 
        <h4>🎮 Comment jouer</h4>
        <ol>
          <li>Sélectionnez la <strong>valeur de votre jeton</strong> (10, 25, 50, 100, 200 ou 500 pts)</li>
          <li>Cliquez sur les zones de mise souhaitées — vous pouvez <strong>cumuler plusieurs mises</strong> à la fois</li>
          <li>Vérifiez le récapitulatif de vos mises en bas du panneau</li>
          <li>Cliquez sur <code>🎰 Lancer</code> pour faire tourner la roue</li>
          <li>Le résultat s'affiche au centre de la roue et un récapitulatif détaillé apparaît</li>
        </ol>
 
        <h4>💰 Exemples de gains</h4>
        <ul>
          <li>Mise 100 pts sur Rouge → Numéro rouge sort : <strong>+100 pts</strong></li>
          <li>Mise 50 pts sur Douzaine 1-12 → Numéro entre 1 et 12 sort : <strong>+100 pts</strong></li>
          <li>Mise 10 pts sur Plein 7 → Numéro 7 sort : <strong>+350 pts</strong></li>
          <li>Mise 100 pts sur Rouge + 50 pts sur Pair → Les deux gagnent : <strong>+150 pts net</strong></li>
        </ul>
 
        <h4>💡 Stratégie</h4>
        <ul>
          <li>Combiner <strong>Rouge/Noir</strong> avec <strong>une douzaine</strong> réduit le risque tout en augmentant le gain potentiel</li>
          <li>Les mises <strong>plein</strong> sont rares mais très rentables — n'y misez que de petits jetons</li>
          <li>La mise minimale par jeton est de <strong>10 pts</strong>, la maximale de <strong>500 pts</strong></li>
          <li>Vous pouvez cliquer plusieurs fois sur la même zone pour augmenter la mise progressivement</li>
        </ul>
        `,
    },

    hilow: {
      title: "🎴 Hi-Low",
      content: `
        <h3>Objectif du jeu</h3>
        <p>Devinez si le prochain nombre sera plus élevé ou plus bas ou égale que le précédent pour accumuler un maximum de points !</p>

        <h4>📋 Règles du jeu</h4>
        <ul>
          <li><strong>Hi (Plus haut) :</strong> Pariez que le prochain nombre sera supérieur</li>
          <li><strong>Low (Plus bas) :</strong> Pariez que le prochain nombre sera inférieur</li>
          <li><strong>Égale :</strong> Pariez que le prochain nombre sera égale</li>
          <li><strong>Bonne réponse :</strong> Vous gagnez des points</li>
          <li><strong>Mauvaise réponse :</strong> Vous perdez votre série en cours</li>
        </ul>

        <h4>🎮 Système de combo</h4>
        <p>Chaque bonne réponse consécutive augmente votre multiplicateur de score. Plus votre série est longue, plus vous gagnez de points !</p>

        <h4>💡 Astuce</h4>
        <p>Analysez les tendances et gérez votre prise de risque : sécuriser une série ou tenter de la prolonger peut faire toute la différence.</p>

      `,
    },
  };

  // Variables DOM (seront réinitialisées)
  let modaleAide;
  let titreAide;
  let contenuAide;
  let boutonFermerAide;

  /**
   * Initialise le système d'aide (appelé au chargement de la modale)
   */
  window.initHelp = function () {
    modaleAide = document.getElementById("helpModal");
    if (!modaleAide) {
      //console.warn('⚠️ Modale d\'aide introuvable');
      return;
    }

    titreAide = document.getElementById("helpTitle");
    contenuAide = document.getElementById("helpContent");
    boutonFermerAide = modaleAide.querySelector(".js-close-help");

    // Bouton fermer
    if (boutonFermerAide) {
      const newBoutonFermer = boutonFermerAide.cloneNode(true);
      boutonFermerAide.replaceWith(newBoutonFermer);
      boutonFermerAide = newBoutonFermer;
      boutonFermerAide.addEventListener("click", fermerModaleAide);
    }

    // Clic sur l'overlay
    modaleAide.addEventListener("click", (evenement) => {
      if (evenement.target === modaleAide) {
        fermerModaleAide();
      }
    });

    // Fermer avec Escape
    document.addEventListener("keydown", (evenement) => {
      if (
        evenement.key === "Escape" &&
        modaleAide?.classList.contains("is-open")
      ) {
        fermerModaleAide();
      }
    });

    //console.log('✅ Système d\'aide initialisé');
  };

  // Ouvrir la modale d'aide
  window.ouvrirModaleAide = function (nomJeu) {
    if (!donneesAide[nomJeu]) {
      //console.warn(`Aucune aide disponible pour le jeu: ${nomJeu}`);
      return;
    }

    const aideDuJeu = donneesAide[nomJeu];

    if (titreAide) titreAide.textContent = aideDuJeu.title;
    if (contenuAide) contenuAide.innerHTML = aideDuJeu.content;

    if (modaleAide) {
      modaleAide.classList.add("is-open");
      document.body.style.overflow = "hidden";
      boutonFermerAide?.focus();
    }
  };

  // Fermer la modale d'aide
  function fermerModaleAide() {
    if (modaleAide) {
      modaleAide.classList.remove("is-open");
      document.body.style.overflow = "";
    }
  }

  // Initialiser si la modale existe déjà au chargement
  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("helpModal")) {
      window.initHelp();
    }
  });

  // Écouter l'événement de chargement dynamique
  document.addEventListener("helpModalLoaded", () => {
    window.initHelp();
  });
})();

const express = require('express');
const router = express.Router();
const db = require('../../config');
const { requireAuth, checkBalance } = require('../middleware/auth');
const { tryKeyDrop } = require('../key-drop');
const checkTime = require('../middleware/checktime');
const duels = require('../services/duel');
const crypto = require('crypto');

router.use(checkTime);

// ── Multiplicateurs (miroir du client) ────────────────────────────────────
function getMultiplicateur(score) {
    if (score >= 80) return 20;
    if (score >= 70) return 10;
    if (score >= 60) return 5;
    if (score >= 50) return 3;
    if (score >= 30) return 2;
    if (score >= 20) return 1;
    if (score >= 5) return 0;
    return 0;
}

// ── POST /actions/flappy/score ─────────────────────────────────────────────
router.post('/score', requireAuth, (req, res) => {
    const { score, mise } = req.body;
    const userId = req.session.user.id;

    // Validation score
    if (score === undefined || score === null || isNaN(score)) {
        return res.status(400).json({ success: false, message: 'Score invalide' });
    }
    const scoreInt = parseInt(score);
    if (scoreInt < 0 || scoreInt > 9999) {
        return res.status(400).json({ success: false, message: 'Score hors limites' });
    }

    const { token } = req.body;

    const session = db.prepare(`
    SELECT * FROM flappy_session
    WHERE compte_id = ? AND token = ? AND used = 0
`).get(userId, token);

    if (!session) {
        return res.status(400).json({ success: false, message: 'Session de jeu invalide' });
    }

    // Validation mise (aucune mise pendant un duel)
    const duelId = session.duel_id || null;
    const miseInt = duelId ? 0 : Math.max(0, parseInt(mise) || 0);

    const dureeMs = Date.now() - session.started_at;
    const dureeMinimaleMs = Math.max(5000, scoreInt * 1400);

    if (dureeMs < dureeMinimaleMs) {
        // En duel, la partie est consommée : elle compte 0 au lieu de rester ouverte
        if (duelId) {
            db.prepare('UPDATE flappy_session SET used = 1 WHERE token = ?').run(token);
            const duel = duels.enregistrerScore(duelId, userId, 0);
            return res.status(400).json({ success: false, message: 'Durée de partie suspecte : score compté 0', duel });
        }
        return res.status(400).json({ success: false, message: 'Durée de partie suspecte' });
    }

    db.prepare('UPDATE flappy_session SET used = 1 WHERE token = ?').run(token);

    if (miseInt > 500) {
        return res.status(400).json({ success: false, message: 'Mise maximum : 500 pts' });
    }

    try {
        const userData = db.prepare(
            'SELECT points, flappy_best_score FROM compte WHERE id = ?'
        ).get(userId);

        if (!userData) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        }

        // Vérifier que le joueur a assez de points pour la mise
        if (miseInt > 0 && userData.points < miseInt) {
            return res.status(400).json({ success: false, message: 'Solde insuffisant pour cette mise' });
        }

        const multiplicateur = getMultiplicateur(scoreInt);
        const recompense = multiplicateur > 0
            ? Math.floor(miseInt * multiplicateur)
            : 0;

        // Calcul net : on déduit la mise, on ajoute la récompense
        // Si pas de récompense → perd la mise
        // Si récompense       → perd la mise, gagne recompense
        const variationNette = recompense - miseInt; // peut être négatif

        // Mettre à jour meilleur score
        const ancienMeilleurScore = userData.flappy_best_score || 0;
        const nouveauMeilleurScore = Math.max(ancienMeilleurScore, scoreInt);
        const estNouveauRecord = scoreInt > ancienMeilleurScore;

        if (estNouveauRecord) {
            db.prepare(
                'UPDATE compte SET flappy_best_score = ? WHERE id = ?'
            ).run(nouveauMeilleurScore, userId);
        }

        // Appliquer variation nette (mise déduite + récompense créditée)
        if (miseInt > 0) {
            db.prepare(
                'UPDATE compte SET points = points + ? WHERE id = ?'
            ).run(variationNette, userId);

            const raison = recompense > 0
                ? `Flappy Bird - Score ${scoreInt} (×${multiplicateur}) : mise ${miseInt} → +${recompense} pts`
                : `Flappy Bird - Score ${scoreInt} : mise perdue -${miseInt} pts`;

            db.prepare(
                'INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)'
            ).run(userId, variationNette, raison);
        }

        // Historique (classement par jeu) et résultat du duel éventuel
        duels.enregistrerPartie(userId, 'flappy', scoreInt, duelId);
        const duel = duelId ? duels.enregistrerScore(duelId, userId, scoreInt) : null;

        // Récupérer solde final
        const userMaj = db.prepare('SELECT points FROM compte WHERE id = ?').get(userId);
        const nouveauxPoints = userMaj ? userMaj.points : userData.points;
        req.session.user.points = nouveauxPoints;

        if (miseInt > 0) {
            tryKeyDrop(db, userId, miseInt, 'flappy', (errDrop, dropResult) => {
                if (errDrop) dropResult = { dropped: false, userKeys: null };
                return res.json({
                    success: true,
                    recompense, variationNette, nouveauxPoints,
                    meilleurScore: nouveauMeilleurScore, estNouveauRecord, multiplicateur,
                    keyDropped: dropResult && dropResult.dropped,
                    userKeys: dropResult && dropResult.userKeys,
                    duel
                });
            });
        } else {
            return res.json({
                success: true,
                recompense, variationNette, nouveauxPoints,
                meilleurScore: nouveauMeilleurScore, estNouveauRecord, multiplicateur,
                keyDropped: false, userKeys: null,
                duel
            });
        }

    } catch (err) {
        console.error('❌ Erreur Flappy /score :', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

router.post('/start', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    const token = crypto.randomUUID();
    const now = Date.now();

    // Partie de duel : vérifie que le joueur peut encore jouer ce duel
    const duelId = parseInt(req.body && req.body.duelId, 10) || null;
    if (duelId) {
        const manche = duels.commencerManche(duelId, userId, 'flappy');
        if (!manche.ok) {
            return res.status(400).json({ success: false, message: manche.message });
        }
    }

    db.prepare(`
        INSERT OR REPLACE INTO flappy_session (compte_id, token, started_at, used, duel_id)
        VALUES (?, ?, ?, 0, ?)
    `).run(userId, token, now, duelId);

    return res.json({ success: true, token, duelId });
});

// ── GET /actions/flappy/best-score ────────────────────────────────────────
router.get('/best-score', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    try {
        const userData = db.prepare(
            'SELECT flappy_best_score FROM compte WHERE id = ?'
        ).get(userId);

        if (!userData) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
        }

        return res.json({
            success: true,
            meilleurScore: userData.flappy_best_score || 0
        });
    } catch (err) {
        console.error('❌ Erreur Flappy /best-score :', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
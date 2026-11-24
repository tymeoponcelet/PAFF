'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../../config');
const { requireAuth } = require('../middleware/auth');
const checkTime       = require('../middleware/checktime');
const { tryKeyDrop }  = require('../key-drop');

router.use(checkTime);

const MISE_MIN  = 50;
const MISE_MAX  = 1000;
const MAX_BALLS = 10;

const MULTIPLICATEURS = {
    8:  [7, 3, 1.3, 0.6, 0.4, 0.6, 1.3, 3, 7],
    12: [20, 8, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 8, 20],
    16: [50, 25, 10, 5, 4, 2, 1, 0.3, 0.1, 0.3, 1, 2, 4, 5, 10, 25, 50]
};

// ─── LOGIQUE BOULE ────────────────────────────────────────────────────────────
//
// À chaque row r (0-based), la boule est sur le peg d'index `position` dans sa rangée.
// Elle rebondit à gauche (dir=0) ou à droite (dir=1).
// → Le peg touché dans la row r est `position` (AVANT le déplacement).
// → Après rows itérations, slotIndex = somme des directions ∈ [0, rows].
//
function calculerCheminBoule(rows) {
    const path       = [];
    const pegIndices = []; // index du peg touché dans chaque row (0-based dans sa row)
    let position     = 0;

    for (let row = 0; row < rows; row++) {
        const direction = Math.random() < 0.5 ? 0 : 1;
        pegIndices.push(position);   // peg touché = position AVANT déplacement
        path.push(direction);
        position += direction;
    }

    return { path, slotIndex: position, pegIndices };
}

// ─── ROUTE POST /play ─────────────────────────────────────────────────────────
router.post('/play', requireAuth, (req, res) => {
    let { betAmount, ballCount, rows } = req.body;
    const userId = req.session.user.id;

    betAmount = parseInt(betAmount);
    ballCount = parseInt(ballCount);
    rows      = parseInt(rows);

    if (isNaN(betAmount) || betAmount < MISE_MIN || betAmount > MISE_MAX)
        return res.status(400).json({ success: false, message: `Mise entre ${MISE_MIN} et ${MISE_MAX} points` });

    if (isNaN(ballCount) || ballCount < 1 || ballCount > MAX_BALLS)
        return res.status(400).json({ success: false, message: `Entre 1 et ${MAX_BALLS} boules` });

    if (![8, 12, 16].includes(rows))
        return res.status(400).json({ success: false, message: 'Nombre de lignes invalide (8, 12 ou 16)' });

    const totalBet = betAmount * ballCount;

    try {
        const user = db.prepare('SELECT points FROM compte WHERE id = ?').get(userId);

        if (!user)
            return res.status(500).json({ success: false, message: 'Erreur de connexion' });

        if (user.points < totalBet)
            return res.status(400).json({ success: false, message: `Points insuffisants (vous avez ${user.points} pts)` });

        const multiplicateurs = MULTIPLICATEURS[rows];
        const nbSlots         = rows + 1;
        const resultats       = [];
        let totalGain         = 0;

        for (let i = 0; i < ballCount; i++) {
            const { path, slotIndex, pegIndices } = calculerCheminBoule(rows);
            const idx           = Math.max(0, Math.min(slotIndex, nbSlots - 1));
            const multiplicateur = multiplicateurs[idx];
            const gain          = Math.floor(betAmount * multiplicateur);

            totalGain += gain;
            resultats.push({ path, slotIndex: idx, multiplicateur, gain, pegIndices });
        }

        const profit       = totalGain - totalBet;
        const nouveauSolde = user.points - totalBet + totalGain;

        db.prepare('UPDATE compte SET points = ? WHERE id = ?').run(nouveauSolde, userId);
        db.prepare('INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)')
          .run(userId, profit, `Plinko - ${ballCount} boule(s) x${betAmount} pts → ${profit >= 0 ? '+' : ''}${profit} pts`);

        req.session.user.points = nouveauSolde;

        tryKeyDrop(db, userId, totalBet, 'plinko', (errDrop, dropResult) => {
            if (errDrop) dropResult = { dropped: false, userKeys: null };
            return res.json({
                success: true,
                resultats,
                totalBet,
                totalGain,
                profit,
                newPoints:  nouveauSolde,
                keyDropped: dropResult && dropResult.dropped,
                userKeys:   dropResult && dropResult.userKeys
            });
        });

    } catch (err) {
        console.error('❌ [PLINKO] Erreur:', err);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;
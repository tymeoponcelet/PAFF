const express = require('express');
const router = express.Router();
const db = require('../config');

// Miroir exact du POOL côté front
const POOL = [
  { rarity:'common',    icon:'⚙️',  value:50  },
  { rarity:'common',    icon:'🔩',  value:70  },
  { rarity:'common',    icon:'💾',  value:90  },
  { rarity:'common',    icon:'📡',  value:80  },
  { rarity:'common',    icon:'🔋',  value:60  },
  { rarity:'common',    icon:'🖲️',  value:100 },
  { rarity:'common',    icon:'🔌',  value:55  },
  { rarity:'rare',      icon:'💠',  value:160 },
  { rarity:'rare',      icon:'⚡',  value:200 },
  { rarity:'rare',      icon:'🔷',  value:180 },
  { rarity:'rare',      icon:'🌐',  value:240 },
  { rarity:'rare',      icon:'🛡️',  value:290 },
  { rarity:'epic',      icon:'🔮',  value:330 },
  { rarity:'epic',      icon:'🌌',  value:380 },
  { rarity:'epic',      icon:'💜',  value:360 },
  { rarity:'epic',      icon:'🧬',  value:420 },
  { rarity:'legendary', icon:'👑',  value:500 },
  { rarity:'legendary', icon:'💎',  value:480 },
  { rarity:'legendary', icon:'⭐',  value:460 },
  { rarity:'mythic', icon:'☣️', value:3000 },
];

const WEIGHTS = { common:50, rare:30, epic:15, legendary:5, mythic: 0.5 };

function pickWinner() {
  const byRarity = {};
  POOL.forEach(p => { (byRarity[p.rarity] = byRarity[p.rarity] || []).push(p); });
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [rarity, weight] of Object.entries(WEIGHTS)) {
    r -= weight;
    if (r <= 0) {
      const arr = byRarity[rarity];
      return arr[Math.floor(Math.random() * arr.length)];
    }
  }
  return POOL[0];
}

router.post('/', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, message: 'Vous devez être connecté.' });
  }
  const userId = req.session.user.id;
  const qty    = Math.min(Math.max(parseInt(req.body.qty, 10) || 1, 1), 3); // 1–3

  try {
    const openChests = db.transaction((userId, qty) => {
      const user = db.prepare('SELECT points, cles FROM compte WHERE id = ?').get(userId);
      if (!user) throw new Error('NOT_FOUND');
      if ((user.cles ?? 0) < qty) throw new Error('NO_KEYS');

      const winners   = [];
      let   newPoints = user.points;
      let   newKeys   = user.cles ?? 0;

      for (let i = 0; i < qty; i++) {
        const winner = pickWinner();
        winners.push(winner);
        newPoints += winner.value;
        newKeys   -= 1;
        db.prepare('INSERT INTO points_log (compte_id, variation, raison) VALUES (?, ?, ?)')
          .run(userId, winner.value, `Coffre - Ouverture : +${winner.value} pts`);
      }

      db.prepare('UPDATE compte SET points = ?, cles = ? WHERE id = ?')
        .run(newPoints, newKeys, userId);

      return { winners, newPoints, newKeys };
    });

    const result = openChests(userId, qty);
    req.session.user.points = result.newPoints;
    req.session.user.cles   = result.newKeys;

    return res.json({
      success:   true,
      winners:   result.winners,   // tableau (même pour qty=1)
      // rétrocompatibilité : winner = premier élément
      winner:    result.winners[0],
      newPoints: result.newPoints,
      newKeys:   result.newKeys,
    });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Compte introuvable.' });
    if (err.message === 'NO_KEYS')   return res.json({ success: false, message: "Pas assez de clés." });
    return res.status(500).json({ success: false, message: "Erreur lors de l'ouverture du coffre." });
  }
});

module.exports = router;
/**
 * Module de drop de clés : chance d'obtenir une clé quand la mise >= 50 points.
 */

const MIN_BET_FOR_KEY = 50;
const KEY_DROP_CHANCE_PERCENT = 5; // 5 % de chance de drop

/**
 * Tente un drop de clé après une mise.
 * @param {object} db - Instance SQLite
 * @param {number} userId - ID du compte
 * @param {number} betAmount - Montant de la mise (pts)
 * @param {string} gameSource - Nom du jeu (ex: 'blackjack', 'crash')
 * @param {function} callback - (err, { dropped, userKeys }) 
 */
function tryKeyDrop(db, userId, betAmount, gameSource, callback) {
  if (!db || !userId || betAmount < MIN_BET_FOR_KEY) {
    return callback(null, { dropped: false, userKeys: null });
  }

  const roll = Math.random() * 100;
  if (roll >= KEY_DROP_CHANCE_PERCENT) {
    try {
      const row = db.prepare(
        "SELECT cles FROM compte WHERE id = ?"
      ).get(userId);

      return callback(null, {
        dropped: false,
        userKeys: row ? row.cles : 0
      });

    } catch (err) {
      return callback(err, { dropped: false, userKeys: null });
    }
  }


  try {
    db.prepare(
      "UPDATE compte SET cles = COALESCE(cles, 0) + 1 WHERE id = ?"
    ).run(userId);

    const row = db.prepare(
      "SELECT cles FROM compte WHERE id = ?"
    ).get(userId);

    callback(null, {
      dropped: true,
      userKeys: row ? row.cles : 1
    });

  } catch (err) {
    callback(err, { dropped: false, userKeys: null });
  }
}

module.exports = {
  tryKeyDrop,
  MIN_BET_FOR_KEY,
  KEY_DROP_CHANCE_PERCENT
};

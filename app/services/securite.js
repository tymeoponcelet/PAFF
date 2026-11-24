'use strict';

// Outils de sécurité partagés : mots de passe, codes mail, limitation des essais.
const crypto = require('crypto');

const EMAIL_REGEX = /^[a-z]+\.[a-z0-9]+@lyceedelasalle\.fr$/;
const MDP_MIN = 8;
const MDP_MAX = 72;

// ─── Mots de passe (scrypt, intégré à Node.js : aucune dépendance) ───────────
function hacherMotDePasse(motDePasse) {
  const sel = crypto.randomBytes(16);
  const hash = crypto.scryptSync(motDePasse, sel, 64);
  return `scrypt$${sel.toString('hex')}$${hash.toString('hex')}`;
}

function verifierMotDePasse(motDePasse, stocke) {
  if (!stocke || typeof motDePasse !== 'string') return false;
  const [algo, selHex, hashHex] = stocke.split('$');
  if (algo !== 'scrypt' || !selHex || !hashHex) return false;
  const attendu = Buffer.from(hashHex, 'hex');
  const calcule = crypto.scryptSync(motDePasse, Buffer.from(selHex, 'hex'), attendu.length);
  return crypto.timingSafeEqual(attendu, calcule);
}

function validerMotDePasse(motDePasse) {
  if (typeof motDePasse !== 'string' || motDePasse.length < MDP_MIN)
    return `Le mot de passe doit contenir au moins ${MDP_MIN} caractères.`;
  if (motDePasse.length > MDP_MAX)
    return `Le mot de passe ne doit pas dépasser ${MDP_MAX} caractères.`;
  return null;
}

// ─── Codes envoyés par mail ───────────────────────────────────────────────────
function genererCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

// Même format que l'existant : heure de Paris, lisible par new Date()
function expirationDans(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000)
    .toLocaleString('sv-SE', { timeZone: 'Europe/Paris' })
    .replace(' ', 'T');
}

function codeExpire(codeExpiration) {
  if (!codeExpiration) return true;
  const maintenantParis = new Date()
    .toLocaleString('sv-SE', { timeZone: 'Europe/Paris' })
    .replace(' ', 'T');
  return maintenantParis > codeExpiration;
}

function codesEgaux(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ─── Limitation des essais (en mémoire) ───────────────────────────────────────
// Empêche de deviner un mot de passe ou un code à 6 chiffres par essais répétés.
const MAX_ECHECS = 5;
const FENETRE_MS = 15 * 60 * 1000;
const echecs = new Map();

function estBloque(cle) {
  const e = echecs.get(cle);
  if (!e) return false;
  if (Date.now() - e.debut > FENETRE_MS) {
    echecs.delete(cle);
    return false;
  }
  return e.nombre >= MAX_ECHECS;
}

function noterEchec(cle) {
  const e = echecs.get(cle);
  if (!e || Date.now() - e.debut > FENETRE_MS) {
    echecs.set(cle, { nombre: 1, debut: Date.now() });
  } else {
    e.nombre++;
  }
}

function effacerEchecs(cle) {
  echecs.delete(cle);
}

setInterval(() => {
  const maintenant = Date.now();
  for (const [cle, e] of echecs) {
    if (maintenant - e.debut > FENETRE_MS) echecs.delete(cle);
  }
}, FENETRE_MS).unref();

const MESSAGE_BLOCAGE = 'Trop de tentatives. Réessayez dans 15 minutes.';

module.exports = {
  EMAIL_REGEX,
  hacherMotDePasse,
  verifierMotDePasse,
  validerMotDePasse,
  genererCode,
  expirationDans,
  codeExpire,
  codesEgaux,
  estBloque,
  noterEchec,
  effacerEchecs,
  MESSAGE_BLOCAGE,
};

// Central registry of every move, projectile and character. Compiles all definitions lazily on
// first use, so module import order (and the data <-> sim import cycle) never matters.

import { COMMON, compileMove } from './moves.js';
import { CHARACTERS, CHAR_IDS } from './characters/index.js';
import { SCROLLS, SCROLL_PROJECTILES } from './scrolls.js';

export const MOVES = {};
export const PROJECTILES = {};
let ready = false;

const HIT_KEYS = ['dmg', 'level', 'height', 'hitstun', 'blockstun', 'kb', 'launch', 'jc', 'knockdown', 'chip', 'effect',
  'glyph', 'wallBounce', 'groundBounce', 'pull', 'unblockable', 'hitstop', 'sfx'];

function addMove(id, m, owner) {
  if (MOVES[id]) throw new Error(`Duplicate move id: ${id}`);
  m.owner = owner;
  MOVES[id] = compileMove(id, m);
}

function addProj(id, p) {
  if (PROJECTILES[id]) throw new Error(`Duplicate projectile id: ${id}`);
  const hit = {};
  for (const k of HIT_KEYS) if (p[k] !== undefined) hit[k] = p[k];
  const moveDef = compileMove(`proj.${id}`, { kind: p.ultra ? 'ultra' : 'special', hits: [hit], startup: 0, active: 1, recovery: 0 });
  p.id = id;
  p.moveDef = moveDef;
  p.hit = moveDef.hits[0];
  PROJECTILES[id] = p;
}

export function ensureRegistry() {
  if (ready) return;
  ready = true;
  for (const [id, m] of Object.entries(COMMON)) MOVES[id] = m;
  for (const cid of CHAR_IDS) {
    const ch = CHARACTERS[cid];
    for (const [id, m] of Object.entries(ch.moves)) addMove(id, m, cid);
    for (const [id, p] of Object.entries(ch.projectiles || {})) addProj(id, p);
    ch.specials = Object.keys(ch.moves).filter((id) => ch.moves[id].kind !== 'ultra' && !ch.moves[id].hidden);
  }
  for (const [id, m] of Object.entries(SCROLLS)) addMove(id, m, 'scroll');
  for (const [id, p] of Object.entries(SCROLL_PROJECTILES)) addProj(id, p);
}

export function getMove(id) {
  if (!ready) ensureRegistry();
  return MOVES[id];
}

export function getProj(id) {
  if (!ready) ensureRegistry();
  return PROJECTILES[id];
}

export function getChar(id) {
  if (!ready) ensureRegistry();
  return CHARACTERS[id];
}

export { CHARACTERS, CHAR_IDS, SCROLLS };

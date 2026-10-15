// Build validation and resolution. Any build — from localStorage or over the network — is clamped
// into a legal one here, so tampered builds can never exceed the rules.

import { CHARACTERS, CHAR_IDS, SCROLLS, getMove, ensureRegistry } from '../data/registry.js';
import { STANCES } from '../data/stances.js';
import { INNER_ARTS } from '../data/innerArts.js';
import { defaultBuild } from '../data/presets.js';
import { HEADGEAR, AURAS, isColor, sanitizeCry } from '../data/cosmetics.js';

export const BUDGET = 10;
export const SLOTS = ['N', 'F', 'B', 'U', 'D'];
export const STAT_KEYS = ['pow', 'spd', 'def', 'chi'];
export const STAT_MIN = 2;
export const STAT_MAX = 10;
export const FREE_MOVES = 3;
export const BONUS_MAX = 2;
export const BONUS_COST = 2;
export const CHI_PER_GONG = 15;

export function slotOptions(charId) {
  ensureRegistry();
  const ch = CHARACTERS[charId];
  return [...ch.specials, ...Object.keys(SCROLLS)];
}

export function buildCost(b) {
  let cost = 0;
  for (const a of b.arts || []) cost += INNER_ARTS[a]?.cost || 0;
  for (const s of SLOTS) {
    const id = b.slots?.[s];
    if (id && SCROLLS[id]) cost += SCROLLS[id].cost;
  }
  cost += (b.bonusStats || 0) * BONUS_COST;
  return cost;
}

function int(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
}

// Returns a fully-resolved, legal build: { charId, name, stance, arts, slots, ultra, stats, startChi, cost, cos }
export function resolveBuild(input = {}) {
  ensureRegistry();
  const charId = CHAR_IDS.includes(input.charId) ? input.charId : 'longxu';
  const ch = CHARACTERS[charId];
  const base = defaultBuild(charId);
  const b = {
    charId,
    name: String(input.name || base.name).slice(0, 32),
    stance: STANCES[input.stance] ? input.stance : base.stance,
    arts: [],
    slots: {},
    ultra: ch.ultras.includes(input.ultra) ? input.ultra : ch.ultras[0],
    statDelta: {},
    bonusStats: Math.max(0, Math.min(BONUS_MAX, int(input.bonusStats))),
  };
  // inner arts: up to two distinct, valid ids
  for (const a of Array.isArray(input.arts) ? input.arts : []) {
    if (INNER_ARTS[a] && !b.arts.includes(a) && b.arts.length < 2) b.arts.push(a);
  }
  // slots: own specials or scrolls, no duplicates
  const allowed = new Set(slotOptions(charId));
  const used = new Set();
  for (const s of SLOTS) {
    let id = input.slots?.[s];
    if (!id || !allowed.has(id) || used.has(id) || !getMove(id)) id = null;
    b.slots[s] = id;
    if (id) used.add(id);
  }
  for (const s of SLOTS) {
    if (b.slots[s]) continue;
    let id = ch.defaultSlots[s];
    if (used.has(id)) id = ch.specials.find((x) => !used.has(x));
    b.slots[s] = id;
    used.add(id);
  }
  // stats: free moves between stats (sum of positives <= 3 + bonus), each within [2, 10], total = 24 + bonus
  const stats = { ...ch.stats };
  let pos = 0;
  let net = 0;
  for (const k of STAT_KEYS) {
    let d = int(input.statDelta?.[k]);
    d = Math.max(STAT_MIN - stats[k], Math.min(STAT_MAX - stats[k], d));
    if (d > 0) {
      const room = FREE_MOVES + b.bonusStats - pos;
      d = Math.min(d, Math.max(0, room));
      pos += d;
    }
    b.statDelta[k] = d;
    net += d;
  }
  if (net !== b.bonusStats) {
    // invalid distribution: fall back to base stats with no bonus
    for (const k of STAT_KEYS) b.statDelta[k] = 0;
    b.bonusStats = 0;
  }
  for (const k of STAT_KEYS) stats[k] += b.statDelta[k];

  // budget: strip the most expensive optional choices until legal
  let cost = buildCost(b);
  if (cost > BUDGET) {
    for (const s of SLOTS) if (SCROLLS[b.slots[s]]) b.slots[s] = ch.defaultSlots[s];
    cost = buildCost(b);
  }
  if (cost > BUDGET) {
    b.bonusStats = 0;
    for (const k of STAT_KEYS) {
      stats[k] -= b.statDelta[k];
      b.statDelta[k] = 0;
    }
    cost = buildCost(b);
  }
  while (cost > BUDGET && b.arts.length) {
    b.arts.pop();
    cost = buildCost(b);
  }

  const ci = input.cosmetic || input.cos || {};
  const cos = {
    c1: isColor(ci.c1) ? ci.c1 : ch.colors.c1,
    c2: isColor(ci.c2) ? ci.c2 : ch.colors.c2,
    head: HEADGEAR[ci.head] ? ci.head : 'none',
    aura: AURAS.includes(ci.aura) ? ci.aura : AURAS[0],
    cry: sanitizeCry(ci.cry),
  };

  return {
    charId,
    name: b.name,
    stance: b.stance,
    arts: b.arts,
    slots: b.slots,
    ultra: b.ultra,
    statDelta: b.statDelta,
    bonusStats: b.bonusStats,
    stats,
    cost,
    startChi: Math.min(100, Math.max(0, BUDGET - cost) * CHI_PER_GONG),
    cos,
  };
}

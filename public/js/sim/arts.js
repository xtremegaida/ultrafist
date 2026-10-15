// Stance + Inner Art modifiers, merged into one table per fighter, plus the dynamic art hooks.

import { STANCES } from '../data/stances.js';
import { INNER_ARTS } from '../data/innerArts.js';

export const DEFAULT_MODS = {
  heavyDmg: 1, lightDmg: 1, groundHeavyDmg: 1, dmg: 1, dmgTaken: 1,
  heavyReach: 1, crouchReach: 1, airBox: 1,
  lightStartup: 0, cLStartup: 0,
  airJumps: 0, wallJumps: 0, noAirJump: false, fallMult: 1,
  lightChain: 3, counterMult: 1.2,
  guardMult: 1, chipTaken: 1, noChip: false, justDefend: 0,
  dashMult: 1, crossDash: false, walkMult: 1,
  tauntFrames: 50, tauntSpeed: 1, tauntChiMult: 1,
  defDelta: 0, hpMult: 1,
  sHArmor: 0,
  lifesteal: 0, grudge: false, lightEcho: 0, poison: false,
  throwDrain: 0, throwGain: 0,
  awakenThreshold: 0.25, awakenFrames: 600,
};

const MULT = new Set(['heavyDmg', 'lightDmg', 'groundHeavyDmg', 'dmg', 'dmgTaken', 'heavyReach', 'crouchReach', 'airBox',
  'fallMult', 'guardMult', 'chipTaken', 'dashMult', 'walkMult', 'tauntSpeed', 'tauntChiMult', 'hpMult']);
const ADD = new Set(['lightStartup', 'airJumps', 'wallJumps', 'defDelta', 'sHArmor', 'lifesteal', 'throwDrain', 'throwGain', 'lightEcho']);
const OVERRIDE = new Set(['lightChain', 'counterMult', 'tauntFrames', 'cLStartup', 'awakenThreshold', 'awakenFrames', 'justDefend']);

export function buildMods(stanceId, artIds = []) {
  const mods = { ...DEFAULT_MODS };
  const sources = [];
  if (STANCES[stanceId]) sources.push(STANCES[stanceId].mods);
  for (const id of artIds) if (INNER_ARTS[id]) sources.push(INNER_ARTS[id].mods);
  for (const src of sources) {
    for (const [k, v] of Object.entries(src)) {
      if (MULT.has(k)) mods[k] *= v;
      else if (ADD.has(k)) mods[k] += v;
      else if (OVERRIDE.has(k)) mods[k] = v;
      else mods[k] = mods[k] || v;
    }
  }
  return mods;
}

// Damage multiplier for Hundred-Year Grudge (stacks tracked on the fighter).
export function grudgeMult(f) {
  return f.mods.grudge ? 1 + 0.05 * Math.min(4, f.grudge || 0) : 1;
}

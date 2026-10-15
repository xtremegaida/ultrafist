// Public entry point of the pure simulation: createMatch(cfg) and step(state, inputs).
// No DOM, no wall clock, no unseeded randomness: all randomness comes from the seeded RNG in state.

import { RULES } from '../data/rules.js';
import { createFighter } from './fighter.js';
import { feedInput } from './input.js';
import { tickFighter, physics } from './states.js';
import { tickProjectiles } from './projectiles.js';
import { resolveCombat, tickClash, tickCine } from './combat.js';
import { initStage, tickStage } from './stage.js';
import { startRound, tickRounds } from './rounds.js';
import { resolveBuild } from './builds.js';

export const SIM_VERSION = 1;

// cfg: { seed, stageId, builds: [build, build], events: 'off'|'rare'|'normal'|'chaos', timer, wins, training }
export function createMatch(cfg) {
  const c = {
    seed: cfg.seed >>> 0 || 1,
    stageId: cfg.stageId || 'bamboo',
    events: cfg.events || 'normal',
    timer: cfg.timer || RULES.ROUND_TIME,
    wins: cfg.wins || RULES.WINS,
    training: cfg.training || null,
  };
  const builds = cfg.builds.map((b) => resolveBuild(b));
  const s = {
    v: SIM_VERSION,
    cfg: c,
    frame: 0,
    rng: c.seed,
    nextId: 1,
    phase: 'intro',
    phaseT: 0,
    round: 0,
    wins: [0, 0],
    timer: c.timer,
    timerF: c.timer * 60,
    fightFrames: 0,
    nextEventAt: Infinity,
    hitstop: 0,
    freeze: null,
    slow: null,
    cine: null,
    clash: null,
    clashCd: 0,
    heavenly: null,
    suddenDeath: false,
    ko: null,
    winner: null,
    projectiles: [],
    zones: [],
    props: [],
    pickups: [],
    fighters: [createFighter(0, builds[0]), createFighter(1, builds[1])],
    events: [],
    gravityMult: 1,
    dmgMult: 1,
  };
  initStage(s);
  startRound(s);
  return s;
}

// Advance one frame. `inputs` is [byteP1, byteP2].
export function step(s, inputs) {
  const carried = s.events.length && s.frame === 0 ? s.events : [];
  s.events = carried;
  s.frame++;
  const live = s.phase === 'fight';
  const frozen = !!(s.hitstop > 0 || s.freeze || s.cine || (s.slow && s.frame % s.slow.div !== 0));
  for (const f of s.fighters) {
    const byte = live || s.clash ? inputs[f.side] | 0 : 0;
    feedInput(f.inp, byte, f.facing, frozen && !s.clash);
  }

  if (s.clash) {
    tickClash(s);
    return s;
  }
  if (s.freeze) {
    if (--s.freeze.t <= 0) s.freeze = null;
    return s;
  }
  if (s.cine) {
    tickCine(s);
    return s;
  }
  if (s.hitstop > 0) {
    s.hitstop--;
    return s;
  }
  if (s.slow) {
    if (--s.slow.t <= 0) s.slow = null;
    else if (s.frame % s.slow.div !== 0) return s;
  }
  if (s.turtle && (s.frame % 5 === 1 || s.frame % 5 === 3)) return s;
  if (s.clashCd > 0) s.clashCd--;

  if (s.phase !== 'matchEnd') {
    const [a, b] = s.fighters;
    if (s.phase === 'fight' || s.phase === 'ko') {
      tickFighter(s, a, b);
      tickFighter(s, b, a);
    } else {
      for (const f of s.fighters) f.stT++;
    }
    physics(s);
    tickProjectiles(s);
    if (s.phase === 'fight') resolveCombat(s);
    tickStage(s, s.events);
  }
  tickRounds(s);
  return s;
}

export function isOver(s) {
  return s.phase === 'matchEnd';
}

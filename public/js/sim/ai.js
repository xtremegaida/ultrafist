// CPU opponent. Produces the same 1-byte input a human would, so it plays by exactly the same rules.
// Pure and deterministic: its randomness comes from its own seeded RNG (not the match RNG).

import { AI_TIERS } from '../data/aiTiers.js';
import { getMove, getChar } from '../data/registry.js';
import { BTN, dirToBits, motionSequence } from './input.js';
import { rand } from './rng.js';
import { RULES } from '../data/rules.js';

const SLOT_MOTION = { F: 'qcf', B: 'qcb', U: 'dp', D: 'dd', N: 'hcf' };
const SLOT_DIR = { F: 6, B: 4, U: 8, D: 2, N: 5 };

export function createAI(level, side, seed = 1) {
  const lv = Math.max(0, Math.min(AI_TIERS.length - 1, level));
  const tier = { ...AI_TIERS[lv], level: lv };
  return {
    level, side, tier, r: (seed * 2654435761) >>> 0 || 7,
    obs: [], plan: [], next: 0, habits: { jumps: 0, total: 0, wakeAtk: 0, wakes: 0 }, routeStep: -1, route: null, lastHitN: 0, wasStun: false,
    mashT: 0, mashAlt: false,
  };
}

function R(ai) {
  return rand(ai, 'r');
}

function observe(s, o) {
  const def = o.move ? getMove(o.move.id) : null;
  return {
    x: o.x, y: o.y, air: o.air, st: o.st, vx: o.vx, vy: o.vy,
    moveId: o.move?.id || null, moveF: o.move?.f || 0,
    attacking: !!(def && def.hits.length && o.move.f <= def.lastActive && o.st === 'attack'),
    recovering: !!(def && o.st === 'attack' && o.move.f > def.lastActive && def.dur - o.move.f > 6),
    recoverLeft: def && o.st === 'attack' ? def.dur - o.move.f : 0,
    height: def && def.hits.length ? def.hits[0].height : 'mid',
    low: !!(def && def.hits.some((h) => h.height === 'low')),
    overhead: !!(def && (def.hits.some((h) => h.height === 'overhead') || def.air)),
    proj: s.projectiles.filter((p) => p.owner === o.side).map((p) => ({ x: p.x, vx: p.vx })),
  };
}

// queue helpers -------------------------------------------------------------------------------

function d(ai, f, numpad) {
  return dirToBits(numpad, f.facing);
}

function press(ai, bytes) {
  for (const b of bytes) ai.plan.push(b);
}

function special(ai, f, slot, useMotion) {
  if (useMotion && SLOT_MOTION[slot]) {
    const seq = motionSequence(SLOT_MOTION[slot], f.facing);
    const last = seq.pop();
    press(ai, seq);
    press(ai, [last | BTN.SP, last]);
  } else {
    const dir = d(ai, f, SLOT_DIR[slot]);
    press(ai, [dir, dir | BTN.SP, 0]);
  }
}

function ultra(ai, f, useMotion) {
  if (useMotion) {
    const seq = motionSequence('dqcf', f.facing);
    const last = seq.pop();
    press(ai, seq);
    press(ai, [last | BTN.SP, 0]);
  } else press(ai, [BTN.HP | BTN.SP, 0]);
}

function hold(ai, byte, n) {
  for (let i = 0; i < n; i++) ai.plan.push(byte);
}

function slotOf(f, key) {
  const ch = getChar(f.charId);
  const slot = ch.ai?.[key];
  return slot && f.build.slots[slot] ? slot : null;
}

// ---------------------------------------------------------------------------------------------

export function aiInput(ai, s) {
  const f = s.fighters[ai.side];
  const o = s.fighters[1 - ai.side];
  const T = ai.tier;
  ai.obs.push(observe(s, o));
  if (ai.obs.length > 64) ai.obs.shift();
  const ob = ai.obs[Math.max(0, ai.obs.length - 1 - T.react)];

  // habit tracking (tier 5 reads these)
  if (o.st === 'jumpSquat' && o.stT === 0) ai.habits.jumps++;
  if (s.frame % 60 === 0) ai.habits.total++;

  if (s.phase !== 'fight') {
    ai.plan.length = 0;
    return 0;
  }

  // clash: mash!
  if (s.clash) {
    ai.mashT++;
    const every = Math.max(2, Math.round(60 / T.mash));
    if (ai.mashT % every === 0) {
      ai.mashAlt = !ai.mashAlt;
      if (T.level >= 3 && f.chi >= 100 && R(ai) < 0.05) return BTN.LP | BTN.HP;
      return ai.mashAlt ? BTN.LP : BTN.HP;
    }
    return 0;
  }

  if (ai.plan.length) return ai.plan.shift();

  const dist = Math.abs(o.x - f.x);
  const away = d(ai, f, 4);
  const toward = d(ai, f, 6);

  // stunned: maybe burst, otherwise hold block for when we recover
  if (['hitstun', 'blockstun', 'launched', 'guardBroken'].includes(f.st)) {
    if (T.burst && f.chi >= RULES.COST_QI_BURST && f.combo.n >= 5 && f.st !== 'blockstun' && R(ai) < 0.25) {
      return BTN.LP | BTN.SP;
    }
    if (f.st === 'blockstun' && ob.low) return d(ai, f, 1);
    return away;
  }
  if (f.st === 'knockdown') {
    // mash a button sometimes for quick rise
    return R(ai) < 0.3 ? BTN.LP : 0;
  }

  // continue a combo route on hit confirm
  if (f.st === 'attack' && f.move) {
    const m = f.move;
    if (ai.route && m.contact && m.f <= m.contactF + 6) {
      if (!m.hit && T.level < 4) {
        ai.route = null;
        return 0;
      }
      const step = ai.route[++ai.routeStep];
      if (step && !(R(ai) < T.drop)) {
        doStep(ai, f, step, T);
        return ai.plan.length ? ai.plan.shift() : 0;
      }
      ai.route = null;
    }
    // jump-cancel follow-up after a launcher
    return 0;
  }

  if (f.st === 'air') {
    const aerial = (getChar(f.charId).ai?.airborne || 0) >= 0.4;
    if (aerial && f.airJumps > 0 && f.vy > 1 && dist > 160 && R(ai) < 0.08) return BTN.U | d(ai, f, 6);
    if (aerial && f.airDashes > 0 && f.vy > -4 && dist > 220 && R(ai) < 0.06) {
      press(ai, [toward, 0, toward]);
      return ai.plan.shift();
    }
    if (o.air && Math.abs(o.y - f.y) < 120 && dist < 140 && R(ai) < 0.3) return BTN.LP;
    if (!o.air && dist < 150 && f.vy > 0 && R(ai) < 0.25 + T.aggression * 0.2) return BTN.HP;
    const airSlot = Object.entries(f.build.slots).find(([, id]) => {
      const def = getMove(id);
      return def && (def.air || def.airOk);
    });
    if (airSlot && R(ai) < (0.02 + (getChar(f.charId).ai?.airborne || 0) * 0.06) * (1 + T.aggression)) {
      const dir = d(ai, f, SLOT_DIR[airSlot[0]]);
      press(ai, [dir | BTN.SP, 0]);
      return ai.plan.shift();
    }
    return dist > 200 ? toward : 0;
  }

  const neutral = ['idle', 'walk', 'crouch', 'dash', 'landing'].includes(f.st);
  if (!neutral) return 0;

  // ---- DEFEND (reacting to what we saw `react` frames ago)
  const projIncoming = ob.proj.some((p) => Math.abs(p.x - f.x) < 330 && Math.sign(f.x - p.x) === Math.sign(p.vx));
  if ((ob.attacking && Math.abs(ob.x - f.x) < 340) || projIncoming) {
    const tier = getChar(f.charId).ai;
    if (projIncoming && !ob.attacking && R(ai) < T.anti * 0.5) {
      // jump over the projectile
      hold(ai, d(ai, f, 9), 6);
      return ai.plan.shift();
    }
    if (R(ai) < T.block) {
      const blockDir = ob.overhead || ob.air ? away : ob.low ? d(ai, f, 1) : R(ai) < 0.5 ? d(ai, f, 1) : away;
      hold(ai, blockDir, 8 + Math.floor(R(ai) * 6));
      return ai.plan.shift();
    }
    // reversal through pressure
    if (tier?.reversal && T.level >= 3 && R(ai) < 0.12) {
      special(ai, f, tier.reversal, R(ai) < T.motion);
      return ai.plan.shift();
    }
  }

  // ---- ANTI-AIR
  if (ob.air && dist < 260 && Math.sign(ob.vx || 0) !== Math.sign(f.x - o.x) && ob.y < -60) {
    if (R(ai) < T.anti * 0.25) {
      const anti = slotOf(f, 'anti');
      if (anti && R(ai) < 0.6) special(ai, f, anti, R(ai) < T.motion);
      else press(ai, [d(ai, f, 2) | BTN.HP, d(ai, f, 2)]);
      return ai.plan.shift();
    }
  }

  // ---- PUNISH whiffs and unsafe recoveries
  if (ob.recovering && ob.recoverLeft >= 8 && dist < 190 && R(ai) < T.punish * 0.4) {
    if (f.chi >= ultraCostOf(f) && R(ai) < T.ultra * 0.6) {
      ultra(ai, f, R(ai) < T.motion);
      return ai.plan.shift();
    }
    startRoute(ai, f, T);
    return ai.plan.length ? ai.plan.shift() : 0;
  }

  // ---- OKI (opponent knocked down)
  if (o.st === 'knockdown') {
    if (dist > 120) return toward;
    if (o.stT > 30 && R(ai) < 0.1) {
      if (R(ai) < 0.3) press(ai, [BTN.LP | BTN.HP, 0]);
      else press(ai, [d(ai, f, 2) | BTN.LP, 0]);
      return ai.plan.shift();
    }
    return 0;
  }

  // decision cadence
  if (s.frame < ai.next) return ai.lastMove || 0;
  ai.next = s.frame + T.decide + Math.floor(R(ai) * T.decide);

  const prof = getChar(f.charId).ai || {};
  const range = prof.range || 200;

  // ---- ULTRA when it is a good idea
  if (f.chi >= ultraCostOf(f) && R(ai) < T.ultra * 0.12) {
    const def = getMove(f.build.ultra);
    const full = def.hits.some((h) => h.global || Math.abs(h.box?.[2] || 0) > 400);
    const transform = !!def.buff;
    if (full || transform || dist < 160) {
      ultra(ai, f, R(ai) < T.motion);
      return ai.plan.shift();
    }
  }

  // ---- character personality
  if (prof.buff && dist > 350 && R(ai) < 0.12 && (f.char.drunk || 0) < 4) {
    special(ai, f, prof.buff, R(ai) < T.motion);
    return ai.plan.shift();
  }
  if (prof.heal && dist > 380 && f.hp < f.maxHp * 0.6 && R(ai) < 0.15) {
    special(ai, f, prof.heal, R(ai) < T.motion);
    return ai.plan.shift();
  }
  if (prof.setup && s.zones.length === 0 && dist > 260 && R(ai) < 0.12) {
    special(ai, f, prof.setup, R(ai) < T.motion);
    return ai.plan.shift();
  }

  // ---- NEUTRAL
  const r = R(ai);
  const zoner = prof.style === 'zoner';
  if ((prof.airborne || 0) >= 0.4 && dist > 120 && r < prof.airborne * 0.35) {
    hold(ai, d(ai, f, 9), 4);
    return ai.plan.shift();
  }
  const projReady = prof.proj && !s.projectiles.some((p) => p.owner === f.side);
  const pokeDef = prof.poke ? getMove(f.build.slots[prof.poke]) : null;
  const pokeReach = pokeDef ? Math.max(...pokeDef.hits.map((h) => (h.box ? h.box[0] + h.box[2] : 0)), 0) : 0;
  // answer an incoming projectile with our own (clash) or jump it
  if (projIncoming && projReady && dist > 300 && r < 0.35 + (zoner ? 0.3 : 0)) {
    special(ai, f, prof.proj, R(ai) < T.motion);
    return ai.plan.shift();
  }
  if (dist > range + 80) {
    if (projReady && dist > 330 && r < (zoner ? 0.55 : 0.28)) {
      special(ai, f, prof.proj, R(ai) < T.motion);
      return ai.plan.shift();
    }
    if (r < 0.12 + (prof.airborne || 0) * 0.3) {
      hold(ai, d(ai, f, 9), 4);
      return ai.plan.shift();
    }
    if (r < 0.32) {
      press(ai, [toward, 0, toward]);
      hold(ai, toward, 10);
      return ai.plan.shift();
    }
    ai.lastMove = toward;
    return toward;
  }
  // long pokes (beard lash etc.) at their sweet spot
  if (pokeReach > 180 && dist > 150 && dist < pokeReach + 10 && r < 0.12 + (zoner ? 0.1 : 0)) {
    special(ai, f, prof.poke, R(ai) < T.motion);
    return ai.plan.shift();
  }
  if (zoner && dist < range - 60) {
    if (r < 0.25) {
      // back dash out of pressure
      press(ai, [away, 0, away]);
      return ai.plan.shift();
    }
    if (r < 0.55) {
      ai.lastMove = away;
      return away;
    }
  }
  if (dist < 150) {
    if (r < 0.25 * T.aggression + 0.1) {
      startRoute(ai, f, T);
      return ai.plan.length ? ai.plan.shift() : 0;
    }
    if (r < 0.32 && (prof.grab ? true : R(ai) < 0.4)) {
      if (prof.grab && R(ai) < 0.5) special(ai, f, prof.grab, R(ai) < T.motion);
      else press(ai, [BTN.LP | BTN.HP, 0]);
      return ai.plan.shift();
    }
    if (r < 0.4) {
      hold(ai, d(ai, f, 1), 10);
      return ai.plan.shift();
    }
  }
  if (dist < 260 && r < 0.3) {
    const poke = prof.poke && pokeReach >= dist && R(ai) < 0.4 ? prof.poke : null;
    if (poke) special(ai, f, poke, R(ai) < T.motion);
    else press(ai, [BTN.HP, 0]);
    return ai.plan.shift();
  }
  if (r < 0.08 * (1 + (prof.airborne || 0) * 3)) {
    hold(ai, d(ai, f, 9), 4);
    return ai.plan.shift();
  }
  if (T.level <= 1 && r < 0.02) {
    press(ai, [BTN.TA, 0]);
    return ai.plan.shift();
  }
  ai.lastMove = r < 0.5 ? toward : 0;
  return ai.lastMove;
}

function ultraCostOf(f) {
  return f.awakened > 0 ? RULES.COST_ULTRA_AWAKENED : RULES.COST_ULTRA;
}

// Combo routes by tier length.
function startRoute(ai, f, T) {
  const prof = getChar(f.charId).ai || {};
  const ender = prof.ender || 'F';
  const routes = [
    ['cL'],
    ['cL', 'sL'],
    ['cL', 'cL', 'sH'],
    ['cL', 'cL', 'sH', `S:${ender}`],
    ['sL', 'sL', 'sH', `S:${ender}`, 'ULTRA'],
  ];
  const route = routes[Math.min(routes.length - 1, T.combo - 1)];
  ai.route = route;
  ai.routeStep = 0;
  doStep(ai, f, route[0], T);
}

function doStep(ai, f, step, T) {
  if (step === 'cL') press(ai, [d(ai, f, 2) | BTN.LP, d(ai, f, 2)]);
  else if (step === 'sL') press(ai, [BTN.LP, 0]);
  else if (step === 'sH') press(ai, [BTN.HP, 0]);
  else if (step === 'cH') press(ai, [d(ai, f, 2) | BTN.HP, 0]);
  else if (step === 'ULTRA') {
    if (f.chi >= ultraCostOf(f) && R(ai) < T.ultra) ultra(ai, f, R(ai) < T.motion);
  } else if (step.startsWith('S:')) special(ai, f, step.slice(2), R(ai) < T.motion);
}

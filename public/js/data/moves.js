// Common moves shared by every fighter (normals, throws, system moves) plus the move compiler that
// fills in defaults for every move definition in the game.
//
// Box convention: [x, y, w, h] in facing-right local space, origin at the fighter's feet, y up is negative.

import { RULES } from './rules.js';

export const STAND_HURT = [-30, -170, 60, 170];
export const CROUCH_HURT = [-34, -104, 68, 104];
export const AIR_HURT = [-28, -150, 56, 128];
export const DOWN_HURT = [-60, -36, 120, 36];

export const COMMON = {
  sL: {
    name: 'Jab', kind: 'normal', cls: 'light', startup: 4, active: 3, recovery: 7,
    hits: [{ box: [18, -146, 78, 30], dmg: 40 }],
    chain: ['sL', 'cL', 'sH', 'cH'], anim: 'jab', sfx: 'swingLight',
  },
  sH: {
    name: 'Roundhouse', kind: 'normal', cls: 'heavy', startup: 8, active: 4, recovery: 16,
    hits: [{ box: [22, -128, 112, 36], dmg: 90 }],
    chain: [], anim: 'kick', sfx: 'swingHeavy', vel: [{ f: [1, 8], vx: 1.5 }],
  },
  cL: {
    name: 'Shin Tap', kind: 'normal', cls: 'light', crouch: true, startup: 4, active: 2, recovery: 8,
    hits: [{ box: [18, -46, 84, 26], dmg: 35, height: 'low' }],
    chain: ['sL', 'cL', 'sH', 'cH'], anim: 'crouchJab', sfx: 'swingLight',
  },
  cH: {
    name: 'Heaven Sweeper', kind: 'normal', cls: 'heavy', crouch: true, startup: 9, active: 4, recovery: 20,
    hits: [{ box: [12, -196, 74, 120], dmg: 80, launch: [2.5, -14], jc: 3, hitstun: 30 }],
    chain: [], jumpCancel: true, anim: 'uppercut', sfx: 'swingHeavy',
  },
  jL: {
    name: 'Flying Knuckle', kind: 'normal', cls: 'light', air: true, startup: 5, active: 8, recovery: 6,
    hits: [{ box: [8, -96, 72, 42], dmg: 45, height: 'overhead' }],
    chain: ['jL', 'jH'], anim: 'airJab', sfx: 'swingLight',
  },
  jH: {
    name: 'Falling Mountain Kick', kind: 'normal', cls: 'heavy', air: true, startup: 8, active: 8, recovery: 10,
    hits: [{ box: [14, -74, 92, 50], dmg: 85, height: 'overhead', spike: true }],
    chain: [], anim: 'airKick', sfx: 'swingHeavy',
  },
  throw: {
    name: 'Throw', kind: 'throw', startup: RULES.THROW.startup, active: RULES.THROW.active, recovery: RULES.THROW.recovery,
    hits: [{ box: [0, -150, RULES.THROW.range, 120], dmg: RULES.THROW.dmg, grab: true, throwKind: 'normal' }],
    anim: 'grab', sfx: 'throw',
  },
  airThrow: {
    name: 'Air Throw', kind: 'throw', air: true, startup: 4, active: 3, recovery: 14,
    hits: [{ box: [0, -150, 100, 140], dmg: RULES.THROW.airDmg, grab: true, airGrab: true, throwKind: 'normal' }],
    anim: 'grab', sfx: 'throw',
  },
  qiBurst: {
    name: 'Qi Burst', kind: 'system', startup: 6, active: 6, recovery: 14, burst: true,
    inv: [{ f: [1, 22], kind: 'all' }],
    hits: [{ box: [-170, -240, 340, 260], dmg: 0, level: 'heavy', burst: true, launch: [13, -7], jc: 0, unblockable: true, hitstop: 8 }],
    anim: 'burst', glyph: '氣', shout: 'QI BURST!', sfx: 'explode',
  },
  awaken: {
    name: 'Final Awakening', kind: 'system', startup: 1, active: 1, recovery: RULES.AWAKEN_FLASH - 2,
    inv: [{ f: [1, RULES.AWAKEN_FLASH], kind: 'all' }],
    hits: [], anim: 'burst', glyph: '覺醒', shout: 'FINAL AWAKENING!',
  },
  taunt: {
    name: 'Taunt', kind: 'system', dur: RULES.TAUNT_FRAMES, hits: [], anim: 'taunt', taunt: true,
  },
};

// ---------------------------------------------------------------------------------------------
// Move compiler: normalizes a raw move definition in place and returns it.

const LEVEL_OF_KIND = { normal: null, special: 'special', ultra: 'ultra', throw: 'heavy', system: 'heavy' };
const JC_OF_LEVEL = { light: 1, heavy: 2, special: 2, ultra: 1 };

export function compileMove(id, m) {
  if (m._compiled) return m;
  m.id = id;
  m.kind = m.kind || 'special';
  m.hits = m.hits || [];
  const level = m.level || LEVEL_OF_KIND[m.kind] || (m.cls === 'light' ? 'light' : 'heavy');
  if (m.startup == null) m.startup = m.hits.length ? (m.hits[0].f ? m.hits[0].f[0] - 1 : 10) : 0;
  if (m.active == null) m.active = 3;
  if (m.recovery == null) m.recovery = 10;
  if (m.dur == null) {
    m.dur = m.startup + m.active + m.recovery;
    for (const h of m.hits) if (h.f && h.f[1] + m.recovery > m.dur) m.dur = h.f[1] + m.recovery;
  }
  m.hits.forEach((h, i) => {
    h.i = i;
    if (!h.f) h.f = [m.startup + 1, m.startup + m.active];
    h.level = h.level || level;
    h.height = h.height || 'mid';
    if (h.dmg == null) h.dmg = 0;
    if (h.hitstun == null) h.hitstun = RULES.HITSTUN[h.level];
    if (h.blockstun == null) h.blockstun = RULES.BLOCKSTUN[h.level];
    if (h.kb == null) h.kb = RULES.PUSHBACK[h.level];
    if (h.jc == null) h.jc = JC_OF_LEVEL[h.level];
    if (h.chip == null) h.chip = m.kind === 'ultra' ? RULES.CHIP.ultra : m.kind === 'special' ? RULES.CHIP.special : 0;
    if (h.hitstop == null) h.hitstop = RULES.HITSTOP[h.level];
  });
  m.firstActive = m.hits.length ? Math.min(...m.hits.map((h) => h.f[0])) : m.dur + 1;
  m.lastActive = m.hits.length ? Math.max(...m.hits.map((h) => h.f[1])) : 0;
  m.cls = m.cls || (m.kind === 'normal' ? 'heavy' : m.kind);
  m._compiled = true;
  return m;
}

for (const [id, m] of Object.entries(COMMON)) compileMove(id, m);

// Small helpers used by the character files to keep definitions compact.
export const H = (box, dmg, extra = {}) => ({ box, dmg, ...extra });
export const multi = (from, to, every, box, dmg, extra = {}) => ({ f: [from, to], every, box, dmg, ...extra });

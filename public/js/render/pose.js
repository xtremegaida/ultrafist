// Shared humanoid skeleton: pose library, forward kinematics and animation sampling.
//
// Angles are in degrees. Limbs use absolute angles in facing-right space where 0 points straight
// down, 90 points forward and 180 points up. The torso angle `t` is measured from vertical-up
// (positive leans forward). `rot` rotates the whole body around the hip (spins, lying down).

import { getMove, getChar } from '../data/registry.js';

const D = (o) => ({ hx: 0, hy: 0, t: 6, h: 0, aF: [55, 140], aB: [30, 125], lF: [20, -6], lB: [-20, -30], rot: 0, ...o });

export const POSES = {
  ready: D({}),
  ready2: D({ hy: 3, aF: [58, 145], aB: [32, 128] }),
  crouch: D({ t: 18, aF: [70, 140], aB: [40, 130], lF: [78, -12], lB: [15, -78] }),
  squat: D({ t: 16, aF: [40, 110], aB: [20, 100], lF: [55, -30], lB: [30, -50] }),
  jumpUp: D({ t: 0, aF: [130, 165], aB: [110, 150], lF: [75, 5], lB: [-5, -70] }),
  jumpDown: D({ t: 4, aF: [100, 115], aB: [70, 95], lF: [25, 5], lB: [-15, -20] }),
  tuck: D({ t: 30, aF: [60, 140], aB: [50, 130], lF: [110, -10], lB: [100, -20] }),
  dash: D({ t: 32, aF: [-40, 0], aB: [-60, -30], lF: [60, -20], lB: [-45, -70] }),
  backdash: D({ t: -16, aF: [80, 120], aB: [60, 110], lF: [30, 10], lB: [-25, -15] }),
  hit: D({ t: -22, h: -20, aF: [-25, 30], aB: [-45, 10], lF: [12, 0], lB: [-25, -18] }),
  hitLow: D({ t: -10, h: -18, aF: [-10, 40], aB: [-30, 20], lF: [78, -12], lB: [15, -78] }),
  block: D({ t: -4, h: 6, aF: [110, 175], aB: [95, 168], lF: [24, 0], lB: [-24, -24] }),
  crouchBlock: D({ t: 12, h: 6, aF: [115, 178], aB: [100, 170], lF: [78, -12], lB: [15, -78] }),
  launched: D({ t: -40, h: -25, aF: [150, 175], aB: [175, 210], lF: [35, 15], lB: [-10, -25] }),
  down: D({ t: 0, h: 10, aF: [30, 20], aB: [-10, -5], lF: [10, 5], lB: [-5, -5], rot: -88, hy: 0 }),
  dizzy: D({ t: -8, h: 18, aF: [8, 2], aB: [-8, -4], lF: [10, 6], lB: [-12, -8] }),
  grabbed: D({ t: -15, h: -15, aF: [150, 170], aB: [140, 165], lF: [20, 10], lB: [-10, -15] }),
  jabWind: D({ t: 4, aF: [40, 145], aB: [35, 130] }),
  jab: D({ t: 14, aF: [88, 90], aB: [25, 150], lF: [28, -2], lB: [-28, -36] }),
  kickWind: D({ t: -4, aF: [45, 120], aB: [-20, 50], lF: [95, -5], lB: [-10, -14] }),
  kick: D({ t: -22, h: 6, aF: [40, 110], aB: [-50, 20], lF: [98, 96], lB: [-12, -14] }),
  crouchJab: D({ t: 22, aF: [82, 86], aB: [40, 140], lF: [78, -12], lB: [15, -78] }),
  sweep: D({ t: 30, aF: [60, 90], aB: [-60, -20], lF: [95, 92], lB: [40, -80], hy: 30 }),
  uppercutWind: D({ t: 25, aF: [20, 70], aB: [40, 130], lF: [60, -25], lB: [10, -60] }),
  uppercut: D({ t: -8, h: -12, aF: [172, 178], aB: [20, 90], lF: [8, 0], lB: [-30, -15] }),
  airJab: D({ t: 12, aF: [72, 72], aB: [30, 130], lF: [70, 0], lB: [-10, -70] }),
  airKick: D({ t: -10, aF: [70, 130], aB: [-30, 40], lF: [62, 62], lB: [-15, -85] }),
  grab: D({ t: 18, aF: [85, 95], aB: [78, 88], lF: [35, 0], lB: [-30, -38] }),
  throwOver: D({ t: -25, aF: [185, 220], aB: [175, 215], lF: [20, 0], lB: [-25, -20] }),
  burst: D({ t: -6, h: -15, aF: [115, 125], aB: [-115, -125], lF: [32, 30], lB: [-32, -30] }),
  palmWind: D({ t: 0, aF: [-15, 70], aB: [-30, 60], lF: [30, -5], lB: [-25, -30] }),
  palm: D({ t: 16, aF: [90, 96], aB: [86, 92], lF: [45, 0], lB: [-38, -42] }),
  cast: D({ t: -6, h: -12, aF: [140, 165], aB: [125, 155] }),
  flurryA: D({ t: 14, aF: [92, 92], aB: [30, 140], lF: [30, -2], lB: [-30, -38] }),
  flurryB: D({ t: 14, aF: [40, 140], aB: [92, 92], lF: [30, -2], lB: [-30, -38] }),
  flurryKickA: D({ t: -18, aF: [50, 120], aB: [-40, 40], lF: [100, 100], lB: [-12, -14] }),
  flurryKickB: D({ t: -10, aF: [50, 120], aB: [-40, 40], lF: [70, 60], lB: [-12, -14] }),
  spin: D({ t: 0, h: 0, aF: [100, 100], aB: [-100, -100], lF: [8, 4], lB: [-8, -4] }),
  beardWhipWind: D({ t: -15, h: -20, aF: [-20, 40], aB: [-40, 20] }),
  beardWhip: D({ t: 30, h: 30, aF: [-30, 10], aB: [-50, 0], lF: [40, 0], lB: [-35, -40] }),
  beardUp: D({ t: -18, h: -45, aF: [40, 120], aB: [20, 110] }),
  beardStorm: D({ t: 8, h: 20, aF: [120, 130], aB: [-120, -130], lF: [35, 20], lB: [-35, -20] }),
  sleep: D({ t: 25, h: 35, aF: [40, 100], aB: [30, 95], lF: [70, -60], lB: [60, -70] }),
  sit: D({ t: 0, h: -5, aF: [30, 130], aB: [20, 120], lF: [92, -80], lB: [85, -85] }),
  drink: D({ t: -18, h: -28, aF: [115, 205], aB: [30, 90] }),
  flop: D({ t: 0, aF: [170, 175], aB: [160, 170], lF: [5, 0], lB: [-5, 0], rot: 85 }),
  roll: D({ t: 40, h: 30, aF: [60, 150], aB: [50, 140], lF: [120, -40], lB: [110, -50] }),
  charge: D({ t: 42, h: 10, aF: [-10, 50], aB: [-35, 20], lF: [55, -15], lB: [-50, -75] }),
  headbutt: D({ t: 60, h: 25, aF: [-30, 20], aB: [-45, 0], lF: [45, -10], lB: [-50, -65] }),
  pushup: D({ t: 0, h: -10, aF: [178, 178], aB: [100, 120], lF: [0, 0], lB: [10, 0], rot: 90 }),
  lasso: D({ t: -10, h: -20, aF: [160, 200], aB: [40, 110] }),
  bell: D({ t: 0, aF: [40, 150], aB: [35, 150], lF: [78, -12], lB: [15, -78] }),
  prayer: D({ t: 0, h: 5, aF: [55, 158], aB: [55, 158], lF: [20, 0], lB: [-20, -20] }),
  swordThrow: D({ t: 10, aF: [110, 98], aB: [-30, 30], lF: [35, 0], lB: [-30, -38] }),
  sleeve: D({ t: -6, aF: [55, 175], aB: [-40, 30] }),
  slash: D({ t: 22, aF: [100, 50], aB: [-40, 20], lF: [45, 0], lB: [-38, -42] }),
  riseSlash: D({ t: -10, h: -20, aF: [170, 165], aB: [-30, 30], lF: [10, 0], lB: [-30, -60] }),
  diveKick: D({ t: -22, aF: [130, 160], aB: [-60, -20], lF: [48, 46], lB: [-30, -100] }),
  tipStand: D({ t: 0, aF: [100, 105], aB: [-100, -105], lF: [0, 0], lB: [35, -70] }),
  stomp: D({ t: 5, aF: [130, 160], aB: [-130, -160], lF: [10, 8], lB: [-5, -10] }),
  swordConduct: D({ t: -8, h: -25, aF: [176, 180], aB: [-60, -20], lF: [20, 0], lB: [-20, -20] }),
  puppeteer: D({ t: 6, aF: [105, 140], aB: [85, 130] }),
  spit: D({ t: 22, h: 18, aF: [-20, 30], aB: [-40, 20], lF: [35, 0], lB: [-30, -35] }),
  uppercutBig: D({ t: -14, h: -16, aF: [175, 180], aB: [-20, 40], lF: [5, 0], lB: [-30, -70] }),
  surf: D({ t: 10, aF: [110, 110], aB: [-110, -110], lF: [55, -25], lB: [-40, -60] }),
  peck: D({ t: 50, h: 35, aF: [-50, -20], aB: [-70, -30], lF: [30, -5], lB: [-30, -35] }),
  throwEggWind: D({ t: -10, aF: [160, 200], aB: [40, 90] }),
  throwEgg: D({ t: 18, aF: [80, 60], aB: [-30, 30], lF: [35, 0], lB: [-30, -38] }),
  wingFlap: D({ t: -4, aF: [150, 170], aB: [-150, -170] }),
  crow: D({ t: -22, h: -50, aF: [140, 160], aB: [-140, -160], lF: [20, 0], lB: [-20, -20] }),
  wingsUp: D({ t: -8, h: -30, aF: [175, 185], aB: [-175, -185], lF: [25, 15], lB: [-25, -15] }),
  diveFire: D({ t: 70, h: 15, aF: [130, 130], aB: [120, 125], lF: [-30, -40], lB: [-50, -60] }),
  beamWind: D({ t: -5, aF: [20, 80], aB: [10, 70] }),
  beam: D({ t: 10, aF: [90, 90], aB: [86, 88], lF: [40, 0], lB: [-38, -40] }),
  stompUp: D({ t: -10, aF: [120, 150], aB: [-60, -20], lF: [100, -10], lB: [-10, -15] }),
  stompDown: D({ t: 10, aF: [60, 140], aB: [-40, 20], lF: [30, 5], lB: [-25, -20], hy: 8 }),
  cowbell: D({ t: -4, aF: [150, 175], aB: [40, 130] }),
  hornUpWind: D({ t: 45, h: 30, aF: [-20, 40], aB: [-40, 20], lF: [55, -20], lB: [-35, -60] }),
  hornUp: D({ t: -15, h: -35, aF: [-30, 30], aB: [-50, 10], lF: [10, 0], lB: [-30, -25] }),
  chew: D({ t: 4, h: 10, aF: [30, 120], aB: [25, 115] }),
  spinArms: D({ t: 0, aF: [160, 120], aB: [-160, -120] }),
  pour: D({ t: 16, aF: [100, 40], aB: [30, 120] }),
  burrow: D({ t: 60, h: 40, aF: [100, 170], aB: [90, 170], lF: [80, -40], lB: [40, -90], hy: 60 }),
  bellyFlop: D({ t: -55, h: 10, aF: [-60, -20], aB: [-80, -40], lF: [50, 40], lB: [20, 0] }),
  eat: D({ t: -10, h: -10, aF: [120, 200], aB: [110, 195] }),
  scream: D({ t: -18, h: -38, aF: [120, 140], aB: [-120, -140], lF: [28, 0], lB: [-28, -28] }),
  leap: D({ t: -5, h: -20, aF: [170, 180], aB: [160, 175], lF: [60, 0], lB: [-10, -60] }),
  faint: D({ t: 0, h: 0, aF: [5, 5], aB: [-5, -5], lF: [3, 3], lB: [-3, -3], rot: -90 }),
  flex: D({ t: 0, h: -5, aF: [95, 185], aB: [-95, -185], lF: [25, 5], lB: [-25, -15] }),
  bow: D({ t: 35, h: 15, aF: [55, 160], aB: [55, 160], lF: [5, 0], lB: [-5, 0] }),
  win: D({ t: -6, h: -15, aF: [170, 178], aB: [30, 130], lF: [18, 0], lB: [-18, -10] }),
  lose: D({ t: 35, h: 30, aF: [10, 5], aB: [-5, 0], lF: [80, -80], lB: [60, -80] }),
  intro: D({ t: 10, h: 5, aF: [55, 158], aB: [55, 158], lF: [12, 0], lB: [-12, -10] }),
  taunt: D({ t: -10, h: -20, aF: [150, 120], aB: [30, 60] }),
  wallCling: D({ t: -10, aF: [150, 160], aB: [120, 140], lF: [60, -20], lB: [30, -40] }),
  glide: D({ t: 25, aF: [120, 115], aB: [-120, -115], lF: [-10, -20], lB: [-25, -35] }),
};

const KEYS = ['hx', 'hy', 't', 'h', 'rot'];

export function lerpPose(a, b, k) {
  const out = {};
  for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  for (const limb of ['aF', 'aB', 'lF', 'lB']) {
    out[limb] = [a[limb][0] + (b[limb][0] - a[limb][0]) * k, a[limb][1] + (b[limb][1] - a[limb][1]) * k];
  }
  return out;
}

function P(name) {
  return POSES[name] || POSES.ready;
}

function ease(k) {
  return k * k * (3 - 2 * k);
}

function sampleKeys(keys, t) {
  if (t <= keys[0][0]) return P(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, n0] = keys[i - 1];
      const [t1, n1] = keys[i];
      const k = (t - t0) / Math.max(1, t1 - t0);
      return lerpPose(P(n0), P(n1), ease(k));
    }
  }
  return P(keys[keys.length - 1][1]);
}

// Build keyframes for a move from its anim descriptor and frame data.
const keyCache = new Map();
function moveKeys(def) {
  if (keyCache.has(def.id)) return keyCache.get(def.id);
  let keys;
  const a = def.anim;
  if (Array.isArray(a)) keys = a;
  else {
    const name = typeof a === 'string' ? a : 'jab';
    const wind = POSES[name + 'Wind'] ? name + 'Wind' : 'ready';
    const s = Math.max(1, def.startup);
    const act = def.startup + Math.max(1, def.active);
    keys = [[0, 'ready'], [Math.max(1, s * 0.6), wind], [s, name], [act, name], [def.dur, 'ready']];
  }
  keyCache.set(def.id, keys);
  return keys;
}

// Special procedural animations keyed by anim name: (frame, def, base) -> pose
const PROC = {
  spin: (fr, def, p) => ({ ...p, rot: fr >= def.startup ? (fr - def.startup) * 36 : 0 }),
  roll: (fr, def, p) => ({ ...P('roll'), rot: fr * 28, hy: 40 }),
  flurry: (fr) => (Math.floor(fr / 3) % 2 ? P('flurryA') : P('flurryB')),
  flurryKick: (fr) => (Math.floor(fr / 3) % 2 ? P('flurryKickA') : P('flurryKickB')),
  peck: (fr, def) => {
    if (fr < def.startup) return lerpPose(P('ready'), P('peck'), fr / def.startup);
    const k = Math.abs(Math.sin(fr * 1.05));
    return { ...P('peck'), h: 15 + k * 40, t: 40 + k * 20 };
  },
  spinArms: (fr) => ({ ...P('spinArms'), aF: [160 + Math.sin(fr * 0.8) * 60, 120], aB: [-160 + Math.cos(fr * 0.8) * 60, -120] }),
  chew: (fr) => ({ ...P('chew'), h: 10 + Math.sin(fr * 0.6) * 8 }),
  stomp: (fr) => (Math.floor(fr / 4) % 2 ? P('stompUp') : P('stompDown')),
  beardStorm: (fr) => ({ ...P('beardStorm'), rot: Math.sin(fr * 0.3) * 8 }),
  burrowUp: (fr, def) => (fr < def.startup ? P('burrow') : lerpPose(P('burrow'), P('uppercutBig'), Math.min(1, (fr - def.startup) / 4))),
  sleep: (fr) => ({ ...P('sleep'), h: 35 + Math.sin(fr * 0.15) * 5 }),
  surf: (fr) => ({ ...P('surf'), t: 10 + Math.sin(fr * 0.25) * 8 }),
  faint: (fr) => (fr < 6 ? lerpPose(P('ready'), P('faint'), fr / 6) : P('faint')),
  flop: (fr, def) => (fr < 14 ? lerpPose(P('ready'), P('flop'), fr / 14) : fr < def.startup ? P('flop') : { ...P('sweep') }),
  bell: (fr) => P('bell'),
  beam: (fr, def, p) => p,
};

export function animFrameOf(f) {
  return f.move ? f.move.f : 0;
}

// Returns the pose for a fighter view at the current frame.
export function poseFor(f, ex = {}) {
  const st = f.st;
  const T = f.stT || 0;
  switch (st) {
    case 'intro':
      return lerpPose(P('bow'), P('ready'), Math.min(1, Math.max(0, (T - 40) / 30)));
    case 'idle':
    case 'walk': {
      if (f.guarding) return P('block');
      if (st === 'walk' && Math.abs(f.vx) > 0.2) return walkPose(f, T);
      const k = (Math.sin(T * 0.08) + 1) / 2;
      return lerpPose(P('ready'), P('ready2'), k);
    }
    case 'crouch':
      return f.guarding ? P('crouchBlock') : P('crouch');
    case 'dash':
      return f.dashBack ? P('backdash') : f.running ? runPose(T) : P('dash');
    case 'jumpSquat':
    case 'landing':
      return P('squat');
    case 'air': {
      if (f.clinging) return P('wallCling');
      if (ex.glide) return P('glide');
      if (ex.flipT > 0) return { ...P('tuck'), rot: (1 - ex.flipT / 14) * 360 };
      const k = Math.max(0, Math.min(1, (f.vy + 8) / 16));
      return lerpPose(P('jumpUp'), P('jumpDown'), k);
    }
    case 'attack':
      return attackPose(f);
    case 'hitstun':
      return f.crouching ? P('hitLow') : lerpPose(P('hit'), P('ready'), Math.min(1, T / 22) * 0.4);
    case 'blockstun':
      return f.crouching ? P('crouchBlock') : P('block');
    case 'guardBroken':
      return { ...P('dizzy'), t: -8 + Math.sin(T * 0.2) * 10 };
    case 'launched':
    case 'ultraVictim':
      return { ...P('launched'), rot: Math.max(-160, Math.min(0, (f.vy || 0) * 4 - 30)) };
    case 'knockdown':
      return T < 30 || !f.quickRise ? P('down') : lerpPose(P('down'), P('squat'), Math.min(1, (T - 30) / 8));
    case 'ko':
      return f.air ? { ...P('launched'), rot: -60 - T * 8 } : P('down');
    case 'grabbed':
      return P('grabbed');
    case 'win':
      return lerpPose(P('ready'), P(winPoseName(f)), Math.min(1, T / 20));
    case 'lose':
      return lerpPose(P('ready'), P('lose'), Math.min(1, T / 30));
    case 'egg':
      return P('crouch');
    default:
      return P('ready');
  }
}

function winPoseName(f) {
  const ch = getChar(f.charId);
  return ch?.winPose || (f.charId === 'longxu' ? 'bow' : f.charId === 'dazhong' ? 'prayer' : f.charId === 'jidao' ? 'crow' : 'win');
}

function walkPose(f, T) {
  const dir = Math.sign(f.vx) * f.facing;
  const ph = T * 0.22 * dir;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  const base = P('ready');
  return {
    ...base,
    hy: Math.abs(s) * -3,
    lF: [20 + s * 22, -6 + Math.min(0, c) * 30],
    lB: [-20 - s * 22, -30 + Math.max(0, c) * -10],
    aF: [base.aF[0] - s * 8, base.aF[1]],
    aB: [base.aB[0] + s * 8, base.aB[1]],
  };
}

function runPose(T) {
  const s = Math.sin(T * 0.45);
  const p = P('dash');
  return { ...p, lF: [40 + s * 35, -30 - Math.max(0, s) * 40], lB: [-40 - s * 35, -60 + Math.min(0, s) * 40] };
}

function attackPose(f) {
  const m = f.move;
  const def = getMove(m.id);
  if (!def) return P('ready');
  const fr = m.f;
  if (m.id === 'taunt') return tauntPose(f, fr);
  if (def.anim && typeof def.anim === 'string' && PROC[def.anim]) {
    const base = sampleKeys(moveKeys(def), fr);
    return PROC[def.anim](fr, def, base, f);
  }
  if (m.data && m.data.grab) return P('throwOver');
  return sampleKeys(moveKeys(def), fr);
}

function tauntPose(f, fr) {
  const id = f.charId;
  const wob = Math.sin(fr * 0.3);
  switch (id) {
    case 'longxu': return { ...P('prayer'), h: 10 + wob * 4 };
    case 'waiya': return { ...P('sit'), rot: 180, hy: -30 };
    case 'jiugui': return { ...P('drink'), t: -18 + wob * 6 };
    case 'dazhong': return fr % 20 < 10 ? P('cast') : { ...P('cast'), h: 20 };
    case 'jidao': return { ...P('crouch'), h: 30 + wob * 10 };
    case 'moolan': return { ...P('crow'), h: -35 };
    case 'hamfu': return { ...P('down'), rot: -88 + wob * 30 };
    case 'shanyang': return { ...P('chew'), h: 10 + Math.sin(fr * 0.8) * 10 };
    default: return P('taunt');
  }
}

// ---------------------------------------------------------------------------------------------
// Forward kinematics

export const PROPORTIONS = {
  human: { thigh: 40, shin: 40, torso: 56, neck: 6, head: 16, ua: 30, fa: 30, wTorso: 40, wHip: 32, wUa: 15, wFa: 13, wTh: 19, wSh: 16 },
  rooster: { thigh: 30, shin: 34, torso: 56, neck: 10, head: 14, ua: 28, fa: 30, wTorso: 54, wHip: 46, wUa: 16, wFa: 16, wTh: 16, wSh: 7 },
  cow: { thigh: 40, shin: 36, torso: 62, neck: 6, head: 19, ua: 32, fa: 30, wTorso: 54, wHip: 46, wUa: 18, wFa: 16, wTh: 22, wSh: 18 },
  pig: { thigh: 32, shin: 30, torso: 60, neck: 4, head: 19, ua: 28, fa: 26, wTorso: 62, wHip: 56, wUa: 17, wFa: 15, wTh: 21, wSh: 17 },
  goat: { thigh: 42, shin: 40, torso: 54, neck: 8, head: 16, ua: 30, fa: 30, wTorso: 38, wHip: 32, wUa: 14, wFa: 12, wTh: 17, wSh: 13 },
};

function dir(a) {
  const r = (a * Math.PI) / 180;
  return [Math.sin(r), Math.cos(r)];
}

function rotPt(p, c, a) {
  const r = (a * Math.PI) / 180;
  const s = Math.sin(r);
  const co = Math.cos(r);
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * co - dy * s, c[1] + dx * s + dy * co];
}

// Returns joint positions in local facing-right space (feet origin, y down), before facing/scale.
export function solve(pose, prop, grounded = true) {
  const legH = prop.thigh + prop.shin;
  let hip = [pose.hx, -legH * 0.96 + pose.hy];
  const td = [Math.sin((pose.t * Math.PI) / 180), -Math.cos((pose.t * Math.PI) / 180)];
  const chest = [hip[0] + td[0] * prop.torso, hip[1] + td[1] * prop.torso];
  const shoulder = [hip[0] + td[0] * prop.torso * 0.9, hip[1] + td[1] * prop.torso * 0.9];
  const ha = pose.t + pose.h;
  const hd = [Math.sin((ha * Math.PI) / 180), -Math.cos((ha * Math.PI) / 180)];
  const neck = [chest[0] + td[0] * prop.neck, chest[1] + td[1] * prop.neck];
  const head = [neck[0] + hd[0] * prop.head, neck[1] + hd[1] * prop.head];
  const limb = (root, ang, l1, l2) => {
    const d1 = dir(ang[0]);
    const j = [root[0] + d1[0] * l1, root[1] + d1[1] * l1];
    const d2 = dir(ang[1]);
    const e = [j[0] + d2[0] * l2, j[1] + d2[1] * l2];
    return [root, j, e];
  };
  const hipF = [hip[0] + 4, hip[1]];
  const hipB = [hip[0] - 4, hip[1]];
  const shF = [shoulder[0] + td[1] * -3, shoulder[1]];
  const shB = [shoulder[0] - td[1] * -3, shoulder[1]];
  const J = {
    hip, chest, shoulder, neck, head, headAng: ha, torsoAng: pose.t,
    aF: limb(shF, pose.aF, prop.ua, prop.fa),
    aB: limb(shB, pose.aB, prop.ua, prop.fa),
    lF: limb(hipF, pose.lF, prop.thigh, prop.shin),
    lB: limb(hipB, pose.lB, prop.thigh, prop.shin),
  };
  // whole-body rotation around the hip
  if (pose.rot) {
    const c = hip;
    for (const k of ['chest', 'shoulder', 'neck', 'head']) J[k] = rotPt(J[k], c, pose.rot);
    for (const k of ['aF', 'aB', 'lF', 'lB']) J[k] = J[k].map((p) => rotPt(p, c, pose.rot));
    J.headAng += pose.rot;
    J.torsoAng += pose.rot;
  }
  // snap feet to the floor for grounded poses
  if (grounded) {
    let lowest = Math.max(J.lF[2][1], J.lB[2][1], J.lF[1][1], J.lB[1][1]);
    if (Math.abs(pose.rot) > 45) lowest = Math.max(lowest, J.head[1] + prop.head, J.hip[1] + 14, J.chest[1] + 14);
    const dy = -lowest;
    shift(J, 0, dy);
  }
  return J;
}

function shift(J, dx, dy) {
  for (const k of ['hip', 'chest', 'shoulder', 'neck', 'head']) J[k] = [J[k][0] + dx, J[k][1] + dy];
  for (const k of ['aF', 'aB', 'lF', 'lB']) J[k] = J[k].map((p) => [p[0] + dx, p[1] + dy]);
}

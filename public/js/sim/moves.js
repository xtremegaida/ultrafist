// Move runner: starting, ticking, cancelling and ending moves, plus command resolution from the
// input buffer (Ultra > motion special > simple special > throw > taunt > normals).

import { RULES } from '../data/rules.js';
import { getMove, getChar } from '../data/registry.js';
import { chord, consume, slotFromDir, MOTION_SLOT, heldDir, BTN } from './input.js';
import { setState, addBuff, ultraCost, gainChi, chiMult, faceOpponent } from './fighter.js';
import { spawnProjectile } from './projectiles.js';
import { emit, inRange, clamp } from './util.js';

const NORMAL_IDS = new Set(['sL', 'sH', 'cL', 'cH', 'jL', 'jH']);
const LIGHTS = new Set(['sL', 'cL', 'jL']);
const CANCEL_WINDOW = 12;

export function isNormal(id) {
  return NORMAL_IDS.has(id);
}

export function moveCtx(s, f, o) {
  return { s, f, o, m: f.move, def: f.move ? getMove(f.move.id) : null };
}

export function startMove(s, f, o, id, opts = {}) {
  const def = getMove(id);
  if (!def) return false;
  const ctx = { s, f, o, def };
  if (def.canUse && !def.canUse(ctx)) return false;
  if (def.chiCost) {
    if (f.chi < def.chiCost) return false;
    f.chi -= def.chiCost;
  }
  const prev = f.move;
  let start = 0;
  if (LIGHTS.has(id)) start -= f.mods.lightStartup;
  if (id === 'cL' && f.mods.cLStartup) start += Math.max(0, def.startup - f.mods.cLStartup);
  f.move = {
    id,
    f: start,
    hit: false,
    contact: false,
    contactF: 0,
    mask: 0,
    last: {},
    bonus: !!opts.bonus,
    lights: (prev && opts.chain ? prev.lights : 0) + (LIGHTS.has(id) ? 1 : 0),
    armor: def.armor ? def.armor.reduce((n, a) => n + (a.hits || 1), 0) : 0,
    data: {},
    hold: 0,
  };
  if (id === 'sH' && f.mods.sHArmor) f.move.armor += f.mods.sHArmor;
  setState(f, 'attack');
  if (!f.air) {
    f.vx = 0;
    if (!opts.keepFacing) faceOpponent(f, o);
  }
  if (def.groundStart && !f.air) {
    f.vy = def.groundStart.vy;
    f.vx = (def.groundStart.vx || 0) * f.facing;
    f.air = true;
    f.y = -1;
  }
  if (def.kind === 'ultra') {
    s.freeze = { t: RULES.SUPER_FREEZE, by: f.side, id };
    f.stat.ultras++;
    emit(s, { t: 'ultra', side: f.side, id, bonus: !!opts.bonus });
  }
  if (def.kind === 'special') f.stat.specials++;
  if (opts.bonus) f.stat.authentic++;
  emit(s, { t: 'move', side: f.side, id, kind: def.kind, bonus: !!opts.bonus, x: f.x, y: f.y });
  if (def.onStart) def.onStart(moveCtx(s, f, o));
  return true;
}

export function endMove(s, f, o) {
  const m = f.move;
  const def = m ? getMove(m.id) : null;
  if (def) {
    if (def.kind === 'special' && !m.contact) gainChi(f, RULES.CHI_WHIFF_SPECIAL * chiMult(f));
    if (def.onEnd) def.onEnd(moveCtx(s, f, o));
  }
  f.move = null;
  if (f.st !== 'attack') return;
  if (f.air) setState(f, 'air');
  else {
    setState(f, 'idle');
    faceOpponent(f, o);
  }
}

export function tickMove(s, f, o) {
  const m = f.move;
  const def = getMove(m.id);
  m.f++;
  const fr = m.f;
  if (def.vel) {
    for (const v of def.vel) {
      if (!inRange(fr, v.f)) continue;
      if (v.vx != null) f.vx = v.vx * f.facing * (v.scaleSpd ? 1 + 0.05 * (f.stats.spd - 5) : 1);
      if (v.vy != null) {
        f.vy = v.vy;
        if (v.vy < 0 && !f.air) {
          f.air = true;
          f.y = Math.min(f.y, -1);
        }
      }
    }
  } else if (!f.air) f.vx = 0;
  if (def.spawn) {
    for (const sp of def.spawn) if (sp.f === fr) spawnProjectile(s, f, sp.proj, sp, m.bonus);
  }
  if (def.sfx && fr === Math.max(1, def.firstActive - 2)) {
    if (typeof def.sfx === 'string') emit(s, { t: 'sfx', id: def.sfx, x: f.x });
  }
  if (def.sfxAt) for (const e of def.sfxAt) if (e.f === fr) emit(s, { t: 'sfx', id: e.id, x: f.x });
  if (def.teleport && def.teleport.f === fr) {
    const t = def.teleport;
    const side = t.behind ? -o.facing : o.facing;
    f.x = clamp(o.x + side * (t.dist || 70), s.stage.left + RULES.WALL_MARGIN, s.stage.right - RULES.WALL_MARGIN);
    if (t.toGround) {
      f.y = 0;
      f.air = false;
    }
    faceOpponent(f, o);
    emit(s, { t: 'sfx', id: 'teleport', x: f.x });
  }
  if (def.buff && fr === (def.buff.f || 1)) {
    addBuff(f, def.buff.id, def.buff.t, { ...def.buff, f: undefined });
    emit(s, { t: 'buff', side: f.side, id: def.buff.id });
  }
  if (def.gainChi && def.gainChi.f === fr) {
    gainChi(f, def.gainChi.n);
    emit(s, { t: 'chi', side: f.side, n: def.gainChi.n });
  }
  if (def.heal && inRange(fr, def.heal.f)) f.hp = Math.min(f.maxHp, f.hp + def.heal.perFrame);
  if (def.holdCharge) {
    const bit = def.holdCharge.btn === 'hp' ? BTN.HP : BTN.SP;
    if ((f.inp.cur & bit) && m.hold < def.holdCharge.max && fr >= (def.holdCharge.from || 1) && !m.released) {
      m.hold++;
      m.f--; // freeze the move while charging
    } else m.released = true;
  }
  if (def.onFrame) def.onFrame(moveCtx(s, f, o));
  if (f.move === m && m.f >= def.dur && !def.untilLand) endMove(s, f, o);
}

// Active hit windows this frame: [{ h, def }].
export function activeHits(f) {
  const m = f.move;
  if (!m) return [];
  const def = getMove(m.id);
  const out = [];
  for (const h of def.hits) {
    if (m.f < h.f[0] || m.f > h.f[1]) continue;
    if (h.every) {
      const last = m.last[h.i];
      if (last != null && m.f - last < h.every) continue;
    } else if (m.mask & (1 << h.i)) continue;
    if (h.cond && !h.cond({ f, m })) continue;
    out.push(h);
  }
  return out;
}

export function hitBoxScale(f, def) {
  let sx = 1;
  let sy = 1;
  if (NORMAL_IDS.has(def.id) && f.traits.reach) sx *= f.traits.reach;
  if (def.id === 'sH' || def.id === 'cH' || def.id === 'jH') sx *= f.mods.heavyReach;
  if (def.id === 'cL' || def.id === 'cH') sx *= f.mods.crouchReach;
  if (def.id === 'jL' || def.id === 'jH') {
    sx *= f.mods.airBox;
    sy *= f.mods.airBox;
  }
  return [sx, sy];
}

export function inCancelWindow(f) {
  const m = f.move;
  return m && m.contact && m.f <= m.contactF + CANCEL_WINDOW;
}

function canChain(f, nextId) {
  const m = f.move;
  const cur = getMove(m.id);
  if (cur.kind !== 'normal' || !inCancelWindow(f)) return false;
  if (!cur.chain || !cur.chain.includes(nextId)) return false;
  if (LIGHTS.has(nextId) && m.lights >= f.mods.lightChain) return false;
  return true;
}

function specialCancelCost(f, def) {
  const m = f.move;
  const cur = getMove(m.id);
  if (!inCancelWindow(f)) return -1;
  if (cur.kind === 'normal') return 0;
  if (cur.kind === 'special' && def.kind === 'special' && def.id !== cur.id) return RULES.COST_CHI_CANCEL;
  return -1;
}

function canUltraCancel(f) {
  const m = f.move;
  const cur = getMove(m.id);
  return inCancelWindow(f) && (cur.kind === 'normal' || cur.kind === 'special');
}

function pickSpecial(f) {
  const inp = f.inp;
  let slot;
  let bonus = false;
  const ms = inp.spMotion && MOTION_SLOT[inp.spMotion];
  if (ms && ms !== 'ULTRA') {
    slot = ms;
    bonus = true;
  } else slot = slotFromDir(inp.spDir);
  return { slot, bonus, id: f.build.slots[slot] };
}

// ctx: 'neutral' | 'squat' | 'air' | 'cancel' | 'dash'
export function resolveCommands(s, f, o, ctx) {
  const inp = f.inp;
  const air = f.air;

  // 1. Ultra: H+S together, or double-QCF + S (Authentic)
  if (inp.buf.sp > 0) {
    const motionUltra = inp.spMotion === 'dqcf';
    const chordUltra = chord(inp, 'hp', 'sp');
    if ((motionUltra || chordUltra) && f.chi >= ultraCost(f) && (ctx !== 'cancel' || canUltraCancel(f))) {
      const def = getMove(f.build.ultra);
      if (def && (!air || def.air || def.airOk)) {
        consume(inp, 'hp', 'sp');
        f.chi -= ultraCost(f);
        startMove(s, f, o, def.id, { bonus: motionUltra });
        return true;
      }
    }
  }

  // 2/3. Specials (motion = Authentic bonus, otherwise Special + held direction)
  if (inp.buf.sp > 0 && !chord(inp, 'lp', 'sp')) {
    let pick = pickSpecial(f);
    if (ctx === 'squat') pick = { slot: 'U', bonus: pick.bonus && pick.slot === 'U', id: f.build.slots.U };
    let def = pick.id ? getMove(pick.id) : null;
    if (def && air && !(def.air || def.airOk)) {
      // in the air, fall back to any slotted special that works airborne
      const alt = Object.values(f.build.slots).map(getMove).find((d) => d && (d.air || d.airOk));
      def = alt || null;
      pick.bonus = false;
    }
    if (def && !air && def.airOnly) def = null;
    if (def) {
      let cost = 0;
      if (ctx === 'cancel') cost = specialCancelCost(f, def);
      if (cost >= 0 && f.chi >= cost) {
        const prevChi = f.chi;
        f.chi -= cost;
        if (startMove(s, f, o, def.id, { bonus: pick.bonus })) {
          consume(inp, 'sp');
          if (cost > 0) emit(s, { t: 'chiCancel', side: f.side });
          return true;
        }
        f.chi = prevChi;
      }
    }
  }
  if (ctx === 'squat') return false;

  // 4. Throws (L+H together)
  if (ctx !== 'cancel' && chord(inp, 'lp', 'hp')) {
    consume(inp, 'lp', 'hp');
    f.throwBack = (heldDir(inp, f.facing) === 4 || heldDir(inp, f.facing) === 7 || heldDir(inp, f.facing) === 1);
    startMove(s, f, o, air ? 'airThrow' : 'throw', { keepFacing: true });
    return true;
  }

  // 5. Taunt
  if (ctx === 'neutral' && !air && inp.buf.ta > 0) {
    consume(inp, 'ta');
    startMove(s, f, o, 'taunt');
    return true;
  }

  // 6. Normals
  if (inp.buf.lp > 0 || inp.buf.hp > 0) {
    const heavy = inp.buf.hp > 0 && (inp.buf.lp === 0 || inp.at.hp >= inp.at.lp);
    const btn = heavy ? 'hp' : 'lp';
    const down = heldDir(inp, f.facing) <= 3;
    const id = air ? (heavy ? 'jH' : 'jL') : down ? (heavy ? 'cH' : 'cL') : heavy ? 'sH' : 'sL';
    if (ctx === 'cancel' && !canChain(f, id)) return false;
    consume(inp, btn);
    startMove(s, f, o, id, { chain: ctx === 'cancel' });
    return true;
  }
  return false;
}

// Qi Burst: L+S while stunned, costs 2 bars.
export function tryQiBurst(s, f, o) {
  if (f.chi < RULES.COST_QI_BURST || !chord(f.inp, 'lp', 'sp')) return false;
  consume(f.inp, 'lp', 'sp');
  f.chi -= RULES.COST_QI_BURST;
  f.stun = 0;
  f.vy = f.air ? Math.min(f.vy, -3) : 0;
  f.vx = 0;
  f.juggle = 0;
  f.pendingWB = f.pendingGB = false;
  startMove(s, f, o, 'qiBurst');
  emit(s, { t: 'burst', side: f.side, x: f.x, y: f.y });
  return true;
}

// Jump-cancel after a launcher connects.
export function tryJumpCancel(s, f) {
  const m = f.move;
  const def = getMove(m.id);
  if (!def.jumpCancel || !m.hit || !inCancelWindow(f)) return false;
  if (!(f.inp.cur & BTN.U)) return false;
  f.move = null;
  f.jumpDir = heldDir(f.inp, f.facing);
  if (f.jumpDir < 7) f.jumpDir = 8;
  setState(f, 'jumpSquat');
  return true;
}

export function charHook(f, name) {
  const ch = getChar(f.charId);
  return ch.hooks && ch.hooks[name];
}

// Hit detection and resolution: strikes, blocks, chip, guard break, juggles, throws, parries, armor,
// projectiles, clashes (beam struggles / palm clashes) and ultra cinematics.

import { RULES } from '../data/rules.js';
import { getMove, getProj, getChar } from '../data/registry.js';
import { setState, hurtboxes, invulnTo, holdingAway, holdingDown, NEUTRAL, powMult, chiMult, gainChi, getBuff, faceOpponent } from './fighter.js';
import { activeHits, hitBoxScale, startMove } from './moves.js';
import { projBox, reflectProjectile } from './projectiles.js';
import { grudgeMult } from './arts.js';
import { chord, consume, BTN } from './input.js';
import { emit, worldBox, overlap, overlapCenter, clamp, sign, inRange } from './util.js';
import { rand } from './rng.js';

// ---------------------------------------------------------------------------------------------
// Collecting hitboxes

function hitWorldBox(s, f, def, h) {
  if (h.global) {
    // full-screen effects are measured from the floor, spanning the stage
    return { x: s.stage.left, y: h.box[1], w: s.stage.right - s.stage.left, h: h.box[3] };
  }
  const [sx, sy] = hitBoxScale(f, def);
  return worldBox(f, h.box, sx, sy);
}

function collect(s, f) {
  if (!f.move || f.st !== 'attack' || f.move.data.grab) return [];
  const def = getMove(f.move.id);
  return activeHits(f).map((h) => ({ f, h, def, box: hitWorldBox(s, f, def, h) }));
}

function markUsed(f, h) {
  const m = f.move;
  if (!m) return;
  if (h.every) m.last[h.i] = m.f;
  else m.mask |= 1 << h.i;
}

function markContact(f, hit) {
  const m = f.move;
  if (!m) return;
  if (!m.contact) m.contactF = m.f;
  m.contact = true;
  if (hit) m.hit = true;
}

// ---------------------------------------------------------------------------------------------

export function resolveCombat(s) {
  const [a, b] = s.fighters;
  let ha = collect(s, a);
  let hb = collect(s, b);

  // attack vs attack: clinks and clashes
  if (ha.length && hb.length) {
    for (const x of ha) {
      for (const y of hb) {
        if (x.h.grab || y.h.grab || !overlap(x.box, y.box)) continue;
        const xs = x.def.kind === 'special' || x.def.kind === 'ultra';
        const ys = y.def.kind === 'special' || y.def.kind === 'ultra';
        if (xs && ys) {
          if (s.clashCd <= 0 && !x.def.noClash && !y.def.noClash) {
            startClash(s, x.def.kind === 'ultra' && y.def.kind === 'ultra' ? 'ultra' : 'palm', [
              { side: a.side, h: x.h, defId: x.def.id },
              { side: b.side, h: y.h, defId: y.def.id },
            ], overlapCenter(x.box, y.box));
            return;
          }
        } else if (!xs && !ys && x.def.kind === 'normal' && y.def.kind === 'normal') {
          markUsed(a, x.h);
          markUsed(b, y.h);
          markContact(a, false);
          markContact(b, false);
          s.hitstop = Math.max(s.hitstop, RULES.HITSTOP.clink);
          a.push = -5 * a.facing;
          b.push = -5 * b.facing;
          const c = overlapCenter(x.box, y.box);
          emit(s, { t: 'clink', x: c.x, y: c.y });
          ha = ha.filter((q) => q !== x);
          hb = hb.filter((q) => q !== y);
        } else if (xs && !ys) hb = hb.filter((q) => q !== y);
        else if (ys && !xs) ha = ha.filter((q) => q !== x);
      }
    }
  }

  // simultaneous throws tech each other
  const ga = ha.find((x) => x.h.grab && canGrab(b, x.h) && overlap(x.box, hurtboxes(b)[0]));
  const gb = hb.find((x) => x.h.grab && canGrab(a, x.h) && overlap(x.box, hurtboxes(a)[0]));
  if (ga && gb && ga.h.throwKind === 'normal' && gb.h.throwKind === 'normal') {
    techThrow(s, a, b);
    return;
  }

  const results = [];
  for (const x of ha) {
    const r = testHit(s, a, b, x);
    if (r) results.push(r);
  }
  for (const y of hb) {
    const r = testHit(s, b, a, y);
    if (r) results.push(r);
  }
  // capture every attacker's move before applying anything, so same-frame trades both land
  for (const r of results) {
    const m = r.A.move;
    r.bonus = m ? m.bonus : false;
    r.mult = r.x.def.chargeMult && m ? 1 + m.hold * r.x.def.chargeMult : 1;
    r.dir = r.A.facing;
    r.fromX = r.A.x;
  }
  // strikes beat throws when both land on the same frame
  const strikeLanded = results.some((r) => r.type === 'strike');
  for (const r of results) {
    if (r.type === 'grab') {
      if (strikeLanded || !r.A.move || r.A.st !== 'attack' || r.D.st === 'grabbed' || r.A.st === 'grabbed') continue;
      applyGrab(s, r.A, r.D, r.x.h, r.x.def);
    } else {
      resolveStrike(s, r.A, r.D, r.x.h, { def: r.x.def, bonus: r.bonus, point: r.point, fromX: r.fromX, dir: r.dir, mult: r.mult });
    }
  }

  resolveProjectiles(s);
}

function canGrab(D, h) {
  if (invulnTo(D, 'throw')) return false;
  if (h.airGrab) return D.air && D.st !== 'launched';
  if (D.air) return false;
  if (['hitstun', 'blockstun', 'launched', 'knockdown', 'grabbed', 'ultraVictim', 'ko', 'guardBroken'].includes(D.st)) return false;
  return true;
}

function testHit(s, A, D, x) {
  if (x.h.grab) {
    if (!canGrab(D, x.h)) return null;
    const hb = hurtboxes(D)[0];
    if (!overlap(x.box, hb)) return null;
    markUsed(A, x.h);
    return { type: 'grab', A, D, x };
  }
  if (D.st === 'ultraVictim' || D.st === 'grabbed') return null;
  if (invulnTo(D, 'strike')) return null;
  if (x.h.groundOnly && D.air) return null;
  if (x.h.airOnly && !D.air) return null;
  for (const hb of hurtboxes(D)) {
    if (overlap(x.box, hb)) {
      markUsed(A, x.h);
      return { type: 'strike', A, D, x, point: overlapCenter(x.box, hb) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Parry / armor / block / hit

function defenderIntercept(s, A, D, h, src) {
  const hook = getChar(D.charId).hooks?.beforeHit;
  if (hook) {
    const r = hook({ s, f: D, o: A, h, src });
    if (r) return r;
  }
  if (!D.move) return null;
  const def = getMove(D.move.id);
  const type = src.proj ? 'proj' : 'strike';
  if (def.armorStun && def.armor && def.armor.some((w) => inRange(D.move.f, w.f)) && !src.proj && A.move) {
    A.move = null;
    setState(A, 'hitstun');
    A.stun = def.armorStun;
    A.push = -6 * A.facing;
  }
  if (def.parry && inRange(D.move.f, def.parry.f) && (def.parry.vs || ['strike', 'proj']).includes(type) && !h.unblockable) {
    D.move.data.parried = true;
    s.hitstop = Math.max(s.hitstop, 10);
    emit(s, { t: 'parry', side: D.side, x: D.x, y: D.y - 100, glyph: def.parry.glyph || '化' });
    const bonus = D.move.bonus;
    if (def.parry.onParry) def.parry.onParry({ s, f: D, o: A, def, src });
    if (def.parry.then) {
      D.move = null;
      setState(D, 'idle');
      startMove(s, D, A, def.parry.then, { bonus });
    }
    if (!src.proj && A.move && def.parry.stun) {
      A.move = null;
      setState(A, 'hitstun');
      A.stun = def.parry.stun;
    }
    return 'parried';
  }
  if (D.move.armor > 0 && def.armorF && inRange(D.move.f, def.armorF) || (D.move.id === 'sH' && D.move.armor > 0 && D.move.f <= getMove('sH').lastActive)) {
    D.move.armor--;
    return 'armor';
  }
  if (def.armor) {
    for (const w of def.armor) {
      if (inRange(D.move.f, w.f) && D.move.armor > 0) {
        D.move.armor--;
        return 'armor';
      }
    }
  }
  return null;
}

function canBlock(s, D, h, fromX) {
  if (h.unblockable || h.grab) return false;
  if (D.air) return false;
  if (!(NEUTRAL.has(D.st) || D.st === 'blockstun')) return false;
  if (!holdingAway(D, fromX)) return false;
  const crouching = holdingDown(D);
  if (h.height === 'low' && !crouching) return false;
  if (h.height === 'overhead' && crouching) return false;
  return true;
}

export function computeDamage(s, A, D, h, def, src) {
  if (!h.dmg) return 0;
  let mult = powMult(A) * A.mods.dmg * grudgeMult(A);
  if (def.kind === 'normal' && A.traits.normalDmg) mult *= A.traits.normalDmg;
  if (def.id === 'sL' || def.id === 'cL' || def.id === 'jL') mult *= A.mods.lightDmg;
  if (def.id === 'sH' || def.id === 'cH' || def.id === 'jH') {
    mult *= A.mods.heavyDmg;
    if (def.id !== 'jH') mult *= A.mods.groundHeavyDmg;
  }
  if (src.bonus) mult *= RULES.AUTHENTIC_DMG;
  if (A.awakened) mult *= RULES.AWAKEN_DMG;
  for (const b of A.buffs) if (b.dmg) mult *= b.dmg;
  if (A.char.dmgMult) mult *= A.char.dmgMult;
  mult *= s.dmgMult || 1;
  mult *= src.mult || 1;
  if (src.counter) mult *= src.taunt ? RULES.TAUNT_COUNTER_DMG : A.mods.counterMult;
  const n = D.combo.n;
  let scale = n < 2 ? 1 : 1 - RULES.SCALE_STEP * (n - 1);
  scale = Math.max(def.kind === 'ultra' ? RULES.SCALE_FLOOR_ULTRA : RULES.SCALE_FLOOR, scale);
  if ((D.combo.used[def.id] || 0) >= 2) scale *= RULES.REPEAT_PENALTY;
  let taken = D.mods.dmgTaken;
  for (const b of D.buffs) if (b.dmgTaken) taken *= b.dmgTaken;
  return Math.max(1, Math.round(h.dmg * mult * scale * taken));
}

// Entry point for every strike/projectile that touched a hurtbox.
export function resolveStrike(s, A, D, h, src) {
  const def = src.def;
  const icp = defenderIntercept(s, A, D, h, src);
  if (icp === 'parried') {
    if (A.move && !src.proj) markContact(A, false);
    return 'parried';
  }
  if (canBlock(s, D, h, src.fromX ?? A.x) && icp !== 'armor') {
    applyBlock(s, A, D, h, src);
    return 'blocked';
  }
  applyHit(s, A, D, h, src, icp === 'armor');
  return 'hit';
}

function applyBlock(s, A, D, h, src) {
  const def = src.def;
  D.airDashT = 0;
  const jd = D.mods.justDefend > 0 && D.backHeldT != null && D.backHeldT <= D.mods.justDefend;
  setState(D, 'blockstun');
  D.crouching = holdingDown(D);
  D.stun = Math.max(1, h.blockstun - (jd ? 4 : 0));
  const dir = src.dir ?? A.facing;
  D.push = h.kb * dir * (D.traits.noPushback && !src.proj ? 0.3 : 1);
  D.vx = 0;
  // chip
  let chip = 0;
  if (!jd && !D.mods.noChip && h.chip > 0) {
    chip = Math.round(computeDamage(s, A, D, { ...h }, def, src) * h.chip * D.mods.chipTaken);
    if (def.kind !== 'ultra') chip = Math.min(chip, D.hp - 1);
    D.hp = Math.max(0, D.hp - chip);
    if (D.hp <= 0) D.lastHit = { by: A.side, id: def.id, kind: def.kind, ultra: def.kind === 'ultra', chip: true };
  }
  // guard bar
  if (!jd) {
    D.guard -= h.dmg * RULES.GUARD_DRAIN * (def.kind === 'normal' ? 1 : 1.3);
    D.guardT = 0;
  }
  gainChi(D, (jd ? 15 : RULES.CHI_ON_BLOCK) * chiMult(D));
  gainChi(A, RULES.CHI_ON_BLOCKED * chiMult(A));
  s.hitstop = Math.max(s.hitstop, RULES.HITSTOP.block);
  if (A.move && !src.proj) {
    markContact(A, false);
    A.move.blocked = true;
  }
  const p = src.point || { x: D.x, y: D.y - 100 };
  emit(s, { t: 'block', side: D.side, x: p.x, y: p.y, chip, jd, level: h.level });
  if (D.guard <= 0) {
    D.guard = D.guardMax;
    setState(D, 'guardBroken');
    D.stun = RULES.GUARD_BREAK_STUN;
    D.push = 0;
    emit(s, { t: 'guardBreak', side: D.side, x: D.x, y: D.y - 100 });
  }
  if (def.onBlock) def.onBlock({ s, f: A, o: D, h, def });
}

export function applyHit(s, A, D, h, src, armored = false) {
  const def = src.def;
  const dMove = D.move ? getMove(D.move.id) : null;
  const taunt = D.move && D.move.id === 'taunt';
  const counter = !armored && D.st === 'attack' && dMove && (D.move.f < dMove.firstActive || dMove.counterable || taunt);
  const csrc = { ...src, counter, taunt };
  if (s.heavenly?.id === 'decree' && !s.heavenly.used) {
    csrc.counter = true;
    s.heavenly.used = true;
    gainChi(A, 100);
  }
  let dmg = computeDamage(s, A, D, h, def, csrc);
  if (armored) dmg = Math.round(dmg * (dMove?.armorDmg ?? 0.5));

  const wasAir = D.air;
  D.airDashT = 0;
  D.clinging = false;
  D.hp = Math.max(0, D.hp - dmg);
  A.stat.dealt += dmg;

  if (h.cine && !armored && A.move) {
    D.combo.n++;
    D.combo.dmg += dmg;
    gainChi(A, dmg * RULES.CHI_ON_HIT * chiMult(A));
    s.hitstop = Math.max(s.hitstop, 12);
    markContact(A, true);
    const p = src.point || { x: D.x, y: D.y - 100 };
    emit(s, { t: 'hit', a: A.side, d: D.side, x: p.x, y: p.y, dmg, level: 'ultra', combo: D.combo.n, id: def.id, kind: def.kind, glyph: h.glyph || null });
    if (D.hp <= 0) D.hp = 1; // the cinematic decides the KO
    startCine(s, A, D, def);
    return dmg;
  }

  if (!armored) {
    const dir = src.dir ?? (D.x >= A.x ? 1 : -1);
    if (D.move) {
      D.move = null;
    }
    D.guarding = false;
    const launch = h.launch || (wasAir ? [3, -6] : h.knockdown ? [2, -5] : null);
    if (h.burst) {
      setState(D, 'launched');
      D.air = true;
      D.y = Math.min(D.y, -1);
      D.vx = h.launch[0] * dir;
      D.vy = h.launch[1];
      D.juggle = RULES.JUGGLE_LIMIT;
      D.kd = 'soft';
    } else if (launch) {
      if (D.st !== 'launched') D.juggle = 0;
      D.juggle += wasAir ? h.jc : Math.max(1, h.jc);
      setState(D, 'launched');
      D.air = true;
      D.y = Math.min(D.y, -1);
      D.vx = launch[0] * dir;
      D.vy = launch[1];
      if (wasAir && h.spike) {
        D.vy = 13;
        D.vx = 2 * dir;
        if (D.bounces.ground < 1) D.pendingGB = true;
      }
      D.kd = h.knockdown === 'hard' ? 'hard' : 'soft';
    } else {
      D.crouching = D.st === 'crouch' || (D.st === 'hitstun' && D.crouching);
      setState(D, 'hitstun');
      D.stun = h.hitstun + (csrc.counter ? 6 : 0);
      D.push = h.kb * dir;
      D.vx = 0;
    }
    if (h.wallBounce && D.bounces.wall < 1) D.pendingWB = true;
    if (h.groundBounce && D.bounces.ground < 1) D.pendingGB = true;
    if (h.pull) D.push = -h.pull * dir;
  }

  // combo bookkeeping
  if (h.dmg > 0 || !h.burst) {
    D.combo.n++;
    D.combo.dmg += dmg;
    D.combo.used[def.id] = (D.combo.used[def.id] || 0) + 1;
    if (D.combo.n > A.stat.maxCombo) A.stat.maxCombo = D.combo.n;
    if (D.combo.n === 5) {
      if (D.mods.grudge) D.grudge = Math.min(4, (D.grudge || 0) + 1);
      if (A.mods.grudge) A.grudge = 0;
    }
  }
  if (h.burst) D.combo = { n: 0, dmg: 0, used: {} };

  // chi
  gainChi(A, dmg * RULES.CHI_ON_HIT * chiMult(A) * (src.bonus ? RULES.AUTHENTIC_CHI : 1));
  gainChi(D, dmg * RULES.CHI_ON_DAMAGED * chiMult(D));

  // inner arts and buffs
  if (A.mods.lifesteal && (def.kind === 'special' || def.kind === 'ultra')) {
    A.hp = Math.min(A.maxHp, A.hp + Math.round(dmg * A.mods.lifesteal));
  }
  if (A.mods.poison && def.kind === 'special' && !h.noEffects) {
    const p = D.status.poison || { stacks: 0, t: 0, tick: 0 };
    p.stacks = Math.min(3, p.stacks + 1);
    p.t = 300;
    D.status.poison = p;
  }
  let echo = 0;
  if (A.mods.lightEcho && (def.id === 'sL' || def.id === 'cL' || def.id === 'jL')) echo += Math.round(dmg * A.mods.lightEcho);
  const ink = getBuff(A, 'inkClone');
  if (ink && ink.n > 0 && !src.proj && def.kind !== 'ultra' && !h.noEffects) {
    echo += Math.round(dmg * 0.5);
    ink.n--;
    if (ink.n <= 0) ink.t = 0;
  }
  if (echo > 0 && D.hp > 0) {
    D.hp = Math.max(0, D.hp - echo);
    D.combo.n++;
    D.combo.dmg += echo;
    emit(s, { t: 'echo', side: A.side, x: D.x, y: D.y - 110, dmg: echo });
  }
  if (h.effect) applyEffect(s, A, D, h.effect);

  // timing and feedback
  const stop = (h.hitstop || RULES.HITSTOP[h.level]) + (csrc.counter ? RULES.COUNTER_HITSTOP : 0);
  s.hitstop = Math.max(s.hitstop, stop);
  if (A.move && !src.proj) markContact(A, true);
  const p = src.point || { x: D.x, y: D.y - 100 };
  emit(s, {
    t: 'hit', a: A.side, d: D.side, x: p.x, y: p.y, dmg: dmg + echo, level: h.level,
    counter: !!csrc.counter, bonus: !!src.bonus, combo: D.combo.n, id: def.id, kind: def.kind,
    armored, glyph: h.glyph || def.hitGlyph || null, sfx: h.sfx || def.hitSfx || null, proj: !!src.proj,
  });
  D.lastDmg = dmg + echo;
  if (D.hp <= 0) {
    D.lastHit = {
      by: A.side, id: def.id, kind: def.kind, ultra: def.kind === 'ultra',
      up: D.vy < -12, wb: D.pendingWB, burst: !!h.burst,
    };
    const hook = getChar(D.charId).hooks?.beforeKO;
    if (hook && hook({ s, f: D, o: A })) D.lastHit = null;
  }
  if (def.onHit && !src.proj) def.onHit({ s, f: A, o: D, h, def, dmg, counter: csrc.counter });
  if (src.proj && src.pdef?.onHit) src.pdef.onHit({ s, f: A, o: D, p: src.p, dmg });
  const ch = getChar(A.charId);
  if (ch.hooks?.onDealHit) ch.hooks.onDealHit({ s, f: A, o: D, h, def, dmg });
  return dmg;
}

export function applyEffect(s, A, D, e) {
  if (e.slow) D.status.slow = { mult: e.slow.mult, t: e.slow.t };
  if (e.doom) D.status.doom = { t: e.doom.t, dist: 0, steps: e.doom.steps, by: A.side, lastX: D.x };
  if (e.frozen) D.status.frozen = { t: e.frozen };
  if (e.stealChi) {
    const n = Math.min(D.chi, e.stealChi);
    D.chi -= n;
    gainChi(A, n);
  }
  if (e.hat) D.status.hatless = true;
  if (e.stun) D.stun = Math.max(D.stun, e.stun);
  if (e.drunk) D.status.drunk = { t: e.drunk };
}

// ---------------------------------------------------------------------------------------------
// Throws

function applyGrab(s, A, D, h, def) {
  if (D.move) D.move = null;
  setState(D, 'grabbed');
  D.vx = D.vy = 0;
  D.push = 0;
  const seq = def.grabSeq || {};
  const techable = h.throwKind === 'normal';
  D.grab = { by: A.side, t: 0, techable };
  A.move.data.grab = { t: 0, h, seq, back: !!A.throwBack, techable };
  markContact(A, true);
  emit(s, { t: 'grab', side: A.side, id: def.id, x: (A.x + D.x) / 2, y: -100 });
  if (h.cine) startCine(s, A, D, def);
}

function techThrow(s, a, b) {
  for (const f of [a, b]) {
    if (f.move) f.move = null;
    setState(f, 'blockstun');
    f.stun = 14;
    f.push = (f.x < (a.x + b.x) / 2 ? -1 : 1) * 10;
    f.grab = null;
  }
  emit(s, { t: 'tech', x: (a.x + b.x) / 2, y: -110 });
  s.hitstop = Math.max(s.hitstop, 8);
}

// Called every frame for a fighter that is holding someone.
export function tickGrab(s, A, D) {
  const g = A.move.data.grab;
  g.t++;
  const seq = g.seq;
  const techWin = g.techable ? RULES.THROW.tech : 0;
  // hold the victim in front of the thrower
  const hold = seq.hold ? seq.hold(g.t) : [55, 0];
  D.x = clamp(A.x + hold[0] * A.facing, s.stage.left + RULES.WALL_MARGIN, s.stage.right - RULES.WALL_MARGIN);
  D.y = hold[1];
  D.air = D.y < 0;
  if (g.t <= techWin && chord(D.inp, 'lp', 'hp')) {
    consume(D.inp, 'lp', 'hp');
    techThrow(s, A, D);
    return;
  }
  if (seq.hits) {
    for (const sh of seq.hits) {
      if (sh.t === g.t) {
        const dmg = computeDamage(s, A, D, { dmg: sh.dmg }, getMove(A.move.id), { bonus: A.move.bonus });
        D.hp = Math.max(0, D.hp - dmg);
        D.combo.n++;
        D.combo.dmg += dmg;
        s.hitstop = Math.max(s.hitstop, sh.hitstop || 6);
        emit(s, { t: 'hit', a: A.side, d: D.side, x: D.x, y: D.y - 90, dmg, level: sh.level || 'heavy', combo: D.combo.n, id: A.move.id, kind: 'throw', glyph: sh.glyph || null, sfx: sh.sfx || null });
        if (sh.event) emit(s, { t: sh.event, side: A.side });
      }
    }
  }
  const releaseAt = seq.release ?? techWin + 14;
  if (g.t >= releaseAt) releaseGrab(s, A, D, g);
}

function releaseGrab(s, A, D, g) {
  const h = g.h;
  const def = getMove(A.move.id);
  const back = g.back;
  if (back) {
    // swap sides: victim lands behind the thrower
    D.x = clamp(A.x - 60 * A.facing, s.stage.left + RULES.WALL_MARGIN, s.stage.right - RULES.WALL_MARGIN);
    A.facing = -A.facing;
  }
  D.grab = null;
  const launch = g.seq.launch || [6, -10];
  const fakeHit = { ...h, launch, knockdown: 'hard', grab: false, unblockable: true, dmg: g.seq.hits ? (g.seq.finalDmg ?? 0) : h.dmg, hitstop: 10 };
  D.st = 'idle';
  applyHit(s, A, D, fakeHit, { def, bonus: A.move.bonus, dir: A.facing, point: { x: D.x, y: D.y - 90 } });
  if (A.mods.throwDrain && h.throwKind === 'normal') {
    D.chi = Math.max(0, D.chi - A.mods.throwDrain);
    gainChi(A, A.mods.throwGain);
  }
  A.move.data.grab = null;
  if (g.seq.after) g.seq.after({ s, f: A, o: D });
}

// ---------------------------------------------------------------------------------------------
// Projectiles

function resolveProjectiles(s) {
  const ps = s.projectiles;
  // projectile vs projectile
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const p = ps[i];
      const q = ps[j];
      if (p.owner === q.owner || p.hits <= 0 || q.hits <= 0) continue;
      const dp = getProj(p.kind);
      const dq = getProj(q.kind);
      if (dp.noCollide || dq.noCollide) continue;
      const bp = projBox(s, p);
      const bq = projBox(s, q);
      if (!overlap(bp, bq)) continue;
      const c = overlapCenter(bp, bq);
      if (dp.struggle && dq.struggle && s.clashCd <= 0) {
        startClash(s, 'beam', [
          { side: p.owner, proj: p.id },
          { side: q.owner, proj: q.id },
        ], c);
        return;
      }
      const pp = dp.power || 1;
      const pq = dq.power || 1;
      if (pp >= pq) q.hits = 0;
      if (pq >= pp) p.hits = 0;
      if (pp > pq && dp.power) p.data.powerLost = true;
      emit(s, { t: 'clink', x: c.x, y: c.y, proj: true });
    }
  }
  // projectile vs fighters
  for (const p of ps) {
    if (p.hits <= 0) continue;
    const def = getProj(p.kind);
    if (def.harmless) continue;
    const D = s.fighters[1 - p.owner];
    const A = s.fighters[p.owner];
    if (p.t - p.last < (def.every || 1)) continue;
    const box = projBox(s, p);
    // reflect / absorb windows
    if (D.move) {
      const md = getMove(D.move.id);
      if (md.reflect && inRange(D.move.f, md.reflect.f) && def.reflectable !== false) {
        const rb = worldBox(D, md.reflect.box || [-20, -170, 110, 180]);
        if (overlap(rb, box)) {
          reflectProjectile(s, p, D.side);
          continue;
        }
      }
      if (md.absorbProj && inRange(D.move.f, md.absorbProj.f)) {
        const rb = worldBox(D, md.absorbProj.box || [-20, -170, 110, 180]);
        if (overlap(rb, box)) {
          p.hits = 0;
          emit(s, { t: 'absorb', side: D.side, x: p.x, y: p.y });
          if (md.absorbProj.chi) gainChi(D, md.absorbProj.chi);
          continue;
        }
      }
    }
    if (D.st === 'ultraVictim' || D.st === 'grabbed' || invulnTo(D, 'proj')) continue;
    if (def.groundOnly && D.air) continue;
    let hitBox = null;
    for (const hb of hurtboxes(D)) {
      if (overlap(box, hb)) {
        hitBox = hb;
        break;
      }
    }
    if (!hitBox) continue;
    p.last = p.t;
    p.hits--;
    const h = def.hit;
    const res = resolveStrike(s, A, D, h, {
      def: def.moveDef, proj: true, p, pdef: def, bonus: p.bonus, mult: p.mult,
      // beams extend past the defender, so judge blocking from where the beam comes from
      fromX: def.beam ? A.x : p.x, dir: sign(p.vx) || p.facing, point: overlapCenter(box, hitBox),
    });
    if (res !== 'hit' && def.destroyOnBlock !== false && p.hits > 0 && !def.pierce) p.hits = 0;
  }
  s.projectiles = ps.filter((p) => p.hits > 0);
}

// ---------------------------------------------------------------------------------------------
// Clashes: palm clash, beam struggle and the Heaven-Splitting Clash

function startClash(s, kind, parts, at) {
  const t = kind === 'ultra' ? RULES.CLASH.ultra : RULES.CLASH.special;
  s.clash = { kind: kind === 'beam' ? 'beam' : kind, t, max: t, tug: 0, last: [null, null], parts, x: at.x, y: at.y };
  s.clashCd = RULES.CLASH.cooldown;
  emit(s, { t: 'clash', kind: s.clash.kind, x: at.x, y: at.y });
}

export function tickClash(s) {
  const c = s.clash;
  c.t--;
  for (const f of s.fighters) {
    const pr = f.inp.pressed;
    let add = 0;
    if (pr & BTN.LP) {
      add += c.last[f.side] === 'hp' ? 2 : 1;
      c.last[f.side] = 'lp';
    }
    if (pr & BTN.HP) {
      add += c.last[f.side] === 'lp' ? 2 : 1;
      c.last[f.side] = 'hp';
    }
    if (pr & BTN.SP) add += 1;
    if ((pr & BTN.LP) && (pr & BTN.HP) && f.chi >= RULES.CHI_BAR) {
      f.chi -= RULES.CHI_BAR;
      add += RULES.CLASH.surge;
      emit(s, { t: 'surge', side: f.side });
    }
    if (add) {
      c.tug += f.side === 0 ? add : -add;
      emit(s, { t: 'mash', side: f.side, n: add });
    }
  }
  c.tug = clamp(c.tug, -RULES.CLASH.tugMax, RULES.CLASH.tugMax);
  if (Math.abs(c.tug) >= RULES.CLASH.tugMax || c.t <= 0) endClash(s);
}

function endClash(s) {
  const c = s.clash;
  s.clash = null;
  const winner = c.tug > 0 ? 0 : c.tug < 0 ? 1 : -1;
  emit(s, { t: 'clashEnd', winner, kind: c.kind, x: c.x, y: c.y });
  const mult = c.kind === 'ultra' ? RULES.CLASH.ultraWinMult : RULES.CLASH.winMult;
  if (winner < 0) {
    for (const f of s.fighters) {
      if (f.move && !f.move.data.cine) f.move = null;
      setState(f, 'launched');
      f.air = true;
      f.y = Math.min(f.y, -1);
      f.vx = (f.x < c.x ? -1 : 1) * 8;
      f.vy = -6;
      f.juggle = RULES.JUGGLE_LIMIT;
      gainChi(f, RULES.CLASH.tieChi);
    }
    if (c.kind === 'beam') for (const p of s.projectiles) p.hits = 0;
    return;
  }
  const W = s.fighters[winner];
  const L = s.fighters[1 - winner];
  if (c.kind === 'beam') {
    for (const part of c.parts) {
      const p = s.projectiles.find((q) => q.id === part.proj);
      if (!p) continue;
      if (part.side === winner) p.mult *= mult;
      else p.hits = 0;
    }
    return;
  }
  const part = c.parts.find((q) => q.side === winner);
  const def = getMove(part.defId);
  if (L.move) L.move = null;
  setState(L, 'idle');
  applyHit(s, W, L, { ...part.h, unblockable: true }, { def, bonus: W.move ? W.move.bonus : false, mult, dir: W.facing });
}

// ---------------------------------------------------------------------------------------------
// Ultra cinematics: scripted positions + hits after a connector lands

export function startCine(s, A, D, def) {
  const c = def.cine;
  if (D.move) D.move = null;
  setState(D, 'ultraVictim');
  D.vx = D.vy = 0;
  D.push = 0;
  A.move.data.cine = true;
  s.cine = { by: A.side, id: def.id, t: 0, dur: c.dur, x0: A.x, dir: A.facing, bg: c.bg || def.id };
  emit(s, { t: 'cine', side: A.side, id: def.id });
}

function samplePath(path, t) {
  if (!path || !path.length) return null;
  if (t <= path[0][0]) return [path[0][1], path[0][2]];
  for (let i = 1; i < path.length; i++) {
    if (t <= path[i][0]) {
      const [t0, x0, y0] = path[i - 1];
      const [t1, x1, y1] = path[i];
      const k = (t - t0) / Math.max(1, t1 - t0);
      const e = path[i][3] === 'ease' ? k * k * (3 - 2 * k) : k;
      return [x0 + (x1 - x0) * e, y0 + (y1 - y0) * e];
    }
  }
  const last = path[path.length - 1];
  return [last[1], last[2]];
}

export function tickCine(s) {
  const c = s.cine;
  const A = s.fighters[c.by];
  const D = s.fighters[1 - c.by];
  const def = getMove(c.id);
  const cd = def.cine;
  c.t++;
  const lo = s.stage.left + RULES.WALL_MARGIN;
  const hi = s.stage.right - RULES.WALL_MARGIN;
  const pa = samplePath(cd.a, c.t);
  const pv = samplePath(cd.v, c.t);
  // keep the whole scene on stage by shifting the anchor if needed
  if (c.t === 1) {
    const xs = [...(cd.a || []), ...(cd.v || [])].map((k) => c.x0 + k[1] * c.dir);
    const minX = Math.min(...xs, c.x0);
    const maxX = Math.max(...xs, c.x0);
    if (minX < lo) c.x0 += lo - minX;
    if (maxX > hi) c.x0 -= maxX - hi;
  }
  if (pa) {
    A.x = clamp(c.x0 + pa[0] * c.dir, lo, hi);
    A.y = Math.min(0, pa[1]);
    A.air = A.y < 0;
  }
  if (pv) {
    D.x = clamp(c.x0 + pv[0] * c.dir, lo, hi);
    D.y = Math.min(0, pv[1]);
    D.air = D.y < 0;
  }
  if (c.t === 1) faceOpponent(D, A);
  for (const ch of cd.hits || []) {
    if (ch.t !== c.t) continue;
    const dmg = computeDamage(s, A, D, { dmg: ch.dmg }, def, { bonus: A.move?.bonus });
    D.hp = Math.max(0, D.hp - dmg);
    D.combo.n++;
    D.combo.dmg += dmg;
    A.stat.dealt += dmg;
    if (D.combo.n > A.stat.maxCombo) A.stat.maxCombo = D.combo.n;
    gainChi(D, dmg * RULES.CHI_ON_DAMAGED * chiMult(D));
    emit(s, { t: 'hit', a: A.side, d: D.side, x: D.x + (rand(s) - 0.5) * 40, y: D.y - 90 + (rand(s) - 0.5) * 60, dmg, level: 'ultra', combo: D.combo.n, id: def.id, kind: 'ultra', glyph: ch.glyph || null, sfx: ch.sfx || null, cine: true });
  }
  if (cd.events) for (const ev of cd.events) if (ev.t === c.t) emit(s, { ...ev, t: ev.ev, side: A.side });
  if (c.t >= cd.dur) {
    s.cine = null;
    const fin = cd.final || { dmg: 0, launch: [8, -12] };
    A.move.data.cine = false;
    setState(D, 'idle');
    D.air = D.y < 0;
    applyHit(s, A, D, { dmg: fin.dmg, level: 'ultra', launch: fin.launch || [8, -12], knockdown: 'hard', jc: 0, hitstop: RULES.HITSTOP.ultraFinal, hitstun: 30, kb: 0, glyph: fin.glyph || '極', wallBounce: !!fin.wallBounce }, { def, bonus: A.move?.bonus, dir: c.dir, point: { x: D.x, y: D.y - 90 } });
    D.juggle = RULES.JUGGLE_LIMIT;
    if (D.hp <= 0 && D.lastHit) D.lastHit.ultra = true;
    // the attacker recovers immediately after the cinematic
    A.move = null;
    if (A.y < 0) {
      A.air = true;
      setState(A, 'air');
    } else setState(A, 'idle');
  }
}


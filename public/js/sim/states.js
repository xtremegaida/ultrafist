// Per-frame fighter state machine and physics.

import { RULES } from '../data/rules.js';
import { getMove, getChar } from '../data/registry.js';
import { setState, neutralMovement, startDash, tickDash, doJump, airControl, faceOpponent, holdingAway, holdingDown, NEUTRAL, gainChi, pushWidth } from './fighter.js';
import { resolveCommands, tickMove, inCancelWindow, tryJumpCancel, tryQiBurst, startMove, moveCtx } from './moves.js';
import { tickGrab } from './combat.js';
import { BTN } from './input.js';
import { emit, clamp, inRange } from './util.js';

export function endCombo(s, victim) {
  if (victim.combo.n >= 2) {
    emit(s, { t: 'comboEnd', side: 1 - victim.side, n: victim.combo.n, dmg: victim.combo.dmg });
  }
  victim.combo = { n: 0, dmg: 0, used: {} };
  victim.juggle = 0;
  victim.bounces = { wall: 0, ground: 0 };
  victim.pendingWB = false;
  victim.pendingGB = false;
  if (s.cfg.training && victim.hp > 0 && s.cfg.training.refill) victim.hp = victim.maxHp;
}

function recover(s, f, o) {
  if (f.air) setState(f, 'air');
  else setState(f, holdingDown(f) ? 'crouch' : 'idle');
  f.throwProtect = RULES.THROW.protect;
  f.crouching = false;
  faceOpponent(f, o);
  endCombo(s, f);
}

function tickTimers(s, f, o) {
  if (f.inv.t > 0) f.inv.t--;
  if (f.throwProtect > 0) f.throwProtect--;
  if (f.tauntCd > 0) f.tauntCd--;
  if (f.awakened > 0) {
    f.awakened--;
    if (f.awakened === 0) emit(s, { t: 'awakenEnd', side: f.side });
  }
  // buffs
  if (f.buffs.length) {
    for (const b of f.buffs) b.t--;
    const ended = f.buffs.filter((b) => b.t <= 0);
    if (ended.length) {
      f.buffs = f.buffs.filter((b) => b.t > 0);
      for (const b of ended) {
        const hook = getChar(f.charId).hooks?.buffEnd;
        if (hook) hook({ s, f, o, buff: b });
        emit(s, { t: 'buffEnd', side: f.side, id: b.id });
      }
    }
  }
  f.scale = f.size * f.buffs.reduce((m, b) => m * (b.scale || 1), 1);
  // guard regen
  f.guardT++;
  if (f.guardT > RULES.GUARD_REGEN_DELAY && f.guard < f.guardMax) f.guard = Math.min(f.guardMax, f.guard + RULES.GUARD_REGEN);
  // just-defend tracking
  f.backHeldT = holdingAway(f, o.x) ? (f.backHeldT || 0) + 1 : 0;
  // status effects
  const st = f.status;
  if (st.slow && --st.slow.t <= 0) delete st.slow;
  if (st.frozen && --st.frozen.t <= 0) delete st.frozen;
  if (st.poison) {
    st.poison.t--;
    if (++st.poison.tick >= 30) {
      st.poison.tick = 0;
      const dmg = 4 * st.poison.stacks;
      if (f.hp > 1) {
        f.hp = Math.max(1, f.hp - dmg);
        emit(s, { t: 'poison', side: f.side, x: f.x, y: f.y - 150, dmg });
      }
    }
    if (st.poison.t <= 0) delete st.poison;
  }
  if (st.doom) {
    const d = st.doom;
    d.t--;
    if (!f.air) d.dist += Math.abs(f.x - d.lastX);
    d.lastX = f.x;
    if (d.dist >= d.steps * 40 || d.t <= 0) {
      delete st.doom;
      const dmg = Math.round(130 * f.mods.dmgTaken);
      f.hp = Math.max(0, f.hp - dmg);
      if (f.hp <= 0) f.lastHit = { by: o.side, id: 'sevenStep', kind: 'special', burst: false };
      emit(s, { t: 'hit', a: o.side, d: f.side, x: f.x, y: f.y - 100, dmg, level: 'special', combo: 1, id: 'sevenStep', kind: 'special', glyph: '斷魂', doom: true });
      s.hitstop = Math.max(s.hitstop, 14);
    }
  }
  if (st.drunk && --st.drunk.t <= 0) delete st.drunk;
}

function tryAwaken(s, f, o) {
  if (f.awakenUsed || f.hp <= 0 || s.phase !== 'fight' || s.cfg.training) return false;
  if (f.hp >= f.maxHp * f.mods.awakenThreshold) return false;
  f.awakenUsed = true;
  f.awakened = f.mods.awakenFrames;
  gainChi(f, RULES.CHI_BAR);
  startMove(s, f, o, 'awaken');
  if (!o.air && o.st !== 'attack') o.push = (o.x >= f.x ? 1 : -1) * 14;
  emit(s, { t: 'awaken', side: f.side, x: f.x, y: f.y });
  return true;
}

export function tickFighter(s, f, o) {
  tickTimers(s, f, o);
  const ch = getChar(f.charId);
  if (ch.hooks?.perFrame) ch.hooks.perFrame({ s, f, o });
  if (f.status.frozen && (f.st === 'hitstun' || f.st === 'blockstun')) {
    f.stT++;
    return;
  }
  switch (f.st) {
    case 'idle':
    case 'walk':
    case 'crouch':
      if (tryAwaken(s, f, o)) break;
      if (resolveCommands(s, f, o, 'neutral')) break;
      if (f.inp.dash > 0) {
        startDash(s, f);
        break;
      }
      neutralMovement(s, f, o);
      break;
    case 'dash':
      if (!f.dashBack && f.stT > 8 && resolveCommands(s, f, o, 'neutral')) break;
      tickDash(s, f);
      break;
    case 'jumpSquat':
      f.vx = 0;
      if (resolveCommands(s, f, o, 'squat')) break;
      if (f.stT >= RULES.JUMP_SQUAT) doJump(s, f);
      break;
    case 'air':
      if (resolveCommands(s, f, o, 'air')) break;
      airControl(s, f);
      break;
    case 'landing':
      f.vx = 0;
      if (f.stT >= f.landT) {
        setState(f, 'idle');
        faceOpponent(f, o);
        if (resolveCommands(s, f, o, 'neutral')) break;
      }
      break;
    case 'attack':
      if (!f.move) {
        setState(f, f.air ? 'air' : 'idle');
        break;
      }
      if (f.move.data.grab) {
        tickGrab(s, f, o);
        break;
      }
      if (f.move.data.cine) break;
      tickMove(s, f, o);
      if (f.st === 'attack' && f.move && inCancelWindow(f)) {
        if (!tryJumpCancel(s, f)) resolveCommands(s, f, o, 'cancel');
      }
      if (f.move && f.move.id === 'taunt' && f.st === 'attack') tickTaunt(s, f);
      break;
    case 'hitstun':
    case 'blockstun':
      if (tryQiBurst(s, f, o)) break;
      if (--f.stun <= 0) recover(s, f, o);
      break;
    case 'guardBroken':
      if (--f.stun <= 0) recover(s, f, o);
      break;
    case 'launched':
      if (f.juggle < RULES.JUGGLE_LIMIT && f.hp > 0 && tryQiBurst(s, f, o)) break;
      break;
    case 'knockdown':
      if (f.stT < 12 && f.kd === 'soft' && (f.inp.pressed & (BTN.LP | BTN.HP | BTN.SP))) f.quickRise = true;
      if (f.stT >= (f.quickRise ? RULES.QUICK_RISE : f.kd === 'hard' ? RULES.KNOCKDOWN_HARD : RULES.KNOCKDOWN)) {
        setState(f, 'idle');
        f.inv = { t: RULES.WAKE_STRIKE_INV, kind: 'strike' };
        f.throwProtect = RULES.WAKE_THROW_INV;
        faceOpponent(f, o);
        emit(s, { t: 'wakeup', side: f.side, quick: !!f.quickRise });
      }
      break;
    case 'grabbed':
      if (!(o.st === 'attack' && o.move && o.move.data.grab)) {
        f.grab = null;
        if (f.air || f.y < 0) {
          setState(f, 'launched');
          f.air = true;
          f.vx = 0;
          f.vy = -2;
        } else recover(s, f, o);
      }
      break;
    default:
      break;
  }
  f.stT++;
}

function tickTaunt(s, f) {
  const frames = Math.round(f.mods.tauntFrames * f.mods.tauntSpeed);
  if (f.move.f === frames) {
    if (f.tauntCd <= 0) {
      gainChi(f, RULES.CHI_TAUNT * f.mods.tauntChiMult);
      f.tauntCd = RULES.TAUNT_COOLDOWN;
      emit(s, { t: 'chi', side: f.side, n: RULES.CHI_TAUNT * f.mods.tauntChiMult, taunt: true });
    }
    const hook = getChar(f.charId).hooks?.onTaunt;
    if (hook) hook({ s, f, o: s.fighters[1 - f.side] });
  }
  if (f.move.f >= frames) {
    f.move = null;
    setState(f, 'idle');
  }
}

// ---------------------------------------------------------------------------------------------

function land(s, f, o) {
  const impactVy = f.vy;
  f.y = 0;
  f.air = false;
  f.vy = 0;
  f.airDashT = 0;
  f.clinging = false;
  const hook = getChar(f.charId).hooks?.onLand;
  if (hook && (f.st === 'air' || f.st === 'attack') && hook({ s, f, o, impactVy })) return;
  switch (f.st) {
    case 'air':
      setState(f, 'landing');
      f.landT = RULES.LANDING;
      f.vx = 0;
      faceOpponent(f, o);
      emit(s, { t: 'land', side: f.side, x: f.x });
      break;
    case 'attack': {
      const def = getMove(f.move.id);
      if (def.onLand) def.onLand(moveCtx(s, f, o));
      if (f.st === 'attack' && f.move && f.move.id === def.id && (def.air || def.endOnLand || def.untilLand)) {
        const lr = def.landRecovery ?? (f.move.contact ? RULES.LANDING : RULES.LANDING_WHIFF);
        f.move = null;
        setState(f, 'landing');
        f.landT = lr;
        f.vx = 0;
        faceOpponent(f, o);
        emit(s, { t: 'land', side: f.side, x: f.x });
      }
      break;
    }
    case 'launched':
      if (f.pendingGB) {
        f.pendingGB = false;
        f.bounces.ground++;
        f.vy = -11;
        f.vx *= 0.6;
        f.air = true;
        f.y = -1;
        emit(s, { t: 'groundBounce', side: f.side, x: f.x });
        return;
      }
      f.vx = 0;
      if (f.hp <= 0) {
        setState(f, 'ko');
        emit(s, { t: 'knockdown', side: f.side, x: f.x, ko: true });
        return;
      }
      setState(f, 'knockdown');
      f.quickRise = false;
      emit(s, { t: 'knockdown', side: f.side, x: f.x });
      endCombo(s, f);
      break;
    case 'ko':
      f.vx = 0;
      emit(s, { t: 'knockdown', side: f.side, x: f.x, ko: true });
      break;
    case 'hitstun':
    case 'blockstun':
    case 'guardBroken':
      f.vx = 0;
      break;
    default:
      break;
  }
}

export function physics(s) {
  const [a, b] = s.fighters;
  const lo = s.stage.left + RULES.WALL_MARGIN;
  const hi = s.stage.right - RULES.WALL_MARGIN;
  for (const f of s.fighters) {
    const o = s.fighters[1 - f.side];
    if (f.st === 'grabbed' || f.st === 'ultraVictim' || (f.move && f.move.data.grab)) continue;
    if (f.air) {
      let g = RULES.GRAVITY * (s.gravityMult || 1);
      if (f.st === 'launched' || f.st === 'ko') g *= 1 + RULES.JUGGLE_GRAVITY * Math.min(f.juggle, RULES.JUGGLE_LIMIT);
      else if (f.vy > 0) g *= f.mods.fallMult;
      if (f.st === 'air' && (f.clinging || f.airDashT > 0)) g = 0;
      // "to the heavens" KO: the loser keeps flying until they become a twinkling star
      if (f.st === 'ko' && s.ko?.type === 'star' && s.ko.loser === f.side) {
        g = 0;
        if (f.y < -1500) f.vy = 0;
      }
      if (f.move) {
        const def = getMove(f.move.id);
        if (def.float && inRange(f.move.f, def.float)) g = 0;
      }
      f.vy = Math.min(f.vy + g, RULES.MAX_FALL);
      f.y += f.vy;
    }
    const slip = s.slippery?.[f.side];
    f.x += f.vx + f.push;
    f.push *= slip ? 0.93 : 0.8;
    if (Math.abs(f.push) < 0.3) f.push = 0;
    if (f.air && f.y >= 0 && f.vy >= 0) land(s, f, o);
    // flip out of over-long juggles
    if (f.st === 'launched' && f.juggle >= RULES.JUGGLE_LIMIT && f.vy > 2 && f.hp > 0 && !f.pendingGB && f.y < -40) {
      setState(f, 'air');
      f.inv = { t: RULES.FLIPOUT_INV, kind: 'all' };
      f.airJumps = 0;
      f.juggle = 0;
      endCombo(s, f);
      emit(s, { t: 'flip', side: f.side, x: f.x, y: f.y });
    }
    if (f.x < lo || f.x > hi) {
      const wall = f.x < lo ? -1 : 1;
      const over = f.x - clamp(f.x, lo, hi);
      f.x = clamp(f.x, lo, hi);
      if (f.st === 'launched' && f.pendingWB && Math.abs(f.vx) > 2) {
        f.pendingWB = false;
        f.bounces.wall++;
        f.vx = -wall * 6;
        f.vy = -10;
        emit(s, { t: 'wallBounce', side: f.side, x: f.x, y: f.y, wall });
      } else if (f.st === 'launched' || f.st === 'ko') {
        if (Math.abs(f.vx) > 6) emit(s, { t: 'wallSplat', side: f.side, x: f.x, y: f.y, wall });
        f.vx = 0;
      } else {
        // pushback transfers to the attacker when the defender is cornered
        if ((f.st === 'hitstun' || f.st === 'blockstun') && Math.sign(f.push) === wall && o.st === 'attack' && !o.air) {
          o.push = -wall * Math.min(8, Math.abs(f.push) + Math.abs(over));
        }
        if (Math.sign(f.push) === wall) f.push = 0;
        if (Math.sign(f.vx) === wall) f.vx = 0;
      }
    }
  }
  separate(s, a, b, lo, hi);
  // keep the camera able to frame both fighters
  const sep = Math.abs(a.x - b.x);
  if (sep > RULES.MAX_SEPARATION) {
    const excess = sep - RULES.MAX_SEPARATION;
    const left = a.x < b.x ? a : b;
    const right = left === a ? b : a;
    if (left.vx + left.push < 0) left.x += excess;
    else right.x -= excess;
  }
  for (const f of s.fighters) {
    const o = s.fighters[1 - f.side];
    if (!f.air && NEUTRAL.has(f.st)) faceOpponent(f, o);
  }
}

function separate(s, a, b, lo, hi) {
  if (a.st === 'grabbed' || b.st === 'grabbed' || a.st === 'ultraVictim' || b.st === 'ultraVictim') return;
  if (a.st === 'ko' || b.st === 'ko') return;
  if ((a.st === 'dash' && a.mods.crossDash) || (b.st === 'dash' && b.mods.crossDash)) return;
  if (a.move?.data.noPush || b.move?.data.noPush) return;
  const wa = pushWidth(a);
  const wb = pushWidth(b);
  const dx = b.x - a.x;
  const minD = wa + wb;
  if (Math.abs(dx) >= minD) return;
  // vertical overlap of body columns
  const ha = 150 * a.scale;
  const hb = 150 * b.scale;
  if (a.y - ha > b.y || b.y - hb > a.y) return;
  const overlapAmt = minD - Math.abs(dx);
  const dir = dx !== 0 ? Math.sign(dx) : a.facing;
  let pa = overlapAmt / 2;
  let pb = overlapAmt / 2;
  // airborne fighters get pushed instead of grounded ones
  if (a.air && !b.air) {
    pa = overlapAmt;
    pb = 0;
  } else if (b.air && !a.air) {
    pa = 0;
    pb = overlapAmt;
  }
  a.x -= dir * pa;
  b.x += dir * pb;
  // resolve walls: whoever got pushed into the wall hands the overlap to the other
  if (a.x < lo) {
    b.x += lo - a.x;
    a.x = lo;
  } else if (a.x > hi) {
    b.x -= a.x - hi;
    a.x = hi;
  }
  if (b.x < lo) {
    a.x += lo - b.x;
    b.x = lo;
  } else if (b.x > hi) {
    a.x -= b.x - hi;
    b.x = hi;
  }
}


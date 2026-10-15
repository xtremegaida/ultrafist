// Fighter creation, derived stats, hurtboxes and the movement half of the state machine.
// (Attacks live in moves.js, hit resolution in combat.js.)

import { RULES } from '../data/rules.js';
import { STAND_HURT, CROUCH_HURT, AIR_HURT, DOWN_HURT } from '../data/moves.js';
import { getChar, getMove } from '../data/registry.js';
import { createInputState, heldDir, BTN } from './input.js';
import { buildMods } from './arts.js';
import { emit, worldBox, inRange } from './util.js';

export const NEUTRAL = new Set(['idle', 'walk', 'crouch']);
export const STUNNED = new Set(['hitstun', 'blockstun', 'launched', 'guardBroken', 'grabbed', 'ultraVictim']);

export function createFighter(side, build) {
  const ch = getChar(build.charId);
  const mods = buildMods(build.stance, build.arts);
  const stats = { ...build.stats };
  stats.def = Math.max(1, stats.def + mods.defDelta);
  const traits = ch.traits || {};
  const f = {
    side,
    charId: ch.id,
    build,
    mods,
    traits,
    stats,
    size: ch.size || 1,
    scale: ch.size || 1,
    maxHp: Math.round((RULES.HP_BASE + RULES.HP_PER_DEF * stats.def) * mods.hpMult),
    hp: 0,
    chi: Math.min(RULES.CHI_MAX, build.startChi || 0),
    guardMax: Math.round((RULES.GUARD_BASE + RULES.GUARD_PER_DEF * stats.def) * mods.guardMult),
    guard: 0,
    guardT: 999,
    maxAirJumps: Math.max(0, (traits.airJumps ?? 1) + mods.airJumps - (mods.noAirJump ? 1 : 0)),
    maxWallJumps: traits.wallJumps === Infinity ? 999 : (traits.wallJumps ?? 2) + mods.wallJumps,
    x: 0, y: 0, vx: 0, vy: 0, push: 0, facing: 1, air: false,
    st: 'intro', stT: 0, stun: 0, landT: 0,
    move: null,
    juggle: 0, bounces: { wall: 0, ground: 0 }, pendingWB: false, pendingGB: false, kd: 'soft',
    combo: { n: 0, dmg: 0, used: {} },
    lastHit: null,
    inv: { t: 0, kind: null }, throwProtect: 0,
    airJumps: 0, wallJumps: 0, airDashT: 0, airDashes: 0, hoverT: 0, jumpDir: 8,
    grab: null,
    buffs: [],
    status: {},
    awakenUsed: false,
    tauntCd: 0,
    grudge: 0,
    guarding: false,
    char: {},
    inp: createInputState(),
    stat: { dealt: 0, maxCombo: 0, authentic: 0, ultras: 0, specials: 0 },
  };
  f.hp = f.maxHp;
  f.guard = f.guardMax;
  if (ch.hooks?.init) ch.hooks.init(f);
  return f;
}

export function resetForRound(f, x, facing) {
  const ch = getChar(f.charId);
  Object.assign(f, {
    x, y: 0, vx: 0, vy: 0, push: 0, facing, air: false,
    st: 'intro', stT: 0, stun: 0, move: null,
    juggle: 0, bounces: { wall: 0, ground: 0 }, pendingWB: false, pendingGB: false,
    combo: { n: 0, dmg: 0, used: {} }, lastHit: null,
    inv: { t: 0, kind: null }, throwProtect: 0, grab: null,
    buffs: [], status: {}, awakenUsed: false, tauntCd: 0, guarding: false,
    hp: f.maxHp, guard: f.guardMax, guardT: 999, scale: f.size, char: {},
  });
  if (ch.hooks?.init) ch.hooks.init(f);
}

export function setState(f, st) {
  f.st = st;
  f.stT = 0;
}

// ---- derived stats ------------------------------------------------------------------------------

export function hasBuff(f, id) {
  return f.buffs.some((b) => b.id === id);
}

export function getBuff(f, id) {
  return f.buffs.find((b) => b.id === id);
}

export function addBuff(f, id, t, extra = {}) {
  const old = getBuff(f, id);
  if (old) Object.assign(old, { t, ...extra });
  else f.buffs.push({ id, t, ...extra });
}

export function statOf(f, key) {
  let v = f.stats[key];
  for (const b of f.buffs) if (b.stats && b.stats[key]) v += b.stats[key];
  return v;
}

export function powMult(f) {
  return RULES.POW_BASE + RULES.POW_PER * statOf(f, 'pow');
}

export function chiMult(f) {
  return RULES.CHI_BASE + RULES.CHI_PER * statOf(f, 'chi');
}

export function walkSpeed(f, s) {
  let v = (RULES.WALK_BASE + RULES.WALK_PER_SPD * statOf(f, 'spd')) * f.mods.walkMult;
  if (f.status.slow) v *= f.status.slow.mult;
  if (s.zoneSlow?.[f.side]) v *= s.zoneSlow[f.side];
  return v;
}

export function jumpVx(f) {
  return RULES.JUMP_VX_BASE + RULES.JUMP_VX_PER_SPD * statOf(f, 'spd');
}

export function ultraCost(f) {
  return f.awakened ? RULES.COST_ULTRA_AWAKENED : RULES.COST_ULTRA;
}

export function gainChi(f, n) {
  const before = Math.floor(f.chi / RULES.CHI_BAR);
  f.chi = Math.max(0, Math.min(RULES.CHI_MAX, f.chi + n));
  return Math.floor(f.chi / RULES.CHI_BAR) > before;
}

export function isGrounded(f) {
  return !f.air;
}

export function opponentDir(f, o) {
  return o.x >= f.x ? 1 : -1;
}

// Is the fighter holding "away" from the given x position (screen directions, so cross-ups work)?
export function holdingAway(f, fromX) {
  const away = fromX > f.x ? BTN.L : BTN.R;
  const toward = fromX > f.x ? BTN.R : BTN.L;
  return (f.inp.cur & away) !== 0 && (f.inp.cur & toward) === 0;
}

export function holdingDown(f) {
  return (f.inp.cur & BTN.D) !== 0;
}

// ---- invulnerability ---------------------------------------------------------------------------

export function invulnTo(f, type) {
  if (f.st === 'knockdown' || f.st === 'ko' || f.st === 'intro' || f.st === 'win') return true;
  if (f.inv.t > 0 && covers(f.inv.kind, type)) return true;
  if (f.move && f.move.data && f.move.data.grab) return true;
  if (type === 'throw' && f.throwProtect > 0) return true;
  if (f.move) {
    const def = getMove(f.move.id);
    if (def.inv) for (const w of def.inv) if (inRange(f.move.f, w.f) && covers(w.kind, type)) return true;
    if (def.hurtNone && inRange(f.move.f, def.hurtNone)) return true;
  }
  if (f.st === 'dash' && f.dashBack && inRange(f.stT, RULES.DASH_B.inv) && type !== 'throw') return true;
  if (f.st === 'launched' && f.juggle >= RULES.JUGGLE_LIMIT) return true;
  return false;
}

function covers(kind, type) {
  if (kind === 'all') return true;
  if (kind === 'strike') return type === 'strike' || type === 'proj';
  return kind === type;
}

// ---- hurtboxes ---------------------------------------------------------------------------------

export function hurtboxes(f) {
  if (f.st === 'knockdown' || f.st === 'ko') return [worldBox(f, DOWN_HURT)];
  let base = STAND_HURT;
  const def = f.move ? getMove(f.move.id) : null;
  if (f.air) base = AIR_HURT;
  else if (f.st === 'crouch' || (f.st === 'blockstun' && f.crouching) || (f.st === 'hitstun' && f.crouching)) base = CROUCH_HURT;
  else if (def && (def.crouch || (def.lowProfile && inRange(f.move.f, def.lowProfile)))) base = CROUCH_HURT;
  if (f.st === 'egg') base = [-34, -70, 68, 70];
  const sz = f.traits.hurtScale || 1;
  const boxes = [worldBox(f, base, sz, sz)];
  if (def && f.move) {
    for (const h of def.hits) {
      if (h.grab || h.noHurt || !h.box) continue;
      if (f.move.f >= h.f[0] && f.move.f <= h.f[1] + 6) {
        const b = h.box;
        if (Math.abs(b[2]) > 400) continue; // full-screen effects are not limbs
        boxes.push(worldBox(f, [b[0] + b[2] * 0.15, b[1] + b[3] * 0.1, b[2] * 0.75, b[3] * 0.8]));
      }
    }
    if (def.hurtExt) for (const e of def.hurtExt) if (inRange(f.move.f, e.f)) boxes.push(worldBox(f, e.box));
  }
  return boxes;
}

export function pushWidth(f) {
  return 26 * (f.scale || 1) * (f.traits.pushScale || 1);
}

// ---- movement states ---------------------------------------------------------------------------

export function threatNear(s, f, o) {
  if (o.move) {
    const def = getMove(o.move.id);
    if (o.move.f <= def.lastActive && def.hits.length && Math.abs(o.x - f.x) < RULES.PROXIMITY_GUARD) return true;
  }
  for (const p of s.projectiles) {
    if (p.owner !== f.side && Math.abs(p.x - f.x) < 280 && Math.sign(f.x - p.x) === Math.sign(p.vx || 1)) return true;
  }
  return false;
}

export function neutralMovement(s, f, o) {
  const d = heldDir(f.inp, f.facing);
  f.guarding = false;
  if (d >= 7) {
    f.jumpDir = d;
    setState(f, 'jumpSquat');
    f.vx = 0;
    return;
  }
  if (d <= 3) {
    if (f.st !== 'crouch') setState(f, 'crouch');
    f.vx = 0;
    f.guarding = d === 1;
    return;
  }
  if (d === 6) {
    if (f.st !== 'walk') setState(f, 'walk');
    f.vx = walkSpeed(f, s) * f.facing;
    f.chi = Math.min(RULES.CHI_MAX, f.chi + RULES.CHI_WALK * chiMult(f));
    f.walkDir = 1;
    return;
  }
  if (d === 4) {
    if (threatNear(s, f, o)) {
      if (f.st !== 'idle') setState(f, 'idle');
      f.vx = 0;
      f.guarding = true;
      return;
    }
    if (f.st !== 'walk') setState(f, 'walk');
    f.vx = -walkSpeed(f, s) * RULES.WALK_BACK_MULT * f.facing;
    f.walkDir = -1;
    return;
  }
  if (f.st !== 'idle') setState(f, 'idle');
  f.vx = 0;
}

export function startDash(s, f) {
  const fwd = f.inp.dashDir === f.facing;
  f.inp.dash = 0;
  setState(f, 'dash');
  f.dashBack = !fwd;
  f.running = false;
  const d = fwd ? RULES.DASH_F : RULES.DASH_B;
  const frames = d.frames;
  f.dashFrames = frames;
  f.dashV = ((d.dist / frames) * (fwd ? 1 : -1) * f.facing * f.mods.dashMult) * (f.traits.dashMult || 1) * (s.stage?.dashMult || 1);
  emit(s, { t: 'dash', side: f.side, back: !fwd });
}

export function tickDash(s, f) {
  const p = f.stT / f.dashFrames;
  f.vx = f.dashV * (1.5 - p) * (s.zoneFriction?.[f.side] === 0 ? 1.15 : 1);
  if (f.traits.teleDash && f.stT === 3) {
    // Long Xu's afterimage shuffle: blink most of the distance at once
    f.x += f.dashV * f.dashFrames * 0.5;
  }
  if (f.stT >= f.dashFrames) {
    const d = heldDir(f.inp, f.facing);
    if (f.traits.runDash && !f.dashBack && (d === 6 || d === 9 || d === 3)) {
      // stampede run: keep charging while forward is held
      f.running = true;
      f.vx = f.traits.runSpeed * f.facing;
      return;
    }
    f.running = false;
    f.vx = 0;
    setState(f, 'idle');
  }
}

export function doJump(s, f) {
  f.vy = RULES.JUMP_VY * (s.gravityMult < 1 ? 0.85 : 1);
  const d = f.jumpDir;
  const vx = jumpVx(f);
  f.vx = d === 9 ? vx * f.facing : d === 7 ? -vx * f.facing : 0;
  f.air = true;
  f.y = -1;
  f.airJumps = f.maxAirJumps + (s.heavenly?.id === 'moon' ? 1 : 0);
  f.wallJumps = f.maxWallJumps;
  f.airDashes = f.traits.airDash ? (f.traits.airDashes || 1) : 0;
  f.hoverT = f.traits.hover || 0;
  setState(f, 'air');
  emit(s, { t: 'jump', side: f.side, x: f.x });
}

export function atWall(s, f) {
  if (f.x <= s.stage.left + RULES.WALL_MARGIN + 1) return -1;
  if (f.x >= s.stage.right - RULES.WALL_MARGIN - 1) return 1;
  return 0;
}

export function airControl(s, f) {
  const inp = f.inp;
  const wall = atWall(s, f);
  // wall cling (goat)
  if (f.traits.wallCling && wall !== 0) {
    const towardWall = wall < 0 ? BTN.L : BTN.R;
    if (inp.cur & towardWall) {
      f.clinging = true;
      f.vx = 0;
      f.vy = inp.cur & BTN.U ? -4 : inp.cur & BTN.D ? 4 : 0;
      f.wallJumps = f.maxWallJumps;
    } else f.clinging = false;
  } else f.clinging = false;

  const upPress = inp.pressed & BTN.U;
  const awayPress = wall !== 0 && (inp.pressed & (wall < 0 ? BTN.R : BTN.L));
  if (wall !== 0 && f.wallJumps > 0 && (upPress || awayPress) && f.stT > 3) {
    f.wallJumps--;
    f.vy = RULES.WALLJUMP_VY;
    f.vx = -wall * RULES.WALLJUMP_VX * (f.traits.wallJumpMult || 1);
    f.facing = -wall;
    f.clinging = false;
    emit(s, { t: 'wallJump', side: f.side, x: f.x, y: f.y });
    return;
  }
  if (upPress && f.airJumps > 0 && f.stT > 5) {
    f.airJumps--;
    f.vy = RULES.AIR_JUMP_VY;
    const d = heldDir(inp, f.facing);
    const vx = jumpVx(f) * 0.9;
    f.vx = d === 9 || d === 6 ? vx * f.facing : d === 7 || d === 4 ? -vx * f.facing : f.vx * 0.3;
    emit(s, { t: 'airJump', side: f.side, x: f.x, y: f.y, n: f.maxAirJumps - f.airJumps });
    return;
  }
  // air dash on double tap
  if (inp.dash > 0 && f.airDashes > 0) {
    f.airDashes--;
    inp.dash = 0;
    const dir = inp.dashDir;
    const d = heldDir(inp, f.facing);
    f.airDashT = 12;
    f.airDashV = { vx: dir * 9.5, vy: d >= 7 ? -6 : d <= 3 ? 6 : 0 };
    emit(s, { t: 'dash', side: f.side, air: true });
  }
  if (f.airDashT > 0) {
    f.airDashT--;
    f.vx = f.airDashV.vx;
    f.vy = f.airDashV.vy;
  }
  // hover / glide when holding up while falling
  if ((inp.cur & BTN.U) && f.vy > 0) {
    if (f.traits.glide) f.vy = Math.min(f.vy, 2.2);
    else if (f.hoverT > 0) {
      f.hoverT--;
      f.vy = Math.min(f.vy, 1.5);
    }
  }
}

export function faceOpponent(f, o) {
  if (Math.abs(o.x - f.x) > 1) f.facing = o.x > f.x ? 1 : -1;
}

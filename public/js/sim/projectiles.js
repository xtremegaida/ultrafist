// Projectiles: spawning, movement, expiry. Collision with fighters lives in combat.js.

import { getProj } from '../data/registry.js';
import { emit } from './util.js';

export function spawnProjectile(s, f, kind, spec = {}, bonus = false) {
  const def = getProj(kind);
  if (!def) return null;
  const sc = f.scale || 1;
  const p = {
    id: s.nextId++,
    kind,
    owner: f.side,
    facing: f.facing,
    x: f.x + (spec.x ?? 60) * f.facing * sc,
    y: f.y + (spec.y ?? -110) * sc,
    vx: (spec.vx ?? def.vx ?? 0) * f.facing,
    vy: spec.vy ?? def.vy ?? 0,
    t: 0,
    life: spec.life ?? def.life ?? 120,
    hits: def.hits ?? 1,
    last: -99,
    bonus,
    mult: spec.mult ?? 1,
    len: 0,
    data: {},
  };
  if (def.beam) p.data.moveId = f.move?.id;
  if (def.charge && f.move) p.mult *= 1 + (f.move.hold / (def.charge.max || 40)) * (def.charge.bonus || 0.35);
  if (def.onSpawn) def.onSpawn({ s, f, p });
  s.projectiles.push(p);
  emit(s, { t: 'spawn', side: f.side, kind, x: p.x, y: p.y });
  return p;
}

export function projBox(s, p) {
  const def = getProj(p.kind);
  if (def.beam) {
    const owner = s.fighters[p.owner];
    const ox = owner.x + (def.beam.x || 60) * p.facing;
    const oy = owner.y + (def.beam.y || -110);
    const x0 = p.facing > 0 ? ox : ox - p.len;
    return { x: x0, y: oy - def.h / 2, w: p.len, h: def.h };
  }
  const sc = p.data.scale || 1;
  return { x: p.x - (def.w * sc) / 2, y: p.y - (def.h * sc) / 2, w: def.w * sc, h: def.h * sc };
}

export function tickProjectiles(s) {
  const keep = [];
  for (const p of s.projectiles) {
    const def = getProj(p.kind);
    p.t++;
    p.life--;
    if (def.beam) {
      const owner = s.fighters[p.owner];
      p.len = Math.min(def.beam.max, p.len + def.beam.speed);
      p.x = owner.x + (def.beam.x || 60) * p.facing + p.len * p.facing;
      p.y = owner.y + (def.beam.y || -110);
      // beams die when their owner gets hit out of the move
      if (owner.st !== 'attack' || !owner.move || p.data.moveId !== undefined && owner.move.id !== p.data.moveId) p.life = Math.min(p.life, 0);
    } else {
      if (def.home && p.t > (def.home.after || 0)) {
        const tgt = s.fighters[1 - p.owner];
        const dy = tgt.y - 90 - p.y;
        p.vy += Math.sign(dy) * def.home.turn;
        p.vy = Math.max(-def.home.max, Math.min(def.home.max, p.vy));
      }
      if (def.g) p.vy += def.g * (s.gravityMult || 1);
      if (def.accel) p.vx += def.accel * Math.sign(p.vx || p.facing);
      p.x += p.vx * (s.projSpeed || 1);
      p.y += p.vy * (s.projSpeed || 1);
      if (def.grow) p.data.scale = Math.min(def.grow.max, (p.data.scale || 1) + def.grow.rate);
      const floorY = -(def.h * (p.data.scale || 1)) / 2;
      if (p.y > floorY && (def.g || p.vy > 0)) {
        p.y = floorY;
        if (def.onGround === 'bounce' && Math.abs(p.vy) > 2) p.vy = -p.vy * 0.55;
        else if (def.onGround === 'roll') p.vy = 0;
        else if (def.onGround) {
          landProjectile(s, p, def);
          continue;
        } else p.vy = 0;
      }
    }
    if (def.onTick) def.onTick({ s, p });
    const out = p.x < s.stage.left - 250 || p.x > s.stage.right + 250 || p.y < -1400;
    if (p.life <= 0 || p.hits <= 0 || out) {
      if (def.onExpire && p.hits > 0 && !out) def.onExpire({ s, p });
      continue;
    }
    keep.push(p);
  }
  s.projectiles = keep;
}

function landProjectile(s, p, def) {
  if (typeof def.onGround === 'string' && def.onGround.startsWith('zone:')) {
    addZone(s, def.onGround.slice(5), p.x, p.owner, def.zoneW || 140, def.zoneT || 180);
  }
  emit(s, { t: 'projLand', kind: p.kind, x: p.x, y: 0 });
}

export function addZone(s, kind, x, owner, w, t) {
  const z = { id: s.nextId++, kind, x, w, t, owner };
  s.zones.push(z);
  emit(s, { t: 'zone', kind, x });
  return z;
}

export function reflectProjectile(s, p, newOwner) {
  p.owner = newOwner;
  p.vx = -p.vx * 1.25;
  p.facing = -p.facing;
  p.life = Math.max(p.life, 90);
  p.mult *= 1.1;
  emit(s, { t: 'reflect', x: p.x, y: p.y });
}


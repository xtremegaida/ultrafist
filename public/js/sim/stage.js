// Arena hazards, ground zones (yolk, mud, lard, fire), props (chickens, kickable eggs), pickups and
// Heavenly Events. Everything here is deterministic: randomness comes from the seeded state RNG.

import { RULES } from '../data/rules.js';
import { STAGES } from '../data/stages.js';
import { EVENT_IDS, EVENT_FREQ, EVENT_DURATION } from '../data/heavenlyEvents.js';
import { getProj } from '../data/registry.js';
import { setState, hurtboxes, invulnTo, holdingAway, NEUTRAL, gainChi, addBuff } from './fighter.js';
import { activeHits, hitBoxScale } from './moves.js';
import { spawnProjectile, projBox, addZone } from './projectiles.js';
import { emit, overlap, worldBox } from './util.js';
import { rand, randInt, pick } from './rng.js';

export function initStage(s) {
  s.stage = { id: null, left: 0, right: RULES.STAGE_W, hazards: [], timer: 0, smashed: {}, next: null, dashMult: 1 };
  enterArea(s, STAGES[s.cfg.stageId] ? s.cfg.stageId : 'bamboo');
}

// Sets up an arena's hazards: at match start, and when a scenery-crash KO sends the next round into
// the area behind the arena (see startRound).
export function enterArea(s, id) {
  const def = STAGES[id];
  const st = s.stage;
  st.id = id;
  st.dashMult = def.dashMult || 1;
  st.gust = null;
  const hz = (st.hazards = []);
  for (const h of def.hazards) {
    if (h === 'bamboo') hz.push({ kind: 'bamboo', x: 520, st: 'up', t: 0, dir: 1 }, { kind: 'bamboo', x: 1080, st: 'up', t: 0, dir: -1 });
    if (h === 'lanterns') hz.push({ kind: 'lantern', x: 430, y: -310, vy: 0, st: 'up', t: 0 }, { kind: 'lantern', x: 1170, y: -310, vy: 0, st: 'up', t: 0 });
    if (h === 'hay') hz.push({ kind: 'hay', x: 250, st: 'up', hp: 3, t: 0 }, { kind: 'hay', x: 1350, st: 'up', hp: 3, t: 0 });
    if (h === 'rock') hz.push({ kind: 'rock', x: 1330, w: 130 });
    if (h === 'rocks') hz.push({ kind: 'rock', x: 230, w: 130 }, { kind: 'rock', x: 1370, w: 130 });
    if (h === 'waterfall') hz.push({ kind: 'waterfall', x: 800, w: 170 });
  }
  resetTimers(st);
}

function resetTimers(st) {
  st.nextWaiter = 600;
  st.nextChicken = 360;
  st.nextGust = 900;
  st.nextPeach = 420;
}

export function resetStageForRound(s) {
  s.zones = [];
  s.props = [];
  s.pickups = [];
  s.projectiles = [];
  s.stage.smashed = {};
  for (const h of s.stage.hazards) {
    if (h.kind === 'bamboo') Object.assign(h, { st: 'up', t: 0 });
    if (h.kind === 'lantern') Object.assign(h, { st: 'up', t: 0, y: -310, vy: 0 });
    if (h.kind === 'hay') Object.assign(h, { st: 'up', hp: 3, t: 0 });
  }
  s.stage.hazards = s.stage.hazards.filter((h) => h.kind !== 'waiter' && h.kind !== 'dragon');
  resetTimers(s.stage);
  // permanent ground zones that belong to the arena (owner -1: nobody is immune)
  for (const z of STAGES[s.stage.id].zones || []) s.zones.push({ id: s.nextId++, kind: z.kind, x: z.x, w: z.w, t: 1e9, owner: -1 });
  s.heavenly = s.suddenDeath ? { id: 'ancestors', t: 1e9, forced: true } : null;
  scheduleEvent(s);
}

function scheduleEvent(s) {
  const fr = EVENT_FREQ[s.cfg.events || 'normal'];
  s.nextEventAt = fr ? s.fightFrames + randInt(s, fr[0] * 60, fr[1] * 60) : Infinity;
}

// Hazard damage that does not come from a fighter.
export function hazardHit(s, D, { dmg, launch = [3, -8], x, glyph = null, sfx = 'hitHeavy', blockable = true }) {
  if (D.hp <= 0 || invulnTo(D, 'strike') || D.st === 'grabbed' || D.st === 'ultraVictim') return false;
  const dir = D.x >= x ? 1 : -1;
  const d = Math.round(dmg * (s.dmgMult || 1) * D.mods.dmgTaken);
  if (blockable && !D.air && (NEUTRAL.has(D.st) || D.st === 'blockstun') && holdingAway(D, x)) {
    D.hp = Math.max(1, D.hp - Math.round(d * 0.2));
    setState(D, 'blockstun');
    D.stun = 14;
    D.push = 8 * dir;
    emit(s, { t: 'block', side: D.side, x: D.x, y: D.y - 100, chip: Math.round(d * 0.2) });
    return true;
  }
  D.hp = Math.max(0, D.hp - d);
  if (D.move) D.move = null;
  setState(D, 'launched');
  D.air = true;
  D.y = Math.min(D.y, -1);
  D.vx = launch[0] * dir;
  D.vy = launch[1];
  D.kd = 'hard';
  D.juggle = Math.max(D.juggle, 6);
  D.combo.n++;
  D.combo.dmg += d;
  if (D.hp <= 0) D.lastHit = { by: -1, id: 'hazard', kind: 'hazard', up: launch[1] < -12 };
  s.hitstop = Math.max(s.hitstop, 10);
  emit(s, { t: 'hit', a: -1, d: D.side, x: D.x, y: D.y - 90, dmg: d, level: 'heavy', combo: D.combo.n, id: 'hazard', kind: 'hazard', glyph, sfx });
  return true;
}

function fighterOn(f, x, w) {
  return !f.air && Math.abs(f.x - x) < w / 2;
}

// ---------------------------------------------------------------------------------------------

export function tickStage(s, framesEvents) {
  const st = s.stage;
  const def = STAGES[st.id] || STAGES.bamboo;
  st.timer++;
  tickHeavenly(s, def);
  tickZones(s);
  tickProps(s);
  tickPickups(s);
  const hitEvents = framesEvents.filter((e) => e.t === 'hit' && (e.level === 'heavy' || e.level === 'special' || e.level === 'ultra'));

  for (const h of st.hazards) {
    switch (h.kind) {
      case 'bamboo':
        if (h.st === 'up') {
          const ev = hitEvents.find((e) => Math.abs(e.x - h.x) < 90);
          if (ev) {
            h.st = 'falling';
            h.t = 0;
            h.dir = h.x >= ev.x ? 1 : -1;
            if (s.fighters.some((f) => Math.abs(f.x - h.x) < 50)) h.dir = h.x >= 800 ? -1 : 1;
            emit(s, { t: 'sfx', id: 'wallBounce', x: h.x });
            emit(s, { t: 'hazard', kind: 'bambooCreak', x: h.x });
          }
        } else if (h.st === 'falling') {
          if (++h.t === 34) {
            h.st = 'down';
            h.t = 0;
            const x0 = Math.min(h.x, h.x + h.dir * 300);
            for (const f of s.fighters) {
              if (f.x > x0 && f.x < x0 + 300 && f.y > -170) hazardHit(s, f, { dmg: 50, launch: [3, -7], x: h.x, glyph: '竹' });
            }
            emit(s, { t: 'hazard', kind: 'bambooCrash', x: h.x + h.dir * 150 });
            emit(s, { t: 'sfx', id: 'stomp', x: h.x });
          }
        } else if (h.st === 'down' && ++h.t > 720) {
          h.st = 'up';
          h.t = 0;
        }
        break;
      case 'lantern':
        if (h.st === 'up') {
          const box = { x: h.x - 26, y: h.y - 30, w: 52, h: 64 };
          let knocked = s.projectiles.some((p) => overlap(projBox(s, p), box));
          for (const f of s.fighters) {
            if (f.air && hurtboxes(f).some((b) => overlap(b, box))) knocked = true;
            for (const hh of activeHits(f)) {
              const mv = f.move;
              if (mv && hh.box && overlap(worldBox(f, hh.box, ...hitBoxScale(f, { id: mv.id })), box)) knocked = true;
            }
          }
          if (knocked) {
            h.st = 'falling';
            h.vy = 0;
            emit(s, { t: 'hazard', kind: 'lanternDrop', x: h.x });
          }
        } else if (h.st === 'falling') {
          h.vy += 0.7;
          h.y += h.vy;
          if (h.y >= -10) {
            h.st = 'down';
            h.t = 0;
            addZone(s, 'fire', h.x, -1, 150, 150);
            emit(s, { t: 'sfx', id: 'fire', x: h.x });
          }
        } else if (h.st === 'down' && ++h.t > 900) Object.assign(h, { st: 'up', y: -310, t: 0 });
        break;
      case 'hay':
        if (h.st === 'up') {
          const box = { x: h.x - 48, y: -84, w: 96, h: 84 };
          for (const p of s.projectiles) {
            const pd = getProj(p.kind);
            if (pd.beam || pd.ignoreHay) continue;
            if (overlap(projBox(s, p), box)) {
              p.hits = 0;
              h.hp--;
              emit(s, { t: 'hazard', kind: 'hayHit', x: h.x });
              if (h.hp <= 0) {
                h.st = 'down';
                h.t = 0;
                emit(s, { t: 'hazard', kind: 'hayBreak', x: h.x });
              }
            }
          }
        } else if (++h.t > 900) Object.assign(h, { st: 'up', hp: 3, t: 0 });
        break;
      case 'waiter': {
        h.t++;
        if (h.t < 60) break;
        h.x += h.dir * 6;
        const box = { x: h.x - 36, y: -84, w: 72, h: 84 };
        for (const f of s.fighters) {
          if (h.hitSides[f.side]) continue;
          if (hurtboxes(f).some((b) => overlap(b, box))) {
            h.hitSides[f.side] = true;
            hazardHit(s, f, { dmg: 40, launch: [4, -8], x: h.x - h.dir * 50, glyph: '茶', sfx: 'splash' });
          }
        }
        if (h.x < -100 || h.x > RULES.STAGE_W + 100) h.done = true;
        break;
      }
      case 'dragon': {
        h.t++;
        if (h.t < 90) break;
        h.x += h.dir * 16;
        const box = { x: h.x - 140, y: -130, w: 280, h: 130 };
        for (const f of s.fighters) {
          if (h.hitSides[f.side]) continue;
          if (hurtboxes(f).some((b) => overlap(b, box))) {
            h.hitSides[f.side] = true;
            hazardHit(s, f, { dmg: 80, launch: [6, -14], x: h.x - h.dir * 100, glyph: '龍', sfx: 'fire', blockable: true });
          }
        }
        if (h.x < -400 || h.x > RULES.STAGE_W + 400) h.done = true;
        break;
      }
      case 'rock':
        for (const f of s.fighters) {
          if (fighterOn(f, h.x, h.w) && f.st === 'idle' && s.frame % 20 === 0 && f.hp > 0 && f.hp < f.maxHp) f.hp++;
        }
        break;
      case 'waterfall':
        for (const p of s.projectiles) {
          if (Math.abs(p.x - h.x) < h.w / 2 && !p.data.wet) {
            p.data.wet = true;
            p.vx *= 0.5;
          }
        }
        break;
      default:
        break;
    }
  }
  st.hazards = st.hazards.filter((h) => !h.done);

  // timed hazards
  if (def.hazards.includes('waiter') && s.phase === 'fight' && st.timer >= st.nextWaiter) {
    st.nextWaiter = st.timer + 1200;
    const dir = rand(s) < 0.5 ? 1 : -1;
    st.hazards.push({ kind: 'waiter', x: dir > 0 ? -60 : RULES.STAGE_W + 60, dir, t: 0, hitSides: {} });
    emit(s, { t: 'hazard', kind: 'waiterWarn', dir });
  }
  if (def.hazards.includes('chickens') && s.phase === 'fight' && st.timer >= st.nextChicken) {
    st.nextChicken = st.timer + randInt(s, 540, 900);
    const dir = rand(s) < 0.5 ? 1 : -1;
    s.props.push({ id: s.nextId++, kind: 'chicken', x: dir > 0 ? -30 : RULES.STAGE_W + 30, y: 0, vx: dir * (2 + rand(s) * 1.5), vy: 0, t: 0, flying: false });
    emit(s, { t: 'sfx', id: 'cluck' });
  }
  if (def.hazards.includes('peaches') && s.phase === 'fight' && st.timer >= st.nextPeach) {
    st.nextPeach = st.timer + randInt(s, 840, 1140);
    s.pickups.push({ id: s.nextId++, kind: 'peach', x: randInt(s, 200, RULES.STAGE_W - 200), y: -560, t: 0 });
    emit(s, { t: 'sfx', id: 'boing' });
  }
  if (def.hazards.includes('cloud') && s.phase === 'fight' && st.timer >= st.nextGust) {
    st.nextGust = st.timer + 900;
    st.gust = { t: 70, dir: rand(s) < 0.5 ? 1 : -1 };
    emit(s, { t: 'hazard', kind: 'gust', dir: st.gust.dir });
  }
  if (st.gust) {
    for (const f of s.fighters) if (f.st !== 'grabbed' && f.st !== 'ultraVictim') f.x += st.gust.dir * 2.2;
    if (--st.gust.t <= 0) st.gust = null;
  }
  if (def.hazards.includes('tables')) {
    for (const e of framesEvents) {
      if ((e.t === 'wallSplat' || e.t === 'wallBounce') && !st.smashed[e.wall]) {
        st.smashed[e.wall] = true;
        const f = s.fighters[e.side];
        f.hp = Math.max(f.hp > 0 ? 1 : 0, f.hp - Math.round(30 * (s.dmgMult || 1)));
        emit(s, { t: 'hazard', kind: 'tableSmash', x: f.x, wall: e.wall });
        emit(s, { t: 'hit', a: -1, d: f.side, x: f.x, y: f.y - 80, dmg: 30, level: 'heavy', combo: f.combo.n, id: 'table', kind: 'hazard', glyph: '桌' });
      }
    }
  }
}

function tickZones(s) {
  s.zoneSlow = [1, 1];
  s.slippery = [false, false];
  for (const z of s.zones) {
    z.t--;
    for (const f of s.fighters) {
      if (f.air || Math.abs(f.x - z.x) > z.w / 2) continue;
      const immune = z.owner === f.side;
      if (z.kind === 'mud' && !immune && !f.traits.mudImmune) s.zoneSlow[f.side] = 0.7;
      if ((z.kind === 'yolk' || z.kind === 'lard') && !immune) s.slippery[f.side] = true;
      if (z.kind === 'lard' && !immune && f.st === 'walk') f.x += f.vx * 0.35;
      if (z.kind === 'fire' && z.t % 10 === 0 && f.hp > 0) {
        const d = Math.round(5 * (s.dmgMult || 1));
        f.hp = Math.max(1, f.hp - d);
        emit(s, { t: 'burn', side: f.side, x: f.x, y: f.y - 40, dmg: d });
      }
    }
  }
  s.zones = s.zones.filter((z) => z.t > 0);
}

function tickProps(s) {
  for (const p of s.props) {
    p.t++;
    if (p.kind === 'chicken') {
      if (!p.flying) {
        p.x += p.vx;
        // little hops
        p.y = -Math.abs(Math.sin(p.t * 0.25)) * 14;
        for (const f of s.fighters) {
          for (const hh of activeHits(f)) {
            if (!hh.box) continue;
            const b = worldBox(f, hh.box);
            if (overlap(b, { x: p.x - 22, y: p.y - 40, w: 44, h: 40 })) {
              p.flying = true;
              p.vx = f.facing * 10;
              p.vy = -12;
              gainChi(f, 10);
              emit(s, { t: 'chicken', side: f.side, x: p.x, y: p.y - 20 });
            }
          }
        }
      } else {
        p.vy += 0.6;
        p.x += p.vx;
        p.y += p.vy;
      }
      if (p.x < -200 || p.x > RULES.STAGE_W + 200 || p.y > 50) p.done = true;
    } else if (p.kind === 'egg') {
      // kickable egg from the rooster's taunt
      for (const f of s.fighters) {
        for (const hh of activeHits(f)) {
          if (!hh.box) continue;
          const b = worldBox(f, hh.box);
          if (overlap(b, { x: p.x - 18, y: -40, w: 36, h: 40 })) {
            p.done = true;
            const proj = spawnProjectile(s, f, 'kickedEgg', { x: 0, y: 0 });
            if (proj) {
              proj.x = p.x;
              proj.y = -30;
            }
            emit(s, { t: 'sfx', id: 'egg', x: p.x });
          }
        }
      }
      if (p.t > 900) p.done = true;
    }
  }
  s.props = s.props.filter((p) => !p.done);
}

function tickPickups(s) {
  for (const p of s.pickups) {
    p.t++;
    if (p.y < -16) p.y = Math.min(-16, p.y + 3.5);
    for (const f of s.fighters) {
      if (p.done || f.hp <= 0) continue;
      if (Math.abs(f.x - p.x) < 44 && f.y - 160 < p.y && f.y > p.y - 30) {
        p.done = true;
        if (p.kind === 'peach') f.hp = Math.min(f.maxHp, f.hp + 80);
        if (p.kind === 'orb') gainChi(f, 50);
        if (p.kind === 'chilli') addBuff(f, 'chilli', 300, { stats: { spd: 3 } });
        emit(s, { t: 'pickup', side: f.side, kind: p.kind, x: p.x, y: p.y });
      }
    }
    if (p.t > 420) p.done = true;
  }
  s.pickups = s.pickups.filter((p) => !p.done);
}

function tickHeavenly(s, def) {
  const ev = s.heavenly;
  s.gravityMult = def.gravity || 1;
  s.dmgMult = 1;
  s.projSpeed = 1;
  if (s.phase === 'fight') s.fightFrames++;
  if (ev) {
    if (!ev.forced) ev.t--;
    switch (ev.id) {
      case 'moon':
        s.gravityMult *= 0.5;
        break;
      case 'ancestors':
        s.dmgMult = 2;
        break;
      case 'tea':
        if (s.frame % 6 === 0) {
          for (const f of s.fighters) {
            ev.healed = ev.healed || [0, 0];
            if (f.hp > 0 && f.st !== 'attack' && !['hitstun', 'launched', 'ko'].includes(f.st) && ev.healed[f.side] < 80 && f.hp < f.maxHp) {
              f.hp++;
              ev.healed[f.side]++;
            }
          }
        }
        break;
      case 'fortune':
        if (ev.t % 70 === 0) {
          s.pickups.push({ id: s.nextId++, kind: pick(s, ['peach', 'orb', 'chilli', 'orb']), x: randInt(s, 150, RULES.STAGE_W - 150), y: -560, t: 0 });
        }
        break;
      default:
        break;
    }
    if (ev.t <= 0) {
      emit(s, { t: 'heavenlyEnd', id: ev.id });
      s.heavenly = null;
      scheduleEvent(s);
    }
  } else if (s.phase === 'fight' && s.fightFrames >= s.nextEventAt && !s.cfg.training) {
    const id = pick(s, EVENT_IDS);
    s.heavenly = { id, t: EVENT_DURATION, used: false };
    emit(s, { t: 'heavenly', id });
    if (id === 'dragon') {
      const dir = rand(s) < 0.5 ? 1 : -1;
      s.stage.hazards.push({ kind: 'dragon', x: dir > 0 ? -300 : RULES.STAGE_W + 300, dir, t: 0, hitSides: {} });
    }
    if (id === 'moon') for (const f of s.fighters) if (f.air) f.airJumps++;
  }
  // turtle time skips 2 of every 5 frames (handled by the stepper)
  s.turtle = s.heavenly?.id === 'turtle';
}


// General Ji Dao 雞道 "the Dawn Fist" — a rooster. Aerial speedster with eggs and a phoenix rebirth.

import { setState, hasBuff, getBuff } from '../../sim/fighter.js';
import { spawnProjectile } from '../../sim/projectiles.js';
import { emit } from '../../sim/util.js';

const EGG_HP = 150;
const EGG_HATCH = 120;

export default {
  id: 'jidao',
  name: 'General Ji Dao',
  short: 'Ji Dao',
  title: 'the Dawn Fist',
  glyph: '雞道',
  species: 'rooster',
  archetype: 'Aerial speedster',
  desc: 'A rooster who woke up one morning and chose violence. Every morning, actually. At 4am.',
  stats: { pow: 6, spd: 8, def: 5, chi: 5 },
  size: 0.92,
  traits: { airJumps: 3, airDash: true, airDashes: 2, glide: true, normalDmg: 1.18 },
  voice: { pitch: 1.8, rate: 1.25, animal: 'crow' },
  colors: { c1: '#c1121f', c2: '#fdf0d5' },
  quote: 'Up since 4am. Training. Crowing. Mostly crowing.',
  tauntText: 'Lays an egg and stares at it, deeply confused. He is a rooster.',
  ai: { style: 'aerial', range: 160, proj: 'F', anti: 'U', poke: 'B', ender: 'N', reversal: 'U', airborne: 0.25 },

  defaultSlots: { N: 'cockfightFury', F: 'eggGrenade', B: 'featherDarts', U: 'talonTornado', D: 'dawnCrow' },
  ultras: ['phoenixReborn', 'sunriseInferno'],

  hooks: {
    beforeKO({ s, f }) {
      if (f.st === 'egg' || f.char.egg) {
        f.char.eggHp -= Math.max(1, f.lastDmg || 30);
        if (f.char.eggHp > 0) {
          f.hp = 1;
          setState(f, 'egg');
          f.stT = f.char.eggT;
          f.air = false;
          f.y = 0;
          f.vx = f.vy = f.push = 0;
          emit(s, { t: 'sfx', id: 'eggCrack', x: f.x });
          return true;
        }
        return false;
      }
      if (hasBuff(f, 'eggLife')) {
        getBuff(f, 'eggLife').t = 0;
        f.buffs = f.buffs.filter((b) => b.id !== 'eggLife');
        f.hp = 1;
        f.char.egg = true;
        f.char.eggHp = EGG_HP;
        f.char.eggT = 0;
        f.move = null;
        setState(f, 'egg');
        f.air = false;
        f.y = 0;
        f.vx = f.vy = f.push = 0;
        f.combo = { n: 0, dmg: 0, used: {} };
        emit(s, { t: 'egg', side: f.side, x: f.x });
        return true;
      }
      return false;
    },
    perFrame({ s, f }) {
      if (f.st !== 'egg') return;
      f.char.eggT = (f.char.eggT || 0) + 1;
      if (f.char.eggT >= EGG_HATCH) {
        f.char.egg = false;
        f.hp = Math.round(f.maxHp * 0.3);
        setState(f, 'idle');
        f.inv = { t: 30, kind: 'all' };
        emit(s, { t: 'hatch', side: f.side, x: f.x });
      }
    },
    onDealHit() {},
    onTaunt({ s, f }) {
      s.props.push({ id: s.nextId++, kind: 'egg', x: f.x + f.facing * 30, y: 0, vx: 0, vy: 0, t: 0 });
      emit(s, { t: 'sfx', id: 'egg', x: f.x });
    },
  },

  moves: {
    cockfightFury: {
      name: 'Cockfight Fury', glyph: '啄', shout: 'BOK BOK BOK BOK!',
      desc: 'A 12-peck flurry.',
      startup: 8, active: 34, recovery: 16, anim: 'peck',
      vel: [{ f: [8, 40], vx: 1.5 }],
      hits: [
        { f: [8, 38], every: 3, box: [15, -140, 95, 80], dmg: 12, hitstun: 20, kb: 1.5, jc: 0 },
        { f: [40, 42], box: [15, -140, 100, 80], dmg: 34, launch: [6, -9], knockdown: 'soft', jc: 1 },
      ],
    },
    eggGrenade: {
      name: 'Egg Grenade', glyph: '蛋', shout: 'EGG GRENADE!', airOk: true,
      desc: 'An arcing egg. Leaves a slippery yolk puddle.',
      startup: 11, active: 1, recovery: 26, anim: 'throwEgg', float: [1, 20],
      spawn: [{ f: 11, proj: 'egg', x: 40, y: -130 }], hits: [],
    },
    featherDarts: {
      name: 'Feather Dart Volley', glyph: '羽', shout: 'FEATHER DARTS!', airOk: true,
      desc: 'Five feathers fanning outward. In the air they fan downward.',
      startup: 12, active: 1, recovery: 26, anim: 'wingFlap', sfx: 'feathers', float: [1, 22], hits: [],
      onFrame: ({ s, f, m }) => {
        if (m.f !== 12) return;
        const spread = f.air ? [1.5, 3, 4.5, 6, 7.5] : [-2, -1, 0, 1, 2];
        for (const vy of spread) spawnProjectile(s, f, 'feather', { x: 40, y: -120, vy }, m.bonus);
      },
    },
    talonTornado: {
      name: 'Talon Tornado', glyph: '爪', shout: 'TALON TORNADO!',
      desc: 'Reversal. A 6-hit rising spin.',
      startup: 4, active: 20, recovery: 4, anim: 'spin', untilLand: true, landRecovery: 14,
      inv: [{ f: [1, 6], kind: 'strike' }],
      vel: [{ f: [4, 9], vx: 2, vy: -11 }],
      hits: [
        { f: [4, 20], every: 4, box: [-60, -210, 120, 210], dmg: 20, hitstun: 24, launch: [1, -9], jc: 1 },
        { f: [22, 24], box: [-60, -210, 120, 210], dmg: 40, launch: [4, -11], jc: 1 },
      ],
    },
    dawnCrow: {
      name: 'Dawn Crow', glyph: '曉', shout: 'COCK-A-DOODLE-DOO!',
      desc: 'A sonic ring that destroys projectiles and turns the sky to sunrise.',
      startup: 10, active: 1, recovery: 28, anim: 'crow', hits: [],
      spawn: [{ f: 10, proj: 'crowRing', x: 50, y: -120 }],
      onStart: ({ s, f }) => emit(s, { t: 'animal', side: f.side, kind: 'crow' }),
      onFrame: ({ s, m }) => {
        if (m.f === 10) emit(s, { t: 'sunrise' });
      },
    },
    phoenixReborn: {
      name: 'Phoenix Reborn from the Egg', glyph: '鳳凰', shout: 'PHOENIX REBORN!', kind: 'ultra',
      desc: 'A fire burst, plus an egg life: your next KO turns you into an egg. Survive 2 s to hatch with 30% HP.',
      startup: 6, active: 6, recovery: 18, anim: 'wingsUp', sfx: 'fire',
      inv: [{ f: [1, 12], kind: 'all' }],
      buff: { id: 'eggLife', t: 1e7, f: 6 },
      hits: [{ box: [-150, -240, 300, 240], dmg: 80, launch: [7, -10], noHurt: true }],
    },
    sunriseInferno: {
      name: 'Sunrise Wing Inferno', glyph: '旭日', shout: 'I AM THE SUN!', kind: 'ultra',
      desc: 'Flies into the sun, becomes the sun, and dive-bombs the opponent.',
      startup: 40, active: 40, recovery: 2, anim: 'diveFire', untilLand: true, landRecovery: 26,
      inv: [{ f: [1, 44], kind: 'all' }],
      vel: [{ f: [1, 24], vx: 0, vy: -30 }],
      float: [25, 40],
      onFrame: ({ s, f, o, m }) => {
        if (m.f === 25) {
          f.x = o.x - o.facing * 40;
          f.y = -900;
          f.vy = 0;
          f.facing = o.x >= f.x ? 1 : -1;
          emit(s, { t: 'sfx', id: 'whooshBig', x: f.x });
        }
        if (m.f >= 41) {
          f.vy = 26;
          f.vx = 0;
        }
      },
      hits: [{ f: [41, 90], box: [-130, -150, 260, 200], dmg: 60, cine: true, noHurt: true }],
      cine: {
        dur: 110, bg: 'sun',
        a: [[0, 0, 0], [20, -40, -60], [110, -40, -40]],
        v: [[0, 40, 0], [10, 50, -40], [110, 60, 0]],
        hits: Array.from({ length: 8 }, (_, i) => ({ t: 14 + i * 10, dmg: 34, glyph: i === 7 ? '日' : null, sfx: 'fire' })),
        final: { dmg: 88, launch: [9, -16], glyph: '旭日' },
      },
    },
  },

  projectiles: {
    egg: {
      w: 30, h: 36, vx: 6.5, vy: -9, g: 0.55, life: 120, dmg: 90, hitstun: 22, kb: 6, sprite: 'egg',
      onGround: 'zone:yolk', zoneW: 140, zoneT: 200,
    },
    kickedEgg: { w: 30, h: 36, vx: 12, vy: -2, g: 0.15, life: 90, dmg: 60, hitstun: 22, kb: 6, sprite: 'egg', onGround: 'zone:yolk', zoneW: 120, zoneT: 180 },
    feather: { w: 44, h: 14, vx: 10, life: 55, dmg: 18, hitstun: 14, kb: 3, jc: 1, sprite: 'feather' },
    crowRing: {
      w: 70, h: 160, vx: 7, life: 44, dmg: 60, hitstun: 22, kb: 9, sprite: 'ring', power: 3,
      grow: { rate: 0.03, max: 1.9 }, pierce: false,
    },
  },
};

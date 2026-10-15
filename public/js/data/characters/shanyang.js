// Shan Yang 山羊 "the Unyielding Peak" — a goat. Wall control and mix-ups.

import { emit } from '../../sim/util.js';

export default {
  id: 'shanyang',
  name: 'Shan Yang',
  short: 'Shan Yang',
  title: 'the Unyielding Peak',
  glyph: '山羊',
  species: 'goat',
  archetype: 'Wall control / mix-ups',
  desc: 'Climbed every mountain in the empire, then screamed at the top of each one.',
  stats: { pow: 6, spd: 7, def: 5, chi: 6 },
  size: 1,
  traits: { airJumps: 1, wallCling: true, wallJumps: Infinity, wallJumpMult: 1.15 },
  voice: { pitch: 1.1, rate: 1.05, animal: 'goatScream' },
  colors: { c1: '#e9edc9', c2: '#6b705c' },
  quote: 'Baa-sically, you got headbutted.',
  tauntText: "Chews on the opponent's health bar.",
  ai: { style: 'mixup', range: 220, proj: 'B', anti: 'U', poke: 'F', ender: 'F', reversal: 'D', grab: 'N', airborne: 0.35 },

  defaultSlots: { N: 'eatAnything', F: 'ramHeadbutt', B: 'goatScream', U: 'cliffsideLeap', D: 'faintingGoat' },
  ultras: ['thousandPeaks', 'goatAscension'],

  hooks: {
    onTaunt({ s, f }) {
      emit(s, { t: 'hudBite', side: 1 - f.side });
    },
  },

  moves: {
    eatAnything: {
      name: 'Eat Anything', glyph: '吃', shout: 'NOM NOM NOM!',
      desc: "Command grab. Eats 50 of the opponent's chi — and their hat.",
      startup: 6, active: 3, recovery: 38, anim: 'grab',
      hits: [{ box: [0, -160, 112, 140], dmg: 0, grab: true, throwKind: 'command' }],
      grabSeq: {
        release: 32,
        hold: (t) => [52, 0],
        hits: [{ t: 10, dmg: 40, glyph: '吃', sfx: 'hitLight' }, { t: 22, dmg: 40, glyph: '帽', sfx: 'hitHeavy' }],
        launch: [6, -7],
        after: ({ s, f, o }) => {
          const n = Math.min(o.chi, 50);
          o.chi -= n;
          f.chi = Math.min(300, f.chi + n);
          o.status.hatless = true;
          emit(s, { t: 'hatEaten', side: o.side });
        },
      },
    },
    ramHeadbutt: {
      name: 'Ram Headbutt', glyph: '撞', shout: 'RAAAM!',
      desc: 'Hold Special to charge (up to 1 s) for 100 to 170 damage. Wall-bounces.',
      startup: 12, active: 14, recovery: 22, anim: 'headbutt', sfx: 'ramHit',
      holdCharge: { btn: 'sp', max: 60, from: 4 }, chargeMult: 0.011,
      vel: [{ f: [10, 24], vx: 12 }],
      hits: [{ f: [12, 25], box: [10, -150, 100, 110], dmg: 100, launch: [10, -6], wallBounce: true }],
    },
    goatScream: {
      name: 'Goat Scream', glyph: '咩', shout: 'AAAAAAAAHHH!',
      desc: 'A cone of pure sound. Pushes the opponent far away.',
      startup: 12, active: 1, recovery: 26, anim: 'scream', hits: [],
      spawn: [{ f: 12, proj: 'screamCone', x: 70, y: -130 }],
      onStart: ({ s, f }) => emit(s, { t: 'animal', side: f.side, kind: 'goatScream' }),
    },
    cliffsideLeap: {
      name: 'Cliffside Leap', glyph: '躍', shout: 'TO THE PEAK!', airOk: true,
      desc: 'Invulnerable leap. From a wall or mid-air it becomes a diving headbutt.',
      startup: 3, active: 14, recovery: 4, anim: 'leap', untilLand: true, landRecovery: 14,
      inv: [{ f: [1, 6], kind: 'strike' }],
      onStart: ({ f, o, m }) => {
        m.data.dive = f.air;
        if (!f.air) {
          f.vy = -19;
          f.vx = 1.5 * f.facing;
          f.air = true;
          f.y = -1;
        } else {
          const dx = o.x - f.x;
          const dy = (o.y - 60) - f.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          f.vx = (dx / d) * 14;
          f.vy = Math.max(4, (dy / d) * 14);
          f.facing = dx >= 0 ? 1 : -1;
        }
      },
      hits: [
        { f: [3, 14], box: [-10, -230, 100, 230], dmg: 100, launch: [2, -12], jc: 2, cond: ({ m }) => !m.data.dive },
        { f: [3, 60], box: [0, -110, 100, 110], dmg: 100, groundBounce: true, launch: [3, -6], cond: ({ m }) => m.data.dive },
      ],
      onFrame: ({ f, m }) => {
        if (m.data.dive) {
          f.vy = Math.max(f.vy, 4);
        }
      },
    },
    faintingGoat: {
      name: 'Fainting Goat', glyph: '暈', shout: '*faints*',
      desc: 'Goes rigid. Strikes bounce off for 40 frames — then he springs up with a kick.',
      startup: 1, active: 1, recovery: 56, anim: 'faint', hits: [],
      parry: { f: [2, 40], vs: ['strike'], glyph: '暈', then: 'faintKick' },
      counterable: true,
    },
    faintKick: {
      name: 'Springing Hoof', glyph: '蹄', shout: 'SURPRISE!', hidden: true,
      startup: 5, active: 5, recovery: 20, anim: 'kick',
      hits: [{ box: [10, -150, 120, 120], dmg: 100, launch: [7, -11] }],
    },
    thousandPeaks: {
      name: 'Scream of a Thousand Peaks', glyph: '千峰', shout: 'AAAAAAAAAAAAAAAAH!', kind: 'ultra',
      desc: 'The mountains in the background scream along. Full-screen, heavy chip damage.',
      startup: 12, active: 66, recovery: 26, anim: 'scream',
      inv: [{ f: [1, 14], kind: 'all' }],
      onStart: ({ s, f }) => emit(s, { t: 'animal', side: f.side, kind: 'goatScream' }),
      hits: [
        { f: [12, 72], every: 6, global: true, box: [0, -800, 0, 800], dmg: 30, hitstun: 30, launch: [1, -3], jc: 0, chip: 0.4, noHurt: true },
        { f: [76, 78], global: true, box: [0, -800, 0, 800], dmg: 50, launch: [12, -10], knockdown: 'hard', jc: 0, chip: 0.4, noHurt: true, hitstop: 30 },
      ],
    },
    goatAscension: {
      name: 'G.O.A.T. Ascension', glyph: '登頂', shout: 'GREATEST OF ALL TIME!', kind: 'ultra',
      desc: 'Carries the opponent on its horns up an endless cliff, then headbutts them off the summit.',
      startup: 6, active: 16, recovery: 26, anim: 'headbutt',
      inv: [{ f: [1, 10], kind: 'all' }],
      vel: [{ f: [6, 22], vx: 12 }],
      hits: [{ f: [6, 22], box: [10, -170, 110, 160], dmg: 40, cine: true, noHurt: true }],
      cine: {
        dur: 170, bg: 'cliff',
        a: [[0, 0, 0], [130, 0, -1500, 'ease'], [150, 0, -1520], [170, 0, -1500]],
        v: [[0, 70, -60], [130, 70, -1560, 'ease'], [150, 70, -1580], [170, 120, -1600]],
        hits: Array.from({ length: 10 }, (_, i) => ({ t: 14 + i * 12, dmg: 30, glyph: i === 9 ? '頂' : null, sfx: 'ramHit' })),
        final: { dmg: 110, launch: [12, -18], glyph: '羊' },
      },
    },
  },

  projectiles: {
    screamCone: {
      w: 120, h: 170, vx: 9, life: 24, dmg: 90, hitstun: 26, kb: 16, launch: [11, -5], knockdown: 'soft',
      sprite: 'scream', grow: { rate: 0.05, max: 1.8 }, struggle: true, power: 2, pierce: false,
    },
  },
};

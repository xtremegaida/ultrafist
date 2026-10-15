// Grandmaster Long Xu 龍鬚 "Dragon Whiskers" — ancient zoner whose beard is a deadly weapon.

import { gainChi } from '../../sim/fighter.js';
import { emit } from '../../sim/util.js';

export default {
  id: 'longxu',
  name: 'Grandmaster Long Xu',
  short: 'Long Xu',
  title: 'Dragon Whiskers',
  glyph: '龍鬚',
  species: 'human',
  archetype: 'Zoner',
  desc: 'Three hundred years old and still refuses to retire. His beard has its own fan club.',
  stats: { pow: 6, spd: 4, def: 6, chi: 8 },
  size: 1,
  traits: { airJumps: 1, teleDash: true, reach: 1.1 },
  voice: { pitch: 0.4, rate: 0.8 },
  colors: { c1: '#e9e4d4', c2: '#3c6e71' },
  quote: 'Your kung fu is weak. Also, get off my lawn.',
  tauntText: 'A sparrow nests in his beard.',
  ai: { style: 'zoner', range: 380, proj: 'N', anti: 'U', poke: 'F', ender: 'F', reversal: 'U', airborne: 0.15 },

  defaultSlots: { N: 'elderLecture', F: 'beardLash', B: 'hairNet', U: 'whiskerCopter', D: 'ancientNap' },
  ultras: ['tempest', 'reverseAging'],

  moves: {
    elderLecture: {
      name: "Elder's Lecture", glyph: '訓', shout: 'IN MY DAY...!',
      desc: 'A slow scroll of disapproval. 3 hits.',
      startup: 13, active: 1, recovery: 26, anim: 'cast',
      spawn: [{ f: 13, proj: 'lecture', x: 70, y: -115 }], hits: [],
    },
    beardLash: {
      name: 'Beard Lash', glyph: '鬚', shout: 'BEARD LASH!',
      desc: 'Whips the beard 340 units forward.',
      startup: 12, active: 6, recovery: 25, anim: 'beardWhip', sfx: 'beard',
      hits: [{ box: [20, -134, 320, 40], dmg: 90, kb: 10, noHurt: true }],
      hurtExt: [{ f: [11, 22], box: [20, -130, 150, 30] }],
    },
    hairNet: {
      name: 'Hair Net', glyph: '網', shout: 'HAIR NET!',
      desc: 'Anti-air. The beard catches airborne foes and slams them down.',
      startup: 8, active: 8, recovery: 20, anim: 'beardUp', sfx: 'beard',
      hits: [{ box: [0, -320, 190, 200], dmg: 110, airOnly: true, launch: [2, 9], groundBounce: true, noHurt: true }],
    },
    whiskerCopter: {
      name: 'Whisker Copter', glyph: '旋', shout: 'WHISKER COPTER!',
      desc: 'Reversal. Spins his beard into a rotor and hovers.',
      startup: 4, active: 18, recovery: 18, anim: 'spin', sfx: 'beard',
      inv: [{ f: [1, 6], kind: 'strike' }],
      vel: [{ f: [4, 11], vx: 2, vy: -9 }], float: [16, 44], untilLand: true, landRecovery: 16,
      hits: [
        { f: [4, 16], every: 4, box: [-70, -230, 140, 210], dmg: 20, hitstun: 24, launch: [1.5, -8], jc: 1 },
        { f: [20, 22], box: [-70, -230, 140, 210], dmg: 30, launch: [4, -11], jc: 1 },
      ],
    },
    ancientNap: {
      name: 'Ancient Nap', glyph: '眠', shout: 'Zzzz...',
      desc: 'Dozes off. Strike him in the first 40 frames and he teleports behind you for a Snore Palm.',
      startup: 1, active: 1, recovery: 60, anim: 'sleep', sfx: 'snore', hits: [],
      parry: { f: [5, 40], vs: ['strike'], glyph: '夢', then: 'snorePalm',
        onParry: ({ s, f, o }) => {
          f.x = Math.max(s.stage.left + 40, Math.min(s.stage.right - 40, o.x - o.facing * 70));
          emit(s, { t: 'sfx', id: 'teleport', x: f.x });
        },
      },
      onEnd: ({ s, f, m }) => {
        if (m && !m.data.parried) {
          gainChi(f, 15);
          emit(s, { t: 'chi', side: f.side, n: 15 });
        }
      },
      counterable: true,
    },
    snorePalm: {
      name: 'Snore Palm', glyph: '鼾', shout: 'SNORE PALM!', hidden: true,
      startup: 6, active: 4, recovery: 20, anim: 'palm',
      hits: [{ box: [10, -160, 110, 110], dmg: 130, launch: [7, -9], knockdown: 'hard', wallBounce: true }],
    },
    tempest: {
      name: 'Ten-Thousand Strand Tempest', glyph: '萬鬚', shout: 'TEN THOUSAND STRAND TEMPEST!', kind: 'ultra',
      desc: 'The beard fills the screen. 17 hits.',
      startup: 8, active: 66, recovery: 30, anim: 'beardStorm', sfx: 'beard',
      inv: [{ f: [1, 10], kind: 'all' }],
      hits: [
        { f: [8, 68], every: 4, box: [-120, -430, 760, 450], dmg: 20, hitstun: 30, launch: [0.5, -5], jc: 0, noHurt: true },
        { f: [72, 74], box: [-120, -430, 760, 450], dmg: 80, launch: [9, -13], jc: 0, knockdown: 'hard', noHurt: true, hitstop: 30 },
      ],
    },
    reverseAging: {
      name: 'Reverse Aging', glyph: '返老還童', shout: 'BEHOLD MY YOUTH!', kind: 'ultra',
      desc: 'Becomes a muscular 25-year-old for 8 seconds: POW +3, SPD +3.',
      startup: 4, active: 6, recovery: 20, anim: 'flex',
      inv: [{ f: [1, 10], kind: 'all' }],
      buff: { id: 'youth', t: 480, f: 4, stats: { pow: 3, spd: 3 } },
      hits: [{ box: [-130, -220, 260, 220], dmg: 60, launch: [7, -8], noHurt: true }],
    },
  },

  projectiles: {
    lecture: {
      w: 90, h: 64, vx: 4.5, life: 120, hits: 3, every: 14, dmg: 30, hitstun: 22, kb: 4, jc: 1,
      struggle: true, sprite: 'scroll', pierce: true,
    },
  },
};

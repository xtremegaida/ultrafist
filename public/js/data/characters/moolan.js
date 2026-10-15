// Madame Moo-Lan 牛蘭 "the Heavenly Herd" — a cow. Tank with long-range dairy artillery.

import { addZone } from '../../sim/projectiles.js';
import { emit } from '../../sim/util.js';

export default {
  id: 'moolan',
  name: 'Madame Moo-Lan',
  short: 'Moo-Lan',
  title: 'the Heavenly Herd',
  glyph: '牛蘭',
  species: 'cow',
  archetype: 'Tank / long range',
  desc: 'Four stomachs, two horns, one goal: total pasture domination.',
  stats: { pow: 7, spd: 4, def: 7, chi: 6 },
  size: 1.08,
  traits: { airJumps: 1, runDash: true, runSpeed: 6.5, noPushback: true, hurtScale: 1.1, pushScale: 1.15, reach: 1.05 },
  voice: { pitch: 0.6, rate: 0.85, animal: 'moo' },
  colors: { c1: '#f8f9fa', c2: '#212529' },
  quote: 'Udderly outclassed.',
  tauntText: 'A long, dignified moo. Grass sprouts at her hooves.',
  ai: { style: 'tank', range: 170, proj: 'N', anti: 'U', poke: null, ender: 'U', reversal: 'U', airborne: 0.1, heal: 'D' },

  defaultSlots: { N: 'milkBeam', F: 'spiritStampede', B: 'cowbellCounter', U: 'hornToss', D: 'chewCud' },
  ultras: ['overTheMoon', 'tenThousandHead'],

  hooks: {
    init(f) {
      f.char.cud = 0;
      f.char.runArmor = 1;
    },
    perFrame({ f }) {
      if (f.st === 'dash' && f.stT === 0) f.char.runArmor = 1;
    },
    beforeHit({ s, f, src }) {
      if (f.st === 'dash' && f.running && f.char.runArmor > 0 && !src.proj) {
        f.char.runArmor = 0;
        emit(s, { t: 'armor', side: f.side, x: f.x, y: f.y - 110 });
        return 'armor';
      }
      return null;
    },
    onTaunt({ s, f }) {
      addZone(s, 'grass', f.x, f.side, 120, 400);
      emit(s, { t: 'animal', side: f.side, kind: 'moo' });
    },
  },

  moves: {
    milkBeam: {
      name: 'Milk Beam', glyph: '奶', shout: 'MILK BEAM!',
      desc: 'A pressurised dairy beam. Hold Special to charge it (up to 40 frames).',
      startup: 12, active: 26, recovery: 16, anim: 'beam', sfx: 'beam',
      holdCharge: { btn: 'sp', max: 40, from: 6 },
      spawn: [{ f: 12, proj: 'milkBeam' }], hits: [],
    },
    spiritStampede: {
      name: 'Spirit Stampede', glyph: '牛', shout: 'SPIRIT STAMPEDE!',
      desc: 'Five ghost cows charge across the screen.',
      startup: 16, active: 16, recovery: 18, anim: 'stomp',
      spawn: [16, 20, 24, 28, 32].map((f) => ({ f, proj: 'ghostCow', x: -40, y: -50 })), hits: [],
    },
    cowbellCounter: {
      name: 'Cowbell Counter', glyph: '鈴', shout: 'MORE COWBELL!',
      desc: 'Parry. Strikers get CLANGED and stunned for 40 frames.',
      startup: 1, active: 1, recovery: 43, anim: 'cowbell', hits: [],
      parry: { f: [3, 27], vs: ['strike'], glyph: '鈴', stun: 40, onParry: ({ s, f }) => emit(s, { t: 'sfx', id: 'cowbell', x: f.x }) },
    },
    hornToss: {
      name: 'Horn Toss', glyph: '角', shout: 'HORN TOSS!',
      desc: 'Invulnerable launcher. Follow up with a juggle.',
      startup: 6, active: 5, recovery: 32, anim: 'hornUp',
      inv: [{ f: [1, 5], kind: 'strike' }],
      hits: [{ box: [10, -190, 100, 190], dmg: 95, launch: [2, -15], jc: 3 }],
    },
    chewCud: {
      name: 'Chew the Cud', glyph: '嚼', shout: 'Munch munch.',
      desc: 'Heals 40 HP over a second. Four uses per round (four stomachs).',
      startup: 1, active: 1, recovery: 68, anim: 'chew', hits: [], counterable: true,
      canUse: ({ f }) => f.char.cud < 4,
      onStart: ({ f }) => {
        f.char.cud++;
      },
      heal: { f: [6, 65], perFrame: 0.67 },
    },
    overTheMoon: {
      name: 'Over the Moon', glyph: '跳月', shout: 'OVER THE MOOOON!', kind: 'ultra',
      desc: 'Tosses the opponent sky-high, leaps over the actual moon, and lands hooves-first.',
      startup: 6, active: 6, recovery: 30, anim: 'hornUp',
      inv: [{ f: [1, 10], kind: 'all' }],
      hits: [{ f: [6, 11], box: [0, -210, 130, 210], dmg: 40, cine: true, noHurt: true }],
      cine: {
        dur: 170, bg: 'moon',
        a: [[0, 0, 0], [30, 0, 0], [80, 140, -1050, 'ease'], [120, 300, -1100], [150, 300, -600], [166, 300, -60]],
        v: [[0, 80, -30], [40, 160, -700, 'ease'], [120, 300, -820], [160, 300, 0]],
        hits: [{ t: 10, dmg: 40, glyph: '角' }, { t: 150, dmg: 40 }, { t: 155, dmg: 40 }, { t: 160, dmg: 40, glyph: '蹄' }, { t: 164, dmg: 40 }],
        events: [{ t: 30, ev: 'animal', kind: 'moo' }],
        final: { dmg: 180, launch: [6, -10], glyph: '月' },
      },
    },
    tenThousandHead: {
      name: 'Ten Thousand Head Stampede', glyph: '萬牛', shout: 'STAMPEDE!', kind: 'ultra',
      desc: 'The screen fills with cows. 28 hits. The HUD gets trampled.',
      startup: 10, active: 84, recovery: 26, anim: 'stomp',
      inv: [{ f: [1, 12], kind: 'all' }],
      hits: [
        { f: [10, 88], every: 3, global: true, box: [0, -230, 0, 230], dmg: 12, hitstun: 30, launch: [0, -2], jc: 0, noHurt: true, sfx: 'stomp' },
        { f: [92, 94], global: true, box: [0, -230, 0, 230], dmg: 56, launch: [7, -12], knockdown: 'hard', jc: 0, noHurt: true, hitstop: 30 },
      ],
    },
  },

  projectiles: {
    milkBeam: {
      w: 0, h: 50, life: 34, hits: 10, every: 3, dmg: 14, hitstun: 18, kb: 2, jc: 0,
      beam: { max: 760, speed: 48, x: 70, y: -128 }, sprite: 'milkBeam', struggle: true, power: 3, pierce: true,
      charge: { max: 40, bonus: 0.36 }, reflectable: false,
    },
    ghostCow: { w: 110, h: 96, vx: 10, life: 140, dmg: 30, hitstun: 22, kb: 6, launch: [4, -6], sprite: 'ghostCow', noCollide: false, power: 2 },
  },
};

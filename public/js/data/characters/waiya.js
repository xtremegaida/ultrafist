// Lady Wai-Ya 飛劍 "the Visibly Suspended Sword" — wire-fu aerial rushdown.

import { BTN } from '../../sim/input.js';
import { startMove } from '../../sim/moves.js';
import { setState } from '../../sim/fighter.js';
import { emit } from '../../sim/util.js';
import { spawnProjectile } from '../../sim/projectiles.js';

export default {
  id: 'waiya',
  name: 'Lady Wai-Ya',
  short: 'Wai-Ya',
  title: 'the Visibly Suspended Sword',
  glyph: '飛劍',
  species: 'human',
  archetype: 'Aerial rushdown',
  desc: 'Trained for twenty years to fly. Also pays three stagehands to hold the wires.',
  stats: { pow: 5, spd: 9, def: 3, chi: 7 },
  size: 0.97,
  traits: { airJumps: 2, airDash: true, airDashes: 1, hover: 90 },
  voice: { pitch: 1.4, rate: 1.1 },
  colors: { c1: '#d8e2dc', c2: '#9d0208' },
  quote: 'Gravity is a suggestion. You should have declined.',
  tauntText: 'Hangs upside down from her wire, sipping tea.',
  ai: { style: 'rushdown', range: 170, proj: 'F', anti: 'U', poke: 'N', ender: 'F', reversal: 'U', airborne: 0.45 },

  defaultSlots: { N: 'petalDive', F: 'swordBarrage', B: 'silkRebuff', U: 'wireYank', D: 'bambooTip' },
  ultras: ['tenThousandSwords', 'stagehandUnion'],

  moves: {
    petalDive: {
      name: 'Petal Rain Dive', glyph: '花', shout: 'PETAL RAIN!', airOk: true,
      desc: 'A 45-degree dive kick. Works in the air too.',
      startup: 6, active: 40, recovery: 2, anim: 'diveKick', untilLand: true, landRecovery: 7,
      groundStart: { vy: -12, vx: 2 },
      vel: [{ f: [1, 5], vx: 1, vy: -1 }, { f: [6, 80], vx: 9, vy: 9 }],
      hits: [{ f: [6, 80], box: [0, -70, 95, 80], dmg: 90, height: 'overhead', groundBounce: true, launch: null, hitstun: 22 }],
    },
    swordBarrage: {
      name: 'Flying Sword Barrage', glyph: '劍', shout: 'FLYING SWORDS!', airOk: true,
      desc: 'Three flying swords. In the air they angle downward.',
      startup: 13, active: 10, recovery: 28, anim: 'swordThrow', sfx: 'shing',
      hits: [],
      onFrame: ({ s, f, m }) => {
        if (m.f === 12 || m.f === 16 || m.f === 20) {
          const i = (m.f - 12) / 4;
          const vy = f.air ? 4.5 : 0;
          spawnSword(s, f, i, vy);
        }
      },
      float: [1, 26],
    },
    silkRebuff: {
      name: 'Silk Sleeve Rebuff', glyph: '袖', shout: 'REBUFFED!',
      desc: 'Parries strikes into a counter-slash and reflects projectiles.',
      startup: 1, active: 1, recovery: 34, anim: 'sleeve', hits: [],
      parry: { f: [3, 22], vs: ['strike'], glyph: '袖', then: 'silkCounter' },
      reflect: { f: [3, 22], box: [-10, -180, 120, 190] },
    },
    silkCounter: {
      name: 'Silk Counter', glyph: '斬', shout: 'HA!', hidden: true,
      startup: 4, active: 4, recovery: 18, anim: 'slash', sfx: 'shing',
      hits: [{ box: [10, -170, 130, 140], dmg: 80, launch: [6, -10] }],
    },
    wireYank: {
      name: 'Wire Yank', glyph: '吊', shout: 'PULL THE WIRE!',
      desc: 'Reversal. An offscreen stagehand yanks her up into a rising slash.',
      startup: 3, active: 12, recovery: 4, anim: 'riseSlash', sfx: 'twang', untilLand: true, landRecovery: 16,
      inv: [{ f: [1, 6], kind: 'strike' }],
      vel: [{ f: [3, 7], vx: 3, vy: -17 }],
      hits: [{ f: [3, 14], box: [0, -240, 95, 240], dmg: 110, launch: [3, -13], jc: 2 }],
    },
    bambooTip: {
      name: 'Bamboo-Tip Stand', glyph: '立', shout: 'BALANCE!',
      desc: "Hops onto the opponent's head and balances there. Press Light or Heavy to stomp.",
      startup: 10, active: 80, recovery: 10, anim: 'tipStand', sfx: 'twang', hits: [],
      vel: [{ f: [1, 9], vx: 0, vy: -7 }],
      float: [10, 90], airOk: true, untilLand: true, landRecovery: 6,
      onFrame: ({ s, f, o, m }) => {
        if (m.f === 10) {
          if (Math.abs(o.x - f.x) < 450 && !o.air && o.y > -20) {
            m.data.on = true;
            emit(s, { t: 'sfx', id: 'teleport', x: f.x });
          }
        }
        if (m.data.on && m.f >= 10 && m.f <= 90) {
          f.x = o.x;
          f.y = Math.min(-1, o.y - 185 * (o.scale || 1));
          f.air = true;
          f.vx = 0;
          f.vy = 0;
          m.data.noPush = true;
          if (m.f > 12 && (f.inp.pressed & (BTN.LP | BTN.HP))) {
            f.move = null;
            setState(f, 'attack');
            startMove(s, f, o, 'tipStomp', { keepFacing: true });
          }
          if (o.air || (o.st === 'attack' && o.move && o.move.f < 3 && (o.move.id === 'cH' || o.move.id === 'sH'))) {
            // shaken off by a big swing
            m.data.on = false;
          }
        }
      },
    },
    tipStomp: {
      name: 'Bamboo-Tip Stomp', glyph: '踏', shout: 'STOMP!', hidden: true, air: true,
      startup: 2, active: 30, recovery: 2, anim: 'stomp', untilLand: true, landRecovery: 8,
      vel: [{ f: [1, 40], vx: 0, vy: 14 }],
      hits: [{ f: [2, 30], box: [-30, -60, 60, 70], dmg: 90, height: 'overhead', launch: [2, -5] }],
      onStart: ({ f }) => {
        f.air = true;
      },
    },
    tenThousandSwords: {
      name: 'Ten Thousand Swords Return to the Sect', glyph: '萬劍歸宗', shout: 'TEN THOUSAND SWORDS!', kind: 'ultra',
      desc: 'The sky fills with swords. 31 hits, anywhere on screen.',
      startup: 10, active: 92, recovery: 26, anim: 'swordConduct', sfx: 'shing', float: [1, 128],
      inv: [{ f: [1, 12], kind: 'all' }],
      hits: [
        { f: [10, 100], every: 3, global: true, box: [0, -700, 0, 700], dmg: 11, hitstun: 30, launch: [0, -2.5], jc: 0, noHurt: true, sfx: 'shing' },
        { f: [104, 106], global: true, box: [0, -700, 0, 700], dmg: 60, launch: [5, -12], knockdown: 'hard', jc: 0, noHurt: true, hitstop: 30 },
      ],
    },
    stagehandUnion: {
      name: 'Stagehand Union Strike', glyph: '傀儡', shout: 'STAGEHANDS, ATTACK!', kind: 'ultra',
      desc: 'The wires take over the opponent like a puppet: 8 slams and a wall crash.',
      startup: 8, active: 8, recovery: 30, anim: 'puppeteer', sfx: 'twang',
      inv: [{ f: [1, 10], kind: 'all' }],
      hits: [{ f: [8, 15], box: [0, -220, 440, 220], dmg: 30, cine: true, noHurt: true }],
      cine: {
        dur: 168, bg: 'wires',
        a: [[0, 0, 0], [30, -40, -160, 'ease'], [168, -40, -160]],
        v: [[0, 200, 0], [20, 200, -300, 'ease'], [32, 200, 0], [44, 200, -320], [56, 200, 0], [68, 200, -340], [80, 200, 0],
          [92, 200, -360], [104, 200, 0], [116, 200, -380], [128, 200, 0], [140, 200, -420], [154, 200, 0], [168, 200, -40]],
        hits: [32, 56, 80, 104, 128, 154].map((t, i) => ({ t, dmg: 40 + i * 4, glyph: i === 5 ? '摔' : null, sfx: 'hitHeavy' }))
          .concat([{ t: 44, dmg: 20 }, { t: 92, dmg: 20 }]),
        final: { dmg: 46, launch: [16, -5], wallBounce: true, glyph: '傀' },
      },
    },
  },

  projectiles: {
    sword: { w: 70, h: 22, vx: 10, life: 80, dmg: 26, hitstun: 18, kb: 5, jc: 1, sprite: 'sword' },
  },
};

function spawnSword(s, f, i, vy) {
  spawnProjectile(s, f, 'sword', { x: 50, y: -125 + i * 14, vy }, f.move?.bonus);
}

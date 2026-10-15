// Sifu Ham Fu 豬 "the Bouncing Belly" — a pig. Stage-control trickster.

import { addZone } from '../../sim/projectiles.js';
import { hasBuff, holdingDown } from '../../sim/fighter.js';
import { emit } from '../../sim/util.js';

export default {
  id: 'hamfu',
  name: 'Sifu Ham Fu',
  short: 'Ham Fu',
  title: 'the Bouncing Belly',
  glyph: '豬',
  species: 'pig',
  archetype: 'Trickster / stage control',
  desc: 'Master of the Lard Arts. Has never once been caught off balance, mostly because he is round.',
  stats: { pow: 6, spd: 6, def: 5, chi: 7 },
  size: 1.04,
  traits: { airJumps: 1, mudImmune: true, bellyBounce: true, hurtScale: 1.08, pushScale: 1.15, reach: 1.05 },
  voice: { pitch: 0.9, rate: 1.0, animal: 'oink' },
  colors: { c1: '#ffafcc', c2: '#6a4c93' },
  quote: "Pigs don't sweat. That's why I'm always calm.",
  tauntText: 'Rolls in the mud and sighs contentedly.',
  ai: { style: 'trickster', range: 300, proj: 'N', anti: 'U', poke: 'F', ender: 'D', reversal: 'U', airborne: 0.25, setup: 'B' },

  defaultSlots: { N: 'hogwashCyclone', F: 'mudRoll', B: 'lardSlick', U: 'truffleUppercut', D: 'bellyCannon' },
  ultras: ['whenPigsFly', 'eightTreasures'],

  hooks: {
    // Belly Bounce: hold Down when landing from a fall to bounce again (85% height).
    onLand({ s, f, impactVy }) {
      if (f.st === 'air' && holdingDown(f) && impactVy > 7) {
        f.air = true;
        f.y = -1;
        f.vy = -impactVy * 0.85;
        emit(s, { t: 'sfx', id: 'boing', x: f.x });
        return true;
      }
      return false;
    },
    beforeHit({ s, f }) {
      if (hasBuff(f, 'banquet') && f.st === 'attack' && f.move && !f.move.data.bArmor) {
        f.move.data.bArmor = true;
        emit(s, { t: 'armor', side: f.side, x: f.x, y: f.y - 140 });
        return 'armor';
      }
      return null;
    },
    onTaunt({ s, f }) {
      addZone(s, 'mud', f.x, f.side, 120, 240);
      emit(s, { t: 'animal', side: f.side, kind: 'oink' });
    },
  },

  moves: {
    hogwashCyclone: {
      name: 'Hogwash Cyclone', glyph: '旋', shout: 'HOGWASH CYCLONE!',
      desc: 'A tornado of slop that drags the opponent in. 6 hits.',
      startup: 14, active: 1, recovery: 30, anim: 'spinArms', sfx: 'whooshBig',
      spawn: [{ f: 14, proj: 'cyclone', x: 80, y: -110 }], hits: [],
    },
    mudRoll: {
      name: 'Mud Roll', glyph: '泥', shout: 'MUD ROLL!',
      desc: 'Rolls into a mudball under high attacks. Leaves a slowing mud trail.',
      startup: 8, active: 30, recovery: 16, anim: 'roll', sfx: 'mud', lowProfile: [1, 40],
      vel: [{ f: [8, 38], vx: 8 }],
      hits: [{ f: [8, 37], every: 10, box: [-10, -90, 110, 90], dmg: 37, hitstun: 22, kb: 3, jc: 1, effect: { slow: { mult: 0.7, t: 240 } } }],
      onEnd: ({ s, f }) => {
        addZone(s, 'mud', f.x - f.facing * 90, f.side, 220, 240);
      },
    },
    lardSlick: {
      name: 'Lard Slick', glyph: '油', shout: 'LARD SLICK!',
      desc: 'Greases 220 units of floor for 6 seconds. Opponents slide helplessly; Ham Fu is immune.',
      startup: 12, active: 1, recovery: 24, anim: 'pour', sfx: 'slip', hits: [],
      onFrame: ({ s, f, m }) => {
        if (m.f === 12) addZone(s, 'lard', f.x + f.facing * 160, f.side, 220, 360);
      },
    },
    truffleUppercut: {
      name: 'Truffle Uppercut', glyph: '菌', shout: 'TRUFFLE UPPERCUT!',
      desc: 'Burrows underground, then erupts. Longest invulnerability in the game — and very unsafe.',
      startup: 9, active: 14, recovery: 4, anim: 'burrowUp', untilLand: true, landRecovery: 30,
      hurtNone: [1, 6],
      inv: [{ f: [1, 8], kind: 'all' }],
      vel: [{ f: [9, 13], vx: 2, vy: -14 }],
      hits: [{ f: [9, 16], box: [0, -250, 95, 250], dmg: 110, launch: [2, -15], jc: 2 }],
    },
    bellyCannon: {
      name: 'Belly Bounce Cannon', glyph: '肚', shout: 'BELLY CANNON!',
      desc: 'A belly-first bounce that reflects projectiles and ground-bounces airborne foes.',
      startup: 6, active: 30, recovery: 2, anim: 'bellyFlop', sfx: 'boing', untilLand: true, landRecovery: 18,
      vel: [{ f: [4, 8], vx: 7, vy: -9 }],
      reflect: { f: [2, 22], box: [0, -170, 130, 170] },
      hits: [{ f: [8, 40], box: [0, -150, 115, 130], dmg: 80, groundBounce: true, launch: [4, -6] }],
    },
    whenPigsFly: {
      name: 'When Pigs Fly', glyph: '豬飛', shout: 'WHEN PIGS FLY!', kind: 'ultra',
      desc: 'Sprouts tiny wings, carries you into orbit, and body-slams you from space.',
      startup: 8, active: 8, recovery: 30, anim: 'bellyFlop',
      inv: [{ f: [1, 10], kind: 'all' }],
      hits: [{ f: [8, 15], box: [0, -170, 130, 170], dmg: 40, cine: true, noHurt: true }],
      cine: {
        dur: 176, bg: 'space',
        a: [[0, 0, 0], [70, 60, -1600, 'ease'], [120, 60, -1700], [160, 80, -40, 'ease'], [176, 80, 0]],
        v: [[0, 90, -40], [70, 150, -1660, 'ease'], [120, 150, -1760], [158, 100, 0, 'ease'], [176, 100, 0]],
        hits: [{ t: 30, dmg: 30, glyph: '飛' }, { t: 90, dmg: 30, glyph: '星' }, { t: 158, dmg: 60, sfx: 'explode' }, { t: 164, dmg: 40 }],
        events: [{ t: 10, ev: 'animal', kind: 'oink' }],
        final: { dmg: 240, launch: [5, -9], glyph: '豬' },
      },
    },
    eightTreasures: {
      name: 'Eight Treasures Banquet', glyph: '八寶', shout: 'EIGHT TREASURES BANQUET!', kind: 'ultra',
      desc: 'Eats a feast and grows to giant size for 8 seconds: every move absorbs a hit, +25% damage.',
      startup: 30, active: 6, recovery: 16, anim: 'eat',
      inv: [{ f: [1, 36], kind: 'all' }],
      buff: { id: 'banquet', t: 480, f: 30, scale: 1.45, dmg: 1.25 },
      hits: [{ f: [30, 35], box: [-150, -260, 300, 260], dmg: 60, launch: [8, -9], noHurt: true }],
    },
  },

  projectiles: {
    cyclone: {
      w: 120, h: 220, vx: 4.5, life: 90, hits: 6, every: 7, dmg: 20, hitstun: 20, kb: -2, pull: 3, jc: 0,
      sprite: 'cyclone', struggle: true, power: 2, pierce: true,
    },
  },
};


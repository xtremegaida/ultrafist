// Uncle Jiu-Gui 酒鬼 "the Staggering Sage" — drunken fist that gets stronger the more he drinks.

import { gainChi, hasBuff, setState } from '../../sim/fighter.js';
import { spawnProjectile } from '../../sim/projectiles.js';
import { emit } from '../../sim/util.js';
import { rand } from '../../sim/rng.js';

const MAX_DRUNK = 5;

function setDrunk(s, f, n) {
  f.char.drunk = Math.max(0, n);
  f.char.dmgMult = 1 + 0.06 * Math.min(MAX_DRUNK, f.char.drunk);
  emit(s, { t: 'drunk', side: f.side, n: f.char.drunk });
}

export default {
  id: 'jiugui',
  name: 'Uncle Jiu-Gui',
  short: 'Jiu-Gui',
  title: 'the Staggering Sage',
  glyph: '酒鬼',
  species: 'human',
  archetype: 'Power-up brawler',
  desc: 'Each swig makes him 6% stronger and 100% less predictable. Passes out at six.',
  stats: { pow: 6, spd: 5, def: 6, chi: 7 },
  size: 1,
  traits: { airJumps: 1 },
  voice: { pitch: 0.75, rate: 0.85 },
  colors: { c1: '#a44a3f', c2: '#f2c14e' },
  quote: "Did I win? I'll drink to that. I'll drink to losing too.",
  tauntText: 'Slides a cup of wine across the floor, then is offended when you ignore it.',
  ai: { style: 'brawler', range: 200, proj: 'B', anti: 'U', poke: 'F', ender: 'F', reversal: 'U', airborne: 0.2, buff: 'D' },

  defaultSlots: { N: 'drunkenFlop', F: 'immortalStagger', B: 'spitTake', U: 'hiccupUppercut', D: 'takeSwig' },
  ultras: ['seaOfWine', 'lastCall'],

  hooks: {
    init(f) {
      f.char.drunk = 0;
      f.char.dmgMult = 1;
    },
    perFrame({ s, f }) {
      // drunken lurches while walking
      if (f.st === 'walk' && f.char.drunk > 0 && s.frame % 23 === 0 && !hasBuff(f, 'lastCall')) {
        f.push += (rand(s) - 0.5) * 2 * (2 + f.char.drunk * 1.6);
      }
      if (f.char.drunk > MAX_DRUNK && !hasBuff(f, 'lastCall') && (f.st === 'idle' || f.st === 'walk' || f.st === 'crouch')) {
        f.char.passOut = 120;
        setDrunk(s, f, 0);
        f.move = { id: 'passOut', f: 0, hit: false, contact: false, contactF: 0, mask: 0, last: {}, bonus: false, lights: 0, armor: 0, data: {}, hold: 0 };
        setState(f, 'attack');
        emit(s, { t: 'shout', side: f.side, text: '*hic*... zzz' });
      }
    },
    buffEnd({ s, f, buff }) {
      if (buff.id === 'lastCall') setDrunk(s, f, 2);
    },
  },

  moves: {
    drunkenFlop: {
      name: 'Drunken Flop', glyph: '倒', shout: 'WHOOPS!',
      desc: 'Falls flat under high attacks, then rolls into a sweep.',
      startup: 18, active: 6, recovery: 18, anim: 'flop', lowProfile: [1, 24],
      vel: [{ f: [10, 24], vx: 6 }],
      hits: [{ box: [10, -40, 110, 40], dmg: 90, height: 'low', launch: [2, -5], knockdown: 'soft' }],
    },
    immortalStagger: {
      name: 'Eight Immortals Stagger', glyph: '仙', shout: 'EIGHT IMMORTALS!',
      desc: 'A lurching 5-hit flurry that travels a random distance.',
      startup: 10, active: 24, recovery: 18, anim: 'flurry',
      onStart: ({ s, f, m }) => {
        m.data.v = 2 + rand(s) * 4;
      },
      onFrame: ({ f, m }) => {
        if (m.f >= 8 && m.f <= 32) f.vx = m.data.v * f.facing;
        else if (!f.air) f.vx = 0;
      },
      hits: [
        { f: [10, 28], every: 5, box: [10, -160, 100, 120], dmg: 22, hitstun: 22, kb: 2, jc: 1 },
        { f: [32, 34], box: [10, -160, 110, 120], dmg: 32, launch: [6, -8], knockdown: 'soft' },
      ],
    },
    spitTake: {
      name: 'Spit Take', glyph: '噴', shout: 'PFFFFT!',
      desc: 'A wine spray. At drunk level 3+ it ignites into fire breath.',
      startup: 13, active: 1, recovery: 30, anim: 'spit', sfx: 'splash', hits: [],
      onFrame: ({ s, f, m }) => {
        if (m.f === 13) {
          if (f.char.drunk >= 3 || hasBuff(f, 'lastCall')) {
            spawnProjectile(s, f, 'fireBreath', { x: 60, y: -140 }, m.bonus);
            emit(s, { t: 'sfx', id: 'fire', x: f.x });
          } else spawnProjectile(s, f, 'wineSpray', { x: 60, y: -140 }, m.bonus);
        }
      },
    },
    hiccupUppercut: {
      name: 'Hiccup Uppercut', glyph: '嗝', shout: '*HIC*!',
      desc: 'Reversal. At drunk level 4+ he hiccups twice.',
      startup: 4, active: 22, recovery: 2, anim: 'uppercutBig', sfx: 'hiccup', untilLand: true, landRecovery: 15,
      inv: [{ f: [1, 5], kind: 'strike' }],
      vel: [{ f: [4, 8], vx: 2.5, vy: -13 }, { f: [16, 19], vy: -9 }],
      hits: [
        { f: [4, 12], box: [0, -230, 90, 230], dmg: 110, launch: [2, -14], jc: 2 },
        { f: [16, 22], box: [0, -230, 90, 230], dmg: 50, launch: [3, -12], jc: 1, cond: ({ f }) => f.char.drunk >= 4 || hasBuff(f, 'lastCall') },
      ],
    },
    takeSwig: {
      name: 'Take a Swig', glyph: '酒', shout: 'Cheers!',
      desc: 'Drunk level +1 and 20 chi. Vulnerable while drinking.',
      startup: 1, active: 1, recovery: 38, anim: 'drink', sfx: 'glug', hits: [], counterable: true,
      onFrame: ({ s, f, m }) => {
        if (m.f === 30) {
          setDrunk(s, f, (f.char.drunk || 0) + 1);
          gainChi(f, 20);
        }
      },
    },
    passOut: {
      name: 'Passed Out', hidden: true, kind: 'system', dur: 120, hits: [], anim: 'sleep', counterable: true,
      onStart: () => {},
    },
    seaOfWine: {
      name: 'Eight Immortals Cross the Sea of Wine', glyph: '酒海', shout: 'EIGHT IMMORTALS CROSS THE SEA!', kind: 'ultra',
      desc: 'Summons a tidal wave of rice wine and surfs it on his gourd. 12 hits.',
      startup: 10, active: 56, recovery: 24, anim: 'surf',
      inv: [{ f: [1, 66], kind: 'all' }],
      vel: [{ f: [10, 66], vx: 6.5 }],
      spawn: [{ f: 10, proj: 'wineWave', x: 40, y: -150 }],
      hits: [],
    },
    lastCall: {
      name: 'Last Call', glyph: '最後一杯', shout: 'LAST CALL!', kind: 'ultra',
      desc: 'Chugs to drunk level 5 for 10 seconds without passing out, with a chug burst.',
      startup: 6, active: 6, recovery: 20, anim: 'drink', sfx: 'glug',
      inv: [{ f: [1, 12], kind: 'all' }],
      buff: { id: 'lastCall', t: 600, f: 6 },
      onFrame: ({ s, f, m }) => {
        if (m.f === 6) setDrunk(s, f, MAX_DRUNK);
      },
      hits: [{ box: [-140, -220, 280, 220], dmg: 80, launch: [7, -9], noHurt: true }],
    },
  },

  projectiles: {
    wineSpray: { w: 90, h: 50, vx: 8, life: 34, dmg: 70, hitstun: 22, kb: 6, sprite: 'wine', struggle: true },
    fireBreath: { w: 170, h: 90, vx: 7, life: 30, dmg: 110, hitstun: 26, kb: 9, launch: [5, -7], sprite: 'fire', struggle: true, power: 2 },
    wineWave: {
      w: 280, h: 300, vx: 6.5, life: 60, hits: 12, every: 4, dmg: 32, hitstun: 30, kb: 2, launch: [3, -4], jc: 0,
      sprite: 'wave', ultra: true, power: 9, pierce: true, struggle: true,
    },
  },
};

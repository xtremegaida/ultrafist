// Brother Da Zhong 大鐘 "the Unbreakable Bell" — iron-body Shaolin grappler.

import { spawnProjectile } from '../../sim/projectiles.js';
import { emit } from '../../sim/util.js';

export default {
  id: 'dazhong',
  name: 'Brother Da Zhong',
  short: 'Da Zhong',
  title: 'the Unbreakable Bell',
  glyph: '大鐘',
  species: 'human',
  archetype: 'Armored grappler',
  desc: 'Trained by being rung as the temple bell for forty years. Bricks fear him.',
  stats: { pow: 6, spd: 3, def: 7, chi: 8 },
  size: 1.12,
  traits: { airJumps: 0, hurtScale: 1.1, pushScale: 1.15 },
  voice: { pitch: 0.3, rate: 0.8 },
  colors: { c1: '#e07a1f', c2: '#7f4f24' },
  quote: 'I have taken a vow of silence. ...Starting now.',
  tauntText: 'Breaks a stack of bricks on his own head. The bricks lose.',
  ai: { style: 'grappler', range: 100, proj: null, anti: 'U', poke: 'F', ender: 'F', reversal: 'D', grab: 'N', airborne: 0.05 },

  defaultSlots: { N: 'arhatSuplex', F: 'bronzeRush', B: 'pushupSplash', U: 'prayerLasso', D: 'goldenBell' },
  ultras: ['buddhaPalm', 'chambersPiledriver'],

  hooks: {
    init(f) {
      f.char.ironCd = 0;
    },
    perFrame({ f }) {
      if (f.char.ironCd > 0) f.char.ironCd--;
    },
    // Iron Body: walking forward shrugs off one light hit every second.
    beforeHit({ s, f, h, src }) {
      if (f.st === 'walk' && f.walkDir === 1 && f.char.ironCd <= 0 && h.level === 'light' && !src.proj) {
        f.char.ironCd = 150;
        emit(s, { t: 'armor', side: f.side, x: f.x, y: f.y - 120 });
        return 'armor';
      }
      return null;
    },
    // Landing from a jump sends out a ground ripple.
    onLand({ s, f, impactVy }) {
      if (f.st === 'air' && impactVy > 8) {
        spawnProjectile(s, f, 'ripple', { x: 40, y: -14 });
        const p = spawnProjectile(s, f, 'ripple', { x: -40, y: -14 });
        if (p) p.vx = -p.vx;
        emit(s, { t: 'sfx', id: 'stomp', x: f.x });
      }
      return false;
    },
  },

  moves: {
    arhatSuplex: {
      name: 'Arhat Suplex', glyph: '摔', shout: 'ARHAT SUPLEX!',
      desc: 'Command grab. The whole stage flips upside down.',
      startup: 6, active: 3, recovery: 40, anim: 'grab',
      hits: [{ box: [0, -160, 115, 140], dmg: 0, grab: true, throwKind: 'command' }],
      grabSeq: {
        release: 40,
        hold: (t) => (t < 20 ? [50, -t * 6] : t < 30 ? [50 - (t - 20) * 10, -120 + (t - 20) * 3] : [-50, -40 + (t - 30) * 4]),
        hits: [{ t: 30, dmg: 170, glyph: '摔', sfx: 'stomp', event: 'stageFlip', hitstop: 14 }],
        launch: [-4, -6],
        after: ({ f }) => {
          f.facing = -f.facing;
        },
      },
    },
    bronzeRush: {
      name: 'Eighteen Bronze Men Rush', glyph: '銅', shout: 'BRONZE MEN!',
      desc: 'Armored shoulder charge that bowls the opponent over.',
      startup: 9, active: 18, recovery: 26, anim: 'charge',
      armor: [{ f: [1, 12], hits: 1 }],
      vel: [{ f: [8, 26], vx: 9.5 }],
      hits: [{ f: [10, 26], box: [10, -170, 95, 150], dmg: 90, launch: [9, -5], knockdown: 'soft' }],
    },
    pushupSplash: {
      name: 'One-Finger Push-Up Splash', glyph: '指', shout: 'ONE FINGER!',
      desc: 'Pushes off the floor with one finger and body-splashes from above. Overhead.',
      startup: 12, active: 40, recovery: 2, anim: 'pushup', untilLand: true, landRecovery: 18,
      vel: [{ f: [10, 13], vx: 5, vy: -18 }],
      hits: [{ f: [22, 70], box: [-50, -120, 170, 130], dmg: 130, height: 'overhead', launch: [3, -6], knockdown: 'soft' }],
      onLand: ({ s, f }) => {
        emit(s, { t: 'sfx', id: 'stomp', x: f.x });
      },
    },
    prayerLasso: {
      name: 'Prayer Bead Lasso', glyph: '珠', shout: 'PRAYER BEADS!',
      desc: 'Anti-air grab with an invulnerable upper body.',
      startup: 5, active: 6, recovery: 30, anim: 'lasso',
      inv: [{ f: [1, 6], kind: 'strike' }],
      hits: [{ box: [0, -340, 230, 280], dmg: 0, grab: true, airGrab: true, throwKind: 'command' }],
      grabSeq: {
        release: 26,
        hold: (t) => [70, Math.min(0, -260 + t * 14)],
        hits: [{ t: 20, dmg: 150, glyph: '珠', sfx: 'stomp' }],
        launch: [4, -6],
      },
    },
    goldenBell: {
      name: 'Golden Bell Cover', glyph: '鐘', shout: 'GOLDEN BELL!',
      desc: 'Becomes an actual bronze bell for one second. Absorbs everything, then rings out a shockwave.',
      startup: 4, active: 6, recovery: 18, anim: 'bell', sfx: 'bell',
      armor: [{ f: [4, 44], hits: 99 }], armorDmg: 0, armorStun: 12,
      hits: [{ f: [46, 51], box: [-160, -230, 320, 230], dmg: 70, launch: [8, -8], noHurt: true, sfx: 'bell' }],
      dur: 80,
    },
    buddhaPalm: {
      name: "Buddha's Palm from Heaven", glyph: '如來神掌', shout: "BUDDHA'S PALM!", kind: 'ultra',
      desc: 'A screen-sized palm descends. Only hits grounded opponents — jump!',
      startup: 30, active: 6, recovery: 34, anim: 'prayer', sfx: 'buddhaPalm',
      inv: [{ f: [1, 40], kind: 'all' }],
      hits: [{ f: [30, 35], global: true, box: [0, -150, 0, 150], dmg: 420, groundOnly: true, unblockable: true, launch: [0, -7], knockdown: 'hard', jc: 0, noHurt: true, hitstop: 30 }],
    },
    chambersPiledriver: {
      name: 'Thirty-Six Chambers Piledriver', glyph: '三十六房', shout: 'THIRTY-SIX CHAMBERS!', kind: 'ultra',
      desc: 'Command grab that carries the foe up through 36 temple floors and back down.',
      startup: 6, active: 3, recovery: 40, anim: 'grab',
      hits: [{ box: [0, -170, 125, 150], dmg: 0, grab: true, throwKind: 'command', cine: true }],
      cine: {
        dur: 190, bg: 'chambers',
        a: [[0, 0, 0], [140, 0, -1300, 'ease'], [160, 0, -1300], [186, 0, 0]],
        v: [[0, 50, -40], [140, 50, -1360, 'ease'], [160, 0, -1400], [186, 0, -20]],
        hits: Array.from({ length: 12 }, (_, i) => ({ t: 12 + i * 11, dmg: 22, glyph: String(i * 3 + 3), sfx: 'hitLight' })),
        events: [{ t: 186, ev: 'stageFlip' }],
        final: { dmg: 216, launch: [3, -8], glyph: '卅六' },
      },
    },
  },

  projectiles: {
    ripple: { w: 70, h: 26, vx: 7, life: 26, dmg: 30, height: 'low', hitstun: 16, kb: 4, groundOnly: true, sprite: 'ripple', harmlessToHay: true },
  },
};

// Forbidden Scrolls: universal specials any character can slot into a build for Gong points.


export const SCROLLS = {
  lazyDragon: {
    name: 'Palm of the Lazy Dragon', glyph: '懶龍掌', cost: 2, scroll: true,
    desc: 'A visibly bored dragon drifts forward. Projectile, 80 damage.',
    startup: 14, active: 1, recovery: 32, anim: 'palm', shout: 'LAZY DRAGON PALM!',
    spawn: [{ f: 14, proj: 'lazyDragon', x: 70, y: -110 }], hits: [],
  },
  shadowlessKick: {
    name: 'Shadowless Kick', glyph: '無影腳', cost: 2, scroll: true,
    desc: 'Eight kicks so fast they leave no shadow. Rushes forward, 110 total.',
    startup: 10, active: 24, recovery: 22, anim: 'flurryKick', shout: 'SHADOWLESS KICK!',
    vel: [{ f: [8, 30], vx: 4.5 }],
    hits: [
      { f: [10, 30], every: 3, box: [10, -150, 110, 110], dmg: 12, hitstun: 18, kb: 1, jc: 0 },
      { f: [32, 34], box: [10, -150, 120, 110], dmg: 26, launch: [6, -9], knockdown: 'soft', jc: 1 },
    ],
    sfx: 'swingLight',
  },
  lionsRoar: {
    name: "Lion's Roar", glyph: '獅子吼', cost: 3, scroll: true,
    desc: 'A full-screen shout. 60 damage; knocks airborne opponents out of the sky.',
    startup: 22, active: 6, recovery: 30, anim: 'shout', shout: 'ROOOAAAARRR!',
    hits: [{ box: [-900, -700, 1800, 700], dmg: 60, launch: [5, -6], knockdown: 'hard', kb: 12 }],
    sfx: 'dragon',
  },
  cloudStep: {
    name: 'Cloud Step', glyph: '雲步', cost: 2, scroll: true,
    desc: 'Vanish in a puff of cloud and reappear behind the opponent.',
    startup: 1, active: 1, recovery: 26, anim: 'crouch', shout: 'CLOUD STEP!',
    inv: [{ f: [1, 14], kind: 'all' }], teleport: { f: 10, behind: true, dist: 70 }, hits: [],
    sfx: 'teleport',
  },
  fallingStar: {
    name: 'Falling Star Fist', glyph: '流星拳', cost: 2, scroll: true, air: true, airOk: true,
    desc: 'Dive from the sky like a meteor. 90 damage, ground bounce.',
    startup: 8, active: 30, recovery: 4, landRecovery: 12, anim: 'diveFist', shout: 'FALLING STAR!',
    vel: [{ f: [1, 7], vx: 0, vy: -2 }, { f: [8, 40], vx: 8, vy: 14 }],
    hits: [{ f: [8, 38], box: [0, -80, 80, 90], dmg: 90, groundBounce: true, launch: [3, -6] }],
    groundStart: { vy: -13, vx: 2 }, endOnLand: true,
  },
  inkClone: {
    name: 'Ink Clone', glyph: '墨影', cost: 3, scroll: true,
    desc: 'Summon an ink double that echoes your next 3 attacks at 50% damage.',
    startup: 1, active: 1, recovery: 24, anim: 'cast', shout: 'INK CLONE!',
    buff: { id: 'inkClone', t: 900, n: 3 }, hits: [], sfx: 'splash',
  },
  sevenStep: {
    name: 'Seven-Step Doom Palm', glyph: '七步斷魂', cost: 3, scroll: true,
    desc: 'A gentle tap. After seven steps (or five seconds) it detonates for 130.',
    startup: 9, active: 3, recovery: 18, anim: 'palm', shout: 'SEVEN STEPS...',
    hits: [{ box: [20, -150, 90, 80], dmg: 30, effect: { doom: { t: 300, steps: 7 } } }],
    sfx: 'swingLight',
  },
  teaBreak: {
    name: 'Tea Break', glyph: '茶歇', cost: 1, scroll: true,
    desc: 'Sit down and sip tea for 70 frames, defenceless. +70 chi.',
    startup: 1, active: 1, recovery: 68, anim: 'sit', shout: 'Tea time.',
    gainChi: { f: 60, n: 70 }, hits: [], sfx: 'tea', counterable: true,
  },
  pressurePoint: {
    name: 'Pressure Point', glyph: '點穴', cost: 3, scroll: true,
    desc: 'A 7-frame jab to a secret meridian. 40 damage and the victim freezes for 45 frames.',
    startup: 7, active: 2, recovery: 18, anim: 'jab', shout: 'PRESSURE POINT!',
    hits: [{ box: [20, -150, 80, 34], dmg: 40, hitstun: 45, effect: { frozen: 45 } }],
    sfx: 'swingLight',
  },
};

export const SCROLL_PROJECTILES = {
  lazyDragon: {
    w: 120, h: 70, vx: 5.5, life: 150, dmg: 80, level: 'special', hitstun: 24, kb: 8,
    struggle: true, sprite: 'lazyDragon', power: 2,
  },
};

export const SCROLL_IDS = Object.keys(SCROLLS);

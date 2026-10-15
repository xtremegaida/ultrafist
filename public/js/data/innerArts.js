// Inner Arts: passive techniques. Up to two per build, each costing Gong points.
// Static effects live in `mods`; dynamic effects are implemented in sim/arts.js by id.

export const INNER_ARTS = {
  ironShirt: {
    name: 'Iron Shirt', glyph: '鐵布衫', cost: 3,
    desc: 'Take 10% less damage and ignore chip damage entirely.',
    mods: { dmgTaken: 0.9, noChip: true },
  },
  lightness: {
    name: 'Lightness Skill', glyph: '輕功', cost: 2,
    desc: '+1 air jump, +1 wall-jump and you fall 15% slower.',
    mods: { airJumps: 1, wallJumps: 1, fallMult: 0.85 },
  },
  vampiric: {
    name: 'Vampiric Chi', glyph: '吸星', cost: 3,
    desc: 'Specials and Ultras heal you for 8% of the damage they deal.',
    mods: { lifesteal: 0.08 },
  },
  grudge: {
    name: 'Hundred-Year Grudge', glyph: '百年仇', cost: 2,
    desc: '+5% damage for every 5+ hit combo you suffer (max +20%). Resets when you land a 5-hit combo.',
    mods: { grudge: true },
  },
  gourd: {
    name: 'Bottomless Gourd', glyph: '酒葫蘆', cost: 1,
    desc: 'Taunts give double chi and finish 40% faster.',
    mods: { tauntChiMult: 2, tauntSpeed: 0.6 },
  },
  thousandHand: {
    name: 'Thousand-Hand Afterimage', glyph: '千手', cost: 4,
    desc: 'Light attacks strike twice; the echo deals 40% damage and costs no juggle points.',
    mods: { lightEcho: 0.4 },
  },
  poisonPalm: {
    name: 'Poison Palm', glyph: '毒掌', cost: 3,
    desc: 'Specials poison for 4 damage every 30 frames for 5 s. Stacks 3 times. Cannot KO.',
    mods: { poison: true },
  },
  meridianLock: {
    name: 'Meridian Lock', glyph: '封穴', cost: 2,
    desc: 'Throws drain 60 of the opponent\'s chi and give you 40.',
    mods: { throwDrain: 60, throwGain: 40 },
  },
  secondWind: {
    name: 'Second Wind', glyph: '回春', cost: 2,
    desc: 'Final Awakening triggers at 35% HP instead of 25% and lasts 12 s.',
    mods: { awakenThreshold: 0.35, awakenFrames: 720 },
  },
  goldenBell: {
    name: 'Golden Bell Reflex', glyph: '金鐘罩', cost: 3,
    desc: 'Start blocking within 5 frames of a hit for a Just Defend: no chip, +15 chi, faster recovery.',
    mods: { justDefend: 5 },
  },
  burningBlood: {
    name: 'Burning Blood', glyph: '燃血', cost: 1,
    desc: '+12% damage dealt, but -12% max HP.',
    mods: { dmg: 1.12, hpMult: 0.88 },
  },
};

export const ART_IDS = Object.keys(INNER_ARTS);

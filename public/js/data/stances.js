// Fighting stances. Each build picks exactly one (free). `mods` feed the fighter modifier table.

export const STANCES = {
  tiger: {
    name: 'Tiger', glyph: '虎',
    desc: 'Heavies hit 12% harder and reach 10% further. Lights start 2 frames slower.',
    mods: { heavyDmg: 1.12, heavyReach: 1.1, lightStartup: 2 },
  },
  crane: {
    name: 'Crane', glyph: '鶴',
    desc: '+1 air jump and air attacks get 20% bigger hitboxes. Ground heavies deal 10% less.',
    mods: { airJumps: 1, airBox: 1.2, groundHeavyDmg: 0.9 },
  },
  mantis: {
    name: 'Mantis', glyph: '螳',
    desc: 'Chain up to 5 light attacks; counter-hits deal x1.35. Heavies deal 10% less.',
    mods: { lightChain: 5, counterMult: 1.35, heavyDmg: 0.9 },
  },
  snake: {
    name: 'Snake', glyph: '蛇',
    desc: 'Crouching attacks reach 30% further and Shin Tap starts in 3 frames. Guard bar 20% smaller.',
    mods: { crouchReach: 1.3, cLStartup: 3, guardMult: 0.8 },
  },
  monkey: {
    name: 'Monkey', glyph: '猴',
    desc: 'Dashes 30% faster and pass through opponents. Taunts take 30 frames. DEF -1.',
    mods: { dashMult: 1.3, crossDash: true, tauntFrames: 30, defDelta: -1 },
  },
  iron: {
    name: 'Iron', glyph: '鐵',
    desc: 'Roundhouse absorbs one hit; chip damage halved. Walk 15% slower; no qinggong air jump.',
    mods: { sHArmor: 1, chipTaken: 0.5, walkMult: 0.85, noAirJump: true },
  },
};

export const STANCE_IDS = Object.keys(STANCES);

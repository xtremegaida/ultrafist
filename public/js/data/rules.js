// Global tuning constants. All times are in frames at 60 fps; distances in world units.
// World: floor at y = 0, y grows downward (airborne fighters have y < 0).

export const RULES = {
  FPS: 60,
  STAGE_W: 1600,
  WALL_MARGIN: 36,
  MAX_SEPARATION: 1000,

  GRAVITY: 0.8,
  MAX_FALL: 18,
  JUMP_VY: -17,
  AIR_JUMP_VY: -14,
  WALLJUMP_VY: -15,
  WALLJUMP_VX: 7,
  JUMP_SQUAT: 4,
  LANDING: 3,
  LANDING_WHIFF: 8,

  WALK_BASE: 2.0,
  WALK_PER_SPD: 0.25,
  WALK_BACK_MULT: 0.8,
  JUMP_VX_BASE: 3.2,
  JUMP_VX_PER_SPD: 0.18,
  DASH_F: { frames: 18, dist: 220 },
  DASH_B: { frames: 20, dist: 160, inv: [1, 6] },
  DASH_TAP_WINDOW: 12,
  CHORD_WINDOW: 2,
  BUFFER: 8,

  HP_BASE: 850,
  HP_PER_DEF: 30,
  POW_BASE: 0.8,
  POW_PER: 0.04,
  CHI_BASE: 0.75,
  CHI_PER: 0.05,

  CHI_MAX: 300,
  CHI_BAR: 100,
  CHI_ON_HIT: 0.10,
  CHI_ON_DAMAGED: 0.07,
  CHI_ON_BLOCK: 3,
  CHI_ON_BLOCKED: 2,
  CHI_WALK: 0.05,
  CHI_WHIFF_SPECIAL: 4,
  CHI_TAUNT: 30,
  TAUNT_COOLDOWN: 480,
  TAUNT_FRAMES: 50,

  COST_CHI_CANCEL: 100,
  COST_QI_BURST: 200,
  COST_ULTRA: 300,
  COST_ULTRA_AWAKENED: 200,

  AUTHENTIC_DMG: 1.15,
  AUTHENTIC_CHI: 1.25,
  COUNTER_DMG: 1.2,
  COUNTER_HITSTOP: 4,
  TAUNT_COUNTER_DMG: 1.5,

  CHIP: { normal: 0, special: 0.2, ultra: 0.25 },
  GUARD_BASE: 100,
  GUARD_PER_DEF: 10,
  GUARD_DRAIN: 0.3,
  GUARD_REGEN: 0.6,
  GUARD_REGEN_DELAY: 60,
  GUARD_BREAK_STUN: 50,
  PROXIMITY_GUARD: 320,

  JUGGLE_LIMIT: 10,
  JUGGLE_GRAVITY: 0.07,
  SCALE_STEP: 0.1,
  SCALE_FLOOR: 0.3,
  SCALE_FLOOR_ULTRA: 0.5,
  REPEAT_PENALTY: 0.5,

  HITSTOP: { light: 6, heavy: 10, special: 12, ultra: 14, block: 4, ultraFinal: 30, ko: 45, clink: 12 },
  HITSTUN: { light: 14, heavy: 20, special: 22, ultra: 30 },
  BLOCKSTUN: { light: 10, heavy: 15, special: 16, ultra: 18 },
  PUSHBACK: { light: 5, heavy: 7, special: 8, ultra: 10 },

  KNOCKDOWN: 40,
  KNOCKDOWN_HARD: 52,
  QUICK_RISE: 22,
  WAKE_THROW_INV: 4,
  WAKE_STRIKE_INV: 3,
  FLIPOUT_INV: 12,

  THROW: { startup: 5, active: 2, recovery: 22, range: 110, dmg: 120, airDmg: 100, tech: 8, protect: 4 },

  AWAKEN_THRESHOLD: 0.25,
  AWAKEN_FRAMES: 600,
  AWAKEN_DMG: 1.15,
  AWAKEN_FLASH: 40,

  CLASH: { special: 180, ultra: 300, cooldown: 600, tugMax: 50, surge: 12, winMult: 1.5, ultraWinMult: 1.75, tieChi: 25 },

  ROUND_TIME: 99,
  WINS: 2,
  INTRO_FRAMES: 130,
  FIGHT_FRAMES: 40,
  KO_FRAMES: 160,
  ROUND_END_FRAMES: 130,
  MATCH_END_FRAMES: 240,
  SUPER_FREEZE: 70,
  KO_SLOW: { frames: 60, div: 4 },
};

// Combo titles that escalate as the hit count climbs.
export const COMBO_TITLES = [
  { n: 3, text: 'Good Form', glyph: '好' },
  { n: 5, text: 'Skilled', glyph: '妙' },
  { n: 10, text: 'HEAVENLY', glyph: '天' },
  { n: 15, text: 'SAGE', glyph: '聖' },
  { n: 20, text: 'GRANDMASTER', glyph: '宗' },
  { n: 30, text: 'UNBELIEVABLE KUNG FU', glyph: '神' },
  { n: 40, text: 'FORBIDDEN TECHNIQUE', glyph: '禁' },
  { n: 50, text: 'ANCESTORS WEEP', glyph: '泣' },
  { n: 75, text: 'THE SCROLLS WERE TRUE', glyph: '經' },
  { n: 100, text: 'ASCENDED', glyph: '仙' },
];

export function comboTier(n) {
  let tier = 0;
  for (let i = 0; i < COMBO_TITLES.length; i++) if (n >= COMBO_TITLES[i].n) tier = i + 1;
  return tier;
}

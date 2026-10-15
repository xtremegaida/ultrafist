// Arena definitions (descriptive data). Hazard logic lives in sim/stage.js; drawing in render/stages/.

export const STAGES = {
  bamboo: {
    name: 'Whispering Bamboo Forest', glyph: '竹林', music: 'bamboo',
    desc: 'Heavy blows fell the bamboo poles, crushing whoever stands beneath them.',
    hazards: ['bamboo'],
  },
  rooftop: {
    name: 'Temple Rooftop at Midnight', glyph: '屋頂', music: 'rooftop',
    desc: 'Slippery tiles make dashes go further. Lanterns knocked down leave burning patches.',
    hazards: ['lanterns'], dashMult: 1.15,
  },
  teahouse: {
    name: 'Drunken Lotus Tea House', glyph: '茶樓', music: 'teahouse',
    desc: 'Mind the waiter with the scalding tea, and the tables by the walls.',
    hazards: ['waiter', 'tables'],
  },
  barnyard: {
    name: 'Barnyard at Dawn', glyph: '農場', music: 'barnyard',
    desc: 'Hay bales stop projectiles. Kick a passing chicken for chi.',
    hazards: ['chickens', 'hay'],
  },
  waterfall: {
    name: 'Waterfall Peak', glyph: '瀑布', music: 'waterfall',
    desc: 'The waterfall in the middle slows projectiles. Stand on the meditation rock to heal.',
    hazards: ['waterfall', 'rock'],
  },
  cloud: {
    name: "Jade Emperor's Cloud Court", glyph: '天庭', music: 'cloud',
    desc: 'Heavenly gravity is gentler, and celestial gusts shove everyone across the court.',
    hazards: ['cloud'], gravity: 0.85,
  },
};

export const STAGE_IDS = Object.keys(STAGES);

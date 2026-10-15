// Arena definitions (descriptive data). Hazard logic lives in sim/stage.js; drawing in render/stages.js.
//
// Every arena hides an area behind it (`beyond`). A KO that smashes the loser through the scenery
// sends the next round there; another crash KO sends the fight back. Hidden areas can't be picked
// on the stage select.

export const STAGES = {
  bamboo: {
    name: 'Whispering Bamboo Forest', glyph: '竹林', music: 'bamboo',
    desc: 'Heavy blows fell the bamboo poles, crushing whoever stands beneath them.',
    hazards: ['bamboo'], beyond: 'lotus',
  },
  rooftop: {
    name: 'Temple Rooftop at Midnight', glyph: '屋頂', music: 'rooftop',
    desc: 'Slippery tiles make dashes go further. Lanterns knocked down leave burning patches.',
    hazards: ['lanterns'], dashMult: 1.15, beyond: 'buddhas',
  },
  teahouse: {
    name: 'Drunken Lotus Tea House', glyph: '茶樓', music: 'teahouse',
    desc: 'Mind the waiter with the scalding tea, and the tables by the walls.',
    hazards: ['waiter', 'tables'], beyond: 'kitchen',
  },
  barnyard: {
    name: 'Barnyard at Dawn', glyph: '農場', music: 'barnyard',
    desc: 'Hay bales stop projectiles. Kick a passing chicken for chi.',
    hazards: ['chickens', 'hay'], beyond: 'pigpen',
  },
  waterfall: {
    name: 'Waterfall Peak', glyph: '瀑布', music: 'waterfall',
    desc: 'The waterfall in the middle slows projectiles. Stand on the meditation rock to heal.',
    hazards: ['waterfall', 'rock'], beyond: 'cave',
  },
  cloud: {
    name: "Jade Emperor's Cloud Court", glyph: '天庭', music: 'cloud',
    desc: 'Heavenly gravity is gentler, and celestial gusts shove everyone across the court.',
    hazards: ['cloud'], gravity: 0.85, beyond: 'peaches',
  },

  // ---- hidden areas -----------------------------------------------------------------------------
  lotus: {
    hidden: true, parent: 'bamboo', beyond: 'bamboo',
    name: 'Moonlit Lotus Pond', glyph: '蓮池', music: 'bamboo',
    desc: 'Through the bamboo and onto the lily pads. Slick pads send dashes skidding further.',
    hazards: [], dashMult: 1.2,
  },
  buddhas: {
    hidden: true, parent: 'rooftop', beyond: 'rooftop',
    name: 'Hall of a Thousand Buddhas', glyph: '千佛殿', music: 'rooftop',
    desc: 'Straight through the roof tiles. The temple lanterns burn just as hot when they fall.',
    hazards: ['lanterns'],
  },
  kitchen: {
    hidden: true, parent: 'teahouse', beyond: 'teahouse',
    name: 'Tea House Kitchen', glyph: '廚房', music: 'teahouse',
    desc: 'Through the wall and into the kitchen: a grease spill in the middle, chopping blocks by the walls.',
    hazards: ['tables'], zones: [{ kind: 'lard', x: 800, w: 240 }],
  },
  pigpen: {
    hidden: true, parent: 'barnyard', beyond: 'barnyard',
    name: 'The Pigpen', glyph: '豬圈', music: 'barnyard',
    desc: 'Through the fence. Two mud wallows slow down anyone who is not a pig.',
    hazards: ['chickens'], zones: [{ kind: 'mud', x: 470, w: 230 }, { kind: 'mud', x: 1130, w: 230 }],
  },
  cave: {
    hidden: true, parent: 'waterfall', beyond: 'waterfall',
    name: 'Water Curtain Cave', glyph: '水簾洞', music: 'waterfall',
    desc: 'Behind the falls. A meditation stone on each side heals whoever stands still on it.',
    hazards: ['rocks'],
  },
  peaches: {
    hidden: true, parent: 'cloud', beyond: 'cloud',
    name: 'Peach Garden of Immortality', glyph: '蟠桃園', music: 'cloud',
    desc: 'Down through the clouds into the Queen Mother\'s orchard. Peaches of immortality fall from the trees.',
    hazards: ['peaches'], gravity: 0.92,
  },
};

// selectable arenas (hidden areas are only reached through the scenery)
export const STAGE_IDS = Object.keys(STAGES).filter((id) => !STAGES[id].hidden);
export const AREA_IDS = Object.keys(STAGES).filter((id) => STAGES[id].hidden);

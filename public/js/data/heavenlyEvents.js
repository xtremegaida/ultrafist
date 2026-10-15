// Heavenly Events: random mid-round modifiers announced with a gong and an unrolling scroll.

export const HEAVENLY_EVENTS = {
  moon: { name: 'Moon Festival', glyph: '月', desc: 'Gravity halves. Everyone gets an extra air jump.' },
  tea: { name: 'Rain of Tea', glyph: '茶', desc: 'Anyone not attacking slowly heals.' },
  ancestors: { name: 'Ancestors Watching', glyph: '祖', desc: 'All damage is doubled. Do not disappoint them.' },
  dragon: { name: 'Dragon Flyover', glyph: '龍', desc: 'A dragon sweeps across the arena. Jump!' },
  fortune: { name: 'Fortune Cookie Storm', glyph: '福', desc: 'Peaches, chi orbs and chillies fall from the sky.' },
  turtle: { name: 'Turtle Time', glyph: '龜', desc: 'Time itself slows to a crawl.' },
  ghosts: { name: 'Hungry Ghosts', glyph: '鬼', desc: 'The lights go out. Only auras remain.' },
  decree: { name: "Emperor's Decree", glyph: '令', desc: 'The next hit is a counter-hit and grants 100 chi.' },
};

export const EVENT_IDS = Object.keys(HEAVENLY_EVENTS);

// [min, max] seconds between events for each frequency setting
export const EVENT_FREQ = {
  off: null,
  rare: [45, 60],
  normal: [25, 40],
  chaos: [10, 15],
};

export const EVENT_DURATION = 600;

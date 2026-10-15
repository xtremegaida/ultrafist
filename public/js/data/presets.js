// Two preset builds per character. All cost 8 Gong or less.

const P = (charId, key, name, stance, arts, ultra, slots = {}, extra = {}) => ({
  id: `preset.${charId}.${key}`, preset: true, name, charId, stance, arts, ultra, slots, statDelta: {}, bonusStats: 0, ...extra,
});

export const PRESETS = [
  P('longxu', 'lecture', 'Lecture Hall', 'crane', ['goldenBell', 'vampiric'], 'tempest'),
  P('longxu', 'youth', 'Second Youth', 'tiger', ['secondWind', 'burningBlood'], 'reverseAging', { D: 'cloudStep' }),
  P('waiya', 'silk', 'Silk Storm', 'crane', ['lightness', 'thousandHand'], 'tenThousandSwords'),
  P('waiya', 'puppet', 'Puppeteer', 'mantis', ['poisonPalm'], 'stagehandUnion', { B: 'pressurePoint' }),
  P('jiugui', 'happy', 'Happy Hour', 'monkey', ['gourd', 'grudge'], 'lastCall'),
  P('jiugui', 'designated', 'Designated Fighter', 'snake', ['ironShirt'], 'seaOfWine', { D: 'teaBreak' }),
  P('dazhong', 'bell', 'Unmovable Bell', 'iron', ['ironShirt', 'goldenBell'], 'buddhaPalm'),
  P('dazhong', 'floors', '36 Floors', 'tiger', ['meridianLock', 'burningBlood'], 'chambersPiledriver', { B: 'lionsRoar' }),
  P('jidao', 'sky', 'Sky Tyrant', 'crane', ['lightness', 'vampiric'], 'sunriseInferno'),
  P('jidao', 'dawn', 'Eternal Dawn', 'mantis', ['secondWind', 'poisonPalm'], 'phoenixReborn'),
  P('moolan', 'dairy', 'Dairy Fortress', 'iron', ['goldenBell', 'vampiric'], 'overTheMoon'),
  P('moolan', 'season', 'Stampede Season', 'tiger', ['grudge', 'burningBlood'], 'tenThousandHead', { B: 'shadowlessKick' }),
  P('hamfu', 'slip', "Slip 'n' Slaughter", 'snake', ['poisonPalm', 'lightness'], 'whenPigsFly'),
  P('hamfu', 'banquet', 'Banquet Boss', 'iron', ['ironShirt', 'gourd'], 'eightTreasures'),
  P('shanyang', 'cliff', 'Cliff Demon', 'monkey', ['lightness', 'meridianLock'], 'goatAscension'),
  P('shanyang', 'screamo', 'Screamo', 'tiger', ['grudge', 'goldenBell'], 'thousandPeaks', { N: 'lionsRoar' }),
];

export function presetsFor(charId) {
  return PRESETS.filter((p) => p.charId === charId);
}

export function defaultBuild(charId) {
  return presetsFor(charId)[0];
}

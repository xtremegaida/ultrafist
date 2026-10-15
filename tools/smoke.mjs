// Quick headless smoke run: random inputs, all character pairs, all stages.
import { createMatch, step } from '../public/js/sim/index.js';
import { CHAR_IDS } from '../public/js/data/characters/index.js';
import { STAGE_IDS } from '../public/js/data/stages.js';
import { presetsFor } from '../public/js/data/presets.js';

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
let matches = 0, frames = 0;
const evCounts = {};
for (const a of CHAR_IDS) for (const b of CHAR_IDS) {
  const stageId = STAGE_IDS[matches % STAGE_IDS.length];
  const pa = presetsFor(a)[matches % 2], pb = presetsFor(b)[(matches + 1) % 2];
  const s = createMatch({ seed: matches + 1, stageId, builds: [pa, pb], events: 'chaos' });
  let ia = 0, ib = 0;
  for (let i = 0; i < 60 * 60 * 6 && s.phase !== 'matchEnd'; i++) {
    if (i % 4 === 0) { ia = Math.floor(rnd() * 256); ib = Math.floor(rnd() * 256); }
    if (rnd() < 0.3) { ia &= 0x0f; }
    if (rnd() < 0.3) { ib &= 0x0f; }
    step(s, [ia, ib]);
    frames++;
    for (const e of s.events) evCounts[e.t] = (evCounts[e.t] || 0) + 1;
    for (const f of s.fighters) {
      for (const k of ['x', 'y', 'vx', 'vy', 'hp', 'chi']) if (!Number.isFinite(f[k])) throw new Error(`${a} vs ${b}: ${k} not finite at frame ${s.frame}: ${f[k]} st=${f.st} move=${f.move?.id}`);
      if (f.x < -1 || f.x > 1601) throw new Error(`${a} vs ${b}: out of bounds x=${f.x} st=${f.st}`);
    }
  }
  matches++;
  if (s.phase !== 'matchEnd') console.log(`no finish: ${a} vs ${b} phase=${s.phase} round=${s.round} wins=${s.wins}`);
}
console.log(`matches=${matches} frames=${frames}`);
console.log(Object.entries(evCounts).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}:${v}`).join(' '));

// AI-vs-AI soak test: every character pair x several seeds. Reports win rates and invariant failures.
// Usage: node tools/soak.js [seedsPerPair=2] [level=3]
import { createMatch, step } from '../public/js/sim/index.js';
import { createAI, aiInput } from '../public/js/sim/ai.js';
import { CHAR_IDS } from '../public/js/data/characters/index.js';
import { STAGE_IDS } from '../public/js/data/stages.js';
import { presetsFor } from '../public/js/data/presets.js';

const SEEDS = Number(process.argv[2] || 2);
const LEVEL = Number(process.argv[3] ?? 3);
const MAX_FRAMES = 60 * 60 * 8;

const wins = Object.fromEntries(CHAR_IDS.map((c) => [c, { w: 0, n: 0 }]));
const pairs = {};
const stats = { matches: 0, frames: 0, unfinished: 0, ultras: 0, specials: 0, authentic: 0, timeouts: 0, kos: {}, areas: {} };
let failures = 0;
const t0 = Date.now();

for (const a of CHAR_IDS) {
  for (const b of CHAR_IDS) {
    for (let k = 0; k < SEEDS; k++) {
      const seed = stats.matches * 7919 + 13;
      const s = createMatch({
        seed, stageId: STAGE_IDS[stats.matches % STAGE_IDS.length], events: 'normal',
        builds: [presetsFor(a)[k % 2], presetsFor(b)[(k + 1) % 2]],
      });
      const ais = [createAI(LEVEL, 0, seed + 1), createAI(LEVEL, 1, seed + 2)];
      let i = 0;
      for (; i < MAX_FRAMES && s.phase !== 'matchEnd'; i++) {
        step(s, [aiInput(ais[0], s), aiInput(ais[1], s)]);
        for (const e of s.events) {
          if (e.t === 'ko') stats.kos[e.type] = (stats.kos[e.type] || 0) + 1;
          if (e.t === 'timeUp') stats.timeouts++;
          if (e.t === 'stageChange') stats.areas[e.id] = (stats.areas[e.id] || 0) + 1;
        }
        for (const f of s.fighters) {
          f._stuck = f.st === 'launched' || f.st === 'hitstun' || f.st === 'grabbed' ? (f._stuck || 0) + 1 : 0;
          if (f._stuck === 900) {
            failures++;
            console.log(`STUCK ${f.st} ${a} vs ${b} seed ${seed} frame ${s.frame} side ${f.side} y=${f.y.toFixed(0)} vy=${f.vy}`);
          }
          if (f.y < -2500) {
            failures++;
            console.log(`FLEW AWAY ${a} vs ${b} seed ${seed} frame ${s.frame} side ${f.side} st=${f.st}`);
            i = MAX_FRAMES;
          }
          for (const key of ['x', 'y', 'vx', 'vy', 'hp', 'chi']) {
            if (!Number.isFinite(f[key])) {
              failures++;
              console.log(`NaN ${key} ${a} vs ${b} seed ${seed} frame ${s.frame} st=${f.st} move=${f.move?.id}`);
              i = MAX_FRAMES;
            }
          }
        }
      }
      stats.frames += i;
      stats.matches++;
      for (const f of s.fighters) {
        stats.ultras += f.stat.ultras;
        stats.specials += f.stat.specials;
        stats.authentic += f.stat.authentic;
      }
      if (s.phase !== 'matchEnd') {
        stats.unfinished++;
        continue;
      }
      const w = s.winner;
      const wc = w === 0 ? a : b;
      wins[a].n++;
      wins[b].n++;
      wins[wc].w++;
      if (a !== b) {
        const key = [a, b].sort().join(' v ');
        pairs[key] = pairs[key] || {};
        pairs[key][wc] = (pairs[key][wc] || 0) + 1;
      }
    }
  }
}

console.log(`level ${LEVEL}: ${stats.matches} matches, ${stats.unfinished} unfinished, ${(stats.frames / 3600).toFixed(1)} min of game time in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`ultras ${stats.ultras}, specials ${stats.specials}, authentic ${stats.authentic}, timeouts ${stats.timeouts}, KO types ${JSON.stringify(stats.kos)}`);
console.log(`stage transitions ${JSON.stringify(stats.areas)}`);
for (const c of CHAR_IDS) console.log(`${c.padEnd(9)} win rate ${((wins[c].w / Math.max(1, wins[c].n)) * 100).toFixed(0).padStart(3)}%  (${wins[c].w}/${wins[c].n})`);
if (failures) {
  console.log(`FAILURES: ${failures}`);
  process.exitCode = 1;
}

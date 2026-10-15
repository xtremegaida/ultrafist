// Simulation tests: purity, determinism, motion inputs, combat rules, builds, roster integrity.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMatch, step } from '../public/js/sim/index.js';
import { createInputState, feedInput, detectMotion, BTN, dirToBits, motionSequence } from '../public/js/sim/input.js';
import { resolveBuild, buildCost, BUDGET } from '../public/js/sim/builds.js';
import { pack } from '../public/js/sim/pack.js';
import { createAI, aiInput } from '../public/js/sim/ai.js';
import { getMove, getProj, getChar, CHAR_IDS, SCROLLS } from '../public/js/data/registry.js';
import { PRESETS, presetsFor } from '../public/js/data/presets.js';
import { RULES } from '../public/js/data/rules.js';
import { STAGES, STAGE_IDS, AREA_IDS } from '../public/js/data/stages.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- helpers ------------------------------------------------------------------------------------

function fightReady(a = 'longxu', b = 'dazhong', opts = {}) {
  const s = createMatch({ seed: opts.seed ?? 42, stageId: opts.stage ?? 'waterfall', events: 'off', builds: [presetsFor(a)[0], presetsFor(b)[0]], ...opts.cfg });
  for (let i = 0; i < 400 && s.phase !== 'fight'; i++) step(s, [0, 0]);
  assert.equal(s.phase, 'fight');
  return s;
}

function place(s, dist = 100) {
  const [p1, p2] = s.fighters;
  p1.x = 800 - dist / 2;
  p2.x = 800 + dist / 2;
  p1.facing = 1;
  p2.facing = -1;
}

function run(s, n, a = 0, b = 0) {
  const evs = [];
  for (let i = 0; i < n; i++) {
    step(s, [typeof a === 'function' ? a(i) : a, typeof b === 'function' ? b(i) : b]);
    evs.push(...s.events);
  }
  return evs;
}

// press a button for one frame then release
const tap = (byte, at = 0) => (i) => (i === at ? byte : 0);
const BACK_P2 = BTN.R; // P2 faces left, so holding right is "back"

// ---- purity ------------------------------------------------------------------------------------

describe('sim purity', () => {
  test('sim/ never touches the DOM, wall clock or Math.random, nor imports render code', () => {
    const dir = path.join(ROOT, 'public/js/sim');
    for (const file of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      for (const bad of [/\bdocument\./, /\bwindow\./, /Math\.random/, /\bDate\b/, /performance\./, /from '\.\.\/render/, /from '\.\.\/audio/]) {
        assert.ok(!bad.test(src), `${file} must not match ${bad}`);
      }
    }
  });

  test('character data hooks are pure too', () => {
    const dir = path.join(ROOT, 'public/js/data/characters');
    for (const file of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      assert.ok(!/Math\.random|\bDate\b|document\.|window\./.test(src), file);
    }
  });
});

// ---- determinism ---------------------------------------------------------------------------------

describe('determinism', () => {
  test('same seed + same inputs => identical state', () => {
    const play = () => {
      const s = createMatch({ seed: 1234, stageId: 'barnyard', events: 'chaos', builds: [presetsFor('jidao')[1], presetsFor('hamfu')[0]] });
      const ai = [createAI(3, 0, 5), createAI(4, 1, 6)];
      for (let i = 0; i < 3000; i++) step(s, [aiInput(ai[0], s), aiInput(ai[1], s)]);
      return JSON.stringify(pack(s));
    };
    assert.equal(play(), play());
  });

  test('pack() output is JSON-safe and carries what the renderer needs', () => {
    const s = fightReady('moolan', 'waiya');
    run(s, 120, (i) => (i % 20 === 0 ? BTN.SP : 0));
    const v = JSON.parse(JSON.stringify(pack(s)));
    for (const k of ['phase', 'phaseT', 'round', 'wins', 'timer', 'stage', 'fighters', 'projectiles', 'zones', 'props', 'pickups', 'cfg']) assert.ok(k in v, k);
    for (const f of v.fighters) {
      for (const k of ['charId', 'x', 'y', 'facing', 'scale', 'st', 'stT', 'hp', 'maxHp', 'chi', 'guard', 'guardMax', 'buffs', 'status', 'char', 'combo', 'stat']) assert.ok(k in f, `fighter.${k}`);
    }
  });
});

// ---- motion inputs -------------------------------------------------------------------------------

function motionAfter(seq, facing = 1, holdFrames = 1) {
  const inp = createInputState();
  for (let i = 0; i < 20; i++) feedInput(inp, 0, facing, false);
  for (const d of seq) for (let k = 0; k < holdFrames; k++) feedInput(inp, dirToBits(d, facing), facing, false);
  return detectMotion(inp, facing);
}

describe('motion parser', () => {
  const cases = [
    [[2, 3, 6], 'qcf'],
    [[2, 1, 4], 'qcb'],
    [[6, 2, 3], 'dp'],
    [[3, 2, 3], 'dp'],
    [[6, 2, 3, 6], 'dp'], // overshot DP still reads as DP
    [[4, 1, 2, 3, 6], 'hcf'],
    [[2, 5, 2], 'dd'],
    [[2, 3, 6, 2, 3, 6], 'dqcf'],
    [[6, 6, 6], null],
    [[2], null],
  ];
  for (const [seq, want] of cases) {
    test(`${seq.join('')} -> ${want}`, () => assert.equal(motionAfter(seq), want));
  }
  test('motions are relative to facing', () => {
    assert.equal(motionAfter([2, 3, 6], -1), 'qcf');
  });
  test('a long walk forward into a QCF is not a DP', () => {
    const inp = createInputState();
    for (let i = 0; i < 30; i++) feedInput(inp, dirToBits(6, 1), 1, false);
    for (const d of [2, 3, 6]) feedInput(inp, dirToBits(d, 1), 1, false);
    assert.equal(detectMotion(inp, 1), 'qcf');
  });
  test('long back-blocking into a QCF is not an HCF', () => {
    const inp = createInputState();
    for (let i = 0; i < 40; i++) feedInput(inp, dirToBits(4, 1), 1, false);
    for (const d of [1, 2, 3, 6]) feedInput(inp, dirToBits(d, 1), 1, false);
    assert.equal(detectMotion(inp, 1), 'qcf');
  });
  test('too slow is no motion', () => {
    assert.equal(motionAfter([2, 3, 6], 1, 9), null);
  });
  test('motion + Special in a real match is an Authentic Technique', () => {
    const s = fightReady('jidao', 'dazhong');
    place(s, 400);
    const seq = motionSequence('qcf', 1);
    const evs = run(s, 6, (i) => (i < 3 ? seq[i] : i === 3 ? seq[2] | BTN.SP : 0));
    const mv = evs.find((e) => e.t === 'move' && e.side === 0);
    assert.ok(mv, 'a move started');
    assert.equal(mv.id, s.fighters[0].build.slots.F);
    assert.equal(mv.bonus, true);
  });
  test('Special + direction (simple input) picks the slot without the bonus', () => {
    const s = fightReady('jidao', 'dazhong');
    place(s, 400);
    const evs = run(s, 3, tap(BTN.R | BTN.SP));
    const mv = evs.find((e) => e.t === 'move' && e.side === 0);
    assert.equal(mv.id, s.fighters[0].build.slots.F);
    assert.equal(mv.bonus, false);
  });
  test('buffered presses survive hit-stop', () => {
    const inp = createInputState();
    feedInput(inp, BTN.LP, 1, false);
    for (let i = 0; i < 30; i++) feedInput(inp, BTN.LP, 1, true);
    assert.ok(inp.buf.lp > 0);
  });
});

// ---- combat rules --------------------------------------------------------------------------------

describe('combat', () => {
  test('standing block stops a mid, fails against a low; crouch block stops the low', () => {
    let s = fightReady();
    place(s, 90);
    let evs = run(s, 20, tap(BTN.HP), BACK_P2);
    assert.ok(evs.some((e) => e.t === 'block'), 'sH blocked standing');

    s = fightReady();
    place(s, 90);
    evs = run(s, 20, tap(BTN.D | BTN.LP), BACK_P2);
    assert.ok(evs.some((e) => e.t === 'hit' && e.d === 1), 'low hits a standing blocker');

    s = fightReady();
    place(s, 90);
    evs = run(s, 20, tap(BTN.D | BTN.LP), BACK_P2 | BTN.D);
    assert.ok(evs.some((e) => e.t === 'block'), 'low blocked crouching');
  });

  test('overhead jump attack beats a crouch block', () => {
    const s = fightReady();
    place(s, 160);
    const evs = run(s, 60, (i) => (i < 3 ? BTN.U | BTN.R : i === 30 ? BTN.HP : 0), BACK_P2 | BTN.D);
    assert.ok(evs.some((e) => e.t === 'hit' && e.d === 1), 'jH hits a crouch-blocker');
  });

  test('chip damage from specials never KOs; ultra chip can', () => {
    const s = fightReady('moolan', 'longxu');
    place(s, 300);
    s.fighters[1].hp = 3;
    s.fighters[1].awakenUsed = true;
    run(s, 80, tap(BTN.SP), BACK_P2);
    assert.ok(s.fighters[1].hp >= 1, 'special chip leaves at least 1 HP');

    const u = fightReady('shanyang', 'longxu');
    u.fighters[0].build.ultra = 'thousandPeaks';
    place(u, 300);
    u.fighters[0].chi = 300;
    u.fighters[1].hp = 3;
    u.fighters[1].awakenUsed = true;
    run(u, 200, tap(BTN.HP | BTN.SP), BACK_P2);
    assert.ok(u.fighters[1].hp <= 0 || u.phase !== 'fight', 'ultra chip can finish');
  });

  test('damage scaling never drops below the floor', () => {
    const s = fightReady('waiya', 'dazhong');
    place(s, 90);
    const victim = s.fighters[1];
    victim.combo.n = 30;
    const before = victim.hp;
    run(s, 20, tap(BTN.HP));
    const dealt = before - victim.hp;
    const raw = getMove('sH').hits[0].dmg * (RULES.POW_BASE + RULES.POW_PER * s.fighters[0].stats.pow);
    assert.ok(dealt >= Math.floor(raw * RULES.SCALE_FLOOR * 0.85), `dealt ${dealt} >= floor`);
  });

  test('juggle limit: an over-juggled fighter flips out', () => {
    const s = fightReady('jidao', 'hamfu');
    place(s, 90);
    const v = s.fighters[1];
    v.juggle = RULES.JUGGLE_LIMIT;
    v.st = 'launched';
    v.air = true;
    v.y = -200;
    v.vy = 4;
    const evs = run(s, 10);
    assert.ok(evs.some((e) => e.t === 'flip' && e.side === 1));
  });

  test('throws can be teched with L+H', () => {
    const s = fightReady();
    place(s, 70);
    const evs = run(s, 30, tap(BTN.LP | BTN.HP), (i) => (i === 7 ? BTN.LP | BTN.HP : 0));
    assert.ok(evs.some((e) => e.t === 'tech'));
    assert.equal(s.fighters[1].hp, s.fighters[1].maxHp);
  });

  test('untechned throw deals damage and knocks down', () => {
    const s = fightReady();
    place(s, 70);
    const evs = run(s, 60, tap(BTN.LP | BTN.HP));
    assert.ok(evs.some((e) => e.t === 'grab'));
    assert.ok(s.fighters[1].hp < s.fighters[1].maxHp);
  });

  test('guard break after sustained blocking', () => {
    const s = fightReady('dazhong', 'waiya');
    place(s, 90);
    s.fighters[1].guard = 10;
    const evs = run(s, 30, tap(BTN.HP), BACK_P2);
    assert.ok(evs.some((e) => e.t === 'guardBreak'));
  });

  test('Final Awakening triggers once per round below 25% HP', () => {
    const s = fightReady();
    place(s, 400);
    s.fighters[0].hp = Math.floor(s.fighters[0].maxHp * 0.2);
    let evs = run(s, 5);
    assert.equal(evs.filter((e) => e.t === 'awaken').length, 1);
    s.fighters[0].awakened = 0;
    evs = run(s, 60);
    assert.equal(evs.filter((e) => e.t === 'awaken').length, 0);
  });

  test('Qi Burst breaks a combo for 2 bars', () => {
    const s = fightReady();
    place(s, 90);
    s.fighters[1].chi = 250;
    const evs = run(s, 30, tap(BTN.HP), (i) => (i === 12 ? BTN.LP | BTN.SP : 0));
    assert.ok(evs.some((e) => e.t === 'burst' && e.side === 1));
    assert.ok(s.fighters[1].chi < 100);
  });

  test('a KO ends the round with a KO type', () => {
    const s = fightReady();
    place(s, 90);
    s.fighters[1].hp = 1;
    s.fighters[1].awakenUsed = true;
    const evs = run(s, 40, tap(BTN.HP));
    const ko = evs.find((e) => e.t === 'ko');
    assert.ok(ko);
    assert.ok(['scroll', 'star', 'crash', 'crater', 'signature'].includes(ko.type));
  });

  test('matches always finish (AI vs AI)', () => {
    for (const [a, b] of [['longxu', 'jidao'], ['dazhong', 'shanyang'], ['moolan', 'hamfu'], ['waiya', 'jiugui']]) {
      const s = createMatch({ seed: 7, stageId: 'teahouse', builds: [presetsFor(a)[0], presetsFor(b)[1]] });
      const ai = [createAI(2, 0, 1), createAI(2, 1, 2)];
      let i = 0;
      for (; i < 60 * 60 * 8 && s.phase !== 'matchEnd'; i++) step(s, [aiInput(ai[0], s), aiInput(ai[1], s)]);
      assert.equal(s.phase, 'matchEnd', `${a} vs ${b} finished`);
    }
  });
});

// ---- builds --------------------------------------------------------------------------------------

describe('builds', () => {
  test('every preset is legal and within 8 Gong', () => {
    for (const p of PRESETS) {
      const r = resolveBuild(p);
      assert.equal(r.charId, p.charId);
      assert.equal(r.stance, p.stance, `${p.id} stance`);
      assert.deepEqual(r.arts, p.arts, `${p.id} arts`);
      assert.equal(r.ultra, p.ultra, `${p.id} ultra`);
      assert.ok(r.cost <= 8, `${p.id} costs ${r.cost}`);
      for (const [slot, id] of Object.entries(p.slots)) assert.equal(r.slots[slot], id, `${p.id} slot ${slot}`);
    }
  });

  test('tampered builds are clamped', () => {
    const r = resolveBuild({
      charId: 'jidao', stance: 'nope', arts: ['thousandHand', 'ironShirt', 'vampiric', 'bogus'],
      slots: { N: 'lionsRoar', F: 'inkClone', B: 'sevenStep', U: 'pressurePoint', D: 'beardLash' },
      statDelta: { pow: 99, spd: -99, def: 3, chi: 0 }, bonusStats: 7, cosmetic: { c1: 'javascript:alert(1)', cry: '<script>hi</script>' },
    });
    assert.ok(r.cost <= BUDGET);
    assert.ok(r.arts.length <= 2);
    assert.notEqual(r.slots.D, 'beardLash');
    for (const k of ['pow', 'spd', 'def', 'chi']) assert.ok(r.stats[k] >= 2 && r.stats[k] <= 10, k);
    assert.ok(r.bonusStats <= 2);
    assert.match(r.cos.c1, /^#[0-9a-f]{6}$/i);
    assert.ok(!r.cos.cry.includes('<'));
  });

  test('stat moves are limited and must balance', () => {
    const base = getChar('longxu').stats;
    const ok = resolveBuild({ charId: 'longxu', statDelta: { pow: 2, chi: -2 } });
    assert.equal(ok.stats.pow, base.pow + 2);
    assert.equal(ok.stats.chi, base.chi - 2);
    const bad = resolveBuild({ charId: 'longxu', statDelta: { pow: 2 } }); // unbalanced
    assert.equal(bad.stats.pow, base.pow);
    const bonus = resolveBuild({ charId: 'longxu', statDelta: { pow: 2 }, bonusStats: 2 });
    assert.equal(bonus.stats.pow, base.pow + 2);
    assert.equal(buildCost(bonus), 4);
  });

  test('unknown character falls back to a real one', () => {
    assert.ok(CHAR_IDS.includes(resolveBuild({ charId: 'chupacabra' }).charId));
  });
});

// ---- roster integrity ----------------------------------------------------------------------------

describe('roster data', () => {
  test('8 fighters, 4 farm animals', () => {
    assert.equal(CHAR_IDS.length, 8);
    const animals = CHAR_IDS.filter((id) => getChar(id).species !== 'human');
    assert.deepEqual(animals.map((id) => getChar(id).species).sort(), ['cow', 'goat', 'pig', 'rooster']);
  });

  for (const id of CHAR_IDS) {
    test(`${id}: 5 slotted specials, 2 ultras, valid data`, () => {
      const ch = getChar(id);
      const slots = Object.values(ch.defaultSlots);
      assert.equal(new Set(slots).size, 5);
      for (const mid of slots) {
        const m = getMove(mid);
        assert.ok(m, `${mid} exists`);
        assert.equal(m.kind, 'special');
        for (const h of m.hits) assert.ok(h.f[0] <= h.f[1], `${mid} hit window`);
        for (const sp of m.spawn || []) assert.ok(getProj(sp.proj), `${mid} spawns ${sp.proj}`);
        if (m.parry?.then) assert.ok(getMove(m.parry.then), `${mid} parry follow-up`);
      }
      assert.equal(ch.ultras.length, 2);
      for (const u of ch.ultras) {
        const m = getMove(u);
        assert.equal(m.kind, 'ultra', u);
        if (m.hits.some((h) => h.cine)) assert.ok(m.cine && m.cine.dur > 0, `${u} has a cinematic`);
      }
      // fairness: a fast invulnerable reversal or defensive special exists
      const defensive = slots.some((mid) => {
        const m = getMove(mid);
        const inv = (m.inv || []).some((w) => w.f[0] <= 1 && w.f[1] >= 4);
        return (inv && m.firstActive <= 9) || m.parry || m.armor || m.hurtNone;
      });
      assert.ok(defensive, `${id} has a reversal, parry or armor`);
      const s = ch.stats;
      assert.equal(s.pow + s.spd + s.def + s.chi, 24, `${id} stats total 24`);
    });
  }

  test('scrolls are valid moves', () => {
    for (const id of Object.keys(SCROLLS)) {
      const m = getMove(id);
      assert.ok(m && m.dur > 0, id);
      assert.ok(SCROLLS[id].cost >= 1 && SCROLLS[id].cost <= 3, id);
    }
  });
});

// ---- stage transitions ---------------------------------------------------------------------------

// Knock `loser` out with a wall-bounce finisher and wait for the next round to begin.
function crashKO(s, loser) {
  const round = s.round;
  s.fighters[loser].hp = 0;
  s.fighters[loser].lastHit = { wb: true };
  const evs = [];
  for (let i = 0; i < 900 && s.round === round; i++) {
    step(s, [0, 0]);
    evs.push(...s.events);
  }
  assert.equal(s.round, round + 1, 'next round started');
  return evs;
}

function toFight(s) {
  for (let i = 0; i < 400 && s.phase !== 'fight'; i++) step(s, [0, 0]);
  assert.equal(s.phase, 'fight');
}

describe('stage transitions', () => {
  test('every arena hides an area behind it, which leads back; hidden areas are not selectable', () => {
    assert.equal(STAGE_IDS.length, 6);
    assert.equal(AREA_IDS.length, 6);
    for (const id of STAGE_IDS) {
      const area = STAGES[id].beyond;
      assert.ok(AREA_IDS.includes(area), `${id} -> ${area}`);
      assert.equal(STAGES[area].parent, id);
      assert.equal(STAGES[area].beyond, id);
    }
  });

  test('a scenery-crash KO sends the next round into the area behind the arena', () => {
    const s = fightReady('longxu', 'dazhong', { stage: 'barnyard' });
    const evs = crashKO(s, 1);
    assert.equal(evs.find((e) => e.t === 'ko').type, 'crash');
    assert.ok(evs.some((e) => e.t === 'stageChange' && e.id === 'pigpen' && e.from === 'barnyard'));
    assert.equal(s.stage.id, 'pigpen');
    assert.equal(pack(s).stage.id, 'pigpen');
    assert.ok(!s.stage.hazards.some((h) => h.kind === 'hay'), 'barnyard hazards are left behind');
    // the pigpen's two mud wallows are permanent
    toFight(s);
    run(s, 600);
    assert.equal(s.zones.filter((z) => z.kind === 'mud').length, 2);
  });

  test('another crash KO sends the fight back; transitions can be switched off', () => {
    const s = fightReady('longxu', 'dazhong', { stage: 'teahouse' });
    crashKO(s, 1);
    assert.equal(s.stage.id, 'kitchen');
    assert.ok(s.zones.some((z) => z.kind === 'lard'));
    toFight(s);
    crashKO(s, 0);
    assert.equal(s.stage.id, 'teahouse');
    assert.ok(!s.zones.some((z) => z.kind === 'lard'));

    const off = fightReady('longxu', 'dazhong', { stage: 'teahouse', cfg: { transitions: false } });
    const evs = crashKO(off, 1);
    assert.equal(off.stage.id, 'teahouse');
    assert.ok(!evs.some((e) => e.t === 'stageChange'));
  });

  test('other KO types stay put', () => {
    const s = fightReady('longxu', 'dazhong', { stage: 'cloud' });
    s.fighters[1].hp = 0;
    s.fighters[1].lastHit = { up: true };
    const evs = [];
    for (let i = 0; i < 900 && s.round === 1; i++) {
      step(s, [0, 0]);
      evs.push(...s.events);
    }
    assert.equal(evs.find((e) => e.t === 'ko').type, 'star');
    assert.equal(s.stage.id, 'cloud');
  });

  test('peaches fall in the Peach Garden; slick floors make dashes longer', () => {
    const s = fightReady('longxu', 'dazhong', { stage: 'peaches' });
    let peach = false;
    for (let i = 0; i < 1500 && !peach; i++) {
      step(s, [0, 0]);
      peach = s.pickups.some((p) => p.kind === 'peach');
    }
    assert.ok(peach, 'a peach fell');

    const dashDist = (stage) => {
      const m = fightReady('longxu', 'dazhong', { stage });
      place(m, 600);
      const x0 = m.fighters[0].x;
      run(m, 40, (i) => (i === 0 || i === 3 ? BTN.R : 0));
      return m.fighters[0].x - x0;
    };
    const base = dashDist('bamboo');
    assert.ok(base > 100, `dash moved ${base}`);
    assert.ok(dashDist('rooftop') > base * 1.1, 'rooftop tiles are slippery');
    assert.ok(dashDist('lotus') > base * 1.15, 'lily pads are slicker still');
  });
});

// UltraFist procedural music: seeded pentatonic patterns per track, played by
// a lookahead scheduler (setInterval 25 ms, ~120 ms ahead). Every note is a
// short-lived core Voice routed through a per-track gain -> music bus.

import { S, Voice, clamp, num, mtof, holdParam, taiko, gong, cowbell, pluck } from './core.js';

const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const MAX_VOICES = 12;
const XFADE = 0.6;

// ---------- tracks ----------
// mode: rotation of the major pentatonic (0 gong, 1 shang, 2 jue, 3 zhi, 4 yu)
// busy: 0..1 lead rhythm density. arp/bass/drums: style keys below.
const TRACKS = {
  menu:      { seed: 11, bpm: 112, root: 50, mode: 0, bars: 8,  busy: 0.5,  lead: 'erhu', arp: 'arp',      bass: 'basic', drums: 'heroic', pad: true, gongEvery: 8, level: 0.85 },
  select:    { seed: 23, bpm: 124, root: 55, mode: 3, bars: 8,  busy: 0.6,  lead: 'dizi', arp: 'gallop',   bass: 'basic', drums: 'march',  pad: false, level: 0.8 },
  bamboo:    { seed: 37, bpm: 118, root: 52, mode: 4, bars: 16, busy: 0.6,  lead: 'erhu', arp: 'arp',      bass: 'basic', drums: 'fight',  pad: true, level: 0.8 },
  rooftop:   { seed: 41, bpm: 136, root: 50, mode: 4, bars: 8,  busy: 0.75, lead: 'erhu', arp: 'ostinato', bass: 'tense', drums: 'tense',  pad: true, level: 0.8 },
  teahouse:  { seed: 53, bpm: 92,  root: 53, mode: 0, bars: 8,  busy: 0.3,  lead: 'erhu', arp: 'lazy',     bass: 'tea',   drums: 'tea',    pad: true, swing: 0.45, tipsy: true, level: 0.8 },
  barnyard:  { seed: 67, bpm: 132, root: 55, mode: 0, bars: 8,  busy: 0.65, lead: 'dizi', arp: 'banjo',    bass: 'barn',  drums: 'barn',   pad: false, swing: 0.3, banjo: true, level: 0.8 },
  waterfall: { seed: 71, bpm: 100, root: 49, mode: 1, bars: 16, busy: 0.4,  lead: 'dizi', arp: 'flow',     bass: 'basic', drums: 'light',  pad: true, level: 0.8 },
  cloud:     { seed: 83, bpm: 104, root: 57, mode: 2, bars: 16, busy: 0.3,  lead: 'dizi', arp: 'flow',     bass: 'basic', drums: 'light',  pad: true, level: 0.75 },
  victory:   { seed: 97, bpm: 120, root: 55, mode: 0, bars: 2,  busy: 0.5,  lead: 'erhu', arp: 'none',     bass: 'basic', drums: 'none',   pad: true, once: true, level: 0.95 },
};
export const TRACK_IDS = Object.keys(TRACKS);

const PENTA = [0, 2, 4, 7, 9];
function modeSemis(mode) {
  const base = PENTA[mode];
  return [0, 1, 2, 3, 4].map((i) => (PENTA[(mode + i) % 5] - base + 12) % 12);
}

// Deterministic PRNG so each track sounds the same every time.
function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Drum lanes, 16 steps per bar: 'X' accent, 'x' soft. min = intensity needed,
// every = only on bars divisible by N, only = only on that bar index.
// Instruments: T taiko, k small taiko, w woodblock, c small cymbal, C crash,
// s shaker, b cowbell, G gong.
const DRUMS = {
  heroic: [
    { i: 'T', p: 'X.....x.X.....x.' },
    { i: 'w', p: '....x.......x...' },
    { i: 'c', p: 'X...............', every: 2 },
    { i: 'k', p: '......x.....x.x.', min: 0.3 },
    { i: 's', p: 'x.x.x.x.x.x.x.x.', min: 0.25 },
  ],
  march: [
    { i: 'T', p: 'X...x...X...x...' },
    { i: 'w', p: '..x...x...x...x.' },
    { i: 'c', p: 'X...............', every: 4 },
    { i: 'k', p: '...x...x...x..xx', min: 0.4 },
    { i: 's', p: 'xxxxxxxxxxxxxxxx', min: 0.3 },
  ],
  fight: [
    { i: 'T', p: 'X..x..X...x.X...' },
    { i: 'w', p: '....X.......X...' },
    { i: 'c', p: 'X...............', every: 2 },
    { i: 's', p: '.xxx.xxx.xxx.xxx', min: 0.25 },
    { i: 'k', p: '..x.....x.x...x.', min: 0.45 },
  ],
  tense: [
    { i: 'T', p: 'X..X..X...X..X..' },
    { i: 'w', p: 'x.x.x.x.x.x.x.x.' },
    { i: 'k', p: '....X.......X.XX', min: 0.4 },
    { i: 'c', p: 'X.......X.......', min: 0.6 },
  ],
  tea: [
    { i: 'T', p: 'X.......x.......' },
    { i: 'w', p: '....x.......x.x.' },
    { i: 'c', p: 'x...............', every: 2 },
    { i: 's', p: '..x...x...x...x.', min: 0.3 },
  ],
  barn: [
    { i: 'T', p: 'X...x...X...x...' },
    { i: 'b', p: '..X...X...X...X.' },
    { i: 'w', p: 'x...x...x...x...', min: 0.3 },
    { i: 'k', p: '.......x.......x', min: 0.5 },
  ],
  light: [
    { i: 'T', p: 'X...............' },
    { i: 'w', p: '........x.......' },
    { i: 'c', p: 'x...............', every: 2, min: 0.3 },
    { i: 's', p: 'x.x.x.x.x.x.x.x.', min: 0.4 },
    { i: 'k', p: '....x.......x.x.', min: 0.6 },
  ],
  none: [],
  victory: [
    { i: 'T', p: 'X.x.X.x.XxXxXXXX', only: 0 },
    { i: 'T', p: 'X...............', only: 1 },
    { i: 'C', p: 'X...............', only: 1 },
    { i: 'G', p: 'X...............', only: 1 },
  ],
};

// Pluck arpeggios: 8 eighth-note slots, index into chord tones (-1 = rest).
const ARPS = {
  arp: [0, 1, 2, 3, 2, 1, 2, 1],
  gallop: [0, 2, 3, 0, 2, 3, 1, 3],
  ostinato: [0, 0, 3, 0, 1, 0, 3, 2],
  lazy: [0, -1, 2, -1, 1, -1, 3, -1],
  banjo: [0, 2, 4, 0, 2, 4, 0, 3],
  flow: [0, 1, 2, 3, 4, 3, 2, 1],
  none: [-1, -1, -1, -1, -1, -1, -1, -1],
};
const CHORD = [0, 2, 3, 5, 7, 8, 10]; // pentatonic "chord tones" above the bar root (degrees)

// Bass plucks: step -> degree offset from the bar root.
const BASS = {
  basic: { 0: 0 },
  barn: { 0: 0, 8: 3 },
  tense: { 0: 0, 6: 0, 10: 0 },
  tea: { 0: 0, 10: 3 },
};

const PROG4 = [[0, 0, 3, 4], [0, 3, 4, 0], [0, 4, 3, 3], [0, 2, 3, 0], [4, 3, 0, 0], [0, 0, 4, 3], [0, 3, 0, 4], [4, 4, 3, 0]];
// Lead rhythms per bar (16ths), sparse -> busy.
const RHY = [[16], [12, 4], [8, 8], [8, 4, 4], [4, 4, 8], [6, 6, 4], [4, 4, 4, 4], [6, 2, 4, 4],
  [3, 3, 2, 4, 4], [4, 2, 2, 4, 4], [2, 2, 4, 2, 2, 4], [2, 2, 2, 2, 4, 4]];
const WALK = [-2, -1, -1, 0, 1, 1, 2, -3, 3];

// Nearest degree that is a chord tone of bar root c (mod 5: 0, 2, 3).
function snap(d, c) {
  for (const k of [0, 1, -1, 2, -2]) {
    const m = (((d + k - c) % 5) + 5) % 5;
    if (m === 0 || m === 2 || m === 3) return d + k;
  }
  return d;
}

function genPattern(def) {
  const rng = mulberry32(def.seed);
  const bars = def.bars;
  const steps = bars * 16;
  const prog = [];
  for (let b = 0; b < bars; b += 4) prog.push(...PROG4[Math.floor(rng() * PROG4.length)]);
  prog.length = bars;
  prog[0] = 0;
  if (bars > 2) prog[bars - 1] = rng() < 0.5 ? 3 : 4; // turnaround back to the top

  // 2-bar phrases built by a random walk over rhythm templates
  const phrase = () => {
    const out = [];
    let d = 5 + Math.floor(rng() * 4);
    for (let b = 0; b < 2; b++) {
      const r = RHY[Math.floor(clamp(def.busy + (rng() - 0.5) * 0.7, 0, 0.999) * RHY.length)];
      let s = 0;
      for (const len of r) {
        if (s > 0 && rng() < 0.1) { s += len; continue; } // breath
        d = clamp(d + WALK[Math.floor(rng() * WALK.length)], 4, 13);
        out.push({ s: b * 16 + s, d, l: len });
        s += len;
      }
    }
    return out;
  };
  const vary = (ph) => ph.map((n, i) => (i >= ph.length - 2 ? { ...n, d: clamp(n.d + (rng() < 0.5 ? -1 : 1), 4, 13) } : n));
  const A = phrase(), B = phrase(), C = phrase();
  let form = [A, B, vary(A), C];
  if (bars >= 16) {
    const D = phrase(), E = phrase();
    form = form.concat([D, E, vary(D), vary(C)]);
  }
  const lead = new Map();
  let lastStep = -1;
  form.forEach((ph, i) => {
    const off = i * 32;
    if (off >= steps) return;
    for (const n of ph) {
      const s = off + n.s;
      const d = n.s % 16 === 0 ? snap(n.d, prog[s >> 4]) : n.d;
      lead.set(s, { d, l: n.l });
      lastStep = Math.max(lastStep, s);
    }
  });
  if (lastStep >= 0) { const n = lead.get(lastStep); n.d = clamp(Math.round(n.d / 5) * 5, 5, 10); } // cadence on the root

  const bass = new Array(16);
  for (const [k, o] of Object.entries(BASS[def.bass] || BASS.basic)) bass[+k] = o;
  return { steps, prog, lead, bass, arp: ARPS[def.arp] || ARPS.arp, drums: DRUMS[def.drums] || [], strum: new Set() };
}

// Victory: short hand-written fanfare (~4 s at 120 BPM), no loop.
function victoryPattern() {
  const lead = new Map();
  for (const [s, d, l] of [[0, 5, 2], [2, 6, 2], [4, 7, 2], [6, 8, 2], [8, 7, 2], [10, 8, 2], [12, 9, 4], [16, 10, 14]]) {
    lead.set(s, { d, l });
  }
  const bass = new Array(16);
  bass[0] = 0;
  return { steps: 32, prog: [0, 0], lead, bass, arp: ARPS.none, drums: DRUMS.victory, strum: new Set([16]) };
}

const patCache = new Map();
function getPattern(id) {
  let p = patCache.get(id);
  if (!p) {
    p = id === 'victory' ? victoryPattern() : genPattern(TRACKS[id]);
    patCache.set(id, p);
  }
  return p;
}

// Light per-loop variation: nudge ~15% of off-bar lead notes by one degree.
function mutations(pat, seed, loop) {
  const rng = mulberry32(seed * 977 + loop);
  const m = new Map();
  for (const s of pat.lead.keys()) {
    if (s % 16 !== 0 && rng() < 0.15) m.set(s, rng() < 0.5 ? -1 : 1);
  }
  return m;
}

// ---------- voices / instruments ----------

const voices = new Set();
let dropped = 0;        // notes skipped by the voice cap (debug stat)
let intensity = 0;
let intTarget = 0;

// New music note voice at absolute time t, or null when over the voice cap
// (prio 2 notes - lead, taiko, gong - may exceed it slightly).
function nv(inst, t, prio = 1) {
  if (voices.size >= MAX_VOICES && (prio < 2 || voices.size >= MAX_VOICES + 3)) { dropped++; return null; }
  const v = new Voice(inst.out, S.slowPitch, 1, t);
  voices.add(v);
  v.onDone = (x) => voices.delete(x);
  return v;
}

function drum(inst, kind, t, vol) {
  const big = kind === 'T' || kind === 'G' || kind === 'C';
  const v = nv(inst, t, big ? 2 : 1);
  if (!v) return;
  vol *= 0.8 + intensity * 0.3;
  switch (kind) {
    case 'T': taiko(v, 0, 58, vol * 0.75, v.o, 0.3); break;
    case 'k': taiko(v, 0, 105, vol * 0.4, v.o, 0.16); break;
    case 'w':
      v.tone('sine', 1250, 0, 0.001, 0.05, vol * 0.3);
      v.tone('triangle', 1900, 0, 0.001, 0.025, vol * 0.12);
      break;
    case 'c': v.hiss(0, 0.001, 0.2, vol * 0.1, 'highpass', 6500, 0.7); break;
    case 'C': v.hiss(0, 0.002, 1.2, vol * 0.2, 'highpass', 4500, 0.7); break;
    case 's': v.hiss(0, 0.002, 0.04, vol * 0.06, 'highpass', 8000, 0.7); break;
    case 'b': cowbell(v, 0, vol * 0.2); break;
    case 'G': gong(v, 0, mtof(inst.def.root - 12), 2.5, vol * 0.35, v.o, 3); break;
    default: break;
  }
  v.seal();
}

function pluckNote(inst, t, midi, vol, dur, bright, loss) {
  const v = nv(inst, t, 1);
  if (!v) return;
  pluck(v, 0, mtof(midi), vol, v.o, dur, bright, loss);
  v.seal();
}

// Erhu (saw+triangle, nasal bandpass) or dizi (sine+triangle+breath) lead with
// delayed vibrato and portamento from the previous note.
function lead(inst, t, f, dur, vol) {
  const v = nv(inst, t, 2);
  if (!v) return;
  const def = inst.def;
  const end = dur + 0.14;
  const det = def.tipsy ? (Math.random() * 2 - 1) * 22 : 0;
  const from = inst.prevLead;
  const glide = from && from !== f && Math.abs(Math.log2(from / f)) < 1 ? from : 0;
  const vib = v.gain(0);
  const va = Math.min(0.18, dur * 0.4);
  v.env(vib.gain, [[0, 0], [va, 0, 'l'], [va + 0.3, def.tipsy ? 30 : 16, 'l']]);
  v.chain(v.osc('sine', def.tipsy ? 4 : 5.5, 0, end), vib);
  const g = v.gain(0);
  v.env(g.gain, [[0, 0], [0.04, vol, 'l'], [Math.max(0.05, dur), vol * 0.8], [end, 0]]);
  g.connect(v.o);
  let oscs;
  if (def.lead === 'dizi') {
    oscs = [[v.osc('sine', f, 0, end, det), 1], [v.osc('triangle', f * 2, 0, end, det), 2]];
    const lo = v.gain(0.25);
    oscs[1][0].connect(lo);
    lo.connect(g);
    oscs[0][0].connect(g);
    v.hiss(0, 0.01, 0.08, vol * 0.25, 'bandpass', f * 2, 2); // breath chiff
  } else {
    oscs = [[v.osc('sawtooth', f, 0, end, det), 1], [v.osc('triangle', f, 0, end, det + 4), 1]];
    const bp = v.filt('bandpass', 1100, 0.9);
    const lp = v.filt('lowpass', 3500, 0.7);
    for (const [o] of oscs) o.connect(bp);
    v.chain(bp, lp, v.gain(1.6), g);
  }
  for (const [o, mul] of oscs) {
    vib.connect(o.detune);
    if (glide) v.env(o.frequency, [[0, glide * mul], [0.07, f * mul]], true);
  }
  v.seal();
}

function pad(inst, t, midis, len) {
  const v = nv(inst, t, 1);
  if (!v) return;
  const lp = v.filt('lowpass', 700, 0.7);
  const g = v.gain(0);
  v.env(g.gain, [[0, 0], [Math.min(0.4, len * 0.3), 0.06, 'l'], [len, 0.05], [len + 0.5, 0]]);
  for (const m of midis) {
    const f = mtof(m);
    v.osc('triangle', f, 0, len + 0.52, -6).connect(lp);
    v.osc('triangle', f, 0, len + 0.52, 6).connect(lp);
  }
  v.chain(lp, g, v.o);
  v.seal();
}

// ---------- track instance ----------

class Inst {
  constructor(id, fadeIn) {
    const ctx = S.ctx;
    this.id = id;
    this.def = TRACKS[id];
    this.pat = getPattern(id);
    this.semis = modeSemis(this.def.mode);
    this.level = this.def.level || 0.8;
    this.out = ctx.createGain();
    this.out.connect(S.bus.music);
    const t = ctx.currentTime;
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(this.level, t + Math.max(0.02, fadeIn));
    this.step = 0;
    this.loop = 0;
    this.next = t + 0.05;
    this.alive = true;
    this.tempo = Math.sqrt(S.slow);
    this.prevLead = 0;
    this.mut = null;
  }

  midi(d, shift = 0) {
    return this.def.root + shift + 12 * Math.floor(d / 5) + this.semis[((d % 5) + 5) % 5];
  }

  stepDur() { return 60 / this.def.bpm / 4 / this.tempo; }

  run(now) {
    if (!this.alive) return;
    this.tempo += (Math.sqrt(S.slow) - this.tempo) * 0.15; // ease into/out of slow-mo
    if (this.next < now - 0.2) this.next = now + 0.03;     // fell behind (hidden tab): resync, no burst
    while (this.alive && this.next < now + LOOKAHEAD) {
      this.play(this.step, this.next);
      this.next += this.stepDur();
      if (++this.step >= this.pat.steps) {
        if (this.def.once) { this.finish(); break; }
        this.step = 0;
        this.loop++;
        this.mut = mutations(this.pat, this.def.seed, this.loop);
      }
    }
  }

  play(s, t) {
    const p = this.pat, def = this.def, x = intensity, sd = this.stepDur();
    const bar = s >> 4, st = s & 15;
    if (def.swing && st % 4 === 2) t += def.swing * sd;
    const c = p.prog[bar] || 0;

    // percussion
    for (const ln of p.drums) {
      if (x < (ln.min || 0)) continue;
      if (ln.every && bar % ln.every) continue;
      if (ln.only !== undefined && ln.only !== bar) continue;
      const ch = ln.p[st];
      if (ch === 'X' || ch === 'x') drum(this, ln.i, t, ch === 'X' ? 1 : 0.55);
    }
    if (!def.once) {
      if (st >= 12 && bar % 4 === 3 && (x > 0.6 || this.loop % 2 === 1)) drum(this, 'k', t, st === 15 ? 1 : 0.6); // fill
      if (x > 0.5 && (st === 3 || st === 10 || st === 13)) drum(this, 'T', t, 0.45);
      if (x > 0.75 && st === 0) drum(this, 'c', t, 0.8);
      if (def.gongEvery && s === 0) drum(this, 'G', t, 0.7);
    }

    // bass + plucks
    const bo = p.bass[st];
    if (bo !== undefined) pluckNote(this, t, this.midi(c + bo, -12), 0.5, 0.7, 0.3, 0.994);
    const ai = p.arp[st >> 1];
    const banjo = !!def.banjo;
    const pOct = banjo ? 12 : 0;
    if (ai >= 0 && (st % 2 === 0 || x > 0.5)) {
      const idx = st % 2 === 0 ? ai : Math.min(ai + 1, CHORD.length - 1);
      const vol = (st % 2 === 0 ? 0.32 : 0.2) * (banjo ? 0.9 : 1);
      pluckNote(this, t, this.midi(c + CHORD[idx], pOct), vol, banjo ? 0.28 : x > 0.5 ? 0.38 : 0.5, banjo ? 1 : 0.7, banjo ? 0.985 : 0.996);
    }
    if (p.strum.has(s)) {
      // one voice for the whole strum so the cap never eats part of the chord
      const v = nv(this, t, 2);
      if (v) {
        for (let i = 0; i < 5; i++) pluck(v, i * 0.03, mtof(this.midi(c + CHORD[i], 0)), 0.3, v.o, 1.2, 0.8, 0.997);
        v.seal();
      }
    }

    // lead (raised an octave at high intensity)
    const ev = p.lead.get(s);
    if (ev) {
      let d = ev.d + ((this.mut && this.mut.get(s)) || 0);
      if (x > 0.75 && !def.once && d + 5 <= 15) d += 5;
      const f = mtof(this.midi(d, 0));
      const vol = (def.lead === 'dizi' ? 0.28 : 0.2) * (1 + x * 0.15);
      lead(this, t, f, ev.l * sd * 0.95, vol);
      this.prevLead = f;
    }

    // pad / drone
    if (def.pad && st === 0) pad(this, t, [this.midi(c, 0), this.midi(c + 3, 0)], 16 * sd);
  }

  fadeOut(sec) {
    if (this.disposed) return;
    this.alive = false;
    const t = S.ctx.currentTime;
    holdParam(this.out.gain, t);
    this.out.gain.linearRampToValueAtTime(0, t + Math.max(0.02, sec));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dispose(), (sec + 8) * 1000); // after note tails
  }

  // non-looping track reached its end: let the tails ring, then dispose
  finish() {
    this.alive = false;
    if (current === this) { current = null; wanted = null; }
    this.timer = setTimeout(() => this.dispose(), 7000);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    try { this.out.disconnect(); } catch (e) { /* ignore */ }
    insts.delete(this);
  }
}

// ---------- scheduler + API ----------

let current = null;     // the instance that is (or will be) audible
let wanted = null;      // last requested track; played once the context runs
const insts = new Set();
let timer = null;

function tick() {
  const ctx = S.ctx;
  intensity += (intTarget - intensity) * 0.08;
  if (!ctx) return;
  if (ctx.state === 'running') {
    const now = ctx.currentTime;
    for (const inst of insts) inst.run(now);
    // safety net: free voices whose onended never arrived
    for (const v of voices) if (v.end + 1 < now) v.free();
  }
  if (!insts.size && timer) { clearInterval(timer); timer = null; }
}

function play(id) {
  if (!Object.prototype.hasOwnProperty.call(TRACKS, id)) return;
  wanted = id;
  const ctx = S.ctx;
  if (!ctx || ctx.state !== 'running') return; // started by _wake() after unlock
  if (current && current.id === id && current.alive) return;
  const prev = current;
  if (prev) prev.fadeOut(XFADE);
  current = new Inst(id, prev ? XFADE : 0.02);
  insts.add(current);
  current.run(ctx.currentTime);
  if (!timer) timer = setInterval(tick, TICK_MS);
}

function stop(fadeSec = 0.8) {
  wanted = null;
  if (!current) return;
  current.fadeOut(clamp(num(fadeSec, 0.8), 0, 30));
  current = null;
}

function setIntensity(x) {
  intTarget = clamp(num(x, 0), 0, 1);
  if (!timer) intensity = intTarget;
}

// Called by audio.js whenever the context starts running.
export function _wake() {
  if (wanted && (!current || current.id !== wanted)) play(wanted);
}

export const music = {
  play,
  stop,
  setIntensity,
  get intensity() { return intTarget; },
  get current() { return current ? current.id : null; },
  get stats() { return { voices: voices.size, dropped }; },
  tracks: TRACK_IDS,
};

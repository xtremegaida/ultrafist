// UltraFist SFX recipes. Each recipe is (v, opts) => void, where v is a core
// Voice already routed to the sfx bus with pitch/pan/volume applied.
// Times are nominal seconds from "now"; keep most sounds < 400 ms.

import { rand, taiko, gong, cowbell, pluck, bellNote } from './core.js';
import { VOICES } from './voices.js';

// C major pentatonic, C5 upward (Hz)
const PENTA_HZ = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5, 1568, 1760,
  2093, 2349.3, 2637, 3136, 3520];

// ---- shared bits ----

function whoosh(v, t, a, d, f1, f2, vol, Q = 2, kind = 'white') {
  v.hiss(t, a, d, vol, 'bandpass', f1, Q, v.o, f2, kind);
}

function thud(v, t, f1, f2, d, vol, drive = 0) {
  if (drive) {
    const sh = v.shaper(drive);
    sh.connect(v.o);
    v.tone('sine', f1, t, 0.002, d, vol, sh, f2, d * 0.6);
  } else {
    v.tone('sine', f1, t, 0.002, d, vol, v.o, f2, d * 0.6);
  }
}

function clicks(v, t0, times, f, vol, Q = 3) {
  for (let i = 0; i < times.length; i++) {
    v.hiss(t0 + times[i], 0.0005, 0.012, vol * (1 - i / (times.length + 1)), 'bandpass', f * rand(0.85, 1.15), Q);
  }
}

function pings(v, t0, n, spread, fLo, fHi, vol, d = 0.06) {
  for (let i = 0; i < n; i++) v.tone('sine', rand(fLo, fHi), t0 + Math.random() * spread, 0.001, d * rand(0.5, 1.2), vol);
}

function crash(v, t, d, vol) {
  v.hiss(t, 0.002, d, vol, 'highpass', 4500, 0.7);
  v.hiss(t, 0.001, d * 0.5, vol * 0.6, 'bandpass', 7500, 1.2);
}

function heart(v, t, vol = 1) {
  thud(v, t, 75, 42, 0.13, vol);
  thud(v, t + 0.17, 65, 38, 0.15, vol * 0.7);
}

function jumpCore(v, flute, vol = 1) {
  whoosh(v, 0, 0.02, 0.11, 300, 1500, 0.35 * vol, 1, 'pink');
  v.tone('sine', flute * 0.84, 0.005, 0.012, 0.12, 0.22 * vol, v.o, flute, 0.05);
  v.hiss(0.005, 0.01, 0.06, 0.05 * vol, 'bandpass', flute, 8); // breath
}

// ---- recipes ----

export const SFX = {
  // ===== UI =====
  uiMove(v) {
    v.tone('sine', 1800, 0, 0.001, 0.025, 0.2);
    v.tone('triangle', 900, 0, 0.001, 0.04, 0.18);
    v.hiss(0, 0.0005, 0.012, 0.12, 'bandpass', 3000, 3);
  },
  uiSelect(v) {
    pluck(v, 0, 880, 0.5, v.o, 0.45, 0.9);
    v.tone('triangle', 1760, 0, 0.001, 0.08, 0.12);
    gong(v, 0.02, 660, 0.5, 0.18, v.o, 3);
  },
  uiBack(v) {
    v.tone('triangle', 660, 0, 0.002, 0.08, 0.3, v.o, 330, 0.08);
    v.hiss(0, 0.0005, 0.015, 0.1, 'bandpass', 2000, 2);
  },
  uiError(v) {
    const lp = v.filt('lowpass', 1200, 0.7);
    lp.connect(v.o);
    for (const t of [0, 0.1]) {
      v.tone('square', 140, t, 0.003, 0.07, 0.18, lp);
      v.tone('square', 147, t, 0.003, 0.07, 0.18, lp);
    }
  },
  scroll(v) {
    whoosh(v, 0, 0.15, 0.2, 600, 4000, 0.4, 1.5, 'pink');
    clicks(v, 0.05, [0, 0.07, 0.15, 0.22], 3500, 0.12);
  },
  coin(v) {
    v.tone('square', 988, 0, 0.001, 0.07, 0.16);
    v.tone('square', 1319, 0.07, 0.001, 0.32, 0.16);
    v.tone('sine', 2637, 0.07, 0.001, 0.25, 0.08);
  },

  // ===== Movement =====
  jump(v) { jumpCore(v, 880); },
  airJump(v) { jumpCore(v, 1175, 0.9); },
  land(v) {
    thud(v, 0, 120, 50, 0.09, 0.6);
    v.hiss(0, 0.002, 0.06, 0.3, 'lowpass', 400, 0.7);
  },
  dash(v) {
    whoosh(v, 0, 0.01, 0.12, 2500, 1200, 0.5, 0.8, 'pink');
    v.hiss(0, 0.005, 0.05, 0.15, 'highpass', 5000, 0.7);
  },
  wallJump(v) {
    v.tone('triangle', 600, 0, 0.001, 0.05, 0.35);
    v.hiss(0, 0.0005, 0.02, 0.3, 'bandpass', 1800, 2);
    jumpCore(v, 988, 0.9);
  },

  // ===== Attacks =====
  swingLight(v) {
    whoosh(v, 0, 0.03, 0.06, 400, 2000, 0.6, 2.5);
  },
  swingHeavy(v) {
    whoosh(v, 0, 0.06, 0.1, 250, 1100, 0.8, 2);
    v.hiss(0, 0.05, 0.1, 0.35, 'lowpass', 300, 1, v.o, 0, 'brown');
  },
  projectile(v) {
    whoosh(v, 0, 0.04, 0.25, 200, 900, 0.6, 1.5);
    v.tone('sine', 90, 0, 0.02, 0.2, 0.5, v.o, 180, 0.15);
    const lp = v.filt('lowpass', 1200, 2);
    lp.connect(v.o);
    v.tone('sawtooth', 220, 0, 0.01, 0.2, 0.12, lp, 440, 0.15);
  },
  whooshBig(v) {
    whoosh(v, 0, 0.25, 0.3, 150, 2500, 0.9, 1.8);
    v.hiss(0.1, 0.15, 0.25, 0.25, 'highpass', 4000, 0.7);
    v.tone('sine', 50, 0, 0.2, 0.3, 0.5, v.o, 80, 0.4);
  },

  // ===== Impacts =====
  hitLight(v) {
    v.hiss(0, 0.001, 0.04, 0.9, 'bandpass', 2500, 1.5);
    v.tone('sine', 220, 0, 0.001, 0.07, 0.8, v.o, 110, 0.06);
  },
  hitHeavy(v) {
    v.hiss(0, 0.002, 0.12, 1, 'lowpass', 1800, 0.8, v.o, 300);
    thud(v, 0, 90, 40, 0.18, 1, 8);
    v.hiss(0, 0.0005, 0.02, 0.4, 'bandpass', 3000, 1.5);
  },
  hitSpecial(v) {
    v.hiss(0, 0.002, 0.14, 1, 'lowpass', 2400, 0.8, v.o, 300);
    thud(v, 0, 100, 38, 0.22, 1.1, 10);
    v.hiss(0, 0.0005, 0.03, 0.5, 'bandpass', 3500, 1.2);
    for (const r of [1, 2.76, 5.4]) v.tone('sine', 620 * r, 0, 0.001, 0.35 / r + 0.1, 0.16 / Math.sqrt(r));
  },
  hitUltra(v) {
    thud(v, 0, 70, 28, 0.5, 1.1, 12);
    const crunch = v.shaper(30);
    const bp = v.filt('bandpass', 1500, 0.7);
    v.chain(v.noise(0, 0.2), crunch, bp, v.perc(0.6, 0.001, 0.18));
    // reverb-ish tail: noise burst into a short damped feedback delay
    const d = v.delay(0.09);
    const fb = v.gain(0.45);
    const lp = v.filt('lowpass', 2500, 0.5);
    const wet = v.gain(0.5);
    v.chain(d, lp, fb, d);
    v.chain(lp, wet, v.o);
    v.hiss(0, 0.001, 0.15, 0.7, 'lowpass', 3000, 0.5, d);
    v.hiss(0, 0.001, 0.05, 0.5, 'bandpass', 2500, 1);
    v.tail = 0.7;
  },
  counter(v) {
    // reversed-cymbal swell then a crack
    const hp = v.filt('highpass', 5000, 0.7);
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.15, 0.5, 'l'], [0.16, 0, 'l']]);
    v.chain(v.noise(0, 0.17), hp, g, v.o);
    v.hiss(0.15, 0.0005, 0.05, 1, 'bandpass', 3500, 1);
    v.tone('sine', 300, 0.15, 0.001, 0.06, 0.6, v.o, 120, 0.05);
    v.tone('sine', 2200, 0.15, 0.001, 0.2, 0.15);
  },
  block(v) {
    const bp = v.filt('bandpass', 1400, 4);
    bp.connect(v.o);
    v.tone('square', 1400, 0, 0.001, 0.03, 0.5, bp);
    thud(v, 0, 160, 90, 0.06, 0.45);
  },
  justDefend(v) {
    v.tone('sine', 2000, 0, 0.002, 0.35, 0.3);
    v.tone('sine', 3000, 0.04, 0.002, 0.3, 0.2);
    v.tone('square', 1400, 0, 0.001, 0.02, 0.06);
    thud(v, 0, 140, 90, 0.05, 0.3);
  },
  guardBreak(v) {
    pings(v, 0, 10, 0.12, 2500, 7000, 0.12, 0.07);
    v.hiss(0, 0.001, 0.15, 0.7, 'highpass', 3000, 0.7);
    const lp = v.filt('lowpass', 2000, 1);
    lp.connect(v.o);
    v.tone('sawtooth', 800, 0, 0.005, 0.35, 0.3, lp, 100, 0.35);
    thud(v, 0, 110, 50, 0.15, 0.6);
  },
  clink(v) {
    v.tone('sine', 3100, 0, 0.001, 0.12, 0.35);
    v.tone('sine', 4500, 0, 0.001, 0.09, 0.25);
    v.tone('square', 2200, 0, 0.001, 0.02, 0.08);
    v.hiss(0, 0.0005, 0.02, 0.4, 'bandpass', 6000, 2);
  },
  throw(v) {
    v.hiss(0, 0.005, 0.04, 0.4, 'bandpass', 1200, 0.8, v.o, 0, 'pink');
    v.hiss(0.045, 0.005, 0.04, 0.35, 'bandpass', 1500, 0.8, v.o, 0, 'pink');
    whoosh(v, 0.08, 0.04, 0.12, 300, 1600, 0.6, 2);
  },
  tech(v) {
    v.hiss(0, 0.0005, 0.03, 1, 'highpass', 1500, 0.7);
    v.hiss(0, 0.001, 0.05, 0.5, 'bandpass', 900, 1);
    v.tone('sine', 400, 0, 0.001, 0.03, 0.4, v.o, 200, 0.03);
  },
  wallBounce(v) {
    v.tone('triangle', 380, 0, 0.001, 0.08, 0.5);
    v.tone('sine', 620, 0, 0.001, 0.05, 0.3);
    v.hiss(0, 0.0005, 0.06, 0.8, 'bandpass', 1800, 2);
    thud(v, 0, 110, 60, 0.12, 0.6);
  },
  groundBounce(v) {
    thud(v, 0, 80, 35, 0.2, 1, 6);
    v.hiss(0, 0.002, 0.08, 0.5, 'lowpass', 700, 0.7);
    clicks(v, 0.06, [0, 0.04, 0.07, 0.095, 0.115], 2500, 0.35);
  },
  knockdown(v) {
    thud(v, 0, 70, 38, 0.25, 0.9, 4);
    v.hiss(0, 0.002, 0.15, 0.6, 'lowpass', 500, 0.7);
    v.hiss(0.02, 0.02, 0.3, 0.15, 'bandpass', 800, 0.8, v.o, 0, 'pink');
  },
  fire(v) {
    v.hiss(0, 0.02, 0.38, 0.5, 'bandpass', 900, 0.6, v.o, 400);
    v.hiss(0, 0.03, 0.35, 0.6, 'lowpass', 600, 0.7, v.o, 0, 'brown');
    for (let i = 0; i < 12; i++) {
      v.hiss(Math.random() * 0.38, 0.0005, rand(0.004, 0.012), rand(0.3, 0.6), 'highpass', 3000, 0.7);
    }
  },
  splash(v) {
    v.hiss(0, 0.005, 0.3, 0.7, 'bandpass', 1200, 0.7, v.o, 600);
    v.hiss(0, 0.002, 0.08, 0.4, 'highpass', 3000, 0.7);
    thud(v, 0, 200, 80, 0.1, 0.4);
    for (let i = 0; i < 6; i++) v.tone('sine', 600, rand(0.05, 0.35), 0.002, 0.04, 0.12, v.o, rand(1100, 1600), 0.04);
  },
  beam(v) {
    const bp = v.filt('bandpass', 400, 4);
    v.env(bp.frequency, [[0, 400], [0.3, 2500], [0.6, 800]], true);
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.05, 0.35, 'l'], [0.55, 0.3], [0.6, 0]]);
    const trem = v.gain(0.75);
    v.lfo(28, 0.25, trem.gain, 0, 0.62, 'square');
    for (const [f, det] of [[110, 0], [110, 17], [220, -9]]) v.osc('sawtooth', f, 0, 0.62, det).connect(bp);
    v.chain(bp, trem, g, v.o);
    v.hiss(0, 0.05, 0.5, 0.08, 'highpass', 4000, 0.7);
    thud(v, 0, 60, 45, 0.5, 0.25);
  },
  explode(v) {
    thud(v, 0, 60, 25, 0.6, 1, 10);
    v.hiss(0, 0.005, 0.8, 1, 'lowpass', 1200, 0.7, v.o, 200, 'brown');
    v.hiss(0, 0.0005, 0.05, 0.6, 'bandpass', 2000, 1);
    v.hiss(0.02, 0.01, 0.4, 0.3, 'lowpass', 3000, 0.5, v.o, 500);
  },

  // ===== Big moments =====
  gong(v) { gong(v, 0, 110, 3, 1); },
  bigGong(v) {
    gong(v, 0, 73, 4.5, 1.3);
    v.tone('sine', 36.5, 0, 0.01, 2.5, 0.5);
    v.hiss(0, 0.002, 0.8, 0.25, 'lowpass', 2500, 0.5, v.o, 400);
  },
  taiko(v) { taiko(v, 0, 60, 1.1); },
  superFreeze(v) {
    taiko(v, 0, 60, 0.9);
    taiko(v, 0.09, 70, 0.9);
    taiko(v, 0.18, 82, 1.1);
    v.tone('sine', 1200, 0.18, 0.3, 0.3, 0.15, v.o, 2400, 0.55);
    v.tone('triangle', 1800, 0.22, 0.25, 0.3, 0.08, v.o, 3600, 0.5);
    pings(v, 0.25, 6, 0.4, 3000, 6500, 0.06, 0.08);
    v.hiss(0.15, 0.35, 0.15, 0.2, 'bandpass', 1500, 2, v.o, 6000);
  },
  chime(v) {
    // Authentic Technique: rising pentatonic chime (C6, E6, A6)
    [1046.5, 1318.5, 1760].forEach((f, i) => bellNote(v, i * 0.07, f, 0.28, 0.5 + i * 0.1));
  },
  chiReady(v) {
    v.tone('sine', 2349, 0, 0.002, 0.3, 0.22);
    v.tone('sine', 2349 * 2.76, 0, 0.001, 0.12, 0.05);
  },
  awaken(v) {
    const lp = v.filt('lowpass', 200, 2);
    v.env(lp.frequency, [[0, 200], [0.9, 900], [1.5, 300]], true);
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.9, 0.6, 'l'], [1.5, 0]]);
    v.osc('sawtooth', 55, 0, 1.52).connect(lp);
    v.osc('sawtooth', 55.4, 0, 1.52, 8).connect(lp);
    v.osc('sine', 27.5, 0, 1.52).connect(lp);
    v.chain(lp, g, v.o);
    heart(v, 0.5, 0.9);
    heart(v, 0.95, 1);
  },
  heartbeat(v) { heart(v, 0, 1); },
  ding(v) {
    v.tone('sine', 2600, 0, 0.002, 0.4, 0.35);
    v.tone('sine', 5200, 0, 0.002, 0.3, 0.18);
  },
  ko(v) {
    gong(v, 0, 98, 4, 1.3);
    crash(v, 0, 1.5, 0.5);
    thud(v, 0, 70, 30, 0.6, 0.9, 8);
  },
  perfect(v) {
    [784, 880, 1046.5, 1318.5, 1568].forEach((f, i) => bellNote(v, i * 0.06, f, 0.25, 0.4));
    pings(v, 0.3, 6, 0.4, 3000, 6000, 0.06, 0.1);
    gong(v, 0.3, 220, 1.5, 0.35, v.o, 3);
  },
  roundStart(v) {
    // mallet roll: one noise source with a pulsed, crescendoing envelope
    const g = v.gain(0);
    const pts = [[0, 0]];
    const hits = [0, 0.12, 0.22, 0.3, 0.37, 0.43, 0.48, 0.52];
    hits.forEach((t, i) => {
      const a = 0.15 + (i / hits.length) * 0.35;
      pts.push([t + 0.004, a, 'l'], [t + 0.045, 0.02]);
    });
    v.env(g.gain, pts);
    v.chain(v.noise(0, 0.6, 'pink'), v.filt('lowpass', 600, 1), g, v.o);
    // partials swell during the roll, then the accent strike
    const sw = v.gain(0);
    v.env(sw.gain, [[0, 0], [0.55, 0.12, 'l'], [1.4, 0]]);
    sw.connect(v.o);
    v.osc('sine', 110, 0, 1.45).connect(sw);
    v.osc('sine', 110 * 2.76, 0, 1.45).connect(sw);
    gong(v, 0.58, 110, 2.5, 1);
  },
  fight(v) {
    taiko(v, 0, 55, 1.2);
    thud(v, 0, 80, 40, 0.3, 0.6, 6);
    crash(v, 0.01, 0.8, 0.45);
  },
  timeUp(v) {
    const bp = v.filt('bandpass', 900, 2);
    bp.connect(v.o);
    [880, 660, 440].forEach((f, i) => v.tone('square', f, i * 0.15, 0.002, 0.1, 0.35, bp));
    gong(v, 0.45, 82, 2, 0.9);
  },
  clashStart(v) {
    const bp = v.filt('bandpass', 500, 3);
    v.env(bp.frequency, [[0, 500], [0.85, 2500]], true);
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.1, 0.3, 'l'], [0.8, 0.45], [0.9, 0]]);
    const trem = v.gain(0.7);
    const depth = v.lfo(8, 0.1, trem.gain, 0, 0.92);
    v.env(depth.gain, [[0, 0.05], [0.85, 0.3]]);
    for (const f of [220, 233]) {
      const o = v.osc('sawtooth', f, 0, 0.92);
      v.env(o.frequency, [[0, f], [0.85, f * 2]], true);
      o.connect(bp);
    }
    v.chain(bp, trem, g, v.o);
    SFX.clink(v);
  },
  mashTick(v) {
    v.tone('sine', 1800, 0, 0.0005, 0.015, 0.3);
    v.hiss(0, 0.0005, 0.008, 0.15, 'bandpass', 4000, 2);
  },
  clashWin(v) {
    gong(v, 0, 110, 2, 0.9);
    whoosh(v, 0, 0.15, 0.25, 200, 2500, 0.7, 1.8);
  },
  comboTier(v, o) {
    // higher tier -> more notes, starts higher, faster, brighter, longer tail
    const tier = Math.max(1, Math.min(10, Math.round(o.tier || 1)));
    const n = Math.min(3 + Math.floor(tier * 0.8), 10);
    const step = 0.05 - tier * 0.002;
    const start = Math.min(tier - 1, PENTA_HZ.length - n);
    const lp = tier >= 5 ? v.filt('lowpass', 2500 + tier * 400, 0.7) : null;
    if (lp) lp.connect(v.o);
    for (let i = 0; i < n; i++) {
      const f = PENTA_HZ[start + i];
      const d = i === n - 1 ? 0.25 + tier * 0.03 : 0.1;
      v.tone('triangle', f, i * step, 0.002, d, 0.25);
      v.tone('sine', f * 2, i * step, 0.001, d * 0.6, 0.08);
      if (lp) v.tone('square', f, i * step, 0.002, d * 0.7, 0.05, lp);
    }
    if (tier >= 7) gong(v, n * step, 330, 0.8 + tier * 0.08, 0.12 + tier * 0.02, v.o, 3);
    if (tier >= 9) pings(v, n * step, 5, 0.3, 3000, 6000, 0.05, 0.1);
  },
  pickup(v) {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => v.tone('triangle', f, i * 0.04, 0.001, i === 3 ? 0.25 : 0.06, 0.25));
    v.tone('sine', 4186, 0.12, 0.002, 0.2, 0.06);
  },
  dragon(v) {
    const pts = [[0, 60], [0.35, 90], [1.1, 50]];
    const o = v.osc('sawtooth', 60, 0, 1.15);
    const o2 = v.osc('sawtooth', 60, 0, 1.15, 25);
    v.env(o.frequency, pts, true);
    v.env(o2.frequency, pts, true);
    v.lfo(6, 40, o.detune, 0, 1.15);
    const sh = v.shaper(6);
    const amp = v.gain(0.7);
    v.lfo(25, 0.3, amp.gain, 0, 1.15); // growl flutter
    o.connect(sh);
    o2.connect(sh);
    sh.connect(amp);
    const mix = v.gain(1);
    for (const fl of [v.filt('bandpass', 500, 5), v.filt('bandpass', 1100, 6), v.filt('lowpass', 400, 1)]) {
      amp.connect(fl);
      fl.connect(mix);
    }
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.15, 0.9, 'l'], [0.7, 0.8], [1.1, 0]]);
    v.chain(mix, g, v.o);
    v.hiss(0, 0.15, 0.8, 0.35, 'bandpass', 400, 1, v.o, 0, 'brown');
  },
  thunder(v) {
    v.hiss(0, 0.001, 0.1, 0.9, 'highpass', 2000, 0.7);
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.05, 1, 'l'], [0.3, 0.5], [0.5, 0.8], [0.9, 0.35], [1.3, 0.5], [2.1, 0]]);
    v.chain(v.noise(0, 2.15, 'brown'), v.filt('lowpass', 300, 0.7), g, v.o);
    v.tone('sine', 40, 0, 0.05, 1.5, 0.4);
  },

  // ===== Character-flavoured =====
  beard(v) { v.hiss(0, 0.008, 0.05, 0.45, 'highpass', 3000, 0.7, v.o, 6000); },
  snore(v) {
    // inhale: buzzy fluttering saw
    const bp = v.filt('bandpass', 400, 2);
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.3, 0.4, 'l'], [0.6, 0]]);
    const fl = v.gain(0.6);
    v.lfo(22, 0.4, fl.gain, 0, 0.62);
    const o = v.osc('sawtooth', 70, 0, 0.62);
    v.env(o.frequency, [[0, 65], [0.6, 80]], true);
    v.chain(o, bp, fl, g, v.o);
    v.hiss(0, 0.25, 0.35, 0.12, 'bandpass', 800, 1, v.o, 0, 'pink');
    // exhale: breathy whistle
    v.hiss(0.7, 0.1, 0.5, 0.25, 'bandpass', 900, 2, v.o, 500, 'pink');
    v.tone('sine', 900, 0.72, 0.08, 0.4, 0.06, v.o, 650, 0.45);
  },
  twang(v) {
    pluck(v, 0, 196, 0.8, v.o, 1.0, 1, 0.997);
    v.tone('triangle', 196, 0, 0.002, 0.3, 0.15, v.o, 190, 0.3);
    v.hiss(0, 0.0005, 0.01, 0.3, 'bandpass', 3000, 2);
  },
  shing(v) {
    v.hiss(0, 0.02, 0.2, 0.6, 'bandpass', 3000, 3, v.o, 8000);
    const r1 = v.tone('sine', 4200, 0.03, 0.002, 0.6, 0.12);
    v.tone('sine', 6150, 0.03, 0.002, 0.45, 0.08);
    v.lfo(9, 12, r1.detune, 0.03, 0.66);
  },
  hiccup(v) {
    v.tone('sine', 300, 0, 0.003, 0.08, 0.5, v.o, 650, 0.05);
    v.hiss(0, 0.0005, 0.01, 0.2, 'bandpass', 1500, 2);
  },
  glug(v) {
    // resonant lowpassed noise pulsing at 8 Hz, each pulse a rising "bloop"
    const lp = v.filt('lowpass', 300, 8);
    const g = v.gain(0);
    const pts = [[0, 0]];
    const fp = [];
    for (let i = 0; i < 4; i++) {
      const t = i * 0.125;
      pts.push([t + 0.01, 0.8, 'l'], [t + 0.09, 0.02]);
      fp.push([t, 300, 's'], [t + 0.09, 650]);
      v.tone('sine', 200, t, 0.005, 0.07, 0.25, v.o, 420, 0.06);
    }
    v.env(g.gain, pts);
    v.env(lp.frequency, fp, true);
    v.chain(v.noise(0, 0.5, 'brown'), lp, g, v.o);
  },
  bell(v) {
    // temple bell partials: [ratio, amp, decay scale] (hum, prime, tierce, quint, nominal...)
    const f = 196;
    const P = [[0.5, 0.6, 1], [1, 1, 0.8], [1.19, 0.5, 0.6], [1.5, 0.35, 0.5], [2, 0.4, 0.4], [2.74, 0.2, 0.25], [3.2, 0.12, 0.18]];
    for (const [r, a, ds] of P) v.tone('sine', f * r, 0, 0.003, 3.5 * ds, a * 0.35);
    v.tone('sine', f * 1.005, 0, 0.003, 2.5, 0.15);
    v.hiss(0, 0.001, 0.03, 0.3, 'lowpass', 3000, 0.7);
  },
  cowbell(v) { cowbell(v, 0, 0.5); },
  boing(v) {
    const o = v.osc('sine', 150, 0, 0.47);
    v.env(o.frequency, [[0, 150], [0.15, 400], [0.45, 380]], true);
    const vib = v.lfo(12, 60, o.detune, 0, 0.47);
    v.env(vib.gain, [[0, 60], [0.45, 5]]);
    o.connect(v.perc(0.5, 0.005, 0.45));
    v.tone('triangle', 75, 0, 0.005, 0.3, 0.15, v.o, 200, 0.15);
  },
  mud(v) {
    for (const [t, s] of [[0, 1], [0.12, 0.6]]) {
      const lp = v.filt('lowpass', 200, 12);
      v.env(lp.frequency, [[t, 200], [t + 0.05, 1200], [t + 0.2 * s, 300]], true);
      v.chain(v.noise(t, t + 0.22 * s, 'pink'), lp, v.perc(0.5 * s, 0.01, 0.2 * s, t));
      const o = v.osc('sine', 120, t, t + 0.2 * s);
      v.env(o.frequency, [[t, 120], [t + 0.05, 300], [t + 0.18 * s, 90]], true);
      o.connect(v.perc(0.35 * s, 0.01, 0.17 * s, t));
    }
  },
  slip(v) {
    const o = v.osc('sine', 500, 0, 0.42);
    v.env(o.frequency, [[0, 500], [0.35, 1800]], true);
    v.lfo(7, 25, o.detune, 0, 0.42);
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.03, 0.35, 'l'], [0.33, 0.3], [0.4, 0]]);
    v.chain(o, g, v.o);
    v.hiss(0, 0.03, 0.35, 0.04, 'bandpass', 1500, 3, v.o, 0, 'pink');
  },
  egg(v) {
    v.tone('sine', 600, 0, 0.001, 0.06, 0.6, v.o, 150, 0.05);
    v.hiss(0, 0.0005, 0.01, 0.3, 'bandpass', 2000, 2);
  },
  eggCrack(v) {
    clicks(v, 0, [0, 0.025, 0.04, 0.07], 3500, 0.6);
    v.hiss(0, 0.001, 0.08, 0.4, 'highpass', 2500, 0.7);
    v.tone('sine', 900, 0, 0.001, 0.03, 0.25, v.o, 700, 0.03);
  },
  feathers(v) {
    const g = v.gain(0);
    const pts = [[0, 0]];
    for (let i = 0; i < 8; i++) {
      const t = i * 0.05 + Math.random() * 0.02;
      pts.push([t + 0.01, rand(0.15, 0.3), 'l'], [t + 0.04, 0.02]);
    }
    pts.push([0.45, 0]);
    v.env(g.gain, pts);
    v.chain(v.noise(0, 0.46, 'pink'), v.filt('bandpass', 2500, 0.7), g, v.o);
    v.hiss(0, 0.05, 0.3, 0.06, 'highpass', 6000, 0.7);
  },
  ramHit(v) {
    v.tone('sine', 800, 0, 0.001, 0.04, 0.5);
    v.hiss(0, 0.0005, 0.03, 0.4, 'bandpass', 1200, 6);
    thud(v, 0, 140, 70, 0.15, 1, 4);
  },
  crowRing(v) {
    // FM'd beating sines through a falling bandpass = expanding sonic ring
    const bp = v.filt('bandpass', 3000, 1.5);
    v.env(bp.frequency, [[0, 3000], [0.5, 600]], true);
    const trem = v.gain(0.7);
    v.lfo(14, 0.3, trem.gain, 0, 0.55);
    for (const f of [1200, 1210]) {
      const o = v.osc('sine', f, 0, 0.55);
      v.lfo(220, 400, o.frequency, 0, 0.55);
      o.connect(bp);
    }
    v.chain(bp, trem, v.perc(0.5, 0.02, 0.5));
  },
  tea(v) {
    v.tone('sine', 3200, 0, 0.001, 0.06, 0.15); // cup clink
    const bp = v.filt('bandpass', 400, 6);
    v.env(bp.frequency, [[0, 400], [0.6, 1100]], true); // pitch rises as the cup fills
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.05, 0.6, 'l'], [0.55, 0.5], [0.65, 0]]);
    const trem = v.gain(0.8);
    v.lfo(11, 0.2, trem.gain, 0, 0.66);
    v.chain(v.noise(0, 0.66, 'pink'), bp, trem, g, v.o);
    v.hiss(0.1, 0.1, 0.4, 0.15, 'highpass', 5000, 0.7);
  },
  stomp(v) {
    thud(v, 0, 90, 35, 0.25, 1.1, 8);
    v.hiss(0, 0.002, 0.12, 0.8, 'lowpass', 800, 0.7);
    clicks(v, 0.05, [0, 0.03, 0.065, 0.09], 2200, 0.25);
  },
  teleport(v) {
    // reversed swish: swell then hard cut, then a "bwip" + sparkle
    const bp = v.filt('bandpass', 800, 1.5);
    v.env(bp.frequency, [[0, 800], [0.15, 5000]], true);
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.15, 0.6, 'l'], [0.17, 0, 'l']]);
    v.chain(v.noise(0, 0.18), bp, g, v.o);
    v.tone('sine', 400, 0.14, 0.002, 0.08, 0.3, v.o, 1600, 0.06);
    pings(v, 0.15, 6, 0.2, 3000, 6000, 0.1, 0.05);
  },
  buddhaPalm(v) {
    // low "ah" choir: detuned saws through a parallel formant bank
    const mix = v.gain(0);
    v.env(mix.gain, [[0, 0], [0.25, 0.5, 'l'], [1.0, 0.45], [1.5, 0]]);
    mix.connect(v.o);
    const fm = [[700, 6, 1], [1150, 7, 0.6], [2600, 8, 0.25]].map(([f, q, a]) => {
      const bp = v.filt('bandpass', f, q);
      v.chain(bp, v.gain(a), mix);
      return bp;
    });
    const lp = v.filt('lowpass', 500, 0.7);
    v.chain(lp, v.gain(0.4), mix);
    for (const f of [65.4, 98, 130.8, 196]) {
      for (const det of [-9, 9]) {
        const o = v.osc('sawtooth', f, 0, 1.52, det);
        for (const bp of fm) o.connect(bp);
        o.connect(lp);
      }
    }
    v.tone('sine', 32.7, 0, 0.2, 1.3, 0.5);
    thud(v, 0, 60, 30, 0.5, 0.8, 6);
    v.hiss(0, 0.3, 1.1, 0.06, 'bandpass', 1200, 1, v.o, 0, 'pink');
  },
  scream(v, o) { VOICES.goatScream(v, o); },
};

// 0 = expendable (skipped when over the voice cap), 1 = normal (default), 2 = big moment.
export const SFX_PRIO = {
  uiMove: 0, scroll: 0, jump: 0, airJump: 0, land: 0, dash: 0, wallJump: 0,
  swingLight: 0, swingHeavy: 0, mashTick: 0, beard: 0, feathers: 0, chiReady: 0,
  gong: 2, bigGong: 2, superFreeze: 2, awaken: 2, ko: 2, perfect: 2, roundStart: 2,
  fight: 2, timeUp: 2, hitUltra: 2, buddhaPalm: 2, clashStart: 2, clashWin: 2, guardBreak: 2,
};

// Linear level trims measured from offline renders, so the mix sits together
// (whooshes were ~20 dB under the hits; big moments ran hot).
export const SFX_TRIM = {
  scroll: 4, dash: 2.6, swingLight: 4.5, swingHeavy: 3.4, throw: 5, feathers: 3, tea: 1.7,
  snore: 1.8, shing: 2.3, beam: 2, crowRing: 1.5, comboTier: 1.8, pickup: 1.6, coin: 1.6,
  perfect: 1.6, chime: 1.4, ko: 0.55, fight: 0.6, bigGong: 0.75, dragon: 0.8, scream: 0.75,
};

export const SFX_NAMES = Object.keys(SFX);

// UltraFist animal / character vocal synths. Same recipe signature as sfx.js:
// (v, opts) => void, where v is a core Voice routed to the voice bus.

import { rand } from './core.js';

// Parallel formant bank: src -> [bandpass(f, Q) * amp ...] -> returned mix gain.
function formants(v, src, bands, out = 1) {
  const mix = v.gain(out);
  for (const [f, q, a] of bands) {
    const bp = v.filt('bandpass', f, q);
    src.connect(bp);
    if (a === 1) bp.connect(mix);
    else v.chain(bp, v.gain(a), mix);
  }
  return mix;
}

export const VOICES = {
  // Cow: sawtooth glide 120 -> 95 Hz through an "oo" formant bank, lowpass
  // opening for the "mm" onset, slight vibrato and a breathy layer.
  moo(v) {
    const dur = 0.9;
    const pts = [[0, 112], [0.15, 122], [0.6, 106], [dur, 93]];
    const o1 = v.osc('sawtooth', 112, 0, dur + 0.05);
    const o2 = v.osc('sawtooth', 112, 0, dur + 0.05, 7);
    v.env(o1.frequency, pts, true);
    v.env(o2.frequency, pts, true);
    const vib = v.lfo(5, 18, o1.detune, 0, dur + 0.05);
    vib.connect(o2.detune);
    const lp = v.filt('lowpass', 400, 1);
    v.env(lp.frequency, [[0, 400], [0.2, 1600], [dur, 700]], true);
    o1.connect(lp);
    o2.connect(lp);
    const mix = formants(v, lp, [[300, 5, 1], [870, 8, 0.5]], 2);
    v.chain(lp, v.gain(0.25), mix);
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.12, 0.9, 'l'], [0.65, 0.8], [dur, 0]]);
    v.chain(mix, g, v.o);
    v.hiss(0, 0.12, dur - 0.12, 0.06, 'bandpass', 900, 1, v.o, 0, 'pink');
  },

  // Rooster: one gated saw following a cock-a-doodle-doo pitch contour,
  // 7 Hz vibrato, FM rasp, a little grit, through formants.
  crow(v) {
    // [start, end, f1, f2, amp]
    const syl = [[0, 0.11, 600, 900, 0.8], [0.15, 0.22, 800, 1000, 0.6], [0.26, 0.4, 900, 1100, 0.85],
      [0.44, 0.52, 1000, 950, 0.6], [0.57, 1.2, 1050, 800, 1]];
    const fp = [];
    const gp = [[0, 0]];
    for (let i = 0; i < syl.length; i++) {
      const [s, e, f1, f2, a] = syl[i];
      fp.push([s, f1, 's']);
      if (i === syl.length - 1) fp.push([0.75, 1150]);
      fp.push([e, f2]);
      gp.push([s, 0, 's'], [s + 0.015, a, 'l'], [e - 0.02, a * 0.8], [e, 0]);
    }
    const o = v.osc('sawtooth', 600, 0, 1.22);
    v.env(o.frequency, fp, true);
    v.lfo(7, 35, o.detune, 0, 1.22);
    v.lfo(150, 100, o.frequency, 0, 1.22); // rasp
    const g = v.gain(0);
    v.env(g.gain, gp);
    const sh = v.shaper(3);
    v.chain(o, sh, g);
    const mix = formants(v, g, [[1000, 3, 1], [2500, 5, 0.5]], 1.4);
    v.chain(mix, v.o);
  },

  // Hen: 2-3 short pitched, noisy clucks.
  cluck(v) {
    const n = Math.random() < 0.5 ? 2 : 3;
    const bp = v.filt('bandpass', 1000, 2);
    v.chain(bp, v.gain(1.6), v.o);
    for (let i = 0; i < n; i++) {
      const t = i * 0.12 + rand(0, 0.02);
      const f = rand(500, 700);
      v.tone('sawtooth', f, t, 0.005, 0.075, 0.6, bp, f * 0.7, 0.07);
      v.tone('square', f * 1.5, t, 0.003, 0.04, 0.12, bp);
      v.hiss(t, 0.002, 0.05, 0.25, 'bandpass', f * 2, 3);
    }
  },

  // Pig: two nasal square bursts with a resonant filter snap + snorty noise.
  oink(v) {
    for (const [t, s] of [[0, 1], [0.1, 0.9]]) {
      const lp = v.filt('lowpass', 1800, 10);
      v.env(lp.frequency, [[t, 1800 * s], [t + 0.05, 600]], true);
      const nasal = v.filt('bandpass', 1200, 6);
      const o = v.osc('square', 400 * s, t, t + 0.07);
      v.env(o.frequency, [[t, 400 * s], [t + 0.05, 250 * s]], true);
      const g = v.perc(0.5, 0.003, 0.055, t, null);
      o.connect(g);
      g.connect(lp);
      v.chain(g, nasal, v.gain(0.5), v.o);
      lp.connect(v.o);
      // snort
      const sn = v.filt('bandpass', 500, 4);
      const fl = v.gain(0.6);
      v.lfo(40, 0.4, fl.gain, t, t + 0.08);
      v.chain(v.noise(t, t + 0.08, 'pink'), sn, fl, v.perc(0.5, 0.005, 0.06, t));
    }
  },

  // Goat: absurdly human "AAAAH" - detuned saws, wobbly vibrato, bleat
  // tremolo, grit, "ah" formants and a noise layer.
  goatScream(v) {
    const dur = 0.9;
    const pts = [[0, 380], [0.08, 440], [0.6, 430], [dur, 360]];
    const sh = v.shaper(4);
    // shared LFOs (cents) feeding every saw's detune: fast vibrato + slow wobble
    const vib = v.gain(60);
    v.chain(v.osc('sine', 7.5, 0, dur + 0.05), vib);
    const wob = v.gain(30);
    v.chain(v.osc('sine', 3, 0, dur + 0.05), wob);
    for (const det of [0, 20, -12]) {
      const o = v.osc('sawtooth', 380, 0, dur + 0.05, det);
      v.env(o.frequency, pts, true);
      vib.connect(o.detune);
      wob.connect(o.detune);
      o.connect(sh);
    }
    const amp = v.gain(0.75);
    v.lfo(9, 0.3, amp.gain, 0, dur + 0.05); // bleat tremolo
    sh.connect(amp);
    const mix = formants(v, amp, [[800, 6, 1], [1200, 7, 0.7], [2600, 6, 0.3]], 1.8);
    v.chain(amp, v.filt('lowpass', 3000, 0.7), v.gain(0.15), mix);
    const g = v.gain(0);
    v.env(g.gain, [[0, 0], [0.05, 1, 'l'], [0.65, 0.85], [dur, 0]]);
    v.chain(mix, g, v.o);
    v.hiss(0, 0.05, dur - 0.05, 0.1, 'bandpass', 1500, 1);
  },
};

// Linear level trims (measured offline): the sustained vowels are dense and loud.
export const VOICE_TRIM = { moo: 0.75, crow: 0.6, goatScream: 0.75 };

export const ANIMAL_NAMES = Object.keys(VOICES);

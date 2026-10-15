// UltraFist audio core: shared engine state + a tiny synthesis toolkit used by
// sfx.js, voices.js and music.js. Nothing here touches window/AudioContext at
// import time; audio.js fills in S.ctx and the graph on init().

export const S = {
  ctx: null,          // AudioContext (null until init succeeds)
  failed: false,      // true when Web Audio is unavailable -> everything is a no-op
  master: null,
  comp: null,
  bus: { music: null, sfx: null, voice: null },
  lp: { music: null, sfx: null },
  vol: { master: 0.9, music: 0.7, sfx: 0.9, voice: 0.9 }, // slider values; gain = v*v
  noise: null,        // { white, pink, brown } shared 2 s buffers
  slow: 1,            // slow-mo factor (1 = normal)
  slowPitch: 1,       // pitch multiplier applied to new sounds (sqrt(slow))
  hasPanner: false,
  nyq: 22050,
};

export const EPS = 0.0001;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const rand = (a, b) => a + Math.random() * (b - a);
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);

// Freeze a param at its current (automated) value so new automation starts from there.
export function holdParam(p, t) {
  if (p.cancelAndHoldAtTime) {
    try { p.cancelAndHoldAtTime(t); return; } catch (e) { /* fall through */ }
  }
  const v = p.value;
  p.cancelScheduledValues(t);
  p.setValueAtTime(v, t);
}

// ---------- shared buffers ----------

export function makeNoise(ctx) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 2);
  const w = ctx.createBuffer(1, len, sr);
  const p = ctx.createBuffer(1, len, sr);
  const b = ctx.createBuffer(1, len, sr);
  const wd = w.getChannelData(0), pd = p.getChannelData(0), bd = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const x = Math.random() * 2 - 1;
    wd[i] = x;
    // Paul Kellet's pink-noise filter
    b0 = 0.99886 * b0 + x * 0.0555179;
    b1 = 0.99332 * b1 + x * 0.0750759;
    b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856;
    b4 = 0.55 * b4 + x * 0.5329522;
    b5 = -0.7616 * b5 - x * 0.016898;
    pd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
    b6 = x * 0.115926;
    last = (last + 0.02 * x) / 1.02;
    bd[i] = last * 3.5;
  }
  return { white: w, pink: p, brown: b };
}

// Soft-clip curve for WaveShaper distortion, cached per amount.
const curves = new Map();
export function softCurve(k) {
  k = Math.round(k);
  let c = curves.get(k);
  if (c) return c;
  const n = 1024;
  c = new Float32Array(n);
  const norm = Math.tanh(k * 0.5 + 0.5);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    c[i] = Math.tanh(x * (k * 0.5 + 0.5)) / norm;
  }
  curves.set(k, c);
  return c;
}

// Master safety limiter curve. Input is pre-scaled by 0.5, so the curve spans
// signal levels -2..2: linear up to 0.8, then a soft knee approaching 1.0.
export function limitCurve() {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const y = ((i * 2) / (n - 1) - 1) * 2;
    const a = Math.abs(y);
    const o = a < 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2);
    c[i] = y < 0 ? -o : o;
  }
  return c;
}

// Karplus-Strong plucked-string buffers. One buffer per octave band (and
// tone settings); notes are transposed with playbackRate (rate 1..2).
const ksCache = new Map();
export function ksFor(f, bright = 0.6, loss = 0.996) {
  const ctx = S.ctx;
  const oct = Math.floor(Math.log2(Math.max(f, 30) / 55));
  bright = Math.round(bright * 10) / 10;
  loss = Math.round(loss * 1000) / 1000;
  const key = oct + '|' + bright + '|' + loss;
  let e = ksCache.get(key);
  if (!e) {
    if (ksCache.size > 48) ksCache.clear();
    const base = 55 * Math.pow(2, oct);
    const sr = ctx.sampleRate;
    const P = Math.max(2, Math.round(sr / base));
    const len = Math.floor(sr * 1.6);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    // excitation: noise, lowpassed for darker tones, DC removed
    let prev = 0, mean = 0;
    const lp = 0.15 + 0.85 * bright;
    for (let i = 0; i < P; i++) { prev += (Math.random() * 2 - 1 - prev) * lp; d[i] = prev; mean += prev; }
    mean /= P;
    for (let i = 0; i < P; i++) d[i] -= mean;
    for (let i = P; i < len; i++) d[i] = loss * 0.5 * (d[i - P] + (i - P - 1 >= 0 ? d[i - P - 1] : 0));
    // normalise + fade the tail to avoid a click at buffer end
    let pk = 0;
    for (let i = 0; i < P * 2 && i < len; i++) pk = Math.max(pk, Math.abs(d[i]));
    const g = pk > 0 ? 0.9 / pk : 1;
    const fade = Math.floor(len * 0.1);
    for (let i = 0; i < len; i++) d[i] *= g * (i > len - fade ? (len - i) / fade : 1);
    e = { buf, f0: sr / (P + 0.5) };
    ksCache.set(key, e);
  }
  return e;
}

// ---------- Voice: one fire-and-forget sound ----------
// Recipes use nominal times (seconds from start) and frequencies (Hz); the
// voice scales them by its time-stretch (ts) and pitch (p) multipliers.
// All nodes are disconnected once every source has ended (+ optional tail).

export class Voice {
  constructor(dest, p = 1, ts = 1, t0) {
    const ctx = S.ctx;
    this.ctx = ctx;
    this.o = dest;
    this.p = p;
    this.ts = ts;
    this.t0 = t0 !== undefined ? t0 : ctx.currentTime + 0.003;
    this.end = this.t0;
    this.nodes = [];
    this.srcs = [];
    this.live = 0;
    this.tail = 0;      // seconds to keep nodes connected after sources end (delay tails)
    this.freed = false;
    this.onDone = null;
  }

  at(r) { return this.t0 + r * this.ts; }
  fq(hz) { return clamp(hz * this.p, 1, S.nyq); }
  reg(n) { if (n) this.nodes.push(n); return n; }

  _src(n, a, b, off) {
    const t0 = this.at(a);
    const t1 = Math.max(this.at(b), t0 + 0.005);
    this.reg(n);
    this.srcs.push(n);
    this.live++;
    if (t1 > this.end) this.end = t1;
    n.onended = () => { if (--this.live <= 0) this._settle(); };
    if (off !== undefined) n.start(t0, off); else n.start(t0);
    n.stop(t1);
    return n;
  }

  _settle() {
    if (this.freed) return;
    const ms = this.tail > 0 ? this.tail * this.ts * 1000 + 30 : 0;
    if (ms) setTimeout(() => this.free(), ms); else this.free();
  }

  // Call after building: frees immediately if the recipe made no sources.
  seal() { if (this.live <= 0) this.free(); }

  free() {
    if (this.freed) return;
    this.freed = true;
    for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    this.nodes.length = 0;
    this.srcs.length = 0;
    if (this.onDone) this.onDone(this);
  }

  // Stop all sources shortly (voice stealing / errors). Caller fades its output.
  kill(fade = 0.02) {
    const t = this.ctx.currentTime + fade;
    this.tail = 0;
    for (const s of this.srcs) { try { s.stop(t); } catch (e) { /* already stopped */ } }
  }

  // --- sources ---
  osc(type, f, a, b, det = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = this.fq(f);
    if (det) o.detune.value = det;
    return this._src(o, a, b);
  }

  noise(a, b, kind = 'white', rate = 1) {
    const n = this.ctx.createBufferSource();
    n.buffer = S.noise[kind] || S.noise.white;
    n.loop = true;
    n.playbackRate.value = clamp(rate * this.p, 0.05, 16);
    return this._src(n, a, b, Math.random() * 1.5);
  }

  buf(buffer, a, b, rate = 1) {
    const n = this.ctx.createBufferSource();
    n.buffer = buffer;
    n.playbackRate.value = clamp(rate * this.p, 0.05, 16);
    return this._src(n, a, b);
  }

  // --- processors ---
  gain(g = 1) {
    const n = this.ctx.createGain();
    n.gain.value = g;
    return this.reg(n);
  }

  filt(type, f, Q = 1, db = 0) {
    const n = this.ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = this.fq(f);
    n.Q.value = Q;
    if (db) n.gain.value = db;
    return this.reg(n);
  }

  shaper(k = 4) {
    const n = this.ctx.createWaveShaper();
    n.curve = softCurve(k);
    return this.reg(n);
  }

  delay(sec, max = 1) {
    const n = this.ctx.createDelay(max);
    n.delayTime.value = Math.min(sec * this.ts, max);
    return this.reg(n);
  }

  chain(...ns) {
    for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]);
    return ns[ns.length - 1];
  }

  // Automation: pts = [[t, value, curve?], ...]. First point is a set. Curve
  // 'l' = linear, 's' = step, default = exponential when coming from a
  // non-zero value (ramps "to 0" land on EPS), linear otherwise.
  env(param, pts, isF = false) {
    let prev = 0;
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      const t = this.at(pt[0]);
      let val = isF ? this.fq(pt[1]) : pt[1];
      const c = pt[2];
      if (i === 0 || c === 's') param.setValueAtTime(val, t);
      else if (c !== 'l' && prev >= EPS && val >= 0) {
        val = Math.max(val, EPS);
        param.exponentialRampToValueAtTime(val, t);
      } else param.linearRampToValueAtTime(val, t);
      prev = val;
    }
    return param;
  }

  // Gain node with an attack/decay envelope, connected to dest.
  perc(peak, a, d, t = 0, dest = this.o) {
    const g = this.gain(0);
    this.env(g.gain, [[t, 0], [t + a, peak], [t + a + d, 0]]);
    if (dest) g.connect(dest);
    return g;
  }

  // Oscillator through a perc envelope; optional exp sweep f -> f2 over `sweep` s.
  tone(type, f, t, a, d, peak, dest = this.o, f2 = 0, sweep = 0) {
    const o = this.osc(type, f, t, t + a + d + 0.02);
    if (f2) this.env(o.frequency, [[t, f], [t + (sweep || a + d), f2]], true);
    o.connect(this.perc(peak, a, d, t, dest));
    return o;
  }

  // Filtered noise burst; optional filter sweep f -> f2 over the whole burst.
  hiss(t, a, d, peak, ftype, f, Q = 1, dest = this.o, f2 = 0, kind = 'white', rate = 1) {
    const n = this.noise(t, t + a + d + 0.02, kind, rate);
    const fl = this.filt(ftype, f, Q);
    if (f2) this.env(fl.frequency, [[t, f], [t + a + d, f2]], true);
    this.chain(n, fl, this.perc(peak, a, d, t, dest));
    return fl;
  }

  // LFO into a param (e.g. osc.detune for vibrato). Returns the depth gain.
  lfo(rate, depth, param, a, b, type = 'sine') {
    const o = this.osc(type, rate, a, b);
    const g = this.gain(depth);
    o.connect(g);
    g.connect(param);
    return g;
  }
}

// ---------- shared instruments (used by sfx + music) ----------

// Taiko: sine thump with a fast pitch drop + skin noise.
export function taiko(v, t, f = 60, vol = 1, dest = v.o, d = 0.38) {
  v.tone('sine', f * 2.4, t, 0.002, d, vol, dest, f, 0.07);
  v.hiss(t, 0.001, 0.07, vol * 0.45, 'lowpass', 900, 0.8, dest);
  v.hiss(t, 0.0005, 0.012, vol * 0.22, 'bandpass', 2200, 1, dest);
}

// Gong: inharmonic partials [ratio, amp, decay scale], fundamental bends down a touch.
const GONG = [[1, 1, 1], [2.76, 0.55, 0.7], [5.4, 0.32, 0.45], [8.9, 0.18, 0.3]];
export function gong(v, t, f = 110, dur = 3, vol = 1, dest = v.o, n = 4) {
  for (let i = 0; i < n && i < GONG.length; i++) {
    const g = GONG[i];
    v.tone('sine', f * g[0] * (i === 0 ? 1.03 : 1), t, i === 1 ? 0.03 : 0.004, dur * g[2], vol * g[1] * 0.5,
      dest, i === 0 ? f : 0, 0.4);
  }
  v.tone('sine', f * 1.004, t, 0.02, dur * 0.8, vol * 0.22, dest); // beating partner
  v.hiss(t, 0.001, 0.06, vol * 0.25, 'lowpass', 1400, 0.7, dest);
}

// Classic two-square cowbell.
export function cowbell(v, t, vol = 1, dest = v.o) {
  const g = v.gain(0);
  v.env(g.gain, [[t, 0], [t + 0.001, vol], [t + 0.03, vol * 0.35], [t + 0.28, 0]]);
  const bp = v.filt('bandpass', 1000, 0.8);
  v.osc('square', 540, t, t + 0.3).connect(g);
  v.osc('square', 800, t, t + 0.3).connect(g);
  v.chain(g, bp, dest);
}

// Plucked string (guzheng/pipa/banjo-ish) from the KS cache.
export function pluck(v, t, f, vol = 1, dest = v.o, dur = 0.9, bright = 0.6, loss = 0.996) {
  const k = ksFor(f, bright, loss);
  const g = v.gain(vol);
  v.env(g.gain, [[t, vol], [t + dur * 0.6, vol], [t + dur, 0]]);
  v.buf(k.buf, t, t + dur + 0.01, f / k.f0).connect(g);
  g.connect(dest);
  return g;
}

// Bell partial helper: sine + bright upper partial.
export function bellNote(v, t, f, vol = 1, d = 0.5, dest = v.o) {
  v.tone('sine', f, t, 0.002, d, vol, dest);
  v.tone('sine', f * 2.76, t, 0.001, d * 0.4, vol * 0.25, dest);
}

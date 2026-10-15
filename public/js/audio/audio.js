// UltraFist audio entry point: context creation/unlock, buses, volume,
// slow-mo, voice limiting. Safe to import anywhere: nothing touches
// window/AudioContext until init(). Without Web Audio every call is a no-op.

import { S, Voice, clamp, num, holdParam, makeNoise, limitCurve } from './core.js';
import { SFX, SFX_PRIO, SFX_TRIM, SFX_NAMES } from './sfx.js';
import { VOICES, VOICE_TRIM, ANIMAL_NAMES } from './voices.js';
import { music, _wake, TRACK_IDS } from './music.js';
import { speech } from './speech.js';

const BUSES = ['master', 'music', 'sfx', 'voice'];
const CAP = 24;           // max concurrently playing sfx + animal voices
const THROTTLE_MS = 25;   // identical names closer than this are dropped

const active = [];        // live Voices, oldest first
const lastFire = new Map();
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const taper = (v) => v * v; // perceptual volume curve for 0..1 sliders

let gestureHooked = false;

// ---------- context + graph ----------

function init() {
  if (S.ctx || S.failed) return;
  try {
    const W = typeof window !== 'undefined' ? window : globalThis;
    const AC = W.AudioContext || W.webkitAudioContext;
    if (!AC) { S.failed = true; return; }
    let ctx;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
    S.ctx = ctx;
    S.nyq = ctx.sampleRate / 2 - 100;
    S.hasPanner = typeof ctx.createStereoPanner === 'function';

    // buses -> master -> compressor -> soft limiter -> out
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 6;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.16;
    const pre = ctx.createGain();
    pre.gain.value = 0.5;
    const lim = ctx.createWaveShaper();
    lim.curve = limitCurve();
    const master = ctx.createGain();
    master.gain.value = taper(S.vol.master);
    master.connect(comp);
    comp.connect(pre);
    pre.connect(lim);
    lim.connect(ctx.destination);
    S.master = master;
    S.comp = comp;

    const open = Math.min(20000, S.nyq);
    for (const name of ['music', 'sfx', 'voice']) {
      const g = ctx.createGain();
      g.gain.value = taper(S.vol[name]);
      if (name === 'voice') {
        g.connect(master);
      } else {
        // slow-mo lowpass (wide open normally)
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = open;
        lp.Q.value = 0.707;
        g.connect(lp);
        lp.connect(master);
        S.lp[name] = lp;
      }
      S.bus[name] = g;
    }

    S.noise = makeNoise(ctx);
    if (S.slow !== 1) setSlowmo(S.slow);

    const onState = () => { if (ctx.state === 'running') onRunning(); };
    if (ctx.addEventListener) ctx.addEventListener('statechange', onState);
    else ctx.onstatechange = onState;
    hookGestures();
    speech.warm();
    if (ctx.state === 'running') onRunning();
  } catch (e) {
    S.ctx = null;
    S.failed = true;
  }
}

// Fallback: unlock on the first user gesture even if the game forgets to.
function hookGestures() {
  if (gestureHooked || typeof window === 'undefined' || !window.addEventListener) return;
  gestureHooked = true;
  for (const ev of ['pointerdown', 'keydown', 'touchend', 'mousedown']) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  }
}

function unhookGestures() {
  if (!gestureHooked || typeof window === 'undefined') return;
  gestureHooked = false;
  for (const ev of ['pointerdown', 'keydown', 'touchend', 'mousedown']) {
    window.removeEventListener(ev, unlock, { capture: true });
  }
}

let primed = false;
function unlock() {
  init();
  const ctx = S.ctx;
  if (!ctx) return;
  if (!primed) {
    // iOS/Safari: start a 1-sample silent buffer inside the gesture
    primed = true;
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.onended = () => s.disconnect();
      s.start(0);
    } catch (e) { /* ignore */ }
  }
  if (ctx.state !== 'running') {
    try {
      const p = ctx.resume();
      if (p && p.then) p.then(onRunning, () => {});
    } catch (e) { /* ignore */ }
  } else {
    onRunning();
  }
}

function onRunning() {
  if (!S.ctx || S.ctx.state !== 'running') return;
  unhookGestures();
  _wake();
}

// ---------- volume ----------

function setVolume(bus, v) {
  if (!BUSES.includes(bus)) return;
  v = clamp(num(+v, 0), 0, 1);
  S.vol[bus] = v;
  const node = bus === 'master' ? S.master : S.bus[bus];
  if (!node || !S.ctx) return;
  const t = S.ctx.currentTime;
  holdParam(node.gain, t);
  node.gain.setTargetAtTime(taper(v), t, 0.03);
}

function getVolume(bus) {
  return BUSES.includes(bus) ? S.vol[bus] : 0;
}

// ---------- slow-mo ----------

function setSlowmo(factor) {
  const f = clamp(num(+factor, 1), 0.05, 1);
  S.slow = f;
  S.slowPitch = Math.sqrt(f); // 0.25 -> 0.5 = -1200 cents
  const ctx = S.ctx;
  if (!ctx || !S.lp.sfx) return;
  const open = Math.min(20000, S.nyq);
  const cut = f >= 0.999 ? open : clamp(900 * Math.pow(20000 / 900, (f - 0.25) / 0.75), 300, open);
  const t = ctx.currentTime;
  const tc = f < 0.999 ? 0.05 : 0.25; // dive in fast, recover smoothly
  for (const k of ['sfx', 'music']) {
    const p = S.lp[k].frequency;
    holdParam(p, t);
    p.setTargetAtTime(cut, t, tc);
  }
}

// ---------- voice management ----------

function drop(v) {
  const i = active.indexOf(v);
  if (i >= 0) active.splice(i, 1);
}

function steal(v) {
  const t = S.ctx.currentTime;
  if (v.outGain) {
    holdParam(v.outGain.gain, t);
    v.outGain.gain.linearRampToValueAtTime(0, t + 0.015);
  }
  v.kill(0.02);
  drop(v);
}

function makeRoom(prio) {
  const t = S.ctx.currentTime;
  // free voices whose onended never arrived
  for (let i = active.length - 1; i >= 0; i--) {
    const v = active[i];
    if (v.end + v.tail * v.ts + 1 < t) v.free();
  }
  if (active.length < CAP) return true;
  if (prio <= 0) return false;
  // steal the oldest voice of the lowest priority not above ours
  for (let p = 0; p <= prio; p++) {
    for (let i = 0; i < active.length; i++) {
      if (active[i].prio === p) { steal(active[i]); return true; }
    }
  }
  return false;
}

function fire(table, name, o, busName, prio, key, trim) {
  const ctx = S.ctx;
  if (!ctx || ctx.state !== 'running' || !own(table, name)) return;
  o = o && typeof o === 'object' ? o : {};
  const vol = clamp(num(o.vol, 1), 0, 4);
  if (vol <= 0) return;
  const tm = nowMs();
  const last = lastFire.get(key);
  if (last !== undefined && tm - last < THROTTLE_MS) return;
  if (active.length >= CAP && !makeRoom(prio)) return;
  lastFire.set(key, tm);

  const pitch = clamp(num(o.pitch, 1), 0.1, 8) * S.slowPitch;
  const out = ctx.createGain();
  out.gain.value = vol * trim;
  const pan = clamp(num(o.pan, 0), -1, 1);
  let pn = null;
  if (pan && S.hasPanner) {
    pn = ctx.createStereoPanner();
    pn.pan.value = pan;
    out.connect(pn);
    pn.connect(S.bus[busName]);
  } else {
    out.connect(S.bus[busName]);
  }
  const v = new Voice(out, pitch, clamp(1 / pitch, 0.5, 2.2)); // lower pitch = slower, tape-style
  v.reg(out);
  v.reg(pn);
  v.outGain = out;
  v.prio = prio;
  v.name = name;
  v.onDone = drop;
  active.push(v);
  try {
    table[name](v, o);
  } catch (e) {
    v.kill(0.005);
    if (typeof console !== 'undefined') console.warn('[audio] ' + name + ' failed:', e);
  }
  v.seal();
}

function sfx(name, opts) {
  fire(SFX, name, opts, 'sfx', own(SFX_PRIO, name) ? SFX_PRIO[name] : 1, name, own(SFX_TRIM, name) ? SFX_TRIM[name] : 1);
}

function animal(kind, opts) {
  fire(VOICES, kind, opts, 'voice', 1, 'animal:' + kind, own(VOICE_TRIM, kind) ? VOICE_TRIM[kind] : 1);
}

// ---------- public object ----------

export const audio = {
  init,
  unlock,
  get ready() { return !!(S.ctx && S.ctx.state === 'running'); },
  get available() { return !S.failed; },
  setVolume,
  getVolume,
  sfx,
  animal,
  setSlowmo,
  get slowmo() { return S.slow; },
  music,
  speech,
  sfxNames: SFX_NAMES,
  animalNames: ANIMAL_NAMES,
  trackIds: TRACK_IDS,
  get activeVoices() { return active.length; },
  get context() { return S.ctx; },
};

export { music, speech, SFX_NAMES, ANIMAL_NAMES, TRACK_IDS };
export default audio;

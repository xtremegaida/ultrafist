// UltraFist speech: a thin, lag-free wrapper around window.speechSynthesis.
// Speech can't route through Web Audio, so bus volumes are applied per utterance.

import { S, clamp, num } from './core.js';

const SHOUT_GAP_MS = 1500;     // per-side shout cooldown
const ANNOUNCER_GUARD_MS = 1200; // shouts can't cut an announcer line this young
const MAX_LEN = 60;

let enabled = true;
let voice = null;
let hooked = false;
let current = null;            // { u, priority, start }
const lastShout = new Map();

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function synth() {
  try {
    return (typeof window !== 'undefined' && window.speechSynthesis) || null;
  } catch (e) {
    return null;
  }
}

function pickVoice() {
  const s = synth();
  if (!s) return;
  let list = [];
  try { list = s.getVoices() || []; } catch (e) { list = []; }
  if (!list.length) return;
  const en = list.filter((x) => /^en/i.test(x.lang || ''));
  const by = (re) => en.filter((x) => re.test((x.lang || '').replace('_', '-')));
  const us = by(/^en-US/i), gb = by(/^en-GB/i);
  const local = (arr) => arr.find((x) => x.localService) || arr[0];
  voice = local(us) || local(gb) || local(en) || list.find((x) => x.default) || list[0] || null;
}

function hook() {
  if (hooked) return;
  const s = synth();
  if (!s) return;
  hooked = true;
  pickVoice();
  try {
    if (s.addEventListener) s.addEventListener('voiceschanged', pickVoice);
    else s.onvoiceschanged = pickVoice;
  } catch (e) { /* ignore */ }
}

function isBusy(s) {
  try { return !!(s.speaking || s.pending); } catch (e) { return false; }
}

function say(text, opts = {}) {
  if (!enabled) return;
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return;
  hook();
  text = String(text == null ? '' : text).trim();
  if (!text) return;
  if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);

  const priority = opts.priority === 'announcer' ? 'announcer' : 'shout';
  const vol = clamp(num(opts.volume, 1), 0, 1) * clamp(S.vol.voice, 0, 1) * clamp(S.vol.master, 0, 1);
  if (vol <= 0.001) return;
  const t = nowMs();

  if (priority === 'shout') {
    const key = opts.side == null ? '_' : String(opts.side);
    const last = lastShout.get(key);
    if (last !== undefined && t - last < SHOUT_GAP_MS) return;
    if (isBusy(s)) {
      // never cut a fresh announcer line; otherwise cancel so shouts never queue/lag
      if (current && current.priority === 'announcer' && t - current.start < ANNOUNCER_GUARD_MS) return;
      try { s.cancel(); } catch (e) { /* ignore */ }
    }
    lastShout.set(key, t);
  } else {
    try { s.cancel(); } catch (e) { /* ignore */ }
  }

  let u;
  try { u = new SpeechSynthesisUtterance(text); } catch (e) { return; }
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
  u.pitch = clamp(num(opts.pitch, 1), 0, 2);
  u.rate = clamp(num(opts.rate, 1), 0.1, 2.5);
  u.volume = vol;
  const entry = { u, priority, start: t };
  const done = () => { if (current === entry) current = null; };
  u.onend = done;
  u.onerror = done;
  current = entry;
  try { s.speak(u); } catch (e) { current = null; }
}

function cancel() {
  const s = synth();
  current = null;
  if (!s) return;
  try { s.cancel(); } catch (e) { /* ignore */ }
}

export const speech = {
  say,
  cancel,
  get enabled() { return enabled; },
  set enabled(on) {
    enabled = !!on;
    if (!enabled) cancel();
  },
  get available() {
    const s = synth();
    if (!s) return false;
    hook();
    try { return (s.getVoices() || []).length > 0; } catch (e) { return false; }
  },
  get voiceName() { return voice ? voice.name : null; },
  // Call early (e.g. on init) so voices are loaded before the first line.
  warm() { hook(); },
};

// Maps physical devices to seats and produces the 1-byte input the simulation consumes.

import { BTN } from '../sim/input.js';
import { isDown } from './keyboard.js';
import { padByIndex, readPad } from './gamepad.js';
import { loadBindings } from './bindings.js';

let bindings = loadBindings();

export function setBindings(b) {
  bindings = b;
}

export function getBindings() {
  return bindings;
}

export function allGameKeys() {
  return [...Object.values(bindings.p1), ...Object.values(bindings.p2)];
}

function readKeyboard(map) {
  const a = {};
  for (const [act, code] of Object.entries(map)) a[act] = isDown(code);
  return a;
}

// Device ids: 'kb1', 'kb2', 'pad0'..'pad3'
export function readDevice(id) {
  if (id === 'kb1') return readKeyboard(bindings.p1);
  if (id === 'kb2') return readKeyboard(bindings.p2);
  if (id && id.startsWith('pad')) return readPad(padByIndex(Number(id.slice(3))));
  return {};
}

// Action state -> input byte with SOCD cleaning and shortcut chords.
export function toByte(a) {
  let b = 0;
  const l = !!a.left;
  const r = !!a.right;
  if (l && !r) b |= BTN.L;
  if (r && !l) b |= BTN.R;
  if (a.up) b |= BTN.U;
  else if (a.down) b |= BTN.D;
  if (a.lp) b |= BTN.LP;
  if (a.hp) b |= BTN.HP;
  if (a.sp) b |= BTN.SP;
  if (a.ta) b |= BTN.TA;
  if (a.throw) b |= BTN.LP | BTN.HP;
  if (a.ultra) b |= BTN.HP | BTN.SP;
  if (a.burst) b |= BTN.LP | BTN.SP;
  return b;
}

export function sampleSeat(deviceIds) {
  // a seat may be driven by several devices (e.g. keyboard + pad); OR them together
  let byte = 0;
  let pause = false;
  for (const id of deviceIds) {
    const a = readDevice(id);
    byte |= toByte(a);
    if (a.pause) pause = true;
  }
  // SOCD again after OR-ing devices
  if ((byte & BTN.L) && (byte & BTN.R)) byte &= ~(BTN.L | BTN.R);
  if ((byte & BTN.U) && (byte & BTN.D)) byte &= ~BTN.D;
  return { byte, pause };
}

export function connectedPads() {
  const out = [];
  for (let i = 0; i < 4; i++) if (padByIndex(i)) out.push(`pad${i}`);
  return out;
}

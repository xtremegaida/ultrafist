// Input bits, per-fighter input history, button buffering and motion-input detection.
// Everything here runs inside the pure simulation so the LAN server parses motions with the
// authoritative facing.

import { RULES } from '../data/rules.js';

export const BTN = { U: 1, D: 2, L: 4, R: 8, LP: 16, HP: 32, SP: 64, TA: 128 };
export const BUTTONS = ['lp', 'hp', 'sp', 'ta'];
const BUTTON_BITS = { lp: BTN.LP, hp: BTN.HP, sp: BTN.SP, ta: BTN.TA };

export const HIST = 40;

// Motions in numpad notation relative to facing (6 = forward). Steps are sets of accepted directions.
// `win` is the maximum age in frames of the first step; `fresh` means the first direction must have
// been entered inside the window (so long back-blocking doesn't turn a QCF into an HCF).
export const MOTIONS = {
  dqcf: { steps: [[2], [3], [6], [2], [3], [6]], win: 30 },
  hcf: { steps: [[4], [1, 2], [3], [6]], win: 22, fresh: true },
  dp: { steps: [[6, 3], [2], [3]], win: 18, fresh: true },
  qcf: { steps: [[2], [3], [6]], win: 15 },
  qcb: { steps: [[2], [1], [4]], win: 15 },
  dd: { steps: [[1, 2, 3], [4, 5, 6, 7, 8, 9], [1, 2, 3]], win: 16 },
};
export const MOTION_PRIORITY = ['dqcf', 'hcf', 'dp', 'qcf', 'qcb', 'dd'];
export const MOTION_SLOT = { hcf: 'N', qcf: 'F', qcb: 'B', dp: 'U', dd: 'D', dqcf: 'ULTRA' };
const LAST_STEP_MAX_AGE = 8;

export function createInputState() {
  return {
    hist: new Array(HIST).fill(0),
    head: 0,
    cur: 0,
    prev: 0,
    pressed: 0,
    // buffered presses: remaining frames, frame of press, and context captured at press time
    buf: { lp: 0, hp: 0, sp: 0, ta: 0 },
    at: { lp: -99, hp: -99, sp: -99, ta: -99 },
    spMotion: null,
    spDir: 5,
    lpDir: 5,
    hpDir: 5,
    upPressed: 0,
    dash: 0,
    dashDir: 0,
    tapL: -99,
    tapR: -99,
    t: 0,
  };
}

export function dirOf(byte, facing) {
  let x = (byte & BTN.R ? 1 : 0) - (byte & BTN.L ? 1 : 0);
  let y = (byte & BTN.U ? 1 : 0) - (byte & BTN.D ? 1 : 0);
  x *= facing;
  return 5 + x + y * 3;
}

export function histAt(inp, age) {
  return inp.hist[(inp.head - age + HIST * 4) % HIST];
}

function matchMotion(inp, facing, def) {
  let need = def.steps.length - 1;
  let lastAge = -1;
  let firstAge = -1;
  for (let age = 0; age <= def.win && age < HIST; age++) {
    const d = dirOf(histAt(inp, age), facing);
    if (def.steps[need].includes(d)) {
      if (lastAge < 0) lastAge = age;
      if (need === 0) {
        firstAge = age;
        break;
      }
      need--;
    }
  }
  if (firstAge < 0 || lastAge > LAST_STEP_MAX_AGE) return -1;
  if (def.fresh) {
    // walk further back while still holding the first direction; must have started within window
    let a = firstAge;
    while (a + 1 < HIST && def.steps[0].includes(dirOf(histAt(inp, a + 1), facing))) a++;
    if (a > def.win) return -1;
  }
  return lastAge;
}

// Pick the motion whose final step is most recent; motions finishing within 2 frames of that are
// resolved by priority (so an overshot DP 6236 still reads as DP, but a long walk-forward into a
// QCF does not, because DP requires a fresh forward).
export function detectMotion(inp, facing) {
  const ages = {};
  let minAge = 99;
  for (const name of MOTION_PRIORITY) {
    const age = matchMotion(inp, facing, MOTIONS[name]);
    if (age >= 0) {
      ages[name] = age;
      if (age < minAge) minAge = age;
    }
  }
  for (const name of MOTION_PRIORITY) {
    if (name in ages && ages[name] <= minAge + 2) return name;
  }
  return null;
}

// Feed this frame's raw input byte. `frozen` pauses buffer decay (hit-stop, super freeze).
export function feedInput(inp, byte, facing, frozen) {
  inp.prev = inp.cur;
  inp.cur = byte;
  inp.head = (inp.head + 1) % HIST;
  inp.hist[inp.head] = byte;
  inp.t++;
  const pressed = byte & ~inp.prev;
  inp.pressed = pressed;

  if (!frozen) {
    for (const b of BUTTONS) if (inp.buf[b] > 0) inp.buf[b]--;
    if (inp.dash > 0) inp.dash--;
    if (inp.upPressed > 0) inp.upPressed--;
  }

  const dir = dirOf(byte, facing);
  for (const b of BUTTONS) {
    if (pressed & BUTTON_BITS[b]) {
      inp.buf[b] = RULES.BUFFER;
      inp.at[b] = inp.t;
      if (b === 'sp') {
        inp.spMotion = detectMotion(inp, facing);
        inp.spDir = dir;
      } else if (b === 'lp') inp.lpDir = dir;
      else if (b === 'hp') inp.hpDir = dir;
    }
  }
  if (pressed & BTN.U) inp.upPressed = 4;

  // double-tap dash on screen directions
  if (pressed & BTN.R) {
    if (inp.t - inp.tapR <= RULES.DASH_TAP_WINDOW) {
      inp.dash = RULES.BUFFER;
      inp.dashDir = 1;
      inp.tapR = -99;
    } else inp.tapR = inp.t;
  }
  if (pressed & BTN.L) {
    if (inp.t - inp.tapL <= RULES.DASH_TAP_WINDOW) {
      inp.dash = RULES.BUFFER;
      inp.dashDir = -1;
      inp.tapL = -99;
    } else inp.tapL = inp.t;
  }
}

export function held(inp, bit) {
  return (inp.cur & bit) !== 0;
}

export function heldDir(inp, facing) {
  return dirOf(inp.cur, facing);
}

export function chord(inp, a, b) {
  return inp.buf[a] > 0 && inp.buf[b] > 0 && Math.abs(inp.at[a] - inp.at[b]) <= RULES.CHORD_WINDOW;
}

export function consume(inp, ...btns) {
  for (const b of btns) inp.buf[b] = 0;
}

export function slotFromDir(dir) {
  if (dir >= 7) return 'U';
  if (dir <= 3) return 'D';
  if (dir === 6) return 'F';
  if (dir === 4) return 'B';
  return 'N';
}

// Helpers used by the AI and tests to synthesize motion inputs as byte sequences.
export function dirToBits(numpad, facing) {
  let bits = 0;
  const x = ((numpad - 1) % 3) - 1;
  const y = Math.floor((numpad - 1) / 3) - 1;
  const sx = x * facing;
  if (sx > 0) bits |= BTN.R;
  if (sx < 0) bits |= BTN.L;
  if (y > 0) bits |= BTN.U;
  if (y < 0) bits |= BTN.D;
  return bits;
}

export function motionSequence(name, facing) {
  const seqs = {
    qcf: [2, 3, 6],
    qcb: [2, 1, 4],
    dp: [6, 2, 3],
    hcf: [4, 1, 2, 3, 6],
    dd: [2, 5, 2],
    dqcf: [2, 3, 6, 2, 3, 6],
  };
  return (seqs[name] || []).map((d) => dirToBits(d, facing));
}

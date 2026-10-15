// Keyboard state with a "pressed since last sample" latch so taps shorter than a frame still count.

const held = new Set();
const latched = new Set();
const listeners = new Set();
let gameKeys = new Set();
let captureFn = null;

export function setGameKeys(codes) {
  gameKeys = new Set(codes);
}

export function onKey(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Capture the next key press (for rebinding). Returns a cancel function.
export function captureNextKey(fn) {
  captureFn = fn;
  return () => {
    if (captureFn === fn) captureFn = null;
  };
}

export function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (captureFn) {
      e.preventDefault();
      const fn = captureFn;
      captureFn = null;
      fn(e.code);
      return;
    }
    const inField = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
    if (gameKeys.has(e.code) && !inField) e.preventDefault();
    if (!e.repeat) {
      held.add(e.code);
      latched.add(e.code);
    }
    for (const fn of listeners) fn(e, true);
  });
  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
    for (const fn of listeners) fn(e, false);
  });
  window.addEventListener('blur', () => {
    held.clear();
    latched.clear();
  });
}

export function isDown(code) {
  return held.has(code) || latched.has(code);
}

export function heldKeys() {
  return [...held];
}

// Call once per simulation tick after sampling.
export function clearLatch() {
  latched.clear();
}

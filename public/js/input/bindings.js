// Keyboard bindings (by KeyboardEvent.code) with presets and persistence.

export const ACTIONS = ['up', 'down', 'left', 'right', 'lp', 'hp', 'sp', 'ta', 'throw', 'ultra', 'burst', 'pause'];

export const ACTION_LABELS = {
  up: 'Up / Jump', down: 'Down / Crouch', left: 'Left', right: 'Right',
  lp: 'Light', hp: 'Heavy', sp: 'Special', ta: 'Taunt',
  throw: 'Throw (L+H)', ultra: 'Ultra (H+S)', burst: 'Qi Burst (L+S)', pause: 'Pause',
};

export const PRESETS = {
  standard: {
    p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', lp: 'KeyJ', hp: 'KeyK', sp: 'KeyL', ta: 'KeyY', throw: 'KeyU', ultra: 'KeyI', burst: 'KeyO', pause: 'Escape' },
    p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', lp: 'Numpad1', hp: 'Numpad2', sp: 'Numpad3', ta: 'NumpadAdd', throw: 'Numpad4', ultra: 'Numpad5', burst: 'Numpad6', pause: 'NumpadEnter' },
  },
  laptop: {
    p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', lp: 'KeyF', hp: 'KeyG', sp: 'KeyH', ta: 'KeyT', throw: 'KeyR', ultra: 'KeyY', burst: 'KeyV', pause: 'Escape' },
    p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', lp: 'Comma', hp: 'Period', sp: 'Slash', ta: 'Quote', throw: 'KeyM', ultra: 'Semicolon', burst: 'KeyN', pause: 'Backspace' },
  },
};

const KEY = 'ultrafist.bindings.v1';

export function loadBindings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.p1 && raw.p2) return { p1: { ...PRESETS.standard.p1, ...raw.p1 }, p2: { ...PRESETS.standard.p2, ...raw.p2 } };
  } catch {
    /* ignore */
  }
  return structuredClone(PRESETS.standard);
}

export function saveBindings(b) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

export function prettyKey(code) {
  if (!code) return '—';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ').replace(/^Arrow/, '').replace('Bracket', '').replace('Enter', '⏎');
}

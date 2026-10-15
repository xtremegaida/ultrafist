// Gamepad polling (standard mapping).

const DEADZONE = 0.45;

export function listPads() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  return [...navigator.getGamepads()].filter((p) => p && p.connected);
}

export function padByIndex(i) {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  return pads[i] && pads[i].connected ? pads[i] : null;
}

const pressedish = (b) => b && (b.pressed || b.value > 0.5);

// Returns an action-state object compatible with the keyboard sampler.
export function readPad(pad) {
  const a = {};
  if (!pad) return a;
  const B = pad.buttons;
  const ax = pad.axes || [];
  const sx = ax[0] || 0;
  const sy = ax[1] || 0;
  a.up = pressedish(B[12]) || sy < -DEADZONE || pressedish(B[0]);
  a.down = pressedish(B[13]) || sy > DEADZONE;
  a.left = pressedish(B[14]) || sx < -DEADZONE;
  a.right = pressedish(B[15]) || sx > DEADZONE;
  a.lp = pressedish(B[2]);
  a.hp = pressedish(B[3]);
  a.sp = pressedish(B[1]);
  a.throw = pressedish(B[5]);
  a.ultra = pressedish(B[7]);
  a.burst = pressedish(B[4]);
  a.ta = pressedish(B[6]);
  a.pause = pressedish(B[9]);
  a.confirm = pressedish(B[0]);
  a.back = pressedish(B[1]);
  return a;
}

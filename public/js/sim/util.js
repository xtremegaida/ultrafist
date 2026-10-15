// Small pure helpers shared across the simulation.

export function emit(s, ev) {
  s.events.push(ev);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function sign(v) {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

// Convert a local box [x, y, w, h] (facing right) to a world box {x, y, w, h}.
export function worldBox(f, box, sx = 1, sy = 1) {
  const scale = f.scale || 1;
  const bx = box[0] * sx * scale;
  const bw = box[2] * sx * scale;
  const by = box[1] * sy * scale;
  const bh = box[3] * sy * scale;
  return {
    x: f.facing > 0 ? f.x + bx : f.x - bx - bw,
    y: f.y + by,
    w: bw,
    h: bh,
  };
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function overlapCenter(a, b) {
  const x1 = Math.max(a.x, b.x);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y, b.y);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

export function inRange(v, r) {
  return v >= r[0] && v <= r[1];
}

export function round1(v) {
  return Math.round(v * 10) / 10;
}

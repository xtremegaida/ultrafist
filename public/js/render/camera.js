// Fighting-game camera: tracks both fighters, zooms with distance, punches in on supers and KOs.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WORLD_VIEW_W = 960; // world units visible at zoom 1
export const BASE_SCALE = VIEW_W / WORLD_VIEW_W;
export const GROUND_Y = VIEW_H * 0.88;

export function createCamera() {
  return { x: 800, y: 0, zoom: 1, shake: 0, shakeX: 0, shakeY: 0, punch: 0, seed: 1 };
}

function rnd(cam) {
  cam.seed = (cam.seed * 16807) % 2147483647;
  return cam.seed / 2147483647;
}

export function updateCamera(cam, v, dt = 1) {
  const [a, b] = v.fighters;
  let tx = (a.x + b.x) / 2;
  let ty = Math.min(0, Math.min(a.y, b.y) + 140) * 0.75;
  const dist = Math.abs(a.x - b.x);
  let tz = Math.max(0.8, Math.min(1.25, (WORLD_VIEW_W * 0.92) / (dist + 330)));
  let rate = 0.12;
  if (v.freeze) {
    const f = v.fighters[v.freeze.by];
    tx = f.x;
    ty = Math.min(0, f.y + 60);
    tz = 1.55;
    rate = 0.2;
  } else if (v.cine) {
    tx = (a.x + b.x) / 2;
    ty = Math.min(a.y, b.y) + 80;
    tz = 1.05;
    rate = 0.18;
  } else if (v.ko && v.phase === 'ko' && v.phaseT < 70 && v.ko.loser >= 0 && v.ko.type !== 'timeup') {
    const f = v.fighters[v.ko.loser];
    tx = f.x;
    ty = Math.min(0, f.y + 60);
    tz = 1.35;
    rate = 0.1;
    if (v.ko.type === 'star') {
      tz = 1.0;
      ty = Math.max(-520, Math.min(0, f.y + 200));
    }
  } else if (v.clash) {
    tx = v.clash.x;
    tz = 1.4;
  }
  if (!v.cine) ty = Math.max(-420, ty);
  cam.zoom += (tz - cam.zoom) * rate * dt;
  const halfW = WORLD_VIEW_W / 2 / cam.zoom;
  const left = v.stage?.left ?? 0;
  const right = v.stage?.right ?? 1600;
  if (!v.cine) tx = Math.max(left + halfW, Math.min(right - halfW, tx));
  cam.x += (tx - cam.x) * rate * 1.4 * dt;
  cam.y += (ty - cam.y) * rate * dt;
  // shake decays
  if (cam.shake > 0.1) {
    cam.shakeX = (rnd(cam) - 0.5) * 2 * cam.shake;
    cam.shakeY = (rnd(cam) - 0.5) * 2 * cam.shake;
    cam.shake *= 0.86;
  } else {
    cam.shake = 0;
    cam.shakeX = cam.shakeY = 0;
  }
  cam.punch *= 0.82;
}

export function addShake(cam, px) {
  cam.shake = Math.max(cam.shake, px);
}

export function camScale(cam) {
  return BASE_SCALE * cam.zoom * (1 + cam.punch);
}

// Apply world transform to a context.
export function applyCamera(ctx, cam, parallax = 1) {
  const s = camScale(cam);
  ctx.setTransform(s, 0, 0, s, VIEW_W / 2 - cam.x * s * parallax + cam.shakeX, GROUND_Y - cam.y * s + cam.shakeY);
}

export function worldToScreen(cam, x, y) {
  const s = camScale(cam);
  return [VIEW_W / 2 + (x - cam.x) * s + cam.shakeX, GROUND_Y + (y - cam.y) * s + cam.shakeY];
}

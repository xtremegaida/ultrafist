// Frame renderer: reads a (read-only) view of the sim state and draws the whole scene.

import { getMove } from '../data/registry.js';
import { VIEW_W, VIEW_H, createCamera, updateCamera, applyCamera, camScale } from './camera.js';
import { createFx, updateFx, drawDecals, drawParticles, drawGlyphs, drawScreenBanners, drawAfterimages, afterimage } from './fx.js';
import { poseFor, solve } from './pose.js';
import { drawFighter, propsOf, drawAura } from './skins.js';
import { drawBackground, drawFloor, drawHazards, drawZones, drawProps } from './stages.js';
import { drawProjectiles } from './projectiles.js';
import { drawHud, createHudState } from './hud.js';
import { drawCutIn, drawCineBackdrop, drawCineWorld, drawClash, drawKO, drawRoundIntro, drawHeavenlyOverlay } from './overlays.js';
import { rgba, limb, circle, makeCanvas, rng, INK } from './brush.js';
import { drawStar } from './fx.js';

// Graphics quality. Everything is drawn in 1280x720 view coordinates; the canvas backing store can
// be smaller ('low') or match the real screen pixels ('ultra', sharper on big and high-DPI screens).
export const QUALITY = {
  low: { res: 0.75, density: 0.5, cap: 160, afterEvery: 6, extras: false },
  high: { res: 1, density: 1, cap: 420, afterEvery: 3, extras: true },
  ultra: { res: 'screen', density: 1, cap: 420, afterEvery: 3, extras: true },
};

// setTransform on the game canvas is wrapped once so every caller keeps using view coordinates
// while the resolution factor is folded in underneath.
const resOf = new WeakMap();

function scalableContext(ctx) {
  if (!resOf.has(ctx)) {
    const raw = ctx.setTransform.bind(ctx);
    resOf.set(ctx, 1);
    ctx.setTransform = (a, b, c, d, e, f) => {
      const k = resOf.get(ctx);
      raw(a * k, b * k, c * k, d * k, e * k, f * k);
    };
  }
  return ctx;
}

// screenScale: device pixels per view pixel at the current window size (only 'ultra' uses it).
export function setQuality(r, quality, screenScale = 1) {
  const id = QUALITY[quality] ? quality : 'high';
  const q = QUALITY[id];
  const k = q.res === 'screen' ? Math.min(2, Math.max(1, Math.round(screenScale * 4) / 4)) : q.res;
  const w = Math.round(VIEW_W * k);
  const h = Math.round(VIEW_H * k);
  if (r.canvas.width !== w || r.canvas.height !== h) {
    r.canvas.width = w;
    r.canvas.height = h;
  }
  resOf.set(r.ctx, k);
  r.quality = id;
  r.q = q;
  r.fx.density = q.density;
  r.fx.cap = q.cap;
}

export function createRenderer(canvas, opts = {}) {
  const ctx = scalableContext(canvas.getContext('2d', { alpha: false }));
  const r = {
    canvas,
    ctx,
    cam: createCamera(),
    fx: createFx(),
    hud: createHudState(),
    side: [{ flipT: 0, flash: 0, afterT: 0 }, { flipT: 0, flash: 0, afterT: 0 }],
    t: 0,
    stageFlip: 0,
    sunrise: 0,
    tear: null,
    debug: false,
    debugDraw: null,
  };
  setQuality(r, opts.quality || 'high', opts.screenScale || 1);
  return r;
}

function snapshotJ(f, J) {
  return { J, x: f.x, y: f.y, facing: f.facing, scale: f.scale || 1 };
}

function wantsAfterimage(f) {
  if (f.st === 'dash') return true;
  if (f.airDashT > 0) return true;
  if (f.st === 'attack' && f.move) {
    const def = getMove(f.move.id);
    return def && (def.kind === 'special' || def.kind === 'ultra' || def.kind === 'system');
  }
  return f.st === 'launched' && Math.abs(f.vx) + Math.abs(f.vy) > 14;
}

export function renderFrame(r, v, opts = {}) {
  const { ctx, cam, fx } = r;
  const dt = opts.dt ?? 1;
  r.t += dt;
  updateCamera(cam, v, dt);
  updateFx(fx, dt);
  for (const s of r.side) {
    if (s.flipT > 0) s.flipT -= dt;
    if (s.flash > 0) s.flash -= dt * 0.12;
  }
  if (r.stageFlip > 0) r.stageFlip -= dt;
  if (r.sunrise > 0) r.sunrise -= dt;

  // 1. background
  const stageId = v.stage?.id || 'bamboo';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(ctx, cam, stageId, r.t, r.q.extras);
  if (r.sunrise > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,140,40,${Math.min(0.35, r.sunrise / 300)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (stageId === 'rooftop') {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(20,30,60,0.10)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  drawCineBackdrop(ctx, v, r.t);

  // 2. world
  applyCamera(ctx, cam);
  if (r.stageFlip > 0) {
    // the Arhat Suplex flips the entire stage upside down for a moment
    const s = camScale(cam);
    ctx.setTransform(s, 0, 0, -s, VIEW_W / 2 - cam.x * s, VIEW_H * 0.3 + cam.y * s);
  }
  if (!v.cine) drawFloor(ctx, stageId, v.stage?.left ?? 0, v.stage?.right ?? 1600);
  drawDecals(ctx, fx);
  drawZones(ctx, v, r.t);
  if (!v.cine) drawHazards(ctx, v, r.t);
  drawProps(ctx, v, r.t);
  drawCineWorld(ctx, v);

  // shadows
  for (const f of v.fighters) {
    const h = Math.min(1, Math.max(0, -f.y / 400));
    ctx.fillStyle = `rgba(20,15,10,${0.28 * (1 - h)})`;
    ctx.beginPath();
    ctx.ellipse(f.x, 4, 48 * (f.scale || 1) * (1 - h * 0.5), 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  drawAfterimages(ctx, fx);

  // fighters: attacker drawn on top
  const order = [...v.fighters].sort((a, b) => (a.st === 'attack' ? 1 : 0) - (b.st === 'attack' ? 1 : 0));
  for (const f of order) drawOneFighter(r, v, f, opts);

  drawProjectiles(ctx, v, r.t);
  drawParticles(ctx, fx);
  drawGlyphs(ctx, fx);
  if (r.debug && r.debugDraw) r.debugDraw(ctx, v);

  // 3. screen space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHeavenlyOverlay(ctx, v, r.t);
  if (v.heavenly?.id === 'ghosts') {
    // only auras and eyes show through the dark
    applyCamera(ctx, cam);
    for (const f of v.fighters) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.facing, 1);
      drawAura(ctx, opts.cos?.[f.side]?.aura || '#ffd34d', r.t, 1.2);
      circle(ctx, 8, -150 * (f.scale || 1), 3, '#ff4d6d', null, 0);
      circle(ctx, 18, -150 * (f.scale || 1), 3, '#ff4d6d', null, 0);
      ctx.restore();
    }
    drawParticles(ctx, fx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  const cosOf = (side) => opts.cos?.[side];
  drawCutIn(ctx, v, cosOf);
  drawClash(ctx, v, r.t);
  if (opts.hud !== false) {
    drawKO(ctx, v, r.t);
    drawRoundIntro(ctx, v, r.t, cosOf);
  }
  if (opts.hud !== false) drawHud(ctx, v, r.hud, { t: r.t, cos: opts.cos, ping: opts.ping, spectating: opts.spectating });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawScreenBanners(ctx, fx);
  if (fx.flash > 0) {
    ctx.fillStyle = fx.flashColor;
    ctx.globalAlpha = fx.flash;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
  if (r.tear) drawTear(r, dt);
}

// ---- stage transition: the old scene rips apart like paper to reveal the area behind it ----------

const TEAR_FRAMES = 56;
const TEAR_HOLD = 10; // the rip runs down the page before the halves fly apart

// Call before rendering the first frame of the new area: the canvas still holds the old scene.
export function triggerTear(r) {
  if (!r.tearImg) r.tearImg = makeCanvas(VIEW_W, VIEW_H);
  const g = r.tearImg.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(r.canvas, 0, 0, VIEW_W, VIEW_H);
  const rand = rng(((r.t * 977) | 0) + 1);
  const pts = [];
  for (let y = -30; y <= VIEW_H + 30; y += 22) pts.push([VIEW_W / 2 + (rand() - 0.5) * 70 + Math.sin(y / 90) * 40, y]);
  r.tear = { t: 0, pts };
}

function tearHalf(ctx, pts, px) {
  ctx.beginPath();
  ctx.moveTo(px, -40);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(px, VIEW_H + 40);
  ctx.closePath();
}

function drawTear(r, dt) {
  const { ctx } = r;
  const T = (r.tear.t += dt);
  if (T >= TEAR_FRAMES) {
    r.tear = null;
    return;
  }
  const { pts } = r.tear;
  const e = Math.max(0, (T - TEAR_HOLD) / (TEAR_FRAMES - TEAR_HOLD)) ** 2;
  for (const side of [-1, 1]) {
    const px = side < 0 ? 0 : VIEW_W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    // each half swings away around its outer bottom corner
    const shudder = T < TEAR_HOLD ? Math.sin(T * 2.7) * 3 : 0;
    ctx.translate(px + side * e * 820 + shudder, VIEW_H + e * 220);
    ctx.rotate(side * e * 0.55);
    ctx.translate(-px, -VIEW_H);
    if (e > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.save();
      ctx.translate(side * 10, 8);
      tearHalf(ctx, pts, px);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    tearHalf(ctx, pts, px);
    ctx.clip();
    ctx.drawImage(r.tearImg, 0, 0, VIEW_W, VIEW_H);
    ctx.restore();
    // torn paper fibres along the rip
    const n = e > 0 ? pts.length : Math.max(2, Math.ceil((T / TEAR_HOLD) * pts.length));
    ctx.lineJoin = 'round';
    for (const [w, col] of [[9, '#f3ead7'], [2.5, INK]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i < n; i++) ctx.lineTo(pts[i][0] + (w > 3 ? side * 2 : 0), pts[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawOneFighter(r, v, f, opts) {
  const { ctx, fx } = r;
  const sd = r.side[f.side];
  const cos = opts.cos?.[f.side] || {};
  const ex = { flipT: sd.flipT, glide: false };
  if (f.charId === 'jidao' && f.st === 'air' && f.vy > 0 && f.vy <= 2.4) ex.glide = true;
  const pose = poseFor(f, ex);
  const grounded = !f.air && f.st !== 'launched' && f.st !== 'ultraVictim';
  const J = solve(pose, propsOf(f.charId, f), grounded);
  const scale = f.scale || 1;

  // afterimages
  if (wantsAfterimage(f)) {
    sd.afterT += 1;
    if (sd.afterT >= r.q.afterEvery) {
      sd.afterT = 0;
      afterimage(fx, snapshotJ(f, J), 14, f.awakened > 0 ? '#ff4d6d' : rgba(cos.c1 && cos.c1 !== '#f8f9fa' ? cos.c1 : '#16120f', 0.9));
    }
  }

  ctx.save();
  let jitter = 0;
  if (f.st === 'hitstun' || f.st === 'blockstun') jitter = (r.t % 2 ? 1 : -1) * Math.min(4, f.stun || 0) * 0.6;
  ctx.translate(f.x + jitter, f.y);
  // drunken sway
  if (f.charId === 'jiugui' && f.char?.drunk && (f.st === 'idle' || f.st === 'walk')) ctx.rotate(Math.sin(r.t / 18) * 0.025 * f.char.drunk);
  ctx.scale(f.facing * scale, scale);

  // auras
  const ultraReady = f.chi >= (f.awakened > 0 ? 200 : 300);
  const special = f.st === 'attack' && f.move && ['special', 'ultra'].includes(getMove(f.move.id)?.kind);
  if (f.awakened > 0) drawAura(ctx, '#ff4d6d', r.t, 1.1, 230);
  else if (ultraReady || (special && getMove(f.move.id)?.kind === 'ultra')) drawAura(ctx, cos.aura || '#ffd34d', r.t, 0.8);
  else if (special) drawAura(ctx, cos.aura || '#ffd34d', r.t, 0.4, 150);

  // Wai-Ya's very visible wire
  if (f.charId === 'waiya' && (f.air || f.st === 'attack')) {
    ctx.strokeStyle = 'rgba(30,30,30,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(J.chest[0] - 6, J.chest[1]);
    ctx.lineTo(J.chest[0] - 40, -1400);
    ctx.stroke();
  }

  drawFighter(ctx, f, J, { cos, t: r.t, special });

  // white hit flash: re-stamp the silhouette
  if (sd.flash > 0) {
    ctx.globalAlpha = Math.min(0.75, sd.flash);
    const col = '#ffffff';
    for (const L of [J.aB, J.lB, J.lF, J.aF]) {
      limb(ctx, L[0], L[1], 14, 12, col, col, 0);
      limb(ctx, L[1], L[2], 12, 10, col, col, 0);
    }
    limb(ctx, J.hip, J.chest, 34, 38, col, col, 0);
    circle(ctx, J.head[0], J.head[1], 17, col, null, 0);
    ctx.globalAlpha = 1;
  }
  // dizzy stars
  if (f.st === 'guardBroken' || (f.status && f.status.frozen)) {
    for (let i = 0; i < 3; i++) {
      const a = r.t / 8 + (i * Math.PI * 2) / 3;
      drawStar(ctx, J.head[0] + Math.cos(a) * 26, J.head[1] - 24 + Math.sin(a) * 8, 7, '#ffd166');
    }
  }
  ctx.restore();
}

// Called by the director when an air jump happens (for the flip animation).
export function triggerFlip(r, side) {
  r.side[side].flipT = 14;
}

export function triggerFlash(r, side) {
  r.side[side].flash = 1;
}


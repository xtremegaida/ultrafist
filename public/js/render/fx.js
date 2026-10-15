// Visual-only effects: particles, decals, glyph pops, afterimages, screen banners.
// Nothing here affects the simulation.

import { INK, GOLD, PAPER, splatSprite, puffSprite, brushText, seal, rgba, limb, FONT_DISPLAY, setFont } from './brush.js';

const MAX_PARTICLES = 420;

export function createFx() {
  return { parts: [], decals: [], glyphs: [], screen: [], after: [], flash: 0, flashColor: '#ffffff', seed: 99, t: 0, darken: 0, desat: 0 };
}

function rnd(fx) {
  fx.seed = (fx.seed * 16807) % 2147483647;
  return fx.seed / 2147483647;
}

export function R(fx, a = 0, b = 1) {
  return a + rnd(fx) * (b - a);
}

function push(fx, p) {
  if (fx.parts.length >= MAX_PARTICLES) fx.parts.shift();
  fx.parts.push(p);
}

// ---- spawners ---------------------------------------------------------------------------------

export function drops(fx, x, y, n, color = INK, speed = 6, dirX = 0) {
  for (let i = 0; i < n; i++) {
    const a = R(fx, 0, Math.PI * 2);
    const sp = R(fx, speed * 0.3, speed);
    push(fx, { k: 'drop', x, y, vx: Math.cos(a) * sp + dirX * 2, vy: Math.sin(a) * sp - 2, r: R(fx, 1.5, 4.5), c: color, life: R(fx, 25, 50), max: 50, g: 0.35 });
  }
}

export function sparks(fx, x, y, n, color = '#ffffff', len = 26) {
  for (let i = 0; i < n; i++) {
    const a = R(fx, 0, Math.PI * 2);
    push(fx, { k: 'spark', x, y, a, l: R(fx, len * 0.5, len), c: color, life: 10, max: 10, sp: R(fx, 4, 9) });
  }
}

export function ring(fx, x, y, color, r0 = 10, r1 = 70, life = 16, width = 5) {
  push(fx, { k: 'ring', x, y, r0, r1, c: color, life, max: life, w: width });
}

export function puff(fx, x, y, n = 4, color = INK, size = 40) {
  for (let i = 0; i < n; i++) {
    push(fx, { k: 'puff', x: x + R(fx, -15, 15), y: y + R(fx, -8, 4), vx: R(fx, -1.5, 1.5), vy: R(fx, -1.5, -0.2), s: size * R(fx, 0.6, 1.1), c: color, life: R(fx, 24, 40), max: 40 });
  }
}

export function splat(fx, x, y, scale = 1, color = INK, life = 140, ground = false) {
  const d = { k: 'splat', x, y, rot: R(fx, 0, Math.PI * 2), s: scale, c: color, v: Math.floor(R(fx, 0, 4)), life, max: life, ground };
  fx.decals.push(d);
  if (fx.decals.length > 40) fx.decals.shift();
}

export function decal(fx, kind, x, y, extra = {}) {
  fx.decals.push({ k: kind, x, y, life: 300, max: 300, ...extra });
  if (fx.decals.length > 40) fx.decals.shift();
}

export function speedLines(fx, x, y, color = INK, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = R(fx, 0, Math.PI * 2);
    push(fx, { k: 'speed', x, y, a, d: R(fx, 50, 90), l: R(fx, 40, 120), c: color, life: 10, max: 10 });
  }
}

export function feathers(fx, x, y, n = 10, color = '#c1121f') {
  for (let i = 0; i < n; i++) {
    push(fx, { k: 'feather', x, y, vx: R(fx, -5, 5), vy: R(fx, -9, -2), rot: R(fx, 0, 6), vr: R(fx, -0.2, 0.2), c: i % 3 ? color : '#fdf0d5', life: R(fx, 60, 110), max: 110, g: 0.12 });
  }
}

export function petals(fx, x, y, n = 8, color = '#ff8fab') {
  for (let i = 0; i < n; i++) {
    push(fx, { k: 'petal', x: x + R(fx, -40, 40), y: y + R(fx, -40, 20), vx: R(fx, -2, 2), vy: R(fx, -3, 0), rot: R(fx, 0, 6), vr: R(fx, -0.15, 0.15), c: color, life: R(fx, 50, 90), max: 90, g: 0.05 });
  }
}

export function stars(fx, x, y, n = 6, color = GOLD) {
  for (let i = 0; i < n; i++) {
    const a = R(fx, 0, Math.PI * 2);
    push(fx, { k: 'star', x, y, vx: Math.cos(a) * R(fx, 2, 7), vy: Math.sin(a) * R(fx, 2, 7) - 2, c: color, life: R(fx, 20, 40), max: 40, r: R(fx, 4, 9), g: 0.15 });
  }
}

export function liquid(fx, x, y, n, color, dirX = 1, speed = 7) {
  for (let i = 0; i < n; i++) {
    push(fx, { k: 'drop', x, y, vx: dirX * R(fx, speed * 0.5, speed) + R(fx, -1, 1), vy: R(fx, -6, -1), r: R(fx, 2, 5), c: color, life: R(fx, 25, 45), max: 45, g: 0.4 });
  }
}

export function flames(fx, x, y, n = 8, color = '#ff7b00') {
  for (let i = 0; i < n; i++) {
    push(fx, { k: 'flame', x: x + R(fx, -20, 20), y, vx: R(fx, -1, 1), vy: R(fx, -4, -1.5), r: R(fx, 6, 14), c: i % 2 ? color : '#ffd166', life: R(fx, 16, 30), max: 30 });
  }
}

// World-space calligraphy glyph that stamps in and fades.
export function glyph(fx, text, x, y, size = 90, color = INK, life = 50, opts = {}) {
  fx.glyphs.push({ text, x, y, size, c: color, life, max: life, rot: opts.rot ?? R(fx, -0.15, 0.15), seal: !!opts.seal, vy: opts.vy ?? -0.4, outline: opts.outline });
  if (fx.glyphs.length > 18) fx.glyphs.shift();
}

export function dmgText(fx, n, x, y, color = INK, big = false) {
  fx.glyphs.push({ text: String(n), x: x + R(fx, -10, 10), y, size: big ? 40 : 28, c: color, life: 40, max: 40, rot: 0, vy: -1.2, num: true });
}

// Screen-space banner text (combo titles, announcements).
export function banner(fx, text, x, y, size, color = INK, life = 70, opts = {}) {
  fx.screen.push({ text, x, y, size, c: color, life, max: life, sub: opts.sub || null, seal: opts.seal || null, align: opts.align || 'center', shake: opts.shake || 0, rainbow: !!opts.rainbow, outline: opts.outline ?? 6, family: opts.family });
  if (fx.screen.length > 12) fx.screen.shift();
}

export function flash(fx, color = '#ffffff', amt = 0.6) {
  fx.flash = Math.max(fx.flash, amt);
  fx.flashColor = color;
}

export function afterimage(fx, snap, life = 14, color = INK) {
  fx.after.push({ ...snap, life, max: life, c: color });
  if (fx.after.length > 24) fx.after.shift();
}

// ---- update and draw --------------------------------------------------------------------------

export function updateFx(fx, dt = 1) {
  fx.t += dt;
  for (const p of fx.parts) {
    p.life -= dt;
    if (p.vx !== undefined) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.g) p.vy += p.g * dt;
    }
    if (p.k === 'feather' || p.k === 'petal') {
      p.rot += p.vr * dt;
      p.vx *= 0.97;
      if (p.vy > 1.5) p.vy = 1.5;
    }
    if (p.k === 'drop' && p.y > 0) {
      p.y = 0;
      p.vy = 0;
      p.vx *= 0.5;
    }
  }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const d of fx.decals) d.life -= dt;
  fx.decals = fx.decals.filter((d) => d.life > 0);
  for (const g of fx.glyphs) {
    g.life -= dt;
    g.y += g.vy * dt;
  }
  fx.glyphs = fx.glyphs.filter((g) => g.life > 0);
  for (const s of fx.screen) s.life -= dt;
  fx.screen = fx.screen.filter((s) => s.life > 0);
  for (const a of fx.after) a.life -= dt;
  fx.after = fx.after.filter((a) => a.life > 0);
  fx.flash *= 0.85;
  if (fx.flash < 0.02) fx.flash = 0;
}

export function drawDecals(ctx, fx) {
  for (const d of fx.decals) {
    const a = Math.min(1, d.life / (d.max * 0.4));
    ctx.save();
    ctx.globalAlpha = a * (d.k === 'splat' ? 0.85 : 0.9);
    if (d.k === 'splat') {
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      if (d.ground) ctx.scale(d.s, d.s * 0.25);
      else ctx.scale(d.s, d.s);
      ctx.drawImage(splatSprite(d.c, d.v), -64, -64);
    } else if (d.k === 'crack') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.translate(d.x, d.y);
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * 30, Math.sin(ang) * 40);
        ctx.lineTo(Math.cos(ang + 0.3) * 60, Math.sin(ang + 0.2) * 80);
        ctx.stroke();
      }
    } else if (d.k === 'crater') {
      ctx.fillStyle = 'rgba(40,30,20,0.6)';
      ctx.beginPath();
      ctx.ellipse(d.x, 2, d.w || 90, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawParticles(ctx, fx) {
  for (const p of fx.parts) {
    const a = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
    ctx.globalAlpha = a;
    switch (p.k) {
      case 'drop':
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'spark': {
        const k = 1 - p.life / p.max;
        const d = k * p.sp * 6;
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.a) * d, p.y + Math.sin(p.a) * d);
        ctx.lineTo(p.x + Math.cos(p.a) * (d + p.l * (1 - k)), p.y + Math.sin(p.a) * (d + p.l * (1 - k)));
        ctx.stroke();
        break;
      }
      case 'ring': {
        const k = 1 - p.life / p.max;
        ctx.strokeStyle = p.c;
        ctx.lineWidth = p.w * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * k, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'puff': {
        const k = 1 - p.life / p.max;
        const s = p.s * (0.6 + k);
        ctx.globalAlpha = a * 0.7;
        ctx.drawImage(puffSprite(p.c), p.x - s, p.y - s, s * 2, s * 2);
        break;
      }
      case 'speed': {
        const k = 1 - p.life / p.max;
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 2.5;
        const d0 = p.d + k * 40;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.a) * d0, p.y + Math.sin(p.a) * d0);
        ctx.lineTo(p.x + Math.cos(p.a) * (d0 + p.l), p.y + Math.sin(p.a) * (d0 + p.l));
        ctx.stroke();
        break;
      }
      case 'feather':
      case 'petal':
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.k === 'feather' ? 11 : 6, p.k === 'feather' ? 4 : 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      case 'star':
        drawStar(ctx, p.x, p.y, p.r, p.c);
        break;
      case 'flame': {
        const k = p.life / p.max;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        break;
    }
  }
  ctx.globalAlpha = 1;
}

export function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 ? r * 0.4 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawGlyphs(ctx, fx) {
  for (const g of fx.glyphs) {
    const age = g.max - g.life;
    const inK = Math.min(1, age / 5);
    const scale = g.num ? 1 : 1.6 - 0.6 * inK;
    const a = Math.min(1, g.life / 15);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rot);
    ctx.scale(scale, scale);
    if (g.seal) seal(ctx, 0, 0, g.size, g.text, g.c);
    else if (g.num) {
      setFont(ctx, g.size, FONT_DISPLAY);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = PAPER;
      ctx.strokeText(g.text, 0, 0);
      ctx.fillStyle = g.c;
      ctx.fillText(g.text, 0, 0);
    } else brushText(ctx, g.text, 0, 0, g.size, g.c, { outline: g.outline ?? 8, outlineColor: rgba('#f3ead7', 0.85) });
    ctx.restore();
  }
}

export function drawScreenBanners(ctx, fx) {
  for (const b of fx.screen) {
    const age = b.max - b.life;
    const inK = Math.min(1, age / 6);
    const a = Math.min(1, b.life / 14);
    const sc = 1.5 - 0.5 * inK;
    ctx.save();
    ctx.globalAlpha = a;
    const sx = b.shake ? (Math.random() - 0.5) * b.shake : 0;
    const sy = b.shake ? (Math.random() - 0.5) * b.shake : 0;
    ctx.translate(b.x + sx, b.y + sy);
    ctx.scale(sc, sc);
    const color = b.rainbow ? `hsl(${(age * 12) % 360},90%,50%)` : b.c;
    brushText(ctx, b.text, 0, 0, b.size, color, { outline: b.outline, outlineColor: PAPER, align: b.align, family: b.family });
    if (b.sub) {
      setFont(ctx, b.size * 0.36, FONT_DISPLAY);
      ctx.textAlign = b.align;
      ctx.lineWidth = 5;
      ctx.strokeStyle = PAPER;
      ctx.strokeText(b.sub, 0, b.size * 0.72);
      ctx.fillStyle = INK;
      ctx.fillText(b.sub, 0, b.size * 0.72);
    }
    if (b.seal) seal(ctx, b.align === 'left' ? -b.size * 0.7 : b.size * 1.2, 0, b.size * 0.9, b.seal);
    ctx.restore();
  }
}

// Afterimages drawn as translucent ink silhouettes of the stored skeleton.
export function drawAfterimages(ctx, fx) {
  for (const a of fx.after) {
    const k = a.life / a.max;
    ctx.save();
    ctx.globalAlpha = 0.35 * k;
    ctx.translate(a.x, a.y);
    ctx.scale(a.facing * a.scale, a.scale);
    const J = a.J;
    const col = a.c;
    for (const L of [J.aB, J.lB, J.lF, J.aF]) {
      limb(ctx, L[0], L[1], 14, 12, col, col, 0);
      limb(ctx, L[1], L[2], 12, 10, col, col, 0);
    }
    limb(ctx, J.hip, J.chest, 34, 38, col, col, 0);
    ctx.beginPath();
    ctx.arc(J.head[0], J.head[1], 16, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  }
}


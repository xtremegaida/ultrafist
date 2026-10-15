// Ink-wash drawing primitives: paper, tapered brush limbs, ink blobs, prebaked splats, calligraphy.

export const INK = '#16120f';
export const PAPER = '#f3ead7';
export const SEAL = '#c8102e';
export const GOLD = '#f2b705';

export const FONT_CJK = '"KaiTi", "STKaiti", "Kaiti SC", "DFKai-SB", "BiauKai", "Microsoft YaHei", "SimSun", serif';
export const FONT_DISPLAY = 'Impact, "Arial Black", "Haettenschweiler", sans-serif';
export const FONT_UI = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Deterministic tiny PRNG for render-only randomness.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paperTexture(w, h, tint = PAPER, seed = 7) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = tint;
  g.fillRect(0, 0, w, h);
  // fibres
  g.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = r() < 0.5 ? '#8a7a60' : '#ffffff';
    g.lineWidth = 0.5 + r();
    const x = r() * w;
    const y = r() * h;
    const a = r() * Math.PI;
    const l = 4 + r() * 18;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // mottling
  for (let i = 0; i < 60; i++) {
    g.globalAlpha = 0.025;
    g.fillStyle = r() < 0.5 ? '#b8a27a' : '#fffaf0';
    g.beginPath();
    g.arc(r() * w, r() * h, 30 + r() * 120, 0, Math.PI * 2);
    g.fill();
  }
  // vignette
  g.globalAlpha = 1;
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(70,45,20,0.28)');
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
  return c;
}

// Tapered capsule from a to b: the basic brush-stroke limb.
export function limb(ctx, a, b, w1, w2, fill, ink = INK, outline = 2.4) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ang = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * w1 / 2, a[1] + ny * w1 / 2);
  ctx.lineTo(b[0] + nx * w2 / 2, b[1] + ny * w2 / 2);
  ctx.arc(b[0], b[1], w2 / 2, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(a[0] - nx * w1 / 2, a[1] - ny * w1 / 2);
  ctx.arc(a[0], a[1], w1 / 2, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
}

export function circle(ctx, x, y, r, fill, ink = INK, outline = 2.4) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
}

export function ellipse(ctx, x, y, rx, ry, rot, fill, ink = INK, outline = 2.4) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
}

export function poly(ctx, pts, fill, ink = INK, outline = 2.4, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
}

// Smooth closed blob through points (quadratic midpoints).
export function smoothBlob(ctx, pts, fill, ink = INK, outline = 2.4) {
  const n = pts.length;
  ctx.beginPath();
  const mid = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
}

// Variable-width brush stroke along a polyline (thick in the middle, tapering at both ends).
export function brushStroke(ctx, pts, width, color = INK, taper = true) {
  if (pts.length < 2) return;
  ctx.fillStyle = color;
  const n = pts.length;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[Math.min(n - 1, i + 1)];
    const o = pts[Math.max(0, i - 1)];
    const dx = q[0] - o[0];
    const dy = q[1] - o[1];
    const l = Math.hypot(dx, dy) || 1;
    const k = i / (n - 1);
    const w = (taper ? Math.sin(Math.PI * Math.min(1, Math.max(0.08, k * 0.9 + 0.05))) : 1) * width * (p[2] ?? 1);
    left.push([p[0] - (dy / l) * w / 2, p[1] + (dx / l) * w / 2]);
    right.push([p[0] + (dy / l) * w / 2, p[1] - (dx / l) * w / 2]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
}

// Prebaked ink splat sprites in a few colours.
const splatCache = {};
export function splatSprite(color = INK, variant = 0) {
  const key = `${color}:${variant}`;
  if (splatCache[key]) return splatCache[key];
  const S = 128;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const r = rng(1000 + variant * 77);
  g.fillStyle = color;
  // central blob
  const pts = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 22 + r() * 18;
    pts.push([S / 2 + Math.cos(a) * rr, S / 2 + Math.sin(a) * rr]);
  }
  smoothBlob(g, pts, color, color, 0);
  // spikes and droplets
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d1 = 26 + r() * 10;
    const d2 = 40 + r() * 22;
    g.beginPath();
    g.moveTo(S / 2 + Math.cos(a - 0.12) * d1, S / 2 + Math.sin(a - 0.12) * d1);
    g.lineTo(S / 2 + Math.cos(a) * d2, S / 2 + Math.sin(a) * d2);
    g.lineTo(S / 2 + Math.cos(a + 0.12) * d1, S / 2 + Math.sin(a + 0.12) * d1);
    g.fill();
    g.beginPath();
    g.arc(S / 2 + Math.cos(a) * (d2 + 6 + r() * 10), S / 2 + Math.sin(a) * (d2 + 6 + r() * 10), 1.5 + r() * 4, 0, Math.PI * 2);
    g.fill();
  }
  splatCache[key] = c;
  return c;
}

// Soft ink-wash cloud sprite (for dust/smoke puffs).
const puffCache = {};
export function puffSprite(color = INK) {
  if (puffCache[color]) return puffCache[color];
  const S = 96;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.5;
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  puffCache[color] = c;
  return c;
}

export function setFont(ctx, size, family = FONT_DISPLAY, weight = '') {
  ctx.font = `${weight} ${Math.round(size)}px ${family}`.trim();
}

// Calligraphy text: dry-brush offsets + solid core.
export function brushText(ctx, text, x, y, size, color = INK, opts = {}) {
  const family = opts.family || (/[㐀-鿿]/.test(text) ? FONT_CJK : FONT_DISPLAY);
  setFont(ctx, size, family, opts.weight || 'bold');
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.baseline || 'middle';
  if (opts.outline) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = opts.outline;
    ctx.strokeStyle = opts.outlineColor || PAPER;
    ctx.strokeText(text, x, y);
  }
  if (opts.dry !== false) {
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = color;
    ctx.fillText(text, x + size * 0.03, y + size * 0.02);
    ctx.fillText(text, x - size * 0.02, y - size * 0.015);
    ctx.globalAlpha /= 0.35;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// Red square seal stamp with a glyph.
export function seal(ctx, x, y, size, text, color = SEAL, rot = -0.08) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  const s = size;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.12) : ctx.rect(-s / 2, -s / 2, s, s);
  ctx.fill();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = s * 0.05;
  ctx.strokeRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8);
  ctx.fillStyle = PAPER;
  setFont(ctx, s * (text.length > 1 ? 0.42 : 0.62), FONT_CJK, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (text.length > 2) {
    ctx.fillText(text.slice(0, 2), 0, -s * 0.18);
    ctx.fillText(text.slice(2), 0, s * 0.2);
  } else if (text.length === 2) {
    ctx.fillText(text[0], 0, -s * 0.18);
    ctx.fillText(text[1], 0, s * 0.2);
  } else ctx.fillText(text, 0, s * 0.04);
  ctx.restore();
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt < 0) {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  } else {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function rgba(hex, a) {
  if (hex === 'rainbow') hex = '#ffd34d';
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

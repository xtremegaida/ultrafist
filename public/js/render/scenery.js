// Shared helpers for painting the prebaked parallax layers of arenas and hidden areas.

import { VIEW_H } from './camera.js';

export const LW = 2600; // prebaked layer width

export function mountains(g, r, baseY, height, color, count, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, VIEW_H);
  let x = 0;
  g.lineTo(0, baseY);
  while (x < LW) {
    const w = LW / count * (0.6 + r() * 0.8);
    const h = height * (0.5 + r() * 0.6);
    g.quadraticCurveTo(x + w * 0.3, baseY - h * 0.9, x + w * 0.5, baseY - h);
    g.quadraticCurveTo(x + w * 0.7, baseY - h * 0.85, x + w, baseY - r() * height * 0.2);
    x += w;
  }
  g.lineTo(LW, VIEW_H);
  g.closePath();
  g.fill();
  // misty base fade
  const grad = g.createLinearGradient(0, baseY - height * 0.3, 0, baseY + 40);
  grad.addColorStop(0, 'rgba(243,234,215,0)');
  grad.addColorStop(1, 'rgba(243,234,215,0.85)');
  g.fillStyle = grad;
  g.fillRect(0, baseY - height * 0.3, LW, height * 0.3 + 60);
  g.restore();
}

export function skyGradient(g, top, bottom) {
  const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, LW, VIEW_H);
}

// soft radial light; rgb is "r,g,b"
export function glow(g, x, y, r0, r1, rgb, a) {
  const grad = g.createRadialGradient(x, y, r0, x, y, r1);
  grad.addColorStop(0, `rgba(${rgb},${a})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
}

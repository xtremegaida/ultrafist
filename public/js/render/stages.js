// Arena backgrounds (prebaked parallax layers) and world-space stage elements (floor, hazards).

import { makeCanvas, rng, paperTexture, brushStroke, limb, circle, ellipse, poly, smoothBlob, INK, SEAL, GOLD, rgba, shade, brushText, puffSprite } from './brush.js';
import { VIEW_W, VIEW_H, camScale, BASE_SCALE } from './camera.js';

const LW = 2600; // prebaked layer width
const cache = {};

function layer(id, idx, painter) {
  const key = `${id}:${idx}`;
  if (!cache[key]) {
    const c = makeCanvas(LW, VIEW_H);
    painter(c.getContext('2d'), rng(idx * 101 + id.length * 7));
    cache[key] = c;
  }
  return cache[key];
}

function mountains(g, r, baseY, height, color, count, alpha = 1) {
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

function skyGradient(g, top, bottom) {
  const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, LW, VIEW_H);
}

function bambooStalk(g, x, y0, y1, w, color, r) {
  limb(g, [x, y0], [x + (r() - 0.5) * 20, y1], w, w * 0.8, color, shade(color, -0.4), 1.5);
  for (let y = y0 - 40 - r() * 30; y > y1; y -= 50 + r() * 40) {
    g.strokeStyle = shade(color, -0.5);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.lineTo(x + w / 2, y);
    g.stroke();
    if (r() < 0.45) {
      const dir = r() < 0.5 ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        brushStroke(g, [[x, y, 1], [x + dir * (25 + i * 8), y + 8 + i * 10, 1], [x + dir * (55 + i * 6), y + 20 + i * 14, 0.3]], 7, shade(color, -0.15 - i * 0.05));
      }
    }
  }
}

const PAINTERS = {
  bamboo: [
    (g, r) => {
      skyGradient(g, '#e6edd8', '#f3ead7');
      mountains(g, r, 470, 300, 'rgba(110,125,110,0.35)', 6);
      mountains(g, r, 520, 200, 'rgba(70,90,75,0.45)', 9);
    },
    (g, r) => {
      for (let i = 0; i < 46; i++) {
        const x = r() * LW;
        bambooStalk(g, x, VIEW_H, -20, 10 + r() * 8, `rgba(${60 + r() * 30},${100 + r() * 40},${70 + r() * 20},0.55)`, r);
      }
    },
    (g, r) => {
      for (let i = 0; i < 16; i++) {
        const x = r() * LW;
        bambooStalk(g, x, VIEW_H, -40, 18 + r() * 10, `rgb(${40 + r() * 30},${90 + r() * 30},${50 + r() * 20})`, r);
      }
    },
  ],
  rooftop: [
    (g, r) => {
      skyGradient(g, '#0b132b', '#3a506b');
      for (let i = 0; i < 160; i++) circle(g, r() * LW, r() * 400, r() * 1.6 + 0.3, rgba('#ffffff', 0.4 + r() * 0.6), null, 0);
      const mg = g.createRadialGradient(1300, 170, 40, 1300, 170, 260);
      mg.addColorStop(0, 'rgba(255,248,220,0.5)');
      mg.addColorStop(1, 'rgba(255,248,220,0)');
      g.fillStyle = mg;
      g.fillRect(1000, 0, 600, 450);
      circle(g, 1300, 170, 95, '#fff3c4', 'rgba(0,0,0,0)', 0);
      ellipse(g, 1270, 150, 22, 14, 0, 'rgba(200,180,140,0.35)', null, 0);
      ellipse(g, 1330, 200, 14, 10, 0, 'rgba(200,180,140,0.3)', null, 0);
    },
    (g, r) => {
      // pagoda skyline
      for (let i = 0; i < 18; i++) {
        const x = r() * LW;
        const levels = 2 + Math.floor(r() * 4);
        let y = 560;
        const w0 = 80 + r() * 60;
        for (let l = 0; l < levels; l++) {
          const w = w0 * (1 - l * 0.15);
          g.fillStyle = 'rgba(20,24,40,0.9)';
          g.fillRect(x - w * 0.35, y - 40, w * 0.7, 40);
          poly(g, [[x - w * 0.7, y - 36], [x, y - 70], [x + w * 0.7, y - 36], [x + w * 0.5, y - 44], [x - w * 0.5, y - 44]], 'rgba(15,18,30,1)', null, 0);
          if (r() < 0.6) circle(g, x + (r() - 0.5) * w * 0.4, y - 20, 4, rgba('#ffcf70', 0.8), null, 0);
          y -= 46;
        }
      }
      g.fillStyle = 'rgba(15,18,30,1)';
      g.fillRect(0, 560, LW, 200);
    },
    null,
  ],
  teahouse: [
    (g, r) => {
      skyGradient(g, '#5c3d2e', '#2e1f17');
      // wooden wall panels
      for (let x = 0; x < LW; x += 160) {
        g.fillStyle = r() < 0.5 ? '#6b4a35' : '#62432f';
        g.fillRect(x, 0, 158, VIEW_H);
        g.strokeStyle = '#2a1a10';
        g.lineWidth = 4;
        g.strokeRect(x, 0, 158, VIEW_H);
      }
    },
    (g, r) => {
      // lattice windows with warm light and hanging scrolls
      for (let x = 120; x < LW; x += 520) {
        g.fillStyle = 'rgba(255,214,140,0.85)';
        g.fillRect(x, 140, 220, 220);
        g.strokeStyle = '#3b2416';
        g.lineWidth = 6;
        g.strokeRect(x, 140, 220, 220);
        g.lineWidth = 3;
        for (let i = 1; i < 6; i++) {
          g.beginPath();
          g.moveTo(x + i * 36, 140);
          g.lineTo(x + i * 36, 360);
          g.moveTo(x, 140 + i * 36);
          g.lineTo(x + 220, 140 + i * 36);
          g.stroke();
        }
        // scroll
        const sx = x + 330;
        g.fillStyle = '#efe6cf';
        g.fillRect(sx, 100, 90, 300);
        g.fillStyle = '#7f5539';
        g.fillRect(sx - 8, 92, 106, 12);
        g.fillRect(sx - 8, 396, 106, 12);
        brushText(g, ['茶', '醉', '拳', '道'][Math.floor(r() * 4)], sx + 45, 200, 64, INK, { dry: true });
        brushText(g, ['禪', '酒', '武', '仙'][Math.floor(r() * 4)], sx + 45, 300, 64, INK, { dry: true });
      }
      // lanterns
      for (let x = 60; x < LW; x += 260) {
        g.strokeStyle = INK;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, 60);
        g.stroke();
        ellipse(g, x, 90, 26, 32, 0, '#d62828', INK, 2);
        g.fillStyle = GOLD;
        g.fillRect(x - 14, 56, 28, 6);
        g.fillRect(x - 14, 118, 28, 6);
      }
    },
    null,
  ],
  barnyard: [
    (g, r) => {
      skyGradient(g, '#ffb4a2', '#ffe5b4');
      const sg = g.createRadialGradient(1500, 430, 20, 1500, 430, 320);
      sg.addColorStop(0, 'rgba(255,190,90,0.9)');
      sg.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = sg;
      g.fillRect(1100, 100, 800, 600);
      circle(g, 1500, 430, 80, '#ff8c42', null, 0);
      mountains(g, r, 520, 120, 'rgba(120,140,90,0.45)', 5);
    },
    (g, r) => {
      // barn with a pagoda roof, fence, trees
      const bx = 1250;
      g.fillStyle = '#9d0208';
      g.fillRect(bx - 170, 300, 340, 260);
      poly(g, [[bx - 230, 310], [bx, 190], [bx + 230, 310], [bx + 200, 300], [bx - 200, 300]], '#3d2b1f', INK, 3);
      g.fillStyle = '#f3ead7';
      g.fillRect(bx - 60, 400, 120, 160);
      g.strokeStyle = '#9d0208';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(bx - 60, 400);
      g.lineTo(bx + 60, 560);
      g.moveTo(bx + 60, 400);
      g.lineTo(bx - 60, 560);
      g.stroke();
      brushText(g, '農', bx, 250, 54, GOLD, { dry: false });
      for (let x = 0; x < LW; x += 70) {
        limb(g, [x, 600], [x, 520], 10, 10, '#b08968', INK, 1.5);
      }
      limb(g, [0, 545], [LW, 545], 7, 7, '#b08968', INK, 1.5);
      limb(g, [0, 580], [LW, 580], 7, 7, '#b08968', INK, 1.5);
      for (let i = 0; i < 6; i++) {
        const x = r() * LW;
        if (Math.abs(x - bx) < 300) continue;
        limb(g, [x, 560], [x, 380], 18, 12, '#5c4033', INK, 2);
        smoothBlob(g, Array.from({ length: 9 }, (_, j) => {
          const a = (j / 9) * Math.PI * 2;
          return [x + Math.cos(a) * (70 + r() * 20), 350 + Math.sin(a) * (55 + r() * 15)];
        }), 'rgba(80,120,60,0.9)', INK, 2);
      }
    },
    null,
  ],
  waterfall: [
    (g, r) => {
      skyGradient(g, '#d8e2dc', '#f3ead7');
      mountains(g, r, 460, 380, 'rgba(90,100,110,0.4)', 5);
      mountains(g, r, 540, 260, 'rgba(60,70,80,0.55)', 7);
    },
    (g, r) => {
      // twin cliffs with pines framing the falls
      const cx = LW / 2;
      poly(g, [[cx - 420, VIEW_H], [cx - 380, 120], [cx - 170, 60], [cx - 130, VIEW_H]], '#4a4e69', INK, 3);
      poly(g, [[cx + 130, VIEW_H], [cx + 170, 80], [cx + 380, 140], [cx + 440, VIEW_H]], '#4a4e69', INK, 3);
      for (const px of [cx - 300, cx + 300, cx - 900, cx + 900]) {
        limb(g, [px, 560], [px + 10, 300], 12, 8, '#3b2f2f', INK, 2);
        for (let i = 0; i < 4; i++) {
          poly(g, [[px - 70 + i * 8, 400 - i * 40], [px + 5, 340 - i * 40], [px + 80 - i * 8, 400 - i * 40]], '#1b4332', INK, 2);
        }
      }
    },
    null,
  ],
  cloud: [
    (g, r) => {
      skyGradient(g, '#cdb4db', '#ffe5b4');
      for (let i = 0; i < 26; i++) {
        const x = r() * LW;
        const y = 120 + r() * 380;
        for (let j = 0; j < 5; j++) circle(g, x + j * 26, y + Math.sin(j) * 8, 28 + r() * 12, 'rgba(255,255,255,0.6)', null, 0);
      }
    },
    (g, r) => {
      // jade pillars and golden roofs
      for (let x = 100; x < LW; x += 300) {
        limb(g, [x, VIEW_H], [x, 150], 40, 40, '#2d6a4f', INK, 3);
        g.fillStyle = GOLD;
        g.fillRect(x - 26, 140, 52, 18);
        g.fillRect(x - 26, 500, 52, 14);
      }
      for (let x = 0; x < LW; x += 600) {
        poly(g, [[x - 40, 150], [x + 300, 60], [x + 640, 150], [x + 600, 135], [x, 135]], '#b8860b', INK, 3);
      }
    },
    null,
  ],
};

const PARALLAX = [0.2, 0.5, 0.8];
const FLOOR = {
  bamboo: { top: '#8c7b5d', bottom: '#5b4a33', line: '#3a2e1f' },
  rooftop: { top: '#3d405b', bottom: '#22223b', line: '#0b0c1b', tiles: true },
  teahouse: { top: '#8b5e3c', bottom: '#5e3a22', line: '#2a1a10', planks: true },
  barnyard: { top: '#b5895a', bottom: '#8a6440', line: '#4d3626', straw: true },
  waterfall: { top: '#6c757d', bottom: '#495057', line: '#212529' },
  cloud: { top: '#95d5b2', bottom: '#52b788', line: '#1b4332', jade: true },
};

let paper = null;

export function drawBackground(ctx, cam, stageId, t) {
  const painters = PAINTERS[stageId] || PAINTERS.bamboo;
  if (!paper) paper = paperTexture(VIEW_W, VIEW_H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(paper, 0, 0);
  const s = camScale(cam);
  for (let i = 0; i < painters.length; i++) {
    if (!painters[i]) continue;
    const img = layer(stageId, i, painters[i]);
    const p = PARALLAX[i];
    const zoom = 1 + (s / BASE_SCALE - 1) * p * 0.5;
    const ox = VIEW_W / 2 - (LW / 2) * zoom - (cam.x - 800) * BASE_SCALE * p - cam.shakeX * p;
    const oy = VIEW_H - VIEW_H * zoom + (-cam.y * s * p * 0.6) + cam.shakeY * p;
    ctx.setTransform(zoom, 0, 0, zoom, ox, oy);
    ctx.drawImage(img, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawLiveBackground(ctx, cam, stageId, t);
}

// animated, unbaked background touches
function drawLiveBackground(ctx, cam, stageId, t) {
  if (stageId === 'waterfall') {
    const s = camScale(cam);
    const x = VIEW_W / 2 - (cam.x - 800) * BASE_SCALE * 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(220,240,255,0.75)';
    ctx.fillRect(x - 120, 0, 240, VIEW_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      const lx = x - 110 + i * 13;
      const off = ((t * 9 + i * 53) % 140);
      ctx.beginPath();
      ctx.moveTo(lx, off - 140);
      for (let y = off - 140; y < VIEW_H; y += 140) {
        ctx.moveTo(lx, y);
        ctx.lineTo(lx, y + 70);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.5;
    ctx.drawImage(puffSprite('#ffffff'), x - 260, VIEW_H - 260, 520, 260);
    ctx.restore();
    void s;
  }
  if (stageId === 'bamboo') {
    // drifting leaves
    ctx.save();
    ctx.fillStyle = 'rgba(60,110,60,0.6)';
    for (let i = 0; i < 10; i++) {
      const x = (i * 197 + t * (1 + (i % 3))) % (VIEW_W + 100) - 50;
      const y = (i * 71 + t * 0.6 + Math.sin(t / 30 + i) * 20) % VIEW_H;
      ctx.beginPath();
      ctx.ellipse(x, y, 8, 3, t / 20 + i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (stageId === 'cloud') {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 300 + t * 0.4 * (i + 1)) % (VIEW_W + 400)) - 200;
      ctx.drawImage(puffSprite('#ffffff'), x, 420 + i * 30, 300, 120);
    }
    ctx.restore();
  }
}

// Floor drawn in world space (camera transform applied by caller).
export function drawFloor(ctx, stageId, left, right) {
  const f = FLOOR[stageId] || FLOOR.bamboo;
  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, f.top);
  grad.addColorStop(1, f.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(left - 600, 0, right - left + 1200, 400);
  brushStroke(ctx, [[left - 600, 1, 1], [800, 3, 1], [right + 600, 1, 1]], 6, f.line, false);
  ctx.strokeStyle = rgba('#000000', 0.25);
  ctx.lineWidth = 2;
  if (f.tiles) {
    for (let x = left - 600; x < right + 600; x += 48) {
      ctx.beginPath();
      ctx.arc(x, 24, 24, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 24, 70, 24, Math.PI, 0);
      ctx.stroke();
    }
  } else if (f.planks) {
    for (let y = 18; y < 260; y += 26) {
      ctx.beginPath();
      ctx.moveTo(left - 600, y);
      ctx.lineTo(right + 600, y);
      ctx.stroke();
    }
  } else if (f.straw) {
    ctx.strokeStyle = 'rgba(240,210,120,0.6)';
    for (let i = 0; i < 160; i++) {
      const x = left - 300 + ((i * 137) % (right - left + 600));
      const y = 10 + ((i * 53) % 120);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14, y - 4);
      ctx.stroke();
    }
  } else if (f.jade) {
    for (let x = left - 600; x < right + 600; x += 120) {
      ctx.strokeRect(x, 4, 120, 60);
    }
  } else {
    for (let i = 0; i < 60; i++) {
      const x = left - 300 + ((i * 211) % (right - left + 600));
      brushStroke(ctx, [[x, 6, 1], [x + 6, -10, 1], [x + 12, -18, 0.3]], 4, 'rgba(60,90,40,0.7)');
    }
  }
  // stage edge walls (painted screens)
  for (const wx of [left, right]) {
    ctx.fillStyle = rgba('#000000', 0.12);
    ctx.fillRect(wx + (wx === left ? -60 : 0), -700, 60, 700);
  }
}

// ---------------------------------------------------------------------------------------------
// Hazards, zones, props, pickups (world space)

export function drawHazards(ctx, v, t) {
  const st = v.stage;
  if (!st) return;
  for (const h of st.hazards) {
    switch (h.kind) {
      case 'bamboo': {
        ctx.save();
        ctx.translate(h.x, 0);
        let ang = 0;
        if (h.st === 'falling') ang = h.dir * (h.t < 20 ? Math.sin(h.t * 1.2) * 0.04 : ((h.t - 20) / 14) ** 2 * 1.5);
        if (h.st === 'down') ang = h.dir * 1.53;
        ctx.rotate(ang);
        if (h.st !== 'down' || h.t < 600) {
          limb(ctx, [0, 0], [0, -420], 20, 16, '#4f772d', INK, 2.5);
          for (let y = -60; y > -420; y -= 70) {
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-10, y);
            ctx.lineTo(10, y);
            ctx.stroke();
          }
          brushStroke(ctx, [[0, -400, 1], [40, -430, 1], [80, -420, 0.3]], 10, '#31572c');
          brushStroke(ctx, [[0, -380, 1], [-45, -400, 1], [-80, -385, 0.3]], 10, '#31572c');
        }
        ctx.restore();
        if (h.st === 'up' || h.st === 'falling') limb(ctx, [h.x - 14, 0], [h.x + 14, 0], 8, 8, '#4f772d', INK, 1.5);
        break;
      }
      case 'lantern': {
        if (h.st === 'up') {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(h.x, -700);
          ctx.lineTo(h.x, h.y - 30);
          ctx.stroke();
        }
        if (h.st !== 'down') {
          const glow = ctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, 90);
          glow.addColorStop(0, 'rgba(255,170,60,0.45)');
          glow.addColorStop(1, 'rgba(255,170,60,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(h.x - 90, h.y - 90, 180, 180);
          ellipse(ctx, h.x, h.y, 24, 30, h.st === 'falling' ? 0.4 : Math.sin(t / 25) * 0.08, '#d62828', INK, 2);
          ctx.fillStyle = GOLD;
          ctx.fillRect(h.x - 12, h.y - 32, 24, 6);
          brushText(ctx, '福', h.x, h.y + 2, 22, GOLD, { dry: false });
        }
        break;
      }
      case 'hay':
        if (h.st === 'up') {
          ellipse(ctx, h.x, -42, 48, 42, 0, '#e9c46a', INK, 2.5);
          ctx.strokeStyle = '#b08968';
          ctx.lineWidth = 2;
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(h.x - 40, -42 + i * 14);
            ctx.lineTo(h.x + 40, -42 + i * 14);
            ctx.stroke();
          }
          if (h.hp < 3) {
            ctx.strokeStyle = INK;
            ctx.beginPath();
            ctx.moveTo(h.x - 20, -70);
            ctx.lineTo(h.x, -45);
            ctx.lineTo(h.x + 15, -60);
            ctx.stroke();
          }
        }
        break;
      case 'waiter': {
        const wx = h.x;
        if (h.t < 60) {
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t / 3);
          brushText(ctx, '!', h.dir > 0 ? 60 : 1540, -240, 90, SEAL);
          ctx.globalAlpha = 1;
          break;
        }
        const step = Math.sin(h.t * 0.5) * 20;
        limb(ctx, [wx, -60], [wx - 10 + step * 0.5, 0], 12, 10, '#264653', INK, 2);
        limb(ctx, [wx, -60], [wx + 10 - step * 0.5, 0], 12, 10, '#264653', INK, 2);
        limb(ctx, [wx, -60], [wx, -130], 34, 30, '#f1faee', INK, 2.5);
        circle(ctx, wx + h.dir * 4, -150, 16, '#f0cfa8');
        limb(ctx, [wx, -120], [wx + h.dir * 40, -140], 10, 9, '#f1faee', INK, 2);
        ellipse(ctx, wx + h.dir * 45, -145, 34, 6, 0, '#adb5bd', INK, 2);
        for (let i = -1; i <= 1; i++) circle(ctx, wx + h.dir * 45 + i * 16, -158, 7, '#f1faee', INK, 1.5);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        for (let i = 0; i < 3; i++) ctx.fillRect(wx + h.dir * 45 + (i - 1) * 16 - 1, -180 - ((t * 2 + i * 10) % 20), 2, 10);
        break;
      }
      case 'dragon': {
        if (h.t < 90) {
          ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.1 * Math.sin(t / 4)})`;
          ctx.beginPath();
          ctx.ellipse(800, 8, 700 * (h.t / 90), 14, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        drawDragon(ctx, h.x, -80, h.dir, t);
        break;
      }
      case 'rock':
        ellipse(ctx, h.x, -14, h.w / 2, 18, 0, '#6c757d', INK, 2.5);
        brushText(ctx, '禪', h.x, -16, 20, rgba('#f3ead7', 0.7), { dry: false });
        break;
      default:
        break;
    }
  }
}

export function drawDragon(ctx, x, y, dir, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const pts = [];
  for (let i = 0; i < 18; i++) {
    pts.push([-i * 26, Math.sin(t / 5 - i * 0.6) * 22, 1 - i / 22]);
  }
  brushStroke(ctx, pts, 46, '#2d6a4f', false);
  for (let i = 1; i < 18; i += 2) poly(ctx, [[pts[i][0] - 8, pts[i][1] - 18], [pts[i][0], pts[i][1] - 36], [pts[i][0] + 8, pts[i][1] - 18]], SEAL, INK, 1.5);
  ellipse(ctx, 20, 0, 40, 26, 0, '#40916c', INK, 3);
  circle(ctx, 34, -10, 6, GOLD, INK, 2);
  limb(ctx, [10, -20], [-30, -60], 6, 3, '#f1faee', INK, 1.5);
  limb(ctx, [10, -14], [-24, -50], 6, 3, '#f1faee', INK, 1.5);
  brushStroke(ctx, [[54, 6, 1], [90, 20, 1], [120, 4, 0.3]], 8, '#ffd166');
  ctx.restore();
}

export function drawZones(ctx, v, t) {
  for (const z of v.zones || []) {
    const a = Math.min(1, z.t / 30);
    ctx.save();
    ctx.globalAlpha = a;
    switch (z.kind) {
      case 'yolk':
        ellipse(ctx, z.x, 3, z.w / 2, 9, 0, 'rgba(255,230,120,0.85)', INK, 1.5);
        circle(ctx, z.x + 8, 2, 12, '#ffb703', INK, 1.5);
        break;
      case 'mud':
        ellipse(ctx, z.x, 3, z.w / 2, 10, 0, 'rgba(90,60,30,0.85)', INK, 1.5);
        for (let i = 0; i < 4; i++) circle(ctx, z.x - z.w / 3 + i * z.w / 4.5, -2 - Math.abs(Math.sin(t / 10 + i)) * 4, 4, 'rgba(110,75,40,0.9)', null, 0);
        break;
      case 'lard':
        ellipse(ctx, z.x, 3, z.w / 2, 8, 0, 'rgba(255,250,230,0.8)', 'rgba(200,190,150,0.9)', 2);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 4; i++) ctx.fillRect(z.x - z.w / 3 + i * z.w / 5, -2, 10, 2);
        break;
      case 'fire':
        for (let i = 0; i < 6; i++) {
          const fx = z.x - z.w / 2 + (i + 0.5) * (z.w / 6);
          const h = 30 + Math.abs(Math.sin(t / 4 + i)) * 30;
          ctx.fillStyle = i % 2 ? '#ff7b00' : '#ffd166';
          ctx.beginPath();
          ctx.moveTo(fx - 12, 0);
          ctx.quadraticCurveTo(fx, -h * 1.2, fx + 12, 0);
          ctx.fill();
        }
        break;
      case 'grass':
        for (let i = 0; i < 10; i++) brushStroke(ctx, [[z.x - 50 + i * 10, 2, 1], [z.x - 48 + i * 10, -16, 1], [z.x - 44 + i * 10, -26, 0.3]], 4, '#52b788');
        break;
      default:
        break;
    }
    ctx.restore();
  }
}

export function drawProps(ctx, v, t) {
  for (const p of v.props || []) {
    if (p.kind === 'chicken') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.vx >= 0 ? 1 : -1, 1);
      if (p.flying) ctx.rotate(t * 0.3);
      ellipse(ctx, 0, -18, 16, 13, 0, '#fffaf0', INK, 2);
      circle(ctx, 12, -32, 8, '#fffaf0', INK, 2);
      circle(ctx, 12, -42, 4, SEAL, INK, 1);
      poly(ctx, [[19, -33], [26, -31], [19, -29]], '#f4b400', INK, 1);
      ctx.strokeStyle = '#f4b400';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, -6);
      ctx.lineTo(-3 + Math.sin(t * 0.8) * 4, 0);
      ctx.moveTo(4, -6);
      ctx.lineTo(4 - Math.sin(t * 0.8) * 4, 0);
      ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'egg') {
      ellipse(ctx, p.x, -14, 11, 14, Math.sin(t / 8) * 0.2, '#fffaf0', INK, 2);
    }
  }
  for (const p of v.pickups || []) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const bob = Math.sin(t / 8) * 3;
    if (p.kind === 'peach') {
      circle(ctx, 0, bob, 14, '#ffadad', INK, 2);
      brushStroke(ctx, [[0, bob - 14, 1], [8, bob - 22, 1], [14, bob - 20, 0.3]], 6, '#52b788');
    } else if (p.kind === 'orb') {
      const g = ctx.createRadialGradient(0, bob, 2, 0, bob, 18);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, 'rgba(77,210,255,0.4)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, bob, 16, 0, Math.PI * 2);
      ctx.fill();
      brushText(ctx, '氣', 0, bob, 16, '#023e8a', { dry: false });
    } else {
      limb(ctx, [-10, bob + 6], [10, bob - 10], 9, 3, '#d00000', INK, 2);
      limb(ctx, [8, bob - 8], [13, bob - 14], 3, 3, '#2d6a4f', INK, 1);
    }
    ctx.restore();
  }
}

export function stageTint(stageId) {
  return stageId === 'rooftop' ? 'rgba(20,30,60,0.12)' : null;
}


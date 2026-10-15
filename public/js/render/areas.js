// The hidden areas behind each arena, reached when a KO smashes someone through the scenery:
// prebaked parallax painters, floor patterns and small animated touches. Same conventions as
// render/stages.js: each layer is LW x VIEW_H and painted once.

import { brushStroke, limb, circle, ellipse, poly, smoothBlob, INK, SEAL, GOLD, rgba, shade, brushText, puffSprite } from './brush.js';
import { VIEW_W, VIEW_H } from './camera.js';
import { LW, mountains, skyGradient, glow } from './scenery.js';

const CX = LW / 2;

function blobAround(r, x, y, rx, ry, n = 10, wobble = 0.2) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * wobble * 2;
    return [x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k];
  });
}

// ---- Moonlit Lotus Pond (behind the bamboo) -----------------------------------------------------

function willow(g, r, x, y) {
  limb(g, [x, y], [x + 18, y - 290], 26, 12, '#3b3024', INK, 2);
  limb(g, [x + 14, y - 230], [x + 90, y - 300], 10, 5, '#3b3024', INK, 1.5);
  for (let k = 0; k < 16; k++) {
    const sx = x - 90 + k * 13 + r() * 10;
    const sy = y - 300 + Math.abs(k - 8) * 6 + r() * 20;
    const len = 150 + r() * 120;
    brushStroke(g, [[sx, sy, 1], [sx + 8, sy + len * 0.5, 0.8], [sx + 3, sy + len, 0.2]], 5, `rgba(${60 + r() * 30},${100 + r() * 30},70,0.75)`);
  }
}

function lotusFlower(g, x, y, s) {
  for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    ellipse(g, 0, -12 * s, 6 * s, 14 * s, 0, a === 0 ? '#ffc8dd' : '#ff8fab', INK, 1.2);
    g.restore();
  }
}

function lilyPad(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0.25, Math.PI * 2 - 0.05);
  g.lineTo(x, y);
  g.closePath();
  g.fillStyle = '#4f7f52';
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = INK;
  g.stroke();
}

const lotus = [
  (g, r) => {
    skyGradient(g, '#22314a', '#90aaa0');
    glow(g, 900, 190, 60, 320, '255,250,225', 0.5);
    circle(g, 900, 190, 100, '#fdf6dc', null, 0);
    ellipse(g, 870, 170, 22, 14, 0, 'rgba(200,190,150,0.3)', null, 0);
    mountains(g, r, 500, 260, 'rgba(25,40,50,0.5)', 6);
    mountains(g, r, 570, 150, 'rgba(20,35,40,0.6)', 9);
  },
  (g, r) => {
    g.fillStyle = '#2e4a4c';
    g.fillRect(0, 588, LW, VIEW_H - 588);
    // moonlight on the water
    for (let y = 600; y < VIEW_H; y += 12) brushStroke(g, [[CX - 40 - r() * 60, y, 1], [CX + 40 + r() * 60, y, 1]], 3, 'rgba(255,250,225,0.3)');
    for (let i = 0; i < 70; i++) {
      const x = r() * LW;
      const y = 600 + r() * 110;
      brushStroke(g, [[x, y, 1], [x + 30 + r() * 40, y, 1]], 2.5, 'rgba(200,230,220,0.3)');
    }
    // the moon bridge, completing its circle in the reflection
    const bx = CX + 260;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(216,205,184,0.25)';
    g.lineWidth = 16;
    g.beginPath();
    g.ellipse(bx, 600, 260, 190, 0, 0.05, Math.PI - 0.05);
    g.stroke();
    for (const [w, col] of [[28, INK], [22, '#d8cdb8']]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.ellipse(bx, 600, 260, 190, 0, Math.PI, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    for (let a = Math.PI + 0.12; a < Math.PI * 2 - 0.1; a += 0.16) {
      const x = bx + Math.cos(a) * 260;
      const y = 600 + Math.sin(a) * 190;
      g.moveTo(x, y - 10);
      g.lineTo(x, y - 46);
    }
    g.stroke();
    g.beginPath();
    g.ellipse(bx, 562, 255, 186, 0, Math.PI + 0.12, Math.PI * 2 - 0.12);
    g.stroke();
    willow(g, r, 380, 600);
    willow(g, r, 2240, 600);
    willow(g, r, 1020, 600);
    for (let i = 0; i < 34; i++) {
      const x = r() * LW;
      const y = 610 + r() * 100;
      lilyPad(g, x, y, 26 + r() * 22, 7 + r() * 4);
      if (r() < 0.35) lotusFlower(g, x + 6, y - 2, 0.9 + r() * 0.5);
    }
  },
  (g, r) => {
    // reeds and cattails
    for (let i = 0; i < 16; i++) {
      const x = r() * LW;
      const h = 150 + r() * 120;
      for (let k = 0; k < 5; k++) {
        const tx = x + k * 7 + (r() - 0.5) * 50;
        brushStroke(g, [[x + k * 7, VIEW_H, 1], [tx, VIEW_H - h * (0.7 + r() * 0.3), 0.3]], 6, 'rgba(40,70,50,0.8)');
      }
      ellipse(g, x + 10, VIEW_H - h - 10, 5, 16, 0.1, '#6b4226', INK, 1.5);
    }
  },
];

// ---- Hall of a Thousand Buddhas (beneath the temple rooftop) ------------------------------------

function greatBuddha(g, x) {
  glow(g, x, 260, 80, 330, '242,183,5', 0.35);
  for (const [rad, a] of [[230, 0.5], [200, 0.25]]) circle(g, x, 260, rad, null, rgba(GOLD, a), 6);
  // robed body seated in meditation
  smoothBlob(g, [[x - 110, 330], [x - 230, 420], [x - 260, 600], [x, 640], [x + 260, 600], [x + 230, 420], [x + 110, 330]], '#c99a2e', INK, 3);
  brushStroke(g, [[x - 150, 380, 1], [x - 40, 470, 1], [x + 30, 560, 0.4]], 10, 'rgba(120,80,20,0.6)');
  ellipse(g, x, 560, 120, 40, 0, '#ddb24a', INK, 2.5);
  ellipse(g, x, 548, 46, 20, 0, '#e8c25c', INK, 2);
  // head: curls, long earlobes, half-closed eyes and a very calm smile
  ellipse(g, x - 80, 280, 14, 46, 0.1, '#e0b34a', INK, 2.5);
  ellipse(g, x + 80, 280, 14, 46, -0.1, '#e0b34a', INK, 2.5);
  circle(g, x, 255, 80, '#e0b34a', INK, 3);
  circle(g, x, 168, 26, '#c9982f', INK, 2.5);
  for (let i = 0; i < 9; i++) circle(g, x - 64 + i * 16, 196 + Math.abs(i - 4) * 4, 7, '#c9982f', INK, 1.5);
  for (const s of [-1, 1]) brushStroke(g, [[x + s * 46, 252, 1], [x + s * 30, 258, 1], [x + s * 14, 252, 0.6]], 5, INK);
  circle(g, x, 226, 4, SEAL, null, 0);
  brushStroke(g, [[x - 18, 296, 0.6], [x, 302, 1], [x + 18, 296, 0.6]], 4, INK);
}

const buddhas = [
  (g, r) => {
    skyGradient(g, '#2a140b', '#5c2a14');
    // a wall of niches, each with its own little golden Buddha: a thousand, give or take
    for (let row = 0, y = 70; y < 590; y += 64, row++) {
      for (let x = 24 + (row % 2) * 28; x < LW; x += 56) {
        g.fillStyle = 'rgba(15,6,2,0.55)';
        g.beginPath();
        g.moveTo(x - 22, y + 28);
        g.lineTo(x - 22, y - 12);
        g.arc(x, y - 12, 22, Math.PI, 0);
        g.lineTo(x + 22, y + 28);
        g.closePath();
        g.fill();
        circle(g, x, y - 8, 13, 'rgba(242,183,5,0.22)', null, 0);
        ellipse(g, x, y + 13, 13, 14, 0, '#b8892a', null, 0);
        circle(g, x, y - 8, 7, '#d4a537', null, 0);
        circle(g, x, y - 16, 3, '#d4a537', null, 0);
      }
    }
    greatBuddha(g, CX);
  },
  (g, r) => {
    // roof beams, with a ragged hole where somebody just came through
    g.fillStyle = '#2e1409';
    g.fillRect(0, 0, LW, 44);
    for (let x = 0; x < LW; x += 120) poly(g, [[x, 44], [x + 30, 70], [x + 90, 70], [x + 120, 44]], '#4a2410', INK, 2);
    poly(g, [[CX - 228, 0], [CX - 92, 0], [CX - 104, 34], [CX - 122, 62], [CX - 150, 46], [CX - 176, 70], [CX - 200, 42], [CX - 220, 56]], '#1d2b4a', INK, 2.5);
    circle(g, CX - 140, 18, 2, '#ffffff', null, 0);
    circle(g, CX - 190, 30, 1.5, '#ffffff', null, 0);
    // red lacquer pillars and silk banners
    const glyphs = ['佛', '禪', '福', '壽', '靜', '空', '悟'];
    for (let i = 0, x = 160; x < LW; x += 460, i++) {
      limb(g, [x, VIEW_H], [x, 40], 46, 46, '#8d0801', INK, 3);
      g.fillStyle = GOLD;
      g.fillRect(x - 25, 96, 50, 14);
      g.fillRect(x - 25, 540, 50, 14);
      const bx = x + 130;
      poly(g, [[bx - 26, 60], [bx + 26, 60], [bx + 26, 330], [bx, 356], [bx - 26, 330]], '#f2c14e', INK, 2);
      g.fillStyle = SEAL;
      g.fillRect(bx - 26, 60, 52, 14);
      brushText(g, glyphs[i % glyphs.length], bx, 150, 40, SEAL, { dry: true });
      brushText(g, glyphs[(i + 3) % glyphs.length], bx, 250, 40, SEAL, { dry: true });
    }
    // bronze incense burner
    poly(g, [[CX - 90, 520], [CX + 90, 520], [CX + 70, 590], [CX - 70, 590]], '#6b5b3e', INK, 3);
    for (const s of [-1, 1]) {
      limb(g, [CX + s * 50, 585], [CX + s * 62, 612], 12, 10, '#5a4a30', INK, 2);
      ellipse(g, CX + s * 96, 508, 12, 18, 0, null, INK, 4);
    }
    g.fillStyle = '#7d6b4b';
    g.fillRect(CX - 96, 508, 192, 14);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(CX - 96, 508, 192, 14);
    for (let i = -2; i <= 2; i++) {
      limb(g, [CX + i * 14, 510], [CX + i * 15, 450], 3, 3, '#8b5e3c', INK, 0.8);
      circle(g, CX + i * 15, 450, 2.5, '#ff6b35', null, 0);
    }
  },
  null,
];

// ---- Tea House Kitchen (behind the tea house wall) ----------------------------------------------

function duck(g, x, y) {
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, y - 46);
  g.lineTo(x, y - 20);
  g.stroke();
  smoothBlob(g, [[x - 4, y - 22], [x + 18, y], [x + 22, y + 40], [x, y + 66], [x - 22, y + 40], [x - 18, y]], '#b5651d', INK, 2);
  brushStroke(g, [[x - 10, y + 6, 1], [x + 4, y + 36, 1], [x - 2, y + 58, 0.3]], 7, 'rgba(255,200,120,0.5)');
}

function steamer(g, x, y) {
  for (let i = 0; i < 3; i++) {
    const yy = y - i * 30;
    g.fillStyle = '#d4a373';
    g.fillRect(x - 46, yy - 28, 92, 28);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(x - 46, yy - 28, 92, 28);
    g.strokeStyle = 'rgba(90,60,30,0.5)';
    g.beginPath();
    g.moveTo(x - 46, yy - 14);
    g.lineTo(x + 46, yy - 14);
    g.stroke();
  }
  ellipse(g, x, y - 92, 48, 12, 0, '#c08552', INK, 2);
}

const kitchen = [
  (g, r) => {
    skyGradient(g, '#e9e2cf', '#c8bb9c');
    g.strokeStyle = 'rgba(120,110,90,0.3)';
    g.lineWidth = 2;
    for (let y = 0, row = 0; y < VIEW_H; y += 40, row++) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(LW, y);
      for (let x = (row % 2) * 30; x < LW; x += 60) {
        g.moveTo(x, y);
        g.lineTo(x, y + 40);
      }
      g.stroke();
    }
    // shelves of jars, bowls and bottles
    for (const sy of [200, 330]) {
      for (let x = 30; x < LW; x += 60 + r() * 60) {
        const k = r();
        if (k < 0.4) {
          smoothBlob(g, blobAround(r, x, sy - 26, 20, 26, 8, 0.05), shade('#a68a64', (r() - 0.5) * 0.4), INK, 2);
          g.fillStyle = SEAL;
          g.fillRect(x - 10, sy - 36, 20, 14);
        } else if (k < 0.75) {
          for (let i = 0; i < 4; i++) ellipse(g, x, sy - 6 - i * 9, 24, 6, 0, '#fdfdf8', '#2a6f97', 2);
        } else {
          limb(g, [x, sy], [x, sy - 50], 22, 10, '#5a7d5a', INK, 2);
        }
      }
      g.fillStyle = '#7f5539';
      g.fillRect(0, sy, LW, 12);
      g.strokeStyle = INK;
      g.strokeRect(-2, sy, LW + 4, 12);
    }
    // a rail of roast ducks
    g.strokeStyle = '#5c4033';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(0, 64);
    g.lineTo(LW, 64);
    g.stroke();
    for (let x = 90; x < LW; x += 190 + r() * 60) duck(g, x, 110);
  },
  (g, r) => {
    // brick stove range with woks and steamer stacks
    g.fillStyle = '#7a2e1c';
    g.fillRect(0, 484, LW, 140);
    g.strokeStyle = 'rgba(30,10,5,0.5)';
    g.lineWidth = 2;
    for (let y = 484, row = 0; y < 624; y += 22, row++) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(LW, y);
      for (let x = (row % 2) * 24; x < LW; x += 48) {
        g.moveTo(x, y);
        g.lineTo(x, y + 22);
      }
      g.stroke();
    }
    g.fillStyle = '#3d3d3d';
    g.fillRect(0, 466, LW, 22);
    for (let x = 200; x < LW; x += 420) {
      g.fillStyle = '#1a0d08';
      g.beginPath();
      g.moveTo(x - 46, 610);
      g.lineTo(x - 46, 560);
      g.arc(x, 560, 46, Math.PI, 0);
      g.lineTo(x + 46, 610);
      g.closePath();
      g.fill();
      glow(g, x, 590, 4, 70, '255,140,40', 0.55);
      g.beginPath();
      g.ellipse(x, 462, 74, 34, 0, 0, Math.PI);
      g.fillStyle = '#222';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = INK;
      g.stroke();
      limb(g, [x + 70, 462], [x + 130, 440], 9, 7, '#5c4033', INK, 2);
      steamer(g, x + 210, 466);
    }
    // the cook's sign
    g.fillStyle = SEAL;
    g.fillRect(CX - 60, 300, 120, 120);
    g.strokeStyle = GOLD;
    g.lineWidth = 4;
    g.strokeRect(CX - 52, 308, 104, 104);
    brushText(g, '廚', CX, 362, 76, GOLD, { dry: false });
  },
  null,
];

// ---- The Pigpen (through the barnyard fence) ----------------------------------------------------

function sleepingPig(g, x, y, s = 1) {
  ellipse(g, x, y, 62 * s, 34 * s, 0, '#f4a5b8', INK, 2.5);
  circle(g, x + 54 * s, y - 8 * s, 26 * s, '#f4a5b8', INK, 2.5);
  poly(g, [[x + 40 * s, y - 28 * s], [x + 52 * s, y - 52 * s], [x + 62 * s, y - 30 * s]], '#e58fa5', INK, 2);
  ellipse(g, x + 78 * s, y - 4 * s, 10 * s, 12 * s, 0, '#e58fa5', INK, 2);
  brushStroke(g, [[x + 50 * s, y - 14 * s, 0.6], [x + 58 * s, y - 11 * s, 1], [x + 64 * s, y - 14 * s, 0.6]], 3, INK);
  for (const lx of [-34, 30]) limb(g, [x + lx * s, y + 22 * s], [x + (lx + 8) * s, y + 34 * s], 12 * s, 10 * s, '#f4a5b8', INK, 2);
  brushText(g, 'z', x + 96 * s, y - 50 * s, 22 * s, INK, { dry: false });
  brushText(g, 'Z', x + 116 * s, y - 78 * s, 30 * s, INK, { dry: false });
}

const pigpen = [
  (g, r) => {
    skyGradient(g, '#ffc4a8', '#ffe9c7');
    glow(g, 640, 420, 20, 300, '255,190,90', 0.85);
    circle(g, 640, 420, 76, '#ff8c42', null, 0);
    mountains(g, r, 520, 110, 'rgba(120,140,90,0.45)', 5);
    g.fillStyle = 'rgba(157,2,8,0.45)';
    g.fillRect(1900, 410, 240, 140);
    poly(g, [[1870, 418], [2020, 340], [2170, 418]], 'rgba(61,43,31,0.6)', null, 0);
  },
  (g, r) => {
    // the pen's plank fence
    for (let x = 0; x < LW; x += 44) limb(g, [x, 612], [x, 410 + (r() - 0.5) * 18], 40, 40, shade('#a47148', (r() - 0.5) * 0.25), INK, 1.5);
    for (const y of [450, 560]) limb(g, [-10, y], [LW + 10, y], 14, 14, '#7f5539', INK, 2);
    // sign
    limb(g, [CX, 600], [CX, 330], 12, 12, '#5c4033', INK, 2);
    g.fillStyle = '#e9c46a';
    g.fillRect(CX - 80, 300, 160, 70);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.strokeRect(CX - 80, 300, 160, 70);
    brushText(g, '豬圈', CX, 336, 46, SEAL, { dry: true });
    // the trough, full of slop
    poly(g, [[CX - 520, 560], [CX - 300, 560], [CX - 320, 612], [CX - 500, 612]], '#6f4e37', INK, 3);
    ellipse(g, CX - 410, 562, 108, 8, 0, '#a3b18a', INK, 1.5);
    sleepingPig(g, 380, 580, 1);
    sleepingPig(g, 1900, 584, 0.9);
    sleepingPig(g, 2380, 578, 1.05);
    smoothBlob(g, blobAround(r, CX + 380, 580, 110, 44, 9, 0.15), '#e9c46a', INK, 2);
  },
  null,
];

// ---- Water Curtain Cave (behind the waterfall) --------------------------------------------------

const cave = [
  (g, r) => {
    skyGradient(g, '#141d2b', '#2e3f55');
    for (let i = 0; i < 40; i++) smoothBlob(g, blobAround(r, r() * LW, r() * VIEW_H, 40 + r() * 60, 30 + r() * 40, 8, 0.3), 'rgba(8,12,20,0.35)', null, 0);
    // the opening at the back, light pouring in through the falling water
    const pts = blobAround(r, CX, 310, 430, 250, 14, 0.12);
    const grad = g.createLinearGradient(0, 60, 0, 560);
    grad.addColorStop(0, '#e6f4fb');
    grad.addColorStop(1, '#8fb9cf');
    smoothBlob(g, pts, grad, 'rgba(10,14,22,0.9)', 14);
    g.save();
    smoothBlob(g, pts, null, INK, 0);
    g.clip();
    for (let i = 0; i < 70; i++) {
      const x = CX - 440 + r() * 880;
      brushStroke(g, [[x, 40, 0.5], [x + (r() - 0.5) * 6, 330, 1], [x, 580, 0.5]], 3 + r() * 6, 'rgba(255,255,255,0.45)', false);
    }
    g.restore();
  },
  (g, r) => {
    g.fillStyle = '#1b2230';
    g.fillRect(0, 0, LW, 30);
    for (let i = 0; i < 44; i++) {
      const x = r() * LW;
      const w = 22 + r() * 44;
      poly(g, [[x - w / 2, 10], [x + (r() - 0.5) * 12, 70 + r() * 170], [x + w / 2, 10]], shade('#2b3445', (r() - 0.5) * 0.3), INK, 2);
    }
    for (let i = 0; i < 10; i++) {
      const x = r() * LW;
      if (Math.abs(x - CX) < 220) continue;
      poly(g, [[x - 40, 612], [x - 6, 450 + r() * 80], [x + 36, 612]], '#3a4556', INK, 2);
    }
    // the famous stone tablet: "Blessed land of Flower-Fruit Mountain, cave-heaven of the Water Curtain Cave"
    poly(g, [[CX - 74, 612], [CX - 74, 360], [CX - 50, 330], [CX + 50, 330], [CX + 74, 360], [CX + 74, 612]], '#6c757d', INK, 3);
    g.strokeStyle = 'rgba(20,20,20,0.5)';
    g.lineWidth = 2;
    g.strokeRect(CX - 60, 362, 120, 236);
    const cols = [['花果山福地', CX + 28], ['水簾洞洞天', CX - 28]];
    for (const [txt, x] of cols) [...txt].forEach((ch, i) => brushText(g, ch, x, 386 + i * 46, 30, '#1b1b1b', { dry: true }));
    for (let i = 0; i < 60; i++) circle(g, r() * LW, 560 + r() * 50, 1.5 + r() * 2.5, `rgba(120,255,200,${0.25 + r() * 0.4})`, null, 0);
  },
  null,
];

// ---- Peach Garden of Immortality (below the cloud court) ----------------------------------------

function peachTree(g, r, x, y, s) {
  limb(g, [x, y], [x - 16 * s, y - 150 * s], 30 * s, 20 * s, '#5c4033', INK, 2);
  limb(g, [x - 12 * s, y - 120 * s], [x - 90 * s, y - 190 * s], 14 * s, 8 * s, '#5c4033', INK, 2);
  limb(g, [x - 14 * s, y - 140 * s], [x + 70 * s, y - 210 * s], 14 * s, 8 * s, '#5c4033', INK, 2);
  for (let i = 0; i < 6; i++) {
    const cx = x + (r() - 0.5) * 220 * s;
    const cy = y - 220 * s + (r() - 0.5) * 90 * s;
    smoothBlob(g, blobAround(r, cx, cy, 70 * s, 50 * s, 9, 0.2), `rgba(${80 + r() * 30},${135 + r() * 25},80,0.95)`, INK, 1.5);
  }
  for (let i = 0; i < 26; i++) circle(g, x + (r() - 0.5) * 260 * s, y - 220 * s + (r() - 0.5) * 120 * s, 4 * s, '#ffd6e0', null, 0);
  for (let i = 0; i < 6; i++) {
    const px = x + (r() - 0.5) * 220 * s;
    const py = y - 190 * s + (r() - 0.5) * 90 * s;
    circle(g, px, py, 13 * s, '#ffb4a2', INK, 1.5);
    circle(g, px + 4 * s, py - 3 * s, 6 * s, 'rgba(230,57,70,0.45)', null, 0);
    brushStroke(g, [[px, py - 12 * s, 1], [px + 9 * s, py - 20 * s, 1], [px + 15 * s, py - 18 * s, 0.3]], 6 * s, '#52b788');
  }
}

const peaches = [
  (g, r) => {
    skyGradient(g, '#ffd1dc', '#fff3d6');
    for (let i = 0; i < 18; i++) {
      const x = r() * LW;
      const y = 80 + r() * 260;
      for (let j = 0; j < 5; j++) circle(g, x + j * 24, y + Math.sin(j) * 7, 24 + r() * 10, 'rgba(255,255,255,0.65)', null, 0);
    }
    // a palace drifting on a far cloud
    for (let l = 0; l < 3; l++) {
      const w = 140 - l * 30;
      poly(g, [[560 - w, 300 - l * 40], [560, 270 - l * 40], [560 + w, 300 - l * 40]], 'rgba(184,134,11,0.55)', null, 0);
      g.fillStyle = 'rgba(141,8,1,0.35)';
      g.fillRect(560 - w * 0.6, 300 - l * 40, w * 1.2, 26);
    }
    mountains(g, r, 540, 140, 'rgba(140,170,120,0.45)', 6);
  },
  (g, r) => {
    // white wall with a moon gate and two lattice windows
    g.fillStyle = '#f4efe6';
    g.fillRect(CX - 420, 370, 840, 242);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.strokeRect(CX - 420, 370, 840, 242);
    poly(g, [[CX - 450, 372], [CX - 420, 340], [CX + 420, 340], [CX + 450, 372]], '#4a5759', INK, 3);
    for (const wx of [CX - 280, CX + 280]) {
      g.save();
      circle(g, wx, 470, 44, '#cfe3c0', null, 0);
      g.clip();
      g.strokeStyle = '#7f5539';
      g.lineWidth = 5;
      g.beginPath();
      for (let d = -60; d <= 60; d += 20) {
        g.moveTo(wx + d, 420);
        g.lineTo(wx + d, 520);
        g.moveTo(wx - 50, 470 + d);
        g.lineTo(wx + 50, 470 + d);
      }
      g.stroke();
      g.restore();
      circle(g, wx, 470, 44, null, INK, 4);
    }
    circle(g, CX, 486, 112, '#cfe3c0', INK, 5);
    g.save();
    circle(g, CX, 486, 110, null, INK, 0);
    g.clip();
    peachTree(g, r, CX + 20, 620, 0.7);
    g.restore();
    circle(g, CX, 486, 112, null, INK, 5);
    brushText(g, '蟠桃', CX, 324, 30, SEAL, { dry: false });
    for (const [x, s] of [[260, 1.1], [700, 0.9], [CX - 760, 1], [CX + 760, 1.05], [2160, 0.95], [2480, 1.1]]) peachTree(g, r, x, 610, s);
  },
  null,
];

export const AREA_PAINTERS = { lotus, buddhas, kitchen, pigpen, cave, peaches };

export const AREA_FLOORS = {
  lotus: { top: '#3f6466', bottom: '#1e3a3c', line: '#0c2224', style: 'pond' },
  buddhas: { top: '#6b3a22', bottom: '#2e170b', line: '#140904', style: 'flagstone' },
  kitchen: { top: '#9c5a3c', bottom: '#5a2f1c', line: '#2a140a', style: 'terracotta' },
  pigpen: { top: '#8a5a33', bottom: '#4b2e17', line: '#2a190c', style: 'mud' },
  cave: { top: '#525e6e', bottom: '#2a323d', line: '#151a21', style: 'wet' },
  peaches: { top: '#a3c98a', bottom: '#5f8c4e', line: '#2f4f25', style: 'meadow' },
};

// Floor patterns in world space (the caller has already filled the floor gradient).
export function drawAreaFloor(ctx, style, left, right) {
  const x0 = left - 600;
  const span = right - left + 1200;
  ctx.lineWidth = 2;
  switch (style) {
    case 'pond':
      for (let i = 0; i < 70; i++) {
        const x = x0 + ((i * 173) % span);
        const y = 16 + ((i * 47) % 200);
        if (i % 3 === 0) lilyPad(ctx, x, y, 30 + (i % 4) * 6, 8 + (i % 3) * 2);
        else brushStroke(ctx, [[x, y, 1], [x + 50, y, 1]], 2.5, 'rgba(200,230,220,0.3)');
      }
      break;
    case 'flagstone':
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (const y of [36, 96, 180]) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + span, y);
        ctx.stroke();
      }
      for (let x = x0; x < x0 + span; x += 150) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 30, 260);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(242,183,5,0.25)';
      ctx.beginPath();
      ctx.moveTo(x0, 14);
      ctx.lineTo(x0 + span, 14);
      ctx.stroke();
      break;
    case 'terracotta':
      ctx.strokeStyle = 'rgba(40,15,5,0.4)';
      for (let y = 0, row = 0; y < 260; y += 34, row++) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + span, y);
        for (let x = x0 + (row % 2) * 34; x < x0 + span; x += 68) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 34);
        }
        ctx.stroke();
      }
      break;
    case 'mud':
      for (let i = 0; i < 50; i++) {
        const x = x0 + ((i * 211) % span);
        const y = 14 + ((i * 59) % 170);
        ellipse(ctx, x, y, 40 + (i % 5) * 12, 6 + (i % 3) * 2, 0, 'rgba(60,35,15,0.45)', null, 0);
        if (i % 2) {
          ellipse(ctx, x + 60, y - 4, 3, 5, 0.3, 'rgba(40,25,10,0.6)', null, 0);
          ellipse(ctx, x + 68, y - 4, 3, 5, -0.3, 'rgba(40,25,10,0.6)', null, 0);
        }
      }
      break;
    case 'wet':
      for (let i = 0; i < 40; i++) {
        const x = x0 + ((i * 197) % span);
        const y = 18 + ((i * 61) % 180);
        if (i % 2) {
          ellipse(ctx, x, y, 46 + (i % 4) * 10, 7, 0, 'rgba(160,200,230,0.35)', null, 0);
          brushStroke(ctx, [[x - 20, y - 2, 1], [x + 10, y - 2, 1]], 2, 'rgba(255,255,255,0.5)');
        } else circle(ctx, x, y, 3 + (i % 3), 'rgba(20,25,35,0.5)', null, 0);
      }
      break;
    case 'meadow':
      for (let i = 0; i < 90; i++) {
        const x = x0 + ((i * 137) % span);
        const y = 8 + ((i * 53) % 190);
        if (i % 3 === 0) ellipse(ctx, x, y, 5, 3, i, '#ffc8dd', null, 0);
        else brushStroke(ctx, [[x, y + 4, 1], [x + 5, y - 10, 1], [x + 10, y - 16, 0.3]], 4, 'rgba(60,110,50,0.7)');
      }
      break;
    default:
      break;
  }
}

// ---- animated touches (only at high quality) -----------------------------------------------------

// tf: per-parallax-layer transforms { zoom, ox, oy } so touches can be drawn in layer coordinates.
export function drawAreaLive(ctx, id, t, tf) {
  const inLayer = (i) => ctx.setTransform(tf[i].zoom, 0, 0, tf[i].zoom, tf[i].ox, tf[i].oy);
  ctx.save();
  switch (id) {
    case 'lotus':
      // fireflies
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < 16; i++) {
        const x = (i * 211 + Math.sin(t / 50 + i) * 60 + t * 0.3) % VIEW_W;
        const y = 380 + ((i * 97) % 220) + Math.sin(t / 30 + i * 2) * 20;
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(t / 14 + i * 1.7));
        ctx.globalAlpha = a * 0.35;
        circle(ctx, x, y, 7, '#fff3a0', null, 0);
        ctx.globalAlpha = a;
        circle(ctx, x, y, 2.4, '#fffbe0', null, 0);
      }
      break;
    case 'buddhas': {
      // a shaft of moonlight through the hole in the roof, dust, and incense smoke
      inLayer(1);
      poly(ctx, [[CX - 210, 44], [CX - 110, 44], [CX + 80, VIEW_H], [CX - 330, VIEW_H]], 'rgba(255,240,200,0.10)', null, 0);
      for (let i = 0; i < 24; i++) {
        const y = 44 + ((i * 71 + t * (0.2 + (i % 3) * 0.1)) % (VIEW_H - 44));
        const k = (y - 44) / (VIEW_H - 44);
        const x = CX - 210 - 120 * k + (((i * 53) % 100) / 100) * (100 + 310 * k) + Math.sin(t / 60 + i) * 6;
        circle(ctx, x, y, 1.6, 'rgba(255,245,220,0.6)', null, 0);
      }
      for (let i = 0; i < 5; i++) {
        const k = ((t * 0.6 + i * 40) % 200) / 200;
        ctx.globalAlpha = 0.35 * (1 - k);
        ctx.drawImage(puffSprite('#e9e2cf'), CX - 30 + Math.sin(t / 40 + i) * 20 * k, 430 - k * 330, 60 + k * 60, 60 + k * 60);
      }
      break;
    }
    case 'kitchen':
      // steam from the woks and steamers, flames in the stoves
      inLayer(1);
      for (let x = 200; x < LW; x += 420) {
        for (let i = 0; i < 3; i++) {
          const k = ((t * 0.9 + i * 33 + x) % 100) / 100;
          ctx.globalAlpha = 0.4 * (1 - k);
          ctx.drawImage(puffSprite('#ffffff'), x + 180 + Math.sin(t / 25 + i) * 14, 330 - k * 200, 70 + k * 50, 70 + k * 50);
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < 4; i++) {
          const fh = 18 + Math.abs(Math.sin(t / 3 + i + x)) * 22;
          ctx.fillStyle = i % 2 ? '#ff7b00' : '#ffd166';
          ctx.beginPath();
          ctx.moveTo(x - 30 + i * 18, 606);
          ctx.quadraticCurveTo(x - 22 + i * 18, 606 - fh * 1.4, x - 14 + i * 18, 606);
          ctx.fill();
        }
      }
      break;
    case 'pigpen':
      // flies over the trough
      inLayer(1);
      ctx.fillStyle = INK;
      for (let i = 0; i < 7; i++) {
        const x = CX - 410 + Math.sin(t / 7 + i * 2.1) * 80 + Math.sin(t / 3.1 + i) * 10;
        const y = 520 + Math.cos(t / 5 + i * 1.3) * 34;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'cave':
      // the curtain of water shimmering in the cave mouth, drips from the stalactites
      inLayer(0);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(CX, 310, 400, 225, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 26; i++) {
        const x = CX - 360 + i * 28;
        const off = (t * 7 + i * 41) % 120;
        ctx.beginPath();
        for (let y = 80 + off - 120; y < 540; y += 120) {
          ctx.moveTo(x, Math.max(80, y));
          ctx.lineTo(x, Math.min(540, y + 50));
        }
        ctx.stroke();
      }
      ctx.restore();
      inLayer(1);
      ctx.fillStyle = 'rgba(190,225,245,0.8)';
      for (let i = 0; i < 12; i++) {
        const x = (i * 223) % LW;
        const y = 60 + ((t * 5 + i * 97) % 560);
        ctx.fillRect(x, y, 2.5, 9);
      }
      break;
    case 'peaches':
      // drifting blossom petals
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < 18; i++) {
        const x = (i * 157 + t * (0.6 + (i % 4) * 0.2) + Math.sin(t / 40 + i) * 30) % (VIEW_W + 60) - 30;
        const y = (i * 83 + t * (0.7 + (i % 3) * 0.25)) % VIEW_H;
        ellipse(ctx, x, y, 6, 3.5, t / 20 + i, '#ffc8dd', 'rgba(200,90,120,0.6)', 1);
      }
      break;
    default:
      break;
  }
  ctx.restore();
}

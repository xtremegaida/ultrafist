// Projectile drawing (world space).

import { getProj } from '../data/registry.js';
import { limb, circle, ellipse, poly, brushStroke, brushText, INK, SEAL, GOLD, PAPER, rgba } from './brush.js';
import { drawDragon } from './stages.js';

export function drawProjectiles(ctx, v, t) {
  for (const p of v.projectiles || []) {
    const def = getProj(p.kind);
    if (!def) continue;
    const sc = p.data?.scale || 1;
    const dir = p.facing || 1;
    ctx.save();
    switch (def.sprite) {
      case 'scroll': {
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.sin(p.t / 8) * 0.1);
        ctx.fillStyle = '#efe6cf';
        ctx.fillRect(-40, -28, 80, 56);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.strokeRect(-40, -28, 80, 56);
        limb(ctx, [-46, -32], [-46, 32], 10, 10, '#7f5539', INK, 1.5);
        limb(ctx, [46, -32], [46, 32], 10, 10, '#7f5539', INK, 1.5);
        brushText(ctx, '訓', 0, -4, 30, INK, { dry: false });
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = SEAL;
        ctx.textAlign = 'center';
        ctx.fillText('IN MY DAY...', 0, 20);
        break;
      }
      case 'sword':
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        poly(ctx, [[-30, -4], [26, -3], [36, 0], [26, 3], [-30, 4]], '#dee2e6', INK, 1.6);
        limb(ctx, [-30, -10], [-30, 10], 5, 5, GOLD, INK, 1.2);
        limb(ctx, [-30, 0], [-44, 0], 6, 6, '#6c3d1f', INK, 1.2);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-60, 0);
        ctx.lineTo(-90, 0);
        ctx.stroke();
        break;
      case 'wine':
        for (let i = 0; i < 8; i++) {
          circle(ctx, p.x - dir * i * 9 + Math.sin(t + i) * 3, p.y + Math.cos(t * 0.7 + i) * 8, 9 - i * 0.6, rgba('#c9184a', 0.6), null, 0);
        }
        break;
      case 'fire':
        for (let i = 0; i < 10; i++) {
          const k = i / 10;
          ctx.globalAlpha = 0.85 - k * 0.5;
          circle(ctx, p.x - dir * i * 14, p.y + Math.sin(t * 0.8 + i) * 10, 34 - i * 2.5, i % 2 ? '#ff7b00' : '#ffd166', null, 0);
        }
        break;
      case 'wave': {
        ctx.translate(p.x, 0);
        ctx.scale(dir, 1);
        const g = ctx.createLinearGradient(0, -300, 0, 0);
        g.addColorStop(0, 'rgba(255,240,200,0.95)');
        g.addColorStop(1, 'rgba(201,24,74,0.85)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-160, 0);
        ctx.quadraticCurveTo(-140, -260, 40, -300);
        ctx.quadraticCurveTo(160, -290, 140, -200);
        ctx.quadraticCurveTo(90, -240, 60, -170);
        ctx.quadraticCurveTo(110, -60, 160, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4;
        ctx.stroke();
        for (let i = 0; i < 6; i++) circle(ctx, -100 + i * 40, -280 - Math.abs(Math.sin(t / 5 + i)) * 30, 6, PAPER, INK, 1.5);
        // the surfing sage rides on top (drawn by the fighter itself), plus a gourd surfboard
        ellipse(ctx, 0, -300, 50, 12, -0.1, '#c98b2b', INK, 2);
        break;
      }
      case 'egg':
        ctx.translate(p.x, p.y);
        ctx.rotate(p.t * 0.2 * dir);
        ellipse(ctx, 0, 0, 13, 17, 0, '#fffaf0', INK, 2.5);
        break;
      case 'feather':
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ellipse(ctx, 0, 0, 22, 6, 0, '#c1121f', INK, 1.5);
        ctx.strokeStyle = INK;
        ctx.beginPath();
        ctx.moveTo(-24, 0);
        ctx.lineTo(22, 0);
        ctx.stroke();
        break;
      case 'ring':
        ctx.strokeStyle = rgba('#ffb703', 0.9);
        for (let i = 0; i < 3; i++) {
          ctx.lineWidth = 6 - i * 1.5;
          ctx.beginPath();
          ctx.ellipse(p.x - dir * i * 18, p.y, 22 * sc - i * 2, 75 * sc - i * 8, 0, -Math.PI / 2, Math.PI / 2, dir < 0);
          ctx.stroke();
        }
        break;
      case 'milkBeam': {
        const owner = v.fighters[p.owner];
        const bx = owner.x + (def.beam.x || 60) * p.facing;
        const by = owner.y + (def.beam.y || -110);
        const len = p.len;
        const w = def.h * (0.85 + Math.sin(t * 0.9) * 0.15) * (p.mult > 1.1 ? 1.25 : 1);
        ctx.translate(bx, by);
        ctx.scale(dir, 1);
        const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
        g.addColorStop(0, 'rgba(255,255,255,0.4)');
        g.addColorStop(0.5, '#ffffff');
        g.addColorStop(1, 'rgba(230,230,255,0.4)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -w * 0.3);
        ctx.lineTo(len, -w / 2);
        ctx.arc(len, 0, w / 2, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(0, w * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.stroke();
        for (let i = 0; i < 6; i++) circle(ctx, ((t * 20 + i * 70) % Math.max(1, len)), Math.sin(t + i) * w * 0.3, 4, '#f8f9fa', null, 0);
        brushText(ctx, '奶', len * 0.5, 0, 28, rgba('#1d3557', 0.6), { dry: false });
        break;
      }
      case 'ghostCow':
        ctx.translate(p.x, p.y);
        ctx.scale(dir, 1);
        ctx.globalAlpha = 0.65;
        ellipse(ctx, 0, 0, 52, 30, 0, '#e0fbfc', '#3d5a80', 2.5);
        circle(ctx, 50, -14, 20, '#e0fbfc', '#3d5a80', 2.5);
        limb(ctx, [44, -30], [38, -48], 5, 2, '#e0fbfc', '#3d5a80', 1.5);
        limb(ctx, [56, -30], [62, -48], 5, 2, '#e0fbfc', '#3d5a80', 1.5);
        for (const lx of [-30, -10, 14, 34]) limb(ctx, [lx, 20], [lx + Math.sin(t * 0.6 + lx) * 8, 44], 8, 6, '#e0fbfc', '#3d5a80', 1.5);
        brushStroke(ctx, [[-50, -10, 1], [-90, -20, 1], [-130, -10, 0.2]], 18, 'rgba(224,251,252,0.6)');
        break;
      case 'cyclone':
        ctx.translate(p.x, p.y);
        for (let i = 0; i < 7; i++) {
          const k = i / 7;
          ctx.strokeStyle = i % 2 ? 'rgba(110,75,40,0.8)' : 'rgba(170,140,90,0.7)';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.ellipse(Math.sin(t / 3 + i) * 8, 100 - k * 210, 20 + k * 55, 12 + k * 6, 0, t / 2 + i, t / 2 + i + 4.5);
          ctx.stroke();
        }
        break;
      case 'scream':
        ctx.translate(p.x, p.y);
        ctx.scale(dir * sc, sc);
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = rgba(i % 2 ? '#e63946' : '#16120f', 0.7 - i * 0.12);
          ctx.lineWidth = 7 - i;
          ctx.beginPath();
          ctx.arc(-60 - i * 20, 0, 60 + i * 20, -0.7, 0.7);
          ctx.stroke();
        }
        brushText(ctx, '咩', 0, 0, 42, SEAL, { outline: 4 });
        break;
      case 'ripple':
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(p.x - dir * i * 16, 0, 16 + i * 8, Math.PI, 0);
          ctx.stroke();
        }
        break;
      case 'lazyDragon':
        drawDragon(ctx, p.x + dir * 40, p.y, dir, t * 0.4);
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = INK;
        ctx.textAlign = 'center';
        ctx.fillText('*yawn*', p.x, p.y - 50);
        break;
      default:
        circle(ctx, p.x, p.y, 18, '#ffffff');
    }
    ctx.restore();
  }
}


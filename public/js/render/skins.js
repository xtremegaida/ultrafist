// Character skins drawn over the shared skeleton. All drawing happens in fighter-local space:
// origin at the feet, facing right, y down. The caller handles facing, scale and position.

import { limb, circle, ellipse, poly, smoothBlob, brushStroke, INK, SEAL, GOLD, shade, rgba, rng } from './brush.js';
import { PROPORTIONS } from './pose.js';

const SPECIES_OF = {
  longxu: 'human', waiya: 'human', jiugui: 'human', dazhong: 'human',
  jidao: 'rooster', moolan: 'cow', hamfu: 'pig', shanyang: 'goat',
};

const SKIN = {
  longxu: '#f0cfa8', waiya: '#f6d7b8', jiugui: '#e9b98f', dazhong: '#d99a68',
  jidao: '#c1121f', moolan: '#fbfaf7', hamfu: '#f7a8b8', shanyang: '#efe9dc',
};

export function speciesOf(charId) {
  return SPECIES_OF[charId] || 'human';
}

export function propsOf(charId, f) {
  const p = PROPORTIONS[speciesOf(charId)];
  if (charId === 'longxu' && f && hasBuffView(f, 'youth')) return { ...p, wUa: p.wUa * 1.5, wFa: p.wFa * 1.4, wTorso: p.wTorso * 1.25 };
  if (charId === 'jiugui') return { ...p, wTorso: p.wTorso * 1.12, wHip: p.wHip * 1.15 };
  if (charId === 'dazhong') return { ...p, wTorso: p.wTorso * 1.25, wHip: p.wHip * 1.15, wUa: p.wUa * 1.25, wFa: p.wFa * 1.2, wTh: p.wTh * 1.15 };
  return p;
}

function hasBuffView(f, id) {
  return Array.isArray(f.buffs) && f.buffs.some((b) => b.id === id);
}

// ---------------------------------------------------------------------------------------------

export function drawFighter(ctx, f, J, ex = {}) {
  const ch = f.charId;
  const sp = speciesOf(ch);
  const prop = propsOf(ch, f);
  const cos = ex.cos || {};
  const c1 = cos.c1 || '#dddddd';
  const c2 = cos.c2 || '#333333';
  const skin = SKIN[ch];
  const flash = ex.flash || 0;
  const pal = { c1, c2, skin, dark1: shade(c1, -0.25), dark2: shade(c2, -0.25), darkSkin: shade(skin, -0.2) };

  if (f.st === 'egg') {
    drawEgg(ctx, f, ex);
    return;
  }
  if (ch === 'dazhong' && f.move && f.move.id === 'goldenBell' && f.move.f >= 4 && f.move.f <= 62) {
    drawBronzeBell(ctx, f, J, pal);
    return;
  }

  // back layer
  if (sp === 'rooster') drawRoosterTail(ctx, J, pal, ex.t);
  if (sp === 'cow') drawTail(ctx, J, pal, '#211', ex.t, 46);
  if (sp === 'pig') drawCurlyTail(ctx, J, pal);
  if (sp === 'goat') drawTail(ctx, J, pal, shade(skin, -0.3), ex.t, 18);
  if (ch === 'waiya') drawSwordSheath(ctx, J, pal);
  if (ch === 'jiugui') drawGourd(ctx, J, pal, true);
  drawArm(ctx, J.aB, prop, pal, sp, ch, true, f);
  drawLeg(ctx, J.lB, prop, pal, sp, ch, true);
  drawTorso(ctx, J, prop, pal, sp, ch, f);
  drawLeg(ctx, J.lF, prop, pal, sp, ch, false);
  drawHead(ctx, J, prop, pal, sp, ch, f, ex);
  drawArm(ctx, J.aF, prop, pal, sp, ch, false, f);
  if (ch === 'jiugui') drawGourd(ctx, J, pal, false);
  if (ch === 'longxu') drawBeard(ctx, J, prop, f, ex);
  if (ch === 'shanyang') drawGoatBeard(ctx, J, prop);
  if (flash > 0) {
    // white hit flash overlay: redraw silhouette in white
    ctx.save();
    ctx.globalAlpha = Math.min(0.8, flash);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------------------------
// Torso

function drawTorso(ctx, J, prop, pal, sp, ch, f) {
  const hip = J.hip;
  const chest = J.chest;
  const dx = chest[0] - hip[0];
  const dy = chest[1] - hip[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const wt = prop.wTorso / 2;
  const wh = prop.wHip / 2;
  if (sp === 'human') {
    // robe body
    const pts = [
      [hip[0] + nx * wh, hip[1] + ny * wh],
      [chest[0] + nx * wt, chest[1] + ny * wt],
      [chest[0] - nx * wt * 0.9, chest[1] - ny * wt * 0.9],
      [hip[0] - nx * wh, hip[1] - ny * wh],
    ];
    const robe = ch === 'dazhong' ? pal.c1 : pal.c1;
    poly(ctx, pts, robe);
    // robe skirt flaps
    const sk = [
      [hip[0] + nx * wh * 1.15, hip[1] + ny * wh * 1.15],
      [hip[0] - nx * wh * 1.15, hip[1] - ny * wh * 1.15],
      [hip[0] - nx * wh * 1.3 - dx * 0.45, hip[1] - ny * wh * 1.3 - dy * 0.45],
      [hip[0] + nx * wh * 1.3 - dx * 0.45, hip[1] + ny * wh * 1.3 - dy * 0.45],
    ];
    poly(ctx, sk, pal.dark1);
    // collar cross
    ctx.strokeStyle = pal.c2;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(chest[0] + nx * wt * 0.6, chest[1] + ny * wt * 0.6);
    ctx.lineTo(chest[0] - dx * 0.35 - nx * wt * 0.1, chest[1] - dy * 0.35 - ny * wt * 0.1);
    ctx.lineTo(chest[0] - nx * wt * 0.6, chest[1] - ny * wt * 0.6);
    ctx.stroke();
    if (ch === 'dazhong') {
      // bare shoulder and prayer beads
      ellipse(ctx, chest[0] - nx * wt * 0.2, chest[1] - ny * wt * 0.2 + 6, wt * 0.55, wt * 0.45, 0, pal.skin, INK, 2);
      for (let i = 0; i < 9; i++) {
        const k = (i / 8) * 2 - 1;
        circle(ctx, chest[0] + nx * wt * 0.8 * k + dx * 0.05, chest[1] + ny * wt * 0.8 * k + 10 + (1 - k * k) * 14, 4.6, '#5a3825', INK, 1.4);
      }
    }
    // sash
    const sy = 0.2;
    limb(ctx, [hip[0] + nx * wh + dx * sy, hip[1] + ny * wh + dy * sy], [hip[0] - nx * wh + dx * sy, hip[1] - ny * wh + dy * sy], 9, 9, pal.c2, INK, 2);
    if (ch === 'hamfu') {
      /* pig gi handled in animal branch */
    }
    return;
  }
  // animals: rounded bodies
  const cx = (hip[0] + chest[0]) / 2;
  const cy = (hip[1] + chest[1]) / 2;
  const ang = Math.atan2(dy, dx) + Math.PI / 2;
  if (sp === 'rooster') {
    ellipse(ctx, cx + nx * 6, cy + ny * 6, wt * 1.05, len * 0.62, ang, pal.c1);
    // chest feathers
    ellipse(ctx, cx + nx * 10 - dx * 0.05, cy + ny * 10 - dy * 0.05, wt * 0.55, len * 0.42, ang, pal.c2, INK, 1.6);
    ctx.strokeStyle = rgba('#000000', 0.25);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const k = 0.2 + i * 0.18;
      ctx.beginPath();
      ctx.arc(hip[0] + dx * k + nx * 12, hip[1] + dy * k + ny * 12, 7, 0.2, 2.6);
      ctx.stroke();
    }
    // general's sash
    limb(ctx, [chest[0] + nx * wt * 0.8, chest[1] + ny * wt * 0.8], [hip[0] - nx * wh * 0.6, hip[1] - ny * wh * 0.6], 7, 7, GOLD, INK, 1.6);
    return;
  }
  if (sp === 'cow') {
    ellipse(ctx, cx, cy, wt * 1.02, len * 0.66, ang, pal.c1);
    // spots
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, wt, len * 0.64, ang, 0, Math.PI * 2);
    ctx.clip();
    const r = rng(42);
    for (let i = 0; i < 5; i++) {
      const sx = cx + (r() - 0.5) * wt * 1.6;
      const sy = cy + (r() - 0.5) * len;
      smoothBlob(ctx, Array.from({ length: 7 }, (_, j) => {
        const a = (j / 7) * Math.PI * 2;
        const rr = 7 + r() * 9;
        return [sx + Math.cos(a) * rr, sy + Math.sin(a) * rr];
      }), pal.c2, pal.c2, 0);
    }
    ctx.restore();
    ellipse(ctx, cx, cy, wt * 1.02, len * 0.66, ang, null);
    // apron sash
    limb(ctx, [hip[0] + nx * wh * 0.9 + dx * 0.15, hip[1] + ny * wh * 0.9 + dy * 0.15], [hip[0] - nx * wh * 0.9 + dx * 0.15, hip[1] - ny * wh * 0.9 + dy * 0.15], 8, 8, SEAL, INK, 1.8);
    return;
  }
  if (sp === 'pig') {
    // karate gi top over a round belly
    ellipse(ctx, cx + nx * 4, cy + ny * 4 + 4, wt * 1.0, len * 0.62, ang, pal.skin);
    const pts = [
      [chest[0] + nx * wt * 0.95, chest[1] + ny * wt * 0.95],
      [chest[0] - nx * wt * 0.85, chest[1] - ny * wt * 0.85],
      [hip[0] - nx * wh * 0.95 + dx * 0.15, hip[1] - ny * wh * 0.95 + dy * 0.15],
      [hip[0] - nx * wh * 0.2 + dx * 0.6, hip[1] - ny * wh * 0.2 + dy * 0.6],
    ];
    poly(ctx, pts, pal.c1);
    limb(ctx, [hip[0] + nx * wh + dx * 0.18, hip[1] + ny * wh + dy * 0.18], [hip[0] - nx * wh + dx * 0.18, hip[1] - ny * wh + dy * 0.18], 9, 9, pal.c2, INK, 2);
    return;
  }
  if (sp === 'goat') {
    const pts = [
      [hip[0] + nx * wh, hip[1] + ny * wh],
      [chest[0] + nx * wt, chest[1] + ny * wt],
      [chest[0] - nx * wt * 0.9, chest[1] - ny * wt * 0.9],
      [hip[0] - nx * wh, hip[1] - ny * wh],
    ];
    poly(ctx, pts, pal.c2);
    ellipse(ctx, chest[0] + nx * 4 - dx * 0.15, chest[1] + ny * 4 - dy * 0.15, wt * 0.55, len * 0.25, ang, pal.skin, INK, 1.6);
    limb(ctx, [hip[0] + nx * wh + dx * 0.2, hip[1] + ny * wh + dy * 0.2], [hip[0] - nx * wh + dx * 0.2, hip[1] - ny * wh + dy * 0.2], 8, 8, pal.c1, INK, 2);
  }
}

// ---------------------------------------------------------------------------------------------
// Limbs

function drawArm(ctx, A, prop, pal, sp, ch, back, f) {
  const [s, e, w] = A;
  const dim = back ? -0.18 : 0;
  if (sp === 'rooster') {
    // wing: feathered upper arm and a fan of primaries
    limb(ctx, s, e, prop.wUa, prop.wUa * 0.9, shade(pal.c1, dim - 0.05));
    const dx = w[0] - e[0];
    const dy = w[1] - e[1];
    const a = Math.atan2(dy, dx);
    for (let i = 0; i < 4; i++) {
      const aa = a + (i - 1.5) * 0.22;
      const l = 34 - Math.abs(i - 1.5) * 4;
      limb(ctx, e, [e[0] + Math.cos(aa) * l, e[1] + Math.sin(aa) * l], 9, 3, shade(i % 2 ? pal.c1 : '#2b2d42', dim), INK, 1.4);
    }
    return;
  }
  const sleeve = sp === 'human' ? shade(pal.c1, dim) : sp === 'pig' ? shade(pal.c1, dim) : sp === 'goat' ? shade(pal.c2, dim) : shade(pal.skin, dim - 0.04);
  const fur = shade(pal.skin, dim);
  limb(ctx, s, e, prop.wUa, prop.wUa * 0.92, sleeve);
  if (sp === 'human') {
    // flared wuxia sleeve
    const dx = w[0] - e[0];
    const dy = w[1] - e[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const k = 0.72;
    const m = [e[0] + dx * k, e[1] + dy * k];
    poly(ctx, [
      [e[0] + nx * prop.wFa * 0.5, e[1] + ny * prop.wFa * 0.5],
      [m[0] + nx * prop.wFa * 0.95, m[1] + ny * prop.wFa * 0.95],
      [m[0] - nx * prop.wFa * 0.95, m[1] - ny * prop.wFa * 0.95],
      [e[0] - nx * prop.wFa * 0.5, e[1] - ny * prop.wFa * 0.5],
    ], sleeve);
    circle(ctx, w[0], w[1], prop.wFa * 0.55, shade(pal.skin, dim));
    if (ch === 'waiya' && !back) drawRibbon(ctx, m, w, pal);
    return;
  }
  limb(ctx, e, w, prop.wFa, prop.wFa * 0.85, sp === 'cow' ? fur : sleeve);
  // hooves / trotters
  const dx = w[0] - e[0];
  const dy = w[1] - e[1];
  const l = Math.hypot(dx, dy) || 1;
  const hx = w[0] + (dx / l) * 4;
  const hy = w[1] + (dy / l) * 4;
  if (sp === 'cow' || sp === 'goat' || sp === 'pig') {
    ellipse(ctx, hx, hy, prop.wFa * 0.55, prop.wFa * 0.48, Math.atan2(dy, dx), sp === 'pig' ? shade('#c9707f', dim) : shade('#3b3530', dim));
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + (dx / l) * prop.wFa * 0.5, hy + (dy / l) * prop.wFa * 0.5);
    ctx.stroke();
  }
}

function drawRibbon(ctx, from, to, pal) {
  const t = performance.now() / 300;
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const k = i / 7;
    pts.push([to[0] - k * 40 + Math.sin(t + k * 4) * 6, to[1] + k * 30 + Math.cos(t + k * 3) * 8, 1]);
  }
  brushStroke(ctx, pts, 9, rgba(pal.c2, 0.85));
}

function drawLeg(ctx, L, prop, pal, sp, ch, back) {
  const [h, k, a] = L;
  const dim = back ? -0.18 : 0;
  if (sp === 'rooster') {
    limb(ctx, h, k, prop.wTh, prop.wTh * 0.7, shade(pal.c1, dim - 0.08));
    limb(ctx, k, a, prop.wSh, prop.wSh, shade('#f4b400', dim), INK, 1.8);
    // talons
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    for (const da of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(a[0] + Math.cos(da) * 14, a[1] + Math.sin(da) * 3 + 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(a[0] - 9, a[1] + 2);
    ctx.stroke();
    return;
  }
  const pants = sp === 'human' ? shade(pal.c2, dim) : sp === 'pig' ? shade(pal.c1, dim) : sp === 'goat' ? shade(pal.c2, dim - 0.1) : shade(pal.skin, dim - 0.05);
  limb(ctx, h, k, prop.wTh, prop.wTh * 0.85, pants);
  limb(ctx, k, a, prop.wSh, prop.wSh * 0.85, pants);
  if (sp === 'human') {
    // cloth shoe
    ellipse(ctx, a[0] + 7, a[1] - 2, 11, 5.5, 0, shade('#222222', dim));
  } else {
    const hoof = sp === 'pig' ? shade('#c9707f', dim) : shade('#3b3530', dim);
    ellipse(ctx, a[0] + 4, a[1] - 3, prop.wSh * 0.6, prop.wSh * 0.4, 0, hoof);
  }
}

// ---------------------------------------------------------------------------------------------
// Heads

function drawHead(ctx, J, prop, pal, sp, ch, f, ex) {
  const [hx, hy] = J.head;
  const r = prop.head;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate((J.headAng * Math.PI) / 180);
  const face = faceOf(f, ex);
  switch (sp) {
    case 'human':
      humanHead(ctx, r, pal, ch, f, face, ex);
      break;
    case 'rooster':
      roosterHead(ctx, r, pal, face);
      break;
    case 'cow':
      cowHead(ctx, r, pal, face, ch);
      break;
    case 'pig':
      pigHead(ctx, r, pal, face);
      break;
    case 'goat':
      goatHead(ctx, r, pal, face);
      break;
    default:
      circle(ctx, 0, 0, r, pal.skin);
  }
  if (!f.status?.hatless) drawHeadgear(ctx, r, ex.cos?.head, sp, pal);
  ctx.restore();
}

function faceOf(f, ex) {
  if (f.st === 'ko' || f.st === 'knockdown') return 'ko';
  if (f.st === 'hitstun' || f.st === 'launched' || f.st === 'grabbed' || f.st === 'ultraVictim' || f.st === 'guardBroken') return 'hurt';
  if (f.st === 'attack' && f.move && ex.special) return 'shout';
  if (f.st === 'win') return 'happy';
  if (f.move && (f.move.id === 'ancientNap' || f.move.id === 'passOut')) return 'sleep';
  return 'fierce';
}

function eyes(ctx, x, y, r, face, color = INK, sep = 0) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.6, r * 0.13);
  if (face === 'ko') {
    for (const ox of [0, sep]) {
      ctx.beginPath();
      ctx.moveTo(x + ox - r * 0.18, y - r * 0.18);
      ctx.lineTo(x + ox + r * 0.18, y + r * 0.18);
      ctx.moveTo(x + ox + r * 0.18, y - r * 0.18);
      ctx.lineTo(x + ox - r * 0.18, y + r * 0.18);
      ctx.stroke();
    }
    return;
  }
  if (face === 'sleep' || face === 'happy') {
    for (const ox of [0, sep]) {
      ctx.beginPath();
      ctx.arc(x + ox, y, r * 0.16, face === 'happy' ? Math.PI : 0, face === 'happy' ? 0 : Math.PI, face === 'happy');
      ctx.stroke();
    }
    return;
  }
  for (const ox of [0, sep]) {
    ctx.beginPath();
    ctx.arc(x + ox, y, face === 'hurt' ? r * 0.17 : r * 0.12, 0, Math.PI * 2);
    if (face === 'hurt') ctx.stroke();
    else ctx.fill();
  }
  if (face === 'fierce' || face === 'shout') {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y - r * 0.32);
    ctx.lineTo(x + r * 0.22 + sep, y - r * 0.12);
    ctx.stroke();
  }
}

function mouth(ctx, x, y, r, face) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  if (face === 'shout' || face === 'hurt') {
    ellipse(ctx, x, y, r * 0.22, r * (face === 'shout' ? 0.22 : 0.14), 0, '#5a0d12', INK, 1.5);
  } else if (face === 'happy') {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.1, r * 0.22, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.18, y);
    ctx.lineTo(x + r * 0.16, y - r * 0.03);
    ctx.stroke();
  }
}

function humanHead(ctx, r, pal, ch, f, face, ex) {
  const youth = ch === 'longxu' && hasBuffView(f, 'youth');
  const awakened = f.awakened > 0;
  // back hair
  if (ch === 'waiya') {
    circle(ctx, -r * 0.55, -r * 0.55, r * 0.55, '#141414');
    limb(ctx, [-r * 0.6, -r * 0.4], [-r * 1.6, r * 0.9], 8, 3, '#141414', INK, 1.4);
  }
  if (ch === 'jiugui') {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.9 + i * 0.32;
      limb(ctx, [Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7], [Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25], 6, 2, awakened ? '#fff' : '#8d8d8d', INK, 1.2);
    }
  }
  circle(ctx, 0, 0, r, pal.skin);
  // ear
  circle(ctx, -r * 0.2, r * 0.05, r * 0.22, shade(pal.skin, -0.1), INK, 1.6);
  // hair / scalp details
  if (ch === 'waiya') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = awakened ? '#f5f5f5' : '#141414';
    ctx.fillRect(-r, -r, r * 2, r * 0.75);
    ctx.fillRect(-r, -r, r * 0.7, r * 1.6);
    ctx.restore();
    // hairpin
    limb(ctx, [-r * 0.9, -r * 0.9], [-r * 0.1, -r * 0.5], 3, 3, GOLD, INK, 1);
    circle(ctx, -r * 0.95, -r * 0.95, 3.2, SEAL, INK, 1);
  } else if (ch === 'longxu') {
    if (youth || awakened) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = awakened ? '#f5f5f5' : '#151515';
      ctx.fillRect(-r, -r, r * 2, r * 0.7);
      ctx.restore();
      circle(ctx, -r * 0.2, -r * 1.05, r * 0.38, awakened ? '#f5f5f5' : '#151515');
    } else {
      // bald with a shine, long white eyebrows
      ctx.strokeStyle = rgba('#ffffff', 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-r * 0.1, -r * 0.2, r * 0.6, -2.4, -1.6);
      ctx.stroke();
      brushStroke(ctx, [[r * 0.1, -r * 0.42, 1], [r * 0.7, -r * 0.48, 1], [r * 1.25, -r * 0.2, 1]], 5, '#fafafa');
    }
  } else if (ch === 'jiugui') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = awakened ? '#f5f5f5' : '#7a7a7a';
    ctx.fillRect(-r, -r, r * 2, r * 0.6);
    ctx.restore();
    // stubble
    ctx.fillStyle = rgba('#3a3a3a', 0.4);
    for (let i = 0; i < 10; i++) ctx.fillRect(r * 0.1 + (i % 5) * r * 0.15, r * 0.45 + Math.floor(i / 5) * r * 0.15, 1.6, 1.6);
  } else if (ch === 'dazhong') {
    // bald monk with incense dots
    for (let i = 0; i < 6; i++) circle(ctx, -r * 0.4 + (i % 3) * r * 0.32, -r * 0.62 + Math.floor(i / 3) * r * 0.25, 1.8, '#5a3825', null, 0);
    if (awakened) circle(ctx, 0, -r * 1.05, r * 0.4, '#f5f5f5');
  }
  eyes(ctx, r * 0.45, -r * 0.12, r, face);
  // nose
  if (ch === 'jiugui') {
    const drunk = Math.min(5, f.char?.drunk || 0);
    circle(ctx, r * 0.98, r * 0.12, r * 0.24, shade('#d1495b', -0.05 * (5 - drunk)), INK, 1.6);
    circle(ctx, r * 0.35, r * 0.3, r * 0.16, rgba('#ff4d6d', 0.25 + drunk * 0.1), null, 0);
  } else {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(r * 0.92, -r * 0.05);
    ctx.lineTo(r * 1.08, r * 0.18);
    ctx.lineTo(r * 0.9, r * 0.22);
    ctx.stroke();
  }
  if (ch !== 'longxu' || youth) mouth(ctx, r * 0.62, r * 0.5, r, face);
  if (ch === 'waiya') {
    ctx.fillStyle = SEAL;
    ctx.beginPath();
    ctx.ellipse(r * 0.62, r * 0.5, r * 0.14, r * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roosterHead(ctx, r, pal, face) {
  // comb
  for (let i = 0; i < 3; i++) circle(ctx, -r * 0.4 + i * r * 0.42, -r * 1.0 - (i === 1 ? 4 : 0), r * 0.42, SEAL, INK, 1.8);
  circle(ctx, 0, 0, r, '#fdf0d5');
  // beak
  poly(ctx, [[r * 0.75, -r * 0.25], [r * 1.75, r * 0.05], [r * 0.75, r * 0.35]], '#f4b400', INK, 1.8);
  if (face === 'shout' || face === 'hurt') poly(ctx, [[r * 0.75, r * 0.25], [r * 1.5, r * 0.55], [r * 0.75, r * 0.5]], '#e09f00', INK, 1.6);
  // wattle
  ellipse(ctx, r * 0.85, r * 0.75, r * 0.22, r * 0.38, 0.2, SEAL, INK, 1.6);
  eyes(ctx, r * 0.35, -r * 0.15, r * 1.1, face);
}

function cowHead(ctx, r, pal, face, ch) {
  // horns
  limb(ctx, [-r * 0.1, -r * 0.8], [-r * 0.35, -r * 1.55], 7, 3, '#efe3c4', INK, 1.8);
  limb(ctx, [r * 0.3, -r * 0.8], [r * 0.55, -r * 1.55], 7, 3, '#efe3c4', INK, 1.8);
  // ears
  ellipse(ctx, -r * 0.85, -r * 0.35, r * 0.45, r * 0.22, -0.4, pal.skin, INK, 1.8);
  circle(ctx, 0, 0, r, pal.skin);
  ellipse(ctx, -r * 0.3, -r * 0.4, r * 0.4, r * 0.32, 0.3, pal.c2, null, 0);
  // muzzle
  ellipse(ctx, r * 0.75, r * 0.35, r * 0.62, r * 0.48, 0, '#f6b8c0', INK, 2);
  circle(ctx, r * 0.95, r * 0.3, r * 0.08, INK, null, 0);
  circle(ctx, r * 0.6, r * 0.32, r * 0.08, INK, null, 0);
  eyes(ctx, r * 0.25, -r * 0.2, r, face);
  // flower behind the ear
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    circle(ctx, -r * 0.45 + Math.cos(a) * 4, -r * 0.85 + Math.sin(a) * 4, 3.5, '#ff7aa2', INK, 1);
  }
  circle(ctx, -r * 0.45, -r * 0.85, 2.5, GOLD, null, 0);
  // cowbell at the neck
  poly(ctx, [[-r * 0.1, r * 1.05], [r * 0.4, r * 1.05], [r * 0.55, r * 1.55], [-r * 0.25, r * 1.55]], GOLD, INK, 1.8);
}

function pigHead(ctx, r, pal, face) {
  poly(ctx, [[-r * 0.7, -r * 0.55], [-r * 0.45, -r * 1.2], [-r * 0.05, -r * 0.75]], shade(pal.skin, -0.1), INK, 1.8);
  circle(ctx, 0, 0, r, pal.skin);
  poly(ctx, [[r * 0.05, -r * 0.8], [r * 0.4, -r * 1.25], [r * 0.6, -r * 0.6]], shade(pal.skin, -0.1), INK, 1.8);
  // headband
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = pal.c2;
  ctx.fillRect(-r, -r * 0.7, r * 2, r * 0.3);
  ctx.restore();
  limb(ctx, [-r * 0.9, -r * 0.55], [-r * 1.7, -r * 0.1], 5, 3, pal.c2, INK, 1.2);
  // snout
  ellipse(ctx, r * 1.0, r * 0.25, r * 0.32, r * 0.4, 0, shade(pal.skin, -0.12), INK, 2);
  circle(ctx, r * 1.05, r * 0.12, 2.2, INK, null, 0);
  circle(ctx, r * 1.05, r * 0.38, 2.2, INK, null, 0);
  eyes(ctx, r * 0.35, -r * 0.2, r, face);
  mouth(ctx, r * 0.55, r * 0.65, r * 0.8, face);
}

function goatHead(ctx, r, pal, face) {
  // horns curling back
  ctx.strokeStyle = INK;
  brushStroke(ctx, [[0, -r * 0.7, 1], [-r * 0.6, -r * 1.4, 1], [-r * 1.4, -r * 1.2, 1], [-r * 1.5, -r * 0.5, 0.6]], 9, '#8d7b68', false);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.7);
  ctx.quadraticCurveTo(-r * 1.0, -r * 1.7, -r * 1.5, -r * 0.5);
  ctx.stroke();
  ellipse(ctx, -r * 0.9, -r * 0.1, r * 0.5, r * 0.2, 0.3, pal.skin, INK, 1.8);
  // long face
  ellipse(ctx, r * 0.2, r * 0.1, r * 1.1, r * 0.85, 0.35, pal.skin);
  circle(ctx, r * 1.05, r * 0.45, 2, INK, null, 0);
  eyes(ctx, r * 0.15, -r * 0.2, r, face);
  if (face === 'shout') ellipse(ctx, r * 0.9, r * 0.75, r * 0.25, r * 0.22, 0, '#5a0d12', INK, 1.5);
}

function drawHeadgear(ctx, r, head, sp, pal) {
  if (!head || head === 'none') return;
  const top = sp === 'rooster' ? -r * 1.35 : -r * 0.85;
  switch (head) {
    case 'strawHat':
      poly(ctx, [[-r * 1.9, top + 4], [0, top - r * 0.9], [r * 1.9, top + 4]], '#e9c46a', INK, 2);
      break;
    case 'riceHat':
      poly(ctx, [[-r * 1.5, top + 2], [0, top - r * 1.3], [r * 1.5, top + 2]], '#d4a373', INK, 2);
      break;
    case 'topknot':
      circle(ctx, -r * 0.1, top - r * 0.2, r * 0.4, '#151515');
      break;
    case 'bandana':
      limb(ctx, [-r, top + r * 0.35], [r * 0.95, top + r * 0.3], 7, 7, SEAL, INK, 1.6);
      limb(ctx, [-r, top + r * 0.35], [-r * 1.8, top + r * 0.9], 5, 2, SEAL, INK, 1.2);
      break;
    case 'monkBeads':
      for (let i = 0; i < 7; i++) circle(ctx, -r * 0.6 + i * r * 0.2, r * 1.1 + Math.sin(i / 2) * 3, 3.5, '#5a3825', INK, 1);
      break;
    case 'scholarHat':
      poly(ctx, [[-r * 0.8, top + 6], [-r * 0.7, top - r * 0.6], [r * 0.7, top - r * 0.6], [r * 0.8, top + 6]], '#1b1b1b', INK, 1.6);
      limb(ctx, [-r * 0.7, top - r * 0.3], [-r * 1.7, top - r * 0.3], 4, 4, '#1b1b1b', INK, 1);
      limb(ctx, [r * 0.7, top - r * 0.3], [r * 1.7, top - r * 0.3], 4, 4, '#1b1b1b', INK, 1);
      break;
    case 'chopsticks':
      circle(ctx, -r * 0.1, top - r * 0.15, r * 0.4, '#151515');
      limb(ctx, [-r * 0.9, top - r * 0.7], [r * 0.7, top + r * 0.2], 3, 3, '#b5651d', INK, 1);
      limb(ctx, [-r * 0.7, top + r * 0.3], [r * 0.8, top - r * 0.6], 3, 3, '#b5651d', INK, 1);
      break;
    case 'teacup':
      poly(ctx, [[-r * 0.6, top - r * 0.7], [r * 0.6, top - r * 0.7], [r * 0.4, top + 2], [-r * 0.4, top + 2]], '#f1faee', INK, 1.8);
      ctx.strokeStyle = '#1d3557';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-r * 0.35, top - r * 0.45, r * 0.7, r * 0.15);
      break;
    case 'bucket':
      poly(ctx, [[-r * 0.85, top + 8], [-r * 0.6, top - r * 0.9], [r * 0.6, top - r * 0.9], [r * 0.85, top + 8]], '#8d99ae', INK, 2);
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(-r * 0.78, top - r * 0.2);
      ctx.lineTo(r * 0.78, top - r * 0.2);
      ctx.stroke();
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------------------------
// Accessories

function drawBeard(ctx, J, prop, f, ex) {
  const youth = hasBuffView(f, 'youth');
  const [hx, hy] = J.head;
  const r = prop.head;
  const a = (J.headAng * Math.PI) / 180;
  const chin = [hx + Math.sin(a) * r * 0.4 + Math.cos(a) * r * 0.55, hy - Math.cos(a) * r * 0.4 * -1 + Math.sin(a) * r * 0.55];
  let len = youth ? 26 : 70;
  let dirX = 0.35;
  let dirY = 1;
  const id = f.move?.id;
  const fr = f.move?.f || 0;
  if (id === 'beardLash' && fr >= 10) {
    len = fr <= 26 ? 330 : 330 - (fr - 26) * 14;
    dirX = 1;
    dirY = 0.08;
  } else if (id === 'hairNet' && fr >= 5) {
    len = 220;
    dirX = 0.6;
    dirY = -1;
  } else if (id === 'whiskerCopter') {
    len = 110;
    const sp = fr * 0.9;
    dirX = Math.cos(sp);
    dirY = Math.sin(sp) * 0.4;
  } else if (id === 'tempest' && fr >= 4) {
    len = 300 + Math.sin(fr * 0.4) * 80;
    dirX = Math.cos(fr * 0.35);
    dirY = Math.sin(fr * 0.35);
  }
  const t = (ex.t || 0) / 10;
  const L = Math.max(20, len);
  const n = 9;
  const pts = [];
  const nd = Math.hypot(dirX, dirY) || 1;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const sway = Math.sin(t + k * 3) * 6 * k;
    pts.push([chin[0] + (dirX / nd) * L * k + sway * (dirY / nd), chin[1] + (dirY / nd) * L * k - sway * (dirX / nd), 1 - k * 0.6]);
  }
  ctx.save();
  brushStroke(ctx, pts, youth ? 10 : 22, youth ? '#1b1b1b' : f.awakened > 0 ? '#ffffff' : '#f4f1ea', false);
  ctx.strokeStyle = rgba('#000000', 0.35);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) ctx.lineTo(p[0] + 3, p[1]);
  ctx.stroke();
  // moustache
  brushStroke(ctx, [[chin[0] - 4, chin[1] - 6, 1], [chin[0] + 14, chin[1] - 4, 1], [chin[0] + 26, chin[1] + 12, 0.5]], 7, youth ? '#1b1b1b' : '#f4f1ea');
  ctx.restore();
}

function drawGoatBeard(ctx, J, prop) {
  const [hx, hy] = J.head;
  const a = (J.headAng * Math.PI) / 180;
  const r = prop.head;
  const cx = hx + Math.cos(a) * r * 0.9 - Math.sin(a) * -r * 0.6;
  const cy = hy + Math.sin(a) * r * 0.9 + Math.cos(a) * r * 0.6;
  poly(ctx, [[cx - 5, cy], [cx + 5, cy], [cx + 1, cy + 22]], '#d6ccc2', INK, 1.6);
}

function drawGourd(ctx, J, pal, back) {
  const h = J.hip;
  if (back) return;
  const x = h[0] - 18;
  const y = h[1] + 6;
  circle(ctx, x, y + 10, 10, '#c98b2b', INK, 2);
  circle(ctx, x, y - 4, 6.5, '#c98b2b', INK, 2);
  limb(ctx, [x, y - 10], [x, y - 14], 3, 3, SEAL, INK, 1);
}

function drawSwordSheath(ctx, J) {
  const c = J.chest;
  const h = J.hip;
  limb(ctx, [c[0] - 22, c[1] - 14], [h[0] - 34, h[1] + 30], 6, 6, '#3a2a1a', INK, 1.8);
  limb(ctx, [c[0] - 22, c[1] - 14], [c[0] - 30, c[1] - 26], 4, 4, GOLD, INK, 1.2);
}

function drawRoosterTail(ctx, J, pal, t = 0) {
  const h = J.hip;
  const cols = ['#1b4332', '#2b2d42', '#1b4332', '#081c15', pal.c1];
  for (let i = 0; i < 5; i++) {
    const a = -2.0 - i * 0.22 + Math.sin(t / 15 + i) * 0.04;
    const l = 70 - i * 6;
    brushStroke(ctx, [[h[0] - 10, h[1] - 10, 1], [h[0] - 10 + Math.cos(a) * l * 0.6, h[1] - 10 + Math.sin(a) * l * 0.9, 1], [h[0] - 10 + Math.cos(a + 0.5) * l, h[1] - 10 + Math.sin(a + 0.6) * l * 0.5, 0.4]], 11, cols[i]);
  }
}

function drawTail(ctx, J, pal, tuft, t = 0, len = 40) {
  const h = J.hip;
  const sw = Math.sin(t / 12) * 8;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(h[0] - 18, h[1]);
  ctx.quadraticCurveTo(h[0] - 30, h[1] + len * 0.4, h[0] - 28 + sw, h[1] + len);
  ctx.stroke();
  ellipse(ctx, h[0] - 28 + sw, h[1] + len, 5, 8, 0, tuft, INK, 1.4);
}

function drawCurlyTail(ctx, J, pal) {
  const h = J.hip;
  ctx.strokeStyle = shade(pal.skin, -0.25);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const a = i * 0.6;
    const r = 3 + i * 0.4;
    const x = h[0] - 26 - Math.cos(a) * r;
    const y = h[1] - 6 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawEgg(ctx, f, ex) {
  const t = (ex.t || 0) / 6;
  const wob = Math.sin(t) * 0.12;
  ctx.save();
  ctx.translate(0, -2);
  ctx.rotate(wob);
  ellipse(ctx, 0, -42, 32, 42, 0, '#fffaf0', INK, 3);
  // cracks grow as the egg is damaged
  const dmg = 1 - Math.max(0, (f.char?.eggHp ?? 150) / 150);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, -50);
  ctx.lineTo(-8, -40 - dmg * 10);
  ctx.lineTo(2, -52);
  if (dmg > 0.3) ctx.lineTo(12, -38);
  if (dmg > 0.6) ctx.lineTo(24, -48);
  ctx.stroke();
  // comb poking out
  circle(ctx, 0, -86, 7, SEAL, INK, 1.6);
  ctx.restore();
}

function drawBronzeBell(ctx, f, J, pal) {
  const shine = Math.sin((f.move?.f || 0) * 0.5) * 0.15;
  poly(ctx, [[-52, 0], [-40, -40], [-34, -120], [-14, -150], [14, -150], [34, -120], [40, -40], [52, 0]], shade('#b08d57', shine), INK, 3);
  ctx.strokeStyle = shade('#6f4e37', 0);
  ctx.lineWidth = 3;
  for (const y of [-30, -100]) {
    ctx.beginPath();
    ctx.moveTo(-44, y);
    ctx.lineTo(44, y);
    ctx.stroke();
  }
  limb(ctx, [-10, -150], [10, -150], 8, 8, '#6f4e37', INK, 2);
  ctx.fillStyle = INK;
  ctx.font = 'bold 34px "KaiTi", "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.fillText('鐘', 0, -55);
}

// ---------------------------------------------------------------------------------------------
// Portraits: draws just the head, big, for HUD, select screen and cut-ins.

export function drawPortrait(ctx, charId, cos, x, y, size, face = 'fierce', flip = false) {
  const sp = speciesOf(charId);
  const prop = PROPORTIONS[sp];
  const r = prop.head;
  const scale = size / (r * 2.6);
  const pal = { c1: cos?.c1 || '#ddd', c2: cos?.c2 || '#333', skin: SKIN[charId] };
  pal.dark1 = shade(pal.c1, -0.25);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -scale : scale, scale);
  const fake = { charId, st: face === 'ko' ? 'ko' : 'idle', char: { drunk: 3 }, buffs: [], status: {}, awakened: 0 };
  // shoulders
  ellipse(ctx, -r * 0.2, r * 1.9, r * 1.5, r * 0.9, 0, sp === 'human' ? pal.c1 : sp === 'goat' ? pal.c2 : pal.skin);
  switch (sp) {
    case 'human': humanHead(ctx, r, pal, charId, fake, face, {}); break;
    case 'rooster': roosterHead(ctx, r, pal, face); break;
    case 'cow': cowHead(ctx, r, pal, face, charId); break;
    case 'pig': pigHead(ctx, r, pal, face); break;
    case 'goat': goatHead(ctx, r, pal, face); break;
    default: break;
  }
  if (charId === 'longxu') {
    brushStroke(ctx, [[r * 0.4, r * 0.6, 1], [r * 0.5, r * 1.4, 1], [r * 0.3, r * 2.4, 0.4]], 18, '#f4f1ea', false);
  }
  if (charId === 'shanyang') poly(ctx, [[r * 0.85, r * 0.85], [r * 1.25, r * 0.85], [r * 1.0, r * 1.7]], '#d6ccc2', INK, 1.6);
  drawHeadgear(ctx, r, cos?.head, sp, pal);
  ctx.restore();
}

// Flame aura behind a fighter (awakening, full chi, ultras).
export function drawAura(ctx, color, t, intensity = 1, height = 190) {
  const col = color === 'rainbow' ? `hsl(${(t * 4) % 360},90%,60%)` : color;
  ctx.save();
  ctx.globalAlpha = 0.35 * intensity;
  for (let i = 0; i < 7; i++) {
    const x = -42 + i * 14;
    const h = height * (0.6 + 0.4 * Math.abs(Math.sin(t * 0.2 + i * 1.7)));
    const w = 18 + Math.sin(t * 0.3 + i) * 4;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, 0);
    ctx.quadraticCurveTo(x - w, -h * 0.5, x + Math.sin(t * 0.25 + i) * 10, -h);
    ctx.quadraticCurveTo(x + w, -h * 0.5, x + w / 2, 0);
    ctx.fill();
  }
  ctx.restore();
}


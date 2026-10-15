// Heads-up display: health, guard, chi, timer, round seals, status icons, combo counter.

import { RULES, comboTier, COMBO_TITLES } from '../data/rules.js';
import { getChar } from '../data/registry.js';
import { HEAVENLY_EVENTS } from '../data/heavenlyEvents.js';
import { INK, PAPER, SEAL, GOLD, brushText, seal, setFont, FONT_DISPLAY, FONT_UI, FONT_CJK, rgba, limb } from './brush.js';
import { drawPortrait } from './skins.js';
import { VIEW_W } from './camera.js';

const BAR_W = 470;
const BAR_H = 24;

export function createHudState() {
  return { trail: [1, 1], shown: [1, 1], combo: [null, null], bite: [0, 0], chiFull: [false, false] };
}

function hasBuff(f, id) {
  return f.buffs?.some((b) => b.id === id);
}

export function drawHud(ctx, v, hs, opts = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const t = opts.t || 0;
  for (const f of v.fighters) drawSide(ctx, v, f, hs, t, opts);
  drawTimer(ctx, v, t);
  drawHeavenly(ctx, v, t);
  drawCombos(ctx, v, hs, t);
  if (opts.ping != null) {
    setFont(ctx, 14, FONT_UI);
    ctx.textAlign = 'center';
    ctx.fillStyle = rgba('#16120f', 0.7);
    ctx.fillText(`LAN ${opts.ping} ms${opts.spectating ? ' · spectating' : ''}`, VIEW_W / 2, 132);
  }
}

function drawSide(ctx, v, f, hs, t, opts) {
  const left = f.side === 0;
  const x0 = left ? 96 : VIEW_W - 96 - BAR_W;
  const y0 = 26;
  const ch = getChar(f.charId);
  const cos = opts.cos?.[f.side];
  const hpK = Math.max(0, f.hp / f.maxHp);
  // smooth trail
  hs.shown[f.side] += (hpK - hs.shown[f.side]) * 0.5;
  if (hs.trail[f.side] < hs.shown[f.side]) hs.trail[f.side] = hs.shown[f.side];
  else hs.trail[f.side] -= Math.min(0.006, hs.trail[f.side] - hs.shown[f.side]);

  // portrait medallion
  const px = left ? 50 : VIEW_W - 50;
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, 50, 40, 0, Math.PI * 2);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.clip();
  drawPortrait(ctx, f.charId, cos, px, 56, 82, f.hp <= 0 ? 'ko' : hpK < 0.25 ? 'hurt' : 'fierce', !left);
  ctx.restore();

  // bar frame (brush style)
  ctx.save();
  ctx.fillStyle = rgba('#16120f', 0.85);
  ctx.beginPath();
  ctx.moveTo(x0 - 6, y0 - 6);
  ctx.lineTo(x0 + BAR_W + 8, y0 - 4);
  ctx.lineTo(x0 + BAR_W + 4, y0 + BAR_H + 6);
  ctx.lineTo(x0 - 8, y0 + BAR_H + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5c4033';
  ctx.fillRect(x0, y0, BAR_W, BAR_H);
  // damage trail
  const tw = BAR_W * hs.trail[f.side];
  ctx.fillStyle = '#ffd166';
  if (left) ctx.fillRect(x0 + BAR_W - tw, y0, tw, BAR_H);
  else ctx.fillRect(x0, y0, tw, BAR_H);
  // health
  const hw = BAR_W * hs.shown[f.side];
  const g = ctx.createLinearGradient(0, y0, 0, y0 + BAR_H);
  const low = hpK < 0.25;
  g.addColorStop(0, low ? '#ff6b6b' : '#e85d04');
  g.addColorStop(1, low ? '#c1121f' : '#9d0208');
  ctx.fillStyle = g;
  if (left) ctx.fillRect(x0 + BAR_W - hw, y0, hw, BAR_H);
  else ctx.fillRect(x0, y0, hw, BAR_H);
  if (low && Math.floor(t / 8) % 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x0, y0, BAR_W, BAR_H);
  }
  // ink texture streaks
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < 6; i++) ctx.fillRect(x0, y0 + 3 + i * 3.5, BAR_W, 1);
  ctx.restore();

  // guard bar
  const gk = Math.max(0, f.guard / f.guardMax);
  ctx.fillStyle = rgba('#16120f', 0.6);
  ctx.fillRect(x0, y0 + BAR_H + 7, BAR_W, 6);
  ctx.fillStyle = gk < 0.3 ? '#e63946' : '#a8dadc';
  const gw = BAR_W * gk;
  if (left) ctx.fillRect(x0 + BAR_W - gw, y0 + BAR_H + 7, gw, 6);
  else ctx.fillRect(x0, y0 + BAR_H + 7, gw, 6);

  // name
  setFont(ctx, 20, FONT_DISPLAY);
  ctx.textAlign = left ? 'left' : 'right';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 4;
  ctx.strokeStyle = PAPER;
  const nm = `${ch.short.toUpperCase()}`;
  ctx.strokeText(nm, left ? x0 : x0 + BAR_W, y0 + BAR_H + 16);
  ctx.fillStyle = INK;
  ctx.fillText(nm, left ? x0 : x0 + BAR_W, y0 + BAR_H + 16);
  setFont(ctx, 20, FONT_CJK, 'bold');
  const nmW = (ctx.measureText ? 0 : 0);
  void nmW;

  // round win seals
  for (let i = 0; i < (v.cfg?.wins || 2); i++) {
    const sx = left ? x0 + BAR_W - 18 - i * 30 : x0 + 18 + i * 30;
    if (i < v.wins[f.side]) seal(ctx, sx, y0 + BAR_H + 30, 24, '勝');
    else {
      ctx.strokeStyle = rgba('#16120f', 0.5);
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 10, y0 + BAR_H + 20, 20, 20);
    }
  }

  // status icons
  const icons = [];
  if (f.awakened > 0) icons.push(['覺醒', '#ff4d6d']);
  if (f.char?.drunk) icons.push([`醉${f.char.drunk}`, '#9d0208']);
  if (hasBuff(f, 'eggLife')) icons.push(['蛋', GOLD]);
  if (hasBuff(f, 'youth')) icons.push(['春', '#2d6a4f']);
  if (hasBuff(f, 'lastCall')) icons.push(['杯', '#9d0208']);
  if (hasBuff(f, 'banquet')) icons.push(['宴', '#e85d04']);
  if (hasBuff(f, 'inkClone')) icons.push(['墨', INK]);
  if (hasBuff(f, 'chilli')) icons.push(['辣', '#d00000']);
  if (f.status?.poison) icons.push([`毒${f.status.poison.stacks}`, '#2d6a4f']);
  if (f.status?.doom) icons.push(['斷魂', '#6a040f']);
  if (f.status?.slow) icons.push(['泥', '#7f5539']);
  if (f.charId === 'moolan') icons.push([`胃${4 - (f.char?.cud || 0)}`, '#264653']);
  icons.forEach(([txt, col], i) => {
    const ix = left ? x0 + 160 + i * 48 : x0 + BAR_W - 160 - i * 48;
    ctx.fillStyle = rgba('#f3ead7', 0.85);
    ctx.fillRect(ix - 20, y0 + BAR_H + 15, 40, 22);
    setFont(ctx, txt.length > 1 ? 13 : 18, FONT_CJK, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.fillText(txt, ix, y0 + BAR_H + 26);
  });

  // chi meter (bottom)
  const cy = 676;
  const cw = 300;
  const cx0 = left ? 36 : VIEW_W - 36 - cw;
  const seg = cw / 3;
  ctx.fillStyle = rgba('#16120f', 0.8);
  ctx.fillRect(cx0 - 4, cy - 4, cw + 8, 22);
  const full = Math.floor(f.chi / RULES.CHI_BAR);
  for (let i = 0; i < 3; i++) {
    const k = Math.max(0, Math.min(1, (f.chi - i * RULES.CHI_BAR) / RULES.CHI_BAR));
    const sx = left ? cx0 + i * seg : cx0 + cw - (i + 1) * seg;
    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(sx + 2, cy, seg - 4, 14);
    const glow = k >= 1 ? (Math.sin(t / 6 + i) + 1) / 2 : 0;
    ctx.fillStyle = k >= 1 ? `rgb(${77 + glow * 120},${210 + glow * 40},255)` : '#4dabf7';
    const w = (seg - 4) * k;
    if (left) ctx.fillRect(sx + 2, cy, w, 14);
    else ctx.fillRect(sx + 2 + (seg - 4) - w, cy, w, 14);
  }
  seal(ctx, left ? cx0 + cw + 26 : cx0 - 26, cy + 6, 34, String(full), full >= 3 ? SEAL : '#264653');
  const ultraCost = f.awakened > 0 ? RULES.COST_ULTRA_AWAKENED : RULES.COST_ULTRA;
  if (f.chi >= ultraCost) {
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t / 5);
    brushText(ctx, '極  ULTRA READY', left ? cx0 + cw / 2 : cx0 + cw / 2, cy - 18, 20, SEAL, { outline: 4, family: FONT_DISPLAY });
    ctx.restore();
  }
  // goat bite marks
  if (hs.bite[f.side] > 0) {
    hs.bite[f.side]--;
    const bx = left ? x0 + 60 : x0 + BAR_W - 60;
    ctx.fillStyle = PAPER;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(bx + i * 14 - 21, y0 + BAR_H, 8, Math.PI, 0);
      ctx.fill();
    }
  }
}

function drawTimer(ctx, v, t) {
  const x = VIEW_W / 2;
  const y = 54;
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const txt = v.cfg?.training ? '∞' : String(Math.max(0, v.timer)).padStart(2, '0');
  const urgent = !v.cfg?.training && v.timer <= 10 && v.phase === 'fight';
  brushText(ctx, txt, x, y + 2, 48, urgent && Math.floor(t / 10) % 2 ? SEAL : INK, { family: FONT_DISPLAY });
  setFont(ctx, 13, FONT_UI, 'bold');
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.fillText(v.suddenDeath ? 'SUDDEN DEATH' : `ROUND ${v.round}`, x, y + 56);
  ctx.restore();
}

function drawHeavenly(ctx, v, t) {
  const ev = v.heavenly;
  if (!ev) return;
  const def = HEAVENLY_EVENTS[ev.id];
  if (!def) return;
  const x = VIEW_W / 2;
  const y = 150;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#efe6cf';
  ctx.fillRect(x - 150, y - 18, 300, 36);
  limb(ctx, [x - 158, y - 22], [x - 158, y + 22], 10, 10, '#7f5539', INK, 1.5);
  limb(ctx, [x + 158, y - 22], [x + 158, y + 22], 10, 10, '#7f5539', INK, 1.5);
  seal(ctx, x - 120, y, 28, def.glyph);
  setFont(ctx, 17, FONT_DISPLAY);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(def.name.toUpperCase(), x - 96, y + 1);
  if (!ev.forced && ev.t < 600) {
    ctx.fillStyle = SEAL;
    ctx.fillRect(x - 96, y + 12, 236 * (ev.t / 600), 3);
  }
  ctx.restore();
}

function drawCombos(ctx, v, hs, t) {
  for (const side of [0, 1]) {
    const victim = v.fighters[1 - side];
    const n = victim.combo?.n || 0;
    if (n >= 2) hs.combo[side] = { n, dmg: victim.combo.dmg, t: 70 };
    const c = hs.combo[side];
    if (!c) continue;
    if (n < 2) c.t--;
    if (c.t <= 0) {
      hs.combo[side] = null;
      continue;
    }
    const left = side === 0;
    const x = left ? 150 : VIEW_W - 150;
    const y = 250;
    const tier = comboTier(c.n);
    const size = 52 * (1 + tier * 0.1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.t / 20);
    const shake = tier >= 3 ? (Math.random() - 0.5) * tier : 0;
    const color = tier >= 8 ? `hsl(${(t * 10) % 360},90%,45%)` : tier >= 5 ? GOLD : tier >= 3 ? SEAL : INK;
    brushText(ctx, `${c.n}`, x + shake, y + shake, size, color, { outline: 8, family: FONT_DISPLAY });
    setFont(ctx, 20, FONT_DISPLAY);
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = PAPER;
    ctx.strokeText('HITS', x, y + size * 0.62);
    ctx.fillStyle = INK;
    ctx.fillText('HITS', x, y + size * 0.62);
    if (tier > 0) {
      const title = COMBO_TITLES[tier - 1];
      brushText(ctx, title.glyph, x, y - size * 0.95, 46 + tier * 3, color, { outline: 6 });
      setFont(ctx, Math.min(22, 14 + tier), FONT_DISPLAY);
      ctx.strokeText(title.text, x, y + size * 0.62 + 26);
      ctx.fillStyle = color;
      ctx.fillText(title.text, x, y + size * 0.62 + 26);
    }
    setFont(ctx, 15, FONT_UI, 'bold');
    ctx.fillStyle = INK;
    ctx.fillText(`${c.dmg} dmg`, x, y + size * 0.62 + 48);
    ctx.restore();
  }
}

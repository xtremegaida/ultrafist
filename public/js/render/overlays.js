// Big-moment overlays: ultra cut-ins, cinematic backdrops, clash tug-of-war, KO finishes.

import { getMove } from '../data/registry.js';
import { RULES } from '../data/rules.js';
import { INK, PAPER, SEAL, GOLD, brushText, seal, setFont, FONT_DISPLAY, FONT_UI, rgba, brushStroke, circle } from './brush.js';
import { drawPortrait } from './skins.js';
import { drawStar } from './fx.js';
import { VIEW_W, VIEW_H } from './camera.js';

// Darken + ink band + portrait + calligraphy name while the super freeze is active.
export function drawCutIn(ctx, v, cosOf) {
  const fr = v.freeze;
  if (!fr) return;
  const T = RULES.SUPER_FREEZE;
  const age = T - fr.t;
  const k = Math.min(1, age / 10);
  const out = fr.t < 10 ? fr.t / 10 : 1;
  const left = fr.by === 0;
  const def = getMove(fr.id);
  const f = v.fighters[fr.by];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.globalAlpha = 0.55 * out;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = out;
  // red sun
  ctx.fillStyle = SEAL;
  ctx.beginPath();
  ctx.arc(left ? VIEW_W * 0.68 : VIEW_W * 0.32, VIEW_H * 0.42, 150 * k, 0, Math.PI * 2);
  ctx.fill();
  // diagonal ink band
  ctx.save();
  ctx.translate(VIEW_W / 2, VIEW_H / 2);
  ctx.rotate(left ? -0.12 : 0.12);
  const slide = (1 - k) * VIEW_W * (left ? -1 : 1);
  ctx.translate(slide, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(-VIEW_W, -95, VIEW_W * 2, 190);
  brushStroke(ctx, [[-VIEW_W, -95, 1], [0, -100, 1], [VIEW_W, -95, 1]], 14, INK, false);
  brushStroke(ctx, [[-VIEW_W, 95, 1], [0, 100, 1], [VIEW_W, 95, 1]], 14, INK, false);
  // eyes close-up portrait
  ctx.save();
  ctx.beginPath();
  ctx.rect(-VIEW_W, -88, VIEW_W * 2, 176);
  ctx.clip();
  drawPortrait(ctx, f.charId, cosOf(fr.by), left ? -330 : 330, 70, 420, 'shout', !left);
  ctx.restore();
  ctx.restore();
  // calligraphy name
  const nameX = left ? VIEW_W * 0.62 : VIEW_W * 0.38;
  brushText(ctx, def?.glyph || '極', nameX, VIEW_H * 0.42, 120 - (def?.glyph?.length || 1) * 12, INK, { outline: 10, outlineColor: PAPER });
  setFont(ctx, 30, FONT_DISPLAY);
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = PAPER;
  const nm = (def?.name || 'ULTRA').toUpperCase();
  ctx.strokeText(nm, nameX, VIEW_H * 0.42 + 92);
  ctx.fillStyle = SEAL;
  ctx.fillText(nm, nameX, VIEW_H * 0.42 + 92);
  seal(ctx, nameX + (left ? 230 : -230), VIEW_H * 0.42 - 40, 70, '極');
  ctx.restore();
}

// Cinematic backdrop for scripted ultras (drawn in screen space before the fighters).
export function drawCineBackdrop(ctx, v, t) {
  const c = v.cine;
  if (!c) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const k = Math.min(1, c.t / 12);
  ctx.save();
  ctx.globalAlpha = 0.9 * k;
  switch (c.bg) {
    case 'moon': {
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, '#03045e');
      g.addColorStop(1, '#0077b6');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 80; i++) circle(ctx, (i * 197) % VIEW_W, (i * 89) % VIEW_H, 1.5, '#fff', null, 0);
      circle(ctx, VIEW_W / 2, VIEW_H * 0.45, 230, '#fff3c4', null, 0);
      circle(ctx, VIEW_W / 2 - 60, VIEW_H * 0.4, 40, 'rgba(200,180,140,0.4)', null, 0);
      circle(ctx, VIEW_W / 2 + 80, VIEW_H * 0.55, 28, 'rgba(200,180,140,0.35)', null, 0);
      brushText(ctx, '月', VIEW_W / 2, VIEW_H * 0.45, 200, rgba('#16120f', 0.15), { dry: false });
      break;
    }
    case 'space': {
      ctx.fillStyle = '#03071e';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 120; i++) circle(ctx, (i * 211 + c.t * (i % 3)) % VIEW_W, (i * 97) % VIEW_H, 1.2 + (i % 3) * 0.5, '#fff', null, 0);
      ctx.fillStyle = '#2a9d8f';
      ctx.beginPath();
      ctx.arc(VIEW_W / 2, VIEW_H + 900 - Math.min(400, c.t * 4), 1000, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9c46a';
      ctx.beginPath();
      ctx.arc(VIEW_W / 2 - 200, VIEW_H + 900 - Math.min(400, c.t * 4) - 960, 140, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'chambers': {
      ctx.fillStyle = '#6f1d1b';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const off = (c.t * 26) % 180;
      for (let y = -180; y < VIEW_H + 180; y += 180) {
        ctx.fillStyle = '#432818';
        ctx.fillRect(0, y + off, VIEW_W, 26);
        ctx.fillStyle = '#bb9457';
        for (let x = 40; x < VIEW_W; x += 160) ctx.fillRect(x, y + off - 140, 40, 140);
      }
      const floor = Math.min(36, Math.floor(c.t / 4.2) + 1);
      brushText(ctx, `第${floor}房`, VIEW_W * 0.82, VIEW_H * 0.3, 90, GOLD, { outline: 8, outlineColor: INK });
      break;
    }
    case 'cliff': {
      ctx.fillStyle = '#adb5bd';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const off = (c.t * 18) % 240;
      ctx.fillStyle = '#6c757d';
      for (let y = -240; y < VIEW_H + 240; y += 240) {
        ctx.beginPath();
        ctx.moveTo(VIEW_W * 0.55, y + off);
        ctx.lineTo(VIEW_W * 0.7, y + off + 120);
        ctx.lineTo(VIEW_W * 0.6, y + off + 240);
        ctx.lineTo(VIEW_W, y + off + 240);
        ctx.lineTo(VIEW_W, y + off);
        ctx.fill();
      }
      brushText(ctx, '登', VIEW_W * 0.2, VIEW_H * 0.3, 160, rgba('#16120f', 0.25), { dry: false });
      break;
    }
    case 'sun': {
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 40, VIEW_W / 2, VIEW_H / 2, 700);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(0.4, '#ffb703');
      g.addColorStop(1, '#d00000');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + c.t * 0.02;
        brushStroke(ctx, [[VIEW_W / 2 + Math.cos(a) * 120, VIEW_H / 2 + Math.sin(a) * 120, 1], [VIEW_W / 2 + Math.cos(a) * 900, VIEW_H / 2 + Math.sin(a) * 900, 1]], 30, 'rgba(255,255,255,0.25)');
      }
      break;
    }
    case 'wires': {
      ctx.fillStyle = '#212529';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 3; i++) {
        const g = ctx.createRadialGradient(300 + i * 340, 0, 10, 300 + i * 340, 500, 400);
        g.addColorStop(0, 'rgba(255,240,200,0.45)');
        g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      setFont(ctx, 22, FONT_DISPLAY);
      ctx.fillStyle = rgba('#ffffff', 0.6);
      ctx.textAlign = 'center';
      ctx.fillText('★ STAGEHANDS UNION LOCAL 108 ★', VIEW_W / 2, 60);
      break;
    }
    default:
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.restore();
}

// Wires to the ceiling during the stagehand cinematic (world space, called with camera applied).
export function drawCineWorld(ctx, v) {
  const c = v.cine;
  if (!c || c.bg !== 'wires') return;
  const D = v.fighters[1 - c.by];
  ctx.strokeStyle = rgba('#ffffff', 0.8);
  ctx.lineWidth = 1.5;
  for (const dx of [-20, 0, 20]) {
    ctx.beginPath();
    ctx.moveTo(D.x + dx, D.y - 130);
    ctx.lineTo(D.x + dx * 3, D.y - 1400);
    ctx.stroke();
  }
}

export function drawClash(ctx, v, t) {
  const c = v.clash;
  if (!c) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  const k = c.tug / RULES.CLASH.tugMax;
  // diagonal split tint
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#4dabf7';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(VIEW_W / 2 + k * 300 + 80, 0);
  ctx.lineTo(VIEW_W / 2 + k * 300 - 80, VIEW_H);
  ctx.lineTo(0, VIEW_H);
  ctx.fill();
  ctx.fillStyle = '#ff4d6d';
  ctx.beginPath();
  ctx.moveTo(VIEW_W, 0);
  ctx.lineTo(VIEW_W / 2 + k * 300 + 80, 0);
  ctx.lineTo(VIEW_W / 2 + k * 300 - 80, VIEW_H);
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.fill();
  ctx.globalAlpha = 1;
  const glyph = c.kind === 'beam' ? '氣' : c.kind === 'ultra' ? '天裂' : '掌';
  brushText(ctx, glyph, VIEW_W / 2, 200, 130, INK, { outline: 10 });
  const name = c.kind === 'beam' ? 'BEAM STRUGGLE' : c.kind === 'ultra' ? 'HEAVEN-SPLITTING CLASH' : 'PALM CLASH';
  brushText(ctx, name, VIEW_W / 2, 290, 34, SEAL, { outline: 6, family: FONT_DISPLAY });
  // tug meter
  const mx = VIEW_W / 2 - 300;
  const my = 330;
  ctx.fillStyle = INK;
  ctx.fillRect(mx - 6, my - 6, 612, 32);
  ctx.fillStyle = '#4dabf7';
  ctx.fillRect(mx, my, 300 + k * 300, 20);
  ctx.fillStyle = '#ff4d6d';
  ctx.fillRect(mx + 300 + k * 300, my, 300 - k * 300, 20);
  circle(ctx, mx + 300 + k * 300, my + 10, 16, GOLD, INK, 3);
  const pulse = 1 + 0.15 * Math.sin(t / 2);
  brushText(ctx, 'MASH!', VIEW_W / 2, 400, 48 * pulse, INK, { outline: 8, family: FONT_DISPLAY });
  setFont(ctx, 16, FONT_UI, 'bold');
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.fillText('Alternate LIGHT and HEAVY! Press both together to burn a chi bar for a surge.', VIEW_W / 2, 440);
  ctx.fillRect(mx, my + 34, 600 * (c.t / c.max), 4);
  ctx.restore();
}

const SIGNATURE_KO = {
  longxu: 'HIS BEARD HAS LEFT HIM',
  waiya: 'WIRE SNAPPED!',
  jiugui: '...ZZZ... *SNORE*',
  dazhong: 'GOOOONG!',
  jidao: 'FEATHERS EVERYWHERE!',
  moolan: 'MOOOO...ooo...',
  hamfu: 'DEFLATED!',
  shanyang: '*FAINTS RIGIDLY*',
};

// KO and round-end overlays (screen space).
export function drawKO(ctx, v, t) {
  const ko = v.ko;
  if (!ko || (v.phase !== 'ko' && v.phase !== 'roundEnd')) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const T = v.phase === 'ko' ? v.phaseT : RULES.KO_FRAMES + v.phaseT;
  ctx.save();
  if (ko.type === 'scroll' && T > 20) {
    // the scene becomes a painted scroll
    const k = Math.min(1, (T - 20) / 30);
    ctx.fillStyle = rgba('#efe6cf', 0.35 * k);
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.strokeStyle = '#7f5539';
    ctx.lineWidth = 26 * k;
    ctx.strokeRect(40, 40, VIEW_W - 80, VIEW_H - 80);
    ctx.fillStyle = '#7f5539';
    ctx.fillRect(10, 20, 30 * k, VIEW_H - 40);
    ctx.fillRect(VIEW_W - 40, 20, 30 * k, VIEW_H - 40);
  }
  if (ko.type === 'timeup') {
    brushText(ctx, 'TIME!', VIEW_W / 2, VIEW_H * 0.36, 120, SEAL, { outline: 12, family: FONT_DISPLAY });
    if (T > 40 && ko.loser >= 0) brushText(ctx, 'DISHONOR', VIEW_W / 2, VIEW_H * 0.52, 64, INK, { outline: 8, family: FONT_DISPLAY });
  } else if (T > 8) {
    const k = Math.min(1, (T - 8) / 8);
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H * 0.34);
    ctx.scale(2.2 - 1.2 * k, 2.2 - 1.2 * k);
    brushText(ctx, 'K.O.', 0, 0, 150, INK, { outline: 14, family: FONT_DISPLAY });
    ctx.restore();
    if (ko.double) brushText(ctx, 'DOUBLE KNOCKOUT', VIEW_W / 2, VIEW_H * 0.5, 44, SEAL, { outline: 6, family: FONT_DISPLAY });
    else if (T > 40) {
      let sub = '';
      if (ko.type === 'star') sub = 'TO THE HEAVENS!';
      else if (ko.type === 'crash') sub = 'THROUGH THE SCENERY!';
      else if (ko.type === 'crater') sub = 'CRATERED!';
      else if (ko.type === 'scroll') sub = 'AN ULTIMATE TECHNIQUE';
      else sub = SIGNATURE_KO[v.fighters[ko.loser].charId] || '';
      brushText(ctx, sub, VIEW_W / 2, VIEW_H * 0.5, 40, SEAL, { outline: 6, family: FONT_DISPLAY });
    }
  }
  if (ko.type === 'star' && T > 50 && T < 150) {
    const sx = ko.loser === 0 ? VIEW_W * 0.25 : VIEW_W * 0.75;
    const tw = Math.abs(Math.sin(T / 4));
    drawStar(ctx, sx, 120, 14 + tw * 16, '#fff3b0');
    drawStar(ctx, sx, 120, 6 + tw * 6, '#ffffff');
  }
  if (ko.type === 'crash' && T > 4) {
    const wx = v.fighters[ko.loser]?.x < 800 ? 40 : VIEW_W - 40;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(wx, VIEW_H * 0.5);
      ctx.lineTo(wx + Math.cos(a) * 160, VIEW_H * 0.5 + Math.sin(a) * 200);
      ctx.stroke();
    }
  }
  // seals on the winner and loser
  if (T > 70 && ko.winner >= 0 && !ko.double) {
    const wx = ko.winner === 0 ? VIEW_W * 0.2 : VIEW_W * 0.8;
    const lx = ko.winner === 0 ? VIEW_W * 0.8 : VIEW_W * 0.2;
    const k = Math.min(1, (T - 70) / 6);
    seal(ctx, wx, VIEW_H * 0.66, 120 * (2 - k), '勝', SEAL, -0.1);
    if (T > 80) seal(ctx, lx, VIEW_H * 0.66, 90, '敗', '#495057', 0.12);
  }
  ctx.restore();
}

export function drawRoundIntro(ctx, v, t, cosOf) {
  if (v.phase !== 'intro') return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const T = v.phaseT;
  const introLen = v.introLen ?? RULES.INTRO_FRAMES;
  const fightAt = introLen - RULES.FIGHT_FRAMES;
  ctx.save();
  if (T < fightAt) {
    const k = Math.min(1, T / 10);
    ctx.globalAlpha = k;
    const label = v.suddenDeath ? 'SUDDEN DEATH' : v.wins[0] === v.cfg.wins - 1 && v.wins[1] === v.cfg.wins - 1 ? 'FINAL ROUND' : `ROUND ${v.round}`;
    brushText(ctx, label, VIEW_W / 2, VIEW_H * 0.36, 90, INK, { outline: 12, family: FONT_DISPLAY });
    brushText(ctx, ['一', '二', '三', '四', '五', '六', '七'][Math.min(6, v.round - 1)] || '終', VIEW_W / 2, VIEW_H * 0.36 - 110, 70, SEAL, { outline: 8 });
  } else {
    const k = Math.min(1, (T - fightAt) / 6);
    ctx.translate(VIEW_W / 2, VIEW_H * 0.38);
    ctx.scale(2.5 - 1.5 * k, 2.5 - 1.5 * k);
    brushText(ctx, '戰', -150, 0, 150, SEAL, { outline: 12 });
    brushText(ctx, 'FIGHT!', 70, 0, 110, INK, { outline: 12, family: FONT_DISPLAY });
  }
  ctx.restore();
  void cosOf;
}

export function drawHeavenlyOverlay(ctx, v, t) {
  if (v.heavenly?.id === 'ghosts') {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(5,5,15,0.82)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (v.heavenly?.id === 'turtle') {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(80,140,90,0.12)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (v.heavenly?.id === 'tea') {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = 'rgba(160,110,50,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 50; i++) {
      const x = (i * 131 + t * 3) % VIEW_W;
      const y = (i * 67 + t * 9) % VIEW_H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 14);
      ctx.stroke();
    }
  }
}


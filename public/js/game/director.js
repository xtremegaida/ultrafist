// The director turns simulation events into juice: particles, glyphs, camera shake, sound and speech.
// It is render/audio-side only and never touches the simulation.

import { getMove, getChar, getProj } from '../data/registry.js';
import { comboTier, COMBO_TITLES } from '../data/rules.js';
import { HEAVENLY_EVENTS } from '../data/heavenlyEvents.js';
import { STAGES } from '../data/stages.js';
import { audio } from '../audio/audio.js';
import * as FX from '../render/fx.js';
import { addShake } from '../render/camera.js';
import { triggerFlip, triggerFlash, triggerTear } from '../render/renderer.js';
import { INK, SEAL, GOLD } from '../render/brush.js';
import { VIEW_W } from '../render/camera.js';

const HIT_SFX = { light: 'hitLight', heavy: 'hitHeavy', special: 'hitSpecial', ultra: 'hitUltra' };
const SHAKE = { light: 2, heavy: 6, special: 10, ultra: 16 };

export function createDirector(settings = {}) {
  return { lastTier: [0, 0], frame: 0, pending: [], settings, lastIntensity: 0, koSlow: false };
}

function pan(x) {
  return Math.max(-0.8, Math.min(0.8, (x - 800) / 900));
}

function voiceOf(f) {
  const ch = getChar(f.charId);
  return { pitch: ch.voice?.pitch ?? 1, rate: ch.voice?.rate ?? 1 };
}

function say(text, side, f, priority = 'shout') {
  const v = f ? voiceOf(f) : { pitch: 0.6, rate: 0.9 };
  audio.speech.say(text, { pitch: v.pitch, rate: v.rate, side, priority });
}

function announce(text) {
  audio.speech.say(text, { pitch: 0.6, rate: 0.9, priority: 'announcer' });
}

export function startMatchAudio(d, stageId) {
  audio.music.play(STAGES[stageId]?.music || 'bamboo');
  audio.music.setIntensity(0);
}

// Process this frame's events. `v` is the current view, `r` the renderer, `cosOf(side)` cosmetics.
export function direct(d, r, v, events, cosOf) {
  d.frame++;
  const fx = r.fx;
  const cam = r.cam;
  // timed follow-ups (battle cries etc.)
  if (d.pending.length) {
    const due = d.pending.filter((p) => p.at <= d.frame);
    d.pending = d.pending.filter((p) => p.at > d.frame);
    for (const p of due) p.fn();
  }
  for (const e of events) handle(d, r, v, e, fx, cam, cosOf);

  // slow-mo audio during the KO
  const slow = !!v.slow;
  if (slow !== d.koSlow) {
    d.koSlow = slow;
    audio.setSlowmo(slow ? 0.25 : 1);
  }
  // music intensity follows danger
  if (d.frame % 30 === 0 && v.fighters) {
    const low = Math.min(...v.fighters.map((f) => f.hp / f.maxHp));
    const inten = v.phase === 'fight' ? Math.max(0, Math.min(1, (0.6 - low) / 0.5)) : 0;
    if (Math.abs(inten - d.lastIntensity) > 0.05) {
      d.lastIntensity = inten;
      audio.music.setIntensity(inten);
    }
  }
}

function handle(d, r, v, e, fx, cam, cosOf) {
  const F = (side) => v.fighters[side];
  switch (e.t) {
    case 'roundStart': {
      audio.sfx('roundStart');
      const label = e.sudden ? 'Sudden death!' : e.final ? 'Final round!' : `Round ${e.round}`;
      d.pending.push({ at: d.frame + 20, fn: () => announce(label) });
      if (e.round === 1) {
        for (const side of [0, 1]) {
          const cry = cosOf(side)?.cry;
          if (cry) d.pending.push({ at: d.frame + 55 + side * 30, fn: () => say(cry, side, F(side)) });
        }
      }
      break;
    }
    case 'stageChange': {
      // smashed through the scenery: the old arena rips apart to reveal the area behind it
      const def = STAGES[e.id];
      triggerTear(r);
      fx.decals.length = 0;
      audio.sfx('wallBounce');
      audio.sfx('scroll');
      d.pending.push({ at: d.frame + 16, fn: () => {
        audio.sfx('gong');
        FX.banner(fx, def.glyph, VIEW_W / 2, 540, 70, SEAL, 84, { sub: def.name.toUpperCase() });
      } });
      break;
    }
    case 'fight':
      audio.sfx('fight');
      announce('Fight!');
      FX.flash(fx, '#ffffff', 0.25);
      break;
    case 'move': {
      const def = getMove(e.id);
      const f = F(e.side);
      if (!def) break;
      if (def.kind === 'special' || def.kind === 'system') {
        if (def.shout && !def.taunt) say(def.shout, e.side, f);
        if (def.glyph) FX.glyph(fx, def.glyph, f.x + f.facing * 30, f.y - 230 * (f.scale || 1), def.glyph.length > 1 ? 56 : 74, e.bonus ? GOLD : INK, 45);
        FX.speedLines(fx, f.x, f.y - 100, 'rgba(22,18,15,0.35)', 8);
      }
      if (def.taunt) {
        const ch = getChar(f.charId);
        FX.glyph(fx, '挑', f.x, f.y - 230, 60, SEAL, 40);
        if (ch.tauntText) FX.banner(fx, ch.tauntText, e.side === 0 ? 320 : VIEW_W - 320, 600, 18, INK, 110);
      }
      if (e.bonus) {
        audio.sfx('chime', { pan: pan(f.x) });
        FX.glyph(fx, '真', f.x - f.facing * 50, f.y - 180, 48, SEAL, 50, { seal: true });
        FX.banner(fx, 'AUTHENTIC!', e.side === 0 ? 170 : VIEW_W - 170, 360, 30, GOLD, 50);
      }
      break;
    }
    case 'ultra': {
      const def = getMove(e.id);
      const f = F(e.side);
      audio.sfx('superFreeze');
      if (def?.shout) say(def.shout, e.side, f, 'announcer');
      FX.flash(fx, '#ffffff', 0.5);
      addShake(cam, 8);
      break;
    }
    case 'sfx':
      audio.sfx(e.id, { pan: pan(e.x ?? 800) });
      break;
    case 'animal':
      audio.animal(e.kind, { pan: pan(F(e.side ?? 0).x) });
      break;
    case 'shout':
      say(e.text, e.side, F(e.side));
      break;
    case 'hit': {
      const lvl = e.level || 'light';
      const victim = F(e.d);
      audio.sfx(e.sfx || HIT_SFX[lvl] || 'hitLight', { pan: pan(e.x), vol: lvl === 'light' ? 0.8 : 1 });
      if (e.counter) audio.sfx('counter', { pan: pan(e.x) });
      addShake(cam, SHAKE[lvl] || 3);
      if (lvl !== 'light') cam.punch = Math.max(cam.punch, lvl === 'ultra' ? 0.06 : 0.03);
      triggerFlash(r, e.d);
      const red = e.counter ? SEAL : INK;
      FX.drops(fx, e.x, e.y, lvl === 'light' ? 6 : 12, red, lvl === 'light' ? 5 : 8);
      FX.sparks(fx, e.x, e.y, lvl === 'light' ? 4 : 8, e.counter ? '#ff4d6d' : '#ffffff', lvl === 'light' ? 20 : 34);
      if (lvl !== 'light') {
        FX.splat(fx, e.x, e.y, lvl === 'heavy' ? 0.7 : 1.1, red, 90);
        FX.speedLines(fx, e.x, e.y, 'rgba(22,18,15,0.5)', lvl === 'ultra' ? 18 : 10);
      }
      if (lvl === 'ultra' && !e.cine) FX.flash(fx, '#ffffff', 0.35);
      if (e.dmg) FX.dmgText(fx, e.dmg, e.x, e.y - 40, e.counter ? SEAL : INK, lvl !== 'light');
      if (e.counter) FX.glyph(fx, '反', e.x, e.y - 70, 70, SEAL, 40);
      if (e.glyph) FX.glyph(fx, e.glyph, e.x + (Math.random() - 0.5) * 60, e.y - 90, e.glyph.length > 1 ? 60 : 80, e.kind === 'ultra' ? SEAL : INK, 45);
      if (e.armored) FX.ring(fx, victim.x, victim.y - 110, GOLD, 20, 90, 14, 6);
      // feathers when the rooster gets smacked
      if (victim.charId === 'jidao') FX.feathers(fx, e.x, e.y, lvl === 'light' ? 2 : 5);
      // combo tier announcements for the attacker
      if (e.a >= 0) {
        const tier = comboTier(e.combo || 0);
        if (tier > d.lastTier[e.a]) {
          d.lastTier[e.a] = tier;
          const title = COMBO_TITLES[tier - 1];
          audio.sfx('comboTier', { tier });
          if (tier >= 3) {
            FX.banner(fx, title.text, VIEW_W / 2, 230, 34 + tier * 4, tier >= 8 ? SEAL : tier >= 5 ? GOLD : INK, 70, { rainbow: tier >= 8, shake: tier >= 6 ? tier : 0 });
            if (tier >= 5) announce(title.text);
          }
        }
      }
      break;
    }
    case 'comboEnd':
      d.lastTier[e.side] = 0;
      break;
    case 'block':
      audio.sfx(e.jd ? 'justDefend' : 'block', { pan: pan(e.x) });
      FX.ring(fx, e.x, e.y, e.jd ? '#ffffff' : '#4dabf7', 8, e.jd ? 90 : 60, 14, e.jd ? 7 : 5);
      FX.sparks(fx, e.x, e.y, 4, '#a8dadc', 18);
      addShake(cam, 1);
      if (e.jd) FX.glyph(fx, '守', e.x, e.y - 60, 60, '#1d3557', 40);
      if (e.chip) FX.dmgText(fx, e.chip, e.x, e.y - 30, '#457b9d');
      break;
    case 'clink':
      audio.sfx('clink', { pan: pan(e.x) });
      FX.sparks(fx, e.x, e.y, 10, '#ffffff', 30);
      FX.ring(fx, e.x, e.y, '#ffffff', 6, 50, 10, 4);
      break;
    case 'guardBreak':
      audio.sfx('guardBreak', { pan: pan(e.x) });
      FX.glyph(fx, '破', e.x, e.y - 60, 130, SEAL, 60);
      FX.drops(fx, e.x, e.y, 24, '#4dabf7', 10);
      addShake(cam, 12);
      FX.flash(fx, '#a8dadc', 0.3);
      announce('Guard break!');
      break;
    case 'tech':
      audio.sfx('tech', { pan: pan(e.x) });
      FX.glyph(fx, '解', e.x, e.y - 40, 90, '#1d3557', 45);
      FX.ring(fx, e.x, e.y, '#ffffff', 10, 80, 12, 6);
      break;
    case 'grab':
      audio.sfx('throw', { pan: pan(e.x) });
      break;
    case 'parry':
      audio.sfx('clink', { pan: pan(e.x) });
      audio.sfx('chime', { pan: pan(e.x) });
      FX.glyph(fx, e.glyph || '化', e.x, e.y - 40, 90, '#2d6a4f', 45);
      FX.ring(fx, e.x, e.y + 40, '#b7e4c7', 10, 100, 16, 6);
      break;
    case 'armor':
      audio.sfx('clink', { pan: pan(e.x) });
      FX.ring(fx, e.x, e.y, GOLD, 20, 90, 14, 6);
      break;
    case 'burst':
      audio.sfx('explode', { pan: pan(e.x) });
      FX.ring(fx, e.x, e.y - 90, '#4dabf7', 20, 260, 22, 10);
      FX.glyph(fx, '氣', e.x, e.y - 230, 110, '#1d3557', 50);
      addShake(cam, 10);
      break;
    case 'awaken': {
      const f = F(e.side);
      audio.sfx('awaken');
      FX.flash(fx, '#ff4d6d', 0.45);
      FX.banner(fx, '覺醒', e.side === 0 ? 300 : VIEW_W - 300, 330, 110, SEAL, 100, { sub: 'FINAL AWAKENING' });
      FX.ring(fx, f.x, f.y - 100, '#ff4d6d', 20, 300, 26, 12);
      say('Final awakening!', e.side, f, 'announcer');
      break;
    }
    case 'chiCancel':
      audio.sfx('chiReady');
      FX.glyph(fx, '氣', F(e.side).x, F(e.side).y - 200, 54, '#1d6fa5', 30);
      break;
    case 'chi':
      if (e.taunt) {
        audio.sfx('chiReady');
        FX.dmgText(fx, `+${Math.round(e.n)} 氣`, F(e.side).x, F(e.side).y - 220, '#1d6fa5');
      }
      break;
    case 'jump':
      audio.sfx('jump', { pan: pan(e.x), vol: 0.6 });
      FX.puff(fx, e.x, -4, 3, 'rgba(60,50,40,0.6)', 26);
      break;
    case 'airJump':
      audio.sfx('airJump', { pan: pan(e.x), pitch: 1 + (e.n || 1) * 0.12 });
      FX.puff(fx, e.x, e.y + 10, 4, '#ffffff', 30);
      FX.ring(fx, e.x, e.y + 6, 'rgba(22,18,15,0.5)', 6, 40, 12, 3);
      triggerFlip(r, e.side);
      break;
    case 'wallJump':
      audio.sfx('wallJump', { pan: pan(e.x) });
      FX.puff(fx, e.x, e.y - 60, 4, 'rgba(60,50,40,0.6)', 30);
      break;
    case 'land':
      audio.sfx('land', { pan: pan(e.x), vol: 0.5 });
      FX.puff(fx, e.x, -4, 2, 'rgba(60,50,40,0.5)', 22);
      break;
    case 'dash':
      audio.sfx('dash', { pan: pan(F(e.side).x) });
      FX.puff(fx, F(e.side).x - F(e.side).facing * 30, F(e.side).y - 10, 3, 'rgba(60,50,40,0.55)', 28);
      break;
    case 'knockdown':
      audio.sfx('knockdown', { pan: pan(e.x) });
      FX.puff(fx, e.x, -6, 6, 'rgba(60,50,40,0.6)', 40);
      addShake(cam, 4);
      if (e.ko && v.ko?.type === 'crater') FX.decal(fx, 'crater', e.x, 0, { w: 110 });
      break;
    case 'groundBounce':
      audio.sfx('groundBounce', { pan: pan(e.x) });
      FX.decal(fx, 'crater', e.x, 0, { w: 70, life: 120, max: 120 });
      FX.glyph(fx, '地', e.x, -80, 70, INK, 35);
      FX.puff(fx, e.x, -6, 6, 'rgba(60,50,40,0.6)', 40);
      addShake(cam, 8);
      break;
    case 'wallBounce':
      audio.sfx('wallBounce', { pan: pan(e.x) });
      FX.decal(fx, 'crack', e.x + e.wall * 20, e.y - 100, { life: 160, max: 160 });
      FX.glyph(fx, '壁', e.x - e.wall * 60, e.y - 150, 80, INK, 40);
      addShake(cam, 10);
      break;
    case 'wallSplat':
      audio.sfx('knockdown', { pan: pan(e.x) });
      FX.decal(fx, 'crack', e.x + e.wall * 20, e.y - 100, { life: 120, max: 120 });
      addShake(cam, 6);
      break;
    case 'flip':
      audio.sfx('swingLight', { vol: 0.5 });
      triggerFlip(r, e.side);
      break;
    case 'clash':
      audio.sfx('clashStart');
      FX.flash(fx, '#ffffff', 0.4);
      addShake(cam, 8);
      announce(e.kind === 'beam' ? 'Beam struggle!' : e.kind === 'ultra' ? 'Heaven splitting clash!' : 'Palm clash!');
      break;
    case 'mash':
      audio.sfx('mashTick', { pitch: 0.8 + Math.random() * 0.6, pan: e.side === 0 ? -0.5 : 0.5, vol: 0.5 });
      if (v.clash) FX.sparks(fx, v.clash.x, v.clash.y, 2, e.side === 0 ? '#4dabf7' : '#ff4d6d', 30);
      break;
    case 'surge':
      audio.sfx('whooshBig');
      FX.banner(fx, 'SURGE!', e.side === 0 ? 300 : VIEW_W - 300, 470, 48, GOLD, 40);
      break;
    case 'clashEnd':
      audio.sfx('clashWin');
      FX.flash(fx, '#ffffff', 0.5);
      FX.ring(fx, e.x, e.y, GOLD, 20, 300, 24, 10);
      addShake(cam, 14);
      break;
    case 'cine':
      audio.sfx('whooshBig');
      break;
    case 'stageFlip':
      r.stageFlip = 34;
      audio.sfx('bigGong');
      addShake(cam, 16);
      break;
    case 'sunrise':
      r.sunrise = 200;
      break;
    case 'spawn': {
      const def = getProj(e.kind);
      const s = def?.sprite;
      if (s === 'egg') audio.sfx('egg', { pan: pan(e.x) });
      else if (s === 'sword') audio.sfx('shing', { pan: pan(e.x), vol: 0.6 });
      else if (s === 'feather') audio.sfx('feathers', { pan: pan(e.x), vol: 0.4 });
      else if (s === 'fire') audio.sfx('fire', { pan: pan(e.x) });
      else if (s === 'wine' || s === 'wave') audio.sfx('splash', { pan: pan(e.x) });
      else if (s === 'milkBeam') audio.sfx('beam', { pan: pan(e.x) });
      else if (s === 'ghostCow') audio.sfx('stomp', { pan: pan(e.x), vol: 0.5 });
      else if (s === 'ring') audio.sfx('crowRing', { pan: pan(e.x) });
      else if (s === 'ripple') audio.sfx('stomp', { pan: pan(e.x), vol: 0.5 });
      else if (s === 'scream') { /* the goat voice already plays */ } else audio.sfx('projectile', { pan: pan(e.x) });
      break;
    }
    case 'projLand':
      if (e.kind === 'egg' || e.kind === 'kickedEgg') {
        audio.sfx('eggCrack', { pan: pan(e.x) });
        FX.splat(fx, e.x, 2, 0.5, '#ffb703', 200, true);
      }
      break;
    case 'zone':
      if (e.kind === 'lard') audio.sfx('slip', { pan: pan(e.x) });
      if (e.kind === 'mud') audio.sfx('mud', { pan: pan(e.x) });
      if (e.kind === 'fire') FX.flames(fx, e.x, -10, 12);
      break;
    case 'reflect':
      audio.sfx('clink', { pan: pan(e.x) });
      FX.ring(fx, e.x, e.y, '#ffffff', 10, 70, 12, 5);
      FX.glyph(fx, '返', e.x, e.y - 50, 60, '#1d3557', 30);
      break;
    case 'absorb':
      audio.sfx('chiReady');
      FX.ring(fx, e.x, e.y, '#b7e4c7', 10, 60, 12, 5);
      break;
    case 'echo':
      FX.dmgText(fx, e.dmg, e.x + 30, e.y - 10, '#495057');
      FX.drops(fx, e.x, e.y, 6, INK, 6);
      break;
    case 'poison':
      FX.dmgText(fx, e.dmg, e.x, e.y, '#2d6a4f');
      break;
    case 'burn':
      FX.flames(fx, e.x, e.y, 3);
      break;
    case 'pickup': {
      audio.sfx('pickup');
      const label = e.kind === 'peach' ? '桃 +80 HP' : e.kind === 'orb' ? '氣 +50 CHI' : '辣 SPEED UP';
      FX.dmgText(fx, label, e.x, e.y - 40, e.kind === 'chilli' ? SEAL : '#2d6a4f', true);
      break;
    }
    case 'chicken':
      audio.animal('cluck', { pan: pan(e.x) });
      FX.feathers(fx, e.x, e.y, 10, '#fffaf0');
      FX.dmgText(fx, '+10 氣', e.x, e.y - 40, '#1d6fa5');
      break;
    case 'egg': {
      audio.sfx('eggCrack');
      FX.feathers(fx, e.x, -100, 16);
      FX.banner(fx, '蛋', e.side === 0 ? 300 : VIEW_W - 300, 330, 120, GOLD, 90, { sub: 'EGG MODE! SURVIVE TO HATCH!' });
      announce('Egg mode!');
      break;
    }
    case 'hatch':
      audio.animal('crow');
      FX.feathers(fx, e.x, -60, 20, '#ffb703');
      FX.flames(fx, e.x, -40, 14);
      FX.banner(fx, '鳳凰', e.side === 0 ? 300 : VIEW_W - 300, 330, 110, SEAL, 90, { sub: 'REBORN FROM THE EGG!' });
      break;
    case 'hatEaten':
      FX.banner(fx, 'HAT EATEN!', e.side === 0 ? 300 : VIEW_W - 300, 420, 40, SEAL, 70);
      break;
    case 'hudBite':
      r.hud.bite[e.side] = 240;
      audio.sfx('mashTick', { pitch: 0.5 });
      break;
    case 'drunk': {
      const f = F(e.side);
      if (e.n > 0) {
        audio.sfx('hiccup', { pan: pan(f.x) });
        FX.glyph(fx, `醉${e.n}`, f.x, f.y - 220, 46, SEAL, 40);
      }
      break;
    }
    case 'buff': {
      const f = F(e.side);
      FX.ring(fx, f.x, f.y - 100, GOLD, 20, 200, 20, 8);
      if (e.id === 'youth') FX.banner(fx, '返老還童', e.side === 0 ? 300 : VIEW_W - 300, 330, 70, '#2d6a4f', 90, { sub: 'BEHOLD MY YOUTH!' });
      if (e.id === 'banquet') audio.animal('oink');
      break;
    }
    case 'ko': {
      audio.sfx('ko');
      announce('K.O.!');
      FX.flash(fx, '#ffffff', 0.7);
      addShake(cam, 18);
      const L = F(e.loser);
      if (e.type === 'star') d.pending.push({ at: d.frame + 70, fn: () => audio.sfx('ding') });
      if (e.type === 'signature') {
        const sig = { jidao: () => FX.feathers(fx, L.x, L.y - 90, 40), dazhong: () => audio.sfx('bell'), moolan: () => audio.animal('moo'),
          hamfu: () => audio.sfx('slip'), jiugui: () => audio.sfx('snore'), longxu: () => audio.sfx('beard'), waiya: () => audio.sfx('twang'),
          shanyang: () => audio.animal('goatScream') };
        sig[L.charId]?.();
      }
      FX.splat(fx, L.x, L.y - 80, 1.4, INK, 200);
      break;
    }
    case 'timeUp':
      audio.sfx('timeUp');
      announce('Time!');
      break;
    case 'roundEnd':
      if (e.perfect) {
        audio.sfx('perfect');
        FX.banner(fx, '蓮', VIEW_W / 2, 470, 120, SEAL, 120, { sub: 'FLAWLESS LOTUS' });
        d.pending.push({ at: d.frame + 30, fn: () => announce('Flawless lotus!') });
      } else if (e.winner >= 0) {
        const W = F(e.winner);
        d.pending.push({ at: d.frame + 20, fn: () => announce(`${getChar(W.charId).short} wins`) });
      }
      break;
    case 'matchEnd': {
      const W = F(e.winner);
      audio.sfx('bigGong');
      audio.music.play('victory');
      d.pending.push({ at: d.frame + 40, fn: () => say(getChar(W.charId).quote, e.winner, W, 'announcer') });
      break;
    }
    case 'heavenly': {
      const def = HEAVENLY_EVENTS[e.id];
      audio.sfx('gong');
      audio.sfx('scroll');
      FX.banner(fx, def.glyph, VIEW_W / 2, 300, 150, SEAL, 120, { sub: def.name.toUpperCase() });
      FX.banner(fx, def.desc, VIEW_W / 2, 480, 22, INK, 120);
      announce(def.name);
      if (e.id === 'dragon') d.pending.push({ at: d.frame + 90, fn: () => audio.sfx('dragon') });
      break;
    }
    case 'hazard':
      handleHazard(d, r, v, e, fx, cam);
      break;
    default:
      break;
  }
}

function handleHazard(d, r, v, e, fx, cam) {
  switch (e.kind) {
    case 'bambooCreak':
      audio.sfx('wallBounce', { pan: pan(e.x) });
      FX.banner(fx, 'TIMBER!', VIEW_W / 2, 470, 44, '#2d6a4f', 50);
      break;
    case 'bambooCrash':
      addShake(cam, 12);
      FX.puff(fx, e.x, -10, 10, 'rgba(60,90,40,0.6)', 50);
      FX.petals(fx, e.x, -120, 14, '#52b788');
      break;
    case 'lanternDrop':
      audio.sfx('whooshBig', { pan: pan(e.x) });
      break;
    case 'hayHit':
      FX.puff(fx, e.x, -50, 4, 'rgba(233,196,106,0.8)', 30);
      break;
    case 'hayBreak':
      audio.sfx('explode', { pan: pan(e.x), vol: 0.6 });
      FX.puff(fx, e.x, -40, 12, 'rgba(233,196,106,0.9)', 50);
      break;
    case 'waiterWarn':
      FX.banner(fx, 'HOT TEA COMING THROUGH!', VIEW_W / 2, 470, 36, SEAL, 90);
      announce('Hot tea coming through!');
      audio.sfx('tea');
      break;
    case 'tableSmash':
      audio.sfx('explode', { pan: pan(e.x) });
      FX.glyph(fx, '桌', e.x, -120, 90, '#7f5539', 45);
      FX.drops(fx, e.x, -80, 16, '#7f5539', 10);
      addShake(cam, 12);
      break;
    case 'gust':
      audio.sfx('whooshBig');
      FX.banner(fx, '風  HEAVENLY GUST!', VIEW_W / 2, 470, 40, '#1d3557', 70);
      break;
    default:
      break;
  }
}


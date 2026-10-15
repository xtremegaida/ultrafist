// UltraFist animation viewer: steps any move or state frame by frame using the real pose, skin,
// hurtbox and hitbox code, and lists its frame data. A tool for authoring and tuning characters.
// The pose lab edits POSES live (in memory only) and prints the code to paste into render/pose.js.

import { CHARACTERS, CHAR_IDS, SCROLLS, getMove, getProj } from '../js/data/registry.js';
import { RULES } from '../js/data/rules.js';
import { presetsFor } from '../js/data/presets.js';
import { resolveBuild } from '../js/sim/builds.js';
import { createFighter, hurtboxes, invulnTo, pushWidth } from '../js/sim/fighter.js';
import { activeHits, hitBoxScale } from '../js/sim/moves.js';
import { worldBox, inRange } from '../js/sim/util.js';
import { POSES, poseFor, solve } from '../js/render/pose.js';
import { drawFighter, propsOf, drawAura } from '../js/render/skins.js';
import { INK } from '../js/render/brush.js';

const $ = (id) => document.getElementById(id);
const view = $('view');
const ctx = view.getContext('2d');
const tl = $('tl');
const tctx = tl.getContext('2d');

const NORMALS = ['sL', 'sH', 'cL', 'cH', 'jL', 'jH', 'throw', 'airThrow'];
const SYSTEM = ['qiBurst', 'awaken', 'taunt'];
const POSE_BACKUP = structuredClone(POSES);
const AIR_Y = -130; // air moves are shown floating at this height

// ---- clips ---------------------------------------------------------------------------------------

// Jump arc for frame T of a jump: real gravity and launch speed.
function arc(f, T, vy0 = RULES.JUMP_VY, g = RULES.GRAVITY) {
  f.air = true;
  f.vy = vy0 + g * T;
  f.y = Math.min(-1, vy0 * T + 0.5 * g * T * T);
}

const STATE_CLIPS = [
  { id: 'idle', name: 'Idle', len: 80, set: (f) => { f.st = 'idle'; } },
  { id: 'walkF', name: 'Walk forward', len: 58, set: (f) => { f.st = 'walk'; f.vx = 3; } },
  { id: 'walkB', name: 'Walk back', len: 58, set: (f) => { f.st = 'walk'; f.vx = -3; } },
  { id: 'block', name: 'Block', len: 20, set: (f) => { f.st = 'idle'; f.guarding = true; } },
  { id: 'crouch', name: 'Crouch', len: 20, set: (f) => { f.st = 'crouch'; } },
  { id: 'crouchBlock', name: 'Crouch block', len: 20, set: (f) => { f.st = 'crouch'; f.guarding = true; } },
  { id: 'dash', name: 'Dash', len: RULES.DASH_F.frames, set: (f) => { f.st = 'dash'; } },
  { id: 'backdash', name: 'Back dash', len: RULES.DASH_B.frames, set: (f) => { f.st = 'dash'; f.dashBack = true; } },
  { id: 'run', name: 'Stampede run', len: 40, only: 'moolan', set: (f) => { f.st = 'dash'; f.running = true; } },
  { id: 'jumpSquat', name: 'Pre-jump', len: RULES.JUMP_SQUAT, set: (f) => { f.st = 'jumpSquat'; } },
  { id: 'jump', name: 'Jump', len: Math.round((-2 * RULES.JUMP_VY) / RULES.GRAVITY), set: (f, T) => { f.st = 'air'; arc(f, T); } },
  { id: 'airJump', name: 'Air jump flip', len: 14, set: (f, T, ex) => { f.st = 'air'; arc(f, T, RULES.AIR_JUMP_VY); f.y -= 140; ex.flipT = 14 - T; } },
  { id: 'glide', name: 'Glide', len: 30, only: 'jidao', set: (f, T, ex) => { f.st = 'air'; f.air = true; f.y = -160; f.vy = 1.5; ex.glide = true; } },
  { id: 'cling', name: 'Wall cling', len: 30, only: 'shanyang', set: (f) => { f.st = 'air'; f.air = true; f.y = -160; f.clinging = true; } },
  { id: 'landing', name: 'Landing', len: RULES.LANDING, set: (f) => { f.st = 'landing'; } },
  { id: 'hitstun', name: 'Hitstun', len: RULES.HITSTUN.heavy, set: (f) => { f.st = 'hitstun'; } },
  { id: 'hitstunLow', name: 'Hitstun (crouching)', len: RULES.HITSTUN.heavy, set: (f) => { f.st = 'hitstun'; f.crouching = true; } },
  { id: 'blockstun', name: 'Blockstun', len: RULES.BLOCKSTUN.heavy, set: (f) => { f.st = 'blockstun'; } },
  { id: 'launched', name: 'Launched', len: 36, set: (f, T) => { f.st = 'launched'; arc(f, T, -14); } },
  { id: 'knockdown', name: 'Knockdown + quick rise', len: RULES.KNOCKDOWN, set: (f) => { f.st = 'knockdown'; f.quickRise = true; } },
  { id: 'dizzy', name: 'Guard broken (dizzy)', len: RULES.GUARD_BREAK_STUN, set: (f) => { f.st = 'guardBroken'; } },
  { id: 'grabbed', name: 'Grabbed', len: 20, set: (f) => { f.st = 'grabbed'; } },
  { id: 'intro', name: 'Round intro bow', len: 90, set: (f) => { f.st = 'intro'; } },
  { id: 'win', name: 'Win pose', len: 40, set: (f) => { f.st = 'win'; } },
  { id: 'lose', name: 'Lose', len: 40, set: (f) => { f.st = 'lose'; } },
  { id: 'ko', name: 'KO (airborne)', len: 40, set: (f, T) => { f.st = 'ko'; arc(f, T, -9); } },
  { id: 'egg', name: 'Phoenix egg', len: 30, only: 'jidao', set: (f) => { f.st = 'egg'; f.char.eggHp = 60; } },
];

function clipsFor(charId) {
  const ch = CHARACTERS[charId];
  const move = (id, label) => {
    const def = getMove(id);
    return { kind: 'move', id, name: label || def.name, len: def.dur, from: 1 };
  };
  const groups = [
    ['States', STATE_CLIPS.filter((c) => !c.only || c.only === charId).map((c) => ({ ...c, kind: 'state', from: 0 }))],
    ['Normals', NORMALS.map((id) => move(id))],
    ['System', SYSTEM.map((id) => move(id))],
    ['Specials', Object.keys(ch.moves).filter((id) => ch.moves[id].kind !== 'ultra').map((id) => move(id, ch.moves[id].hidden ? `${getMove(id).name} (follow-up)` : null))],
    ['Ultras', ch.ultras.map((id) => move(id))],
    ['Forbidden Scrolls', Object.keys(SCROLLS).map((id) => move(id))],
    ['Poses', Object.keys(POSES).map((id) => ({ kind: 'pose', id, name: id, len: 1, from: 0 }))],
  ];
  return groups;
}

// ---- state -----------------------------------------------------------------------------------------

const st = {
  charId: 'longxu',
  build: 0,
  groups: [],
  clip: null,
  frame: 0,
  playing: false,
  acc: 0,
  t: 0,
};

function opt(id) {
  return $(id).checked;
}

const builds = {};
function currentBuild() {
  const key = `${st.charId}:${st.build}`;
  if (!builds[key]) builds[key] = resolveBuild(presetsFor(st.charId)[st.build]);
  return builds[key];
}

function makePuppet(fr) {
  const f = createFighter(0, currentBuild());
  f.x = 0;
  f.y = 0;
  f.facing = opt('flip') ? -1 : 1;
  f.st = 'idle';
  f.stT = fr;
  f.awakened = opt('awake') ? 1 : 0;
  if (st.charId === 'longxu' && opt('youth')) f.buffs.push({ id: 'youth', t: 1e6 });
  if (st.charId === 'jiugui') f.char.drunk = Math.max(0, Math.min(5, Number($('drunk').value) || 0));
  const ex = { flipT: 0, glide: false };
  const c = st.clip;
  if (c.kind === 'move') {
    const def = getMove(c.id);
    f.st = 'attack';
    f.air = !!def.air;
    if (def.air) f.y = AIR_Y;
    f.crouching = !!def.crouch;
    f.move = { id: c.id, f: fr, hit: false, contact: false, contactF: 0, mask: 0, last: {}, bonus: false, lights: 0, armor: 0, data: {}, hold: 0 };
  } else if (c.kind === 'state') {
    c.set(f, fr, ex);
    f.stT = fr;
  }
  return { f, ex };
}

function poseOf(f, ex) {
  return st.clip.kind === 'pose' ? POSES[st.clip.id] : poseFor(f, ex);
}

// ---- drawing the viewport ----------------------------------------------------------------------------

function viewTransform() {
  // the slider scales a zoom fitted to the canvas height
  const z = (view.height / 440) * Number($('zoom').value);
  const ox = opt('flip') ? view.width * 0.68 : view.width * 0.32;
  return { z, ox, oy: view.height - 70 };
}

function strokeBox(b, stroke, fill, dash = null) {
  ctx.fillStyle = fill;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2 / viewTransform().z;
  ctx.setLineDash(dash ? dash.map((d) => d / viewTransform().z) : []);
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.setLineDash([]);
}

function drawGrid(T) {
  const { z, ox, oy } = T;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#f3ead7';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.setTransform(z, 0, 0, z, ox, oy);
  const x0 = -ox / z;
  const x1 = (view.width - ox) / z;
  const y0 = -oy / z;
  ctx.lineWidth = 1 / z;
  ctx.font = `${11 / z}px ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(29,26,23,0.45)';
  for (let x = Math.ceil(x0 / 50) * 50; x < x1; x += 50) {
    ctx.strokeStyle = x === 0 ? 'rgba(179,38,30,0.35)' : x % 100 === 0 ? 'rgba(29,26,23,0.12)' : 'rgba(29,26,23,0.05)';
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, 0);
    ctx.stroke();
    if (x % 100 === 0) ctx.fillText(String(x), x + 3 / z, 14 / z);
  }
  for (let y = -50; y > y0; y -= 50) {
    ctx.strokeStyle = y % 100 === 0 ? 'rgba(29,26,23,0.12)' : 'rgba(29,26,23,0.05)';
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    if (y % 100 === 0) ctx.fillText(String(y), x0 + 4 / z, y - 3 / z);
  }
  ctx.fillStyle = 'rgba(140,123,93,0.35)';
  ctx.fillRect(x0, 0, x1 - x0, 70 / z);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 / z;
  ctx.beginPath();
  ctx.moveTo(x0, 0);
  ctx.lineTo(x1, 0);
  ctx.stroke();
}

function specialKind(f) {
  if (f.st !== 'attack' || !f.move) return null;
  const k = getMove(f.move.id).kind;
  return k === 'special' || k === 'ultra' ? k : null;
}

// Same layering as the game renderer's fighter pass: aura, Wai-Ya's wire, skin, dizzy stars.
function drawPuppet(f, J, t) {
  const cos = currentBuild().cos;
  const special = specialKind(f);
  ctx.save();
  ctx.translate(f.x, f.y);
  if (f.charId === 'jiugui' && f.char?.drunk && (f.st === 'idle' || f.st === 'walk')) ctx.rotate(Math.sin(t / 18) * 0.025 * f.char.drunk);
  ctx.scale(f.facing * f.scale, f.scale);
  if (f.awakened > 0) drawAura(ctx, '#ff4d6d', t, 1.1, 230);
  else if (special) drawAura(ctx, cos.aura || '#ffd34d', t, special === 'ultra' ? 0.8 : 0.4, special === 'ultra' ? 190 : 150);
  if (f.charId === 'waiya' && (f.air || f.st === 'attack')) {
    ctx.strokeStyle = 'rgba(30,30,30,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(J.chest[0] - 6, J.chest[1]);
    ctx.lineTo(J.chest[0] - 40, -1400);
    ctx.stroke();
  }
  drawFighter(ctx, f, J, { cos, t, special: !!special });
  ctx.restore();
}

function silhouette(f, J, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(f.x, f.y);
  ctx.scale(f.facing * f.scale, f.scale);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (const L of [J.aB, J.lB, J.lF, J.aF]) {
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(...L[0]);
    ctx.lineTo(...L[1]);
    ctx.lineTo(...L[2]);
    ctx.stroke();
  }
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.moveTo(...J.hip);
  ctx.lineTo(...J.chest);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(J.head[0], J.head[1], 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawJoints(f, J) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.facing * f.scale, f.scale);
  ctx.strokeStyle = '#0077b6';
  ctx.fillStyle = '#0077b6';
  ctx.lineWidth = 1.5;
  const seg = (a, b) => {
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
  };
  seg(J.hip, J.chest);
  seg(J.chest, J.neck);
  seg(J.neck, J.head);
  for (const L of [J.aF, J.aB, J.lF, J.lB]) {
    seg(L[0], L[1]);
    seg(L[1], L[2]);
  }
  for (const p of [J.hip, J.chest, J.neck, J.head, ...J.aF, ...J.aB, ...J.lF, ...J.lB]) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function puppetJ(fr) {
  const { f, ex } = makePuppet(fr);
  const grounded = !f.air && f.st !== 'launched' && f.st !== 'ultraVictim';
  return { f, ex, J: solve(poseOf(f, ex), propsOf(f.charId, f), grounded) };
}

function render() {
  const T = viewTransform();
  drawGrid(T);
  const c = st.clip;
  const fr = st.frame;
  const { f, J } = puppetJ(fr);

  if (opt('onion') && c.kind !== 'pose') {
    for (const [d, col] of [[-2, '#3a86ff'], [-1, '#3a86ff'], [1, '#d62828'], [2, '#d62828']]) {
      const g = fr + d * 2;
      if (g < c.from || g > c.from + c.len - 1) continue;
      const o = puppetJ(g);
      silhouette(o.f, o.J, col, Math.abs(d) === 1 ? 0.22 : 0.12);
    }
  }
  drawPuppet(f, J, st.t);
  if (opt('showJoints')) drawJoints(f, J);

  const hurtKind = invulnTo(f, 'strike') ? 'strike' : null;
  if (opt('showHurt')) {
    for (const b of hurtboxes(f)) strokeBox(b, hurtKind ? '#9b5de5' : 'rgba(0,140,255,0.9)', hurtKind ? 'rgba(155,93,229,0.12)' : 'rgba(0,160,255,0.13)', hurtKind ? [6, 4] : null);
  }
  if (opt('showPush')) {
    const pw = pushWidth(f);
    strokeBox({ x: f.x - pw, y: f.y - 140 * f.scale, w: pw * 2, h: 140 * f.scale }, 'rgba(230,170,0,0.9)', 'rgba(255,200,0,0.06)');
  }
  if (f.move) {
    const def = getMove(f.move.id);
    if (opt('showHit')) {
      for (const h of safeActiveHits(f)) {
        if (!h.box) continue;
        const b = h.global ? { x: -2000, y: h.box[1], w: 4000, h: h.box[3] } : worldBox(f, h.box, ...hitBoxScale(f, def));
        strokeBox(b, h.grab ? '#2a9d8f' : 'rgba(230,0,40,0.95)', h.grab ? 'rgba(42,157,143,0.18)' : 'rgba(255,0,40,0.2)');
      }
    }
    if (opt('showProj')) drawSpawns(f, def);
  }
}

function safeActiveHits(f) {
  try {
    return activeHits(f);
  } catch {
    // some hits are conditional on live match state; show them all within their windows
    return getMove(f.move.id).hits.filter((h) => inRange(f.move.f, h.f));
  }
}

function drawSpawns(f, def) {
  for (const sp of def.spawn || []) {
    if (st.frame < sp.f) continue;
    const pd = getProj(sp.proj);
    if (!pd) continue;
    const sc = f.scale || 1;
    const x = f.x + (sp.x ?? 60) * f.facing * sc;
    const y = f.y + (sp.y ?? -110) * sc;
    const fresh = st.frame === sp.f;
    if (pd.beam) {
      const bx = f.x + (pd.beam.x || 60) * f.facing;
      const by = f.y + (pd.beam.y || -110);
      strokeBox({ x: f.facing > 0 ? bx : bx - 300, y: by - pd.h / 2, w: 300, h: pd.h }, 'rgba(255,120,0,0.9)', 'rgba(255,120,0,0.12)', [8, 5]);
    } else {
      strokeBox({ x: x - pd.w / 2, y: y - pd.h / 2, w: pd.w, h: pd.h }, 'rgba(255,120,0,0.95)', fresh ? 'rgba(255,120,0,0.3)' : 'rgba(255,120,0,0.08)', fresh ? null : [6, 4]);
      const vx = (sp.vx ?? pd.vx ?? 0) * f.facing;
      const vy = sp.vy ?? pd.vy ?? 0;
      if (vx || vy) {
        ctx.strokeStyle = 'rgba(255,120,0,0.9)';
        ctx.lineWidth = 2 / viewTransform().z;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + vx * 10, y + vy * 10);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(160,70,0,0.95)';
    ctx.font = `${12 / viewTransform().z}px ui-monospace, monospace`;
    ctx.fillText(`▲ ${sp.proj} @${sp.f}`, x - 30, y - pd.h / 2 - 6 / viewTransform().z);
  }
}

// ---- timeline --------------------------------------------------------------------------------------

// projectile moves have no hits of their own: the spawn frame counts as the active frame
function phaseOf(def, fr) {
  if (!def.hits.length) {
    const spawns = (def.spawn || []).map((sp) => sp.f);
    if (!spawns.length) return 'none';
    if (spawns.includes(fr)) return 'active';
    return fr < Math.min(...spawns) ? 'startup' : 'recovery';
  }
  if (def.hits.some((h) => inRange(fr, h.f))) return 'active';
  if (fr < def.firstActive) return 'startup';
  if (fr > def.lastActive) return 'recovery';
  return 'gap';
}

const PHASE_COL = { startup: '#5aa469', active: '#d62828', gap: '#f4a3a3', recovery: '#3a86ff', none: '#c9c1b1', state: '#bdb3a2' };

function frameFlags(fr) {
  const { f } = makePuppet(fr);
  const def = f.move ? getMove(f.move.id) : null;
  return {
    inv: ['strike', 'proj', 'throw'].filter((k) => invulnTo(f, k)),
    armor: !!def && ((def.armor || []).some((w) => inRange(fr, w.f)) || (def.armorF && inRange(fr, def.armorF))),
    parry: !!def?.parry && inRange(fr, def.parry.f),
    spawn: (def?.spawn || []).filter((sp) => sp.f === fr).map((sp) => sp.proj),
    phase: def ? phaseOf(def, fr) : 'state',
  };
}

let flagCache = null;
function timelineFlags() {
  if (!flagCache) {
    flagCache = [];
    for (let i = 0; i < st.clip.len; i++) flagCache.push(frameFlags(st.clip.from + i));
  }
  return flagCache;
}

function cellGeom() {
  const n = st.clip.len;
  const left = 70;
  const w = Math.max(3, Math.min(26, (tl.width - left - 10) / n));
  return { n, left, w };
}

function drawTimeline() {
  const { n, left, w } = cellGeom();
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, tl.width, tl.height);
  const flags = timelineFlags();
  tctx.font = '11px ui-monospace, monospace';
  tctx.fillStyle = '#8a8173';
  tctx.textBaseline = 'middle';
  tctx.fillText('phase', 6, 18);
  tctx.fillText('invuln', 6, 42);
  tctx.fillText('armor', 6, 58);
  tctx.fillText('parry', 6, 74);
  for (let i = 0; i < n; i++) {
    const x = left + i * w;
    const fl = flags[i];
    tctx.fillStyle = PHASE_COL[fl.phase];
    tctx.fillRect(x, 6, w - 1, 24);
    if (fl.inv.length) {
      tctx.fillStyle = fl.inv.length === 3 ? '#9b5de5' : 'rgba(155,93,229,0.5)';
      tctx.fillRect(x, 36, w - 1, 12);
    }
    if (fl.armor) {
      tctx.fillStyle = '#f8961e';
      tctx.fillRect(x, 52, w - 1, 12);
    }
    if (fl.parry) {
      tctx.fillStyle = '#2a9d8f';
      tctx.fillRect(x, 68, w - 1, 12);
    }
    if (fl.spawn.length) {
      tctx.fillStyle = '#e85d04';
      tctx.fillText('▲', x + w / 2 - 4, 88);
    }
    const fr = st.clip.from + i;
    if (w >= 14 || fr % 5 === 0) {
      tctx.fillStyle = fl.phase === 'active' || fl.phase === 'recovery' ? '#fff' : '#1d1a17';
      tctx.textAlign = 'center';
      tctx.fillText(String(fr), x + (w - 1) / 2, 18);
      tctx.textAlign = 'left';
    }
  }
  const cx = left + (st.frame - st.clip.from) * w;
  tctx.strokeStyle = '#1d1a17';
  tctx.lineWidth = 2;
  tctx.strokeRect(cx - 1, 3, w + 1, 80);
}

function frameAtX(px) {
  const { n, left, w } = cellGeom();
  const i = Math.max(0, Math.min(n - 1, Math.floor((px - left) / w)));
  return st.clip.from + i;
}

let scrubbing = false;
tl.addEventListener('pointerdown', (e) => {
  scrubbing = true;
  tl.setPointerCapture(e.pointerId);
  scrubTo(e);
});
tl.addEventListener('pointermove', (e) => scrubbing && scrubTo(e));
tl.addEventListener('pointerup', () => { scrubbing = false; });
function scrubTo(e) {
  const r = tl.getBoundingClientRect();
  setFrame(frameAtX(((e.clientX - r.left) / r.width) * tl.width));
}

// ---- info panel --------------------------------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const win = (r) => (r ? `${r[0]}–${r[1]}` : '—');

function hitFlags(h) {
  const out = [];
  if (h.launch) out.push(`launch ${h.launch.join(', ')}`);
  for (const k of ['unblockable', 'wallBounce', 'groundBounce', 'knockdown', 'grab', 'spike', 'global', 'cine', 'pull']) if (h[k]) out.push(k);
  if (h.effect) out.push(`effect ${typeof h.effect === 'string' ? h.effect : h.effect.kind || 'yes'}`);
  if (h.every) out.push(`every ${h.every}f`);
  if (h.cond) out.push('conditional');
  return out.join(' · ');
}

function moveInfo(def) {
  const active = def.hits.length ? def.lastActive - def.firstActive + 1 : 0;
  const recovery = def.hits.length ? def.dur - def.lastActive : def.dur;
  const rows = def.hits.map((h) => {
    const onHit = h.hitstun - (def.dur - h.f[0]);
    const onBlock = h.blockstun - (def.dur - h.f[0]);
    const sign = (v) => (v >= 0 ? `+${v}` : `${v}`);
    return `<tr><td>${h.i}</td><td>${win(h.f)}</td><td>${h.dmg}</td><td>${h.level}/${h.height}</td><td>${h.hitstun}/${h.blockstun}</td><td>${h.grab ? '—' : `${sign(onHit)} / ${sign(onBlock)}`}</td><td>${h.jc}</td><td>${Math.round(h.chip * 100)}%</td></tr>
      ${hitFlags(h) ? `<tr><td></td><td colspan="7" style="color:#8a8173">${esc(hitFlags(h))}${h.box ? ` · box [${h.box.join(', ')}]` : ''}</td></tr>` : ''}`;
  }).join('');
  const kv = [
    ['id', def.id], ['kind', `${def.kind}${def.cls ? ` (${def.cls})` : ''}`], ['owner', def.owner || 'common'],
    ['startup', def.hits.length ? `${def.firstActive}f` : def.spawn ? `projectile out on ${Math.min(...def.spawn.map((sp) => sp.f))}f` : '—'], ['active', active ? `${active}f` : '—'], ['recovery', `${recovery}f`], ['total', `${def.dur}f`],
    ['anim', Array.isArray(def.anim) ? def.anim.map((k) => `${k[0]}:${k[1]}`).join(' ') : def.anim || 'jab'],
  ];
  if (def.chiCost) kv.push(['chi cost', def.chiCost]);
  if (def.chain?.length) kv.push(['chains into', def.chain.join(', ')]);
  if (def.jumpCancel) kv.push(['jump cancel', 'on hit']);
  if (def.inv) kv.push(['invulnerable', def.inv.map((w) => `${win(w.f)} ${w.kind}`).join(', ')]);
  if (def.armor) kv.push(['armor', def.armor.map((w) => `${win(w.f)} ×${w.hits || 1}`).join(', ')]);
  if (def.parry) kv.push(['parry', `${win(def.parry.f)} vs ${(def.parry.vs || ['strike', 'proj']).join('/')}${def.parry.then ? ` → ${def.parry.then}` : ''}`]);
  if (def.hurtNone) kv.push(['no hurtbox', win(def.hurtNone)]);
  if (def.lowProfile) kv.push(['low profile', win(def.lowProfile)]);
  if (def.hurtExt) kv.push(['hurtbox ext', def.hurtExt.map((e) => `${win(e.f)} [${e.box.join(', ')}]`).join('; ')]);
  if (def.vel) kv.push(['velocity', def.vel.map((v) => `${win(v.f)}${v.vx != null ? ` vx ${v.vx}` : ''}${v.vy != null ? ` vy ${v.vy}` : ''}`).join('; ')]);
  if (def.spawn) kv.push(['spawns', def.spawn.map((sp) => `${sp.proj} @${sp.f}`).join(', ')]);
  if (def.teleport) kv.push(['teleport', `@${def.teleport.f}${def.teleport.behind ? ' behind' : ''}`]);
  if (def.cine) kv.push(['cinematic', `${def.cine.dur}f scripted scene (not shown)`]);
  if (def.shout) kv.push(['shout', def.shout]);
  return `
    <h2>${esc(def.glyph || '')} ${esc(def.name)}</h2>
    ${def.desc ? `<div style="margin-bottom:6px">${esc(def.desc)}</div>` : ''}
    <div class="kv">${kv.map(([k, v]) => `<span>${esc(k)}</span><span>${esc(v)}</span>`).join('')}</div>
    ${def.hits.length ? `<h2 style="margin-top:10px">Hits</h2>
    <table><tr><th>#</th><th>frames</th><th>dmg</th><th>level</th><th>stun h/b</th><th>adv h / b</th><th>jc</th><th>chip</th></tr>${rows}</table>
    <div style="color:#8a8173;font-size:11px;margin-top:3px">Advantage assumes the hit connects on its first active frame (hit-stop excluded), like the training-mode readout.</div>` : ''}`;
}

function poseCode(name, p) {
  const r = (v) => Math.round(v);
  const parts = [];
  for (const k of ['hx', 'hy', 't', 'h', 'rot']) if (r(p[k]) !== 0 || k === 't') parts.push(`${k}: ${r(p[k])}`);
  for (const k of ['aF', 'aB', 'lF', 'lB']) parts.push(`${k}: [${r(p[k][0])}, ${r(p[k][1])}]`);
  return `${name}: D({ ${parts.join(', ')} }),`;
}

const LAB_KEYS = [['t', -90, 90], ['h', -90, 90], ['hx', -60, 60], ['hy', -60, 80], ['rot', -180, 180],
  ['aF.0', -200, 220], ['aF.1', -220, 240], ['aB.0', -200, 220], ['aB.1', -220, 240],
  ['lF.0', -120, 140], ['lF.1', -120, 140], ['lB.0', -120, 140], ['lB.1', -120, 140]];

function poseLab(name) {
  const p = POSES[name];
  const wrap = document.createElement('div');
  wrap.className = 'lab';
  wrap.innerHTML = `<h2>Pose lab: ${esc(name)}</h2><div style="color:#8a8173;margin-bottom:4px">Edits apply live to every move that uses this pose (in memory only). Copy the line into POSES in render/pose.js to keep it.</div>`;
  const code = document.createElement('pre');
  const refresh = () => { code.textContent = poseCode(name, p); };
  for (const [key, lo, hi] of LAB_KEYS) {
    const [k, idx] = key.split('.');
    const get = () => (idx == null ? p[k] : p[k][Number(idx)]);
    const lab = document.createElement('label');
    const out = document.createElement('output');
    const inp = document.createElement('input');
    Object.assign(inp, { type: 'range', min: lo, max: hi, step: 1, value: get() });
    out.textContent = Math.round(get());
    inp.addEventListener('input', () => {
      const v = Number(inp.value);
      if (idx == null) p[k] = v;
      else p[k][Number(idx)] = v;
      out.textContent = v;
      refresh();
      flagCache = null;
      updateNow();
    });
    lab.append(Object.assign(document.createElement('span'), { textContent: key }), inp, out);
    wrap.append(lab);
  }
  const row = document.createElement('div');
  row.className = 'row';
  const copy = Object.assign(document.createElement('button'), { textContent: 'Copy line' });
  copy.onclick = () => navigator.clipboard?.writeText(code.textContent);
  const reset = Object.assign(document.createElement('button'), { textContent: 'Reset pose' });
  reset.onclick = () => {
    POSES[name] = structuredClone(POSE_BACKUP[name]);
    showInfo();
  };
  row.append(copy, reset);
  refresh();
  wrap.append(code, row);
  return wrap;
}

function showInfo() {
  const info = $('info');
  const c = st.clip;
  info.innerHTML = '';
  if (c.kind === 'move') info.insertAdjacentHTML('beforeend', moveInfo(getMove(c.id)));
  else if (c.kind === 'state') info.insertAdjacentHTML('beforeend', `<h2>${esc(c.name)}</h2><div class="kv"><span>state</span><span>${esc(c.id)}</span><span>frames</span><span>${c.len}</span></div>`);
  const now = document.createElement('div');
  now.className = 'now';
  now.id = 'now';
  info.append(now);
  const cur = document.createElement('pre');
  cur.id = 'curPose';
  info.append(Object.assign(document.createElement('h2'), { textContent: 'Pose this frame' }), cur);
  if (c.kind === 'pose') info.append(poseLab(c.id));
  updateNow();
}

function updateNow() {
  const fr = st.frame;
  const fl = frameFlags(fr);
  const { f, ex } = makePuppet(fr);
  const lines = [`frame ${fr}${st.clip.kind === 'move' ? ` of ${st.clip.len}` : ''} · ${fl.phase}`];
  if (f.move) {
    const hits = safeActiveHits(f);
    if (hits.length) lines.push(`active: ${hits.map((h) => `#${h.i} ${h.dmg}dmg ${h.height}`).join(', ')}`);
  }
  if (fl.inv.length) lines.push(`invulnerable to: ${fl.inv.join(', ')}`);
  if (fl.armor) lines.push('armored');
  if (fl.parry) lines.push('parry window');
  if (fl.spawn.length) lines.push(`spawns: ${fl.spawn.join(', ')}`);
  $('now').textContent = lines.join('\n');
  $('curPose').textContent = poseCode(st.clip.kind === 'pose' ? st.clip.id : 'pose', poseOf(f, ex));
  $('frameLbl').textContent = `${st.clip.name} · frame ${fr}${st.clip.kind !== 'pose' ? ` / ${st.clip.from + st.clip.len - 1}` : ''}`;
}

// ---- selection and transport --------------------------------------------------------------------------

function fillChars() {
  $('char').innerHTML = CHAR_IDS.map((id) => `<option value="${id}">${esc(CHARACTERS[id].name)}</option>`).join('');
}

function fillBuilds() {
  $('build').innerHTML = presetsFor(st.charId).map((b, i) => `<option value="${i}">${esc(b.name)}</option>`).join('');
  $('build').value = String(st.build);
  $('youthWrap').style.display = st.charId === 'longxu' ? '' : 'none';
  $('drunkWrap').style.display = st.charId === 'jiugui' ? '' : 'none';
}

function fillClips() {
  st.groups = clipsFor(st.charId);
  const box = $('clips');
  box.innerHTML = '';
  for (const [name, clips] of st.groups) {
    box.append(Object.assign(document.createElement('div'), { className: 'grp', textContent: name }));
    for (const c of clips) {
      const b = document.createElement('button');
      b.className = 'clip';
      b.dataset.key = `${c.kind}:${c.id}`;
      b.innerHTML = `${esc(c.name)} <small>${c.kind === 'move' ? `${c.len}f` : c.kind === 'state' ? `${c.len}f` : ''}</small>`;
      b.onclick = () => selectClip(c);
      box.append(b);
    }
  }
}

function allClips() {
  return st.groups.flatMap(([, clips]) => clips);
}

function selectClip(c, frame = null) {
  st.clip = c;
  flagCache = null;
  for (const b of document.querySelectorAll('#clips .clip')) b.classList.toggle('sel', b.dataset.key === `${c.kind}:${c.id}`);
  document.querySelector('#clips .clip.sel')?.scrollIntoView({ block: 'nearest' });
  st.frame = frame != null ? clampFrame(frame) : c.from;
  showInfo();
  saveHash();
}

function clampFrame(fr) {
  return Math.max(st.clip.from, Math.min(st.clip.from + st.clip.len - 1, fr));
}

function setFrame(fr) {
  st.frame = clampFrame(fr);
  updateNow();
  saveHash();
}

function step(d) {
  const { from, len } = st.clip;
  let fr = st.frame + d;
  if (fr > from + len - 1) fr = $('loop').checked ? from : from + len - 1;
  if (fr < from) fr = $('loop').checked ? from + len - 1 : from;
  setFrame(fr);
}

function setPlaying(on) {
  st.playing = on;
  $('play').textContent = on ? '⏸ Pause' : '▶ Play';
  $('play').classList.toggle('on', on);
}

function saveHash() {
  const p = new URLSearchParams({ c: st.charId, b: st.build, k: st.clip.kind, m: st.clip.id, f: st.frame });
  history.replaceState(null, '', `#${p}`);
}

function loadHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (CHAR_IDS.includes(p.get('c'))) st.charId = p.get('c');
  st.build = Math.max(0, Math.min(presetsFor(st.charId).length - 1, Number(p.get('b')) || 0));
  return { kind: p.get('k'), id: p.get('m'), frame: p.has('f') ? Number(p.get('f')) : null };
}

function changeChar(id) {
  st.charId = id;
  st.build = 0;
  fillBuilds();
  const prev = st.clip;
  fillClips();
  const same = prev && allClips().find((c) => c.kind === prev.kind && c.id === prev.id);
  selectClip(same || allClips()[0], same ? st.frame : null);
}

$('char').onchange = (e) => changeChar(e.target.value);
$('build').onchange = (e) => {
  st.build = Number(e.target.value);
  flagCache = null;
  updateNow();
  saveHash();
};
for (const id of ['awake', 'youth', 'drunk', 'flip']) $(id).addEventListener('input', () => { flagCache = null; updateNow(); });
$('play').onclick = () => setPlaying(!st.playing);
$('prev').onclick = () => step(-1);
$('next').onclick = () => step(1);
$('first').onclick = () => setFrame(st.clip.from);
$('last').onclick = () => setFrame(st.clip.from + st.clip.len - 1);

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;
  if (e.target.tagName === 'SELECT') return;
  const clips = allClips();
  const idx = clips.indexOf(st.clip);
  const toggle = (id) => {
    $(id).checked = !$(id).checked;
    flagCache = null;
  };
  if (document.activeElement?.tagName === 'BUTTON') document.activeElement.blur();
  switch (e.code) {
    case 'ArrowLeft': step(-1); break;
    case 'ArrowRight': step(1); break;
    case 'ArrowUp': selectClip(clips[(idx + clips.length - 1) % clips.length]); break;
    case 'ArrowDown': selectClip(clips[(idx + 1) % clips.length]); break;
    case 'Space': setPlaying(!st.playing); break;
    case 'Home': setFrame(st.clip.from); break;
    case 'End': setFrame(st.clip.from + st.clip.len - 1); break;
    case 'KeyF': toggle('flip'); break;
    case 'KeyO': toggle('onion'); break;
    case 'KeyJ': toggle('showJoints'); break;
    default: return;
  }
  e.preventDefault();
});

// keep the canvases' backing stores matched to their on-screen size
function fitCanvas(c) {
  const r = c.getBoundingClientRect();
  const w = Math.max(200, Math.round(r.width));
  const h = Math.max(60, Math.round(r.height));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
}

let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = last ? Math.min(100, now - last) : 16;
  last = now;
  st.t += dt / (1000 / 60);
  if (st.playing && st.clip.kind !== 'pose') {
    st.acc += (dt / (1000 / 60)) * Number($('speed').value);
    while (st.acc >= 1) {
      st.acc -= 1;
      step(1);
    }
  }
  fitCanvas(view);
  fitCanvas(tl);
  render();
  drawTimeline();
}

// ---- boot ----------------------------------------------------------------------------------------------

// the URL hash holds fighter, build, clip and frame, so a link opens exactly that frame
function openFromHash() {
  const want = loadHash();
  $('char').value = st.charId;
  fillBuilds();
  fillClips();
  const clip = allClips().find((c) => c.kind === want.kind && c.id === want.id) || allClips().find((c) => c.kind === 'move' && c.id === 'sH');
  selectClip(clip, want.frame);
}

fillChars();
openFromHash();
window.addEventListener('hashchange', openFromHash);
requestAnimationFrame(loop);

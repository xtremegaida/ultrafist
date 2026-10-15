// Character select, stage select and the arcade VS splash.

import { h, btn, toast } from './dom.js';
import { audio } from '../audio/audio.js';
import { CHARACTERS, CHAR_IDS } from '../data/characters/index.js';
import { STAGES, STAGE_IDS } from '../data/stages.js';
import { AI_TIERS } from '../data/aiTiers.js';
import { STANCES } from '../data/stances.js';
import { INNER_ARTS } from '../data/innerArts.js';
import { getMove } from '../data/registry.js';
import { buildsFor } from './buildStore.js';
import { resolveBuild } from '../sim/builds.js';
import { drawPortrait, drawFighter, propsOf } from '../render/skins.js';
import { poseFor, solve } from '../render/pose.js';
import { readDevice } from '../input/devices.js';
import { showMainMenu } from './title.js';

export function portraitCanvas(charId, cos, size = 130, face = 'fierce') {
  const c = h('canvas', { width: size, height: size });
  const g = c.getContext('2d');
  drawPortrait(g, charId, cos || CHARACTERS[charId].colors, size / 2, size * 0.48, size * 0.9, face);
  return c;
}

export function drawPreview(g, charId, cos, t, w, hgt, pose = 'idle') {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, hgt);
  const fake = { charId, st: pose, stT: t, x: 0, y: 0, vx: 0, vy: 0, facing: 1, scale: 1, air: false, buffs: [], status: {}, char: { drunk: 2 }, awakened: 0, move: null, chi: 0, guarding: false };
  const J = solve(poseFor(fake), propsOf(charId, fake), true);
  g.save();
  g.translate(w / 2, hgt - 14);
  const sc = (hgt - 30) / 240;
  g.scale(sc * (CHARACTERS[charId].size || 1), sc * (CHARACTERS[charId].size || 1));
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath();
  g.ellipse(0, 4, 60, 10, 0, 0, Math.PI * 2);
  g.fill();
  drawFighter(g, fake, J, { cos, t });
  g.restore();
}

function statBar(label, v) {
  return h('div', { class: 'statbar' }, h('span', { style: { width: '34px' } }, label), h('div', { class: 'bar' }, h('span', { style: { width: `${v * 10}%` } })), h('span', {}, v));
}

// mode: 'arcade' | 'cpu' | 'local' | 'training'
export function showCharSelect(app, { mode }) {
  const twoHumans = mode === 'local';
  const cur = [
    { idx: 0, locked: false, build: 0, level: app.settings.cpuLevel ?? 2 },
    { idx: 5, locked: false, build: 0, level: app.settings.cpuLevel ?? 2 },
  ];
  // in single-player modes, P1 picks the opponent too
  let phase = 'p1'; // p1 | p2 | level | done
  const cards = [];
  const grid = h('div', { class: 'select-grid' });
  CHAR_IDS.forEach((id, i) => {
    const ch = CHARACTERS[id];
    const card = h('button', { class: 'char-card', 'data-nav': '1' },
      portraitCanvas(id, ch.colors, 130),
      h('span', { class: 'gl' }, ch.glyph),
      h('span', { class: 'nm' }, ch.short.toUpperCase()));
    card.addEventListener('click', () => {
      const side = twoHumans ? (cur[0].locked ? 1 : 0) : phase === 'p1' ? 0 : 1;
      if (phase === 'level' || phase === 'done') return;
      cur[side].idx = i;
      confirm(side);
    });
    card.addEventListener('mouseenter', () => {
      const side = twoHumans ? (cur[0].locked ? 1 : 0) : phase === 'p1' ? 0 : 1;
      if (cur[side].locked) return;
      cur[side].idx = i;
      refresh();
    });
    cards.push(card);
    grid.appendChild(card);
  });

  const sides = [0, 1].map((side) => {
    const prev = h('canvas', { width: 260, height: 190 });
    const box = h('div', { class: `sel-side panel ${side === 0 ? 'left' : 'right'}` });
    return { box, prev, t: 0 };
  });

  const titleTxt = { arcade: 'Path of the Ultimate Fist', cpu: 'Versus CPU', local: 'Local Versus', training: 'Training Dojo' }[mode];
  const help = twoHumans
    ? 'P1: WASD move · J pick · L change build · K back      P2: Arrows move · Num1 pick · Num3 build · Num2 back'
    : 'Move: WASD / Arrows / D-pad · Pick: J / Enter / A · Change build: L · Back: K / Esc';
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'screen-title' }, h('span', { class: 'cjk' }, '選'), titleTxt.toUpperCase()),
    h('div', { class: 'subtitle' }, mode === 'training' ? 'Choose your fighter, then the training dummy.' : twoHumans ? 'Both players choose at once.' : 'Choose your fighter, then your opponent.'),
    grid,
    sides[0].box,
    sides[1].box,
    h('div', { class: 'footer-hint' }, help));

  function buildList(side) {
    return buildsFor(CHAR_IDS[cur[side].idx]);
  }

  function renderSide(side) {
    const s = sides[side];
    const c = cur[side];
    const id = CHAR_IDS[c.idx];
    const ch = CHARACTERS[id];
    const list = buildList(side);
    if (c.build >= list.length) c.build = 0;
    const b = resolveBuild(list[c.build]);
    const isCpu = !twoHumans && side === 1;
    const label = isCpu ? (mode === 'training' ? 'DUMMY' : 'CPU') : `PLAYER ${side + 1}`;
    s.box.innerHTML = '';
    const sel = h('select', { 'data-nav': '1', onchange: (e) => { c.build = Number(e.target.value); refresh(); } },
      list.map((bb, i) => h('option', { value: i, selected: i === c.build ? true : null }, `${bb.preset ? '★ ' : ''}${bb.name}`)));
    s.box.append(
      h('div', { class: `who p${side + 1}` }, label),
      s.prev,
      h('div', { class: 'big' }, ch.name.toUpperCase()),
      h('div', { class: 'ttl' }, `${ch.glyph} · "${ch.title}" · ${ch.archetype}`),
      h('div', { class: 'stats' }, statBar('POW', b.stats.pow), statBar('SPD', b.stats.spd), statBar('DEF', b.stats.def), statBar('CHI', b.stats.chi)),
      h('div', { class: 'row' }, h('label', {}, 'Build'), sel),
      h('div', { class: 'desc-text' }, `${STANCES[b.stance].glyph} ${STANCES[b.stance].name} stance · ${b.arts.map((a) => INNER_ARTS[a].name).join(' + ') || 'no inner arts'}`),
      h('div', { class: 'desc-text' }, `Ultra: ${getMove(b.ultra).name}`),
    );
    if (isCpu && mode !== 'training') {
      const lv = h('div', { class: 'tabs' }, AI_TIERS.map((tier, i) => {
        const bb = btn(tier.glyph, () => { c.level = i; refresh(); }, { class: `small ${c.level === i ? 'selected' : ''}`, title: tier.name });
        return bb;
      }));
      s.box.append(h('div', { class: 'desc-text' }, `Difficulty: ${AI_TIERS[c.level].name}`), lv);
    }
    if (isCpu && mode === 'training') {
      s.box.append(h('div', { class: 'desc-text' }, 'Dummy behaviour can be changed in the dojo panel.'));
    }
    if (c.locked) s.box.append(h('div', { class: 'row' }, h('div', { class: 'ready-stamp' }, '定'), h('div', { class: 'big' }, 'READY')));
    if (phase === 'level' && isCpu) s.box.append(h('div', { class: 'desc-text', style: { color: '#c8102e' } }, '← → choose difficulty, then confirm'));
  }

  function refresh() {
    cards.forEach((card, i) => {
      card.classList.toggle('hover-p1', cur[0].idx === i);
      card.classList.toggle('hover-p2', cur[1].idx === i && (twoHumans || phase !== 'p1'));
      for (const c of card.querySelectorAll('.cursor')) c.remove();
      if (cur[0].idx === i) card.appendChild(h('span', { class: 'cursor p1' }, '1P'));
      if (cur[1].idx === i && (twoHumans || phase !== 'p1')) card.appendChild(h('span', { class: 'cursor p2' }, twoHumans ? '2P' : 'CPU'));
    });
    renderSide(0);
    renderSide(1);
  }

  function move(side, dx, dy) {
    const c = cur[side];
    if (c.locked) return;
    const col = c.idx % 4;
    const row = Math.floor(c.idx / 4);
    const nc = (col + dx + 4) % 4;
    const nr = (row + dy + 2) % 2;
    c.idx = nr * 4 + nc;
    c.build = 0;
    audio.sfx('uiMove');
    refresh();
  }

  function cycleBuild(side) {
    const c = cur[side];
    if (c.locked) return;
    c.build = (c.build + 1) % buildList(side).length;
    audio.sfx('uiMove');
    refresh();
  }

  function confirm(side) {
    const c = cur[side];
    if (phase === 'level') {
      phase = 'done';
      audio.sfx('uiSelect');
      return proceed();
    }
    if (c.locked) return;
    c.locked = true;
    audio.sfx('uiSelect');
    const ch = CHARACTERS[CHAR_IDS[c.idx]];
    if (ch.voice?.animal) audio.animal(ch.voice.animal);
    else audio.speech.say(ch.short, { pitch: ch.voice?.pitch ?? 1, rate: 1, priority: 'shout', side });
    if (twoHumans) {
      if (cur[0].locked && cur[1].locked) return proceed();
    } else if (phase === 'p1') {
      if (mode === 'arcade') return proceed();
      phase = 'p2';
    } else if (phase === 'p2') {
      if (mode === 'training') return proceed();
      phase = 'level';
    }
    refresh();
  }

  function back(side) {
    if (twoHumans) {
      if (cur[side].locked) cur[side].locked = false;
      else if (!cur[0].locked && !cur[1].locked) return app.setScreen(showMainMenu(app));
    } else if (phase === 'level') {
      phase = 'p2';
      cur[1].locked = false;
    } else if (phase === 'p2') {
      phase = 'p1';
      cur[0].locked = false;
    } else return app.setScreen(showMainMenu(app));
    audio.sfx('uiBack');
    refresh();
  }

  function proceed() {
    const builds = [0, 1].map((side) => buildList(side)[cur[side].build]);
    if (mode !== 'local' && mode !== 'arcade') app.settings.cpuLevel = cur[1].level;
    if (mode === 'arcade') return startArcade(app, builds[0]);
    app.setScreen(showStageSelect(app, { mode, builds, level: cur[1].level }));
  }

  // per-player key handling
  const KEYS = [
    { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], ok: ['KeyJ', 'Enter', 'Space'], back: ['KeyK', 'Escape'], build: ['KeyL'] },
    { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], ok: ['Numpad1', 'NumpadEnter'], back: ['Numpad2', 'Backspace'], build: ['Numpad3'] },
  ];
  function activeSide(rawSide) {
    if (twoHumans) return rawSide;
    return phase === 'p1' ? 0 : 1;
  }
  function act(rawSide, action) {
    const side = activeSide(rawSide);
    if (!twoHumans && rawSide === 1) {
      // in single-player modes, the arrow keys also drive the menu
    }
    if (phase === 'level' && side === 1) {
      if (action === 'left') cur[1].level = Math.max(0, cur[1].level - 1);
      if (action === 'right') cur[1].level = Math.min(AI_TIERS.length - 1, cur[1].level + 1);
      if (action === 'ok') return confirm(1);
      if (action === 'back') return back(1);
      audio.sfx('uiMove');
      return refresh();
    }
    if (action === 'up') move(side, 0, -1);
    if (action === 'down') move(side, 0, 1);
    if (action === 'left') move(side, -1, 0);
    if (action === 'right') move(side, 1, 0);
    if (action === 'ok') confirm(side);
    if (action === 'back') back(side);
    if (action === 'build') cycleBuild(side);
  }
  const onKey = (e) => {
    if (e.target?.tagName === 'SELECT') return false;
    for (const side of [0, 1]) {
      for (const [action, codes] of Object.entries(KEYS[side])) {
        if (codes.includes(e.code)) {
          e.preventDefault();
          act(side, action);
          return true;
        }
      }
    }
    return false;
  };

  const prevPad = [{}, {}];
  let lastT = 0;
  const poll = (now) => {
    for (const side of [0, 1]) {
      const a = readDevice(`pad${side}`);
      const p = prevPad[side];
      for (const [k, action] of [['up', 'up'], ['down', 'down'], ['left', 'left'], ['right', 'right'], ['confirm', 'ok'], ['back', 'back'], ['hp', 'build']]) {
        if (a[k] && !p[k]) act(side, action);
      }
      prevPad[side] = { ...a };
    }
    if (now - lastT > 33) {
      lastT = now;
      for (const side of [0, 1]) {
        const s = sides[side];
        s.t += 2;
        const c = cur[side];
        const id = CHAR_IDS[c.idx];
        const b = resolveBuild(buildList(side)[c.build] || {});
        drawPreview(s.prev.getContext('2d'), id, b.cos, s.t, 260, 190, c.locked ? 'win' : 'idle');
      }
    }
  };

  refresh();
  audio.music.play('select');
  return { el, nav: false, onKey, poll, back: () => back(0), noAutoFocus: true };
}

// ---------------------------------------------------------------------------------------------

const stageThumbs = {};
function stageThumb(id) {
  if (stageThumbs[id]) return stageThumbs[id];
  const c = h('canvas', { width: 260, height: 146 });
  const g = c.getContext('2d');
  // draw a mini background using the real stage renderer
  import('../render/stages.js').then(({ drawBackground, drawFloor }) => {
    const big = document.createElement('canvas');
    big.width = 1280;
    big.height = 720;
    const bg = big.getContext('2d');
    const cam = { x: 800, y: 0, zoom: 1, shakeX: 0, shakeY: 0, punch: 0 };
    drawBackground(bg, cam, id, 0);
    bg.setTransform(1.333, 0, 0, 1.333, 640 - 800 * 1.333, 720 * 0.88);
    drawFloor(bg, id, 0, 1600);
    g.drawImage(big, 0, 0, 260, 146);
  });
  stageThumbs[id] = c;
  return c;
}

export function showStageSelect(app, { mode, builds, level }) {
  const choose = (stageId) => {
    const sid = stageId === 'random' ? STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] : stageId;
    const seats = mode === 'local'
      ? [{ type: 'human', devices: ['kb1', 'pad0'] }, { type: 'human', devices: ['kb2', 'pad1'] }]
      : mode === 'training'
        ? [{ type: 'human', devices: ['kb1', 'kb2', 'pad0'] }, { type: 'dummy', mode: 'stand' }]
        : [{ type: 'human', devices: ['kb1', 'kb2', 'pad0'] }, { type: 'cpu', level }];
    app.startMatch({ mode, builds, seats, stageId: sid, training: mode === 'training' ? { refill: true } : null });
  };
  const cards = STAGE_IDS.map((id) => {
    const st = STAGES[id];
    const b = h('button', { class: 'stage-card', 'data-nav': '1', title: st.desc },
      stageThumb(id),
      h('span', { class: 'nm' }, h('span', { class: 'cjk' }, st.glyph), st.name));
    b.addEventListener('click', () => {
      audio.sfx('uiSelect');
      choose(id);
    });
    return b;
  });
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'screen-title' }, h('span', { class: 'cjk' }, '場'), 'CHOOSE YOUR ARENA'),
    h('div', { class: 'stage-grid' }, cards),
    h('div', { style: { marginTop: '18px' } }, btn('Random Arena', () => choose('random'), { glyph: '隨' })),
    h('div', { class: 'footer-hint' }, 'Each arena has its own hazards. Heavenly Events can be tuned in Settings.'));
  return { el, back: () => app.setScreen(showCharSelect(app, { mode })) };
}

// ---------------------------------------------------------------------------------------------
// Arcade ladder

const TAUNTS = [
  'has heard your kung fu is "fine".',
  'has been waiting on this mountain for 300 years.',
  'is mostly here for the snacks.',
  'trained for this moment since breakfast.',
  'does not believe in you.',
  'is your final, slightly confusing obstacle.',
];

export function startArcade(app, playerBuild) {
  const pid = playerBuild.charId;
  const others = CHAR_IDS.filter((c) => c !== pid);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const ladder = others.slice(0, 6).map((c, i) => ({ charId: c, level: [0, 1, 1, 2, 2, 3][i] }));
  ladder.push({ charId: pid, level: 4, boss: true });
  app.arcade = { playerBuild, ladder, stage: 0, continues: 0 };
  app.setScreen(showVersus(app));
}

export function showVersus(app) {
  const ar = app.arcade;
  const fight = ar.ladder[ar.stage];
  const oppBuilds = buildsFor(fight.charId);
  const oppBuild = fight.boss ? { ...oppBuilds[1], name: 'Heavenly Demon', cosmetic: { c1: '#16120f', c2: '#c8102e', aura: '#ff4d6d', head: 'none', cry: 'I AM YOU, BUT WORSE' } } : oppBuilds[Math.floor(Math.random() * oppBuilds.length)];
  const pc = resolveBuild(ar.playerBuild).cos;
  const oc = resolveBuild(oppBuild).cos;
  const opp = CHARACTERS[fight.charId];
  const me = CHARACTERS[ar.playerBuild.charId];
  const stageId = STAGE_IDS[ar.stage % STAGE_IDS.length];
  const go = () => {
    app.startMatch({
      mode: 'arcade', builds: [ar.playerBuild, oppBuild], stageId,
      seats: [{ type: 'human', devices: ['kb1', 'kb2', 'pad0'] }, { type: 'cpu', level: fight.level }],
    });
  };
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'screen-title' }, h('span', { class: 'cjk' }, `第${ar.stage + 1}戰`), fight.boss ? 'FINAL BATTLE' : `BATTLE ${ar.stage + 1} OF ${ar.ladder.length}`),
    h('div', { class: 'row', style: { marginTop: '30px', gap: '40px' } },
      h('div', { class: 'col', style: { alignItems: 'center' } }, portraitCanvas(me.id, pc, 260), h('div', { class: 'big', style: { fontFamily: 'var(--display)', fontSize: '30px' } }, me.short.toUpperCase())),
      h('div', { style: { fontFamily: 'var(--display)', fontSize: '110px', color: '#c8102e' } }, 'VS'),
      h('div', { class: 'col', style: { alignItems: 'center' } }, portraitCanvas(opp.id, oc, 260, 'shout'), h('div', { class: 'big', style: { fontFamily: 'var(--display)', fontSize: '30px' } }, (fight.boss ? 'HEAVENLY DEMON ' + opp.short : opp.short).toUpperCase()))),
    h('div', { class: 'panel', style: { marginTop: '20px', maxWidth: '760px', textAlign: 'center' } },
      h('div', { class: 'desc-text', style: { fontSize: '18px' } }, fight.boss ? 'Your own shadow, consumed by the Heavenly Demon technique. It knows all your moves. It is also slightly taller.' : `${opp.name} ${TAUNTS[ar.stage % TAUNTS.length]}`),
      h('div', { class: 'desc-text' }, `Arena: ${STAGES[stageId].name} · Difficulty: ${AI_TIERS[fight.level].name}`)),
    h('div', { style: { marginTop: '18px' } }, btn('FIGHT!', go, { glyph: '戰' })));
  audio.sfx('gong');
  setTimeout(() => audio.speech.say(`${me.short} versus ${fight.boss ? 'the Heavenly Demon' : opp.short}`, { pitch: 0.6, rate: 0.9, priority: 'announcer' }), 300);
  return { el, back: () => app.quitToMenu() };
}

export function showArcadeEnding(app) {
  const me = CHARACTERS[app.arcade.playerBuild.charId];
  const pc = resolveBuild(app.arcade.playerBuild).cos;
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'screen-title' }, h('span', { class: 'cjk' }, '天下第一'), 'NUMBER ONE UNDER HEAVEN'),
    h('div', { class: 'row', style: { marginTop: '30px', gap: '30px' } },
      portraitCanvas(me.id, pc, 300, 'happy'),
      h('div', { class: 'panel', style: { maxWidth: '560px' } },
        h('div', { class: 'quote' }, `"${me.quote}"`),
        h('p', { class: 'desc-text', style: { fontSize: '17px' } }, `${me.name} has defeated every master, beast and demon in the land. The scrolls will speak of this day. Mostly in footnotes, but still.`),
        h('p', { class: 'desc-text' }, `Continues used: ${app.arcade.continues}`))),
    h('div', { style: { marginTop: '20px' } }, btn('Return to the Dojo', () => app.quitToMenu(), { glyph: '歸' })));
  audio.music.play('victory');
  audio.sfx('bigGong');
  toast('You have mastered the Path of the Ultimate Fist!');
  return { el, back: () => app.quitToMenu() };
}

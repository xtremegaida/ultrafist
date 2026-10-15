// In-match screens: pause, move list, results, training dojo panel.

import { h, btn } from './dom.js';
import { audio } from '../audio/audio.js';
import { CHARACTERS } from '../data/characters/index.js';
import { getMove } from '../data/registry.js';
import { STANCES } from '../data/stances.js';
import { INNER_ARTS } from '../data/innerArts.js';
import { AI_TIERS } from '../data/aiTiers.js';
import { resolveBuild } from '../sim/builds.js';
import { BTN } from '../sim/input.js';
import { frameDataText } from '../render/debug.js';
import { showCharSelect, portraitCanvas, showVersus, showArcadeEnding } from './select.js';

const MOTION_TXT = { N: '←↙↓↘→ S', F: '↓↘→ S', B: '↓↙← S', U: '→↓↘ S', D: '↓↓ S' };
const SIMPLE_TXT = { N: 'S', F: '→ + S', B: '← + S', U: '↑ + S', D: '↓ + S' };

export function moveListTable(build) {
  const b = resolveBuild(build);
  const rows = ['N', 'F', 'B', 'U', 'D'].map((slot) => {
    const def = getMove(b.slots[slot]);
    return h('tr', {},
      h('td', {}, h('span', { class: 'cjk', style: { fontFamily: 'var(--cjk)', color: '#c8102e', marginRight: '6px' } }, def.glyph || ''), def.name, def.scroll ? ' 卷' : ''),
      h('td', {}, h('span', { class: 'kbd' }, SIMPLE_TXT[slot])),
      h('td', {}, h('span', { class: 'kbd' }, MOTION_TXT[slot]), ' 真'),
      h('td', { class: 'desc-text' }, def.desc || ''));
  });
  const u = getMove(b.ultra);
  rows.push(h('tr', {},
    h('td', {}, h('b', {}, `極 ${u.name}`)),
    h('td', {}, h('span', { class: 'kbd' }, 'H + S')),
    h('td', {}, h('span', { class: 'kbd' }, '↓↘→↓↘→ S'), ' 真'),
    h('td', { class: 'desc-text' }, `${u.desc || ''} Costs 3 chi bars (2 while Awakened).`)));
  return h('div', {},
    h('div', { class: 'desc-text', style: { marginBottom: '6px' } }, `${STANCES[b.stance].glyph} ${STANCES[b.stance].name}: ${STANCES[b.stance].desc}`),
    b.arts.length ? h('div', { class: 'desc-text', style: { marginBottom: '6px' } }, b.arts.map((a) => `${INNER_ARTS[a].name}: ${INNER_ARTS[a].desc}`).join('  ·  ')) : null,
    h('table', { class: 'ink' },
      h('tr', {}, h('th', {}, 'Technique'), h('th', {}, 'Simple'), h('th', {}, 'Authentic (+15%)'), h('th', {}, '')),
      rows),
    h('div', { class: 'desc-text', style: { marginTop: '8px' } },
      'Universal: Throw L+H · Qi Burst L+S while being hit (2 bars) · Taunt T · Dash: double-tap · Launcher: ↓+H then jump · Chi Cancel: special into special (1 bar).'));
}

export function showPause(app) {
  const sess = app.session;
  const resume = () => {
    sess.paused = false;
    sess.last = 0;
    if (app.match?.training) app.setScreen(showTrainingPanel(app));
    else app.setScreen({ el: null, nav: false, onKey: () => false });
  };
  const restart = () => app.startMatch({ ...app.match });
  const builds = app.match.builds;
  const list = h('div', { class: 'panel scroll-area', style: { display: 'none', maxHeight: '420px', width: '980px', marginTop: '12px' } });
  let listSide = 0;
  const showList = () => {
    list.style.display = 'block';
    list.innerHTML = '';
    const ch = CHARACTERS[builds[listSide].charId];
    list.append(h('div', { class: 'row' }, h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, ch.glyph), `${ch.name} — ${resolveBuild(builds[listSide]).name}`),
      h('span', { class: 'spacer' }), btn('Other fighter', () => { listSide = 1 - listSide; showList(); }, { class: 'small' })),
    moveListTable(builds[listSide]));
  };
  const el = h('div', { class: 'screen dim' },
    h('div', { class: 'menu panel pause-box', style: { marginTop: '60px' } },
      h('div', { class: 'screen-title', style: { marginTop: 0, fontSize: '40px' } }, h('span', { class: 'cjk' }, '停'), 'PAUSED'),
      btn('Resume', resume, { glyph: '續' }),
      btn('Move List', showList, { glyph: '譜' }),
      btn('Restart Match', restart, { glyph: '再' }),
      btn('Quit to Menu', () => app.quitToMenu(), { glyph: '退' })),
    list);
  audio.sfx('uiBack');
  return {
    el,
    back: resume,
    onKey: (e) => {
      if (e.code === 'Escape' || e.code === 'NumpadEnter') {
        resume();
        return true;
      }
      return false;
    },
  };
}

export function showResults(app, v) {
  const m = app.match;
  const w = v.winner;
  const W = v.fighters[w];
  const ch = CHARACTERS[W.charId];
  const statsTable = h('table', { class: 'ink' },
    h('tr', {}, h('th', {}, ''), h('th', {}, CHARACTERS[v.fighters[0].charId].short), h('th', {}, CHARACTERS[v.fighters[1].charId].short)),
    [['Damage dealt', 'dealt'], ['Max combo', 'maxCombo'], ['Specials', 'specials'], ['Authentic 真', 'authentic'], ['Ultras 極', 'ultras']].map(([label, key]) =>
      h('tr', {}, h('td', {}, label), h('td', {}, v.fighters[0].stat[key]), h('td', {}, v.fighters[1].stat[key]))));
  const humanWon = m.mode === 'local' || m.seats[w]?.type === 'human';
  const buttons = [];
  if (m.mode === 'arcade') {
    const ar = app.arcade;
    if (humanWon) {
      if (ar.stage + 1 >= ar.ladder.length) buttons.push(btn('Claim Your Title', () => app.setScreen(showArcadeEnding(app)), { glyph: '冠' }));
      else buttons.push(btn('Next Battle', () => {
        ar.stage++;
        app.stopSession();
        app.setScreen(showVersus(app));
      }, { glyph: '進' }));
    } else {
      buttons.push(btn('Continue', () => {
        ar.continues++;
        app.startMatch({ ...m });
      }, { glyph: '續', desc: 'Try this battle again.' }));
    }
    buttons.push(btn('Give Up', () => app.quitToMenu(), { glyph: '退' }));
  } else {
    buttons.push(btn('Rematch', () => app.startMatch({ ...m }), { glyph: '再' }));
    buttons.push(btn('Character Select', () => {
      app.stopSession();
      app.startAttract();
      app.setScreen(showCharSelect(app, { mode: m.mode }));
    }, { glyph: '選' }));
    buttons.push(btn('Main Menu', () => app.quitToMenu(), { glyph: '退' }));
  }
  const el = h('div', { class: 'screen dim' },
    h('div', { class: 'results' },
      h('div', { class: 'panel col', style: { alignItems: 'center' } },
        h('div', { class: 'screen-title', style: { marginTop: 0 } }, h('span', { class: 'cjk' }, '勝'), `${ch.short.toUpperCase()} WINS`),
        portraitCanvas(W.charId, m.cos?.[w], 240, 'happy'),
        h('div', { class: 'quote' }, `"${ch.quote}"`)),
      h('div', { class: 'panel col' },
        h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '錄'), 'MATCH RECORD'),
        statsTable,
        h('div', { class: 'menu', style: { width: '100%', marginTop: '14px' } }, buttons))));
  return { el, back: () => app.quitToMenu() };
}

// ---------------------------------------------------------------------------------------------
// Training dojo

const DIRS = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '·', 6: '→', 7: '↖', 8: '↑', 9: '↗' };

function byteText(b, facing) {
  let x = (b & BTN.R ? 1 : 0) - (b & BTN.L ? 1 : 0);
  const y = (b & BTN.U ? 1 : 0) - (b & BTN.D ? 1 : 0);
  x *= facing;
  const d = DIRS[5 + x + y * 3];
  let s = d;
  if (b & BTN.LP) s += ' L';
  if (b & BTN.HP) s += ' H';
  if (b & BTN.SP) s += ' S';
  if (b & BTN.TA) s += ' T';
  return s;
}

export function showTrainingPanel(app) {
  const sess = app.session;
  const dummy = sess.seats[1];
  const modes = [['stand', 'Stand'], ['crouch', 'Crouch'], ['jump', 'Jump'], ['block', 'Block all'], ['blockLow', 'Crouch block'], ['cpu', 'CPU']];
  const modeBtns = h('div', { class: 'tabs' });
  const draw = () => {
    modeBtns.innerHTML = '';
    for (const [id, label] of modes) {
      modeBtns.append(btn(label, () => {
        dummy.mode = id;
        dummy.ai = null;
        draw();
      }, { class: `small ${dummy.mode === id ? 'selected' : ''}` }));
    }
  };
  draw();
  const lvl = h('select', { onchange: (e) => { dummy.level = Number(e.target.value); dummy.ai = null; } },
    AI_TIERS.map((t, i) => h('option', { value: i, selected: (dummy.level ?? 2) === i ? true : null }, t.name)));
  const fill = h('label', {}, h('input', { type: 'checkbox', checked: true, onchange: (e) => { sess.state.cfg.training.refill = e.target.checked; } }), ' Refill health after combos');
  const chiBtn = btn('Max chi', () => {
    for (const f of sess.state.fighters) f.chi = 300;
  }, { class: 'small' });
  const panel = h('div', { class: 'panel training-panel' },
    h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '練'), 'DOJO'),
    h('div', { class: 'desc-text' }, 'Dummy:'), modeBtns,
    h('div', { class: 'row', style: { marginTop: '4px' } }, h('span', { class: 'desc-text' }, 'CPU level'), lvl),
    fill, chiBtn,
    h('div', { class: 'desc-text', style: { marginTop: '6px' } }, 'F1: toggle hitboxes · Esc: pause / move list'));
  const log = h('div', { class: 'inputlog' });
  const fd = h('div', { class: 'framedata', style: { display: 'none' } });
  const el = h('div', { class: 'screen clear' }, panel, log, fd);
  app.renderer.debug = true;
  return { el, nav: false, onKey: () => false, log, fd, training: true };
}

let lastFd = '';
let fdTimer = 0;
export function updateTrainingPanel(app) {
  const scr = app.screen;
  if (!scr?.training) return;
  const sess = app.session;
  const f = sess.state.fighters[0];
  const lines = sess.inputLog[0].slice(-14).reverse().map((e) => `${byteText(e.b, f.facing).padEnd(8)} ${e.n > 99 ? '99+' : e.n}`);
  scr.log.textContent = '';
  for (const l of lines) scr.log.appendChild(h('div', {}, l));
  const txt = frameDataText(f);
  if (txt && txt !== lastFd) {
    lastFd = txt;
    fdTimer = 120;
  }
  if (fdTimer > 0) {
    fdTimer--;
    scr.fd.style.display = 'block';
    scr.fd.textContent = lastFd;
  } else scr.fd.style.display = 'none';
}


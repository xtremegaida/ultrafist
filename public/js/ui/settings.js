// Settings (audio, rules, controls, key test) and How to Play.

import { h, btn } from './dom.js';
import { audio } from '../audio/audio.js';
import { ACTIONS, ACTION_LABELS, PRESETS, loadBindings, saveBindings, prettyKey } from '../input/bindings.js';
import { captureNextKey, heldKeys } from '../input/keyboard.js';
import { getBindings } from '../input/devices.js';
import { listPads } from '../input/gamepad.js';
import { CHARACTERS, CHAR_IDS } from '../data/characters/index.js';
import { presetsFor } from '../data/presets.js';
import { showMainMenu } from './title.js';
import { moveListTable } from './fight.js';

function slider(label, value, onInput) {
  const out = h('span', { style: { width: '40px', display: 'inline-block' } }, `${Math.round(value * 100)}`);
  return h('div', { class: 'row' },
    h('label', { style: { width: '130px' } }, label),
    h('input', { type: 'range', min: 0, max: 1, step: 0.05, value, 'data-nav': '1', oninput: (e) => { out.textContent = Math.round(e.target.value * 100); onInput(Number(e.target.value)); } }),
    out);
}

function choice(label, options, value, onChange) {
  const wrap = h('div', { class: 'row' }, h('label', { style: { width: '130px' } }, label));
  const tabs = h('div', { class: 'tabs' });
  const draw = (v) => {
    tabs.innerHTML = '';
    for (const [val, txt] of options) {
      tabs.append(btn(txt, () => { onChange(val); draw(val); }, { class: `small ${val === v ? 'selected' : ''}` }));
    }
  };
  draw(value);
  wrap.append(tabs);
  return wrap;
}

export function showSettings(app) {
  const st = app.settings;
  const save = () => app.persistSettings();
  const left = h('div', { class: 'panel col', style: { width: '560px' } },
    h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '聲'), 'AUDIO'),
    slider('Master', st.master, (v) => { st.master = v; save(); }),
    slider('Music', st.music, (v) => { st.music = v; save(); }),
    slider('Sound effects', st.sfx, (v) => { st.sfx = v; save(); audio.sfx('hitHeavy'); }),
    slider('Voices', st.voice, (v) => { st.voice = v; save(); }),
    choice('Spoken shouts', [[true, 'On'], [false, 'Off']], st.speech, (v) => { st.speech = v; save(); if (v) audio.speech.say('HADOUKEN? No. BEARD LASH!', { pitch: 0.4, priority: 'announcer' }); }),
    h('div', { class: 'desc-text' }, audio.speech.available ? `Voice: ${audio.speech.voiceName || 'default'}` : 'No speech voices found on this system — shouts are shown as calligraphy only.'),
    h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '規'), 'RULES'),
    choice('Rounds to win', [[1, '1'], [2, '2'], [3, '3']], st.wins, (v) => { st.wins = v; save(); }),
    choice('Round timer', [[60, '60'], [99, '99'], [999, '∞']], st.timer, (v) => { st.timer = v; save(); }),
    choice('Heavenly Events', [['off', 'Off'], ['rare', 'Rare'], ['normal', 'Normal'], ['chaos', 'Chaos']], st.events, (v) => { st.events = v; save(); }));

  const keysBox = h('div', {});
  const drawKeys = () => {
    keysBox.innerHTML = '';
    const b = getBindings();
    const table = h('table', { class: 'ink' }, h('tr', {}, h('th', {}, 'Action'), h('th', {}, 'Player 1'), h('th', {}, 'Player 2')));
    for (const act of ACTIONS) {
      const cell = (p) => {
        const bb = btn(prettyKey(b[p][act]), () => {
          bb.textContent = '...press a key';
          captureNextKey((code) => {
            const custom = st.bindingsPreset === 'custom' ? loadBindings() : structuredClone(PRESETS[st.bindingsPreset] || PRESETS.standard);
            custom[p][act] = code;
            saveBindings(custom);
            st.bindingsPreset = 'custom';
            save();
            drawKeys();
          });
        }, { class: 'small' });
        return h('td', {}, bb);
      };
      table.append(h('tr', {}, h('td', {}, ACTION_LABELS[act]), cell('p1'), cell('p2')));
    }
    keysBox.append(table);
  };
  drawKeys();
  const right = h('div', { class: 'panel col scroll-area', style: { width: '560px', maxHeight: '500px' } },
    h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '鍵'), 'CONTROLS'),
    choice('Key layout', [['standard', 'Standard'], ['laptop', 'Laptop (no numpad)'], ['custom', 'Custom']], st.bindingsPreset, (v) => { st.bindingsPreset = v; save(); drawKeys(); }),
    keysBox,
    h('div', { class: 'desc-text' }, `Gamepads: ${listPads().length ? listPads().map((p) => p.id.slice(0, 32)).join(', ') : 'none detected yet (press a button on the pad)'}. Pad: X Light · Y Heavy · B Special · A Jump · RB Throw · RT Ultra · LB Qi Burst · LT Taunt.`),
    btn('Key Test (check for ghosting)', () => app.setScreen(showKeyTest(app)), { class: 'small', glyph: '測' }));
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'screen-title' }, h('span', { class: 'cjk' }, '設'), 'SETTINGS'),
    h('div', { class: 'row', style: { alignItems: 'flex-start', marginTop: '14px', gap: '20px' } }, left, right),
    h('div', { style: { marginTop: '12px' } }, btn('Back', () => app.setScreen(showMainMenu(app)), { glyph: '返' })));
  return { el, back: () => app.setScreen(showMainMenu(app)) };
}

function showKeyTest(app) {
  const box = h('div', { class: 'panel', style: { width: '900px', minHeight: '260px', marginTop: '20px' } });
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'screen-title' }, h('span', { class: 'cjk' }, '測'), 'KEY TEST'),
    h('div', { class: 'subtitle' }, 'Hold several keys at once, as you would in a fight. Keys that stop lighting up are "ghosting" — cheap keyboards drop some combinations. Gamepads never do.'),
    box,
    h('div', { style: { marginTop: '12px' } }, btn('Back (Esc)', () => app.setScreen(showSettings(app)), { glyph: '返' })));
  let last = '';
  return {
    el,
    nav: false,
    back: () => app.setScreen(showSettings(app)),
    onKey: (e) => {
      if (e.code === 'Escape') {
        app.setScreen(showSettings(app));
        return true;
      }
      e.preventDefault();
      return true;
    },
    poll: () => {
      const held = heldKeys();
      const b = getBindings();
      const key = held.join(',');
      if (key === last) return;
      last = key;
      box.innerHTML = '';
      for (const p of ['p1', 'p2']) {
        box.append(h('div', { class: 'section-h' }, `Player ${p[1]}`));
        box.append(h('div', {}, ACTIONS.map((a) => h('span', { class: `kbd ${held.includes(b[p][a]) ? 'held' : ''}` }, `${ACTION_LABELS[a]}: ${prettyKey(b[p][a])}`))));
      }
      box.append(h('div', { class: 'desc-text', style: { marginTop: '10px' } }, `Currently held (${held.length}): ${held.map(prettyKey).join(' + ') || '—'}`));
    },
  };
}

export function showHowTo(app) {
  let ci = 0;
  const moveBox = h('div', {});
  const drawMoves = () => {
    moveBox.innerHTML = '';
    const ch = CHARACTERS[CHAR_IDS[ci]];
    moveBox.append(
      h('div', { class: 'row' },
        btn('◀', () => { ci = (ci + 7) % 8; drawMoves(); }, { class: 'small' }),
        h('div', { class: 'section-h', style: { flex: 1 } }, h('span', { class: 'cjk' }, ch.glyph), `${ch.name} — ${ch.archetype}`),
        btn('▶', () => { ci = (ci + 1) % 8; drawMoves(); }, { class: 'small' })),
      h('div', { class: 'desc-text', style: { marginBottom: '6px' } }, ch.desc),
      moveListTable(presetsFor(ch.id)[0]));
  };
  drawMoves();
  const k = (t) => h('span', { class: 'kbd' }, t);
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'screen-title' }, h('span', { class: 'cjk' }, '書'), 'HOW TO PLAY'),
    h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '16px', marginTop: '10px' } },
      h('div', { class: 'panel scroll-area', style: { width: '470px', maxHeight: '520px' } },
        h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '鍵'), 'CONTROLS'),
        h('table', { class: 'ink' },
          h('tr', {}, h('th', {}, ''), h('th', {}, 'P1'), h('th', {}, 'P2')),
          h('tr', {}, h('td', {}, 'Move / Jump'), h('td', {}, k('WASD')), h('td', {}, k('Arrows'))),
          h('tr', {}, h('td', {}, 'Light / Heavy / Special'), h('td', {}, k('J'), k('K'), k('L')), h('td', {}, k('Num1'), k('Num2'), k('Num3'))),
          h('tr', {}, h('td', {}, 'Throw / Ultra / Qi Burst'), h('td', {}, k('U'), k('I'), k('O')), h('td', {}, k('Num4'), k('Num5'), k('Num6'))),
          h('tr', {}, h('td', {}, 'Taunt / Pause'), h('td', {}, k('Y'), k('Esc')), h('td', {}, k('Num+'), k('NumEnter')))),
        h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '真'), 'TWO WAYS TO DO SPECIALS'),
        h('p', { class: 'desc-text' }, 'Simple: press Special while holding a direction (neutral, forward, back, up or down) — always works. Authentic Technique: do the classic motion (↓↘→ etc.) then Special for +15% damage, +25% chi and a gold 真 seal.'),
        h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '盾'), 'DEFENCE'),
        h('p', { class: 'desc-text' }, 'Hold back to block, down-back to block low. Jump-ins and overheads must be blocked standing. Blocking drains your guard bar; if it breaks (破) you are dizzy. Tap L+H as you get thrown to break free (解). Qi Burst (L+S, 2 bars) blasts out of any combo.'),
        h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '氣'), 'CHI'),
        h('p', { class: 'desc-text' }, 'Build chi by hitting, getting hit, blocking, walking forward and taunting. 1 bar: Chi Cancel one special into another. 2 bars: Qi Burst. 3 bars: ULTRA (H+S). Below 25% HP you trigger FINAL AWAKENING 覺醒 once per round: more damage, an extra air jump and cheaper Ultras.'),
        h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '鬥'), 'CLASHES'),
        h('p', { class: 'desc-text' }, 'When two specials collide, a Beam Struggle or Palm Clash begins: mash, alternating Light and Heavy! Press both at once to burn a chi bar for a surge.'),
        h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '天'), 'HEAVENLY EVENTS'),
        h('p', { class: 'desc-text' }, 'Every half-minute the heavens meddle: low gravity, double damage, raining tea, a dragon flyover, falling fortune pickups and more. Tune or disable them in Settings.')),
      h('div', { class: 'panel scroll-area', style: { width: '720px', maxHeight: '520px' } }, h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '譜'), 'MOVE LISTS (default builds)'), moveBox)),
    h('div', { style: { marginTop: '10px' } }, btn('Back', () => app.setScreen(showMainMenu(app)), { glyph: '返' })));
  return { el, back: () => app.setScreen(showMainMenu(app)) };
}


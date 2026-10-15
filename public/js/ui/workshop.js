// Build Workshop: create, edit, save and test custom builds.

import { h, btn, toast } from './dom.js';
import { audio } from '../audio/audio.js';
import { CHARACTERS, CHAR_IDS } from '../data/characters/index.js';
import { getMove, SCROLLS } from '../data/registry.js';
import { STANCES, STANCE_IDS } from '../data/stances.js';
import { INNER_ARTS, ART_IDS } from '../data/innerArts.js';
import { COLOR_PRESETS, HEADGEAR, AURAS, BATTLE_CRY_MAX, sanitizeCry } from '../data/cosmetics.js';
import { BUDGET, SLOTS, STAT_KEYS, STAT_MIN, STAT_MAX, FREE_MOVES, BONUS_MAX, BONUS_COST, CHI_PER_GONG, buildCost, slotOptions, resolveBuild } from '../sim/builds.js';
import { buildsFor, upsertBuild, deleteBuild, newBuildId } from './buildStore.js';
import { portraitCanvas, drawPreview } from './select.js';
import { showMainMenu } from './title.js';

const SLOT_INFO = {
  N: { simple: 'S', motion: '←↙↓↘→ S' },
  F: { simple: '→ S', motion: '↓↘→ S' },
  B: { simple: '← S', motion: '↓↙← S' },
  U: { simple: '↑ S', motion: '→↓↘ S' },
  D: { simple: '↓ S', motion: '↓↓ S' },
};

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function draftFrom(build) {
  const r = resolveBuild(build);
  return {
    id: build.preset ? null : build.id,
    name: build.preset ? `${build.name} (copy)` : build.name,
    charId: r.charId,
    stance: r.stance,
    arts: [...r.arts],
    slots: { ...r.slots },
    ultra: r.ultra,
    statDelta: { ...r.statDelta },
    bonusStats: r.bonusStats,
    cosmetic: { ...r.cos },
    preset: !!build.preset,
  };
}

export function showWorkshop(app, opts = {}) {
  let charId = opts.charId || CHAR_IDS[0];
  let draft = draftFrom(buildsFor(charId)[0]);
  let hoverDesc = '';
  const leftCol = h('div', { class: 'panel' });
  const midCol = h('div', { class: 'panel' });
  const rightCol = h('div', { class: 'panel col' });
  const preview = h('canvas', { width: 290, height: 220 });
  let t = 0;

  function selectChar(id) {
    charId = id;
    draft = draftFrom(buildsFor(id)[0]);
    audio.sfx('uiSelect');
    redraw();
  }

  function loadBuild(b) {
    draft = draftFrom(b);
    audio.sfx('uiSelect');
    redraw();
  }

  function newBuild() {
    const ch = CHARACTERS[charId];
    draft = {
      id: null, name: `My ${ch.short}`, charId, stance: 'tiger', arts: [], slots: { ...ch.defaultSlots }, ultra: ch.ultras[0],
      statDelta: { pow: 0, spd: 0, def: 0, chi: 0 }, bonusStats: 0, cosmetic: { ...ch.colors, head: 'none', aura: AURAS[0], cry: '' }, preset: false,
    };
    redraw();
  }

  // ---- validation helpers --------------------------------------------------------------
  function statState() {
    const base = CHARACTERS[charId].stats;
    let pos = 0;
    let net = 0;
    for (const k of STAT_KEYS) {
      const d = draft.statDelta[k] || 0;
      if (d > 0) pos += d;
      net += d;
    }
    return { base, pos, net, freeLeft: FREE_MOVES + draft.bonusStats - pos, toPlace: draft.bonusStats - net };
  }

  function problems() {
    const out = [];
    const cost = buildCost(draft);
    if (cost > BUDGET) out.push(`Over budget by ${cost - BUDGET} Gong.`);
    const ss = statState();
    if (ss.toPlace > 0) out.push(`Place ${ss.toPlace} more stat point${ss.toPlace > 1 ? 's' : ''}.`);
    if (ss.toPlace < 0) out.push(`Remove ${-ss.toPlace} stat point${ss.toPlace < -1 ? 's' : ''} from somewhere.`);
    if (ss.freeLeft < 0) out.push('Too many points moved.');
    const used = SLOTS.map((s) => draft.slots[s]);
    if (new Set(used).size !== used.length) out.push('A technique is in two slots.');
    return out;
  }

  // ---- left: characters + saved builds ----------------------------------------------------
  function drawLeft() {
    leftCol.innerHTML = '';
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' } }, CHAR_IDS.map((id) => {
      const b = h('button', { class: `char-card ${id === charId ? 'hover-p1' : ''}`, 'data-nav': '1', style: { width: '100%', height: '70px' }, title: CHARACTERS[id].name },
        portraitCanvas(id, CHARACTERS[id].colors, 58));
      b.addEventListener('click', () => selectChar(id));
      return b;
    }));
    const list = buildsFor(charId);
    leftCol.append(
      h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '人'), 'FIGHTER'),
      grid,
      h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '譜'), `${CHARACTERS[charId].short.toUpperCase()} BUILDS`),
      ...list.map((b) => {
        const isCur = (draft.id && draft.id === b.id) || (!draft.id && draft.preset && draft.name.startsWith(b.name));
        return h('div', { class: 'row', style: { margin: '3px 0' } },
          btn(`${b.preset ? '★ ' : ''}${b.name}`, () => loadBuild(b), { class: `small ${isCur ? 'selected' : ''}` }),
          b.preset ? h('span', { class: 'desc-text' }, 'preset') : null);
      }),
      h('div', { style: { marginTop: '8px' } }, btn('New blank build', newBuild, { class: 'small', glyph: '新' })));
  }

  // ---- middle: the build itself -----------------------------------------------------------
  function chip(label, on, onClick, opts2 = {}) {
    const c = h('span', { class: `chip ${on ? 'on' : ''} ${opts2.disabled ? 'disabled' : ''}`, 'data-nav': '1', tabindex: 0, title: opts2.title || '' },
      opts2.glyph ? h('span', { class: 'cjk' }, `${opts2.glyph} `) : null, label);
    c.addEventListener('click', () => {
      if (opts2.disabled) return;
      audio.sfx('uiMove');
      onClick();
    });
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        c.click();
      }
    });
    c.addEventListener('mouseenter', () => {
      if (opts2.desc) {
        hoverDesc = opts2.desc;
        drawRight();
      }
    });
    return c;
  }

  function drawMid() {
    midCol.innerHTML = '';
    const cost = buildCost(draft);
    const pips = h('span', { class: 'pips' }, Array.from({ length: Math.max(BUDGET, cost) }, (_, i) => h('span', { class: i < cost ? (i >= BUDGET ? 'over' : 'used') : '' })));
    const nameIn = h('input', { type: 'text', value: draft.name, maxlength: 32, style: { width: '260px' }, oninput: (e) => { draft.name = e.target.value; } });
    midCol.append(
      h('div', { class: 'row' }, h('label', {}, 'Build name'), nameIn, h('span', { class: 'spacer' }),
        h('div', { class: 'gong' }, h('span', { style: { fontFamily: 'var(--cjk)', color: '#c8102e' } }, '功 '), `${cost}/${BUDGET} `, pips)),
      h('div', { class: 'desc-text' }, `Unspent Gong becomes starting chi: +${Math.min(100, Math.max(0, BUDGET - cost) * CHI_PER_GONG)} chi.`));

    // stance
    midCol.append(h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '式'), 'STANCE (free, pick one)'));
    midCol.append(h('div', {}, STANCE_IDS.map((id) => chip(STANCES[id].name, draft.stance === id, () => {
      draft.stance = id;
      redraw();
    }, { glyph: STANCES[id].glyph, desc: STANCES[id].desc, title: STANCES[id].desc }))));

    // inner arts
    midCol.append(h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '心'), `INNER ARTS (up to 2) — ${draft.arts.length}/2`));
    midCol.append(h('div', {}, ART_IDS.map((id) => {
      const on = draft.arts.includes(id);
      const art = INNER_ARTS[id];
      return chip(`${art.name} ·${art.cost}`, on, () => {
        if (on) draft.arts = draft.arts.filter((a) => a !== id);
        else if (draft.arts.length < 2) draft.arts.push(id);
        else {
          toast('Only two Inner Arts. Remove one first.');
          return;
        }
        redraw();
      }, { glyph: art.glyph.slice(0, 2), desc: `${art.name} (${art.cost} Gong): ${art.desc}`, title: art.desc, disabled: !on && draft.arts.length >= 2 });
    })));

    // slots
    midCol.append(h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '技'), 'SPECIAL SLOTS — own techniques are free, Forbidden Scrolls 卷 cost Gong'));
    const opts = slotOptions(charId);
    for (const s of SLOTS) {
      const sel = h('select', { 'data-nav': '1', style: { width: '100%' }, onchange: (e) => {
        const val = e.target.value;
        const other = SLOTS.find((x) => x !== s && draft.slots[x] === val);
        if (other) draft.slots[other] = draft.slots[s];
        draft.slots[s] = val;
        redraw();
      } }, opts.map((id) => {
        const m = getMove(id);
        const sc = SCROLLS[id];
        return h('option', { value: id, selected: draft.slots[s] === id ? true : null }, `${sc ? `卷 ${m.name} (${sc.cost})` : m.name}`);
      }));
      sel.addEventListener('mouseenter', () => {
        const m = getMove(draft.slots[s]);
        hoverDesc = `${m.name}: ${m.desc || ''}`;
        drawRight();
      });
      midCol.append(h('div', { class: 'slot-row' }, h('span', { class: 'key' }, s), h('span', { class: 'desc-text' }, `${SLOT_INFO[s].simple} · ${SLOT_INFO[s].motion}`), sel));
    }

    // ultra
    midCol.append(h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '極'), 'ULTRA (free, pick one) — H+S or ↓↘→↓↘→ S'));
    midCol.append(h('div', {}, CHARACTERS[charId].ultras.map((id) => {
      const m = getMove(id);
      return chip(m.name, draft.ultra === id, () => {
        draft.ultra = id;
        redraw();
      }, { glyph: m.glyph.slice(0, 2), desc: `${m.name}: ${m.desc}`, title: m.desc });
    })));

    // stats
    const ss = statState();
    midCol.append(h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '力'), `STATS — move up to ${FREE_MOVES} points for free (${Math.max(0, ss.freeLeft)} left)`));
    const statRows = STAT_KEYS.map((k) => {
      const base = ss.base[k];
      const cur = base + (draft.statDelta[k] || 0);
      const minus = btn('−', () => {
        if (cur <= STAT_MIN) return;
        draft.statDelta[k] = (draft.statDelta[k] || 0) - 1;
        redraw();
      }, { class: 'small' });
      const plus = btn('+', () => {
        if (cur >= STAT_MAX) return;
        if ((draft.statDelta[k] || 0) >= 0 && statState().freeLeft <= 0) {
          toast('No free stat moves left — buy a bonus point or lower another stat first.');
          return;
        }
        draft.statDelta[k] = (draft.statDelta[k] || 0) + 1;
        redraw();
      }, { class: 'small' });
      const d = draft.statDelta[k] || 0;
      return h('div', { class: 'row', style: { gap: '6px' } },
        h('span', { style: { width: '40px', fontFamily: 'var(--display)' } }, k.toUpperCase()), minus,
        h('div', { class: 'statbar', style: { width: '200px' } }, h('div', { class: 'bar' }, h('span', { style: { width: `${cur * 10}%`, background: d > 0 ? '#2d6a4f' : d < 0 ? '#c8102e' : '#16120f' } }))),
        plus, h('span', {}, `${cur}${d ? ` (${d > 0 ? '+' : ''}${d})` : ''}`));
    });
    midCol.append(...statRows);
    midCol.append(h('div', { class: 'row' },
      h('span', { class: 'desc-text' }, `Bonus stat points (${BONUS_COST} Gong each, max ${BONUS_MAX}):`),
      btn('−', () => {
        if (draft.bonusStats > 0) draft.bonusStats--;
        redraw();
      }, { class: 'small' }),
      h('b', {}, String(draft.bonusStats)),
      btn('+', () => {
        if (draft.bonusStats < BONUS_MAX) draft.bonusStats++;
        redraw();
      }, { class: 'small' })),
    h('div', { class: 'desc-text' }, 'POW: damage · SPD: walk/jump speed · DEF: health and guard · CHI: chi gain'));
    const probs = problems();
    if (probs.length) midCol.append(h('div', { class: 'desc-text', style: { color: '#c8102e', fontWeight: 'bold', marginTop: '6px' } }, probs.join(' ')));
  }

  // ---- right: preview, cosmetics, actions -------------------------------------------------
  function drawRight() {
    rightCol.innerHTML = '';
    const cos = draft.cosmetic;
    const swatches = (key) => h('div', {}, COLOR_PRESETS.map((c) => {
      const sw = h('span', { class: `swatch ${cos[key] === c ? 'on' : ''}`, style: { background: c }, title: c });
      sw.addEventListener('click', () => {
        cos[key] = c;
        drawRight();
      });
      return sw;
    }));
    const auras = h('div', {}, AURAS.map((c) => {
      const sw = h('span', { class: `swatch ${cos.aura === c ? 'on' : ''}`, style: { background: c === 'rainbow' ? 'linear-gradient(90deg,red,orange,yellow,green,blue,violet)' : c } });
      sw.addEventListener('click', () => {
        cos.aura = c;
        drawRight();
      });
      return sw;
    }));
    const head = h('select', { 'data-nav': '1', onchange: (e) => { cos.head = e.target.value; } }, Object.entries(HEADGEAR).map(([id, label]) => h('option', { value: id, selected: cos.head === id ? true : null }, label)));
    const cry = h('input', { type: 'text', value: cos.cry || '', maxlength: BATTLE_CRY_MAX, placeholder: 'Battle cry (spoken at round 1)', style: { width: '100%' }, oninput: (e) => { cos.cry = sanitizeCry(e.target.value); } });
    const ch = CHARACTERS[charId];
    const probs = problems();
    rightCol.append(
      preview,
      h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '衣'), 'COLOURS'),
      h('div', { class: 'desc-text' }, 'Primary'), swatches('c1'),
      h('div', { class: 'desc-text' }, 'Secondary'), swatches('c2'),
      h('div', { class: 'row' }, h('label', {}, 'Headgear'), head),
      h('div', { class: 'desc-text' }, 'Aura'), auras,
      h('div', { class: 'row' }, cry, btn('Hear', () => audio.speech.say(cos.cry || 'Hiyaaa!', { pitch: ch.voice?.pitch ?? 1, rate: ch.voice?.rate ?? 1, priority: 'announcer' }), { class: 'small' })),
      h('div', { class: 'desc-text', style: { minHeight: '48px', background: 'rgba(255,255,255,0.5)', padding: '4px' } }, hoverDesc || 'Hover a stance, art or technique for details.'),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } },
        btn('Save', () => save(false), { glyph: '存', disabled: probs.length > 0 }),
        draft.id ? btn('Delete', () => {
          deleteBuild(draft.id);
          toast('Build deleted.');
          draft = draftFrom(buildsFor(charId)[0]);
          redraw();
        }, { class: 'small', glyph: '刪' }) : null,
        btn('Test in Dojo', () => {
          if (problems().length) return toast('Fix the build first.');
          const b = save(true);
          app.startMatch({ mode: 'training', builds: [b, buildsFor(CHAR_IDS[(CHAR_IDS.indexOf(charId) + 4) % 8])[0]], stageId: 'bamboo', seats: [{ type: 'human', devices: ['kb1', 'kb2', 'pad0'] }, { type: 'dummy', mode: 'stand' }], training: { refill: true } });
        }, { class: 'small', glyph: '練' })));
  }

  function save(quiet) {
    const b = clone(draft);
    if (!b.id) b.id = newBuildId();
    b.cosmetic.cry = sanitizeCry(b.cosmetic.cry);
    delete b.preset;
    upsertBuild(b);
    draft.id = b.id;
    draft.preset = false;
    if (!quiet) {
      toast(`Saved "${b.name}". Pick it on the character select screen.`);
      audio.sfx('chime');
    }
    redraw();
    return b;
  }

  function redraw() {
    drawLeft();
    drawMid();
    drawRight();
  }

  redraw();
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'row', style: { marginTop: '10px', gap: '16px' } },
      h('div', { class: 'screen-title', style: { marginTop: 0, fontSize: '40px' } }, h('span', { class: 'cjk' }, '功'), 'BUILD WORKSHOP'),
      btn('Back', () => app.setScreen(showMainMenu(app)), { class: 'small', glyph: '返' })),
    h('div', { class: 'workshop' }, leftCol, midCol, rightCol));
  return {
    el,
    back: () => app.setScreen(showMainMenu(app)),
    noAutoFocus: true,
    poll: () => {
      t += 1;
      if (t % 2) return;
      drawPreview(preview.getContext('2d'), charId, draft.cosmetic, t, 290, 220, 'idle');
    },
  };
}

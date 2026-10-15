// UltraFist entry point: canvas scaling, main loop, scene management, match lifecycle.

import { createRenderer, renderFrame } from './render/renderer.js';
import { drawDebugBoxes } from './render/debug.js';
import { createDirector, direct, startMatchAudio } from './game/director.js';
import { createLocalSession } from './game/session.js';
import { initKeyboard, onKey, setGameKeys } from './input/keyboard.js';
import { allGameKeys, setBindings } from './input/devices.js';
import { PRESETS as KEY_PRESETS, loadBindings } from './input/bindings.js';
import { audio } from './audio/audio.js';
import { CHAR_IDS } from './data/characters/index.js';
import { STAGE_IDS } from './data/stages.js';
import { presetsFor } from './data/presets.js';
import { RULES } from './data/rules.js';
import { resolveBuild } from './sim/builds.js';
import { loadSettings, saveSettings } from './ui/buildStore.js';
import { keyNav, pollMenuNav } from './ui/dom.js';
import { showTitle, showMainMenu } from './ui/title.js';
import { showPause, showResults, showTrainingPanel, updateTrainingPanel } from './ui/fight.js';

const canvas = document.getElementById('game');
const uiRoot = document.getElementById('ui');
const stageEl = document.getElementById('stage');

export const app = {
  canvas,
  uiRoot,
  renderer: createRenderer(canvas),
  director: createDirector(),
  settings: loadSettings(),
  session: null,
  sessionMode: null, // 'attract' | 'match' | 'net'
  match: null, // { mode, cos, onEnd, ... }
  screen: null,
  endShown: false,
};

// ---- layout ------------------------------------------------------------------------------------

function fit() {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stageEl.style.transformOrigin = 'center center';
  stageEl.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', fit);
fit();

// ---- settings ----------------------------------------------------------------------------------

export function applySettings() {
  const st = app.settings;
  audio.init();
  audio.setVolume('master', st.master);
  audio.setVolume('music', st.music);
  audio.setVolume('sfx', st.sfx);
  audio.setVolume('voice', st.voice);
  audio.speech.enabled = !!st.speech;
  const custom = loadBindings();
  setBindings(st.bindingsPreset === 'custom' ? custom : structuredClone(KEY_PRESETS[st.bindingsPreset] || KEY_PRESETS.standard));
  setGameKeys([...allGameKeys(), 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1']);
}

export function persistSettings() {
  saveSettings(app.settings);
  applySettings();
}

// ---- screens -----------------------------------------------------------------------------------

export function setScreen(screen) {
  if (app.screen?.destroy) app.screen.destroy();
  uiRoot.innerHTML = '';
  app.screen = screen;
  if (screen?.el) {
    uiRoot.appendChild(screen.el);
    const first = screen.el.querySelector('[data-nav]');
    if (first && !screen.noAutoFocus) setTimeout(() => first.focus(), 0);
  }
}

onKey((e, down) => {
  if (!down) return;
  if (e.code === 'F1' && app.sessionMode === 'match') {
    e.preventDefault();
    app.renderer.debug = !app.renderer.debug;
    return;
  }
  if (app.screen?.onKey && app.screen.onKey(e)) return;
  if (app.screen?.el && app.screen.nav !== false) keyNav(e, app.screen.el, app.screen.back);
});

// ---- sessions ----------------------------------------------------------------------------------

function cosOf(side) {
  return app.match?.cos?.[side] || app.attractCos?.[side];
}

export function startAttract() {
  const pick = () => CHAR_IDS[Math.floor(Math.random() * CHAR_IDS.length)];
  const a = pick();
  let b = pick();
  if (b === a) b = CHAR_IDS[(CHAR_IDS.indexOf(a) + 3) % CHAR_IDS.length];
  const builds = [presetsFor(a)[Math.floor(Math.random() * 2)], presetsFor(b)[Math.floor(Math.random() * 2)]];
  app.session = createLocalSession({
    builds,
    stageId: STAGE_IDS[Math.floor(Math.random() * 4)],
    seats: [{ type: 'cpu', level: 3 }, { type: 'cpu', level: 3 }],
    events: 'normal',
  });
  app.attractCos = builds.map((b) => resolveBuild(b).cos);
  app.sessionMode = 'attract';
  app.match = null;
  app.director = createDirector();
  app.renderer.fx.parts.length = 0;
}

// cfg: { mode, builds, seats, stageId, training?, arcade?, onEnd? }
export function startMatch(cfg) {
  const st = app.settings;
  const session = createLocalSession({
    builds: cfg.builds,
    stageId: cfg.stageId,
    seats: cfg.seats,
    events: cfg.training ? 'off' : st.events,
    timer: cfg.training ? 99 : st.timer,
    wins: st.wins,
    training: cfg.training || null,
  });
  app.session = session;
  app.sessionMode = 'match';
  app.match = { ...cfg, cos: cfg.builds.map((b) => resolveBuild(b).cos) };
  app.director = createDirector();
  app.renderer = createRenderer(canvas);
  app.renderer.debugDraw = drawDebugBoxes;
  app.endShown = false;
  startMatchAudio(app.director, cfg.stageId);
  if (cfg.training) setScreen(showTrainingPanel(app));
  else setScreen({ el: null, nav: false, onKey: () => false });
}

export function startNetView(net) {
  app.session = net;
  app.sessionMode = 'net';
  app.director = createDirector();
  app.renderer = createRenderer(canvas);
  app.endShown = false;
}

export function stopSession() {
  app.session = null;
  app.sessionMode = null;
}

export function quitToMenu() {
  startAttract();
  setScreen(showMainMenu(app));
  audio.music.play('menu');
}

// ---- main loop ---------------------------------------------------------------------------------

let lastW = 0;
let lastH = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (window.innerWidth !== lastW || window.innerHeight !== lastH) {
    lastW = window.innerWidth;
    lastH = window.innerHeight;
    fit();
  }
  if (app.screen?.el) pollMenuNav(app.screen.el, app.screen.back);
  if (app.screen?.poll) app.screen.poll(now);

  const sess = app.session;
  if (!sess) {
    const ctx = app.renderer.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f3ead7';
    ctx.fillRect(0, 0, 1280, 720);
    return;
  }
  const events = sess.update(now);
  const view = sess.view ? sess.view() : sess.state;
  if (!view) return;
  if (app.sessionMode === 'attract') {
    // the attract demo is silent apart from the menu music
    app.renderer.debug = false;
  } else if (events.length) {
    direct(app.director, app.renderer, view, events, cosOf);
  } else direct(app.director, app.renderer, view, [], cosOf);

  renderFrame(app.renderer, view, {
    cos: app.sessionMode === 'attract' ? app.attractCos : app.match?.cos || sess.cos,
    hud: app.sessionMode !== 'attract',
    ping: sess.ping,
    spectating: sess.spectating,
  });

  if (app.sessionMode === 'attract' && view.phase === 'matchEnd' && view.phaseT > 120) startAttract();

  if (app.sessionMode === 'match') {
    if (sess.pauseRequested) {
      sess.pauseRequested = false;
      if (!sess.paused && view.phase !== 'matchEnd') {
        sess.paused = true;
        setScreen(showPause(app));
      }
    }
    if (app.match?.training) updateTrainingPanel(app);
    if (view.phase === 'matchEnd' && view.phaseT > RULES.MATCH_END_FRAMES * 0.5 && !app.endShown) {
      app.endShown = true;
      setScreen(showResults(app, view));
    }
  }
  if (app.sessionMode === 'net' && sess.onFrame) sess.onFrame(view);
}

// ---- boot --------------------------------------------------------------------------------------

Object.assign(app, { setScreen, startMatch, startAttract, startNetView, stopSession, quitToMenu, persistSettings, applySettings });

initKeyboard();
applySettings();
startAttract();
setScreen(showTitle(app));
requestAnimationFrame(loop);

window.ultrafist = app; // handy for debugging in the console

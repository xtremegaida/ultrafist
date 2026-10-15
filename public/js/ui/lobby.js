// LAN lobby UI: connect, browse/create/join rooms, pick fighters, ready up, play or spectate.

import { h, btn, toast } from './dom.js';
import { audio } from '../audio/audio.js';
import { C, S } from '../shared/protocol.js';
import { createNetClient } from '../net/client.js';
import { CHARACTERS, CHAR_IDS } from '../data/characters/index.js';
import { STAGES, STAGE_IDS } from '../data/stages.js';
import { buildsFor, loadProfile } from './buildStore.js';
import { portraitCanvas } from './select.js';
import { moveListTable } from './fight.js';

let net = null;

function leaveAll(app) {
  if (net) {
    net.send({ t: C.LEAVE });
    net.close();
    net = null;
  }
  app.quitToMenu();
}

export function showLobby(app) {
  const profile = loadProfile();
  const nameIn = h('input', { type: 'text', value: profile.name || '', placeholder: 'Your name', maxlength: 16, 'data-nav': '1' });
  const status = h('div', { class: 'desc-text' }, 'Everyone on your network opens this same page (see the server window for the LAN address).');
  const connect = async () => {
    const name = nameIn.value.trim() || 'Wanderer';
    status.textContent = 'Connecting...';
    try {
      if (!net || !net.connected) {
        net = createNetClient();
        await net.connect(name);
      }
      app.setScreen(showRooms(app));
    } catch (err) {
      status.textContent = `${err.message} Make sure you opened the game from the server address (npm start), not as a file.`;
    }
  };
  if (net && net.connected) return showRooms(app);
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'screen-title' }, h('span', { class: 'cjk' }, '網'), 'LAN BATTLE'),
    h('div', { class: 'panel col', style: { marginTop: '40px', width: '560px' } },
      h('div', { class: 'section-h' }, 'What do the scrolls call you?'),
      nameIn,
      btn('Enter the Dojo', connect, { glyph: '入' }),
      status),
    h('div', { style: { marginTop: '16px' } }, btn('Back', () => leaveAll(app), { glyph: '返' })));
  nameIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') connect();
  });
  setTimeout(() => nameIn.focus(), 50);
  return { el, back: () => leaveAll(app), noAutoFocus: true };
}

function showRooms(app) {
  const list = h('div', { class: 'room-list' });
  const codeIn = h('input', { type: 'text', placeholder: 'CODE', maxlength: 4, style: { width: '110px', textTransform: 'uppercase', fontSize: '22px', letterSpacing: '4px' }, 'data-nav': '1' });
  const draw = () => {
    list.innerHTML = '';
    if (!net.rooms.length) list.append(h('div', { class: 'desc-text' }, 'No rooms yet. Create one and tell your friends the code!'));
    for (const r of net.rooms) {
      list.append(h('div', { class: 'room-row' },
        h('div', {}, h('span', { class: 'code', style: { fontSize: '22px' } }, r.code), `  ${r.name}`, h('div', { class: 'desc-text' }, `${r.players}/2 fighters · ${r.specs} watching · ${r.phase}`)),
        h('div', { class: 'row' },
          r.players < 2 && r.phase !== 'match' ? btn('Join', () => net.send({ t: C.JOIN, code: r.code, role: 'p' }), { class: 'small' }) : null,
          btn('Watch', () => net.send({ t: C.JOIN, code: r.code, role: 's' }), { class: 'small' }))));
    }
  };
  const offs = [
    net.on(S.ROOMS, draw),
    net.on(S.ROOM, () => app.setScreen(showRoom(app))),
    net.on(S.ERR, (m) => toast(m.msg || 'Error')),
    net.on(S.CHAT, (m) => toast(m.text)),
    net.on('disconnect', () => {
      toast('Lost connection to the server.');
      leaveAll(app);
    }),
  ];
  net.send({ t: C.LIST });
  const timer = setInterval(() => net && net.send({ t: C.LIST }), 2000);
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'screen-title' }, h('span', { class: 'cjk' }, '網'), 'LAN BATTLE'),
    h('div', { class: 'subtitle' }, `Connected as ${net.name}. Rooms on this server:`),
    h('div', { class: 'lobby' },
      h('div', { class: 'panel' }, h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '房'), 'OPEN ROOMS'), list),
      h('div', { class: 'panel col' },
        h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '建'), 'HOST'),
        btn('Create a Room', () => net.send({ t: C.CREATE, name: `${net.name}'s dojo` }), { glyph: '建', desc: 'You get a 4-letter code to share.' }),
        h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '碼'), 'JOIN BY CODE'),
        h('div', { class: 'row' }, codeIn,
          btn('Join', () => net.send({ t: C.JOIN, code: codeIn.value, role: 'p' }), { class: 'small' }),
          btn('Watch', () => net.send({ t: C.JOIN, code: codeIn.value, role: 's' }), { class: 'small' })),
        h('div', { class: 'desc-text', style: { marginTop: '12px' } }, 'Tip: the server is authoritative, so everyone sees the same fight. Spectators can join a match already in progress.'))),
    h('div', { style: { marginTop: '16px' } }, btn('Leave', () => leaveAll(app), { glyph: '返' })));
  draw();
  return {
    el,
    back: () => leaveAll(app),
    destroy: () => {
      clearInterval(timer);
      offs.forEach((f) => f());
    },
  };
}

function showRoom(app) {
  const body = h('div', { class: 'lobby' });
  let myChar = null;
  let myBuild = 0;
  const pick = (charId, buildIdx) => {
    myChar = charId;
    myBuild = buildIdx;
    const b = buildsFor(charId)[buildIdx] || buildsFor(charId)[0];
    net.send({ t: C.PICK, charId, build: b });
  };
  const draw = () => {
    const room = net.room;
    if (!room) return;
    body.innerHTML = '';
    const you = room.you;
    const sendStage = (change) => net.send({ t: C.STAGE, stageId: room.stageId, events: room.events, transitions: room.transitions !== false, ...change });
    const seats = room.seats.map((s, i) => {
      if (!s) return h('div', { class: 'seat' }, h('div', { class: 'desc-text' }, `Seat ${i + 1}: waiting for a challenger...`));
      return h('div', { class: 'seat filled' },
        s.charId ? portraitCanvas(s.charId, s.cos, 70) : null,
        h('div', { class: 'col', style: { gap: '2px' } },
          h('b', {}, `${i === 0 ? 'P1' : 'P2'} · ${s.name}${you.seat === i ? ' (you)' : ''}`),
          h('span', { class: 'desc-text' }, s.charId ? `${CHARACTERS[s.charId].name} — ${s.buildName || ''}` : 'choosing...'),
          !s.connected ? h('span', { class: 'desc-text', style: { color: '#c8102e' } }, 'disconnected') : null),
        h('span', { class: 'spacer' }),
        s.ready ? h('div', { class: 'ready-stamp', style: { width: '54px', height: '54px', fontSize: '32px' } }, '定') : null);
    });
    const left = h('div', { class: 'panel col' },
      h('div', { class: 'row' }, h('div', { class: 'section-h' }, 'ROOM CODE'), h('span', { class: 'code' }, room.code)),
      h('div', { class: 'desc-text' }, `${room.name} · ${room.specs} spectator${room.specs === 1 ? '' : 's'} · ${room.phase}`),
      seats,
      h('div', { class: 'row' },
        h('label', {}, 'Arena'),
        room.host
          ? h('select', { 'data-nav': '1', onchange: (e) => sendStage({ stageId: e.target.value }) },
            h('option', { value: 'random', selected: room.stageId === 'random' ? true : null }, 'Random'),
            STAGE_IDS.map((id) => h('option', { value: id, selected: room.stageId === id ? true : null }, STAGES[id].name)))
          : h('span', {}, room.stageId === 'random' ? 'Random' : STAGES[room.stageId]?.name),
        h('label', {}, 'Events'),
        room.host
          ? h('select', { 'data-nav': '1', onchange: (e) => sendStage({ events: e.target.value }) },
            ['off', 'rare', 'normal', 'chaos'].map((v) => h('option', { value: v, selected: room.events === v ? true : null }, v)))
          : h('span', {}, room.events)),
      h('div', { class: 'row' },
        h('label', {}, 'Stage transitions'),
        room.host
          ? h('select', { 'data-nav': '1', onchange: (e) => sendStage({ transitions: e.target.value === 'on' }) },
            [['on', 'On'], ['off', 'Off']].map(([v, txt]) => h('option', { value: v, selected: (room.transitions !== false) === (v === 'on') ? true : null }, txt)))
          : h('span', {}, room.transitions !== false ? 'On' : 'Off')));
    const right = h('div', { class: 'panel col' });
    if (you.seat >= 0) {
      const mine = room.seats[you.seat];
      const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' } }, CHAR_IDS.map((id) => {
        const b = h('button', { class: `char-card ${mine?.charId === id ? 'hover-p1' : ''}`, 'data-nav': '1', style: { width: '100%', height: '96px' } }, portraitCanvas(id, CHARACTERS[id].colors, 76), h('span', { class: 'nm', style: { fontSize: '12px' } }, CHARACTERS[id].short.toUpperCase()));
        b.addEventListener('click', () => {
          audio.sfx('uiSelect');
          pick(id, 0);
        });
        return b;
      }));
      const curChar = mine?.charId || myChar || CHAR_IDS[0];
      const builds = buildsFor(curChar);
      const sel = h('select', { 'data-nav': '1', onchange: (e) => pick(curChar, Number(e.target.value)) },
        builds.map((b, i) => h('option', { value: i, selected: (myChar === curChar ? myBuild : 0) === i ? true : null }, `${b.preset ? '★ ' : ''}${b.name}`)));
      right.append(
        h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '選'), 'YOUR FIGHTER'),
        grid,
        h('div', { class: 'row' }, h('label', {}, 'Build'), sel),
        btn(mine?.ready ? 'Not ready' : 'READY!', () => net.send({ t: C.READY, on: !mine?.ready }), { glyph: '定', class: mine?.ready ? 'selected' : '' }));
    } else {
      right.append(h('div', { class: 'section-h' }, h('span', { class: 'cjk' }, '觀'), 'SPECTATING'),
        h('div', { class: 'desc-text' }, 'You will watch the match live. Grab some tea.'));
    }
    body.append(left, right);
  };
  const offs = [
    net.on(S.ROOM, draw),
    net.on(S.ERR, (m) => toast(m.msg || 'Error')),
    net.on(S.CHAT, (m) => toast(m.text)),
    net.on(S.START, () => startNetMatch(app)),
    net.on('disconnect', () => {
      toast('Lost connection to the server.');
      leaveAll(app);
    }),
  ];
  const el = h('div', { class: 'screen overlay' },
    h('div', { class: 'screen-title' }, h('span', { class: 'cjk' }, '房'), 'DOJO ROOM'),
    body,
    h('div', { class: 'row', style: { marginTop: '16px' } },
      btn('Leave Room', () => net.send({ t: C.LEAVE }), { glyph: '退' })));
  const offLeft = net.on(S.ROOMS, () => {
    // server answers LEAVE with the room list
    net.room = null;
    app.setScreen(showRooms(app));
  });
  offs.push(offLeft);
  draw();
  if (net.room?.you?.seat >= 0 && !net.room.seats[net.room.you.seat]?.charId) pick(CHAR_IDS[0], 0);
  if (net.session && net.room?.phase === 'match') setTimeout(() => startNetMatch(app), 0);
  return {
    el,
    back: () => net.send({ t: C.LEAVE }),
    destroy: () => offs.forEach((f) => f()),
  };
}

function startNetMatch(app) {
  const sess = net.session;
  if (!sess) return;
  app.startNetView(sess);
  app.match = { mode: 'net', cos: sess.cos, builds: sess.players.map((p) => p.build) };
  const overlay = h('div', { class: 'screen clear' });
  const pausedBox = h('div', { class: 'panel', style: { marginTop: '220px', display: 'none', fontSize: '22px' } });
  overlay.append(pausedBox);
  let menuOpen = false;
  const openMenu = () => {
    if (menuOpen) return;
    menuOpen = true;
    const box = h('div', { class: 'screen dim' },
      h('div', { class: 'menu panel pause-box' },
        h('div', { class: 'desc-text' }, 'The match keeps running on the server while this menu is open.'),
        btn('Back to the fight', () => {
          box.remove();
          menuOpen = false;
        }, { glyph: '續' }),
        sess.spectating ? null : h('div', { class: 'panel scroll-area', style: { maxHeight: '260px', width: '100%' } }, moveListTable(sess.players[sess.seat].build)),
        btn(sess.spectating ? 'Stop watching' : 'Forfeit and leave', () => {
          net.send({ t: C.LEAVE });
          app.stopSession();
          app.startAttract();
          app.setScreen(showRooms(app));
        }, { glyph: '退' })));
    overlay.append(box);
  };
  sess.onFrame = (view) => {
    if (sess.pauseRequested) {
      sess.pauseRequested = false;
      openMenu();
    }
    if (sess.pauseInfo) {
      pausedBox.style.display = 'block';
      pausedBox.textContent = `Player ${sess.pauseInfo.seat + 1} disconnected — waiting up to ${sess.pauseInfo.secondsLeft}s for them to return...`;
    } else pausedBox.style.display = 'none';
    if (sess.ended && !sess.endShown) {
      sess.endShown = true;
      setTimeout(() => app.setScreen(showNetResults(app, sess, view)), 600);
    }
  };
  app.setScreen({ el: overlay, nav: false, onKey: (e) => {
    if (e.code === 'Escape') {
      openMenu();
      return true;
    }
    return false;
  } });
}

function showNetResults(app, sess, view) {
  const w = sess.ended.winner;
  const W = view?.fighters?.[w];
  const ch = W ? CHARACTERS[W.charId] : null;
  const reason = sess.ended.reason === 'ko' ? '' : ` (${sess.ended.reason})`;
  const toRoom = () => {
    app.stopSession();
    app.startAttract();
    net.session = null;
    app.setScreen(showRoom(app));
  };
  const el = h('div', { class: 'screen dim' },
    h('div', { class: 'panel col', style: { marginTop: '80px', width: '640px', alignItems: 'center' } },
      h('div', { class: 'screen-title', style: { marginTop: 0 } }, h('span', { class: 'cjk' }, '勝'), ch ? `${sess.players[w]?.name || ch.short} WINS${reason}` : 'MATCH OVER'),
      ch ? portraitCanvas(W.charId, sess.cos[w], 200, 'happy') : null,
      ch ? h('div', { class: 'quote' }, `"${ch.quote}"`) : null,
      sess.spectating ? null : btn('Rematch', () => {
        net.send({ t: C.REMATCH });
        toast('Waiting for your opponent to accept the rematch...');
      }, { glyph: '再' }),
      btn('Back to Room', toRoom, { glyph: '房' })));
  const off = net.on(S.START, () => {
    off();
    startNetMatch(app);
  });
  return { el, back: toRoom, destroy: () => {} };
}


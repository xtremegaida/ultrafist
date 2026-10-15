// LAN integration: real server on port 0, Node's built-in WebSocket clients.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server.js';
import { createLobby } from '../server/rooms.js';
import { PROTOCOL_VERSION } from '../public/js/shared/protocol.js';

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [];
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const w = waiters.find((x) => x.pred(msg));
    if (w) {
      waiters.splice(waiters.indexOf(w), 1);
      w.resolve(msg);
    } else inbox.push(msg);
  });
  const api = {
    ws,
    inbox,
    open: new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    }),
    send: (m) => ws.send(JSON.stringify(m)),
    wait(pred, ms = 4000) {
      const hit = inbox.find(pred);
      if (hit) {
        inbox.splice(inbox.indexOf(hit), 1);
        return Promise.resolve(hit);
      }
      return new Promise((resolve, reject) => {
        const w = { pred, resolve };
        waiters.push(w);
        setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i >= 0) {
            waiters.splice(i, 1);
            reject(new Error('timeout waiting for message'));
          }
        }, ms).unref();
      });
    },
    close: () => ws.close(),
  };
  return api;
}

describe('LAN lobby and match', { timeout: 30000 }, () => {
  let srv;
  before(async () => {
    srv = await startServer({ port: 0, quiet: true, lobbyFactory: () => createLobby({ rejoinSeconds: 1 }) });
  });
  after(async () => {
    await srv.close();
  });

  test('create, join, pick, ready, snapshots, spectator mid-match, disconnect leads to forfeit', async () => {
    const a = client(srv.port);
    const b = client(srv.port);
    const spec = client(srv.port);
    await Promise.all([a.open, b.open, spec.open]);
    a.send({ t: 'hello', name: 'Alice', ver: PROTOCOL_VERSION });
    b.send({ t: 'hello', name: 'Bob', ver: PROTOCOL_VERSION });
    spec.send({ t: 'hello', name: 'Spec', ver: PROTOCOL_VERSION });
    const wa = await a.wait((m) => m.t === 'welcome');
    assert.ok(wa.token);
    await b.wait((m) => m.t === 'welcome');
    await spec.wait((m) => m.t === 'welcome');

    a.send({ t: 'create' });
    const roomA = await a.wait((m) => m.t === 'room');
    assert.equal(roomA.code.length, 4);
    assert.equal(roomA.you.seat, 0);
    assert.equal(roomA.host, true);
    assert.equal(roomA.transitions, true, 'stage transitions default on');

    b.send({ t: 'list' });
    const list = await b.wait((m) => m.t === 'rooms');
    assert.ok(list.rooms.some((r) => r.code === roomA.code));

    b.send({ t: 'join', code: roomA.code.toLowerCase(), role: 'p' });
    const roomB = await b.wait((m) => m.t === 'room' && m.you.seat === 1);
    assert.equal(roomB.seats.filter(Boolean).length, 2);

    // a tampered build must be clamped by the server
    a.send({ t: 'pick', charId: 'jidao', build: { charId: 'jidao', arts: ['thousandHand', 'ironShirt', 'vampiric'], statDelta: { pow: 9 }, slots: { N: 'lionsRoar', F: 'inkClone', B: 'sevenStep', U: 'pressurePoint', D: 'beardLash' } } });
    b.send({ t: 'pick', charId: 'moolan', build: { charId: 'moolan' } });
    await a.wait((m) => m.t === 'room' && m.seats[0]?.charId === 'jidao');

    // the host switches stage transitions off; a non-boolean value is ignored
    a.send({ t: 'stage', stageId: 'barnyard', events: 'off', transitions: false });
    await a.wait((m) => m.t === 'room' && m.transitions === false && m.stageId === 'barnyard');
    a.send({ t: 'stage', stageId: 'barnyard', events: 'off', transitions: 'yes please' });
    await a.wait((m) => m.t === 'room' && m.transitions === false);

    a.send({ t: 'ready', on: true });
    b.send({ t: 'ready', on: true });
    const startA = await a.wait((m) => m.t === 'start');
    assert.equal(startA.cfg.transitions, false);
    assert.equal(startA.cfg.stageId, 'barnyard');
    const startB = await b.wait((m) => m.t === 'start');
    assert.equal(startA.seat, 0);
    assert.equal(startB.seat, 1);
    const pb = startA.players[0].build;
    assert.ok(pb.cost <= 10, `server-resolved build must be within budget, got ${pb.cost}`);
    assert.ok(pb.arts.length <= 2);
    assert.notEqual(pb.slots.D, 'beardLash', 'other characters\' specials are rejected');

    // inputs flow and snapshots arrive
    for (let i = 0; i < 30; i++) a.send({ t: 'i', f: i, b: 8 });
    const snap = await a.wait((m) => m.t === 's' && m.v.frame > 20);
    assert.equal(snap.v.fighters.length, 2);
    assert.equal(snap.v.fighters[0].charId, 'jidao');

    // spectator joins mid-match and gets start + snapshots
    spec.send({ t: 'join', code: roomA.code, role: 's' });
    const specStart = await spec.wait((m) => m.t === 'start');
    assert.equal(specStart.seat, -1);
    await spec.wait((m) => m.t === 's');

    // B disconnects: match pauses, then forfeits after the (shortened) rejoin window
    b.close();
    const pause = await a.wait((m) => m.t === 'pause' && m.on);
    assert.equal(pause.seat, 1);
    const end = await a.wait((m) => m.t === 'end', 5000);
    assert.equal(end.winner, 0);
    assert.match(end.reason, /disconnect|forfeit|left/);
    a.close();
    spec.close();
  });

  test('rejoin with token resumes a paused match', async () => {
    const a = client(srv.port);
    const b = client(srv.port);
    await Promise.all([a.open, b.open]);
    a.send({ t: 'hello', name: 'A', ver: PROTOCOL_VERSION });
    b.send({ t: 'hello', name: 'B', ver: PROTOCOL_VERSION });
    await a.wait((m) => m.t === 'welcome');
    const wb = await b.wait((m) => m.t === 'welcome');
    a.send({ t: 'create' });
    const room = await a.wait((m) => m.t === 'room');
    b.send({ t: 'join', code: room.code, role: 'p' });
    await b.wait((m) => m.t === 'room' && m.you.seat === 1);
    a.send({ t: 'ready', on: true });
    b.send({ t: 'ready', on: true });
    await a.wait((m) => m.t === 'start');
    b.close();
    await a.wait((m) => m.t === 'pause' && m.on);
    const b2 = client(srv.port);
    await b2.open;
    b2.send({ t: 'hello', name: 'B', ver: PROTOCOL_VERSION, token: wb.token });
    const w2 = await b2.wait((m) => m.t === 'welcome');
    assert.equal(w2.rejoined, true);
    const st = await b2.wait((m) => m.t === 'start');
    assert.equal(st.seat, 1);
    await a.wait((m) => m.t === 'pause' && !m.on);
    a.close();
    b2.close();
  });

  test('bad version and bad json are rejected politely', async () => {
    const c = client(srv.port);
    await c.open;
    c.send({ t: 'hello', name: 'X', ver: 999 });
    const err = await c.wait((m) => m.t === 'err');
    assert.equal(err.code, 'bad_version');
    c.ws.send('{not json');
    const err2 = await c.wait((m) => m.t === 'err');
    assert.equal(err2.code, 'bad_msg');
    c.close();
  });
});

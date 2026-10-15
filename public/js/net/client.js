// LAN client: WebSocket connection, lobby messages, and the network match session (input upload,
// snapshot buffering with a small render delay, each frame's events fired exactly once).

import { C, S, PROTOCOL_VERSION, NET } from '../shared/protocol.js';
import { sampleSeat } from '../input/devices.js';
import { clearLatch } from '../input/keyboard.js';
import { loadProfile, saveProfile } from '../ui/buildStore.js';

const STEP_MS = 1000 / 60;

export function createNetClient() {
  const listeners = new Map();
  const profile = loadProfile();
  const net = {
    ws: null,
    id: null,
    token: profile.token || null,
    name: profile.name || '',
    connected: false,
    room: null,
    rooms: [],
    ping: null,
    session: null,
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type).delete(fn);
    },
    emit(type, msg) {
      for (const fn of listeners.get(type) || []) fn(msg);
    },
    send(msg) {
      if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
    },
    connect(name) {
      this.name = name || this.name || 'Wanderer';
      saveProfile({ ...loadProfile(), name: this.name });
      return new Promise((resolve, reject) => {
        const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
        let ws;
        try {
          ws = new WebSocket(url);
        } catch (err) {
          reject(err);
          return;
        }
        this.ws = ws;
        ws.onopen = () => {
          this.connected = true;
          this.send({ t: C.HELLO, name: this.name, ver: PROTOCOL_VERSION, token: this.token });
        };
        ws.onmessage = (ev) => {
          let msg;
          try {
            msg = JSON.parse(ev.data);
          } catch {
            return;
          }
          if (msg.t === S.WELCOME) {
            this.id = msg.id;
            this.token = msg.token;
            saveProfile({ ...loadProfile(), name: this.name, token: msg.token });
            resolve(msg);
          }
          this.handle(msg);
        };
        ws.onerror = () => {
          if (!this.connected) reject(new Error('Could not reach the UltraFist server.'));
        };
        ws.onclose = () => {
          const was = this.connected;
          this.connected = false;
          this.emit('disconnect', { was });
        };
        this.startPing();
      });
    },
    startPing() {
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ t: C.PING, t0: performance.now() }), 1000);
    },
    close() {
      clearInterval(this.pingTimer);
      if (this.ws) this.ws.close();
      this.ws = null;
    },
    handle(msg) {
      switch (msg.t) {
        case S.ROOMS:
          this.rooms = msg.rooms;
          break;
        case S.ROOM:
          this.room = msg;
          break;
        case S.PONG:
          this.ping = Math.max(0, Math.round(performance.now() - msg.t0));
          if (this.session) this.session.ping = this.ping;
          break;
        case S.START:
          this.session = createNetSession(this, msg);
          break;
        case S.SNAP:
          if (this.session) this.session.push(msg);
          break;
        case S.PAUSE:
          if (this.session) this.session.pauseInfo = msg.on ? msg : null;
          break;
        case S.END:
          if (this.session) this.session.ended = msg;
          break;
        default:
          break;
      }
      this.emit(msg.t, msg);
      this.emit('*', msg);
    },
  };
  return net;
}

// The view-only match session used while playing or spectating over LAN.
export function createNetSession(net, start) {
  const seat = start.seat;
  const sess = {
    kind: 'net',
    seat,
    spectating: seat < 0,
    cfg: start.cfg,
    players: start.players,
    cos: start.players.map((p) => p.build?.cos),
    queue: [],
    current: null,
    acc: 0,
    last: 0,
    sendAcc: 0,
    localFrame: 0,
    ping: net.ping,
    paused: false,
    pauseInfo: null,
    ended: null,
    pauseRequested: false,
    push(msg) {
      this.queue.push(msg);
      if (this.queue.length > 30) this.queue.splice(0, this.queue.length - 30);
    },
    view() {
      return this.current ? this.current.v : null;
    },
    // Called every animation frame: upload input at 60 Hz, consume snapshots with a small buffer.
    update(now) {
      if (!this.last) this.last = now;
      let dt = now - this.last;
      this.last = now;
      if (dt > 250) dt = 250;
      // input upload at 60 Hz
      if (!this.spectating) {
        this.sendAcc += dt;
        let n = 0;
        while (this.sendAcc >= STEP_MS && n < 4) {
          this.sendAcc -= STEP_MS;
          n++;
          const r = sampleSeat(['kb1', 'kb2', 'pad0']);
          clearLatch();
          if (r.pause) this.pauseRequested = true;
          net.send({ t: C.INPUT, f: this.localFrame++, b: r.byte });
        }
        if (n === 4) this.sendAcc = 0;
      }
      // snapshot playback: keep ~RENDER_DELAY frames buffered
      const events = [];
      this.acc += dt;
      let consume = 0;
      while (this.acc >= STEP_MS) {
        this.acc -= STEP_MS;
        consume++;
      }
      const target = NET.RENDER_DELAY_FRAMES;
      if (!this.started) {
        if (this.queue.length < target) return events;
        this.started = true;
        consume = 1;
      }
      // fall too far behind (tab hidden, hiccup): skip ahead but keep every event
      if (this.queue.length > target + 6) consume += this.queue.length - target;
      for (let i = 0; i < consume; i++) {
        const snap = this.queue.shift();
        if (!snap) break;
        this.current = snap;
        for (const e of snap.e || []) events.push(e);
      }
      return events;
    },
  };
  return sess;
}

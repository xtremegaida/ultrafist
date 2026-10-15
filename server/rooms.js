// LAN lobby: rooms with 4-letter codes, two seats plus spectators, picks, ready-up, matches,
// disconnect pause with token-based rejoin, forfeits and rematches.

import crypto from 'node:crypto';
import { C, S, ERR, NET, PROTOCOL_VERSION } from '../public/js/shared/protocol.js';
import { CHAR_IDS } from '../public/js/data/characters/index.js';
import { STAGE_IDS } from '../public/js/data/stages.js';
import { defaultBuild } from '../public/js/data/presets.js';
import { resolveBuild } from '../public/js/sim/builds.js';
import { createMatchHost } from './match-host.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const EVENT_LEVELS = ['off', 'rare', 'normal', 'chaos'];

function cleanName(n) {
  return String(n || '').replace(/[^\p{L}\p{N} _\-.!?']/gu, '').trim().slice(0, 16) || 'Wanderer';
}

export function createLobby(opts = {}) {
  const clients = new Map(); // id -> client
  const byToken = new Map(); // token -> client
  const rooms = new Map(); // code -> room
  let nextId = 1;
  const rejoinMs = (opts.rejoinSeconds ?? NET.REJOIN_SECONDS) * 1000;

  function send(c, msg) {
    if (c && c.ws && c.ws.isOpen) c.ws.send(JSON.stringify(msg));
  }

  function newCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
  }

  function roomSummary(room) {
    return {
      code: room.code, name: room.name, phase: room.phase,
      players: room.seats.filter(Boolean).length, specs: room.specs.size,
    };
  }

  function seatInfo(seat) {
    if (!seat) return null;
    const c = clients.get(seat.clientId);
    return {
      name: seat.name, charId: seat.build?.charId || null, buildName: seat.build?.name || null,
      ready: seat.ready, connected: !!(c && c.ws && c.ws.isOpen), cos: seat.build ? resolveBuild(seat.build).cos : null,
    };
  }

  function roomState(room, forClient) {
    const seatIdx = room.seats.findIndex((s) => s && s.clientId === forClient.id);
    return {
      t: S.ROOM, code: room.code, name: room.name, phase: room.phase,
      host: room.hostId === forClient.id,
      stageId: room.stageId, events: room.events, transitions: room.transitions,
      seats: room.seats.map(seatInfo),
      specs: room.specs.size,
      you: { seat: seatIdx, role: seatIdx >= 0 ? 'p' : 's' },
    };
  }

  function broadcastRoom(room) {
    for (const c of membersOf(room)) send(c, roomState(room, c));
  }

  function membersOf(room) {
    const out = [];
    for (const s of room.seats) if (s) {
      const c = clients.get(s.clientId);
      if (c) out.push(c);
    }
    for (const id of room.specs) {
      const c = clients.get(id);
      if (c) out.push(c);
    }
    return out;
  }

  function leaveRoom(c, { keepSeat = false } = {}) {
    const room = c.room ? rooms.get(c.room) : null;
    c.room = null;
    if (!room) return;
    room.specs.delete(c.id);
    const idx = room.seats.findIndex((s) => s && s.clientId === c.id);
    if (idx >= 0 && !keepSeat) {
      if (room.phase === 'match' && room.host) room.host.forfeit(idx, 'left');
      room.seats[idx] = null;
    }
    if (room.hostId === c.id) {
      const other = room.seats.find((s) => s && s.clientId !== c.id);
      room.hostId = other ? other.clientId : null;
    }
    if (!room.seats.some(Boolean) && room.specs.size === 0) {
      if (room.host) room.host.stop();
      rooms.delete(room.code);
      return;
    }
    if (room.phase !== 'match') {
      for (const s of room.seats) if (s) s.ready = false;
    }
    broadcastRoom(room);
  }

  function startMatch(room) {
    const seed = crypto.randomInt(1, 2 ** 31);
    const builds = room.seats.map((s) => resolveBuild(s.build));
    const cfg = { seed, stageId: room.stageId === 'random' ? STAGE_IDS[crypto.randomInt(STAGE_IDS.length)] : room.stageId, builds, events: room.events, transitions: room.transitions, timer: 99, wins: 2 };
    room.phase = 'match';
    room.cfg = cfg;
    room.host = createMatchHost(cfg, {
      broadcast: (str) => {
        for (const c of membersOf(room)) if (c.ws && c.ws.isOpen) c.ws.send(str);
      },
      onEnd: (winner, reason) => {
        room.phase = 'results';
        room.host = null;
        for (const s of room.seats) if (s) {
          s.ready = false;
          s.rematch = false;
        }
        for (const c of membersOf(room)) send(c, { t: S.END, winner, reason });
        broadcastRoom(room);
      },
    });
    for (const c of membersOf(room)) sendStart(room, c);
    broadcastRoom(room);
  }

  function sendStart(room, c) {
    const seat = room.seats.findIndex((s) => s && s.clientId === c.id);
    send(c, {
      t: S.START, seed: room.cfg.seed, cfg: room.cfg, seat,
      players: room.seats.map((s) => ({ name: s?.name, charId: s?.build?.charId, build: s ? resolveBuild(s.build) : null })),
    });
  }

  function handle(c, msg) {
    if (!msg || typeof msg.t !== 'string') return send(c, { t: S.ERR, code: ERR.BAD_MSG, msg: 'bad message' });
    const room = c.room ? rooms.get(c.room) : null;
    switch (msg.t) {
      case C.HELLO: {
        if (msg.ver !== PROTOCOL_VERSION) return send(c, { t: S.ERR, code: ERR.BAD_VERSION, msg: 'Version mismatch — refresh the page.' });
        c.name = cleanName(msg.name);
        // rejoin by token
        const prev = msg.token && byToken.get(msg.token);
        if (prev && prev !== c && prev.pendingRejoin) {
          clearTimeout(prev.pendingRejoin);
          prev.pendingRejoin = null;
          c.token = prev.token;
          byToken.set(c.token, c);
          clients.delete(c.id);
          clients.delete(prev.id);
          c.id = prev.id;
          clients.set(c.id, c);
          c.room = prev.room;
          const r = c.room && rooms.get(c.room);
          send(c, { t: S.WELCOME, id: c.id, token: c.token, ver: PROTOCOL_VERSION, rejoined: true });
          if (r) {
            const seat = r.seats.find((s) => s && s.clientId === c.id);
            if (seat) seat.name = c.name;
            if (r.phase === 'match' && r.host) {
              sendStart(r, c);
              r.host.resume(r.seats.findIndex((s) => s && s.clientId === c.id));
            }
            broadcastRoom(r);
          }
          return;
        }
        c.token = crypto.randomBytes(12).toString('hex');
        byToken.set(c.token, c);
        return send(c, { t: S.WELCOME, id: c.id, token: c.token, ver: PROTOCOL_VERSION });
      }
      case C.LIST:
        return send(c, { t: S.ROOMS, rooms: [...rooms.values()].map(roomSummary) });
      case C.CREATE: {
        if (room) leaveRoom(c);
        const code = newCode();
        const r = {
          code, name: cleanName(msg.name || `${c.name}'s dojo`), phase: 'lobby', hostId: c.id,
          seats: [{ clientId: c.id, name: c.name, build: defaultBuild(CHAR_IDS[0]), ready: false }, null],
          specs: new Set(), stageId: 'random', events: 'normal', transitions: true, host: null, cfg: null,
        };
        rooms.set(code, r);
        c.room = code;
        return broadcastRoom(r);
      }
      case C.JOIN: {
        const code = String(msg.code || '').toUpperCase().trim();
        const r = rooms.get(code);
        if (!r) return send(c, { t: S.ERR, code: ERR.NO_ROOM, msg: `No room with code ${code}.` });
        if (room && room !== r) leaveRoom(c);
        c.room = code;
        const free = r.seats.findIndex((s) => !s);
        if (msg.role !== 's' && free >= 0 && r.phase !== 'match') {
          r.seats[free] = { clientId: c.id, name: c.name, build: defaultBuild(CHAR_IDS[5]), ready: false };
          if (!r.hostId) r.hostId = c.id;
        } else {
          r.specs.add(c.id);
          if (msg.role !== 's' && free < 0) send(c, { t: S.CHAT, from: 'dojo', text: 'Both seats are taken — you are spectating.' });
          if (r.phase === 'match' && r.host) sendStart(r, c);
        }
        return broadcastRoom(r);
      }
      case C.PICK: {
        if (!room) return;
        const seat = room.seats.find((s) => s && s.clientId === c.id);
        if (!seat || room.phase === 'match') return;
        const resolved = resolveBuild({ ...(msg.build || {}), charId: msg.charId || msg.build?.charId });
        seat.build = { ...resolved, cosmetic: resolved.cos };
        seat.ready = false;
        return broadcastRoom(room);
      }
      case C.STAGE: {
        if (!room) return;
        if (room.hostId !== c.id) return send(c, { t: S.ERR, code: ERR.NOT_HOST, msg: 'Only the host can change the arena.' });
        if (msg.stageId === 'random' || STAGE_IDS.includes(msg.stageId)) room.stageId = msg.stageId;
        if (EVENT_LEVELS.includes(msg.events)) room.events = msg.events;
        if (typeof msg.transitions === 'boolean') room.transitions = msg.transitions;
        return broadcastRoom(room);
      }
      case C.READY: {
        if (!room || room.phase === 'match') return;
        const seat = room.seats.find((s) => s && s.clientId === c.id);
        if (!seat) return;
        seat.ready = !!msg.on;
        if (room.seats.every((s) => s && s.ready)) return startMatch(room);
        return broadcastRoom(room);
      }
      case C.INPUT: {
        if (!room || !room.host) return;
        const idx = room.seats.findIndex((s) => s && s.clientId === c.id);
        if (idx >= 0) room.host.input(idx, msg.b | 0);
        return;
      }
      case C.REMATCH: {
        if (!room || room.phase !== 'results') return;
        const seat = room.seats.find((s) => s && s.clientId === c.id);
        if (!seat) return;
        seat.rematch = true;
        if (room.seats.every((s) => s && s.rematch)) return startMatch(room);
        room.phase = 'results';
        return broadcastRoom(room);
      }
      case C.LEAVE:
        leaveRoom(c);
        return send(c, { t: S.ROOMS, rooms: [...rooms.values()].map(roomSummary) });
      case C.PING:
        return send(c, { t: S.PONG, t0: msg.t0 ?? msg.time ?? 0 });
      default:
        return send(c, { t: S.ERR, code: ERR.BAD_MSG, msg: `unknown message ${msg.t}` });
    }
  }

  function onClose(c) {
    clients.delete(c.id);
    const room = c.room ? rooms.get(c.room) : null;
    const seatIdx = room ? room.seats.findIndex((s) => s && s.clientId === c.id) : -1;
    if (room && seatIdx >= 0 && room.phase === 'match' && room.host) {
      // keep the seat for a while so the player can rejoin with their token
      clients.set(c.id, c);
      room.host.pause(seatIdx, Math.round(rejoinMs / 1000));
      broadcastRoom(room);
      c.pendingRejoin = setTimeout(() => {
        c.pendingRejoin = null;
        clients.delete(c.id);
        byToken.delete(c.token);
        if (room.host) room.host.forfeit(seatIdx, 'disconnect');
        leaveRoom(c);
      }, rejoinMs);
      c.pendingRejoin.unref?.();
      return;
    }
    if (c.token) byToken.delete(c.token);
    leaveRoom(c);
  }

  return {
    onConnection(ws) {
      const c = { id: nextId++, ws, name: 'Wanderer', token: null, room: null, pendingRejoin: null };
      clients.set(c.id, c);
      ws.on('message', (text) => {
        let msg;
        try {
          msg = JSON.parse(text);
        } catch {
          return send(c, { t: S.ERR, code: ERR.BAD_MSG, msg: 'invalid JSON' });
        }
        try {
          handle(c, msg);
        } catch (err) {
          console.error('lobby error:', err);
          send(c, { t: S.ERR, code: ERR.BAD_MSG, msg: 'server error' });
        }
      });
      ws.on('close', () => {
        try {
          onClose(c);
        } catch (err) {
          console.error('lobby close error:', err);
        }
      });
    },
    close() {
      for (const r of rooms.values()) if (r.host) r.host.stop();
      for (const c of clients.values()) if (c.pendingRejoin) clearTimeout(c.pendingRejoin);
      rooms.clear();
      clients.clear();
    },
    // for tests
    _rooms: rooms,
  };
}

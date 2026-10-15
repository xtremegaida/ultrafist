// Shared LAN protocol definitions. Imported by both the browser client and the Node server.
// All messages are JSON text frames of the form { t: <type>, ...payload }.

export const PROTOCOL_VERSION = 1;

// Client -> server
export const C = {
  HELLO: 'hello',     // { name, ver, token? }
  LIST: 'list',       // {}
  CREATE: 'create',   // { name? }
  JOIN: 'join',       // { code, role: 'p' | 's' }
  PICK: 'pick',       // { charId, build }
  STAGE: 'stage',     // { stageId, events, transitions }  (host only)
  READY: 'ready',     // { on: bool }
  INPUT: 'i',         // { f, b }               one per client frame
  REMATCH: 'rematch', // {}
  LEAVE: 'leave',     // {}
  PING: 'ping',       // { t }
};

// Server -> client
export const S = {
  WELCOME: 'welcome', // { id, token, ver }
  ROOMS: 'rooms',     // { rooms: [{ code, name, phase, players, specs }] }
  ROOM: 'room',       // { code, name, phase, host, seats: [seat|null, seat|null], specs: n, you: { seat, role } }
  START: 'start',     // { seed, cfg, players: [{ name, charId, build }] , seat }
  SNAP: 's',          // { s: [frame, packedState, events] }
  PAUSE: 'pause',     // { on, reason, seat?, secondsLeft? }
  END: 'end',         // { winner, reason }
  PONG: 'pong',       // { t }
  ERR: 'err',         // { code, msg }
  CHAT: 'chat',       // { from, text }    (system notices)
};

export const ROOM_PHASES = ['lobby', 'match', 'results'];

export const ERR = {
  BAD_VERSION: 'bad_version',
  NO_ROOM: 'no_room',
  ROOM_FULL: 'room_full',
  BAD_MSG: 'bad_msg',
  NOT_HOST: 'not_host',
  NOT_READY: 'not_ready',
};

export const NET = {
  INPUT_QUEUE_CAP: 4,
  REJOIN_SECONDS: 15,
  HEARTBEAT_MS: 5000,
  TIMEOUT_MS: 15000,
  RENDER_DELAY_FRAMES: 2,
};

// Hand-rolled RFC 6455 WebSocket server side: handshake, incremental frame parser, connection wrapper.
import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';

export const OP = { CONT: 0, TEXT: 1, BIN: 2, CLOSE: 8, PING: 9, PONG: 10 };

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const EMPTY = Buffer.alloc(0);
const KNOWN_OPCODES = new Set(Object.values(OP));
const KEY_RE = /^[A-Za-z0-9+/]{22}==$/;
const GRACE_MS = 1000;
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const kFeed = Symbol('feed');
let nextId = 1;

// ---------------------------------------------------------------------------
// Frame encoding

export function encodeFrame(opcode, payload, { fin = true, mask = false } = {}) {
  const data = toBuffer(payload);
  const len = data.length;
  const extLen = len < 126 ? 0 : len < 0x10000 ? 2 : 8;
  const headerLen = 2 + extLen + (mask ? 4 : 0);
  const out = Buffer.allocUnsafe(headerLen + len);
  out[0] = (fin ? 0x80 : 0) | (opcode & 0x0f);
  out[1] = (mask ? 0x80 : 0) | (extLen === 0 ? len : extLen === 2 ? 126 : 127);
  if (extLen === 2) out.writeUInt16BE(len, 2);
  else if (extLen === 8) out.writeBigUInt64BE(BigInt(len), 2);
  if (!mask) {
    data.copy(out, headerLen);
    return out;
  }
  const key = randomBytes(4);
  key.copy(out, headerLen - 4);
  for (let i = 0; i < len; i++) out[headerLen + i] = data[i] ^ key[i & 3];
  return out;
}

function toBuffer(payload) {
  if (payload == null) return EMPTY;
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
}

function unmask(payload, key) {
  const out = Buffer.allocUnsafe(payload.length);
  for (let i = 0; i < payload.length; i++) out[i] = payload[i] ^ key[i & 3];
  return out;
}

// ---------------------------------------------------------------------------
// Incremental frame parser. Steps: head (2 bytes) -> len (0/2/8) -> mask (0/4) -> body.

export class FrameParser extends EventEmitter {
  #chunks = [];
  #size = 0;
  #step = 'head';
  #need = 2;
  #frame = null;
  #failed = false;

  constructor({ requireMask = true, maxPayload = 1 << 20 } = {}) {
    super();
    this.requireMask = requireMask;
    this.maxPayload = maxPayload;
  }

  push(chunk) {
    if (this.#failed) return;
    this.#chunks.push(chunk);
    this.#size += chunk.length;
    while (!this.#failed && this.#size >= this.#need) this.#advance(this.#take(this.#need));
  }

  // Removes exactly n buffered bytes, copying only when they span several chunks.
  #take(n) {
    if (n === 0) return EMPTY;
    this.#size -= n;
    const first = this.#chunks[0];
    if (first.length === n) return this.#chunks.shift();
    if (first.length > n) {
      this.#chunks[0] = first.subarray(n);
      return first.subarray(0, n);
    }
    const out = Buffer.allocUnsafe(n);
    let offset = 0;
    let used = 0;
    while (offset < n) {
      const chunk = this.#chunks[used];
      const count = Math.min(chunk.length, n - offset);
      chunk.copy(out, offset, 0, count);
      offset += count;
      if (count < chunk.length) this.#chunks[used] = chunk.subarray(count);
      else used++;
    }
    this.#chunks.splice(0, used);
    return out;
  }

  #advance(buf) {
    if (this.#step === 'head') this.#readHead(buf);
    else if (this.#step === 'len') this.#readLength(buf);
    else if (this.#step === 'mask') this.#readMask(buf);
    else this.#emitFrame(buf);
  }

  #readHead(buf) {
    const fin = (buf[0] & 0x80) !== 0;
    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    const len7 = buf[1] & 0x7f;
    const isControl = opcode >= 8;
    if (buf[0] & 0x70) return this.#fail(1002, 'RSV bits must be 0');
    if (!KNOWN_OPCODES.has(opcode)) return this.#fail(1002, `unknown opcode ${opcode}`);
    if (isControl && !fin) return this.#fail(1002, 'fragmented control frame');
    if (isControl && len7 > 125) return this.#fail(1002, 'control frame payload too big');
    if (this.requireMask && !masked) return this.#fail(1002, 'client frames must be masked');
    this.#frame = { fin, opcode, masked, length: len7, key: null };
    if (len7 === 126) this.#expect('len', 2);
    else if (len7 === 127) this.#expect('len', 8);
    else this.#afterLength();
  }

  #readLength(buf) {
    // BigInt for 64-bit lengths; BigInt/Number comparison is exact.
    const length = buf.length === 2 ? buf.readUInt16BE(0) : buf.readBigUInt64BE(0);
    if (length > this.maxPayload) return this.#fail(1009, 'payload too big');
    this.#frame.length = Number(length);
    this.#afterLength();
  }

  #afterLength() {
    if (this.#frame.length > this.maxPayload) return this.#fail(1009, 'payload too big');
    if (this.#frame.masked) this.#expect('mask', 4);
    else this.#expect('body', this.#frame.length);
  }

  #readMask(buf) {
    this.#frame.key = buf;
    this.#expect('body', this.#frame.length);
  }

  #emitFrame(body) {
    const { fin, opcode, masked, key } = this.#frame;
    this.#frame = null;
    this.#expect('head', 2);
    // Unmask into a fresh buffer so callers' input buffers are never mutated.
    const payload = masked ? unmask(body, key) : body;
    this.emit('frame', { fin, opcode, payload, masked });
  }

  #expect(step, need) {
    this.#step = step;
    this.#need = need;
  }

  #fail(code, message) {
    this.#failed = true;
    this.#chunks = [];
    this.#size = 0;
    this.emit('error', { code, message });
  }
}

// ---------------------------------------------------------------------------
// Connection

function isValidCloseCode(code) {
  if (code >= 3000 && code <= 4999) return true;
  return code >= 1000 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006;
}

// Close reasons are capped at 123 bytes; cut on a UTF-8 character boundary.
function closePayload(code, reason) {
  let text = Buffer.from(reason);
  if (text.length > 123) {
    let end = 123;
    while (end > 0 && (text[end] & 0xc0) === 0x80) end--;
    text = text.subarray(0, end);
  }
  const out = Buffer.allocUnsafe(2 + text.length);
  out.writeUInt16BE(code, 0);
  text.copy(out, 2);
  return out;
}

function parseClosePayload(payload) {
  if (payload.length === 0) return { code: 1005, reason: '' };
  if (payload.length === 1) return { error: 1002, message: 'invalid close frame' };
  const code = payload.readUInt16BE(0);
  if (!isValidCloseCode(code)) return { error: 1002, message: `invalid close code ${code}` };
  try {
    return { code, reason: utf8.decode(payload.subarray(2)) };
  } catch {
    return { error: 1007, message: 'invalid close reason' };
  }
}

export class WsConnection extends EventEmitter {
  #socket;
  #parser;
  #state = 'open'; // open -> closing -> closed
  #closeCode = null;
  #closeReason = '';
  #message = null; // fragmented message in progress: { parts, size }
  #pingTimer = null;
  #watchdog = null;
  #graceTimer = null;

  constructor(socket, { maxPayload = 1 << 20, heartbeatMs = 5000, timeoutMs = 15000 } = {}) {
    super();
    this.id = nextId++;
    this.remoteAddress = socket.remoteAddress ?? '';
    this.maxPayload = maxPayload;
    this.lastActivity = Date.now();
    this.#socket = socket;
    // Critical for latency: Nagle + Windows delayed ACK would hold small frames back.
    socket.setNoDelay?.(true);
    socket.setKeepAlive?.(true);
    this.#parser = new FrameParser({ requireMask: true, maxPayload });
    this.#parser.on('frame', (frame) => this.#onFrame(frame));
    this.#parser.on('error', ({ code, message }) => this.#fail(code, message));
    socket.on('data', (chunk) => this.#parser.push(chunk));
    socket.on('end', () => this.#onSocketEnd());
    socket.on('error', (err) => this.#emitError(err));
    socket.on('close', () => this.#onSocketClose());
    this.#startHeartbeat(heartbeatMs, timeoutMs);
  }

  get isOpen() {
    return this.#state === 'open';
  }

  get bufferedAmount() {
    return this.#socket.writableLength ?? 0;
  }

  send(text) {
    if (this.#state !== 'open') return;
    this.#write(encodeFrame(OP.TEXT, text));
  }

  close(code = 1000, reason = '') {
    if (this.#state !== 'open') return;
    if (!isValidCloseCode(code)) throw new RangeError(`invalid close code ${code}`);
    this.#sendClose(code, reason);
    this.#endSocket();
  }

  // Bytes that arrived together with the HTTP upgrade request.
  [kFeed](chunk) {
    this.#parser.push(chunk);
  }

  #onFrame({ fin, opcode, payload }) {
    this.lastActivity = Date.now();
    if (opcode === OP.PING) {
      if (this.#state === 'open') this.#write(encodeFrame(OP.PONG, payload));
    } else if (opcode === OP.CLOSE) {
      this.#onCloseFrame(payload);
    } else if (opcode !== OP.PONG && this.#state === 'open') {
      this.#onDataFrame(fin, opcode, payload);
    }
  }

  #onDataFrame(fin, opcode, payload) {
    if (opcode === OP.CONT) {
      if (!this.#message) return this.#fail(1002, 'unexpected continuation frame');
    } else {
      if (this.#message) return this.#fail(1002, 'expected a continuation frame');
      if (opcode === OP.BIN) return this.#fail(1003, 'binary messages are not supported');
      this.#message = { parts: [], size: 0 };
    }
    const msg = this.#message;
    msg.size += payload.length;
    if (msg.size > this.maxPayload) return this.#fail(1009, 'message too big');
    msg.parts.push(payload);
    if (!fin) return;
    this.#message = null;
    this.#emitText(msg.parts.length === 1 ? msg.parts[0] : Buffer.concat(msg.parts, msg.size));
  }

  #emitText(data) {
    let text;
    try {
      text = utf8.decode(data);
    } catch {
      return this.#fail(1007, 'invalid UTF-8');
    }
    this.emit('message', text);
  }

  #onCloseFrame(payload) {
    const parsed = parseClosePayload(payload);
    if (parsed.error) return this.#fail(parsed.error, parsed.message);
    if (this.#state === 'open') {
      this.#sendClose(parsed.code === 1005 ? null : parsed.code, '');
      this.#closeCode = parsed.code;
      this.#closeReason = parsed.reason;
    }
    this.#endSocket();
  }

  #sendClose(code, reason) {
    this.#state = 'closing';
    this.#closeCode = code;
    this.#closeReason = reason;
    this.#write(encodeFrame(OP.CLOSE, code === null ? EMPTY : closePayload(code, reason)));
  }

  #fail(code, message) {
    this.#emitError(Object.assign(new Error(message), { closeCode: code }));
    if (this.#state !== 'open') return this.#socket.destroy();
    this.#sendClose(code, message);
    this.#endSocket();
  }

  #onSocketEnd() {
    // Peer half-closed TCP (possibly without a CLOSE frame): finish our side too.
    if (this.#state === 'open') this.#state = 'closing';
    this.#endSocket();
  }

  #endSocket() {
    if (!this.#graceTimer) {
      this.#graceTimer = setTimeout(() => this.#socket.destroy(), GRACE_MS);
      this.#graceTimer.unref();
    }
    if (!this.#socket.writableEnded) this.#socket.end();
  }

  #terminate(code, reason) {
    if (this.#closeCode === null) {
      this.#closeCode = code;
      this.#closeReason = reason;
    }
    this.#socket.destroy();
  }

  #onSocketClose() {
    if (this.#state === 'closed') return;
    this.#state = 'closed';
    clearInterval(this.#pingTimer);
    clearTimeout(this.#watchdog);
    clearTimeout(this.#graceTimer);
    this.#message = null;
    this.emit('close', this.#closeCode ?? 1006, this.#closeReason);
  }

  #startHeartbeat(heartbeatMs, timeoutMs) {
    if (heartbeatMs > 0) {
      this.#pingTimer = setInterval(() => {
        if (this.#state === 'open') this.#write(encodeFrame(OP.PING, EMPTY));
      }, heartbeatMs);
      this.#pingTimer.unref();
    }
    if (timeoutMs > 0) this.#armWatchdog(timeoutMs, timeoutMs);
  }

  // Re-arms for the remaining idle budget instead of resetting a timer on every frame.
  #armWatchdog(delay, timeoutMs) {
    this.#watchdog = setTimeout(() => {
      const idle = Date.now() - this.lastActivity;
      if (idle >= timeoutMs) this.#terminate(1006, 'heartbeat timeout');
      else this.#armWatchdog(timeoutMs - idle, timeoutMs);
    }, delay);
    this.#watchdog.unref();
  }

  #write(buf) {
    const socket = this.#socket;
    if (socket.destroyed || socket.writableEnded) return;
    socket.write(buf);
  }

  #emitError(err) {
    if (this.listenerCount('error') > 0) this.emit('error', err);
  }
}

// ---------------------------------------------------------------------------
// HTTP upgrade

function hasToken(header, token) {
  return String(header ?? '').toLowerCase().split(',').some((part) => part.trim() === token);
}

function isValidUpgrade(req) {
  return req.method === 'GET'
    && hasToken(req.headers.upgrade, 'websocket')
    && hasToken(req.headers.connection, 'upgrade')
    && req.headers['sec-websocket-version'] === '13'
    && KEY_RE.test(req.headers['sec-websocket-key'] ?? '');
}

function rejectUpgrade(socket, status, text) {
  socket.on('error', () => {});
  if (!socket.writable) return socket.destroy();
  const body = `${status} ${text}\n`;
  socket.once('finish', () => socket.destroy());
  socket.end(
    `HTTP/1.1 ${status} ${text}\r\n`
    + 'Connection: close\r\n'
    + 'Content-Type: text/plain; charset=utf-8\r\n'
    + `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
  );
}

export function handleUpgrade(req, socket, head, onOpen, opts = {}) {
  const { path = '/ws', ...connectionOpts } = opts;
  const pathname = (req.url ?? '').split('?', 1)[0];
  if (path && pathname !== path) return rejectUpgrade(socket, 404, 'Not Found');
  if (!isValidUpgrade(req)) return rejectUpgrade(socket, 400, 'Bad Request');
  if (!socket.writable) return socket.destroy();

  const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
  socket.setTimeout?.(0);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n'
    + 'Upgrade: websocket\r\n'
    + 'Connection: Upgrade\r\n'
    + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  const ws = new WsConnection(socket, connectionOpts);
  onOpen(ws, req);
  // Feed early frames only after onOpen so its 'message' listeners see them.
  if (head && head.length > 0) ws[kFeed](head);
  return ws;
}

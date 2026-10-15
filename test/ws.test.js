import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { Duplex } from 'node:stream';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { OP, encodeFrame, FrameParser, WsConnection } from '../server/ws.js';
import { createStaticHandler } from '../server/static.js';
import { startServer } from '../server.js';

// Transport tests use a trivial echo lobby so they stay independent of game logic.
const echoLobby = () => ({ onConnection(ws) { ws.on('message', (m) => ws.send(m)); }, close() {} });

const RFC_KEY = 'dGhlIHNhbXBsZSBub25jZQ==';
const RFC_ACCEPT = 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=';
const EMPTY_PAYLOAD = Buffer.alloc(0);

// ---------------------------------------------------------------------------
// Helpers

function collect(opts) {
  const parser = new FrameParser(opts);
  const frames = [];
  const errors = [];
  parser.on('frame', (f) => frames.push(f));
  parser.on('error', (e) => errors.push(e));
  return { parser, frames, errors };
}

function parseServerFrames(buf) {
  const { parser, frames, errors } = collect({ requireMask: false });
  parser.push(buf);
  assert.deepEqual(errors, []);
  return frames;
}

function closeFrame(code, reason = '') {
  const body = Buffer.alloc(2 + Buffer.byteLength(reason));
  body.writeUInt16BE(code, 0);
  body.write(reason, 2);
  return encodeFrame(OP.CLOSE, body, { mask: true });
}

function headerLength(size, masked) {
  return 2 + (size < 126 ? 0 : size < 65536 ? 2 : 8) + (masked ? 4 : 0);
}

// In-memory socket: `receive` feeds bytes to the server side; writes land in `out`.
function fakeSocket() {
  let eof = false;
  const hangUp = () => {
    if (eof) return;
    eof = true;
    sock.push(null);
  };
  const sock = new Duplex({
    read() {},
    write(chunk, _enc, cb) {
      sock.out.push(Buffer.from(chunk));
      cb();
    },
    final(cb) {
      hangUp(); // the peer closes once it sees our FIN
      cb();
    },
  });
  sock.out = [];
  sock.calls = {};
  sock.remoteAddress = '10.0.0.7';
  sock.setNoDelay = (on) => { sock.calls.noDelay = on; };
  sock.setKeepAlive = (on) => { sock.calls.keepAlive = on; };
  sock.receive = (buf) => sock.push(buf);
  sock.hangUp = hangUp;
  sock.frames = () => parseServerFrames(Buffer.concat(sock.out));
  return sock;
}

// Like events.once, but without the implicit 'error' listener (WsConnection only emits
// 'error' when someone listens, and events.once would turn that into a rejection).
function nextEvent(emitter, name) {
  return new Promise((resolve) => emitter.once(name, (...args) => resolve(args)));
}

function wsEvent(ws, type) {
  return new Promise((resolve, reject) => {
    ws.addEventListener(type, resolve, { once: true });
    if (type !== 'close' && type !== 'error') {
      ws.addEventListener('error', () => reject(new Error(`WebSocket error while waiting for ${type}`)), { once: true });
    }
  });
}

async function nextMessage(ws) {
  return (await wsEvent(ws, 'message')).data;
}

function tapConnections(lobby) {
  const conns = [];
  const original = lobby.onConnection;
  lobby.onConnection = function (ws, req) {
    conns.push(ws);
    return original.call(this, ws, req);
  };
  conns.restore = () => { lobby.onConnection = original; };
  return conns;
}

function upgradeRequest(port, { path: reqPath = '/ws', key = RFC_KEY, version = '13' } = {}) {
  const lines = [
    `GET ${reqPath} HTTP/1.1`,
    `Host: 127.0.0.1:${port}`,
    'Upgrade: WebSocket',
    'Connection: keep-alive, Upgrade',
    'Sec-WebSocket-Version: ' + version,
  ];
  if (key) lines.push(`Sec-WebSocket-Key: ${key}`);
  return `${lines.join('\r\n')}\r\n\r\n`;
}

// Raw TCP client: resolves the HTTP response head, then exposes received frames in order.
function rawClient(port, firstWrite) {
  const sock = net.connect(port, '127.0.0.1');
  const parser = new FrameParser({ requireMask: false });
  const frames = [];
  const waiters = [];
  parser.on('frame', (f) => (waiters.length ? waiters.shift()(f) : frames.push(f)));
  parser.on('error', (e) => assert.fail(`server sent a bad frame: ${e.message}`));
  let pending = Buffer.alloc(0);
  let upgraded = false;
  const head = new Promise((resolve, reject) => {
    sock.on('data', (chunk) => {
      if (upgraded) return parser.push(chunk);
      pending = Buffer.concat([pending, chunk]);
      const end = pending.indexOf('\r\n\r\n');
      if (end < 0) return;
      const response = pending.subarray(0, end).toString();
      resolve(response);
      upgraded = response.startsWith('HTTP/1.1 101 ');
      const rest = pending.subarray(end + 4);
      if (upgraded && rest.length) parser.push(rest);
    });
    sock.on('error', reject);
    sock.on('close', () => resolve(pending.toString()));
  });
  const ended = once(sock, 'close');
  const nextFrame = () => (frames.length ? Promise.resolve(frames.shift()) : new Promise((r) => waiters.push(r)));
  sock.write(firstWrite);
  return { sock, head, nextFrame, ended };
}

// ---------------------------------------------------------------------------

describe('encodeFrame / FrameParser', () => {
  test('masked round-trip across 7-bit, 16-bit and 64-bit lengths', () => {
    for (const size of [0, 125, 126, 65535, 65536, 200000]) {
      const payload = randomBytes(size);
      const frame = encodeFrame(OP.BIN, payload, { mask: true });
      assert.equal(frame.length, headerLength(size, true) + size, `size ${size}`);
      assert.equal(frame[1] & 0x7f, size < 126 ? size : size < 65536 ? 126 : 127);
      assert.equal(frame[1] & 0x80, 0x80);

      const { parser, frames, errors } = collect();
      parser.push(frame);
      assert.deepEqual(errors, []);
      assert.equal(frames.length, 1);
      assert.equal(frames[0].fin, true);
      assert.equal(frames[0].opcode, OP.BIN);
      assert.equal(frames[0].masked, true);
      assert.ok(frames[0].payload.equals(payload), `payload mismatch at size ${size}`);
    }
  });

  test('unmasked server frames carry UTF-8 strings', () => {
    const frame = encodeFrame(OP.TEXT, '龍拳 🐓');
    assert.equal(frame[1] & 0x80, 0);
    const [parsed] = parseServerFrames(frame);
    assert.equal(parsed.masked, false);
    assert.equal(parsed.payload.toString('utf8'), '龍拳 🐓');
  });

  test('frame delivered one byte at a time', () => {
    for (const size of [5, 300, 70000]) {
      const payload = randomBytes(size);
      const frame = encodeFrame(OP.TEXT, payload, { mask: true });
      const { parser, frames, errors } = collect();
      for (let i = 0; i < frame.length; i++) parser.push(frame.subarray(i, i + 1));
      assert.deepEqual(errors, []);
      assert.equal(frames.length, 1, `size ${size}`);
      assert.ok(frames[0].payload.equals(payload));
    }
  });

  test('three frames concatenated in one chunk', () => {
    const big = 'x'.repeat(300);
    const chunk = Buffer.concat([
      encodeFrame(OP.TEXT, 'one', { mask: true }),
      encodeFrame(OP.PING, 'p', { mask: true }),
      encodeFrame(OP.TEXT, big, { mask: true }),
    ]);
    const { parser, frames, errors } = collect();
    parser.push(chunk);
    assert.deepEqual(errors, []);
    assert.deepEqual(frames.map((f) => [f.opcode, f.payload.toString()]), [
      [OP.TEXT, 'one'],
      [OP.PING, 'p'],
      [OP.TEXT, big],
    ]);
  });

  test('split at every header boundary (length bytes, mask key, payload)', () => {
    for (const size of [10, 300, 70000]) {
      const payload = randomBytes(size);
      const frame = encodeFrame(OP.TEXT, payload, { mask: true });
      const header = headerLength(size, true);
      for (let split = 1; split <= header + 1; split++) {
        const { parser, frames, errors } = collect();
        parser.push(frame.subarray(0, split));
        assert.equal(frames.length, 0);
        parser.push(frame.subarray(split));
        assert.deepEqual(errors, []);
        assert.equal(frames.length, 1, `size ${size} split ${split}`);
        assert.ok(frames[0].payload.equals(payload));
      }
    }
  });

  test('unmasked client frame -> 1002', () => {
    const { parser, frames, errors } = collect();
    parser.push(encodeFrame(OP.TEXT, 'hi'));
    assert.equal(frames.length, 0);
    assert.equal(errors[0].code, 1002);
  });

  test('RSV bit set -> 1002', () => {
    for (const bit of [0x40, 0x20, 0x10]) {
      const frame = encodeFrame(OP.TEXT, 'hi', { mask: true });
      frame[0] |= bit;
      const { parser, errors } = collect();
      parser.push(frame);
      assert.equal(errors[0]?.code, 1002);
    }
  });

  test('unknown opcode -> 1002', () => {
    const frame = encodeFrame(3, 'hi', { mask: true });
    const { parser, errors } = collect();
    parser.push(frame);
    assert.equal(errors[0]?.code, 1002);
  });

  test('payload over maxPayload -> 1009 (7-bit, 16-bit and 64-bit lengths)', () => {
    const cases = [
      [10, encodeFrame(OP.TEXT, 'x'.repeat(11), { mask: true })],
      [1000, encodeFrame(OP.TEXT, 'x'.repeat(1001), { mask: true })],
      [100000, encodeFrame(OP.TEXT, 'x'.repeat(100001), { mask: true })],
    ];
    // Header only, claiming a 2^62-byte payload: must be rejected before any body arrives.
    const huge = Buffer.alloc(10);
    huge[0] = 0x82;
    huge[1] = 0x80 | 127;
    huge.writeBigUInt64BE(1n << 62n, 2);
    cases.push([1 << 20, huge]);
    for (const [maxPayload, frame] of cases) {
      const { parser, frames, errors } = collect({ maxPayload });
      parser.push(frame);
      assert.equal(frames.length, 0);
      assert.equal(errors[0]?.code, 1009, `maxPayload ${maxPayload}`);
    }
  });

  test('control frame with fin=0 or payload > 125 -> 1002', () => {
    const fragmentedPing = encodeFrame(OP.PING, 'x', { fin: false, mask: true });
    const bigPing = encodeFrame(OP.PING, 'x'.repeat(126), { mask: true });
    for (const frame of [fragmentedPing, bigPing]) {
      const { parser, errors } = collect();
      parser.push(frame);
      assert.equal(errors[0]?.code, 1002);
    }
  });

  test('parser stops after a protocol error', () => {
    const { parser, frames, errors } = collect();
    parser.push(Buffer.concat([encodeFrame(OP.TEXT, 'bad'), encodeFrame(OP.TEXT, 'good', { mask: true })]));
    parser.push(encodeFrame(OP.TEXT, 'later', { mask: true }));
    assert.equal(frames.length, 0);
    assert.equal(errors.length, 1);
  });
});

// ---------------------------------------------------------------------------

describe('WsConnection (in-memory socket)', { timeout: 5000 }, () => {
  test('sets TCP_NODELAY + keep-alive, exposes id, isOpen and remoteAddress', () => {
    const a = new WsConnection(fakeSocket(), { heartbeatMs: 0, timeoutMs: 0 });
    const sock = fakeSocket();
    const b = new WsConnection(sock, { heartbeatMs: 0, timeoutMs: 0 });
    assert.deepEqual(sock.calls, { noDelay: true, keepAlive: true });
    assert.equal(b.id, a.id + 1);
    assert.equal(b.isOpen, true);
    assert.equal(b.remoteAddress, '10.0.0.7');
    a.close();
    b.close();
  });

  test('reassembles a fragmented text message (with an interleaved PING)', async () => {
    const sock = fakeSocket();
    const ws = new WsConnection(sock, { heartbeatMs: 0, timeoutMs: 0 });
    const text = 'Hello, 龍拳 🐓';
    const bytes = Buffer.from(text);
    const got = nextEvent(ws, 'message');
    // Split at byte 8, which is inside the 3-byte encoding of '龍'.
    sock.receive(encodeFrame(OP.TEXT, bytes.subarray(0, 8), { fin: false, mask: true }));
    sock.receive(encodeFrame(OP.PING, 'mid', { mask: true }));
    sock.receive(encodeFrame(OP.CONT, bytes.subarray(8, 12), { fin: false, mask: true }));
    sock.receive(encodeFrame(OP.CONT, bytes.subarray(12), { fin: true, mask: true }));
    const [message] = await got;
    assert.equal(typeof message, 'string');
    assert.equal(message, text);
    const pong = sock.frames().find((f) => f.opcode === OP.PONG);
    assert.equal(pong?.payload.toString(), 'mid');
    ws.close();
  });

  test('PING gets a PONG with the same payload', async () => {
    const sock = fakeSocket();
    const ws = new WsConnection(sock, { heartbeatMs: 0, timeoutMs: 0 });
    const payload = randomBytes(125);
    sock.receive(encodeFrame(OP.PING, payload, { mask: true }));
    await new Promise((r) => setImmediate(r));
    const [pong] = sock.frames();
    assert.equal(pong.opcode, OP.PONG);
    assert.ok(pong.payload.equals(payload));
    ws.close();
  });

  test('binary message -> close 1003, close emitted once', async () => {
    const sock = fakeSocket();
    const ws = new WsConnection(sock, { heartbeatMs: 0, timeoutMs: 0 });
    let closes = 0;
    ws.on('close', () => closes++);
    const closed = nextEvent(ws, 'close');
    sock.receive(encodeFrame(OP.BIN, Buffer.from([1, 2, 3]), { mask: true }));
    const [code] = await closed;
    assert.equal(code, 1003);
    assert.equal(ws.isOpen, false);
    const frame = sock.frames().find((f) => f.opcode === OP.CLOSE);
    assert.equal(frame.payload.readUInt16BE(0), 1003);
    ws.close();
    await new Promise((r) => setImmediate(r));
    assert.equal(closes, 1);
  });

  test('fragmented message over maxPayload -> close 1009', async () => {
    const sock = fakeSocket();
    const ws = new WsConnection(sock, { maxPayload: 10, heartbeatMs: 0, timeoutMs: 0 });
    const closed = nextEvent(ws, 'close');
    sock.receive(encodeFrame(OP.TEXT, 'abcdef', { fin: false, mask: true }));
    sock.receive(encodeFrame(OP.CONT, 'ghijkl', { fin: true, mask: true }));
    assert.equal((await closed)[0], 1009);
  });

  test('unmasked frame and invalid UTF-8 close the connection (1002 / 1007)', async () => {
    for (const [frame, expected] of [
      [encodeFrame(OP.TEXT, 'hi'), 1002],
      [encodeFrame(OP.TEXT, Buffer.from([0xc3, 0x28]), { mask: true }), 1007],
    ]) {
      const sock = fakeSocket();
      const ws = new WsConnection(sock, { heartbeatMs: 0, timeoutMs: 0 });
      const errors = [];
      ws.on('error', (err) => errors.push(err));
      const closed = nextEvent(ws, 'close');
      sock.receive(frame);
      assert.equal((await closed)[0], expected);
      assert.equal(errors[0].closeCode, expected);
    }
  });

  test('client CLOSE is echoed with the same code', async () => {
    const sock = fakeSocket();
    const ws = new WsConnection(sock, { heartbeatMs: 0, timeoutMs: 0 });
    const closed = nextEvent(ws, 'close');
    sock.receive(closeFrame(4002, 'gg'));
    assert.deepEqual(await closed, [4002, 'gg']);
    const echo = sock.frames().find((f) => f.opcode === OP.CLOSE);
    assert.equal(echo.payload.readUInt16BE(0), 4002);
  });

  test('close() sends CLOSE, stops sending, emits close(code, reason)', async () => {
    const sock = fakeSocket();
    const ws = new WsConnection(sock, { heartbeatMs: 0, timeoutMs: 0 });
    const closed = nextEvent(ws, 'close');
    ws.send('before');
    ws.close(4000, 'kicked');
    ws.send('after');
    assert.equal(ws.isOpen, false);
    assert.deepEqual(await closed, [4000, 'kicked']);
    const frames = sock.frames();
    assert.deepEqual(frames.map((f) => f.opcode), [OP.TEXT, OP.CLOSE]);
    assert.equal(frames[1].payload.subarray(2).toString(), 'kicked');
  });

  test('peer dropping TCP without a CLOSE frame -> close 1006', async () => {
    const sock = fakeSocket();
    const ws = new WsConnection(sock, { heartbeatMs: 0, timeoutMs: 0 });
    const closed = nextEvent(ws, 'close');
    sock.hangUp();
    assert.equal((await closed)[0], 1006);
  });

  test('heartbeat pings and terminates a silent peer', async () => {
    const keepAlive = setTimeout(() => {}, 2000); // heartbeat timers are unref'd
    const sock = fakeSocket();
    const started = Date.now();
    const ws = new WsConnection(sock, { heartbeatMs: 20, timeoutMs: 100 });
    const [code] = await nextEvent(ws, 'close');
    clearTimeout(keepAlive);
    assert.equal(code, 1006);
    assert.ok(Date.now() - started >= 90, 'terminated too early');
    assert.ok(sock.frames().filter((f) => f.opcode === OP.PING).length >= 2);
  });

  test('incoming frames keep the connection alive', async () => {
    const sock = fakeSocket();
    const ws = new WsConnection(sock, { heartbeatMs: 20, timeoutMs: 80 });
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 25));
      sock.receive(encodeFrame(OP.PONG, EMPTY_PAYLOAD, { mask: true }));
    }
    assert.equal(ws.isOpen, true);
    const closed = nextEvent(ws, 'close');
    ws.close();
    await closed;
  });
});


// ---------------------------------------------------------------------------

describe('server integration (startServer + global WebSocket)', { timeout: 10000 }, () => {
  let srv;
  before(async () => {
    srv = await startServer({ port: 0, quiet: true, lobbyFactory: echoLobby });
  });
  after(async () => {
    await srv.close();
  });

  test('echo, unicode and a 64-bit-length message round-trip; clean client close', async () => {
    const serverSide = tapConnections(srv.lobby);
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
    await wsEvent(ws, 'open');
    serverSide.restore();

    ws.send('hello dojo');
    assert.equal(await nextMessage(ws), 'hello dojo');
    ws.send('龍拳 🐓');
    assert.equal(await nextMessage(ws), '龍拳 🐓');
    const big = '拳'.repeat(30000); // 90000 bytes
    ws.send(big);
    assert.equal(await nextMessage(ws), big);

    const serverClosed = nextEvent(serverSide[0], 'close');
    const clientClosed = wsEvent(ws, 'close');
    ws.close(1000, 'sayonara');
    const event = await clientClosed;
    assert.equal(event.code, 1000);
    assert.equal(event.wasClean, true);
    assert.deepEqual(await serverClosed, [1000, 'sayonara']);
  });

  test('server-initiated close reaches the client with code and reason', async () => {
    const serverSide = tapConnections(srv.lobby);
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
    await wsEvent(ws, 'open');
    serverSide.restore();
    const clientClosed = wsEvent(ws, 'close');
    serverSide[0].close(4001, 'kicked');
    const event = await clientClosed;
    assert.equal(event.code, 4001);
    assert.equal(event.reason, 'kicked');
    assert.equal(event.wasClean, true);
  });

  test('raw client: RFC accept key, frames sent with the handshake, PING/PONG, CLOSE echo', async () => {
    const early = Buffer.concat([
      Buffer.from(upgradeRequest(srv.port)),
      encodeFrame(OP.PING, 'kiai!', { mask: true }),
      encodeFrame(OP.TEXT, 'in the head', { mask: true }),
    ]);
    const client = rawClient(srv.port, early);
    const head = await client.head;
    assert.match(head, /^HTTP\/1\.1 101 /);
    assert.match(head, new RegExp(`Sec-WebSocket-Accept: ${RFC_ACCEPT.replace(/[+/]/g, '\\$&')}`));

    const pong = await client.nextFrame();
    assert.equal(pong.opcode, OP.PONG);
    assert.equal(pong.payload.toString(), 'kiai!');
    const echo = await client.nextFrame();
    assert.equal(echo.opcode, OP.TEXT);
    assert.equal(echo.payload.toString(), 'in the head');

    client.sock.write(encodeFrame(OP.PING, Buffer.from([0, 1, 2, 255]), { mask: true }));
    const pong2 = await client.nextFrame();
    assert.ok(pong2.payload.equals(Buffer.from([0, 1, 2, 255])));

    client.sock.write(closeFrame(1000));
    const closeEcho = await client.nextFrame();
    assert.equal(closeEcho.opcode, OP.CLOSE);
    assert.equal(closeEcho.payload.readUInt16BE(0), 1000);
    await client.ended;
  });

  test('bad handshakes are rejected (404 wrong path, 400 bad headers)', async () => {
    const cases = [
      [{ path: '/nope' }, 404],
      [{ key: null }, 400],
      [{ key: 'short' }, 400],
      [{ version: '8' }, 400],
    ];
    for (const [opts, status] of cases) {
      const client = rawClient(srv.port, upgradeRequest(srv.port, opts));
      const head = await client.head;
      assert.match(head, new RegExp(`^HTTP/1\\.1 ${status} `), JSON.stringify(opts));
      await client.ended;
    }
  });

  test('close() shuts down promptly while a client is connected', async () => {
    const other = await startServer({ port: 0, quiet: true, lobbyFactory: echoLobby });
    const ws = new WebSocket(`ws://127.0.0.1:${other.port}/ws`);
    await wsEvent(ws, 'open');
    const clientClosed = wsEvent(ws, 'close');
    const started = Date.now();
    await other.close();
    const event = await clientClosed;
    assert.equal(event.code, 1001);
    assert.ok(Date.now() - started < 1400, `close took ${Date.now() - started}ms`);
  });
});

// ---------------------------------------------------------------------------

describe('static handler', { timeout: 10000 }, () => {
  let tmp;
  let server;
  let port;
  const INDEX = '<!doctype html><title>dojo</title>';
  const APP_JS = 'export const fist = "ultra";\n';

  before(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ultrafist-static-'));
    const root = path.join(tmp, 'public');
    fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
    fs.mkdirSync(path.join(root, 'empty'));
    fs.writeFileSync(path.join(root, 'index.html'), INDEX);
    fs.writeFileSync(path.join(root, 'app.js'), APP_JS);
    fs.writeFileSync(path.join(root, 'data.bin'), Buffer.from([1, 2, 3]));
    fs.writeFileSync(path.join(root, 'sub', 'index.html'), '<p>sub</p>');
    fs.writeFileSync(path.join(tmp, 'package.json'), '{"secret":"TOP SECRET"}');
    fs.writeFileSync(path.join(tmp, 'secret'), 'TOP SECRET');
    server = http.createServer(createStaticHandler(root));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function request(method, rawPath) {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, method, path: rawPath, agent: false }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  test('GET / serves index.html as text/html with no-store + nosniff', async () => {
    const res = await request('GET', '/');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.body, INDEX);
  });

  test('.js is served as text/javascript; query string is ignored', async () => {
    const res = await request('GET', '/app.js?v=42');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(res.body, APP_JS);
  });

  test('unknown extension falls back to application/octet-stream', async () => {
    const res = await request('GET', '/data.bin');
    assert.equal(res.headers['content-type'], 'application/octet-stream');
  });

  test('path traversal is refused', async () => {
    const attempts = [
      '/../package.json',
      '/%2e%2e/secret',
      '/%2E%2E/package.json',
      '/..%2fsecret',
      '/..%5csecret',
      '/..\\secret',
      '/sub/../../secret',
    ];
    for (const attempt of attempts) {
      const res = await request('GET', attempt);
      assert.ok([403, 404].includes(res.status), `${attempt} -> ${res.status}`);
      assert.ok(!res.body.includes('TOP SECRET'), `${attempt} leaked the file`);
    }
  });

  test('HEAD has headers but no body', async () => {
    const res = await request('HEAD', '/app.js');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(Number(res.headers['content-length']), Buffer.byteLength(APP_JS));
    assert.equal(res.body, '');
  });

  test('POST -> 405, bad encoding -> 400, missing -> 404', async () => {
    const post = await request('POST', '/');
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
    assert.equal((await request('GET', '/%E0%A4%A')).status, 400);
    assert.equal((await request('GET', '/missing.js')).status, 404);
  });

  test('directories serve their index.html or 404', async () => {
    const sub = await request('GET', '/sub/');
    assert.equal(sub.status, 200);
    assert.equal(sub.body, '<p>sub</p>');
    assert.equal((await request('GET', '/empty/')).status, 404);
    const redirect = await request('GET', '/sub');
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.location, '/sub/');
  });
});

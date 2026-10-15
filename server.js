// UltraFist server: static files from public/ plus the LAN WebSocket endpoint at /ws.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStaticHandler } from './server/static.js';
import { handleUpgrade } from './server/ws.js';
import { createLobby } from './server/rooms.js';
import { NET } from './public/js/shared/protocol.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const VIRTUAL_ADAPTER = /vEthernet|WSL|VirtualBox|VMware|Hyper-V|Loopback|Bluetooth/i;
const PHYSICAL_ADAPTER = /wi-?fi|wlan|wireless|ethernet|^end|^ethd/i;
const FORCE_CLOSE_MS = 1500;

export async function startServer({ port = Number(process.env.PORT) || 3000, host = '0.0.0.0', quiet = false, lobbyFactory = createLobby } = {}) {
  const lobby = lobbyFactory();
  const server = http.createServer(createStaticHandler(PUBLIC_DIR));
  const sockets = trackSockets(server);
  const connections = new Set();

  server.on('upgrade', (req, socket, head) => {
    handleUpgrade(req, socket, head, (ws, upgradeReq) => {
      connections.add(ws);
      ws.once('close', () => connections.delete(ws));
      openInLobby(lobby, ws, upgradeReq);
    }, { path: '/ws', heartbeatMs: NET.HEARTBEAT_MS, timeoutMs: NET.TIMEOUT_MS });
  });

  try {
    await listen(server, port, host);
  } catch (err) {
    lobby.close();
    throw err;
  }

  const actualPort = server.address().port;
  if (!quiet) printBanner(actualPort, host);
  let closing = null;
  const close = () => (closing ??= shutdown({ server, lobby, connections, sockets }));
  return { server, port: actualPort, lobby, close };
}

// A lobby bug must not take the whole server (and every other match) down.
function openInLobby(lobby, ws, req) {
  try {
    lobby.onConnection(ws, req);
  } catch (err) {
    console.error('lobby.onConnection failed:', err);
    ws.close(1011, 'internal error');
  }
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function trackSockets(server) {
  const sockets = new Set();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  return sockets;
}

async function shutdown({ server, lobby, connections, sockets }) {
  lobby.close();
  for (const ws of connections) ws.close(1001, 'server shutting down');
  const closed = new Promise((resolve) => server.close(() => resolve()));
  server.closeIdleConnections();
  // WsConnection destroys its own socket after a grace period; this catches anything else.
  const force = setTimeout(() => {
    for (const socket of sockets) socket.destroy();
  }, FORCE_CLOSE_MS);
  await closed;
  clearTimeout(force);
}

function lanAddresses() {
  const found = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL_ADAPTER.test(name)) continue;
    for (const addr of addrs ?? []) {
      const isIPv4 = addr.family === 'IPv4' || addr.family === 4;
      if (isIPv4 && !addr.internal && !addr.address.startsWith('169.254.')) {
        found.push({ name, address: addr.address });
      }
    }
  }
  // Real Wi-Fi/Ethernet adapters first, so the top line is the one friends most likely need.
  return found.sort((a, b) => PHYSICAL_ADAPTER.test(b.name) - PHYSICAL_ADAPTER.test(a.name));
}

function printBanner(port, host) {
  const lines = ['', ' UltraFist dojo is open!', `   This machine:  http://localhost:${port}`];
  const wildcard = host === '0.0.0.0' || host === '::' || host === '';
  const lan = wildcard ? lanAddresses() : [{ name: 'bound address', address: host }];
  if (lan.length === 0) {
    lines.push('   LAN players:   no LAN address found - connect this PC to Wi-Fi or Ethernet to play over LAN.');
  }
  lan.forEach(({ name, address }, i) => {
    const label = i === 0 ? 'LAN players:  ' : ' '.repeat(14);
    lines.push(`   ${label} http://${address}:${port}   (${name})`);
  });
  lines.push(
    '',
    '   Friends can\'t connect? In Windows Firewall, allow Node.js on Private networks.',
    '   Press Ctrl+C to stop.',
    '',
  );
  console.log(lines.join('\n'));
}

function printStartError(err) {
  if (err.code !== 'EADDRINUSE') {
    console.error(err);
    return;
  }
  const port = err.port ?? 3000;
  console.error([
    '',
    ` Port ${port} is already in use - is another UltraFist server (or another app) running?`,
    ' Pick a different port:',
    '   PORT=3001 npm start          (bash / Git Bash)',
    '   $env:PORT=3001; npm start    (PowerShell)',
    '',
  ].join('\n'));
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  const url = pathToFileURL(entry).href;
  return url === import.meta.url || `${url}.js` === import.meta.url;
}

if (isMainModule()) {
  startServer().then(({ close }) => {
    const stop = () => {
      console.log('\n Closing the dojo...');
      setTimeout(() => process.exit(0), 3000).unref();
      close().then(() => process.exit(0));
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }, (err) => {
    printStartError(err);
    process.exit(1);
  });
}

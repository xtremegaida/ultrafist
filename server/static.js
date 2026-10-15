// Static file handler: GET/HEAD only, traversal-safe, never cached.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
};

export function createStaticHandler(rootDir) {
  const root = path.resolve(rootDir);
  return (req, res) => {
    // no-store: we iterate on ES modules and must never serve a stale one.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return sendStatus(res, 405);
    }
    const urlPath = decodePath(req.url);
    if (urlPath === null) return sendStatus(res, 400);
    const filePath = resolveInside(root, urlPath);
    if (filePath === null) return sendStatus(res, 403);
    serve(req, res, filePath, urlPath);
  };
}

// Returns the decoded URL path (query/hash stripped), or null if malformed.
function decodePath(url = '/') {
  const raw = url.split(/[?#]/, 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return decoded.startsWith('/') && !decoded.includes('\0') ? decoded : null;
}

// path.join normalizes '..' (and '\' on Windows); anything that lands outside root is refused.
function resolveInside(root, urlPath) {
  const target = path.join(root, urlPath);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return target === root || target.startsWith(prefix) ? target : null;
}

function serve(req, res, filePath, urlPath) {
  fs.stat(filePath, (err, stat) => {
    if (err) return sendStatus(res, 404);
    if (stat.isFile()) return sendFile(req, res, filePath, stat.size);
    if (!stat.isDirectory()) return sendStatus(res, 404);
    // Relative imports inside a directory page only resolve correctly with a trailing slash.
    if (!urlPath.endsWith('/')) return redirect(res, toDirUrl(urlPath));
    serveIndex(req, res, path.join(filePath, 'index.html'));
  });
}

function serveIndex(req, res, indexPath) {
  fs.stat(indexPath, (err, stat) => {
    if (err || !stat.isFile()) return sendStatus(res, 404);
    sendFile(req, res, indexPath, stat.size);
  });
}

function sendFile(req, res, filePath, size) {
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Content-Length', size);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (res.headersSent) res.destroy();
    else sendStatus(res, 500);
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

function toDirUrl(urlPath) {
  const segments = urlPath.split('/').filter(Boolean).map(encodeURIComponent);
  return `/${segments.join('/')}/`;
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Content-Length', 0);
  res.end();
}

function sendStatus(res, status) {
  const body = `${status} ${http.STATUS_CODES[status]}\n`;
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

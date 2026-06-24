'use strict';

/*
 * muscledb-web — anatomy reference API + static front-end.
 *
 * Pure Node.js (built-in `http`), no required npm dependencies. Uses
 * better-sqlite3 if installed, otherwise Node's built-in SQLite (see db.js).
 *
 * Env:
 *   PORT           (default 5000)
 *   HOST           (default 0.0.0.0)
 *   MUSCLEDB_PATH  (default ./db/muscles.db)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const q = require('./queries');
const { driverName } = require('./db');

const PORT = parseInt(process.env.PORT, 10) || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const VERSION = require('./package.json').version;

// Build metadata, written by scripts/gen-version.js (CI). Optional in dev.
function loadBuildInfo() {
  try {
    return JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'version.json'), 'utf8'));
  } catch {
    return { build: 'dev', commit: 'dev', date: null };
  }
}
const BUILD = loadBuildInfo();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function notFound(res) {
  sendJson(res, 404, { error: 'Not found' });
}

// Serve a static file from PUBLIC_DIR, guarding against path traversal.
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// Match /api/<name>/<id> and return the integer id, or null.
function idFrom(parts, expectedName) {
  if (parts.length === 3 && parts[0] === 'api' && parts[1] === expectedName) {
    const id = parseInt(parts[2], 10);
    return Number.isInteger(id) ? id : null;
  }
  return undefined; // route does not match at all
}

const server = http.createServer((req, res) => {
  let parsed;
  try {
    parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return notFound(res);
  }
  const pathname = parsed.pathname;

  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' });
    return res.end('Method Not Allowed');
  }

  // Non-API requests -> static files.
  if (!pathname.startsWith('/api/')) {
    return serveStatic(req, res, pathname);
  }

  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/'); // e.g. ['api','muscles','12']

  try {
    // GET /api/ping
    if (pathname === '/api/ping') {
      return sendJson(res, 200, {
        name: 'muscledb-web',
        version: VERSION,
        build: BUILD.build,
        commit: BUILD.commit,
        date: BUILD.date,
        sqlite: driverName(),
      });
    }

    // GET /api/muscles  and  GET /api/muscles/:id
    if (parts[0] === 'api' && parts[1] === 'muscles') {
      if (parts.length === 2) {
        const term = parsed.searchParams.get('searchterm')
          || parsed.searchParams.get('searchTerm') || '';
        return sendJson(res, 200, q.searchMuscles(term.trim()));
      }
      const id = idFrom(parts, 'muscles');
      if (id === null) return notFound(res);
      const muscle = q.muscleById(id);
      return muscle ? sendJson(res, 200, muscle) : notFound(res);
    }

    // GET /api/musclegroups/:id
    {
      const id = idFrom(parts, 'musclegroups');
      if (id !== undefined) {
        if (id === null) return notFound(res);
        const group = q.muscleGroupHierarchy(id);
        return group ? sendJson(res, 200, group) : notFound(res);
      }
    }

    // GET /api/arterymuscles/:id
    {
      const id = idFrom(parts, 'arterymuscles');
      if (id !== undefined) {
        if (id === null) return notFound(res);
        const a = q.arteryById(id);
        return a ? sendJson(res, 200, a) : notFound(res);
      }
    }

    // GET /api/veinmuscles/:id
    {
      const id = idFrom(parts, 'veinmuscles');
      if (id !== undefined) {
        if (id === null) return notFound(res);
        const v = q.veinById(id);
        return v ? sendJson(res, 200, v) : notFound(res);
      }
    }

    // GET /api/nervemuscles/:id
    {
      const id = idFrom(parts, 'nervemuscles');
      if (id !== undefined) {
        if (id === null) return notFound(res);
        const n = q.nerveById(id);
        return n ? sendJson(res, 200, n) : notFound(res);
      }
    }

    return notFound(res);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('API error:', err);
    return sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`muscledb-web v${VERSION} listening on http://${HOST}:${PORT}  (sqlite driver: ${driverName()})`);
});

module.exports = server;

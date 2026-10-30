import { createServer } from 'node:http';
import { readFileSync, realpathSync } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { publishedFiles } from './publish.mjs';

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8'
};

function validHost(host, port) {
  if (typeof host !== 'string') return false;
  const match = host.match(/^(localhost|127\.0\.0\.1)(?::([0-9]{1,5}))?$/i);
  return Boolean(match && Number(match[2] || 80) === port);
}

// The server previews the same public files that deployment packages. It does
// not expose the source checkout, even though it runs on the loopback address.
export function createPreviewServer(directory, { port = 4173 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('无效的预览端口');
  const root = realpathSync(directory);
  const config = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
  const basePath = new URL(config.baseUrl).pathname;
  const prefix = decodeURIComponent(basePath).replace(/\/$/, '');

  async function publicFile(file, allowed) {
    if (!allowed.has(file)) throw new Error('Not public');
    const candidate = resolve(root, file);
    const actual = await realpath(candidate);
    // Reject symlinked public paths as well as links outside the checkout.
    // This also prevents a public asset alias from exposing an internal source.
    if (!actual.startsWith(root + sep) || actual !== candidate || !(await stat(actual)).isFile()) throw new Error('Not public');
    return readFile(actual);
  }

  function respond(req, res, status, content, type = 'text/plain; charset=utf-8') {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    res.statusCode = status;
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', bytes.byteLength);
    res.end(req.method === 'HEAD' ? undefined : bytes);
  }

  async function notFound(req, res) {
    try {
      const content = await publicFile('404.html', new Set(['404.html']));
      respond(req, res, 404, content, types['.html']);
    } catch { respond(req, res, 404, 'Not found'); }
  }

  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!validHost(req.headers.host, req.socket.localPort || port)) {
      respond(req, res, 403, 'Forbidden');
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      respond(req, res, 405, 'Method not allowed');
      return;
    }
    try {
      const target = req.url || '';
      // Accept origin-form requests only; this is never a forward proxy.
      if (!target.startsWith('/') || target.startsWith('//') || target.includes('#')) throw new Error('Invalid path');
      const queryAt = target.indexOf('?');
      const query = queryAt < 0 ? '' : target.slice(queryAt);
      let pathname = decodeURIComponent(queryAt < 0 ? target : target.slice(0, queryAt));
      if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) throw new Error('Invalid path');
      if (prefix && pathname === prefix) {
        res.setHeader('Location', basePath + query);
        respond(req, res, 302, '');
        return;
      }
      if (prefix && pathname.startsWith(prefix + '/')) pathname = pathname.slice(prefix.length);
      let file = pathname.slice(1);
      if (!file || file.endsWith('/')) file += 'index.html';
      // Refresh on each request so a newly built issue needs no server restart.
      const allowed = new Set(publishedFiles(root));
      if (!allowed.has(file) && allowed.has(file + '/index.html')) {
        res.setHeader('Location', (prefix && decodeURIComponent(target.split('?')[0]).startsWith(prefix + '/') ? basePath : '/') + file + '/' + query);
        respond(req, res, 302, '');
        return;
      }
      const content = await publicFile(file, allowed);
      respond(req, res, 200, content, types[extname(file)] || 'text/plain; charset=utf-8');
    } catch { await notFound(req, res); }
  });
}

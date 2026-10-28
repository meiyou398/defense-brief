import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const config = JSON.parse(await readFile(join(root, 'site.config.json'), 'utf8'));
const prefix = new URL(config.baseUrl).pathname.replace(/\/$/, '');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (prefix && pathname === prefix) { res.writeHead(302, { Location: prefix + '/' }); res.end(); return; }
    if (prefix && pathname.startsWith(prefix + '/')) pathname = pathname.slice(prefix.length);
    let path = resolve(root, '.' + pathname);
    if (path !== root && !path.startsWith(root + sep)) throw new Error('Invalid path');
    try { if ((await stat(path)).isDirectory()) path = join(path, 'index.html'); }
    catch { path = join(root, '404.html'); res.statusCode = 404; }
    const content = await readFile(path);
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`预览：http://127.0.0.1:${port}${prefix}/`));

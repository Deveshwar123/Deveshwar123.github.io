// Local preview server with correct MIME types (ES modules need a JavaScript
// type) and no caching. Development only; production is any static host.
// Usage: node scripts/serve.mjs [port] [--base /subpath/] [--prod]
// --prod mimics GitHub Pages for lab measurements: gzip and a 10-minute cache.
import { createServer } from 'node:http';
import { createReadStream, statSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.argv.find((a) => /^\d+$/.test(a)) || 8080);
const baseArg = process.argv.indexOf('--base');
const base = baseArg > -1 ? process.argv[baseArg + 1].replace(/\/?$/, '/') : '/';
const prod = process.argv.includes('--prod');
const gzCache = new Map();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith(base)) { res.writeHead(404).end('Not found'); return; }
  path = path.slice(base.length - 1);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || /\/(node_modules|\.git|qa)\//.test(file)) { res.writeHead(403).end(); return; }
  let st;
  try { st = statSync(file); } catch { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
  if (st.isDirectory()) { res.writeHead(301, { location: req.url.replace(/\/?$/, '/') }).end(); return; }
  const type = TYPES[extname(file)] || 'application/octet-stream';
  if (prod && /text|javascript|json|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
    if (!gzCache.has(file)) gzCache.set(file, gzipSync(readFileSync(file), { level: 9 }));
    const body = gzCache.get(file);
    res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'content-length': body.length, 'cache-control': 'max-age=600', vary: 'Accept-Encoding' });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }
  res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'cache-control': prod ? 'max-age=600' : 'no-store' });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}${base}`));

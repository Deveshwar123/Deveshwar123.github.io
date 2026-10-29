// Local preview server with correct MIME types (ES modules need a JavaScript
// type) and no caching. Development only; production is any static host.
// Usage: node scripts/serve.mjs [port] [--base /subpath/]
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.argv.find((a) => /^\d+$/.test(a)) || 8080);
const baseArg = process.argv.indexOf('--base');
const base = baseArg > -1 ? process.argv[baseArg + 1].replace(/\/?$/, '/') : '/';

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
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}${base}`));

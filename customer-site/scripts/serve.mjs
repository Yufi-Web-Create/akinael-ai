import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
createServer(async (req, res) => {
  const path = normalize(join(root, req.url === '/' ? 'index.html' : req.url));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  try { const body = await readFile(path); res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404).end('Not found'); }
}).listen(process.env.PORT || 4173, () => console.log('http://localhost:' + (process.env.PORT || 4173)));

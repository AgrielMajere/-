import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = '/home/claude/mmo/labpub', OUT = process.argv[2], ANIM = process.argv[3] || 'Walk', only = process.argv.slice(4);
fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if(p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if(e){ r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const logs = []; p.on('pageerror', e => logs.push('ERR ' + e.message)); p.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 200)); });
await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForSelector('.lb-card'); await p.waitForTimeout(4000);
await p.click(`[data-a="${ANIM}"]`);
const ids = only.length ? only : await p.$$eval('.lb-card', cs => cs.map(c => c.dataset.id));
for(const id of ids){
  logs.push('== ' + id);
  await p.evaluate(i => { const e = document.querySelector(`.lb-card[data-id="${i}"] b`); e.scrollIntoView(); e.click(); }, id); await p.waitForTimeout(6000);
  await p.screenshot({ path: path.join(OUT, id + '.png'), clip: { x: 0, y: 0, width: 560, height: 560 } });
}
fs.writeFileSync(path.join(OUT, 'log.txt'), logs.join('\n')); await b.close(); srv.close();

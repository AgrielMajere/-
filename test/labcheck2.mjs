import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = '/home/claude/mmo/labpub', OUT = process.argv[2], ids = process.argv.slice(3);
fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if(p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if(e){ r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const logs = []; p.on('pageerror', e => logs.push('ERR ' + e.message));
await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForSelector('.lb-card'); await p.waitForTimeout(3000);
const shot = async (id, k) => p.screenshot({ path: path.join(OUT, id + '_' + k + '.png'), clip: { x: 0, y: 0, width: 560, height: 560 } });
for(const id of ids){
  logs.push('== ' + id);
  try{
    await p.evaluate(() => document.querySelector('[data-a="Walk"]').click());
    await p.evaluate(i => { const e = document.querySelector(`.lb-card[data-id="${i}"] b`); e.click(); }, id); await p.waitForTimeout(5500);
    await shot(id, 'w1'); await p.waitForTimeout(450); await shot(id, 'w2');
    await p.evaluate(() => document.querySelector('[data-a="Run"]').click()); await p.waitForTimeout(1500); await shot(id, 'r');
    await p.evaluate(() => document.querySelector('[data-a="Attack1H"]').click()); await p.waitForTimeout(700); await shot(id, 'a');
  }catch(e){ logs.push('FAIL ' + id + ' ' + e.message.slice(0, 100)); }
  fs.writeFileSync(path.join(OUT, 'log.txt'), logs.join('\n'));
}
await b.close(); srv.close();

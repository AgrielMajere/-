import { chromium } from 'playwright-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const root = '/tmp/claude-0/labtest', OUT = process.argv[2];
const types = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if(p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if(e){ r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1100, height: 680 } });
const logs = []; p.on('pageerror', e => logs.push('ERR ' + e.message)); p.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text()); });
await p.goto(`http://localhost:${srv.address().port}/`, { waitUntil: 'commit' });
await p.waitForTimeout(25000); await p.screenshot({ path: OUT + '/lab1.png' });
// compare three
const cards = await p.$$('.lb-card'); 
for(const id of ['elf-m', 'dwarf']) await p.click(`.lb-card[data-id="${id}"] [data-c]`);
await p.waitForTimeout(20000); await p.screenshot({ path: OUT + '/lab2.png' });
for(const id of ['h-war', 'elf-m', 'dwarf']) { const on = await p.$(`.lb-card.on[data-id="${id}"]`); }
await p.click('.lb-card[data-id="orc"]'); await p.click('.lb-card[data-id="cat"] [data-c]'); await p.click('.lb-card[data-id="h-heavy"] [data-c]');
await p.waitForTimeout(20000); await p.screenshot({ path: OUT + '/lab3.png' });
await p.click('[data-t="editor"]'); await p.waitForTimeout(12000); await p.screenshot({ path: OUT + '/lab4.png' });
await p.setViewportSize({ width: 400, height: 800 }); await p.waitForTimeout(3000); await p.screenshot({ path: OUT + '/lab5.png' });
console.log(logs.slice(0, 15).join('\n')); await b.close(); srv.close();

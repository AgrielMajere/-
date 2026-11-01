import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright'); import http from 'http'; import fs from 'fs'; import path from 'path';
const [dir, outDir, ...files] = process.argv.slice(2); fs.mkdirSync(outDir, { recursive: true });
const here = path.dirname(new URL(import.meta.url).pathname);
const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]);
  if(u === '/') { s.end('<body style="margin:0"><script src="/b.js"></script>'); return; }
  if(u === '/b.js') { s.end(fs.readFileSync(here + '/thumb.bundle.js')); return; }
  fs.readFile(path.join(dir, u), (e, d) => { if(e){ s.writeHead(404); s.end(); } else s.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1080, height: 480 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForFunction('window.ready');
const list = files.length ? files : fs.readdirSync(dir).filter(f => f.endsWith('.glb'));
const info = {};
for(const f of list){ try{ info[f] = await p.evaluate(u => window.shoot(u), '/' + f); await p.locator('canvas').screenshot({ path: path.join(outDir, f.replace('.glb', '.png')) }); }catch(e){ info[f] = 'ERR ' + e.message.slice(0, 200); } }
fs.writeFileSync(path.join(outDir, 'info.json'), JSON.stringify(info, null, 1)); await b.close(); srv.close();

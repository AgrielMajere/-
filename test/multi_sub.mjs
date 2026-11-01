// node test/multi.mjs quality w h shots.json
import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const [q, w, h, shotsFile] = process.argv.slice(2);
const shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
const root = process.env.ROOT || '/home/claude/mmo/public';
const types = {'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.json':'application/json','.wasm':'application/wasm','.jpg':'image/jpeg','.png':'image/png'};
const srv = http.createServer((qq,r)=>{ let p = path.join(root, decodeURIComponent(qq.url.split('?')[0])); if(p.endsWith('/')) p += 'index.html'; fs.readFile(p,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'}); r.end(d); }); }).listen(0);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport:{ width:+w, height:+h }, deviceScaleFactor: 1 });
const logs=[]; p.on('console', m=>{ logs.push(m.type()+': '+m.text()+(m.type()==='error'?' @'+JSON.stringify(m.location()):'')); }); p.on('pageerror', e=>logs.push('PAGEERROR: '+e.message)); p.on('response', r=>{ if(r.status()>=400) logs.push('HTTP '+r.status()+' '+r.url()); });
await p.addInitScript(q => { try{ localStorage.setItem('ritm-game-quality', q); }catch(e){} }, q);
await p.goto(`http://localhost:${srv.address().port}/-/`, { waitUntil: 'commit', timeout: 60000 });
await p.waitForFunction(() => window.__gm && window.__gm.isReady && window.__gm.isReady(), null, { timeout: 300000, polling: 1000 }).catch(e => logs.push('NOT READY'));
await p.evaluate(() => { const g = window.__gm; g.pause(true); g.cam.introT = 1; });
for (const s of shots) {
  if (s.js) { const r = await p.evaluate(s.js); if (r !== undefined) console.log('EVAL', s.out, JSON.stringify(r)); }
  await p.evaluate(n => window.__gm.step(n), s.steps || 2);
  await p.screenshot({ path: s.out, timeout: 180000 });
  console.log('shot', s.out);
}
console.log(logs.filter(l=>l.startsWith('HTTP')).join('\n')); console.log(logs.slice(-20).join('\n'));
await b.close(); srv.close();

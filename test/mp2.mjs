// two players in one browser context sharing the mock room
import { chromium } from 'playwright-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const root = '/home/claude/mmo/public', OUT = process.argv[2];
const types = {'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if(e){ r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });

await ctx.addInitScript(() => { try{ localStorage.setItem('ritm-game-quality', 'low'); }catch(e){} });
const url = `http://localhost:${srv.address().port}/index_p2p.html`;
const logs = [];
const A = await ctx.newPage(); A.on('pageerror', e => logs.push('A ' + e.message)); A.on('console', m => { if(m.type() === 'error') logs.push('A ' + m.text()); });
await A.goto(url, { waitUntil: 'commit', timeout: 120000 }); await A.waitForFunction(() => window.__gm && __gm.isReady(), null, { timeout: 300000, polling: 1000 });
const B = await ctx.newPage(); B.on('pageerror', e => logs.push('B ' + e.message)); B.on('console', m => { if(m.type() === 'error') logs.push('B ' + m.text()); });
await B.goto(url, { waitUntil: 'commit', timeout: 120000 }); await B.waitForFunction(() => window.__gm && __gm.isReady(), null, { timeout: 300000, polling: 1000 });
const setup = async (pg, name, cls, x, z) => pg.evaluate(async ([name, cls, x, z]) => { const g = __gm; g.pause(true); g.cam.introT = 1; const P = g.P; P.reg = true; P.cls = cls; P.lvl = 12; const S = JSON.parse(localStorage.getItem('misto-online-v1') || '{}'); window.__name = name; g.combat().recalc(); g.combat().fullHeal(); await g.spawnHero(); g.teleport(x, z); g.cam.yaw = g.cam.tYaw = 0; g.cam.dist = g.cam.tDist = 12; g.cam.pitch = g.cam.tPitch = .4; }, [name, cls, x, z]);
await setup(A, 'Ярослав', 'warrior', 0, 104);
await setup(B, 'Олена', 'mage', 3, 106);
// run both for a while (real time so presence flows)
for(let k = 0; k < 40; k++){ await A.evaluate(() => __gm.sim(3)); await B.evaluate(() => __gm.sim(3)); await new Promise(r => setTimeout(r, 120)); }
const st = async pg => pg.evaluate(() => { const g = __gm, c = g.combat(); const mons = c.monsters.filter(m => m.net).length; return { host: c.isHost(), others: g.root.querySelector('[data-gm=players] span').textContent, netMons: mons, pos: [g.agent.x.toFixed(1), g.agent.z.toFixed(1)] }; });
console.log('A', JSON.stringify(await st(A))); console.log('B', JSON.stringify(await st(B)));
// B attacks a slime: target nearest and let it fight
await B.evaluate(() => { const c = __gm.combat(); const m = c.nearestMonster(40); if(m) c.setTarget(m); window.__tgt = m && m.i; });
for(let k = 0; k < 60; k++){ await A.evaluate(() => __gm.sim(3)); await B.evaluate(() => __gm.sim(3)); await new Promise(r => setTimeout(r, 100)); }
console.log('after fight A', await A.evaluate(() => { const m = __gm.combat().monsters[window.__tgt != null ? 0 : 0]; return null; }));
console.log('B target', await B.evaluate(() => { const c = __gm.combat(); const m = c.monsters[window.__tgt]; return m ? { hp: Math.round(m.hp), dead: m.dead, max: m.maxHp, xp: __gm.P.xp, gold: __gm.P.gold } : null; }));
console.log('A view of target', await A.evaluate(i => { const m = __gm.combat().monsters[i]; return m ? { hp: Math.round(m.hp), dead: m.dead } : null; }, await B.evaluate(() => window.__tgt)));
await A.evaluate(() => __gm.step(2)); await A.screenshot({ path: OUT + '/mpA.png' });
await B.evaluate(() => __gm.step(2)); await B.screenshot({ path: OUT + '/mpB.png' });
const advPos = pg => pg.evaluate(() => __gm.npcs.filter(n => n.def.adv).map(n => [n.def.id, Math.round(n.a.x), Math.round(n.a.z)]));
console.log('ADV A', JSON.stringify(await advPos(A))); console.log('ADV B', JSON.stringify(await advPos(B)));
console.log(logs.slice(-15).join('\n'));
await b.close(); srv.close();

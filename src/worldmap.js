// =====================================================================================
//  Navigation: world map (pan/zoom, fog, icons, travel), discovery of lands, waystones,
//  quest tracker with distance + direction, quest beacon in the world, minimap arrows.
// =====================================================================================
import * as THREE from 'three';
import * as RPG from './rpg.js';
import { ZONES, LANDS, PASSES, ROADS, LAKE, SWAMP, CITY2, TOWN_R, WALL_R, heightAt, landDist, zoneAt } from './world.js';
import { ENTRY, isDun } from './dungeon.js';

export const NAV_CSS = `
.nv-track{position:absolute;left:10px;top:calc(env(safe-area-inset-top,0px) + 214px);z-index:3;display:flex;flex-direction:column;gap:5px;max-width:min(240px,46vw);pointer-events:auto}
.nv-q{background:rgba(12,10,8,.62);border:1px solid rgba(255,230,180,.16);border-radius:10px;padding:5px 8px;font-size:11.5px;line-height:1.3;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.nv-q b{display:block;font:600 12px Georgia,serif;color:#ffe2a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nv-q.on{border-color:#ffcf5a;box-shadow:0 0 0 1px rgba(255,207,90,.35)}
.nv-q .nv-row{display:flex;justify-content:space-between;gap:6px;opacity:.9}
.nv-q .nv-dir{display:inline-block;transform-origin:50% 50%;font-size:12px}
.nv-q.done b{color:#9aff9a}
.nv-map{position:absolute;inset:0;z-index:20;background:#0d0f0c;display:none;touch-action:none}
.nv-map.on{display:block}
.nv-map canvas{position:absolute;inset:0;width:100%;height:100%}
.nv-mtop{position:absolute;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top,0px) + 10px) max(12px,env(safe-area-inset-right,0px)) 8px max(12px,env(safe-area-inset-left,0px));display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,rgba(0,0,0,.75),transparent);pointer-events:none}
.nv-mtop h3{margin:0;flex:1;font:400 19px Georgia,serif;letter-spacing:.08em;color:#f1e3c8}
.nv-mtop button,.nv-mbot button{pointer-events:auto;background:rgba(30,26,22,.9);color:#f1e3c8;border:1px solid rgba(255,230,180,.3);border-radius:10px;padding:7px 11px;font-size:13px;cursor:pointer}
.nv-mbot{position:absolute;left:0;right:0;bottom:0;padding:8px max(12px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 10px) max(12px,env(safe-area-inset-left,0px));display:flex;flex-wrap:wrap;gap:6px 12px;font-size:11.5px;color:#d8ccb4;background:linear-gradient(0deg,rgba(0,0,0,.8),transparent);pointer-events:none}
.nv-mbot span{white-space:nowrap}
.nv-pop{position:absolute;z-index:21;transform:translate(-50%,calc(-100% - 12px));background:rgba(20,16,12,.95);border:1px solid rgba(255,230,180,.35);border-radius:12px;padding:9px 11px;min-width:170px;max-width:240px;font-size:12px;color:#efe2c8;display:none}
.nv-pop.on{display:block}
.nv-pop b{display:block;font:600 14px Georgia,serif;color:#ffe2a8;margin-bottom:3px}
.nv-pop .nv-pb{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.nv-pop button{background:#d9a24a;color:#1a1208;border:0;border-radius:8px;padding:6px 10px;font-weight:700;font-size:12px;cursor:pointer}
.nv-pop button.g{background:rgba(255,255,255,.12);color:#efe2c8}
.nv-fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:30;transition:opacity .35s}
.nv-fade.on{opacity:1}
`;

const EXT = 600; // map half extent (m)

export function createNav(o){
  const { root, P, town, agent } = o;
  P.disc = P.disc || { town: 1 }; P.ways = P.ways || {}; P.fog = P.fog || [];
  const fogSet = new Set(P.fog);
  const ways = town.waystones || [];
  let tracked = P.track || null;

  // ---------- DOM ----------
  const track = document.createElement('div'); track.className = 'nv-track'; root.appendChild(track);
  const map = document.createElement('div'); map.className = 'nv-map';
  map.innerHTML = '<canvas></canvas><div class="nv-mtop"><h3>Карта світу</h3><button data-n="me">◎ Я</button><button data-n="close">✕</button></div><div class="nv-mbot"></div><div class="nv-pop"></div>';
  root.appendChild(map);
  const fade = document.createElement('div'); fade.className = 'nv-fade'; root.appendChild(fade);
  const cv = map.querySelector('canvas'), cx = cv.getContext('2d'), pop = map.querySelector('.nv-pop');
  map.querySelector('.nv-mbot').innerHTML = ['🏰 місто', '🏘 поселення', '💠 камінь шляху', '🕳 підземелля', '☠ Катастрофа', '❗ мета квесту', '🔵 друзі', '💛 загони авантюристів'].map(t => '<span>' + t + '</span>').join('');

  // ---------- terrain picture for the map (built once, lazily) ----------
  let terrainImg = null, fogImg = null, fogN = -1;
  function buildTerrain(){
    const N = 420, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const im = g.createImageData(N, N), d = im.data;
    const step = EXT*2/N;
    for(let j = 0; j < N; j++) for(let i = 0; i < N; i++){
      const x = -EXT + (i + .5)*step, z = -EXT + (j + .5)*step;
      const h = heightAt(x, z), hx = heightAt(x + step, z) - heightAt(x - step, z), hz = heightAt(x, z + step) - heightAt(x, z - step);
      const shade = Math.max(.55, Math.min(1.35, 1 + (-hx - hz)*.35/step));
      const ld = landDist(x, z);
      let r, gg, b;
      const lk = Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r && h < LAKE.level, sw = Math.hypot(x - SWAMP.x, z - SWAMP.z) < SWAMP.r && h < SWAMP.level + .1;
      if(lk){ r = 40; gg = 80; b = 105; }
      else if(sw){ r = 62; gg = 74; b = 54; }
      else if(ld < -2){ const k = Math.min(1, (-ld)/60); r = 92 + k*40; gg = 86 + k*36; b = 74 + k*34; if(h > 34){ r = gg = b = 210; } }
      else { const k = Math.min(1, Math.max(0, h/10)); r = 74 + k*18; gg = 98 + k*10; b = 56; }
      const p = (j*N + i)*4; d[p] = r*shade; d[p + 1] = gg*shade; d[p + 2] = b*shade; d[p + 3] = 255;
    }
    g.putImageData(im, 0, 0); terrainImg = c;
  }

  // ---------- points of interest ----------
  const SAFE = { town: '🏰', sun: '🏰', fishing: '🏘', elves: '🏘', dwarves: '🏘', beasts: '🏘', farm: '🏘', shrine: '⛩' };
  function pois(){
    const out = [{ id: 'town', n: 'Місто Шляху', x: 0, z: 0, ic: '🏰', always: true }, { id: 'dun', n: 'Підземелля Авантюристів', x: ENTRY.x, z: ENTRY.z, ic: '🕳' }];
    ZONES.forEach(Z => { out.push({ id: Z.id, n: Z.n, x: Z.x, z: Z.z, r: Z.r, ic: Z.calamity ? '☠' : SAFE[Z.id] || '⚔', rank: Z.rank, zone: Z }); });
    ways.forEach(w => out.push({ id: 'way:' + w.id, n: 'Камінь шляху · ' + w.n, x: w.x, z: w.z, ic: '💠', way: w }));
    return out;
  }
  const known = id => !!P.disc[id];

  // ---------- quests: where to go ----------
  function qProg(a, Q){ return Q.type === 'collect' ? Math.min(RPG.countItem(P, Q.item), Q.need) : Math.min(a.prog || 0, Q.need); }
  function npcPos(id){ const n = o.npcs.find(q => q.def.id === id); return n ? { x: n.a.x, z: n.a.z } : null; }
  function nearestSpawn(types){ const C = o.combat(); if(!C) return null; let best = null, bd = 1e9; C.monsters.forEach(m => { if(!types.includes(m.type) || (m.dormant && m.dead)) return; const d = Math.hypot(m.sx - agent.x, m.sz - agent.z); if(d < bd){ bd = d; best = { x: m.sx, z: m.sz }; } }); return best; }
  function questTarget(a){
    const Q = RPG.QUEST_POOL.find(q => q.id === a.id); if(!Q) return null;
    const done = qProg(a, Q) >= Q.need;
    if(done){
      if(Q.giver){ const p = npcPos(Q.giver); return p && { ...p, label: 'здати' }; }
      const gs = town.interactives.filter(b => b.id === 'guild' || b.id === 'guild2'); let best = null, bd = 1e9; gs.forEach(b => { const d = Math.hypot(b.door.x - agent.x, b.door.z - agent.z); if(d < bd){ bd = d; best = b; } });
      return best && { x: best.door.x, z: best.door.z, label: 'здати в Гільдії' };
    }
    if(Q.type === 'visit'){ const Z = ZONES.find(z => z.id === Q.zone); return Z && { x: Z.x, z: Z.z, label: Z.n }; }
    if(Q.type === 'talk'){ const p = npcPos(Q.to); return p && { ...p, label: 'доручення' }; }
    if(Q.type === 'kill'){ const p = nearestSpawn(Q.target); return p && { ...p, label: 'мисливські угіддя' }; }
    if(Q.type === 'collect'){ const C = o.combat(); const types = C ? [...new Set(C.monsters.filter(m => (m.def.drops || []).some(dd => dd[0] === Q.item)).map(m => m.type))] : []; const p = nearestSpawn(types); return p && { ...p, label: 'де шукати' }; }
    return null;
  }
  function quests(){ return P.quests.map(a => { const Q = RPG.QUEST_POOL.find(q => q.id === a.id); if(!Q) return null; return { a, Q, prog: qProg(a, Q), t: questTarget(a) }; }).filter(Boolean); }

  // ---------- tracker HUD ----------
  let trT = 0;
  function drawTracker(){
    if(!P.reg || !P.quests.length || isDun(agent.x)){ track.innerHTML = ''; return; }
    const list = quests(); if(!tracked || !list.some(x => x.a.id === tracked)) tracked = list[0] && list[0].a.id;
    const camYaw = o.camYaw ? o.camYaw() : 0;
    track.innerHTML = list.slice(0, 4).map(x => { const d = x.t ? Math.hypot(x.t.x - agent.x, x.t.z - agent.z) : null; const vx = x.t ? x.t.x - agent.x : 0, vz = x.t ? x.t.z - agent.z : 0;
      const rot = Math.atan2(vx*Math.cos(camYaw) - vz*Math.sin(camYaw), -vx*Math.sin(camYaw) - vz*Math.cos(camYaw)); const done = x.prog >= x.Q.need;
      return '<div class="nv-q' + (x.a.id === tracked ? ' on' : '') + (done ? ' done' : '') + '" data-q="' + x.a.id + '"><b>' + (done ? '✔ ' : '') + esc(x.Q.n) + '</b><div class="nv-row"><span>' + (done ? (x.t ? x.t.label : 'здати') : x.prog + ' / ' + x.Q.need) + '</span>' + (d != null ? '<span><i class="nv-dir" style="transform:rotate(' + rot.toFixed(2) + 'rad)">⬆</i> ' + fmtD(d) + '</span>' : '') + '</div></div>'; }).join('');
    track.querySelectorAll('[data-q]').forEach(el => el.onclick = e => { e.stopPropagation(); tracked = el.dataset.q; P.track = tracked; RPG.save(); drawTracker(); });
  }
  const fmtD = d => d < 1000 ? Math.round(d) + ' м' : (d/1000).toFixed(1) + ' км';
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function trackedTarget(){ if(!tracked) return null; const a = P.quests.find(q => q.id === tracked); return a ? questTarget(a) : null; }

  // ---------- quest beacon in the world ----------
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffcf5a', transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.frustumCulled = false; beam.visible = false; o.scene.add(beam);

  // ---------- discovery ----------
  let discT = 0;
  function discover(){
    if(isDun(agent.x)) return;
    const Z = zoneAt(agent.x, agent.z);
    if(Z && !P.disc[Z.id]){ P.disc[Z.id] = 1; const xp = Z.calamity ? 300 : Z.safe ? 120 : 80; o.toast('🗺 Нове місце: ' + Z.n + '  (+' + xp + ' досвіду)', 'big'); o.gainXp && o.gainXp(xp); RPG.save(); }
    ways.forEach(w => { if(!P.ways[w.id] && Math.hypot(w.x - agent.x, w.z - agent.z) < 9){ P.ways[w.id] = 1; o.toast('💠 Камінь шляху «' + w.n + '» пробуджено. Тепер сюди можна перенестися з карти.', 'big'); RPG.save(); } });
    const key = Math.floor(agent.x/40) + ',' + Math.floor(agent.z/40);
    if(!fogSet.has(key)){ fogSet.add(key); P.fog = [...fogSet]; RPG.save(); }
  }

  // ---------- world map ----------
  const view = { x: 0, z: 0, s: 1 };
  let selected = null;
  function sizeCanvas(){ const r = map.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(r.width*dpr); cv.height = Math.round(r.height*dpr); cv.dpr = dpr; }
  const w2s = (x, z) => [cv.width/2 + (x - view.x)*view.s, cv.height/2 + (z - view.z)*view.s];
  const s2w = (sx, sy) => [view.x + (sx - cv.width/2)/view.s, view.z + (sy - cv.height/2)/view.s];
  function drawMap(){
    if(!map.classList.contains('on')) return;
    const W = cv.width, H = cv.height, dpr = cv.dpr || 1; cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#0d0f0c'; cx.fillRect(0, 0, W, H);
    cx.save(); cx.translate(W/2, H/2); cx.scale(view.s, view.s); cx.translate(-view.x, -view.z);
    cx.imageSmoothingEnabled = true; cx.drawImage(terrainImg, -EXT, -EXT, EXT*2, EXT*2);
    // roads
    cx.strokeStyle = 'rgba(214,186,130,.85)'; cx.lineWidth = 3.2; cx.lineCap = cx.lineJoin = 'round'; ROADS.forEach(R => { cx.beginPath(); R.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke(); });
    // towns
    cx.fillStyle = '#7a7060'; cx.beginPath(); cx.arc(0, 0, WALL_R + 2, 0, 7); cx.fill(); cx.fillStyle = '#9a9080'; cx.beginPath(); cx.arc(0, 0, TOWN_R - 8, 0, 7); cx.fill();
    cx.fillStyle = '#7a7060'; cx.beginPath(); cx.arc(CITY2.x, CITY2.z, CITY2.R + 2, 0, 7); cx.fill(); cx.fillStyle = '#9a9080'; cx.beginPath(); cx.arc(CITY2.x, CITY2.z, CITY2.R - 10, 0, 7); cx.fill();
    // zones
    ZONES.forEach(Z => { if(Z.id === 'sun') return; cx.strokeStyle = Z.calamity ? 'rgba(255,60,40,.85)' : Z.safe ? 'rgba(140,220,255,.6)' : 'rgba(255,200,120,.55)'; cx.setLineDash(Z.calamity ? [] : [6, 5]); cx.lineWidth = Z.calamity ? 2.5 : 1.6; cx.beginPath(); cx.arc(Z.x, Z.z, Z.r, 0, 7); cx.stroke(); });
    cx.setLineDash([]);
    // fog over unexplored land
    if(!fogImg || fogN !== fogSet.size){ fogN = fogSet.size; fogImg = document.createElement('canvas'); fogImg.width = fogImg.height = 30; const fc = fogImg.getContext('2d'); fc.fillStyle = 'rgba(8,9,7,.78)'; fc.fillRect(0, 0, 30, 30);
      fc.globalCompositeOperation = 'destination-out'; fogSet.forEach(k => { const [gx, gz] = k.split(',').map(Number); const g2 = fc.createRadialGradient(gx + 15.5, gz + 15.5, 0, gx + 15.5, gz + 15.5, 1.6); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(.55, 'rgba(0,0,0,.9)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); fc.fillStyle = g2; fc.fillRect(gx + 13, gz + 13, 5, 5); });
      { const g2 = fc.createRadialGradient(15, 15, 0, 15, 15, 2.4); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(.7, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); fc.fillStyle = g2; fc.fillRect(11, 11, 8, 8); } }
    cx.imageSmoothingEnabled = true; cx.drawImage(fogImg, -600, -600, 1200, 1200);
    cx.restore();
    // icons & labels in screen space
    const fs = Math.round(12*dpr);
    const P2 = pois();
    P2.forEach(p => { const [sx, sy] = w2s(p.x, p.z); if(sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) return; const kn = p.always || p.way ? true : known(p.id) || p.id === 'dun';
      const isWay = !!p.way, wk = isWay && P.ways[p.way.id];
      if(isWay && !wk && view.s < 1.1) return;
      cx.globalAlpha = isWay && !wk ? .45 : 1; cx.font = Math.round((p.zone && p.zone.calamity ? 20 : isWay ? 15 : 17)*dpr) + 'px system-ui,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(p.ic, sx, sy);
      cx.globalAlpha = 1;
      if(!isWay && (view.s > .55 || p.ic === '🏰' || (p.zone && p.zone.calamity))){ cx.font = '600 ' + fs + 'px Georgia,serif'; const t = kn ? p.n : '???'; cx.lineWidth = 3*dpr; cx.strokeStyle = 'rgba(0,0,0,.75)'; const ly = p.id === 'dun' ? sy - 14*dpr : sy + 16*dpr; cx.strokeText(t, sx, ly); cx.fillStyle = p.zone && p.zone.calamity ? '#ff8a7a' : '#f4e6c8'; cx.fillText(t, sx, ly);
        if(kn && p.rank && view.s > .9){ cx.font = Math.round(10*dpr) + 'px system-ui,sans-serif'; cx.fillStyle = 'rgba(240,225,200,.75)'; cx.strokeText(p.rank, sx, sy + 29*dpr); cx.fillText(p.rank, sx, sy + 29*dpr); } } });
    // quests
    quests().forEach(x => { if(!x.t) return; const [sx, sy] = w2s(x.t.x, x.t.z); cx.font = Math.round((x.a.id === tracked ? 20 : 15)*dpr) + 'px system-ui,sans-serif'; cx.textAlign = 'center'; cx.fillText(x.prog >= x.Q.need ? '❓' : '❗', sx, sy - 10*dpr); });
    // adventurer parties & friends
    if(o.advs && o.advs()){ const A = o.advs(); A.parties.forEach(pt => { const m = A.list.find(a => a.p === pt.k && !a.dead); if(!m) return; const [sx, sy] = w2s(m.n.a.x, m.n.a.z); cx.fillStyle = '#ffd24a'; cx.beginPath(); cx.arc(sx, sy, 4.5*dpr, 0, 7); cx.fill(); if(view.s > .8){ cx.font = Math.round(10*dpr) + 'px system-ui,sans-serif'; cx.fillStyle = '#ffe8a0'; cx.fillText(pt.P.n, sx, sy - 10*dpr); } }); }
    o.others().forEach(r => { const [sx, sy] = w2s(r.x, r.z); cx.fillStyle = '#5ab4ff'; cx.beginPath(); cx.arc(sx, sy, 5*dpr, 0, 7); cx.fill(); cx.strokeStyle = '#fff'; cx.lineWidth = 1.5*dpr; cx.stroke(); if(r.name){ cx.font = Math.round(11*dpr) + 'px system-ui,sans-serif'; cx.fillStyle = '#bfe2ff'; cx.fillText(r.name, sx, sy - 11*dpr); } });
    // me
    { const [sx, sy] = w2s(agent.x, agent.z); cx.save(); cx.translate(sx, sy); cx.rotate(-agent.heading + Math.PI); const k = dpr*1.3; cx.fillStyle = '#fff'; cx.strokeStyle = '#000'; cx.lineWidth = 2*dpr; cx.beginPath(); cx.moveTo(0, -10*k); cx.lineTo(7*k, 7*k); cx.lineTo(0, 3*k); cx.lineTo(-7*k, 7*k); cx.closePath(); cx.stroke(); cx.fill(); cx.restore(); }
    // compass
    cx.font = '700 ' + Math.round(13*dpr) + 'px Georgia,serif'; cx.fillStyle = '#ffe2a8'; cx.textAlign = 'center'; cx.fillText('Пн ▲', W - 34*dpr, 74*dpr);
  }
  function openMap(){
    if(isDun(agent.x)){ o.toast('У підземеллі карта світу не працює — шукайте сходи нагору'); return; }
    if(!terrainImg) buildTerrain();
    map.classList.add('on'); sizeCanvas(); view.x = agent.x; view.z = agent.z; view.s = Math.min(cv.width, cv.height)/700; hidePop(); drawMap();
  }
  function closeMap(){ map.classList.remove('on'); hidePop(); }
  function hidePop(){ pop.classList.remove('on'); selected = null; }
  function showPop(p, sx, sy){
    selected = p; const dpr = cv.dpr || 1; const d = Math.hypot(p.x - agent.x, p.z - agent.z);
    let h = '<b>' + esc(p.known === false ? '???' : p.n) + '</b>' + (p.rank ? '<div style="opacity:.75">' + esc(p.rank) + '</div>' : '') + '<div style="opacity:.75">' + fmtD(d) + ' від вас</div>';
    const btns = [];
    if(p.way){ if(P.ways[p.way.id]) btns.push('<button data-p="tp">💠 Перенестися</button>'); else h += '<div style="margin-top:4px;opacity:.8">Підійдіть до каменя, щоб його пробудити.</div>'; }
    btns.push('<button data-p="go"' + (p.way && P.ways[p.way.id] ? ' class="g"' : '') + '>🚶 Йти сюди</button>');
    h += '<div class="nv-pb">' + btns.join('') + '<button class="g" data-p="x">✕</button></div>';
    pop.innerHTML = h; pop.style.left = (sx/dpr) + 'px'; pop.style.top = (sy/dpr) + 'px'; pop.classList.add('on');
    pop.querySelectorAll('[data-p]').forEach(b => b.onclick = e => { e.stopPropagation(); const k = b.dataset.p; if(k === 'x') return hidePop(); if(k === 'go'){ closeMap(); o.walkTo(p.x, p.z); } if(k === 'tp') travel(p.way); });
  }
  function travel(w){
    const C = o.combat();
    if(C && C.H.dead) return;
    if(C && C.H.combatT > 0){ o.toast('⚔ Не можна переноситися посеред бою'); return; }
    closeMap(); fade.classList.add('on');
    setTimeout(() => { o.teleport(w.door.x, w.door.z); o.toast('💠 ' + w.n); setTimeout(() => fade.classList.remove('on'), 250); }, 380);
  }
  // pointer: pan, pinch, tap
  const pts = new Map(); let moved = 0, pinch0 = null;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if(pts.size === 2){ const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: view.s }; } });
  cv.addEventListener('pointermove', e => { if(!pts.has(e.pointerId)) return; const pr = pts.get(e.pointerId); const dx = e.clientX - pr[0], dy = e.clientY - pr[1]; pts.set(e.pointerId, [e.clientX, e.clientY]); const dpr = cv.dpr || 1;
    if(pts.size === 2 && pinch0){ const [a, b] = [...pts.values()]; view.s = Math.max(.25, Math.min(6, pinch0.s*Math.hypot(a[0] - b[0], a[1] - b[1])/pinch0.d)); moved += 99; }
    else { view.x -= dx*dpr/view.s; view.z -= dy*dpr/view.s; moved += Math.abs(dx) + Math.abs(dy); }
    hidePop(); drawMap(); });
  const up = e => { pts.delete(e.pointerId); if(pts.size < 2) pinch0 = null; };
  cv.addEventListener('pointerup', e => { const was = pts.size; up(e); if(was === 1 && moved < 8){ const r = cv.getBoundingClientRect(), dpr = cv.dpr || 1; const sx = (e.clientX - r.left)*dpr, sy = (e.clientY - r.top)*dpr; tap(sx, sy); } });
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), dpr = cv.dpr || 1; const sx = (e.clientX - r.left)*dpr, sy = (e.clientY - r.top)*dpr; const [wx, wz] = s2w(sx, sy); view.s = Math.max(.25, Math.min(6, view.s*Math.exp(-e.deltaY*.0015))); const [wx2, wz2] = s2w(sx, sy); view.x += wx - wx2; view.z += wz - wz2; hidePop(); drawMap(); }, { passive: false });
  function tap(sx, sy){
    const dpr = cv.dpr || 1; let best = null, bd = 26*dpr;
    pois().forEach(p => { if(p.way && !P.ways[p.way.id] && view.s < 1.1) return; const [px, py] = w2s(p.x, p.z); const d = Math.hypot(px - sx, py - sy); if(d < bd){ bd = d; best = { ...p, known: p.always || p.way || p.id === 'dun' ? true : known(p.id) }; } });
    if(best) return showPop(best, sx, sy);
    const [wx, wz] = s2w(sx, sy); if(landDist(wx, wz) < 1 && Math.hypot(wx - CITY2.x, wz - CITY2.z) > CITY2.R + 2 && Math.hypot(wx, wz) > WALL_R + 2) { hidePop(); return; }
    showPop({ n: 'Ця точка', x: wx, z: wz }, sx, sy);
  }
  map.querySelector('[data-n=close]').onclick = e => { e.stopPropagation(); closeMap(); };
  map.querySelector('[data-n=me]').onclick = e => { e.stopPropagation(); view.x = agent.x; view.z = agent.z; drawMap(); };
  window.addEventListener('resize', () => { if(map.classList.contains('on')){ sizeCanvas(); drawMap(); } });

  // ---------- minimap overlay: arrows to places beyond the edge ----------
  function miniArrows(mc, W, sc){
    if(isDun(agent.x)) return;
    const R = W/2 - 9, list = [];
    list.push({ x: 0, z: 0, ic: '🏰', c: '#f1e3c8' });
    if(P.disc.sun || Math.hypot(agent.x - CITY2.x, agent.z - CITY2.z) < 400) list.push({ x: CITY2.x, z: CITY2.z, ic: '🏰', c: '#ffd27a' });
    list.push({ x: ENTRY.x, z: ENTRY.z, ic: '🕳', c: '#c8b0ff' });
    const t = trackedTarget(); if(t) list.push({ x: t.x, z: t.z, ic: '❗', c: '#ffcf5a', q: true });
    list.forEach(p => { const dx = (p.x - agent.x)*sc, dz = (p.z - agent.z)*sc, d = Math.hypot(dx, dz);
      mc.save(); mc.translate(W/2, W/2);
      if(d < R - 4){ if(p.q){ mc.font = '13px system-ui'; mc.textAlign = 'center'; mc.textBaseline = 'middle'; mc.fillText(p.ic, dx, dz); } mc.restore(); return; }
      const a = Math.atan2(dz, dx), ex = Math.cos(a)*R, ez = Math.sin(a)*R;
      mc.translate(ex, ez); mc.rotate(a); mc.fillStyle = p.c; mc.beginPath(); mc.moveTo(8, 0); mc.lineTo(-2, -5); mc.lineTo(-2, 5); mc.closePath(); mc.fill(); mc.rotate(-a);
      mc.font = '10px system-ui'; mc.textAlign = 'center'; mc.textBaseline = 'middle'; mc.fillText(p.ic, -Math.cos(a)*10, -Math.sin(a)*10); mc.restore(); });
    mc.save(); mc.font = '700 10px Georgia,serif'; mc.fillStyle = '#ffe2a8'; mc.textAlign = 'center'; mc.strokeStyle = 'rgba(0,0,0,.7)'; mc.lineWidth = 3; mc.strokeText('Пн', W/2, 11); mc.fillText('Пн', W/2, 11); mc.restore();
  }

  return {
    css: NAV_CSS, openMap, closeMap, miniArrows, travel, questTarget,
    isOpen: () => map.classList.contains('on'),
    update(dt){
      discT -= dt; if(discT <= 0){ discT = .5; discover(); }
      trT -= dt; if(trT <= 0){ trT = .4; drawTracker(); if(map.classList.contains('on')) drawMap(); }
      const t = trackedTarget(); const d = t ? Math.hypot(t.x - agent.x, t.z - agent.z) : 0;
      beam.visible = !!t && d > 14 && d < 260 && !isDun(agent.x);
      if(beam.visible){ beam.position.set(t.x, heightAt(t.x, t.z) + 30, t.z); beam.material.opacity = .14 + Math.min(.16, d/1200); }
    }
  };
}

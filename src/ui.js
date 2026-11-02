import * as THREE from 'three';
import { sfx } from './audio.js';
import * as RPG from './rpg.js';
import { ZONES, zoneAt } from './nature.js';
import { ROADS, LAKE, SWAMP, WORLD_R, WALL_R, TOWN_R, LANDS, PASSES, CITY2 } from './world.js';
import { FLOORS as DFLOORS, ENTRY as DENTRY, isDun, floorX } from './dungeon.js';
import { get as saveGet, commit as saveCommit } from './save.js';

export const RP_CSS = `
.rp-hud{position:absolute;left:10px;top:calc(env(safe-area-inset-top,0px) + 54px);z-index:3;pointer-events:none;display:flex;gap:9px;align-items:flex-start;max-width:58vw}
.rp-badge{width:46px;height:54px;flex:none;display:flex;align-items:center;justify-content:center;font:800 24px Georgia,serif;color:#1a1208;clip-path:polygon(50% 0,100% 14%,100% 62%,50% 100%,0 62%,0 14%);box-shadow:inset 0 0 0 2px rgba(255,255,255,.35);text-shadow:0 1px 0 rgba(255,255,255,.4)}
.rp-who{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.rp-who b{font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px #000}
.rp-who small{font-size:11px;opacity:.85;text-shadow:0 1px 3px #000}
.rp-bar{position:relative;height:11px;width:min(190px,44vw);background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.18);border-radius:6px;overflow:hidden}
.rp-bar i{position:absolute;inset:0;width:0;transition:width .25s}
.rp-bar span{position:absolute;inset:0;font:700 9px/11px ui-monospace,monospace;text-align:center;color:#fff;text-shadow:0 1px 2px #000}
.rp-bar.hp i{background:linear-gradient(180deg,#e2564a,#9a1e18)}.rp-bar.mp i{background:linear-gradient(180deg,#4a8aff,#1e3a9a)}
.rp-bar.xp{height:5px}.rp-bar.xp i{background:linear-gradient(90deg,#c9a040,#ffe08a)}
.rp-coins{display:flex;gap:6px;font-size:12px;font-weight:700;text-shadow:0 1px 3px #000}
.rp-buffs{display:flex;gap:4px}.rp-buffs span{font-size:13px;background:rgba(0,0,0,.45);border-radius:6px;padding:1px 4px}
.rp-target{position:absolute;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 86px);z-index:3;pointer-events:none;text-align:center;opacity:0;transition:opacity .2s;width:min(320px,70vw)}
.rp-target.on{opacity:1}
.rp-target b{font:600 13px Georgia,serif;text-shadow:0 1px 3px #000;display:block;margin-bottom:3px}
.rp-target .rp-bar{width:100%;height:9px}.rp-target.boss .rp-bar{height:14px}.rp-target.boss b{color:#ffcf6a;font-size:15px}
.rp-actions{position:absolute;right:calc(env(safe-area-inset-right,0px) + 10px);bottom:calc(env(safe-area-inset-bottom,0px) + 74px);z-index:3;width:190px;height:190px;pointer-events:none}
.rp-act{position:absolute;pointer-events:auto;border-radius:50%;border:2px solid rgba(255,230,180,.35);background:radial-gradient(circle at 35% 30%,rgba(70,58,44,.92),rgba(20,16,12,.92));color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;touch-action:manipulation;box-shadow:0 4px 14px rgba(0,0,0,.5);user-select:none;-webkit-user-select:none}
.rp-act:active{transform:scale(.93)}
.rp-act.main{width:78px;height:78px;right:0;bottom:0;font-size:32px;border-color:rgba(255,210,140,.6)}
.rp-act.sk{width:54px;height:54px}
.rp-act.pot{width:40px;height:40px;font-size:17px}
.rp-act .cd{position:absolute;inset:0;border-radius:50%;background:conic-gradient(rgba(0,0,0,.72) calc(var(--p,0)*1turn),transparent 0);pointer-events:none}
.rp-act .mp{position:absolute;bottom:-3px;right:-2px;font:700 9px ui-monospace,monospace;background:#1e3a9a;border-radius:6px;padding:0 3px}
.rp-act .q{position:absolute;bottom:-3px;right:-3px;font:700 10px ui-monospace,monospace;background:#000a;border-radius:6px;padding:0 3px}
.rp-act.off{filter:grayscale(.8) brightness(.7)}
.gm-root .gm-hero{display:none}
@media (max-width:760px){.gm-root .gm-title{display:none}.gm-root .gm-hint{align-self:flex-start;max-width:calc(100vw - 230px);font-size:11px}}
.gm-root .rp-mini{position:absolute;right:10px;top:calc(env(safe-area-inset-top,0px) + 58px);z-index:3;width:118px;height:118px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,230,180,.35);box-shadow:0 4px 16px rgba(0,0,0,.5);pointer-events:auto;cursor:pointer;background:#1a2016}
.gm-root .gm-side{top:calc(env(safe-area-inset-top,0px) + 186px)!important}
.rp-float{position:absolute;left:0;top:0;pointer-events:none;font:800 16px/1 Georgia,serif;color:#fff;text-shadow:0 2px 3px #000,0 0 8px rgba(0,0,0,.6);white-space:nowrap;z-index:2;will-change:transform}
.rp-float.crit{color:#ffd23a;font-size:22px}.rp-float.hurt{color:#ff5a4a}.rp-float.heal{color:#7aff9a}.rp-float.gold{color:#ffd27a;font-size:13px}.rp-float.xp{color:#c9a0ff;font-size:13px}.rp-float.mana{color:#7ab0ff}.rp-float.dot{color:#9aff6a;font-size:13px}
.rp-plate{position:absolute;left:0;top:0;pointer-events:none;transform:translate(-50%,-100%);text-align:center;z-index:1;will-change:transform}
.rp-plate b{display:block;font:600 11px Georgia,serif;text-shadow:0 1px 3px #000;white-space:nowrap}
.rp-plate b em{font-style:normal;color:#ffcf6a;margin-right:4px}
.rp-plate .rp-bar{width:62px;height:5px;margin:2px auto 0;border-radius:3px}
.rp-toasts{position:absolute;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 124px);z-index:6;display:flex;flex-direction:column;gap:5px;align-items:center;pointer-events:none;width:min(440px,92vw)}
.rp-toast{background:rgba(16,12,10,.82);border:1px solid rgba(255,230,180,.25);border-radius:12px;padding:6px 12px;font-size:13px;animation:rpT 3.2s forwards;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);text-align:center}
.rp-toast.big{font:600 17px Georgia,serif;padding:10px 18px;border-color:#d9a24a;color:#ffe2a8}
@keyframes rpT{0%{opacity:0;transform:translateY(-8px)}8%{opacity:1;transform:none}82%{opacity:1}100%{opacity:0}}
.rp-zone{position:absolute;left:0;right:0;top:34%;text-align:center;pointer-events:none;z-index:4;opacity:0;transition:opacity 1s}
.rp-zone.on{opacity:1}.rp-zone h2{margin:0;font:400 30px Georgia,serif;letter-spacing:.12em;color:#f1e3c8;text-shadow:0 2px 18px #000}.rp-zone p{margin:6px 0 0;font-size:13px;letter-spacing:.2em;text-transform:uppercase;opacity:.85;text-shadow:0 2px 8px #000}
.rp-hurt{position:absolute;inset:0;pointer-events:none;z-index:2;box-shadow:inset 0 0 120px rgba(200,0,0,.0);transition:box-shadow .5s}
.rp-hurt.on{box-shadow:inset 0 0 140px rgba(200,0,0,.55);transition:none}
.rp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(48px,1fr));gap:6px;margin:8px 0 12px}
.rp-tile{position:relative;aspect-ratio:1;border-radius:10px;border:2px solid #555;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer}
.rp-tile.sel{outline:2px solid #fff}.rp-tile small{position:absolute;right:3px;bottom:1px;font:700 10px ui-monospace,monospace}
.rp-tile .pl{position:absolute;left:3px;top:1px;font:700 9px ui-monospace,monospace;color:#ffd27a}
.rp-eq{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0 10px}
.rp-eq div{border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:6px;font-size:11px;min-height:46px;cursor:pointer;background:rgba(255,255,255,.04);overflow:hidden}
.rp-eq div i{font-style:normal;font-size:18px;margin-right:4px}.rp-eq div em{display:block;font-style:normal;opacity:.6;font-size:10px}
.rp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;font-size:11.5px;margin:4px 0 8px}
.rp-stats span{background:rgba(255,255,255,.06);border-radius:8px;padding:4px 6px;white-space:nowrap}
.rp-stats span b{display:block;font-size:13px}
.rp-detail{border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px;margin:0 0 10px;font-size:12.5px;line-height:1.45;background:rgba(0,0,0,.25)}
.rp-detail h4{margin:0 0 4px;font:600 15px Georgia,serif}
.rp-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.rp-row .gm-btn{flex:1;min-width:110px;width:auto!important;padding:9px!important}
.rp-cls{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:8px 0 12px}
.rp-cls button{text-align:left;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#fff;padding:10px;cursor:pointer;font-family:inherit}
.rp-cls button.on{border-color:#d9a24a;background:rgba(217,162,74,.18)}
.rp-cls b{display:block;font:600 14px Georgia,serif;margin-bottom:2px}.rp-cls i{font-style:normal;font-size:20px;float:right}.rp-cls small{font-size:11px;opacity:.8;line-height:1.35;display:block}
.rp-q{border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:10px;margin-bottom:8px;background:rgba(255,255,255,.04);font-size:12.5px}
.rp-q b{font:600 14px Georgia,serif}.rp-q .rw{color:#ffd27a;font-size:11.5px;margin-top:4px}
.rp-q .gm-btn{width:auto!important;padding:7px 12px!important;margin-top:8px;font-size:12px}
.rp-card{position:relative;border-radius:18px;padding:16px;margin:4px 0 14px;color:#2a1c0c;background:linear-gradient(135deg,#efe2c0,#d9c08a 55%,#c8a868);box-shadow:0 10px 30px rgba(0,0,0,.5),inset 0 0 0 2px rgba(255,255,255,.4),inset 0 0 0 6px rgba(120,80,30,.35);overflow:hidden;font-family:Georgia,serif}
.rp-card:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 6px,transparent 6px 12px);pointer-events:none}
.rp-card .hd{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.75}
.rp-card .nm{font-size:22px;margin:10px 0 2px;font-weight:700}
.rp-card .cl{font-size:13px;opacity:.85}
.rp-card .rk{position:absolute;right:16px;top:34px;width:70px;height:82px;display:flex;align-items:center;justify-content:center;font:800 42px Georgia,serif;clip-path:polygon(50% 0,100% 14%,100% 62%,50% 100%,0 62%,0 14%);color:#1a1208}
.rp-card .ft{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:14px;font-size:11px}
.rp-card .ft span{background:rgba(80,50,20,.12);border-radius:8px;padding:5px}.rp-card .ft b{display:block;font-size:14px}
.rp-card .gp{height:6px;border-radius:4px;background:rgba(60,40,10,.25);margin-top:12px;overflow:hidden}.rp-card .gp i{display:block;height:100%;background:linear-gradient(90deg,#8a5a1a,#e0a040)}
.rp-tabs{display:flex;gap:6px;margin-bottom:8px}.rp-tabs button{flex:1;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;padding:8px;font-weight:600;cursor:pointer;font-family:inherit}.rp-tabs button.on{background:rgba(217,162,74,.25);border-color:#d9a24a}
.rp-shop{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.rp-shop div{display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:7px 9px;font-size:12.5px}
.rp-shop div i{font-style:normal;font-size:20px}.rp-shop div span{flex:1}.rp-shop div button{border-radius:9px;border:1px solid rgba(255,210,140,.5);background:rgba(217,162,74,.2);color:#ffe2a8;padding:6px 10px;font-weight:700;cursor:pointer;font-family:inherit}
.rp-shop div button:disabled{opacity:.35}
`;

export function createUI(o){
  const { root, camera, P } = o;
  const el = (cls, html, parent) => { const d = document.createElement('div'); d.className = cls; if(html != null) d.innerHTML = html; (parent || root).appendChild(d); return d; };
  const hud = el('rp-hud', '<div class="rp-badge"></div><div class="rp-who"><b></b><small></small><div class="rp-bar hp"><i></i><span></span></div><div class="rp-bar mp"><i></i><span></span></div><div class="rp-bar xp"><i></i></div><div class="rp-coins"></div><div class="rp-buffs"></div></div>');
  const tgt = el('rp-target', '<b></b><div class="rp-bar hp"><i></i><span></span></div>');
  const acts = el('rp-actions', '');
  const mini = document.createElement('canvas'); mini.className = 'rp-mini'; mini.width = mini.height = 236; root.appendChild(mini);
  const toasts = el('rp-toasts', '');
  const zoneEl = el('rp-zone', '<h2></h2><p></p>');
  const hurtEl = el('rp-hurt', '');
  const layer = root.querySelector('.gm-labels');
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // action buttons
  const B = {};
  function buildActions(){
    acts.innerHTML = '';
    const C = RPG.CLASSES[P.cls];
    const mk = (cls, html, x, y, fn) => { const b = document.createElement('button'); b.className = 'rp-act ' + cls; b.innerHTML = html + '<div class="cd"></div>'; b.style.right = x + 'px'; b.style.bottom = y + 'px'; b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); fn(); }); acts.appendChild(b); return b; };
    B.main = mk('main', C ? C.i : '✊', 0, 0, () => o.onAttack());
    if(C){ const pos = [[88, 6], [70, 72], [10, 92]]; B.sk = C.skills.map((s, i) => mk('sk', s.i + '<span class="mp">' + s.mp + '</span>', pos[i][0], pos[i][1], () => o.onSkill(i))); }
    else B.sk = [];
    B.hp = mk('pot', '❤️<span class="q"></span>', 144, 4, () => o.onPotion('hp'));
    B.mp = mk('pot', '💙<span class="q"></span>', 148, 52, () => o.onPotion('mp'));
    acts.style.display = P.reg ? '' : 'none';
  }
  buildActions();

  // floating numbers
  const floats = [];
  function float(text, x, y, z, cls){
    const d = document.createElement('div'); d.className = 'rp-float ' + (cls || ''); d.textContent = text; d.style.opacity = 0; layer.appendChild(d);
    floats.push({ d, p: new THREE.Vector3(x, y, z), t: 0, dx: (Math.random() - .5)*30 });
    const snd = { crit: 'crit', dmg: 'hit', hurt: 'hurt', heal: 'heal', gold: 'coin', xp: 'xp' }[cls || 'dmg']; if(snd){ const cp = camera.position; sfx(snd, Math.max(0, Math.hypot(x - cp.x, z - cp.z) - 10)); }
  }
  // nameplates
  const plates = new Map();
  function plateFor(m){ let p = plates.get(m); if(!p){ p = el('rp-plate', '<b><em></em><span></span></b><div class="rp-bar hp"><i></i></div>', layer); plates.set(m, p); p.querySelector('span').textContent = m.def.n; p.querySelector('em').textContent = m.lvl; } return p; }

  function toast(html, cls){ if(cls === 'big') sfx(/рів|Рів|завдання|Завдання|виконано/.test(html) ? 'level' : 'chime'); const d = el('rp-toast ' + (cls || ''), html, toasts); setTimeout(() => d.remove(), 3300); while(toasts.children.length > 4) toasts.firstChild.remove(); }
  let curZone = null, zoneT = 0;
  function zoneBanner(title, sub){ zoneEl.querySelector('h2').textContent = title; zoneEl.querySelector('p').textContent = sub; zoneEl.classList.add('on'); clearTimeout(zoneT); zoneT = setTimeout(() => zoneEl.classList.remove('on'), 2600); }

  function updHud(){
    const cb = o.combat(); const R = RPG.rankOf(P.rank);
    const badge = hud.querySelector('.rp-badge'); badge.textContent = P.reg ? R.r : '?'; badge.style.background = `linear-gradient(160deg,${R.c1},${R.c2})`;
    hud.querySelector('b').textContent = o.heroName();
    const C = RPG.CLASSES[P.cls];
    hud.querySelector('small').textContent = P.reg ? (C.n + ' · рівень ' + P.lvl + ' · ранг ' + R.r) : 'Не зареєстрований · зайдіть до Гільдії';
    if(cb){ const D = cb.D, H = cb.H;
      const s = (q, a, b) => { const bar = hud.querySelector(q); bar.querySelector('i').style.width = (Math.max(0, a)/b*100).toFixed(1) + '%'; const sp = bar.querySelector('span'); if(sp) sp.textContent = Math.round(a) + ' / ' + b; };
      s('.hp', H.hp, D.maxHp); s('.mp', H.mp, D.maxMp); s('.xp', P.xp, RPG.xpNeed(P.lvl));
      hud.querySelector('.rp-buffs').innerHTML = H.buffs.map(b => '<span title="' + esc(b.n) + '">' + b.i + ' ' + Math.ceil(b.t) + '</span>').join('');
    }
    const S = saveGet();
    hud.querySelector('.rp-coins').innerHTML = '💰 ' + P.gold + ' &nbsp; ✦ ' + (S.sparks || 0) + (P.reg ? ' &nbsp; 🏅 ' + P.gp : '');
    const cnt = ids => P.inv.filter(x => x.k === 'use' && ids.includes(x.id)).reduce((a, x) => a + x.q, 0);
    if(B.hp){ B.hp.querySelector('.q').textContent = cnt(['hp1', 'hp2', 'hp3']); B.mp.querySelector('.q').textContent = cnt(['mp1', 'mp2']); }
  }
  let target = null, shownPrev = undefined;
  function setTarget(m){ target = m; shownPrev = undefined; tgt.classList.toggle('on', !!m); if(m){ tgt.classList.toggle('boss', !!m.def.boss); tgt.querySelector('b').textContent = (m.def.boss ? '👑 ' : '') + m.def.n + ' · ' + m.lvl + ' рів.'; } }

  // minimap
  const mc = mini.getContext('2d');
  let bigMap = false;
  mini.addEventListener('click', e => { e.stopPropagation(); o.onMap && o.onMap(); });
  function drawMini(hx, hz, heading, monsters, npcs){
    const W = mini.width, sc = bigMap ? 1 : 1.25; // px per meter
    mc.save(); mc.clearRect(0, 0, W, W);
    const DG = o.dungeon && o.dungeon();
    if(DG && isDun(hx)){
      const fi = DG.floorIndex(hx), FF = DG.floors[fi];
      mc.fillStyle = '#0c0a08'; mc.fillRect(0, 0, W, W);
      mc.translate(W/2, W/2); mc.scale(sc*1.6, sc*1.6); mc.translate(-hx, -hz);
      mc.imageSmoothingEnabled = true; mc.drawImage(FF.mini, FF.OX - DG.HALF, -DG.HALF, DG.HALF*2, DG.HALF*2);
      const F = FF.F; mc.fillStyle = '#7ad8ff'; mc.beginPath(); mc.arc(FF.OX + F.up[0], F.up[1], 1.6, 0, 7); mc.fill();
      if(F.down){ mc.fillStyle = '#ffcf5a'; mc.fillRect(FF.OX + F.down[0] - 1.5, F.down[1] - 1.5, 3, 3); }
      if(F.chest){ mc.fillStyle = '#ffd27a'; mc.beginPath(); mc.arc(FF.OX + F.chest[0], F.chest[1], 1.4, 0, 7); mc.fill(); }
      monsters.forEach(m => { if(m.dead || Math.abs(m.x - hx) > 120) return; mc.fillStyle = m.def.boss ? '#c46aff' : '#ff4a3a'; mc.beginPath(); mc.arc(m.x, m.z, m.def.boss ? 1.8 : 1.0, 0, 7); mc.fill(); });
      mc.restore();
      mc.save(); mc.translate(W/2, W/2); mc.rotate(-heading + Math.PI); mc.fillStyle = '#fff'; mc.beginPath(); mc.moveTo(0, -9); mc.lineTo(6, 7); mc.lineTo(0, 3); mc.lineTo(-6, 7); mc.closePath(); mc.fill(); mc.restore();
      return;
    }
    mc.fillStyle = '#26301f'; mc.fillRect(0, 0, W, W);
    mc.translate(W/2, W/2); mc.scale(sc, sc); mc.translate(-hx, -hz);
    mc.fillStyle = '#34402a'; mc.beginPath(); mc.arc(0, 0, WORLD_R, 0, 7); mc.fill();
    mc.fillStyle = '#34402a'; LANDS.forEach(L => { mc.beginPath(); mc.arc(L.x, L.z, L.r*.92, 0, 7); mc.fill(); });
    mc.strokeStyle = '#34402a'; mc.lineCap = 'round'; PASSES.forEach(([a, b, w]) => { mc.lineWidth = w*1.4; mc.beginPath(); mc.moveTo(a[0], a[1]); mc.lineTo(b[0], b[1]); mc.stroke(); });
    mc.fillStyle = '#6a6052'; mc.beginPath(); mc.arc(CITY2.x, CITY2.z, CITY2.R + 2, 0, 7); mc.fill(); mc.fillStyle = '#5a5246'; mc.beginPath(); mc.arc(CITY2.x, CITY2.z, CITY2.R - 1, 0, 7); mc.fill(); mc.fillStyle = '#8a8070'; mc.beginPath(); mc.arc(CITY2.x, CITY2.z, 17, 0, 7); mc.fill();
    mc.fillStyle = '#2a4a5a'; mc.beginPath(); mc.arc(LAKE.x, LAKE.z, LAKE.r, 0, 7); mc.fill(); mc.fillStyle = '#3a4430'; mc.beginPath(); mc.arc(SWAMP.x, SWAMP.z, SWAMP.r, 0, 7); mc.fill();
    mc.strokeStyle = 'rgba(190,160,110,.75)'; mc.lineWidth = 2.6; mc.lineCap = 'round'; ROADS.forEach(Rd => { mc.beginPath(); Rd.forEach((q, i) => i ? mc.lineTo(q[0], q[1]) : mc.moveTo(q[0], q[1])); mc.stroke(); });
    ZONES.forEach(Z => { mc.fillStyle = { meadow: 'rgba(120,200,110,.25)', grove: 'rgba(160,140,60,.3)', camp: 'rgba(200,90,60,.3)', ruins: 'rgba(160,160,200,.3)', darkwood: 'rgba(20,40,20,.45)', farm: 'rgba(220,200,120,.25)', mines: 'rgba(120,110,100,.35)', shrine: 'rgba(200,220,255,.25)', heath: 'rgba(150,130,90,.3)', lake: 'rgba(0,0,0,0)', swamp: 'rgba(0,0,0,0)', sun: 'rgba(0,0,0,0)', elves: 'rgba(120,220,180,.25)', dwarves: 'rgba(160,150,140,.35)', beasts: 'rgba(220,170,90,.28)', fishing: 'rgba(120,180,220,.25)', titan: 'rgba(255,40,40,.22)', fenrir: 'rgba(255,40,40,.22)', slimes: 'rgba(255,40,40,.22)' }[Z.id] || 'rgba(255,255,255,.1)'; mc.beginPath(); mc.arc(Z.x, Z.z, Z.r, 0, 7); mc.fill(); });
    mc.fillStyle = '#6a6052'; mc.beginPath(); mc.arc(0, 0, WALL_R + 1.5, 0, 7); mc.fill(); mc.fillStyle = '#5a5246'; mc.beginPath(); mc.arc(0, 0, TOWN_R, 0, 7); mc.fill(); mc.fillStyle = '#8a8070'; mc.beginPath(); mc.arc(0, 0, 11, 0, 7); mc.fill();
    mc.strokeStyle = '#8a8070'; mc.lineWidth = 5; [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([a, b]) => { mc.beginPath(); mc.moveTo(a*11, b*11); mc.lineTo(a*(WALL_R + 3), b*(WALL_R + 3)); mc.stroke(); });
    if(o.others){ mc.fillStyle = '#7ad8ff'; o.others().forEach(r => { mc.beginPath(); mc.arc(r.x, r.z, 2.4, 0, 7); mc.fill(); }); }
    mc.fillStyle = '#c9a24a'; mc.beginPath(); mc.moveTo(DENTRY.x, DENTRY.z - 3.2); mc.lineTo(DENTRY.x + 3, DENTRY.z + 2.4); mc.lineTo(DENTRY.x - 3, DENTRY.z + 2.4); mc.closePath(); mc.fill();
    monsters.forEach(m => { if(m.dead) return; mc.fillStyle = m.def.boss ? '#c46aff' : '#ff4a3a'; mc.beginPath(); mc.arc(m.x, m.z, m.def.boss ? 3.2 : 1.8, 0, 7); mc.fill(); });
    npcs.forEach(n => { mc.fillStyle = '#ffe08a'; mc.beginPath(); mc.arc(n.a.x, n.a.z, 1.4, 0, 7); mc.fill(); });
    mc.restore();
    if(o.miniOverlay) o.miniOverlay(mc, W, sc);
    mc.save(); mc.translate(W/2, W/2); mc.rotate(-heading + Math.PI); mc.fillStyle = '#fff'; mc.beginPath(); mc.moveTo(0, -9); mc.lineTo(6, 7); mc.lineTo(0, 3); mc.lineTo(-6, 7); mc.closePath(); mc.fill(); mc.restore();
  }

  const v3 = new THREE.Vector3();
  function project(p){ v3.copy(p).project(camera); return [(v3.x*.5 + .5)*root.clientWidth, (-v3.y*.5 + .5)*root.clientHeight, v3.z < 1]; }
  let miniT = 0;
  function frame(dt, hero, heading, monsters, npcs){
    // floats
    for(let i = floats.length - 1; i >= 0; i--){ const f = floats[i]; f.t += dt; if(f.t > 1.1){ f.d.remove(); floats.splice(i, 1); continue; } const [x, y, vis] = project(f.p); f.d.style.opacity = vis ? Math.min(1, (1.1 - f.t)*3) : 0; f.d.style.transform = `translate(-50%,-50%) translate(${(x + f.dx*f.t).toFixed(1)}px,${(y - f.t*46).toFixed(1)}px) scale(${f.t < .12 ? 1 + (.12 - f.t)*4 : 1})`; }
    // plates
    monsters.forEach(m => {
      const d = Math.hypot(m.x - hero.x, m.z - hero.z);
      const show = m.fig && !m.dead && d < 24 && (m.hp < m.maxHp || d < 14 || m === target);
      let p = plates.get(m);
      if(!show){ if(p) p.style.display = 'none'; return; }
      p = plateFor(m); p.style.display = '';
      v3.set(m.x, m.fig.obj.position.y + m.fig.height + .45, m.z);
      const [x, y, vis] = project(v3); if(!vis){ p.style.display = 'none'; return; }
      p.style.transform = `translate(-50%,-100%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      p.querySelector('i').style.width = (m.hp/m.maxHp*100).toFixed(1) + '%';
      p.style.opacity = m === target ? 1 : .85;
    });
    if(target && target.dead) setTarget(null);
    let shown = target;
    if(!shown){ let bd = 32; monsters.forEach(m => { if(m.def.boss && !m.dead && m.fig && (m.state === 'chase' || m.state === 'attack')){ const d = Math.hypot(m.x - hero.x, m.z - hero.z); if(d < bd){ bd = d; shown = m; } } }); }
    if(shown !== shownPrev){ shownPrev = shown; tgt.classList.toggle('on', !!shown); if(shown){ tgt.classList.toggle('boss', !!shown.def.boss); } }
    if(shown){ tgt.querySelector('b').textContent = (shown.def.calamity ? '☠ ' : shown.def.boss ? '👑 ' : '') + shown.def.n + ' · ' + shown.lvl + ' рів.' + (shown.enraged ? ' 🔥' : '');
      tgt.querySelector('i').style.width = (shown.hp/shown.maxHp*100) + '%'; tgt.querySelector('span').textContent = Math.max(0, Math.round(shown.hp)) + ' / ' + shown.maxHp; }
    // cooldowns
    const cb = o.combat();
    if(cb && B.sk){ const C = RPG.CLASSES[P.cls]; B.sk.forEach((b, i) => { const s = C.skills[i]; const cd = cb.H.cd[s.id] || 0; b.querySelector('.cd').style.setProperty('--p', (cd/s.cd).toFixed(3)); b.classList.toggle('off', cb.H.mp < s.mp); }); B.main.querySelector('.cd').style.setProperty('--p', 0); }
    miniT -= dt; if(miniT <= 0){ miniT = .12; drawMini(hero.x, hero.z, heading, monsters, npcs); }
    // zone banner
    const dfi = isDun(hero.x) ? Math.max(0, Math.min(DFLOORS.length - 1, Math.round((hero.x - floorX(0))/(floorX(1) - floorX(0))))) : -1;
    const z = dfi < 0 ? zoneAt(hero.x, hero.z) : null; const key = dfi >= 0 ? 'dun' + dfi : z ? z.id : Math.hypot(hero.x, hero.z) > WALL_R + 4 ? 'wild' : Math.hypot(hero.x, hero.z) < TOWN_R - 2 ? 'town' : curZone;
    if(key !== curZone){ const prev = curZone; curZone = key; if(dfi >= 0){ const DF = DFLOORS[dfi]; const [t1, t2] = DF.n.split(' · '); zoneBanner(t2, t1 + ' · ' + DF.sub.replace('рекомендований ', '')); } else if(prev){ if(key === 'town') zoneBanner('Місто Шляху', 'безпечна зона'); else if(key === 'wild') zoneBanner('Дикі землі', 'будьте пильні'); else if(z) zoneBanner(z.n, z.safe ? z.rank : 'рекомендований ранг ' + z.rank); }
      const tEl = document.querySelector('.gm-title'); if(tEl) tEl.textContent = dfi >= 0 ? 'Підземелля' : z ? z.n : key === 'wild' ? 'Дикі землі' : 'Місто Шляху'; }
  }
  let hurtT = 0;
  function hurt(){ hurtEl.classList.add('on'); clearTimeout(hurtT); hurtT = setTimeout(() => hurtEl.classList.remove('on'), 120); }

  // ---------------- sheets ----------------
  const sheet = o.sheet, hide = o.hide;
  const itemStats = it => {
    if(it.k === 'mat') return '<p>Матеріал. Ціна продажу: ' + RPG.itemValue(it) + ' 💰</p>';
    if(it.k === 'use'){ const c = RPG.CONSUMABLES[it.id]; return '<p>' + (c.heal ? 'Відновлює ' + (c.heal > 5000 ? 'усе' : c.heal) + ' здоров\'я. ' : '') + (c.mana ? 'Відновлює ' + (c.mana > 5000 ? 'всю' : c.mana) + ' мани.' : '') + '</p>'; }
    const pm = 1 + (it.plus || 0)*.1;
    let h = '<div style="color:' + RPG.itemColor(it) + ';font-size:11.5px">' + RPG.RARITY[it.rar].n + ' · рівень предмета ' + (it.tier + 1) + '</div>';
    if(it.atk) h += '<div>⚔️ Атака: <b>' + Math.round(it.atk*pm) + '</b></div>';
    if(it.def) h += '<div>🛡️ Захист: <b>' + Math.round(it.def*pm) + '</b></div>';
    Object.entries(it.bonus || {}).forEach(([k, v]) => h += '<div style="color:#8fd88f">+' + v + ' ' + RPG.BONUS_N[k] + '</div>');
    if(it.k === 'weapon'){ const W = RPG.WEAPONS[it.w]; const ok = W.cls.includes(P.cls); h += '<div style="opacity:.75;font-size:11.5px;margin-top:3px">Для класів: ' + W.cls.map(c => RPG.CLASSES[c].n).join(', ') + (ok ? '' : ' — <span style="color:#ff7a6a">не для вашого класу</span>') + '</div>'; }
    if(it.k === 'shield' && !RPG.CLASSES[P.cls].off) h += '<div style="color:#ff7a6a;font-size:11.5px">Ваш клас не носить щит</div>';
    return h;
  };
  const slotOf = it => it.k === 'weapon' ? 'weapon' : it.k;
  const canEquip = it => { if(it.k === 'weapon') return RPG.WEAPONS[it.w].cls.includes(P.cls); if(it.k === 'shield') return !!RPG.CLASSES[P.cls].off; return ['armor', 'helm', 'ring', 'amulet'].includes(it.k); };
  function statsBlock(){ const cb = o.combat(); const D = cb.D; return '<div class="rp-stats"><span>⚔️ Атака<b>' + D.atk + '</b></span><span>🛡️ Захист<b>' + D.def + '</b></span><span>❤️ HP<b>' + D.maxHp + '</b></span><span>💙 MP<b>' + D.maxMp + '</b></span><span>💪 Сила<b>' + D.st.str + '</b></span><span>🏃 Спритн.<b>' + D.st.agi + '</b></span><span>🧠 Інтел.<b>' + D.st.int + '</b></span><span>🎯 Крит<b>' + D.crit.toFixed(0) + '%</b></span></div>'; }

  // what changes if this item replaces the one worn in the same slot
  function compareTo(it){
    const cur = P.eq[slotOf(it)]; const st = x => { const o = {}; if(!x) return o; const pm = 1 + (x.plus || 0)*.1; if(x.atk) o.atk = Math.round(x.atk*pm); if(x.def) o.def = Math.round(x.def*pm); Object.entries(x.bonus || {}).forEach(([k, v]) => o[k] = (o[k] || 0) + v); return o; };
    const a = st(it), b = st(cur); const keys = [...new Set(Object.keys(a).concat(Object.keys(b)))];
    const N = Object.assign({ atk: 'Атака', def: 'Захист' }, RPG.BONUS_N);
    const rows = keys.map(k => { const d = (a[k] || 0) - (b[k] || 0); if(!d) return ''; return '<span style="color:' + (d > 0 ? '#7ae07a' : '#ff7a6a') + ';margin-right:10px;white-space:nowrap">' + (d > 0 ? '▲ +' : '▼ ') + d + ' ' + (N[k] || k) + '</span>'; }).join('');
    return '<div style="font-size:12.5px;margin:6px 0;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.06)">' + (cur ? 'Порівняно з «' + esc(RPG.itemName(cur)) + '»: ' : 'Слот порожній: ') + (rows || '<span style="opacity:.7">без змін</span>') + '</div>';
  }
  function inventory(mode){
    mode = mode || 'bag'; let sel = null;
    const render = () => {
      let h = statsBlock() + '<div class="rp-eq">' + RPG.SLOTS.map(([k, n]) => { const it = P.eq[k]; return '<div data-slot="' + k + '" style="border-color:' + (it ? RPG.itemColor(it) : 'rgba(255,255,255,.15)') + '"><em>' + n + '</em>' + (it ? '<i>' + it.i + '</i>' + esc(RPG.itemName(it)) : '<span style="opacity:.4">—</span>') + '</div>'; }).join('') + '</div>';
      if(sel){ const it = sel.it; h += '<div class="rp-detail"><h4 style="color:' + RPG.itemColor(it) + '">' + RPG.itemIcon(it) + ' ' + esc(RPG.itemName(it)) + (it.q > 1 ? ' ×' + it.q : '') + '</h4>' + itemStats(it) + (!sel.slot && it.k !== 'mat' && it.k !== 'use' && canEquip(it) ? compareTo(it) : '') + '<div class="rp-row">' +
        (sel.slot ? '<button class="gm-btn" data-a="unequip">Зняти</button>' : '') +
        (!sel.slot && it.k !== 'mat' && it.k !== 'use' && canEquip(it) ? '<button class="gm-btn primary" data-a="equip">Одягнути</button>' : '') +
        (it.k === 'use' ? '<button class="gm-btn primary" data-a="use">Використати</button>' : '') +
        (mode === 'sell' && !sel.slot ? '<button class="gm-btn primary" data-a="sell">Продати за ' + RPG.itemValue(it) + ' 💰</button>' : '') +
        (!sel.slot && mode !== 'sell' ? '<button class="gm-btn ghost" data-a="drop">Викинути</button>' : '') + '</div></div>'; }
      h += '<p style="margin:0;font-size:12px;opacity:.7">Рюкзак ' + P.inv.length + '/40 · торкніться предмета</p><div class="rp-grid">' + P.inv.map((it, i) => '<div class="rp-tile' + (sel && sel.it === it ? ' sel' : '') + '" data-i="' + i + '" style="border-color:' + RPG.itemColor(it) + '">' + RPG.itemIcon(it) + (it.q > 1 ? '<small>' + it.q + '</small>' : '') + (it.plus ? '<span class="pl">+' + it.plus + '</span>' : '') + '</div>').join('') + '</div>';
      sheet({ title: mode === 'sell' ? 'Продаж · Крамниця' : 'Рюкзак і спорядження', html: h, buttons: [{ label: 'Закрити', fn: hide }], after: s => {
        s.querySelectorAll('[data-i]').forEach(t => t.onclick = () => { sel = { it: P.inv[+t.dataset.i] }; render(); });
        s.querySelectorAll('[data-slot]').forEach(t => t.onclick = () => { const it = P.eq[t.dataset.slot]; sel = it ? { it, slot: t.dataset.slot } : null; render(); });
        s.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
          const a = b.dataset.a, it = sel.it;
          if(a === 'equip'){ const sl = slotOf(it); const old = P.eq[sl]; P.eq[sl] = it; P.inv.splice(P.inv.indexOf(it), 1); if(old) P.inv.push(old); toast('Одягнено: ' + RPG.itemName(it)); sel = null; o.onGear(); }
          else if(a === 'unequip'){ if(P.inv.length >= 40){ toast('Рюкзак переповнений'); return; } P.inv.push(it); P.eq[sel.slot] = null; sel = null; o.onGear(); }
          else if(a === 'use'){ o.combat().consume(it); if(!P.inv.includes(it)) sel = null; }
          else if(a === 'sell'){ const v = RPG.itemValue(it); P.gold += v; P.inv.splice(P.inv.indexOf(it), 1); toast('Продано за ' + v + ' 💰'); sel = null; }
          else if(a === 'drop'){ P.inv.splice(P.inv.indexOf(it), 1); sel = null; }
          RPG.save(); updHud(); render();
        });
      } });
    };
    render();
  }

  function shop(){
    let tab = 'buy';
    const maxTier = Math.min(4, Math.floor(P.rank*.7));
    const render = () => {
      if(tab === 'sell'){ inventory('sell'); return; }
      const C = RPG.CLASSES[P.cls];
      const goods = [];
      ['hp1', 'hp2', 'hp3', 'mp1', 'mp2', 'elixir'].forEach(id => goods.push({ type: 'use', id, n: RPG.CONSUMABLES[id].n, i: RPG.CONSUMABLES[id].i, price: RPG.CONSUMABLES[id].price, sparks: RPG.CONSUMABLES[id].sparks }));
      for(let t = 0; t <= maxTier; t++){ goods.push({ type: 'eq', kind: C.wpn, t, n: RPG.WEAPONS[C.wpn].tiers[t], i: RPG.WEAPONS[C.wpn].i }); ['armor', 'helm'].concat(C.off ? ['shield'] : []).forEach(k => goods.push({ type: 'eq', kind: k, t, n: RPG.ARMORS[k].tiers[t], i: RPG.ARMORS[k].i })); }
      goods.forEach(g => { if(g.type === 'eq') g.price = Math.round((25 + g.t*55)*(1 + g.t*.6)); });
      const S = saveGet();
      const h = '<div class="rp-tabs"><button class="on">Купити</button><button data-t="sell">Продати</button></div><p style="font-size:12px;opacity:.75;margin:0 0 6px">У вас: 💰 ' + P.gold + ' · ✦ ' + (S.sparks || 0) + '. Кращі товари відкриваються з вищим рангом.</p><div class="rp-shop">' + goods.map((g, i) => '<div><i>' + g.i + '</i><span>' + esc(g.n) + '</span><button data-b="' + i + '"' + ((g.sparks ? (S.sparks || 0) < g.sparks : P.gold < g.price) ? ' disabled' : '') + '>' + (g.sparks ? g.sparks + ' ✦' : g.price + ' 💰') + '</button></div>').join('') + '</div>';
      sheet({ title: 'Крамниця Ореста', html: h, buttons: [{ label: 'Закрити', fn: hide }], after: s => {
        s.querySelector('[data-t]').onclick = () => { tab = 'sell'; render(); };
        s.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const g = goods[+b.dataset.b];
          if(g.sparks){ if((S.sparks || 0) < g.sparks) return; S.sparks -= g.sparks; saveCommit(); } else { if(P.gold < g.price) return; P.gold -= g.price; }
          const it = g.type === 'use' ? { k: 'use', id: g.id, q: 1 } : RPG.makeEquip(g.kind, g.t, 0);
          if(!RPG.addItem(P, it)){ toast('Рюкзак переповнений'); return; }
          toast('Куплено: ' + g.i + ' ' + g.n); RPG.save(); updHud(); render(); });
      } });
    };
    render();
  }

  const MAT_BY_TIER = ['jelly', 'ear', 'tusk', 'bone', 'soul'];
  function forge(){
    let sel = null;
    const render = () => {
      const items = Object.entries(P.eq).filter(([k, v]) => v).map(([k, v]) => ({ it: v, slot: k })).concat(P.inv.filter(x => x.k !== 'mat' && x.k !== 'use').map(it => ({ it })));
      let h = '<p>Коваль Назар заточує спорядження. Кожне «+» дає +10% атаки чи захисту. Після +4 можлива невдача: матеріали згорять, а предмет лишиться цілим.</p><div class="rp-grid">' + items.map((x, i) => '<div class="rp-tile' + (sel && sel.it === x.it ? ' sel' : '') + '" data-i="' + i + '" style="border-color:' + RPG.itemColor(x.it) + '">' + x.it.i + (x.it.plus ? '<span class="pl">+' + x.it.plus + '</span>' : '') + (x.slot ? '<small>✓</small>' : '') + '</div>').join('') + '</div>';
      let cost = null;
      if(sel){ const it = sel.it; const p = it.plus || 0; const mat = MAT_BY_TIER[Math.min(4, it.tier + Math.floor(p/4))]; cost = { gold: Math.round((30 + it.tier*45)*(p + 1)*(1 + p*.2)), mat, q: 1 + Math.floor(p/2), ch: p < 4 ? 1 : [0, 0, 0, 0, .85, .7, .55, .4, .3, .2][p] || .15 };
        h += '<div class="rp-detail"><h4 style="color:' + RPG.itemColor(it) + '">' + it.i + ' ' + esc(RPG.itemName(it)) + '</h4>' + itemStats(it) + (p >= 10 ? '<p>Максимальна заточка.</p>' : '<div style="margin-top:6px">Ціна: <b>' + cost.gold + ' 💰</b> + ' + RPG.MATERIALS[cost.mat].i + ' ' + RPG.MATERIALS[cost.mat].n + ' ×' + cost.q + ' (є ' + RPG.countItem(P, cost.mat) + ') · шанс ' + Math.round(cost.ch*100) + '%</div><div class="rp-row"><button class="gm-btn primary" data-up="1">Заточити до +' + (p + 1) + '</button></div>') + '</div>'; }
      sheet({ title: 'Кузня Назара', html: h, buttons: [{ label: 'Закрити', fn: hide }], after: s => {
        s.querySelectorAll('[data-i]').forEach(t => t.onclick = () => { sel = items[+t.dataset.i]; render(); });
        const up = s.querySelector('[data-up]'); if(up) up.onclick = () => {
          if(P.gold < cost.gold){ toast('Не вистачає золота'); return; } if(RPG.countItem(P, cost.mat) < cost.q){ toast('Не вистачає: ' + RPG.MATERIALS[cost.mat].n); return; }
          P.gold -= cost.gold; RPG.takeItem(P, cost.mat, cost.q);
          if(Math.random() < cost.ch){ sel.it.plus = (sel.it.plus || 0) + 1; toast('🔨 Успіх! ' + RPG.itemName(sel.it), 'big'); o.onGear(); } else toast('💨 Невдача. Метал не прийняв гарт.');
          RPG.save(); updHud(); render(); };
      } });
    };
    render();
  }

  function card(){
    const R = RPG.rankOf(P.rank), N = RPG.RANKS[P.rank + 1]; const C = RPG.CLASSES[P.cls];
    const kills = Object.values(P.kills || {}).reduce((a, b) => a + b, 0);
    const prog = N ? Math.min(1, (P.gp - R.gp)/(N.gp - R.gp)) : 1;
    const bosses = Object.keys(P.bosses || {}).map(k => RPG.MONSTERS[k].n);
    return '<div class="rp-card"><div class="hd"><span>Гільдія авантюристів</span><span>№ ' + P.id + '</span></div><div class="nm">' + esc(o.heroName()) + '</div><div class="cl">' + C.i + ' ' + C.n + ' · рівень ' + P.lvl + '</div><div style="font-size:12px;margin-top:4px;opacity:.8">Ранг ' + R.r + ' — ' + R.n + '</div>' +
      '<div class="rk" style="background:linear-gradient(160deg,' + R.c1 + ',' + R.c2 + ')">' + R.r + '</div>' +
      '<div class="ft"><span>Очки гільдії<b>' + P.gp + (N ? ' / ' + N.gp : '') + '</b></span><span>Перемог<b>' + kills + '</b></span><span>Завдань<b>' + Object.values(P.done || {}).reduce((a, b) => a + b, 0) + '</b></span></div>' +
      '<div class="gp"><i style="width:' + (prog*100).toFixed(0) + '%"></i></div>' + (N ? '<div style="font-size:10.5px;margin-top:5px;opacity:.75">До рангу ' + N.r + ': ' + Math.max(0, N.gp - P.gp) + ' очок і рівень ' + N.lvl + '</div>' : '<div style="font-size:11px;margin-top:5px">Найвищий ранг досягнуто</div>') +
      (bosses.length ? '<div style="font-size:10.5px;margin-top:6px">Повалені боси: ' + bosses.join(', ') + '</div>' : '') + '</div>';
  }
  function showCard(){ sheet({ title: 'Картка авантюриста', html: card(), buttons: [{ label: 'Закрити', fn: hide }] }); }

  function questBoard(){
    const avail = RPG.QUEST_POOL.filter(q => !q.giver && q.rank <= P.rank && !P.quests.some(a => a.id === q.id));
    const active = P.quests.map(a => ({ a, Q: RPG.QUEST_POOL.find(q => q.id === a.id) })).filter(x => x.Q && !x.Q.giver);
    const prog = x => x.Q.type === 'collect' ? Math.min(RPG.countItem(P, x.Q.item), x.Q.need) : Math.min(x.a.prog, x.Q.need);
    let h = '<p>Активні завдання: ' + active.length + '/3. Виконані здавайте у Гільдії.</p>';
    h += active.map((x, i) => '<div class="rp-q"><b>' + esc(x.Q.n) + '</b> · ' + prog(x) + '/' + x.Q.need + '<div>' + esc(x.Q.d) + '</div><div class="rw">Нагорода: ' + x.Q.gold + ' 💰 · ' + x.Q.xp + ' XP · ' + x.Q.gp + ' 🏅</div><button class="gm-btn ghost" data-ab="' + i + '">Відмовитися</button></div>').join('');
    h += '<h4 style="margin:12px 0 6px;font-family:Georgia,serif">Доступні</h4>' + (avail.length ? avail.map((q, i) => '<div class="rp-q"><b>' + esc(q.n) + '</b> <span style="opacity:.6;font-size:11px">ранг ' + RPG.RANKS[q.rank].r + '</span><div>' + esc(q.d) + ' (' + (q.type === 'kill' ? 'перемогти ' : 'зібрати ') + q.need + ')</div><div class="rw">' + q.gold + ' 💰 · ' + q.xp + ' XP · ' + q.gp + ' 🏅</div><button class="gm-btn primary" data-ac="' + i + '"' + (active.length >= 3 ? ' disabled' : '') + '>Взяти</button></div>').join('') : '<p>Нових завдань для вашого рангу поки немає.</p>');
    sheet({ title: 'Дошка завдань', html: h, buttons: [{ label: 'Закрити', fn: hide }], after: s => {
      s.querySelectorAll('[data-ac]').forEach(b => b.onclick = () => { if(P.quests.filter(a => { const Q = RPG.QUEST_POOL.find(q => q.id === a.id); return Q && !Q.giver; }).length >= 3) return; P.quests.push({ id: avail[+b.dataset.ac].id, prog: 0 }); RPG.save(); toast('📜 Завдання прийнято'); questBoard(); });
      s.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => { P.quests.splice(+b.dataset.ab, 1); RPG.save(); questBoard(); });
    } });
  }
  function turnIn(giver){
    let n = 0;
    P.quests = P.quests.filter(a => { const Q = RPG.QUEST_POOL.find(q => q.id === a.id); if(!Q) return false;
      if((Q.giver || null) !== (giver || null)) return true;
      const ok = RPG.questDone(P, a, Q);
      if(!ok) return true;
      if(Q.type === 'collect') RPG.takeItem(P, Q.item, Q.need);
      P.gold += Q.gold; P.gp += Q.gp; P.done[Q.id] = (P.done[Q.id] || 0) + 1; o.combat().gainXp ? o.combat().gainXp(Q.xp) : (P.xp += Q.xp); n++;
      toast('✅ «' + Q.n + '»: +' + Q.gold + ' 💰, +' + Q.xp + ' XP, +' + Q.gp + ' 🏅', 'loot'); return false; });
    RPG.save(); updHud(); return n;
  }
  // side quests offered and taken back by people around the world
  function npcQuests(npcId, npcName, line){
    const mine = RPG.QUEST_POOL.filter(q => q.giver === npcId);
    const act = P.quests.map(a => ({ a, Q: RPG.QUEST_POOL.find(q => q.id === a.id) })).filter(x => x.Q && x.Q.giver === npcId);
    const sideN = P.quests.filter(a => { const Q = RPG.QUEST_POOL.find(q => q.id === a.id); return Q && Q.giver; }).length;
    const avail = mine.filter(q => !P.quests.some(a => a.id === q.id) && !P.done[q.id]);
    const ready = act.filter(x => RPG.questDone(P, x.a, x.Q));
    const pr = x => x.Q.type === 'collect' ? Math.min(RPG.countItem(P, x.Q.item), x.Q.need) : Math.min(x.a.prog, x.Q.need);
    let h = '<p class="gm-quote">«' + esc(line || 'Маєте хвилинку, авантюристе?') + '»</p>';
    if(act.length) h += act.map(x => '<div class="rp-q"><b>' + esc(x.Q.n) + '</b> · ' + pr(x) + '/' + x.Q.need + '<div>' + esc(x.Q.d) + '</div></div>').join('');
    if(avail.length) h += '<h4 style="margin:12px 0 6px;font-family:Georgia,serif">Прохання</h4>' + avail.map((q, i) => '<div class="rp-q"><b>' + esc(q.n) + '</b><div>' + esc(q.d) + '</div><div class="rw">' + q.gold + ' 💰 · ' + q.xp + ' XP · ' + q.gp + ' 🏅</div><button class="gm-btn primary" data-sq="' + i + '"' + (sideN >= 4 ? ' disabled' : '') + '>Взятися</button></div>').join('');
    if(!act.length && !avail.length) h += '<p>Поки що нічого не треба. Дякую, що зайшли!</p>';
    if(sideN >= 4 && avail.length) h += '<p class="gm-note">Можна мати до 4 доручень від людей одночасно.</p>';
    const btns = [];
    if(ready.length) btns.push({ label: '✅ Здати (' + ready.length + ')', primary: true, fn: () => { turnIn(npcId); npcQuests(npcId, npcName, 'Дякую! Ось ваша нагорода.'); } });
    btns.push({ label: 'Бувайте', ghost: true, fn: hide });
    sheet({ title: npcName, html: h, buttons: btns, after: el => el.querySelectorAll('[data-sq]').forEach(b => b.onclick = () => { if(sideN >= 4) return; P.quests.push({ id: avail[+b.dataset.sq].id, prog: 0 }); RPG.save(); toast('📜 Доручення прийнято'); npcQuests(npcId, npcName); }) });
  }
  function guild(){
    if(!P.reg) return register();
    const ready = P.quests.filter(a => { const Q = RPG.QUEST_POOL.find(q => q.id === a.id); return Q && !Q.giver && RPG.questDone(P, a, Q); }).length;
    const N = RPG.RANKS[P.rank + 1]; const canRank = N && P.gp >= N.gp && P.lvl >= N.lvl;
    sheet({ title: 'Гільдія авантюристів', html: '<p class="gm-quote">«Вітаю, ' + esc(o.heroName()) + '! Чим Гільдія може допомогти?»</p><p style="font-size:12px;opacity:.75">Реєстраторка Леся гортає журнал завдань.</p>' + card(), buttons: [
      { label: '📜 Дошка завдань', primary: !ready, fn: questBoard },
      { label: '✅ Здати завдання' + (ready ? ' (' + ready + ')' : ''), primary: !!ready, fn: () => { const n = turnIn(); if(!n) toast('Немає виконаних завдань'); guild(); } },
      canRank ? { label: '🏅 Іспит на ранг ' + N.r, primary: true, fn: () => rankUp() } : { label: N ? '🏅 Ранг ' + N.r + ': потрібно ' + N.gp + ' очок і рівень ' + N.lvl : '🏅 Найвищий ранг', fn: () => {} },
      { label: '🔁 Змінити клас (100 💰)', fn: () => register(true) },
      { label: 'Закрити', ghost: true, fn: hide }] });
  }
  function rankUp(){
    P.rank++; const R = RPG.rankOf(P.rank); RPG.save(); updHud(); o.onRank && o.onRank(R);
    sheet({ title: 'Новий ранг: ' + R.r, html: '<p class="gm-quote">«Гільдія визнає вашу силу. Відтепер ви — ' + R.n + ' рангу ' + R.r + '!»</p>' + card() + '<p class="gm-note">Відкрито нові завдання й товари в крамниці.</p>', buttons: [{ label: 'Дякую!', primary: true, fn: guild }] });
  }
  function register(change){
    let pick = P.cls || 'warrior'; let nameDraft = saveGet().heroName || '';
    const render = () => {
      const C = RPG.CLASSES[pick];
      const h = (change ? '<p>Зміна класу коштує 100 💰. Рівень, ранг і речі зберігаються.</p>' : '<p class="gm-quote">«Ласкаво просимо до Гільдії авантюристів! Заповніть картку й оберіть свій шлях.»</p><p style="font-size:12px;opacity:.8">Ви щойно опинилися в цьому світі. Гільдія видасть картку рангу F, стартову зброю та зілля.</p>') +
        '<div class="rp-cls">' + RPG.CLASS_ORDER.map(k => { const c = RPG.CLASSES[k]; return '<button data-c="' + k + '"' + (k === pick ? ' class="on"' : '') + '><i>' + c.i + '</i><b>' + c.n + '</b><small>' + esc(c.d) + '</small></button>'; }).join('') + '</div>' +
        (change ? '' : '<label style="display:block;font-size:12px;opacity:.85;margin:4px 0 4px" for="rp-name">Ім\'я авантюриста (його бачитимуть інші гравці)</label><input id="rp-name" maxlength="20" autocomplete="off" style="width:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(255,230,180,.3);background:rgba(255,255,255,.06);color:#fff;padding:9px 11px;font:14px inherit;margin-bottom:10px" value="' + esc(nameDraft) + '" placeholder="Напр.: Ярослав">') +
        '<div class="rp-detail"><h4>' + C.i + ' ' + C.n + '</h4><div style="font-size:12px">Сила ' + C.base.str + ' · Спритність ' + C.base.agi + ' · Інтелект ' + C.base.int + ' · Живучість ' + C.base.vit + '</div><div style="margin-top:6px">' + C.skills.map(s => s.i + ' ' + s.n).join(' &nbsp;·&nbsp; ') + '</div></div>';
      sheet({ title: change ? 'Зміна класу' : 'Реєстрація авантюриста', html: h, buttons: [{ label: change ? 'Змінити на «' + C.n + '»' : 'Зареєструватися як «' + C.n + '»', primary: true, fn: () => {
          if(change){ if(P.gold < 100){ toast('Не вистачає золота'); return; } P.gold -= 100; P.cls = pick; const old = P.eq.weapon; if(old && !RPG.WEAPONS[old.w].cls.includes(pick)){ P.inv.push(old); P.eq.weapon = null; } if(P.eq.shield && !RPG.CLASSES[pick].off){ P.inv.push(P.eq.shield); P.eq.shield = null; } if(!P.eq.weapon) P.eq.weapon = RPG.makeEquip(RPG.CLASSES[pick].wpn, 0, 0); }
          else { const nm = (nameDraft || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20); if(!nm){ toast('Впишіть ім\'я авантюриста'); return; } const S0 = saveGet(); S0.heroName = nm; saveCommit(); P.reg = true; P.cls = pick; P.eq = { weapon: RPG.makeEquip(C.wpn, 0, 0), armor: RPG.makeEquip('armor', 0, 0) }; if(C.off) P.eq.shield = RPG.makeEquip('shield', 0, 0); RPG.addItem(P, { k: 'use', id: 'hp1', q: 4 }); RPG.addItem(P, { k: 'use', id: 'mp1', q: 3 }); }
          RPG.saveNow(); buildActions(); o.onClass(); updHud();
          sheet({ title: change ? 'Клас змінено' : 'Картку видано!', html: card() + (change ? '' : '<p>Візьміть перше завдання на дошці й вирушайте за Браму Випробувань — на південь від площі. Слизи на лузі якраз для новачків.</p>'), buttons: [{ label: '📜 До дошки завдань', primary: true, fn: questBoard }, { label: 'Закрити', ghost: true, fn: hide }] });
        } }, { label: 'Закрити', ghost: true, fn: hide }], after: s => { s.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { pick = b.dataset.c; render(); }); const ni = s.querySelector('#rp-name'); if(ni){ ni.oninput = () => { nameDraft = ni.value; }; ni.onkeydown = e => e.stopPropagation(); } } });
    };
    render();
  }
  function tavern(){
    const rumors = ['Кажуть, Король слизів носить справжню золоту корону.', 'Ватажок гоблінів б\'ється щитом — заходьте збоку.', 'Вождь орків лютує, коли поранений. Тримайте зілля напоготові.', 'Лич підіймає мертвих. Спершу розберіться зі скелетами.', 'Клірики й паладини б\'ють нежить світлом — удвічі болючіше.', 'Руна дня з Кола Рун справді діє в боях.', 'Покровитель із Пантеону додає +3 до вашої головної характеристики.', 'У Підземеллі Авантюристів три яруси. На дні — Мінотавр, і його скриня повна золота.', 'Мінотавр перед ривком рие копитом. Побачите червону смугу — відходьте вбік!', 'Червоне коло під босом — тікайте з нього, поки не вдарило.', 'Кістяний лицар Морен підіймає скелетів. Розберіться спершу з ними.'];
    sheet({ title: 'Таверна «Лимонний Дракон»', html: '<p>Тепло, пахне смаженим м\'ясом і медовухою. Тут можна перепочити й почути чутки.</p><p class="gm-quote">«' + rumors[Math.floor(Math.random()*rumors.length)] + '»</p>', buttons: [
      { label: '🛏️ Відпочити (10 💰) — повне відновлення', primary: true, fn: () => { if(P.gold < 10){ toast('Не вистачає золота'); return; } P.gold -= 10; o.combat().fullHeal(); RPG.save(); toast('Ви відпочили. Сили повернулися.'); hide(); } },
      { label: '🍺 Ще одна чутка', fn: tavern }, { label: 'Закрити', ghost: true, fn: hide }] });
  }
  function gate(){
    const D = { meadow: 'Слизи й Король слизів. Перше полювання — на південь від брами.', grove: 'Гобліни, шамани та їхній ватажок. Південний захід.', camp: 'Орки за частоколом і Вождь орків. Південний схід.', ruins: 'Скелети, лучники та Лич. Далеко на півдні.',
      heath: 'Вовкулаки й Вожак Сіре Ікло. Північний захід.', lake: 'Утопці, русалки й Водяник на острові. Захід, брід зі сходу.', darkwood: 'Розбійники й Отаман Чорний Ворон. Схід.', swamp: 'Ящери-болотяники, слизи й відьма Мара. Далекий південний захід.',
      mines: 'Кам\'яні стражі, привиди й Гранітний Колос. Далека північ.', farm: 'Хутір Вербівка: фермер Петро просить допомоги.', shrine: 'Святилище Велеса: волхв Велимир дає доручення.',
      fishing: 'Людське рибальське село на північному березі озера. Рибачка Ганна купує трофеї.',
      sun: 'Столиця королівства за східним перевалом: собор, замок, Гільдія, базар і кузня гнома Торіна. Герольд роздає королівські доручення.',
      elves: 'Ельфійська Гавань серед велетенських дубів за західним перевалом. Місячна Криниця й старійшина Ельнара.',
      dwarves: 'Гномська твердиня під горою на крайній півночі. Тан Бруні, кузня Дваліна й руда.',
      beasts: 'Село звіролюдей за південним перевалом: круглі хати, тотеми й вождь Грімо.',
      titan: '☠ Гірський Титан Ірмунд і його кам\'яна варта. Не нападають, поки їх не зачепити. Зачепите одного — прийдуть усі.',
      fenrir: '☠ Фенрір, Пожирач Місяця, і зграя місячних вовкулак. Спокійні, поки ви спокійні.',
      slimes: '☠ Праматір Слизів із королівськими слизами. Сплять у драговині — краще не будити.' };
    const list = ZONES.map(Z => '<div class="rp-q"><b>' + Z.n + '</b> <span style="opacity:.6;font-size:11px">' + (Z.safe ? 'безпечно' : Z.calamity ? Z.rank : 'ранг ' + Z.rank) + '</span><div style="font-size:12px">' + (D[Z.id] || '') + '</div></div>').join('');
    const dl = '<div class="rp-q"><b>Підземелля Авантюристів</b> <span style="opacity:.6;font-size:11px">ранг D–A</span><div style="font-size:12px">Вхід — на захід від Лугу слизів. Три яруси: печери, склепи й лігво Мінотавра.</div></div>';
    sheet({ title: 'Брама Випробувань', html: '<p>Чотири брами ведуть у великий світ, а за гірськими перевалами — столиця, поселення ельфів, гномів і звіролюдей та землі трьох Катастроф. Вартові пропускають зареєстрованих авантюристів. Монстри не заходять за мури, а в місті здоров\'я відновлюється швидко.</p>' + list + dl, buttons: [
      P.reg ? { label: '⚔️ Вийти в Дикі землі', primary: true, fn: () => { hide(); o.goWild(); } } : { label: 'Спершу зареєструйтеся в Гільдії', primary: true, fn: () => { hide(); o.goGuild(); } },
      { label: 'Залишитися в місті', ghost: true, fn: hide }] });
  }
  function death(src, lost, done){
    sheet({ title: 'Ви знепритомніли', html: '<p>' + esc(src || 'Монстр') + ' виявився сильнішим. Вартові принесли вас до Гільдії, а цілителі поставили на ноги.</p><p class="gm-note">Втрачено ' + lost + ' 💰. Порада: беріть більше зілля в Крамниці й заточуйте спорядження в Кузні.</p>', buttons: [{ label: 'Повернутися до справ', primary: true, fn: () => { hide(); done(); } }] });
  }

  return { npcQuests, hud: updHud, target: setTarget, float, toast, hurt, frame, inventory, shop, forge, guild, questBoard, showCard, tavern, gate, death, register, buildActions, zoneBanner };
}

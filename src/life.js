// =====================================================================================
//  Living world: party play, dodge roll & block, jump, swimming, horse riding, fishing,
//  gathering & crafting, settlement shops, reputation, daily errands, world events
//  (Blood Moon, raid on the farm), weather, bestiary & achievements, NPC dialogues with
//  choices, a first-minutes tutorial, settings, music themes and enterable interiors.
//  main.js calls a handful of hooks; everything else lives here.
// =====================================================================================
import CREDITS from './credits.json';
import * as THREE from 'three';
import * as RPG from './rpg.js';
import * as F from './figures.js';
import { softSprite } from './assets.js';
import { heightAt, waterLevel, deepWater, zoneAt, ZONES, CITY2, inWild, OPT } from './world.js';
import { sfx, extraSfx, setVolumes, volumes, rain as rainSound, setMusic, musicTick } from './audio.js';
import { get as saveGet, commit as saveCommit } from './save.js';
import { LIFE_MATS, FISH, NODE_KINDS, NODE_ZONES, RECIPES, FACTIONS, REP_TIERS, SHOPS, ACHIEVEMENTS, DAILY_POOL, DIALOGS } from './life_data.js';
import { buildInterior, INTERIORS } from './interiors.js';
import './newmodels.js';   // registers the downloaded bodies (horse, etc.)
import { rosterSpawns, STATUES as STATUES0, ROSTER_ON } from './roster.js';
const STATUES = ROSTER_ON ? STATUES0 : [];

Object.assign(RPG.MATERIALS, LIFE_MATS);
const FISH_IDS = new Set(FISH.map(f => f[0]));
const hash = s => { let h = 2166136261; s = String(s); for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const lsGet = (k, d) => { try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } };
const lsSet = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };

const CSS = `
.lf-acts{position:absolute;right:calc(max(12px,env(safe-area-inset-right,0px)) + 56px);bottom:calc(env(safe-area-inset-bottom,0px) + 190px);display:flex;flex-direction:column;gap:7px;z-index:3;zoom:var(--uiz,1)}
.lf-acts .gm-btn{width:46px;height:46px;padding:0;display:flex;align-items:center;justify-content:center;font-size:20px;position:relative}
.lf-acts .gm-btn small{position:absolute;bottom:1px;right:3px;font-size:9px;opacity:.7}
.lf-acts .gm-btn.on{background:#e6a23c;color:#1a1208}
.lf-acts .gm-btn.cd{opacity:.45}
.lf-tut{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 62px);transform:translateX(-50%);max-width:min(440px,calc(100vw - 32px));background:rgba(20,16,10,.88);color:#f6e8c8;border:1px solid rgba(230,162,60,.6);border-radius:12px;padding:10px 14px;font-size:14px;line-height:1.4;z-index:4;display:flex;gap:10px;align-items:flex-start;zoom:var(--uiz,1)}
.lf-tut b{color:#ffcf6a}.lf-tut button{background:none;border:0;color:#f6e8c8;opacity:.6;font-size:12px;cursor:pointer;white-space:nowrap}
.lf-ev{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 30px);transform:translateX(-50%);font-size:12px;padding:4px 10px;border-radius:20px;background:rgba(80,10,10,.75);color:#ffd8c8;z-index:3;pointer-events:none;white-space:nowrap;zoom:var(--uiz,1)}
.lf-arrow{position:absolute;width:0;height:0;z-index:3;pointer-events:none;font-size:12px;color:#bfe9ff;text-shadow:0 1px 2px #000}
.lf-arrow i{position:absolute;left:-11px;top:-11px;width:22px;height:22px;display:block;background:conic-gradient(from 0deg at 50% 50%,transparent 0 0);}
.lf-arrow span{position:absolute;left:14px;top:-8px;white-space:nowrap}
.lf-fish{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);transform:translateX(-50%);z-index:4;text-align:center;color:#fff;text-shadow:0 1px 3px #000;font-size:15px}
.lf-fish button{font-size:22px;padding:12px 26px;border-radius:14px;margin-top:6px}
.lf-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.lf-tabs .gm-btn{width:auto!important;flex:1 1 auto;min-width:0;padding:6px 9px!important;font-size:12.5px!important;margin:0!important}
.lf-row{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.lf-row small{opacity:.65}.lf-bar{height:6px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:4px}.lf-bar i{display:block;height:100%;background:#e6a23c}
.lf-dlg p{font-size:15px;line-height:1.45}.lf-dlg .gm-btn{display:block;width:100%;text-align:left;margin:6px 0}
.lf-set label{display:block;margin:12px 0 4px;font-size:13px;opacity:.8}.lf-set input{width:100%}
.lf-ping{position:absolute;z-index:3;pointer-events:none;color:#7ad8ff;font-weight:700;text-shadow:0 1px 3px #000;font-size:13px;white-space:nowrap}
.gm-side,.rp-hud,.rp-actions,.gm-bar,.gm-net,.rp-target,.gm-chatlog,.rp-toast{zoom:var(--uiz,1)}
.gm-sheet{zoom:var(--uiz,1)}
.gm-side{max-height:calc(100% - 230px);overflow-y:auto;overflow-x:hidden;scrollbar-width:none}
`;

export function createLife(A){
  const { root, scene, P, ui } = A;
  if(!document.getElementById('lf-css')){ const st = document.createElement('style'); st.id = 'lf-css'; st.textContent = CSS; document.head.appendChild(st); }
  // ---------- persistent state (in the RPG save) ----------
  const L = P.life = Object.assign({ fish: 0, herbs: 0, ores: 0, crafted: 0, rolls: 0, blocks: 0, perfect: 0, rep: { elves: 0, dwarves: 0, beasts: 0 }, ach: {}, daily: null, nodes: {}, tut: 0, rod: 0, visited: {}, talked: {}, seen: {} }, P.life || {});
  L.rep = Object.assign({ elves: 0, dwarves: 0, beasts: 0 }, L.rep);
  const save = () => RPG.save();
  const C = () => A.combat();
  const SET = Object.assign({ cam: 1, ui: 1 }, lsGet('ritm-game-settings', {}));
  const applyUi = () => root.style.setProperty('--uiz', String(SET.ui));
  applyUi();

  // ---------- buttons ----------
  const side = root.querySelector('.gm-side');
  const sideBtn = (icon, title, fn) => { const b = document.createElement('button'); b.className = 'gm-btn'; b.title = title; b.textContent = icon; b.onclick = e => { e.stopPropagation(); fn(); }; side && side.appendChild(b); return b; };
  sideBtn('📖', 'Книга пригод (B)', () => book());
  sideBtn('⚗️', 'Ремесло (C)', () => craftSheet());
  sideBtn('🎚️', 'Налаштування: гучність, камера, розмір інтерфейсу', () => settingsSheet());
  const acts = document.createElement('div'); acts.className = 'lf-acts'; root.appendChild(acts);
  const actBtn = (icon, title, key) => { const b = document.createElement('button'); b.className = 'gm-btn'; b.title = title; b.innerHTML = icon + (key ? '<small>' + key + '</small>' : ''); acts.appendChild(b); return b; };
  const bRoll = actBtn('🤸', 'Перекат (R)', 'R'), bBlock = actBtn('🛡️', 'Блок — утримуйте (F)', 'F'), bJump = actBtn('⤴️', 'Стрибок (пробіл)', '␣');
  const bHorse = actBtn('🐎', 'Кінь (H)', 'H'), bFish = actBtn('🎣', 'Рибалити', ''), bPing = actBtn('📍', 'Позначка «сюди!» для загону (G)', 'G');
  bFish.style.display = 'none'; bPing.style.display = 'none';
  const stop = e => { e.stopPropagation(); e.preventDefault(); };
  bRoll.addEventListener('pointerdown', e => { stop(e); roll(); });
  bJump.addEventListener('pointerdown', e => { stop(e); jump(); });
  bBlock.addEventListener('pointerdown', e => { stop(e); blockHeld.btn = true; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => bBlock.addEventListener(ev, e => { blockHeld.btn = false; }));
  bHorse.addEventListener('pointerdown', e => { stop(e); toggleHorse(); });
  bFish.addEventListener('pointerdown', e => { stop(e); fishing ? fishTap() : startFishing(); });
  bPing.addEventListener('pointerdown', e => { stop(e); ping(); });

  // =====================================================================
  //  movement abilities: roll, block, jump, swim, horse
  // =====================================================================
  const M = { rollT: 0, rollCd: 0, rollDir: 0, iframes: 0, jumpV: 0, jumpY: 0, blockT: 0, swim: false, swimAcc: 0 };
  const blockHeld = { key: false, btn: false };
  const busy = () => { const c = C(); return !c || c.H.dead || interior || fishing; };
  function roll(){
    if(busy() || M.rollCd > 0 || M.jumpY > .05 || horse.on) return;
    const a = A.agent; let dir = a.heading;
    const k = A.keys; let kx = 0, kz = 0;
    if(k.has('KeyW') || k.has('ArrowUp')) kz -= 1; if(k.has('KeyS') || k.has('ArrowDown')) kz += 1; if(k.has('KeyA') || k.has('ArrowLeft')) kx -= 1; if(k.has('KeyD') || k.has('ArrowRight')) kx += 1;
    if(kx || kz){ const c = Math.cos(A.cam.yaw), s = Math.sin(A.cam.yaw); dir = Math.atan2(kx*c + kz*s, -kx*s + kz*c); }
    M.rollT = .45; M.rollCd = 1.1; M.iframes = .38; M.rollDir = dir; a.heading = dir; a.path = []; a.onArrive = null;
    const hi = A.heroInst(); if(hi) hi.oneShot('DodgeF', { speed: 1.5, fade: .06 });
    extraSfx('roll'); L.rolls++; tut('roll');
  }
  function jump(){
    if(busy() || M.jumpY > .05 || M.swim) return;
    M.jumpV = horse.on ? 5.2 : 4.6; extraSfx('jump');
    const hi = A.heroInst(); if(hi && !horse.on) hi.oneShot('Jump', { speed: 1.25, fade: .08 });
  }
  const blocking = () => (blockHeld.key || blockHeld.btn) && !busy() && !M.swim && !horse.on && M.rollT <= 0;
  // damage factor for combat.damageHero: 0 = avoided
  function guard(){
    if(M.iframes > 0){ const p = A.heroObj.position; ui.float('Ухилення!', p.x, p.y + 2.3, p.z, 'xp'); return 0; }
    if(blocking()){
      const perfect = M.blockT < .3;
      if(perfect){ L.perfect++; extraSfx('perfect'); const p = A.heroObj.position; ui.float('Ідеальний блок!', p.x, p.y + 2.3, p.z, 'gold'); C() && C().emit(p.x, p.y + 1.2, p.z, 18, '#bfe9ff', 2.5, .4, .12, 1); return 0; }
      L.blocks++; extraSfx('block'); return .3;
    }
    return 1;
  }

  // ---------- horse ----------
  const horse = { on: false, inst: null, loading: false, dist: 0 };
  async function toggleHorse(){
    if(horse.on){ dismount(); return; }
    if(busy() || M.swim) return;
    const wh = A.town.where(A.agent.x, A.agent.z);
    if(wh === 'town' || wh === 'dungeon'){ ui.toast('Коня можна покликати лише за брамою'); return; }
    if(horse.loading) return; horse.loading = true;
    try{
      if(!horse.inst){ horse.inst = await F.make({ body: 'nm_horse', height: 2.9 }); horse.hold = new THREE.Group(); horse.hold.add(horse.inst.obj);
        horse.inst.update(0, false); horse.inst.obj.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(horse.inst.obj, true); const c = bb.getCenter(new THREE.Vector3()); horse.inst.obj.position.x -= c.x; horse.inst.obj.position.z -= c.z; }
      A.heroObj.add(horse.hold);
      horse.on = true; extraSfx('neigh'); ui.toast('🐎 Верхи! H — зійти з коня');
    }catch(e){ console.warn('horse', e); ui.toast('Кінь не прийшов — модель не завантажилась'); }
    horse.loading = false; bHorse.classList.toggle('on', horse.on);
  }
  function dismount(){ if(!horse.on) return; horse.on = false; if(horse.hold) A.heroObj.remove(horse.hold); const hi = A.heroInst(); if(hi){ hi.obj.position.y = 0; resetLegs(hi); } bHorse.classList.remove('on'); }
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _hq = new THREE.Quaternion(), _ax = new THREE.Vector3(), _fw = new THREE.Vector3();
  function rotW(b, axis, ang){ // rotate a bone about a world-space axis (works for every rig, whatever its bone axes)
    b.parent.getWorldQuaternion(_pq); b.getWorldQuaternion(_bq);
    _rq.setFromAxisAngle(axis, ang).multiply(_bq); b.quaternion.copy(_pq.invert().multiply(_rq)); b.updateMatrixWorld(true);
  }
  function seatPose(hi){
    // hero sits astride: thighs forward and apart, shins down — in world space, so Mixamo and auto-rigged bodies sit too
    hi.obj.updateMatrixWorld(true); hi.obj.getWorldQuaternion(_hq);
    _ax.set(1, 0, 0).applyQuaternion(_hq); _fw.set(0, 0, 1).applyQuaternion(_hq);
    [['Left', 1], ['Right', -1]].forEach(([s, sg]) => {
      const up = F.findBoneOf(hi, s + 'UpLeg'), kn = F.findBoneOf(hi, s + 'Leg');
      if(up){ rotW(up, _ax, -1.35); rotW(up, _fw, sg*.42); }
      if(kn) rotW(kn, _ax, 1.45);
    });
  }
  function resetLegs(){}

  // =====================================================================
  //  fishing
  // =====================================================================
  let fishing = null; let fishEl = null;
  function nearWater(){
    const a = A.agent; if(deepWater(a.x, a.z)) return null;
    for(let r = 1.5; r <= 4.5; r += 1.5) for(let k = 0; k < 12; k++){ const ang = k/12*Math.PI*2, x = a.x + Math.sin(ang)*r, z = a.z + Math.cos(ang)*r; const w = waterLevel(x, z); if(w > -50 && heightAt(x, z) < w - .15) return { x, z, w, ang }; }
    return null;
  }
  function startFishing(){
    if(busy() || horse.on) return; const wpt = nearWater(); if(!wpt){ ui.toast('Підійдіть ближче до води'); return; }
    const a = A.agent; a.path = []; a.heading = wpt.ang;
    const bob = new THREE.Group(); const b1 = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshStandardMaterial({ color: '#e8402a', roughness: .5 })); bob.add(b1);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshStandardMaterial({ color: '#f0f0f0' })); b2.position.y = .07; bob.add(b2);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#ffe08a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(1.2, 1.2, 1); bob.add(glow);
    const fx = a.x + Math.sin(wpt.ang)*(wpt ? Math.min(6, 3.2 + L.rod) : 3.5), fz = a.z + Math.cos(wpt.ang)*Math.min(6, 3.2 + L.rod);
    const wl = waterLevel(fx, fz) > -50 ? waterLevel(fx, fz) : wpt.w;
    bob.position.set(fx, wl, fz); scene.add(bob);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#dddddd', transparent: true, opacity: .6 })); scene.add(line);
    const wait = (3 + Math.random()*7)/(1 + L.rod*.35);
    fishing = { bob, glow, line, t: 0, bite: wait, win: .95 + L.rod*.15, state: 'wait', wl };
    const hi = A.heroInst(); if(hi) hi.oneShot('Throw', { speed: 1, fade: .1, keep: true });
    extraSfx('cast');
    fishEl = document.createElement('div'); fishEl.className = 'lf-fish'; fishEl.innerHTML = 'Чекаємо, поки клюне…<br><button class="gm-btn">🎣 Тягнути</button>'; root.appendChild(fishEl);
    fishEl.querySelector('button').addEventListener('pointerdown', e => { stop(e); fishTap(); });
    bFish.classList.add('on');
  }
  function endFishing(){ if(!fishing) return; scene.remove(fishing.bob); scene.remove(fishing.line); fishing = null; if(fishEl){ fishEl.remove(); fishEl = null; } bFish.classList.remove('on'); const hi = A.heroInst(); if(hi) hi.play('Idle', { fade: .2, restart: true }); }
  function fishTap(){
    if(!fishing) return;
    if(fishing.state !== 'bite'){ ui.toast('Зарано — риба ще не клюнула'); endFishing(); return; }
    // catch!
    const night = A.sky.state.lampLevel > .5, wet = W.rain > .4;
    const pool = FISH.filter(f => !f[2] || (f[2] === 'night' && night) || (f[2] === 'rare'));
    let tot = 0; const wts = pool.map(f => { let w = f[1]; if(f[0] === 'goldfish') w *= (wet ? 4 : 1)*(1 + L.rod*.5); if(f[0] === 'pike') w *= 1 + L.rod*.6; if(f[0] === 'boot') w /= 1 + L.rod; tot += w; return w; });
    let r = Math.random()*tot, id = pool[0][0]; for(let i = 0; i < pool.length; i++){ r -= wts[i]; if(r <= 0){ id = pool[i][0]; break; } }
    const it = { k: 'mat', id, q: 1 };
    if(!RPG.addItem(P, it)){ ui.toast('Рюкзак переповнений'); endFishing(); return; }
    if(id !== 'boot'){ L.fish++; if(id === 'goldfish'){ L.goldfish = (L.goldfish || 0) + 1; ui.toast('✨ ЗОЛОТА РИБКА! Кажуть, вона виконує бажання…', 'big'); } }
    const p = fishing.bob.position; ui.float(RPG.MATERIALS[id].i + ' ' + RPG.MATERIALS[id].n, p.x, p.y + 1, p.z, 'gold');
    C() && C().emit(p.x, p.y + .1, p.z, 22, '#bfe9ff', 2, .7, .1, 2.2); extraSfx('splash'); sfx('coin');
    daily('fish', id); C() && C().gainXp(3 + (RPG.MATERIALS[id].price >> 2));
    save(); ui.hud(); endFishing();
  }
  function fishTick(dt){
    const near = !fishing && !busy() && !horse.on && !M.swim && nearWater();
    bFish.style.display = fishing || near ? '' : 'none';
    if(!fishing) return;
    const f = fishing; f.t += dt;
    const hp = A.heroObj.position; const tip = new THREE.Vector3(hp.x + Math.sin(A.agent.heading)*.9, hp.y + 2.1, hp.z + Math.cos(A.agent.heading)*.9);
    const pa = f.line.geometry.attributes.position; pa.setXYZ(0, tip.x, tip.y, tip.z); pa.setXYZ(1, f.bob.position.x, f.bob.position.y + .05, f.bob.position.z); pa.needsUpdate = true;
    if(A.agent.moving || (C() && C().H.target)){ endFishing(); return; }
    if(f.state === 'wait'){ f.bob.position.y = f.wl + Math.sin(f.t*2)*.02; if(f.t > f.bite){ f.state = 'bite'; f.t = 0; extraSfx('bite'); if(fishEl) fishEl.firstChild.textContent = 'Клює! Тягніть!'; } }
    else if(f.state === 'bite'){ f.bob.position.y = f.wl - .06 + Math.sin(f.t*30)*.05; f.glow.material.opacity = .9; if(f.t > f.win){ ui.toast('Риба зірвалася…'); endFishing(); } }
  }

  // =====================================================================
  //  gathering nodes
  // =====================================================================
  const nodes = [];
  (function placeNodes(){
    const R = rng(77123);
    Object.entries(NODE_ZONES).forEach(([zid, list]) => {
      const Zn = ZONES.find(z => z.id === zid); if(!Zn) return;
      list.forEach(([kind, n]) => { for(let i = 0, tries = 0; i < n && tries < 200; tries++){
        const a = R()*6.283, d = (.25 + .7*Math.sqrt(R()))*Zn.r; const x = Zn.x + Math.cos(a)*d, z = Zn.z + Math.sin(a)*d;
        if(!inWild(x, z, 1.5) && !Zn.safe) continue; if(deepWater(x, z)) continue; if(A.town.blocked && A.town.blocked(x, z, .8)) continue;
        if(Math.hypot(x, z) < 70) continue;
        nodes.push({ id: zid + '_' + kind + '_' + i, kind, x, z }); i++; } });
    });
  })();
  const nodeGroup = new THREE.Group(); scene.add(nodeGroup);
  const NM = {};
  function nodeMesh(kind){
    const K = NODE_KINDS[kind]; const g = new THREE.Group();
    if(kind === 'herb' || kind === 'shroom'){
      const stem = new THREE.MeshStandardMaterial({ color: kind === 'herb' ? '#4f8a3a' : '#e8dcc0', roughness: .8 });
      const cap = new THREE.MeshStandardMaterial({ color: kind === 'herb' ? '#f4f0d8' : '#b0502a', roughness: .6, emissive: new THREE.Color(K.color), emissiveIntensity: .15 });
      for(let i = 0; i < 7; i++){ const a = i*.9, r = .12 + (i % 3)*.12; const s = new THREE.Mesh(new THREE.CylinderGeometry(.015, .02, .3 + (i % 2)*.12, 5), stem); s.position.set(Math.cos(a)*r, .16, Math.sin(a)*r); g.add(s);
        const c = kind === 'herb' ? new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), i % 3 === 0 ? new THREE.MeshStandardMaterial({ color: '#6aa0ff', emissive: '#2a4aaa', emissiveIntensity: .3 }) : cap) : new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 6, 0, 6.3, 0, 1.6), cap);
        c.position.set(Math.cos(a)*r, .32 + (i % 2)*.12, Math.sin(a)*r); g.add(c); }
    } else {
      const rock = new THREE.MeshStandardMaterial({ color: '#6a625a', roughness: .95 }), vein = new THREE.MeshStandardMaterial({ color: K.color, metalness: kind === 'moon' ? .2 : .8, roughness: .3, emissive: new THREE.Color(K.color), emissiveIntensity: kind === 'moon' ? .8 : .12 });
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(.55, 0), rock); r.scale.set(1.2, .7, 1); r.position.y = .25; r.castShadow = true; g.add(r);
      for(let i = 0; i < 6; i++){ const c = new THREE.Mesh(new THREE.OctahedronGeometry(.1 + (i % 3)*.04, 0), vein); const a = i*1.1; c.position.set(Math.cos(a)*.42, .3 + (i % 2)*.18, Math.sin(a)*.32); c.rotation.set(a, a*2, 0); g.add(c); }
    }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: K.color, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(1.4, 1.4, 1); gl.position.y = .4; g.add(gl);
    const px = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, 1.4, 8), new THREE.MeshBasicMaterial({ visible: false })); px.position.y = .6; g.add(px);
    return { g, px };
  }
  nodes.forEach(n => {
    const { g, px } = nodeMesh(n.kind); g.position.set(n.x, heightAt(n.x, n.z), n.z); g.rotation.y = hash(n.id) % 6; nodeGroup.add(g); n.g = g;
    px.userData.interact = { id: 'life:node:' + n.id, name: NODE_KINDS[n.kind].n, door: { x: n.x + .9, z: n.z + .9 }, pos: { x: n.x, z: n.z }, node: n };
    A.town.pickables.push(px); n.px = px;
  });
  const nodeReady = n => !L.nodes[n.id] || Date.now() > L.nodes[n.id];
  function gather(n){
    if(!nodeReady(n)){ ui.toast('Тут уже зібрано — повернеться згодом'); return; }
    if(busy()) return;
    const K = NODE_KINDS[n.kind]; const hi = A.heroInst();
    if(hi) hi.oneShot(n.kind === 'herb' || n.kind === 'shroom' ? 'PickUp' : 'Attack1H', { speed: 1, fade: .1 });
    n.kind === 'herb' || n.kind === 'shroom' ? extraSfx('gather') : (extraSfx('mine'), setTimeout(() => extraSfx('mine'), 380));
    setTimeout(() => {
      const got = [];
      K.loot.forEach(([id, ch, q]) => { if(Math.random() < ch){ const it = { k: 'mat', id, q: 1 + Math.floor(Math.random()*q) }; if(RPG.addItem(P, it)) got.push(it); } });
      got.forEach(it => { if(n.kind === 'herb' || n.kind === 'shroom') L.herbs += it.q; else L.ores += it.q; daily('gather', it.id, it.q); });
      L.nodes[n.id] = Date.now() + K.respawn*1000;
      const p = n.g.position; ui.float(got.map(it => RPG.MATERIALS[it.id].i + '×' + it.q).join(' ') || 'нічого', p.x, p.y + 1.6, p.z, 'gold');
      C() && C().emit(p.x, p.y + .5, p.z, 16, K.color, 1.5, .6, .1, 1.5); C() && C().gainXp(2);
      save(); ui.hud();
    }, 900);
  }
  let nodeT = 0;
  function nodeTick(dt){ nodeT -= dt; if(nodeT > 0) return; nodeT = 1; const a = A.agent; nodes.forEach(n => { const d = Math.abs(n.x - a.x) + Math.abs(n.z - a.z); n.g.visible = d < 160 && nodeReady(n) && !A.under(); n.px.visible = n.g.visible; }); }

  // =====================================================================
  //  crafting
  // =====================================================================
  function have(id){ return RPG.countItem(P, id); }
  function craftSheet(tab){
    tab = tab || 'alchemy';
    const ST = [['alchemy', '⚗️ Алхімія'], ['cook', '🍲 Кухня'], ['forge', '🔨 Кування']];
    const inSettle = (() => { const wh = A.town.where(A.agent.x, A.agent.z); const z = zoneAt(A.agent.x, A.agent.z); return wh === 'town' || (z && z.safe); })();
    const list = RECIPES.filter(r => r.st === tab);
    let h = '<div class="lf-tabs">' + ST.map(([k, n]) => '<button class="gm-btn' + (k === tab ? ' primary' : '') + '" data-t="' + k + '">' + n + '</button>').join('') + '</div>';
    if(tab === 'forge' && !inSettle) h += '<p class="gm-note">Кувати можна лише в місті чи поселенні, де є кузня.</p>';
    h += list.map(r => { const ok = r.need.every(([id, q]) => have(id) >= q) && (tab !== 'forge' || inSettle);
      return '<div class="lf-row"><div><b>' + esc(r.n) + '</b><br><small>' + r.need.map(([id, q]) => (RPG.MATERIALS[id] ? RPG.MATERIALS[id].i + ' ' + RPG.MATERIALS[id].n : id) + ' ' + have(id) + '/' + q).join(' · ') + '</small></div><button class="gm-btn' + (ok ? ' primary' : '') + '" data-r="' + r.id + '"' + (ok ? '' : ' disabled') + '>Створити</button></div>'; }).join('');
    A.sheet({ title: 'Ремесло', html: h, buttons: [{ label: 'Закрити', fn: A.hide }], after: s => {
      s.querySelectorAll('[data-t]').forEach(b => b.onclick = () => craftSheet(b.dataset.t));
      s.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { craft(RECIPES.find(r => r.id === b.dataset.r)); craftSheet(tab); });
    } });
  }
  function craft(r){
    if(!r.need.every(([id, q]) => have(id) >= q)) return;
    const o = r.out; let it = null;
    if(o.k === 'use' || o.k === 'mat') it = { k: o.k, id: o.id, q: o.q || 1 };
    else if(o.k === 'eq'){ const Cl = RPG.CLASSES[P.cls] || RPG.CLASSES.warrior; it = RPG.makeEquip(o.kind === 'weapon' ? Cl.wpn : o.kind, o.tier, o.rar); }
    if(it && !RPG.addItem(P, it)){ ui.toast('Рюкзак переповнений'); return; }
    r.need.forEach(([id, q]) => RPG.takeItem(P, id, q));
    if(o.k === 'buff') addBuff(o);
    L.crafted++; daily('craft');
    ui.toast('Створено: ' + (it ? RPG.itemIcon(it) + ' ' + RPG.itemName(it) : (o.i || '') + ' ' + r.n)); sfx('quest'); save(); ui.hud();
  }
  function addBuff(o){
    const c = C(); if(!c) return;
    c.H.buffs = c.H.buffs.filter(b => b.id !== o.id);
    c.H.buffs.push({ id: o.id, buff: o.buff || {}, t: o.dur, n: o.n || o.id, i: o.i || '✨', regen: o.regen });
  }

  // =====================================================================
  //  reputation
  // =====================================================================
  const tierOf = v => { let t = 0; REP_TIERS.forEach((r, i) => { if(v >= r[0]) t = i; }); return t; };
  function addRep(f, n){
    if(!FACTIONS[f] || !n) return; const before = tierOf(L.rep[f]); L.rep[f] = Math.max(0, L.rep[f] + n); const after = tierOf(L.rep[f]);
    if(after > before){ ui.toast(FACTIONS[f].i + ' ' + FACTIONS[f].n + ': тепер ви — «' + REP_TIERS[after][1] + '»! Знижка ' + Math.round(REP_TIERS[after][2]*100) + '%', 'big'); }
    save();
  }
  const KILL_REP = { grove: 'elves', darkwood: 'elves', mines: 'dwarves', ruins: 'dwarves', heath: 'beasts', camp: 'beasts' };

  // =====================================================================
  //  settlement shops
  // =====================================================================
  function shop(zid){
    const S = SHOPS[zid]; if(!S) return false;
    const disc = (S.faction ? REP_TIERS[tierOf(L.rep[S.faction])][2] : 0) + (EV.cur === 'fair' ? .2 : 0);
    const price = g => Math.max(1, Math.round(g.price*(1 - disc)));
    const render = () => {
      const tier = S.faction ? tierOf(L.rep[S.faction]) : 9;
      let h = '<p style="font-size:12px;opacity:.75;margin:0 0 6px">У вас: 💰 ' + P.gold + (S.faction ? ' · ' + FACTIONS[S.faction].i + ' «' + REP_TIERS[tierOf(L.rep[S.faction])][1] + '» (' + L.rep[S.faction] + ')' : '') + (disc ? ' · знижка ' + Math.round(disc*100) + '%' : '') + '</p>';
      h += S.goods.map((g, i) => {
        const nm = g.mat ? RPG.MATERIALS[g.mat].i + ' ' + RPG.MATERIALS[g.mat].n + ' ×' + g.q : g.use ? RPG.CONSUMABLES[g.use].i + ' ' + RPG.CONSUMABLES[g.use].n : g.i + ' ' + g.n;
        const lock = g.rep && tier < g.rep; const owned = g.kind === 'rod' && L.rod >= g.rod;
        const extra = g.bonus ? '<br><small>' + Object.entries(g.bonus).map(([k, v]) => '+' + v + ' ' + (RPG.BONUS_N[k] || k)).join(', ') + '</small>' : '';
        return '<div class="lf-row"><div>' + esc(nm) + extra + (lock ? '<br><small>🔒 потрібна репутація «' + REP_TIERS[g.rep][1] + '»</small>' : '') + '</div><button class="gm-btn' + (lock || owned ? '' : ' primary') + '" data-b="' + i + '"' + (lock || owned || P.gold < price(g) ? ' disabled' : '') + '>' + (owned ? 'Є' : price(g) + ' 💰') + '</button></div>'; }).join('');
      A.sheet({ title: S.n, html: h, buttons: [{ label: 'Продати речі', fn: () => ui.inventory('sell') }, { label: 'Закрити', fn: A.hide }], after: s => {
        s.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
          const g = S.goods[+b.dataset.b], pr = price(g); if(P.gold < pr) return;
          let it = null;
          if(g.mat) it = { k: 'mat', id: g.mat, q: g.q }; else if(g.use) it = { k: 'use', id: g.use, q: 1 };
          else if(g.kind === 'rod'){ L.rod = Math.max(L.rod, g.rod); }
          else { it = RPG.makeEquip(g.kind, g.tier, g.rar); it.n = g.n; it.i = g.i; it.bonus = Object.assign({}, g.bonus); }
          if(it && !RPG.addItem(P, it)){ ui.toast('Рюкзак переповнений'); return; }
          P.gold -= pr; if(S.faction) addRep(S.faction, Math.max(2, Math.round(pr/60)));
          ui.toast('Куплено: ' + (it ? RPG.itemIcon(it) + ' ' + RPG.itemName(it) : g.i + ' ' + g.n)); sfx('coin'); save(); ui.hud(); render(); });
      } });
    };
    render(); return true;
  }
  function sellFish(){
    let gold = 0, n = 0; P.inv.slice().forEach(it => { if(it.k === 'mat' && FISH_IDS.has(it.id)){ gold += RPG.MATERIALS[it.id].price*(it.q || 1); n += it.q || 1; P.inv.splice(P.inv.indexOf(it), 1); } });
    if(!n){ ui.toast('У вас немає риби'); return; }
    P.gold += gold; ui.toast('🐟 Продано ' + n + ' риб за ' + gold + ' 💰'); sfx('coin'); save(); ui.hud();
  }

  // =====================================================================
  //  world events (shared by everyone: derived from the clock)
  // =====================================================================
  const EV = { cur: null, slot: -1, start: 0, end: 0, raidIdx: [], raidOn: false, raidWon: false };
  const EV_N = { moon: '🌕 Кривавий місяць — монстри лютіші, але щедріші (досвід і здобич ×1.5)', raid: '⚔️ Набіг на хутір Вербівка! Гобліни нападають — на допомогу!', fair: '🎪 Ярмарок: знижка 20% у крамницях поселень' };
  const FORCE = {};
  function evFor(slot){ if(FORCE.event !== undefined) return FORCE.event; const h = hash('ev' + slot) % 100; return h < 22 ? 'moon' : h < 36 ? 'raid' : h < 46 ? 'fair' : null; }
  const SLOT = 40*60*1000;
  function evTick(){
    const now = Date.now(), slot = Math.floor(now/SLOT), t0 = slot*SLOT;
    let cur = evFor(slot); const end = cur === 'raid' ? t0 + 15*60*1000 : t0 + SLOT; if(now > end) cur = null;
    if(slot !== EV.slot || cur !== EV.cur){
      const was = EV.cur; EV.slot = slot; EV.cur = cur; EV.end = end;
      if(cur && cur !== was){ ui.toast(EV_N[cur], 'big'); if(cur === 'raid' || cur === 'moon') extraSfx('horn'); }
      if(was === 'raid' && cur !== 'raid') raidStop();
    }
    if(cur === 'raid') raidRun();
    evEl.style.display = cur ? '' : 'none';
    if(cur){ const left = Math.max(0, Math.round((end - now)/60000)); evEl.textContent = EV_N[cur].split(' — ')[0].split('!')[0] + ' · ще ' + left + ' хв'; }
  }
  const evEl = document.createElement('div'); evEl.className = 'lf-ev'; evEl.style.display = 'none'; root.appendChild(evEl);
  // raid monsters: extra spawns near the farm, dormant until the event
  function preSpawns(spawns){
    rosterSpawns(spawns);   // approved models as monsters, animals and bosses (before the raid block!)
    const FARM = ZONES.find(z => z.id === 'farm'); EV.raidStart = spawns.length;
    const types = ['goblin', 'goblin', 'goblin_sh', 'goblin', 'goblin_sh', 'goblin'];
    types.forEach((type, i) => { const a = i/types.length*Math.PI*2 + .3, r = FARM.r*.75; spawns.push({ type, x: FARM.x + Math.cos(a)*r, z: FARM.z + Math.sin(a)*r, wander: 6, raid: true }); });
  }
  function postCombat(c){
    EV.raidIdx = c.monsters.filter(m => m.i >= EV.raidStart).map(m => m.i);
    raidMons().forEach(m => { m.dead = true; m.dormant = true; m.deadT = 0; m.hp = 0; });
  }
  const raidMons = () => { const c = C(); return c ? c.monsters.filter(m => EV.raidIdx.includes(m.i)) : []; };
  function raidRun(){
    const ms = raidMons(); if(!ms.length) return;
    if(!EV.raidOn){ EV.raidOn = true; EV.raidWon = false; EV.raidKills = 0; ms.forEach(m => { m.dormant = false; m.deadT = 1e6; }); }
    else if(!EV.raidWon && ms.every(m => m.dead) && EV.raidKills > 0){ EV.raidWon = true; ms.forEach(m => { m.dormant = true; });
      if(EV.raidKills >= 2){ L.raids = (L.raids || 0) + 1; P.gold += 150; ui.toast('🏆 Набіг відбито! Фермер Петро дякує: +150 💰', 'big'); addRep('beasts', 20); save(); ui.hud(); } }
  }
  function raidStop(){ EV.raidOn = false; raidMons().forEach(m => { m.dormant = true; if(!m.dead){ m.dead = true; m.hp = 0; m.deadT = 0; if(m.fig) m.fig.obj.visible = false; } }); }
  function mods(){ return EV.cur === 'moon' ? { matk: 1.3, xp: 1.5, loot: 1.5 } : { matk: 1, xp: 1, loot: 1 }; }

  // =====================================================================
  //  weather (clock-driven, the same for everyone)
  // =====================================================================
  const W = { rain: 0, fog: 0, storm: 0, kind: 'clear', flash: 0, nextBolt: 8 };
  const W_N = { clear: '☀️ Ясно', cloudy: '⛅ Хмарно', rain: '🌧 Дощ', fog: '🌫 Туман', storm: '⛈ Гроза' };
  function weatherKind(){ if(FORCE.weather) return FORCE.weather; const s = Math.floor(Date.now()/(20*60*1000)); const h = hash('w' + s) % 100; return h < 52 ? 'clear' : h < 68 ? 'cloudy' : h < 84 ? 'rain' : h < 90 ? 'fog' : 'storm'; }
  const N_DROPS = 1400, rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(N_DROPS*6);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: '#a8b8c8', transparent: true, opacity: 0, depthWrite: false });
  const rainMesh = new THREE.LineSegments(rainGeo, rainMat); rainMesh.frustumCulled = false; scene.add(rainMesh);
  for(let i = 0; i < N_DROPS; i++){ const x = (Math.random() - .5)*50, y = Math.random()*30, z = (Math.random() - .5)*50; rainPos.set([x, y, z, x - .06, y - .7, z], i*6); }
  const boltLight = new THREE.HemisphereLight('#d8e4ff', '#405070', 0); scene.add(boltLight);
  const moonLight = new THREE.HemisphereLight('#ff3a2a', '#401010', 0); scene.add(moonLight);
  let lastKind = null;
  function weatherTick(dt){
    const k = weatherKind(); W.kind = k;
    if(k !== lastKind){ if(lastKind) ui.toast('Погода: ' + W_N[k]); lastKind = k; }
    const tr = { clear: [0, 0, 0], cloudy: [0, 0, 0], rain: [.85, .1, 0], fog: [0, 1, 0], storm: [1, .2, 1] }[k];
    const s = Math.min(1, dt*.15); W.rain += (tr[0] - W.rain)*s; W.fog += (tr[1] - W.fog)*s; W.storm += (tr[2] - W.storm)*s;
    const hide = A.under() || interior;
    rainMat.opacity = hide ? 0 : W.rain*.42; rainMesh.visible = rainMat.opacity > .01;
    if(rainMesh.visible){ const cp = A.camera.position; rainMesh.position.set(cp.x, cp.y - 12, cp.z);
      const fall = dt*22; for(let i = 0; i < N_DROPS; i++){ const o = i*6; let y = rainPos[o + 1] - fall; if(y < 0){ y += 30; rainPos[o] = (Math.random() - .5)*50; rainPos[o + 2] = (Math.random() - .5)*50; } rainPos[o + 1] = y; rainPos[o + 3] = rainPos[o] - .06; rainPos[o + 4] = y - .7; rainPos[o + 5] = rainPos[o + 2]; }
      rainGeo.attributes.position.needsUpdate = true; }
    rainSound(hide ? 0 : W.rain);
    W.flash = Math.max(0, W.flash - dt*5);
    if(W.storm > .6 && !hide){ W.nextBolt -= dt; if(W.nextBolt <= 0){ W.nextBolt = 6 + Math.random()*12; W.flash = 1; setTimeout(() => extraSfx('thunder'), 300 + Math.random()*1500); } }
    boltLight.intensity = W.flash*4;
    moonLight.intensity = EV.cur === 'moon' && A.sky.state.lampLevel > .4 && !hide ? .35 : 0;
  }
  let fogBase = .003, fogSet = null, fogCol = null; const fogColSet = new THREE.Color(), _red = new THREE.Color('#5a1010'), _grey = new THREE.Color('#8a949e');
  function post(){
    if(A.under() || interior) return;
    const f = scene.fog;
    if(f){ // the sky sets fog only now and then: always work from its own value, never compound ours
      if(fogSet === null || Math.abs(f.density - fogSet) > 1e-9) fogBase = f.density;
      if(!fogCol || !f.color.equals(fogColSet)) fogCol = f.color.clone();
      f.density = fogBase*(1 + W.fog*.7 + W.rain*.2); fogSet = f.density;
      f.color.copy(fogCol); if(EV.cur === 'moon' && A.sky.state.lampLevel > .4) f.color.lerp(_red, .3); else f.color.lerp(_grey, W.rain*.15 + W.fog*.15); fogColSet.copy(f.color); }
    A.renderer.toneMappingExposure *= 1 - W.rain*.1 - W.fog*.03 + W.flash*.8;
  }

  // =====================================================================
  //  daily errands
  // =====================================================================
  function dailyList(){
    const d = today();
    if(!L.daily || L.daily.date !== d){
      const R = rng(hash(d + ':' + (P.id || 1))); const pool = DAILY_POOL.filter(q => P.lvl >= q.lvl).slice(); const pick = [];
      while(pick.length < 3 && pool.length){ pick.push(pool.splice(Math.floor(R()*pool.length), 1)[0].id); }
      L.daily = { date: d, list: pick.map(id => ({ id, prog: 0, done: false })) }; save();
    }
    return L.daily.list.map(a => ({ a, Q: DAILY_POOL.find(q => q.id === a.id) })).filter(x => x.Q);
  }
  function daily(type, item, q){
    dailyList().forEach(({ a, Q }) => {
      if(a.done) return;
      let inc = 0;
      if(type === 'kill' && Q.type === 'kill' && Q.target.includes(item)) inc = 1;
      if(type === 'gather' && Q.type === 'gather' && Q.item === item) inc = q || 1;
      if(type === 'fish' && Q.type === 'fish' && item !== 'boot') inc = 1;
      if(type === 'fish' && Q.type === 'fishid' && Q.item === item) inc = 1;
      if(type === 'visit' && Q.type === 'visit' && Q.zone === item) inc = 1;
      if(type === 'craft' && Q.type === 'craft') inc = 1;
      if(!inc) return;
      a.prog = Math.min(Q.need, a.prog + inc);
      if(a.prog >= Q.need){ a.done = true; L.dailyDone = (L.dailyDone || 0) + 1; P.gold += Q.gold; C() && C().gainXp(Q.xp); if(Q.rep) addRep(Q.rep[0], Q.rep[1]);
        ui.toast('📜 Доручення «' + Q.n + '» виконано: +' + Q.gold + ' 💰', 'big'); sfx('quest'); ui.hud(); }
      save();
    });
  }

  // =====================================================================
  //  kills: daily, reputation, party share, blood moon count
  // =====================================================================
  function onKill(m){
    daily('kill', m.type);
    const z = zoneAt(m.sx, m.sz); if(z && KILL_REP[z.id]) addRep(KILL_REP[z.id], m.def.boss ? 40 : 1);
    if(m.type === 'wolf_alpha') addRep('beasts', 120);
    if(EV.cur === 'moon') L.moonKills = (L.moonKills || 0) + 1;
    if(EV.raidIdx.includes(m.i)) EV.raidKills = (EV.raidKills || 0) + 1;
    if(partyNear(m.x, m.z)) L.partyKills = (L.partyKills || 0) + 1;
    tut('kill');
  }
  // a party member killed it near me: I get half the experience and some coin
  function partyShare(m){
    if(!partyNear(m.x, m.z) || Math.hypot(m.x - A.agent.x, m.z - A.agent.z) > 45) return null;
    return { xp: .5, gold: .35 };
  }

  // =====================================================================
  //  party (P2P presence fields) — invite, accept, ping, arrows
  // =====================================================================
  const party = { id: lsGet('ritm-game-party', null), invite: null, inviteSeq: 0, ping: null, pingSeq: 0 };
  const remoteP = new Map(); // peer -> { name, pt, x, z, ping }
  let myInv = null;
  function presence(){ return { pt: party.id || '', iv: myInv, pg: party.ping ? [party.ping.seq, Math.round(party.ping.x*10), Math.round(party.ping.z*10)] : null }; }
  function remote(peer, p, r){
    let q = remoteP.get(peer); if(!q){ q = { peer, seenInv: null, seenPing: null }; remoteP.set(peer, q); }
    q.name = r.name; q.x = r.x; q.z = r.z; q.dead = r.dead; q.pt = typeof p.pt === 'string' ? p.pt.slice(0, 12) : '';
    // invite addressed to me?
    if(Array.isArray(p.iv) && p.iv[0] === (A.net.me || 'me') && q.seenInv !== p.iv[2]){ q.seenInv = p.iv[2]; offerInvite(q, String(p.iv[1]).slice(0, 12)); }
    if(Array.isArray(p.pg) && q.seenPing !== p.pg[0] && q.pt && q.pt === party.id){ q.seenPing = p.pg[0]; addPing((+p.pg[1] || 0)/10, (+p.pg[2] || 0)/10, q.name); }
  }
  function gone(peer){ remoteP.delete(peer); }
  const members = () => [...remoteP.values()].filter(q => party.id && q.pt === party.id);
  function partyNear(x, z){ return members().some(q => !q.dead && Math.hypot(q.x - x, q.z - z) < 50); }
  function setParty(id){ party.id = id; lsSet('ritm-game-party', id); bPing.style.display = id ? '' : 'none'; }
  setParty(party.id);
  function offerInvite(q, id){
    A.sheet({ title: '🤝 Запрошення до загону', html: '<p><b>' + esc(q.name) + '</b> кличе вас до свого загону. У загоні ви ділите досвід за спільні перемоги, бачите стрілки до друзів і позначки «сюди!».</p>', buttons: [
      { label: 'Приєднатися', primary: true, fn: () => { setParty(id); A.hide(); ui.toast('Ви в загоні з ' + esc(q.name)); } }, { label: 'Ні, дякую', ghost: true, fn: A.hide }] });
  }
  function partySheet(){
    const others = [...remoteP.values()];
    let h = '<p>' + (party.id ? 'Ви в загоні. Учасники поруч ділять досвід за спільні перемоги, бачать стрілки одне до одного й позначки 📍 (G).' : 'Створіть загін і запросіть гравців, які зараз у світі.') + '</p>';
    h += others.length ? others.map(q => '<div class="lf-row"><span>' + esc(q.name || 'Гравець') + (q.pt && q.pt === party.id ? ' <small>· у загоні</small>' : '') + '</span>' + (q.pt && q.pt === party.id ? '' : '<button class="gm-btn primary" data-inv="' + esc(q.peer) + '">Запросити</button>') + '</div>').join('') : '<p class="gm-note">Зараз у світі нікого, крім вас. Надішліть друзям посилання на гру.</p>';
    A.sheet({ title: '👥 Загін', html: h, buttons: [party.id ? { label: 'Покинути загін', fn: () => { setParty(null); A.hide(); } } : { label: 'Створити загін', primary: true, fn: () => { setParty('p' + Math.floor(Math.random()*1e8).toString(36)); partySheet(); } }, { label: 'Закрити', fn: A.hide }], after: s => {
      s.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { if(!party.id) setParty('p' + Math.floor(Math.random()*1e8).toString(36)); party.inviteSeq++; myInv = [b.dataset.inv, party.id, party.inviteSeq]; ui.toast('Запрошення надіслано'); b.disabled = true; });
    } });
  }
  const pings = [];
  function addPing(x, z, who){
    const g = new THREE.Group(); const beam = new THREE.Mesh(new THREE.CylinderGeometry(.15, .35, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#7ad8ff', transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 7; g.add(beam); const ring = new THREE.Mesh(new THREE.RingGeometry(.6, .9, 32), beam.material); ring.rotation.x = -Math.PI/2; ring.position.y = .08; g.add(ring);
    g.position.set(x, heightAt(x, z), z); scene.add(g);
    const el = document.createElement('div'); el.className = 'lf-ping'; el.textContent = '📍 ' + (who || 'Сюди!'); root.appendChild(el);
    pings.push({ g, el, t: 14, x, z }); extraSfx('bite');
  }
  let lastTap = null;
  function ping(){
    if(!party.id) return;
    const p = lastTap && performance.now() - lastTap.t < 8000 ? lastTap : { x: A.agent.x, z: A.agent.z };
    party.pingSeq++; party.ping = { seq: party.pingSeq, x: p.x, z: p.z }; addPing(p.x, p.z, 'Ви');
  }
  const arrows = new Map(); const _v = new THREE.Vector3();
  function arrowsTick(dt){
    const w = root.clientWidth, h = root.clientHeight;
    const ms = members(); const seen = new Set();
    ms.forEach(q => {
      seen.add(q.peer); let el = arrows.get(q.peer);
      if(!el){ el = document.createElement('div'); el.className = 'lf-arrow'; el.innerHTML = '<i>➤</i><span></span>'; el.querySelector('i').style.cssText = 'background:none;font-style:normal;font-size:20px;color:#7ad8ff;text-shadow:0 0 6px #000;transform-origin:11px 11px'; root.appendChild(el); arrows.set(q.peer, el); }
      _v.set(q.x, heightAt(q.x, q.z) + 1.4, q.z).project(A.camera);
      const on = _v.z < 1 && Math.abs(_v.x) < .92 && Math.abs(_v.y) < .88;
      const d = Math.round(Math.hypot(q.x - A.agent.x, q.z - A.agent.z));
      if(on || interior){ el.style.display = 'none'; return; }
      el.style.display = '';
      let x = _v.x, y = _v.y; if(_v.z >= 1){ x = -x; y = -y; }
      const ang = Math.atan2(-y, x); const R = .86; const k = R/Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
      const sx = (Math.cos(ang)*k*.5 + .5)*w, sy = (Math.sin(ang)*k*.5 + .5)*h;
      el.style.left = Math.max(16, Math.min(w - 120, sx)) + 'px'; el.style.top = Math.max(60, Math.min(h - 40, sy)) + 'px';
      el.querySelector('i').style.transform = 'rotate(' + ang + 'rad)'; el.querySelector('span').textContent = (q.name || 'Друг') + ' · ' + d + ' м';
    });
    arrows.forEach((el, peer) => { if(!seen.has(peer)){ el.remove(); arrows.delete(peer); } });
    for(let i = pings.length - 1; i >= 0; i--){ const pg = pings[i]; pg.t -= dt; pg.g.children[0].material.opacity = Math.min(.5, pg.t*.1)*(.7 + Math.sin(performance.now()*.008)*.3);
      _v.set(pg.x, heightAt(pg.x, pg.z) + 3, pg.z).project(A.camera); const vis = _v.z < 1 && !interior; pg.el.style.display = vis ? '' : 'none'; if(vis){ pg.el.style.left = ((_v.x*.5 + .5)*w - 30) + 'px'; pg.el.style.top = ((-_v.y*.5 + .5)*h) + 'px'; }
      if(pg.t <= 0){ scene.remove(pg.g); pg.el.remove(); pings.splice(i, 1); } }
  }

  // =====================================================================
  //  bestiary, achievements, reputation, errands: the adventure book
  // =====================================================================
  function book(tab){
    tab = tab || 'daily'; tut('book');
    const T = [['daily', '📜 Доручення'], ['rep', '🤝 Репутація'], ['beasts', '🐉 Бестіарій'], ['ach', '🏆 Досягнення'], ['party', '👥 Загін']];
    if(tab === 'party'){ partySheet(); return; }
    let h = '<div class="lf-tabs">' + T.map(([k, n]) => '<button class="gm-btn' + (k === tab ? ' primary' : '') + '" data-t="' + k + '">' + n + '</button>').join('') + '</div>';
    if(tab === 'daily'){
      h += '<p style="opacity:.75;font-size:13px">Нові доручення щодня. Погода зараз: ' + W_N[W.kind] + '.' + (EV.cur ? '<br><b>Подія: ' + EV_N[EV.cur] + '</b>' : '') + '</p>';
      h += dailyList().map(({ a, Q }) => '<div class="lf-row"><div style="flex:1"><b>' + (a.done ? '✅ ' : '') + esc(Q.n) + '</b><br><small>' + esc(Q.d) + ' · ' + Q.gold + ' 💰, ' + Q.xp + ' XP' + (Q.rep ? ', ' + FACTIONS[Q.rep[0]].i + '+' + Q.rep[1] : '') + '</small><div class="lf-bar"><i style="width:' + (a.prog/Q.need*100) + '%"></i></div></div><small>' + a.prog + '/' + Q.need + '</small></div>').join('');
    } else if(tab === 'rep'){
      h += Object.entries(FACTIONS).map(([k, f]) => { const v = L.rep[k], t = tierOf(v), nx = REP_TIERS[t + 1]; return '<div class="lf-row"><div style="flex:1"><b>' + f.i + ' ' + f.n + '</b><br><small>«' + REP_TIERS[t][1] + '» · знижка ' + Math.round(REP_TIERS[t][2]*100) + '%' + (nx ? ' · до «' + nx[1] + '» ще ' + (nx[0] - v) : '') + '</small><div class="lf-bar"><i style="width:' + (nx ? (v - REP_TIERS[t][0])/(nx[0] - REP_TIERS[t][0])*100 : 100) + '%"></i></div></div><small>' + v + '</small></div>'; }).join('');
      h += '<p class="gm-note">Репутацію дають: доручення, покупки в їхніх крамницях, розмови й допомога, а також бої з монстрами поблизу їхніх земель. Ельфи цінують захист Гаю й Темного лісу, гноми — шахт і руїн, звіролюди — Вовчих пагорбів.</p>';
    } else if(tab === 'beasts'){
      const list = Object.entries(RPG.MONSTERS);
      h += '<p style="opacity:.75;font-size:13px">Відкрито ' + list.filter(([k]) => P.kills[k]).length + ' з ' + list.length + '. Здобич відкривається після 5 перемог.</p>';
      h += list.map(([k, m]) => { const n = P.kills[k] || 0; if(!n) return '<div class="lf-row"><span>❔ ???</span><small>' + (m.boss ? 'бос' : 'рів. ' + m.lvl[0] + '–' + m.lvl[1]) + '</small></div>';
        return '<div class="lf-row"><div><b>' + (m.boss ? '👑 ' : m.calamity ? '☠ ' : '') + esc(m.n) + '</b><br><small>рів. ' + m.lvl[0] + '–' + m.lvl[1] + ' · ❤ ' + m.hp + ' · ⚔ ' + m.atk + (m.undead ? ' · нежить' : '') + (n >= 5 ? '<br>Здобич: ' + m.drops.map(d => RPG.MATERIALS[d[0]] ? RPG.MATERIALS[d[0]].i + ' ' + RPG.MATERIALS[d[0]].n : d[0]).join(', ') : '') + '</small></div><small>×' + n + '</small></div>'; }).join('');
    } else if(tab === 'ach'){
      const got = ACHIEVEMENTS.filter(a => L.ach[a.id]).length;
      h += '<p style="opacity:.75;font-size:13px">Здобуто ' + got + ' з ' + ACHIEVEMENTS.length + '</p>' + ACHIEVEMENTS.map(a => { const v = Math.min(a.goal, a.c(L, P) || 0), ok = !!L.ach[a.id];
        return '<div class="lf-row" style="' + (ok ? '' : 'opacity:.75') + '"><div style="flex:1"><b>' + (ok ? '🏆 ' : '🔸 ') + esc(a.n) + '</b><br><small>' + esc(a.d) + ' · ' + [a.gold ? a.gold + ' 💰' : '', a.sparks ? a.sparks + ' ✦' : ''].filter(Boolean).join(' ') + '</small>' + (ok ? '' : '<div class="lf-bar"><i style="width:' + (v/a.goal*100) + '%"></i></div>') + '</div><small>' + (ok ? '✔' : v + '/' + a.goal) + '</small></div>'; }).join('');
    }
    A.sheet({ title: 'Книга пригод', html: h, buttons: [{ label: 'Закрити', fn: A.hide }], after: s => s.querySelectorAll('[data-t]').forEach(b => b.onclick = () => book(b.dataset.t)) });
  }
  let achT = 2;
  function achTick(dt){
    achT -= dt; if(achT > 0) return; achT = 2;
    ACHIEVEMENTS.forEach(a => { if(L.ach[a.id]) return; let v = 0; try{ v = a.c(L, P) || 0; }catch(e){} if(v >= a.goal){ L.ach[a.id] = today(); if(a.gold) P.gold += a.gold; if(a.sparks){ const S = saveGet(); S.sparks = (S.sparks || 0) + a.sparks; saveCommit(); }
      ui.toast('🏆 Досягнення: «' + a.n + '»' + (a.gold ? ' +' + a.gold + ' 💰' : '') + (a.sparks ? ' +' + a.sparks + ' ✦' : ''), 'big'); save(); ui.hud(); } });
    // zone visits for errands
    const z = zoneAt(A.agent.x, A.agent.z); if(z) daily('visit', z.id);
  }

  // =====================================================================
  //  dialogues with choices
  // =====================================================================
  function talk(n){
    const D = DIALOGS[n.def.id]; if(!D) return false;
    L.talked[n.def.id] = 1; save();
    const show = key => {
      if(key === 'end' || !D[key]){ A.hide(); return; }
      const node = D[key];
      A.sheet({ title: n.def.name, html: '<div class="lf-dlg"><p>' + esc(node.t) + '</p></div>', buttons: node.a.map(ans => ({ label: ans.t, fn: () => { if(ans.fx && effect(ans.fx, n) === 'stay') return; if(ans.go) show(ans.go); else if(!ans.fx || !(ans.fx.open || ans.fx.shop)) A.hide(); } })) });
      if(!interior) A.say(n, node.t.length > 90 ? node.t.slice(0, 88) + '…' : node.t);
    };
    show('s'); return true;
  }
  function effect(fx, n){
    if(fx.give){ const [id, q] = fx.give; if(have(id) < q){ ui.toast('Не вистачає: ' + RPG.MATERIALS[id].i + ' ' + RPG.MATERIALS[id].n + ' ' + have(id) + '/' + q); return 'stay'; } RPG.takeItem(P, id, q); }
    if(fx.gold){ if(fx.gold < 0 && P.gold < -fx.gold){ ui.toast('Не вистачає золота'); return 'stay'; } P.gold += fx.gold; if(fx.gold > 0) ui.toast('+' + fx.gold + ' 💰'); }
    if(fx.item){ RPG.addItem(P, Object.assign({}, fx.item)); ui.toast('Отримано: ' + RPG.itemIcon(fx.item) + ' ' + RPG.itemName(fx.item)); }
    if(fx.rep) addRep(fx.rep[0], fx.rep[1]);
    if(fx.buff){ addBuff(fx.buff); ui.toast(fx.buff.i + ' ' + (fx.buff.n || 'Благословення')); }
    if(fx.say){ if(interior) ui.toast('«' + esc(fx.say) + '»'); else A.say(n, fx.say); }
    if(fx.sellFish) sellFish();
    save(); ui.hud();
    if(fx.open){ A.hide(); setTimeout(() => A.openService(fx.open), 50); }
    if(fx.shop){ A.hide(); setTimeout(() => shop(fx.shop), 50); }
  }

  // =====================================================================
  //  tutorial for the first minutes
  // =====================================================================
  const TUT = [
    { k: 'move', t: 'Торкніться землі (або WASD), щоб пройтися.' },
    { k: 'cam', t: 'Потягніть пальцем чи мишею по екрану, щоб повернути камеру. Колесо чи щипок — наблизити.' },
    { k: 'reg', t: 'Зайдіть до <b>Гільдії авантюристів</b> (торкніться будівлі) і отримайте картку авантюриста.' },
    { k: 'bag', t: 'Відкрийте <b>рюкзак 🎒</b> — там спорядження й зілля.' },
    { k: 'kill', t: 'Вийдіть за <b>Південну браму</b> на Луг і переможіть слиза: торкніться його або натисніть пробіл/кнопку атаки.' },
    { k: 'roll', t: 'У бою ухиляйтеся <b>перекатом 🤸 (R)</b> і тримайте <b>блок 🛡️ (F)</b>. Ідеальний блок у мить удару — без шкоди.' },
    { k: 'book', t: 'Відкрийте <b>книгу пригод 📖</b>: щоденні доручення, репутація, бестіарій і досягнення.' }
  ];
  let tutEl = null; const tutStart = { x: A.agent.x, z: A.agent.z, yaw: null };
  const totalKills = () => Object.values(P.kills || {}).reduce((a, b) => a + b, 0);
  if(L.tut === 0 && (totalKills() > 3 || P.lvl > 2)) L.tut = 99; // veterans skip it
  function tut(k){ if(L.tut >= TUT.length) return; if(TUT[L.tut].k === k){ L.tut++; save(); drawTut(); if(L.tut >= TUT.length){ P.gold += 50; ui.toast('🎓 Навчання завершено! +50 💰 на дорогу', 'big'); ui.hud(); } } }
  function drawTut(){
    if(L.tut >= TUT.length){ if(tutEl){ tutEl.remove(); tutEl = null; } return; }
    if(!tutEl){ tutEl = document.createElement('div'); tutEl.className = 'lf-tut'; root.appendChild(tutEl); }
    tutEl.innerHTML = '<div>🎓 <small style="opacity:.6">' + (L.tut + 1) + '/' + TUT.length + '</small> ' + TUT[L.tut].t + '</div><button>пропустити</button>';
    tutEl.querySelector('button').onclick = () => { L.tut = 99; save(); drawTut(); };
  }
  let tutT = 0;
  function tutTick(dt){
    if(L.tut >= TUT.length) return; tutT -= dt; if(tutT > 0) return; tutT = .5;
    if(tutStart.yaw == null) tutStart.yaw = A.cam.tYaw;
    const k = TUT[L.tut].k;
    if(k === 'move' && Math.hypot(A.agent.x - tutStart.x, A.agent.z - tutStart.z) > 5) tut('move');
    if(k === 'cam' && Math.abs(A.cam.tYaw - tutStart.yaw) > .7) tut('cam');
    if(k === 'reg' && P.reg) tut('reg');
    if(k === 'kill' && totalKills() > 0) tut('kill');
  }
  const inv0 = ui.inventory; ui.inventory = m => { tut('bag'); return inv0(m); };

  // =====================================================================
  //  settings
  // =====================================================================
  function creditsSheet(){
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const h = '<p class="gm-note">Частина 3D-моделей — роботи авторів із Sketchfab за ліцензією CC BY 4.0 (моделі змінено: спрощено, додано кістки й анімації). Людські персонажі й анімації — Adobe Mixamo. Дякуємо!</p><div style="max-height:52vh;overflow:auto;font-size:13px;line-height:1.5">' +
      CREDITS.map(c => `<div>«${esc(c.t)}» — <b>${esc(c.a)}</b> · <a href="${esc(c.u)}" target="_blank" rel="noopener" style="color:#e6c47a">Sketchfab</a> · ${esc(c.l)}</div>`).join('') + '</div>';
    A.sheet({ title: 'Автори моделей', html: h, buttons: [{ label: 'Назад', fn: settingsSheet }, { label: 'Готово', primary: true, fn: A.hide }] });
  }
  function settingsSheet(){
    const v = volumes();
    const sl = (k, n, val, a, b, st) => '<label>' + n + ' · <b data-v="' + k + '">' + Math.round(val*100) + '%</b></label><input type="range" data-s="' + k + '" min="' + a + '" max="' + b + '" step="' + st + '" value="' + val + '">';
    const h = '<div class="lf-set">' + sl('sfx', '🔊 Звуки (удари, кроки)', v.sfx, 0, 1, .05) + sl('amb', '🌲 Атмосфера (вітер, птахи, дощ)', v.amb, 0, 1, .05) + sl('music', '🎵 Музика', v.music, 0, 1, .05) +
      sl('cam', '🎥 Чутливість камери', SET.cam, .3, 2.5, .05) + sl('ui', '🔠 Розмір інтерфейсу', SET.ui, .75, 1.4, .05) + '</div><p class="gm-note">Якість графіки — кнопка нижче. Налаштування зберігаються в цьому браузері.</p>';
    A.sheet({ title: 'Налаштування', html: h, buttons: [{ label: 'Якість графіки', fn: () => A.quality() }, { label: 'Автори моделей', fn: creditsSheet }, { label: 'Готово', primary: true, fn: A.hide }], after: s => {
      s.querySelectorAll('[data-s]').forEach(r => r.oninput = () => { const k = r.dataset.s, val = +r.value; s.querySelector('[data-v="' + k + '"]').textContent = Math.round(val*100) + '%';
        if(k === 'cam' || k === 'ui'){ SET[k] = val; lsSet('ritm-game-settings', SET); if(k === 'ui') applyUi(); } else setVolumes({ [k]: val }); });
    } });
  }

  // =====================================================================
  //  interiors: separate small scenes (tavern, throne hall, dwarven hall)
  // =====================================================================
  let interior = null;
  const portals = [];
  function addPortal(id, x, z, label){
    const g = new THREE.Group(); const arch = new THREE.Mesh(new THREE.TorusGeometry(1.1, .08, 8, 24, Math.PI), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false }));
    arch.position.y = 1.1; g.add(arch); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#ffd27a', transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(2.4, 2.4, 1); gl.position.y = 1; g.add(gl);
    const px = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.6, 8), new THREE.MeshBasicMaterial({ visible: false })); px.position.y = 1.2; g.add(px);
    g.position.set(x, heightAt(x, z), z); scene.add(g);
    px.userData.interact = { id: 'life:enter:' + id, name: label, door: { x, z: z + 1.6 }, pos: { x, z } }; A.town.pickables.push(px);
    portals.push({ g, arch, id });
  }
  const ZD = ZONES.find(z => z.id === 'dwarves');
  addPortal('throne', CITY2.x, CITY2.z - 37, 'Тронна зала Сонцеграда');
  addPortal('dwarfhall', ZD.x, ZD.z - 20, 'Зала Предків під горою');
  function enter(id, back){
    if(horse.on) dismount(); endFishing();
    const hi = A.heroInst(); if(!hi) return;
    A.travelFade(() => {
      interior = buildInterior(id, { renderer: A.renderer, F, npcSay: A.say });
      interior.back = back || { x: A.agent.x, z: A.agent.z, h: A.agent.heading };
      interior.hero = hi; A.heroObj.remove(hi.obj); interior.heroHolder.add(hi.obj); hi.obj.rotation.y = Math.PI;
      L.visited[id] = 1; save(); extraSfx('door');
      ui.toast(INTERIORS[id].n + ' · торкніться дверей, щоб вийти');
    });
  }
  function leave(){
    if(!interior) return; const it = interior;
    A.travelFade(() => {
      const hi = it.hero; it.heroHolder.remove(hi.obj); A.heroObj.add(hi.obj); hi.obj.position.set(0, 0, 0);
      it.dispose(); interior = null; extraSfx('door');
      A.agent.x = it.back.x; A.agent.z = it.back.z; A.agent.heading = it.back.h + Math.PI; A.agent.path = [];
    });
  }
  function interiorFrame(dt){
    const it = interior; const k = A.keys;
    let kx = 0, kz = 0;
    if(k.has('KeyW') || k.has('ArrowUp')) kz -= 1; if(k.has('KeyS') || k.has('ArrowDown')) kz += 1; if(k.has('KeyA') || k.has('ArrowLeft')) kx -= 1; if(k.has('KeyD') || k.has('ArrowRight')) kx += 1;
    const h = it.heroState; let moving = false;
    if(kx || kz){ h.target = null; const c = Math.cos(it.camYaw), s = Math.sin(it.camYaw); const wx = kx*c + kz*s, wz = -kx*s + kz*c, l = Math.hypot(wx, wz); h.x += wx/l*2.6*dt; h.z += wz/l*2.6*dt; h.heading = Math.atan2(wx, wz); moving = true; }
    else if(h.target){ const dx = h.target.x - h.x, dz = h.target.z - h.z, d = Math.hypot(dx, dz); if(d < .15){ const cb = h.target.cb; h.target = null; cb && cb(); } else { const st = Math.min(d, 2.6*dt); h.x += dx/d*st; h.z += dz/d*st; h.heading = Math.atan2(dx, dz); moving = true; } }
    [h.x, h.z] = it.clamp(h.x, h.z);
    it.heroHolder.position.set(h.x, 0, h.z);
    const hi = it.hero; hi.obj.rotation.y = lerpA(hi.obj.rotation.y, h.heading, Math.min(1, dt*10)); hi.update(dt, moving); hi.tick(dt); if(!hi.busy()) hi.play(moving ? 'Walk' : 'Idle');
    it.update(dt);
    // camera: fixed tilt following the hero
    it.camYaw += (A.cam.tYaw*.0 + it.camYawT - it.camYaw)*Math.min(1, dt*4);
    const cam = it.camera; const D = it.camDist;
    cam.position.set(Math.max(-it.roomW/2 + .4, Math.min(it.roomW/2 - .4, h.x + Math.sin(it.camYaw)*D*.8)), Math.min(it.camH, 2.4 + D*.22), Math.min(it.roomD/2 - .4, h.z + Math.cos(it.camYaw)*D*.8)); cam.lookAt(h.x, 1.15, h.z);
    cam.aspect = root.clientWidth/Math.max(1, root.clientHeight); cam.updateProjectionMatrix();
    A.renderer.toneMappingExposure = 1;
    A.renderer.render(it.scene, cam);
    setMusic(it.music); musicTick();
  }
  const lerpA = (a, b, t) => { let d = b - a; while(d > Math.PI) d -= Math.PI*2; while(d < -Math.PI) d += Math.PI*2; return a + d*t; };
  function interiorTap(cx, cy){
    const it = interior; const rc = A.renderer.domElement.getBoundingClientRect();
    const nd = new THREE.Vector2(((cx - rc.left)/rc.width)*2 - 1, -((cy - rc.top)/rc.height)*2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(nd, it.camera);
    const hits = ray.intersectObjects(it.pickables, false);
    if(hits.length){ const u = hits[0].object.userData;
      const go = (x, z, cb) => { it.heroState.target = { x, z, cb }; };
      if(u.exit){ go(u.x, u.z, () => leave()); return true; }
      if(u.npc){ go(u.x, u.z, () => { it.heroState.heading = Math.atan2(u.npc.x - it.heroState.x, u.npc.z - it.heroState.z); const nn = { def: { id: u.npc.id, name: u.npc.name, lines: [u.npc.line] }, inst: u.npc.inst, a: { x: 0, z: 0 } };
        if(u.npc.service) { A.say(nn, u.npc.line); setTimeout(() => A.openService(u.npc.service), 600); } else if(!talk(nn)) A.sheet({ title: u.npc.name, html: '<p>' + esc(u.npc.line) + '</p>' }); }); return true; }
    }
    const p = new THREE.Vector3(); if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) it.heroState.target = { x: p.x, z: p.z };
    return true;
  }

  // =====================================================================
  //  music themes by situation
  // =====================================================================
  let musT = 0;
  function musicPick(dt){
    musT -= dt; if(musT > 0){ musicTick(); return; } musT = .5;
    const c = C(); let th = 'wild';
    const wh = A.town.where(A.agent.x, A.agent.z);
    if(A.under()) th = 'dungeon'; else if(wh === 'town' || Math.hypot(A.agent.x - CITY2.x, A.agent.z - CITY2.z) < CITY2.R) th = 'town';
    if(c && c.H.combatT > 0){ const tg = c.H.target; const boss = (tg && !tg.dead && (tg.def.boss || tg.def.calamity)) || c.monsters.some(m => !m.dead && m.def.boss && m.state && /chase|attack/.test(m.state) && Math.hypot(m.x - A.agent.x, m.z - A.agent.z) < 30); th = boss ? 'boss' : 'battle'; }
    setMusic(th); musicTick();
  }

  // =====================================================================
  //  per-frame
  // =====================================================================
  function update(dt){
    const a = A.agent, hi = A.heroInst();
    M.rollCd = Math.max(0, M.rollCd - dt); M.iframes = Math.max(0, M.iframes - dt);
    if(M.rollT > 0){ M.rollT -= dt; const sp = 10.5*Math.min(1, M.rollT/.25 + .25); a.x += Math.sin(M.rollDir)*sp*dt; a.z += Math.cos(M.rollDir)*sp*dt; resolveHero(); a.moving = true; }
    bRoll.classList.toggle('cd', M.rollCd > 0);
    // block
    const bl = blocking(); M.blockT = bl ? M.blockT + dt : 0; bBlock.classList.toggle('on', bl);
    if(bl && hi && !hi.busy()) hi.play('Blocking', { fade: .1 });
    if(bl){ a.path = []; }
    // jump
    if(M.jumpV || M.jumpY > 0){ M.jumpY += M.jumpV*dt; M.jumpV -= 13*dt; if(M.jumpY <= 0){ M.jumpY = 0; M.jumpV = 0; } }
    // swimming
    const wl = waterLevel(a.x, a.z); const deep = wl > -50 && heightAt(a.x, a.z) < wl - 1.1;
    if(deep !== M.swim){ M.swim = deep; if(deep){ extraSfx('splash'); if(horse.on) dismount(); endFishing(); ui.toast('🏊 Ви пливете. У воді битися не можна.'); } }
    if(M.swim){ if(a.moving){ L.swum = (L.swum || 0) + dt*1.4; } if(Math.random() < dt*3 && a.moving && C()) C().emit(a.x, wl + .05, a.z, 3, '#dff4ff', .6, .5, .08, .4); if(C()){ C().setTarget(null); } }
    // horse
    if(horse.on && horse.inst){ if(hi) horse.hold.rotation.y = hi.obj.rotation.y; horse.inst.update(dt, a.moving); horse.inst.mixer.timeScale = a.moving ? 1.2 : 0; if(hi){ hi.obj.position.y = 1.5; if(!hi.busy()) hi.play('Idle'); hi.mixer.update(0); seatPose(hi); } if(a.moving) L.ridden = (L.ridden || 0) + dt*speedMul()*4.4; if(A.town.where(a.x, a.z) === 'town'){ dismount(); ui.toast('У місто — пішки'); } }
    catTick(dt); fishTick(dt); nodeTick(dt); weatherTick(dt); arrowsTick(dt); achTick(dt); tutTick(dt); musicPick(dt);
    evT -= dt; if(evT <= 0){ evT = 1; evTick(); }
    portals.forEach(p => { p.arch.material.opacity = .45 + Math.sin(performance.now()*.003)*.2; });
  }
  let evT = 0;
  function resolveHero(){ OPT.hero = true; const [rx, rz] = A.town.resolve(A.agent.x, A.agent.z, .38); OPT.hero = false; A.agent.x = rx; A.agent.z = rz; }
  function heroY(base){
    const a = A.agent; const wl = waterLevel(a.x, a.z);
    if(M.swim) return wl - 1.25 + Math.sin(performance.now()*.003)*.04;
    return base + M.jumpY;
  }
  function speedMul(){ return horse.on ? 2.3 : M.swim ? .5 : blocking() ? .45 : 1; }
  function key(e, down){
    if(down === false){ if(e.code === 'KeyF') blockHeld.key = false; return false; }
    if(e.repeat) return ['Space', 'KeyF', 'KeyR'].includes(e.code);
    if(interior && e.code === 'Escape'){ leave(); return true; }
    switch(e.code){
      case 'KeyR': roll(); return true;
      case 'KeyF': blockHeld.key = true; return true;
      case 'Space': e.preventDefault(); if(fishing) fishTap(); else jump(); return true;
      case 'KeyH': toggleHorse(); return true;
      case 'KeyG': ping(); return true;
      case 'KeyB': book(); return true;
      case 'KeyC': craftSheet(); return true;
      case 'KeyT': if(fishing) fishTap(); else startFishing(); return true;
    }
    return false;
  }
  function tap(cx, cy){
    if(interior) return interiorTap(cx, cy);
    if(fishing){ fishTap(); return true; }
    return false;
  }
  function noteTap(x, z){ lastTap = { x, z, t: performance.now() }; }
  // buildings / pickables routed here by main.openBuilding
  function building(b){
    if(!b.id || !b.id.startsWith('life:')) { if(b.id === 'tavern' || b.id === 'tavern2'){ enter('tavern'); return true; } return false; }
    if(b.node){ gather(b.node); return true; }
    if(b.id.startsWith('life:enter:')){ enter(b.id.slice(11)); return true; }
    return false;
  }
  // ---------- statues ----------
  (async () => {
    for(const st of STATUES){
      let x, z;
      if(st.building){ const b = A.town.interactives.find(q => q.id === st.building); if(!b) continue; const ux = b.door.x - b.pos.x, uz = b.door.z - b.pos.z, Lu = Math.hypot(ux, uz) || 1; x = b.door.x + (-uz/Lu)*3.6*st.side + ux/Lu*1.2; z = b.door.z + (ux/Lu)*3.6*st.side + uz/Lu*1.2; }
      else { const Zn = ZONES.find(q => q.id === st.place); if(!Zn) continue; x = Zn.x + st.dx; z = Zn.z + st.dz; }
      try{ const f = await F.make({ body: st.body, height: st.h }); const wl = waterLevel(x, z); f.obj.position.set(x, Math.max(heightAt(x, z), wl > -50 ? wl - .3 : -99), z);
        if(st.building){ const b = A.town.interactives.find(q => q.id === st.building); f.obj.rotation.y = Math.atan2(b.door.x - b.pos.x, b.door.z - b.pos.z); } else f.obj.rotation.y = st.yaw || 0;
        f.obj.traverse(m => { if(m.isMesh){ m.castShadow = true; m.receiveShadow = true; } }); scene.add(f.obj); statues.push(f); }catch(e){ console.warn('statue', e); }
    }
  })();
  const statues = [];
  // ---------- cat companion: follows the hero, +8% damage reduction while out ----------
  const cat = { on: !!lsGet('ritm-game-cat', false), inst: null, x: 0, z: 0, h: 0, loading: false };
  const bCat = ROSTER_ON ? sideBtn('🐈', 'Кіт-компаньйон', () => toggleCat()) : document.createElement('button');
  async function toggleCat(force){
    cat.on = force != null ? force : !cat.on; lsSet('ritm-game-cat', cat.on); bCat.classList.toggle('primary', cat.on);
    if(cat.on && !cat.inst && !cat.loading){ cat.loading = true; try{ cat.inst = await F.make({ body: 'nm_cat', height: .75 }); scene.add(cat.inst.obj); cat.x = A.agent.x - 1; cat.z = A.agent.z - 1; }catch(e){ console.warn('cat', e); } cat.loading = false; }
    if(cat.inst) cat.inst.obj.visible = cat.on;
    const c = C(); if(c){ c.H.buffs = c.H.buffs.filter(b => b.id !== 'catpal'); if(cat.on) c.H.buffs.push({ id: 'catpal', buff: { dr: .08 }, t: 1e9, n: 'Кіт-охоронець', i: '🐈' }); }
    if(force == null) ui.toast(cat.on ? '🐈 Кіт іде з вами: −8% отриманої шкоди' : 'Кіт пішов додому');
  }
  setTimeout(() => { if(cat.on && ROSTER_ON) toggleCat(true); }, 4000);
  function catTick(dt){
    if(!cat.on || !cat.inst) return; const a = A.agent; const d = Math.hypot(a.x - cat.x, a.z - cat.z);
    if(d > 30 || interior){ cat.x = a.x - 1.2; cat.z = a.z - 1.2; }
    const moving = d > 1.8; if(moving){ const sp = Math.min(d*2.2, a.run ? 6 : 3.2); cat.x += (a.x - cat.x)/d*sp*dt; cat.z += (a.z - cat.z)/d*sp*dt; cat.h = Math.atan2(a.x - cat.x, a.z - cat.z); }
    cat.inst.obj.position.set(cat.x, heightAt(cat.x, cat.z), cat.z); cat.inst.obj.rotation.y = cat.h; cat.inst.obj.visible = !interior && !A.under() || A.under();
    cat.inst.play(moving ? 'Walk' : 'Idle'); cat.inst.update(dt, moving); cat.inst.tick(dt);
  }
  drawTut(); dailyList();
  return { update, post, key, tap, noteTap, presence, remote, gone, guard, mods, onKill, partyShare, preSpawns, postCombat, talk, shop, building, heroY, speedMul,
    swimming: () => M.swim, force: o => Object.assign(FORCE, o), nearWater: () => nearWater(), state: () => ({ M, W: Object.assign({}, W), EV: { cur: EV.cur }, fishing: fishing && fishing.state, interior: interior && interior.music, horse: horse.on, L }), riding: () => horse.on, camSens: () => SET.cam, inInterior: () => !!interior, interiorFrame, blocking, partySheet, book };
}

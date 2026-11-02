import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { N8AOPass } from 'n8ao';
import { buildTown, R } from './town.js';
import { createSky } from './sky.js';
import { groundMaterial, createTerrain, createField, rockSources, rockInstances, createTrees, createForest, wind, heightAt, fbm2, inWild } from './nature.js';
import { initHeights, roadDist, waterLevel, deepWater, GATES, WALL_R, ZONES, zoneAt, CITY2 } from './world.js';
import { createNet } from './net.js';
import { ADV_DEFS, PARTIES, createAdventurers } from './adventurers.js';
import { createNav, NAV_CSS } from './worldmap.js';
import { sfx, ambience, soundOn, setSound } from './audio.js';
import { loadModel, setAnisotropy, softSprite, pending } from './assets.js';
import * as F from './figures.js';
import * as RPG from './rpg.js';
import { createCombat } from './combat.js';
import { createUI, RP_CSS } from './ui.js';
import * as Features from './features.js';
import { get as saveGet, commit as saveCommit, cloudInit } from './save.js';
import { FLOORS as DFLOORS, ENTRY as DENTRY, isDun, CUT as DCUT } from './dungeon.js';

const CSS = `
.gm-root{position:fixed;inset:0;z-index:10000;background:#0b0d12;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#fff}
.gm-root canvas{display:block;width:100%;height:100%;outline:none}
.gm-top{position:absolute;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top,0px) + 12px) 12px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;pointer-events:none;z-index:2}
.gm-btn{pointer-events:auto;border:1px solid rgba(255,255,255,.18);background:rgba(14,14,18,.5);color:#fff;border-radius:999px;padding:9px 14px;font-size:14px;font-weight:600;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);cursor:pointer;font-family:inherit}
.gm-btn:active{transform:scale(.96)}
.gm-hero{pointer-events:none;text-align:right;background:rgba(14,14,18,.45);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:7px 12px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.gm-hero b{display:block;font-size:14px}.gm-hero span{font-size:11.5px;opacity:.8}
.gm-title{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 64px);text-align:center;pointer-events:none;font-size:12px;letter-spacing:.24em;text-transform:uppercase;opacity:.8;text-shadow:0 2px 10px rgba(0,0,0,.7);font-family:Georgia,"Times New Roman",serif}
.gm-bottom{position:absolute;left:0;right:0;bottom:0;padding:0 12px calc(env(safe-area-inset-bottom,0px) + 14px);display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;z-index:2}
.gm-hint{font-size:12.5px;opacity:.9;background:rgba(14,14,18,.5);padding:6px 12px;border-radius:999px;transition:opacity .6s;text-align:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);max-width:92vw}
.gm-bar{display:flex;gap:8px;pointer-events:auto;flex-wrap:wrap;justify-content:center}
.gm-bar .gm-btn{display:flex;flex-direction:column;align-items:center;gap:2px;border-radius:16px;padding:8px 12px;min-width:68px}
.gm-bar .gm-btn i{font-style:normal;font-size:19px;line-height:1}.gm-bar .gm-btn span{font-size:10.5px;opacity:.9}
.gm-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}
.gm-label{position:absolute;left:0;top:0;transform:translate(-50%,-100%);white-space:nowrap;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(10,10,14,.5);border:1px solid rgba(255,255,255,.16);text-shadow:0 1px 2px rgba(0,0,0,.6);transition:opacity .25s;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:Georgia,"Times New Roman",serif;letter-spacing:.02em}
.gm-label.npc{background:rgba(40,30,16,.5);border-color:rgba(255,220,150,.3);font-family:inherit;font-size:11.5px}
.gm-bubble{position:absolute;left:0;top:0;transform:translate(-50%,-100%);max-width:230px;padding:9px 13px;border-radius:14px;background:rgba(255,252,244,.96);color:#241d18;font-size:13px;line-height:1.38;box-shadow:0 8px 24px rgba(0,0,0,.45);pointer-events:none;opacity:0;transition:opacity .2s}
.gm-bubble.on{opacity:1}
.gm-bubble:after{content:'';position:absolute;left:50%;bottom:-6px;width:12px;height:12px;background:rgba(255,252,244,.96);transform:translateX(-50%) rotate(45deg)}
.gm-sheet{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(28,24,22,.97),rgba(16,14,13,.99));border-top:1px solid rgba(255,230,190,.18);border-radius:22px 22px 0 0;padding:18px 18px calc(env(safe-area-inset-bottom,0px) + 18px);transform:translateY(105%);transition:transform .28s;z-index:5;max-height:72%;overflow:auto;touch-action:pan-y;max-width:640px;margin:0 auto}
.gm-sheet.on{transform:none}
.gm-sheet h3{margin:0 0 6px;font-size:19px;font-family:Georgia,"Times New Roman",serif}.gm-sheet p{margin:0 0 14px;font-size:14px;line-height:1.5;opacity:.88}
.gm-soon{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;padding:3px 9px;border-radius:999px;background:rgba(230,162,60,.2);border:1px solid rgba(230,162,60,.5);color:#ffd48a;margin-bottom:10px}
.gm-sheet .gm-btn{width:100%;border-radius:14px;padding:12px}
.gm-sheet .gm-btns{display:flex;flex-direction:column;gap:8px}
.gm-sheet .gm-btn.primary{background:linear-gradient(135deg,#d9a24a,#b77d2c);border-color:rgba(255,220,150,.5);color:#2a1a08}
.gm-sheet .gm-btn.ghost{background:transparent;opacity:.8}
.gm-sheet .gm-btn.opt{text-align:left;font-weight:600}
.gm-quote{font-size:16px;line-height:1.5;font-style:italic;opacity:1!important;border-left:3px solid #d9a24a;padding-left:12px;font-family:Georgia,"Times New Roman",serif}
.gm-note{font-size:12.5px;color:#ffd48a;opacity:1!important}
.gm-rune{font-size:64px!important;text-align:center;margin:4px 0 8px!important;color:#9fe8ff;text-shadow:0 0 18px #7fd8ff;opacity:1!important}
.gm-bar-row{display:flex;align-items:center;gap:8px;margin:7px 0;font-size:13px}.gm-bar-row span{width:96px;opacity:.9}.gm-bar-row b{width:42px;text-align:right}
.gm-bar-track{flex:1;height:8px;border-radius:6px;background:rgba(255,255,255,.14);overflow:hidden}.gm-bar-track i{display:block;height:100%;border-radius:6px}
.gm-res{position:absolute;left:12px;top:calc(env(safe-area-inset-top,0px) + 60px);display:flex;gap:6px;pointer-events:none;z-index:2}
.gm-chip{background:rgba(14,14,18,.5);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:4px 10px;font-size:13px;font-weight:700;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.gm-side{position:absolute;right:12px;top:calc(env(safe-area-inset-top,0px) + 74px);display:flex;flex-direction:column;gap:8px;z-index:2}
.gm-side .gm-btn{width:44px;height:44px;padding:0;display:flex;align-items:center;justify-content:center;font-size:19px}
.gm-load{position:absolute;inset:0;z-index:8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:radial-gradient(ellipse at center,#1d1a17 0%,#0b0a09 70%);transition:opacity .9s}
.gm-load h2{margin:0;font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:26px;letter-spacing:.18em;text-transform:uppercase;color:#f1e3c8}
.gm-load p{margin:0;font-size:13px;opacity:.7}
.gm-prog{width:min(280px,70vw);height:3px;background:rgba(255,255,255,.12);border-radius:3px;overflow:hidden}.gm-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#b77d2c,#f1d18a);transition:width .3s}
.gm-pick{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.gm-pick button{border-radius:14px;padding:12px 6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#fff;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit}
.gm-pick button.on{border-color:#d9a24a;background:rgba(217,162,74,.22)}
.gm-pick button i{display:block;font-style:normal;font-size:22px;margin-bottom:4px}
.gm-sw{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}.gm-sw button{width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,.25);cursor:pointer}.gm-sw button.on{border-color:#fff;box-shadow:0 0 0 2px #d9a24a}
.gm-net{position:absolute;left:12px;top:calc(env(safe-area-inset-top,0px) + 168px);display:flex;gap:6px;z-index:3}
.gm-net .gm-btn{padding:6px 10px;font-size:13px}
.gm-chatlog{position:absolute;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);width:min(340px,60vw);display:flex;flex-direction:column;gap:3px;pointer-events:none;z-index:3}
.gm-chatlog div{font-size:12.5px;line-height:1.35;background:rgba(10,10,14,.55);border-radius:8px;padding:3px 8px;text-shadow:0 1px 2px #000;transition:opacity 1s}
.gm-chatlog b{color:#ffd48a;font-weight:600}
.gm-chatin{position:absolute;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 112px);width:min(360px,70vw);z-index:6}
.gm-chatin input{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid rgba(255,230,180,.35);background:rgba(14,12,10,.85);color:#fff;padding:9px 12px;font:14px inherit;outline:none}
.gm-pl{font-size:13px;line-height:1.4}.gm-pl div{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.gm-fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:7;transition:opacity .35s}
.gm-fps{position:absolute;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);font:11px ui-monospace,monospace;opacity:.55;pointer-events:none;z-index:2}
`;

const QUALITY = {
  low: { pr: 1, ao: false, post: false, shadow: 1024, grassK: 60, grassRC: 2, flowersK: 10, lights: 3, npcs: 12, treeR: 40, treeMax: 14, leaf: 1.0, shadowR: 30 },
  medium: { pr: 1.25, ao: false, post: true, shadow: 2048, grassK: 140, grassRC: 3, flowersK: 18, lights: 6, npcs: 99, treeR: 60, treeMax: 22, leaf: 1.4, shadowR: 40 },
  high: { pr: 1.75, ao: 'half', post: true, shadow: 2048, grassK: 230, grassRC: 3, flowersK: 26, lights: 8, npcs: 99, treeR: 85, treeMax: 32, shadowR: 48 }
};
const OUTFITS = [
  { top: '#3c4a5c', bottom: '#2b2a2e', shoes: '#2a201a' }, { top: '#6a2e2a', bottom: '#2e2a26', shoes: '#3a2a1e' },
  { top: '#3f5a3a', bottom: '#3a3226', shoes: '#2a201a' }, { top: '#8a7a62', bottom: '#4a3e30', shoes: '#2a201a' },
  { top: '#2a2a30', bottom: '#1e1e22', shoes: '#141414' }, { top: '#5a3f6a', bottom: '#2a2636', shoes: '#2a201a' }
];

let state = null;
function lerpAngle(a, b, t){ let d = b - a; while(d > Math.PI) d -= Math.PI*2; while(d < -Math.PI) d += Math.PI*2; return a + d*t; }
function lsGet(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : v; }catch(e){ return d; } }
function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }

import { createLife } from './life.js';
import { rosterNpcs, patchNpcs } from './roster.js';
import { OPT as WOPT } from './world.js';
export function open(ctx){
  if(state) close();
  ctx = ctx || {};
  if(!document.getElementById('gm-css')){ const st = document.createElement('style'); st.id = 'gm-css'; st.textContent = CSS + RP_CSS + NAV_CSS; document.head.appendChild(st); }
  const root = document.createElement('div'); root.className = 'gm-root';
  root.innerHTML = '<div class="gm-labels"></div><div class="gm-title">Місто Шляху</div><div class="gm-res"></div>' +
    '<div class="gm-top"><div></div><div class="gm-hero"><b></b><span></span></div></div>' +
    '<div class="gm-net"><button class="gm-btn" data-gm="players">👥 <span>1</span></button><button class="gm-btn" data-gm="chat">💬</button></div>' +
    '<div class="gm-chatlog"></div><form class="gm-chatin" hidden><input id="gm-chat-input" maxlength="120" autocomplete="off" placeholder="Повідомлення для всіх поруч… (Enter)"></form>' +
    '<div class="gm-side"><button class="gm-btn" data-gm="map" title="Карта світу (M)">🗺</button><button class="gm-btn" data-gm="sound" title="Звук">🔊</button><button class="gm-btn" data-gm="time" title="Час доби">🌅</button><button class="gm-btn" data-gm="quality" title="Якість графіки">⚙️</button><button class="gm-btn" data-gm="cam" title="Камера">🎥</button></div>' +
    '<div class="gm-bottom"><div class="gm-hint">Торкніться землі — іти, монстра — атакувати · тягніть — камера · WASD · R перекат · F блок · пробіл стрибок · Tab ціль · 1–3</div>' +
    '<div class="gm-bar"><button class="gm-btn" data-gm="bag"><i>🎒</i><span>Рюкзак</span></button><button class="gm-btn" data-gm="quests"><i>📜</i><span>Квести</span></button><button class="gm-btn" data-gm="card"><i>📇</i><span>Картка</span></button><button class="gm-btn" data-gm="wardrobe"><i>🧥</i><span>Вигляд</span></button></div></div>' +
    '<div class="gm-sheet"><div class="gm-soon">СКОРО</div><h3></h3><div class="gm-body"></div><div class="gm-btns"></div></div>' +
    '<div class="gm-fps"></div>' +
    '<div class="gm-load"><h2>Місто Шляху</h2><div class="gm-prog"><i></i></div><p>Будуємо світ…</p></div>';
  (ctx.container || document.body).appendChild(root);
  root.querySelector('[data-gm=sound]').textContent = soundOn() ? '🔊' : '🔇';
  const hero = ctx.hero || {};
  root.querySelector('.gm-hero b').textContent = hero.name || 'Мандрівник';
  root.querySelector('.gm-hero span').textContent = (hero.className || 'Новачок') + ' · рівень ' + (hero.level != null ? hero.level : 0);
  const loadEl = root.querySelector('.gm-load'), progEl = root.querySelector('.gm-prog i'), loadTxt = root.querySelector('.gm-load p');
  const fpsEl = root.querySelector('.gm-fps');
  let progress = 0; const setProg = (p, t) => { progress = Math.max(progress, p); progEl.style.width = (progress*100).toFixed(0) + '%'; if(t) loadTxt.textContent = t; };

  // ---------- quality ----------
  const isMobile = matchMedia('(pointer:coarse)').matches || Math.min(screen.width, screen.height) < 700;
  let qName = lsGet('ritm-game-quality', isMobile ? 'medium' : 'high'); if(!QUALITY[qName]) qName = 'medium';
  let Q = QUALITY[qName];

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  root.insertBefore(renderer.domElement, root.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, .15, 2000);
  const S0 = saveGet();
  const sky = createSky(renderer, scene);
  const todPresets = [{ h: 10.5, i: '☀️', n: 'День' }, { h: 19.55, i: '🌅', n: 'Захід сонця' }, { h: 22.8, i: '🌙', n: 'Ніч' }, { h: 6.9, i: '🌄', n: 'Світанок' }];
  let todIdx = +(lsGet('ritm-game-tod', '1')) || 0; if(!todPresets[todIdx]) todIdx = 1;
  sky.setTime(todPresets[todIdx].h, true);
  root.querySelector('[data-gm=time]').textContent = todPresets[todIdx].i;
  sky.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  Object.assign(sky.sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 220 });

  setProg(.08, 'Зводимо будинки…');
  console.time('heights'); initHeights(); console.timeEnd('heights');
  console.time('town'); const town = buildTown({}); console.timeEnd('town');
  scene.add(town.group);
  const dun = town.dungeon; scene.add(dun.group); dun.group.visible = false;
  const surface = new Set(); const surf = o => { surface.add(o); return o; };
  const terrain = createTerrain(groundMaterial(town.mask, town.wmask, town.mask2));
  terrain.update(0, 30, true); scene.add(terrain.group); surf(terrain.group); surf(town.group);
  const ground = { mesh: terrain.group };
  // light pool: a fixed number of real point lights assigned to the nearest active sources
  scene.updateMatrixWorld(true);
  const lightSrc = town.lights.map(l => { l.light.visible = false; return { l, pos: l.light.getWorldPosition(new THREE.Vector3()), color: l.light.color.clone(), dist: l.light.distance, always: l.always || l.light.userData.always || 0 }; });
  const pool = [];
  function buildPool(n){
    pool.forEach(p => scene.remove(p.light)); pool.length = 0;
    for(let i = 0; i < n; i++){ const pl = new THREE.PointLight('#ffffff', 0, 10, 2); scene.add(pl); pool.push({ light: pl, src: null }); }
  }
  buildPool(QUALITY[qName].lights);
  let poolT = 0;

  const kset = new Set();
  // ---------- hero ----------
  const heroObj = new THREE.Group(); scene.add(heroObj);
  const accent = hero.accent || '#e6a23c';
  const ringMat = new THREE.MeshBasicMaterial({ map: softSprite(), color: accent, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending });
  const heroRing = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), ringMat); heroRing.rotation.x = -Math.PI/2; heroRing.position.y = .04; heroObj.add(heroRing);
  heroObj.position.set(0, 0, 6.2);
  const agent = { x: 0, z: 6.2, path: [], speed: 1.6, moving: false, run: false, heading: Math.PI, onArrive: null };

  // ---------- NPCs ----------
  const npcDefs = [
    { id: 'receptionist', body: 'woman', look: { top: '#2f4a6a', bottom: '#2a2a30' }, gear: {}, name: 'Реєстраторка Леся', post: ['guild', -1.8, .4], service: 'guild', lines: ['Ласкаво просимо до Гільдії авантюристів!', 'Завдання на дошці оновлюються щодня.', 'Котолюдка Міра вчора принесла голову вовка. Сильна дівчина!'] },
    { id: 'master', body: 'soldier', look: { armor: '#c9a85a' }, gear: { right: { type: 'greatsword', gold: true }, cape: '#5a1a1a' }, name: 'Гільдмайстер Святослав', post: ['guild', 2.1, .5], service: 'guild', lines: ['Ранг — це не титул, а відповідальність.', 'Лич у руїнах — справа для рангу A.', 'Світ за мурами став удесятеро більшим, ніж пам\'ятають старі карти.'] },
    { id: 'merchant', body: 'man', look: { top: '#2f4f6f', bottom: '#3a3026', hat: '#4a3424' }, name: 'Торговець Орест', post: ['shop', 1.8, .3], service: 'shop', lines: ['Зілля, зброя, обладунки — усе для авантюристів!', 'Продайте мені трофеї, я добре плачу.'] },
    { id: 'smith', body: 'man', look: { top: '#3a2e26', bottom: '#222222', hat: false, shoes: '#1a1410' }, gear: { right: { type: 'mace' } }, name: 'Коваль Назар', post: ['forge', -1.2, 2.2], service: 'forge', lines: ['Принесіть матеріали — і я заточу ваш клинок.', 'Тихіше, метал співає!'] },
    { id: 'guard1', body: 'soldier', look: {}, gear: { right: { type: 'sword' }, left: { type: 'shield' } }, stat: 'arena', side: -1, name: 'Вартовий', lines: ['За брамою — Дикі землі. Будьте обережні.', 'Монстри не переходять мури. Тут ви в безпеці.'] },
    { id: 'guard2', body: 'soldier', look: { armor: '#c8c0b0' }, gear: { right: { type: 'sword' }, left: { type: 'shield' } }, stat: 'arena', side: 1, name: 'Вартовий', lines: ['Слизи на лузі — для новачків.', 'Орки сьогодні неспокійні.'] },
    { id: 'priest', body: 'woman', look: { top: '#efe8d8', bottom: '#d8d0c0' }, gear: { right: { type: 'scepter' }, cape: '#efe8d8' }, name: 'Жриця Оранта', post: ['temple', 1.8, .4], service: 'temple', lines: ['Світло зцілює всіх, хто приходить з миром.', 'Поранені? Зайдіть до храму — допоможу безкоштовно.'] },
    { id: 'cat', body: 'woman', look: { top: '#1e1e22', bottom: '#2a2228', hair: '#2a2a30' }, gear: { right: { type: 'dagger' }, left: { type: 'dagger' }, beast: { kind: 'cat', color: '#2a2a30', inner: '#e8b0b0', tip: '#f0ece6' } }, name: 'Котолюдка Міра', home: 'guild', lines: ['Мяу… тобто, привіт, новачку.', 'Я ходжу в Темний ліс сама. Хочеш зі мною? Ще не час.', 'Нюх у мене кращий за будь-якого гончака.'] },
    { id: 'wolf', body: 'man', look: { top: '#3a3a40', bottom: '#2a2620', hat: false, beard: false, hair: '#8a8a90' }, gear: { right: { type: 'axe', two: true }, beast: { kind: 'wolf', color: '#7a7a82', inner: '#c8b8b0', tip: '#d8d8dc' } }, name: 'Вовколюд Гарм', post: ['guild', 4.6, 1.8], lines: ['Вовчі пагорби — мої рідні місця. Там неспокійно.', 'Зграя завжди сильніша за одинака.', 'Ранг B? Ще сезон — і буде A.'] },
    { id: 'fox', body: 'woman', look: { top: '#a8642a', bottom: '#3a2a20', hair: '#c86a2a' }, gear: { beast: { kind: 'fox', color: '#c8641e', inner: '#f2e2d0', tip: '#f6f2ea', tipEar: false } }, name: 'Лисиця Лайра', home: 'shop', lines: ['Свіжі прянощі з-за гір! Лише сьогодні.', 'Торговець Орест — мій давній конкурент, хі-хі.', 'Лисячий хвіст на щастя? Ні, не продається.'] },
    { id: 'bunny', body: 'woman', look: { top: '#e8e2d8', bottom: '#6a4a3a', hair: '#efe6d8' }, gear: { beast: { kind: 'rabbit', color: '#efe6d8', inner: '#f0c8c8', tip: '#ffffff' } }, name: 'Зайчиця Сніжа', home: 'tavern', lines: ['Вітаю в «Лимонному Драконі»! Медовуха сьогодні свіжа.', 'Мої вуха чують усі чутки в місті.'] },
    { id: 'tailor', body: 'woman', look: {}, name: 'Швачка Мирося', post: ['wardrobe', 1.9, .4], lines: ['Зачіска, колір, плащ — змінимо все!', 'Натисніть «Вигляд», щоб перевдягтися.'] },
    { id: 'elder', body: 'man', look: { top: '#4a4a5a', bottom: '#2a2830', hat: '#2a2a2a', hair: '#cfcac0' }, name: 'Староста Богдан', home: 'guild', lines: ['Місто тримається на авантюристах.', 'Колись за мурами були лише луки. Тепер — цілий світ.'] },
    { id: 'catm', body: 'man', look: { top: '#5a4a2a', bottom: '#2a2018', hat: false, hair: '#c8a060' }, gear: { beast: { kind: 'cat', color: '#c8a060', inner: '#e8c0a8', tip: '#f0e6d0' } }, name: 'Котолюд Мурко', lines: ['Риба на ринку сьогодні — пальчики оближеш.', 'Кажуть, на Тихому озері хтось співає вночі…'] },
    { id: 'farmer', body: 'man', look: { top: '#6a5a3a', bottom: '#3a3226', hat: '#8a7448', beard: true }, gear: {}, name: 'Фермер Петро', at: [163, 73], face: Math.PI*.8, lines: ['Ох, добре, що ви тут. Вовкулаки зовсім знахабніли!', 'Хліб цього року вродив, а от вовки…'] },
    { id: 'fisher', body: 'man', look: { top: '#3a4a5a', bottom: '#2a2a26', hat: '#4a4a3a' }, gear: {}, name: 'Рибалка Остап', at: [-152, 27.5], face: -Math.PI/2, lines: ['Тихо… рибу налякаєте.', 'Уночі на озері хтось співає. Я туди не плаваю.'] },
    { id: 'hermit', body: 'man', look: { top: '#5a5248', bottom: '#4a4238', hat: false, hair: '#d8d4cc', beard: true }, gear: { right: { type: 'staff', color: '#ffd27a' } }, name: 'Волхв Велимир', at: [125, -210], face: Math.PI, lines: ['Велес бачить усіх, хто приходить з чистими думками.', 'Гори прокинулися. Земля гуде під шахтами.'] },
    { id: 'stroller1', body: 'man', look: { top: '#4f6a4a', bottom: '#3a3226', hat: false }, name: 'Перехожий Мирон', lines: ['Який чудовий вечір!', 'Чуєте? Фонтан сьогодні співає.'] },
    { id: 'stroller2', body: 'soldier', look: { armor: '#b8b0a8' }, gear: { right: { type: 'sword' } }, name: 'Вартовий Тарас', lines: ['Нічна варта — найтихіша.', 'Чотири брами, чотири дороги — обирайте свою.'] }
  ].slice(0, Q.npcs).concat((() => {
    const C2 = CITY2, ZF = ZONES.find(z => z.id === 'fishing'), ZE = ZONES.find(z => z.id === 'elves'), ZD = ZONES.find(z => z.id === 'dwarves'), ZB = ZONES.find(z => z.id === 'beasts');
    const elf = (top, hair) => ({ skin: '#f0d8c0', top, bottom: '#2a3a2a', hair, hat: false, beard: false });
    const dwarf = (top, hair) => ({ top, bottom: '#3a2a1e', hat: false, beard: true, hair, shoes: '#1a1410' });
    const L = [
      // Сонцеград
      { id: 'recept2', body: 'woman', look: { top: '#1e2a6a', bottom: '#2a2a30', hair: '#e8c890' }, name: 'Реєстраторка Злата', post: ['guild2', -1.8, .4], service: 'guild', lines: ['Гільдія Сонцеграда вітає вас! Дошка спільна з Містом Шляху.', 'Тут завдання для сильних — і нагороди відповідні.'] },
      { id: 'merchant2', body: 'man', look: { top: '#6a1e2a', bottom: '#2a2420', hat: '#1e1a16' }, name: 'Купець Мирослав', post: ['shop2', 1.8, .3], service: 'shop', lines: ['Королівський базар: найкраще з усіх земель!', 'Шовк ельфів, сталь гномів — усе тут.'] },
      { id: 'smith2', body: 'man', height: 1.36, width: 1.42, look: dwarf('#3a2e26', '#a8502a'), gear: { right: { type: 'mace' } }, name: 'Гном-коваль Торін', post: ['forge2', -1.2, 2.2], service: 'forge', lines: ['Сталь Кряжу не ламається. Ніколи.', 'Людські ковалі? Хе. Ну-ну.'] },
      { id: 'priest2', body: 'man', look: { top: '#efe8d8', bottom: '#d8d0c0', hat: false, hair: '#c8c0b0', beard: true }, gear: { right: { type: 'scepter' }, cape: '#e8c24a' }, name: 'Жрець Світозар', post: ['temple2', 1.8, .4], service: 'temple', lines: ['Собор Сонця відкритий для всіх.', 'Світло зцілить ваші рани.'] },
      { id: 'herald', body: 'man', look: { top: '#1e2a6a', bottom: '#e8e0cc', hat: '#1e2a6a' }, gear: { right: { type: 'scepter', gold: true }, cape: '#e8c24a' }, name: 'Королівський герольд Остромир', at: [C2.x + 6, C2.z + 9], face: 0, lines: ['Слухайте, слухайте! Король шукає сміливців.', 'Три Катастрофи сплять на кордонах королівства. Хай сплять… поки що.'] },
      { id: 'bard', body: 'man', look: { top: '#5a2a6a', bottom: '#2a2030', hat: '#5a2a6a' }, name: 'Бард Ярема', home: 'tavern2', lines: ['Заспіваю вам баладу про Титана Ірмунда!', 'Кажуть, Фенрір виє тільки на повний місяць.'] },
      { id: 'cg1', body: 'soldier', look: { armor: '#d8d0c0' }, gear: { right: { type: 'sword' }, left: { type: 'shield', kite: true }, cape: '#1e2a6a' }, name: 'Королівський вартовий', at: [C2.x - 76, C2.z - 4.2], face: -Math.PI/2, lines: ['Ласкаво просимо до Сонцеграда.', 'Зброю — в піхви, мандрівнику.'] },
      { id: 'cg2', body: 'soldier', look: { armor: '#d8d0c0' }, gear: { right: { type: 'sword' }, left: { type: 'shield', kite: true }, cape: '#1e2a6a' }, name: 'Королівський вартовий', at: [C2.x - 76, C2.z + 4.2], face: -Math.PI/2, lines: ['Столиця королівства під охороною корони.', 'На півдні — Драглисті топі. Не ходіть туди самі.'] },
      { id: 'cg3', body: 'soldier', look: { armor: '#e0c870' }, gear: { right: { type: 'greatsword', gold: true }, cape: '#1e2a6a' }, name: 'Лицар Варти', at: [C2.x - 5, C2.z - 34], face: 0, lines: ['Замок закритий для гостей. Поки що.', 'Король приймає лише героїв рангу S.'] },
      { id: 'cg4', body: 'soldier', look: { armor: '#e0c870' }, gear: { right: { type: 'greatsword', gold: true }, cape: '#1e2a6a' }, name: 'Лицар Варти', at: [C2.x + 5, C2.z - 34], face: 0, lines: ['Слава Сонцю!', 'Тримайтеся подалі від Кам\'яних Висей.'] },
      { id: 'cz1', body: 'woman', look: { top: '#8a3a2a', bottom: '#3a2a20' }, name: 'Містянка Олеся', area: [C2.x, C2.z, 55], lines: ['Який чудовий день у столиці!', 'Ви бачили собор? Вітражі — диво!'] },
      { id: 'cz2', body: 'man', look: { top: '#2a5a4a', bottom: '#2a2620', hat: '#3a2a1a' }, name: 'Містянин Тарас', area: [C2.x, C2.z, 55], lines: ['Ціни на базарі знову ростуть.', 'Мій брат служить у королівській варті.'] },
      { id: 'cz3', body: 'woman', look: { top: '#c8641e', bottom: '#3a2a20', hair: '#c86a2a' }, gear: { beast: { kind: 'fox', color: '#c8641e', inner: '#f2e2d0', tip: '#f6f2ea' } }, name: 'Лисичка Ріна', area: [C2.x, C2.z, 50], lines: ['Столиця велика, але я знаю всі провулки!', 'Хочете, покажу, де найсмачніші пиріжки?'] },
      { id: 'cz4', body: 'man', look: { top: '#4a4a52', bottom: '#2a2620', hat: false, beard: false, hair: '#8a8a90' }, gear: { beast: { kind: 'wolf', color: '#7a7a82', inner: '#c8b8b0', tip: '#d8d8dc' } }, name: 'Вовколюд Бран', area: [C2.x, C2.z, 55], lines: ['Я прийшов з Пухнастих Пагорбів. Тут гамірно.', 'Люди тут добрі. Здебільшого.'] },
      { id: 'cz5', body: 'woman', look: { top: '#e8e2d8', bottom: '#6a4a3a', hair: '#efe6d8' }, gear: { beast: { kind: 'rabbit', color: '#efe6d8', inner: '#f0c8c8', tip: '#ffffff' } }, name: 'Зайчиця Мія', area: [C2.x, C2.z, 45], lines: ['Ой! Ви мене налякали.', 'Морква на базарі сьогодні — просто чудо.'] },
      { id: 'cz6', body: 'man', look: elf('#2a5a3a', '#e8e0c8'), gear: { ears: true, right: { type: 'bow' } }, name: 'Ельф-посол Галадор', area: [C2.x, C2.z, 40], lines: ['Людські міста такі… кам\'яні.', 'Лісова Гавань на заході. Нас там завжди раді бачити гостей.'] },
      { id: 'cz7', body: 'man', look: { top: '#5a4a3a', bottom: '#2a2018', hat: '#4a3a2a', beard: true }, name: 'Пекар Степан', area: [C2.x, C2.z, 55], lines: ['Свіжий хліб! Тільки з печі!', 'У мене пиріжки з вишнями — найкращі в королівстві.'] },
      { id: 'cz8', body: 'woman', look: { top: '#3a2a5a', bottom: '#2a2030', hair: '#2a2a30' }, gear: { beast: { kind: 'cat', color: '#2a2a30', inner: '#e8b0b0', tip: '#f0ece6' } }, name: 'Котолюдка Сая', area: [C2.x, C2.z, 55], lines: ['Мур. Шукаєте щось?', 'Я чую все, що шепочуть у замку.'] },
      // Рибальське Поріччя
      { id: 'fishwife', body: 'woman', look: { top: '#3a5a6a', bottom: '#4a3a2a' }, name: 'Рибачка Ганна', at: [ZF.x + 2.2, ZF.z - 3.2], face: 0, service: 'shop', lines: ['Риба свіжа, сьогоднішня!', 'Продайте мені трофеї — заплачу чесно.'] },
      { id: 'fishkid', body: 'man', height: 1.35, look: { top: '#6a5a3a', bottom: '#3a3226', hat: false }, name: 'Хлопчик Івась', area: [ZF.x, ZF.z, 14], lines: ['Я теж буду авантюристом!', 'Дід каже, на озері живе водяник.'] },
      // Лісова Гавань
      { id: 'elfelder', body: 'woman', height: 1.82, look: elf('#e8e8dc', '#f0ead8'), gear: { ears: true, right: { type: 'staff', color: '#7fffe0' }, cape: '#2a5a4a' }, name: 'Старійшина Ельнара', at: [ZE.x - 9, ZE.z + 5], face: Math.PI*.7, lines: ['Ліс пам\'ятає все. Навіть те, що ви хотіли б забути.', 'Місячна Криниця береже нашу Гавань.'] },
      { id: 'elfshop', body: 'man', height: 1.86, look: elf('#3a6a4a', '#d8c8a0'), gear: { ears: true }, name: 'Ельф-торговець Аеліон', at: [ZE.x + 14, ZE.z - 4.6], face: 0, service: 'shop', lines: ['Луки з серцевини дуба, плащі з місячного шовку.', 'Ціни? Для друзів лісу — чесні.'] },
      { id: 'elf1', body: 'woman', height: 1.78, look: elf('#4a6a3a', '#e8d8a0'), gear: { ears: true, right: { type: 'bow' } }, name: 'Слідопитка Лаеріель', area: [ZE.x, ZE.z, 26], lines: ['Тихо… ви чуєте, як співають дерева?', 'Сивий степ на півночі — земля Фенріра. Не будіть його.'] },
      { id: 'elf2', body: 'man', height: 1.88, look: elf('#2a4a3a', '#c8c8d0'), gear: { ears: true, right: { type: 'sword' } }, name: 'Вартовий Тауріон', area: [ZE.x, ZE.z, 24], lines: ['Гавань під захистом. Проходьте з миром.', 'Наші дуби старші за королівство людей.'] },
      // Залізний Кряж
      { id: 'dwarfking', body: 'man', height: 1.42, width: 1.45, look: dwarf('#5a3a1a', '#d8d0c0'), gear: { right: { type: 'axe' }, crown: '#e2b552', cape: '#6a1a1a' }, name: 'Тан Бруні Залізнобородий', at: [ZD.x, ZD.z - 14], face: 0, lines: ['Каменю не брешуть, мандрівнику.', 'Титан Ірмунд спить на наших старих копальнях. Поки він там — ми тут.'] },
      { id: 'dwarfsmith', body: 'man', height: 1.34, width: 1.45, look: dwarf('#2a2a2a', '#3a2a1a'), gear: { right: { type: 'mace' } }, name: 'Коваль Двалін', at: [ZD.x - 6.5, ZD.z - 7.5], face: .3, service: 'forge', lines: ['Гномська заточка — назавжди.', 'Давайте зброю, поки горн гарячий.'] },
      { id: 'dwarf1', body: 'man', height: 1.32, width: 1.4, look: dwarf('#4a5a3a', '#c86a2a'), gear: { right: { type: 'axe' } }, name: 'Шахтар Гімлі', area: [ZD.x, ZD.z, 18], lines: ['Руда! Де руда?!', 'Ех, зараз би кухоль темного.'] },
      { id: 'dwarf2', body: 'man', height: 1.3, width: 1.38, look: dwarf('#3a3a5a', '#8a8a90'), name: 'Пивовар Борін', area: [ZD.x, ZD.z, 16], lines: ['Гномське пиво валить з ніг навіть орків.', 'Кряж стоїть тисячу років. І ще тисячу простоїть.'] },
      // Пухнасті Пагорби
      { id: 'beastchief', body: 'man', height: 2.0, width: 1.2, look: { top: '#3a2a1a', bottom: '#2a2018', hat: false, beard: false, hair: '#5a5050' }, gear: { right: { type: 'axe', two: true }, beast: { kind: 'wolf', color: '#5a5450', inner: '#b8a8a0', tip: '#d8d4d0' }, cape: '#6a3a1a' }, name: 'Вождь Грімо', at: [ZB.x + 3, ZB.z - 4], face: 0, lines: ['Пагорби — дім для всіх звіролюдей.', 'На сході — Драглисті топі. Праматір ковтає все, що ворушиться.'] },
      { id: 'beastshop', body: 'woman', look: { top: '#a8642a', bottom: '#3a2a20', hair: '#c86a2a' }, gear: { beast: { kind: 'fox', color: '#d8742e', inner: '#f2e2d0', tip: '#f6f2ea' } }, name: 'Лисиця-міняйло Фіра', at: [ZB.x - 4, ZB.z + 3], face: Math.PI, service: 'shop', lines: ['Міняю шкури на зілля, зілля на шкури!', 'Для вас — знижка. Маленька.'] },
      { id: 'beast1', body: 'woman', look: { top: '#e8e2d8', bottom: '#6a4a3a', hair: '#d8c8b0' }, gear: { beast: { kind: 'rabbit', color: '#c8b8a0', inner: '#f0c8c8', tip: '#ffffff' } }, name: 'Зайчиха Пушинка', area: [ZB.x, ZB.z, 22], lines: ['Пухнасті Пагорби — найзатишніше місце у світі!', 'Ой, а у вас є морквина?'] },
      { id: 'beast2', body: 'man', look: { top: '#5a4a2a', bottom: '#2a2018', hat: false, hair: '#e8a040' }, gear: { beast: { kind: 'cat', color: '#e8a040', inner: '#f0c8a8', tip: '#fff0e0' }, right: { type: 'dagger' } }, name: 'Котолюд Рудько', area: [ZB.x, ZB.z, 24], lines: ['Мисливці повернулися з повними торбами.', 'Тотеми бережуть село від лиха.'] },
      { id: 'beast3', body: 'woman', look: { top: '#3a3a40', bottom: '#2a2620', hair: '#8a8a90' }, gear: { beast: { kind: 'wolf', color: '#9a9aa2', inner: '#d8c8c0', tip: '#eeeef0' }, right: { type: 'bow' } }, name: 'Вовчиця Ірта', area: [ZB.x, ZB.z, 24], lines: ['Моя зграя полює на сході.', 'Людям тут раді, якщо вони не кривдять нікого.'] }
    ];
    return Q.npcs < 14 ? L.filter(d => d.service || ['herald', 'elfelder', 'dwarfking', 'beastchief', 'cg1', 'cg2'].includes(d.id)) : L;
  })()).concat(ADV_DEFS.map(d => Object.assign({ adv: true, at: [0, 140] }, d)));
  patchNpcs(npcDefs); rosterNpcs().forEach((d, i) => { if(Q.npcs >= 14 || i % 4 === 0 || d.statue) npcDefs.push(d); });
  const npcs = [];
  npcDefs.forEach((d, i) => {
    const o = new THREE.Group();
    let x, z;
    if(d.stat){ const b = town.interactives.find(q => q.id === d.stat); x = b.door.x + d.side*3.4; z = b.door.z - 1.0; }
    else if(d.post){ const b = town.interactives.find(q => q.id === d.post[0]); const ux = (b.door.x - b.pos.x), uz = (b.door.z - b.pos.z), L = Math.hypot(ux, uz); x = b.door.x + (-uz/L)*d.post[1] + ux/L*d.post[2]; z = b.door.z + (ux/L)*d.post[1] + uz/L*d.post[2]; d.face = Math.atan2(ux, uz); }
    else if(d.home){ const b = town.interactives.find(q => q.id === d.home); const dx = b.door.x, dz = b.door.z; const ang = Math.atan2(dz, dx); x = dx + Math.cos(ang + 1.2)*1.4; z = dz + Math.sin(ang + 1.2)*1.4; }
    else if(d.at){ x = d.at[0]; z = d.at[1]; }
    else if(d.area){ [x, z] = town.randomFree(d.area[0], d.area[1], d.area[2]*.6); }
    else { const a = Math.random()*6.28; x = Math.cos(a)*6; z = Math.sin(a)*6; }
    [x, z] = town.resolve(x, z, .5);
    o.position.set(x, heightAt(x, z), z); scene.add(o);
    const npc = { def: d, obj: o, a: { x, z, path: [], speed: 1.25 + Math.random()*.2, moving: false, heading: d.stat ? Math.PI : d.face != null ? d.face : Math.random()*6.28 }, wait: Math.random()*4, bubbleT: 0, homePos: [x, z], inst: null };
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 2.0, 8), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.y = 1.0; proxy.userData.npc = npc; o.add(proxy);
    town.pickables.push(proxy);
    if(d.stat) o.rotation.y = Math.PI; if(d.face != null) o.rotation.y = d.face;
    npcs.push(npc);
  });

  // ---------- post-processing ----------
  let composer = null, aoPass = null, bloomPass = null, smaaPass = null;
  function buildComposer(){
    if(composer){ composer.dispose && composer.dispose(); composer = null; }
    if(!Q.post) return;
    const w = root.clientWidth, h = root.clientHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, rt);
    if(Q.ao){
      aoPass = new N8AOPass(scene, camera, w, h);
      Object.assign(aoPass.configuration, { aoRadius: 1.4, distanceFalloff: 1.0, intensity: 2.6, gammaCorrection: false, halfRes: Q.ao === 'half', aoSamples: Q.ao === 'half' ? 8 : 16, denoiseSamples: Q.ao === 'half' ? 4 : 8 });
      aoPass.configuration.color = new THREE.Color(0, 0, 0);
      composer.addPass(aoPass);
    } else composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), .32, .55, .92);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    smaaPass = new SMAAPass(w*renderer.getPixelRatio(), h*renderer.getPixelRatio());
    composer.addPass(smaaPass);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  }

  // ---------- async world dressing ----------
  let grassField = null, flowerField = null, forest = null, allTrees = [], camTrees = [], camNear = [], camNearT = 0;
  const birds = [];
  const fireObjs = [];
  function makeFires(){
    town.fires.forEach(f => {
      const grp = new THREE.Group(); grp.position.set(f.x, f.y, f.z); f.parent.add(grp);
      const parts = [];
      for(let i = 0; i < 7; i++){
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: i < 2 ? '#fff0c0' : f.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        grp.add(sp); parts.push({ sp, t: Math.random(), k: i < 2 ? 0 : 1 });
      }
      fireObjs.push({ grp, parts, s: f.s });
    });
  }
  makeFires();

  const treeAccept = [];
  (async () => {
    try{
      setProg(.2, 'Висаджуємо дерева…');
      await new Promise(r => setTimeout(r, 30));
      // trees: town + the whole land, full trees near the hero and impostors beyond
      const near = town.treeSpots.slice();
      town.wild.treeSpots.forEach(t => near.push(t)); town.wild.deadTrees.forEach(t => near.push(t));
      allTrees = near.filter(t => t.type !== 6 && t.type !== 7).map(t => { const H = ({ 0: 11, 1: 12, 2: 10, 3: 13, 4: 7, 5: 8, dead: 10 })[t.type] || 10; return { x: t.x, z: t.z, y: H*.62*t.s, r: H*.33*t.s }; });
      forest = createForest(renderer, near, { variants: 2, nearR: Q.treeR, maxFull: Q.treeMax || 26, leaf: Q.leaf || 1.9 });
      scene.add(surf(forest.group)); forest.update(agent.x, agent.z, true);
      setProg(.55, 'Розкладаємо каміння…');
      await new Promise(r => setTimeout(r, 20));
      const rs = await rockSources();
      scene.add(surf(rockInstances(rs, town.wild.rockSpots)));
      dun.group.add(rockInstances(rs, dun.rockSpots));
      setProg(.65, 'Сіємо траву…');
      const accept = (x, z) => {
        const r = Math.hypot(x, z);
        if(r < WALL_R + 4){ if(r > WALL_R - 3) return false; const [d, c] = town.mask.at(x, z); if(d > .35 || c > .2) return false; return !town.blocked(x, z, .15); }
        if(x > 2500 || roadDist(x, z) < 2.4) return false;
        const w = waterLevel(x, z); if(w > -50 && heightAt(x, z) < w + .05) return false;
        const r2 = Math.hypot(x - CITY2.x, z - CITY2.z); if(r2 < CITY2.R + 5){ if(r2 > CITY2.R - 2) return false; const [d2, c2] = town.mask.at(x, z); if(d2 > .3 || c2 > .15) return false; return !town.blocked(x, z, .15); }
        const [d] = town.mask.at(x, z); return d < .3;
      };
      const tint = (x, z, col) => { const m = town.mask.at(x, z); if(m[2] > .2) col.lerp(new THREE.Color('#2a3a1c'), m[2]*.6); if(m[3] > .2) col.lerp(new THREE.Color('#7a6a3a'), m[3]*.55); };
      grassField = await createField({ kind: 'grass', k: Q.grassK, rc: Q.grassRC, cell: 12, accept, tint });
      scene.add(surf(grassField.group)); grassField.update(agent.x, agent.z, true);
      flowerField = await createField({ kind: 'flowers', k: Q.flowersK, rc: 2, cell: 16, accept: (x, z, R2) => accept(x, z) && Math.hypot(x, z) > 14 && R2() < .55 });
      scene.add(surf(flowerField.group)); flowerField.update(agent.x, agent.z, true);
      // birds
      try{
        const sg = await loadModel('stork');
        for(let i = 0; i < 4; i++){ const b = sg.scene.clone(true); b.scale.setScalar(.035); scene.add(surf(b)); const mx = new THREE.AnimationMixer(b); mx.clipAction(sg.animations[0]).setDuration(1.1 + Math.random()*.3).play(); mx.setTime(Math.random()); b.traverse(m => { if(m.isMesh){ m.material = m.material.clone(); m.material.color && m.material.color.multiplyScalar(.9); m.castShadow = false; } }); birds.push({ b, mx, r: 30 + i*14, h: 28 + i*6, sp: .08 + i*.015, ph: i*1.7 }); }
      }catch(e){}
      setProg(.82, 'Кличемо мешканців…');
      await F.preload(['man', 'woman', 'soldier'], ['Idle', 'Walk', 'Run', 'Nod']);
      await spawnHero();
      for(const n of npcs){ const inst = await F.make({ body: n.def.body, look: n.def.look, gear: n.def.gear, width: n.def.width, height: n.def.height || (n.def.body === 'woman' ? 1.64 + Math.random()*.06 : n.def.body === 'soldier' ? 1.84 : 1.76 + Math.random()*.1) }); n.obj.add(inst.obj); n.inst = inst; }
      setProg(.92, 'Будимо монстрів…');
      await F.preload(['bones'], ['Idle', 'Walk', 'Run']);
      setProg(1, 'Готово'); console.log('dressing done', performance.now()|0);
    }catch(e){ console.error('world dressing failed', e); loadTxt.textContent = 'Частину світу не вдалося завантажити: ' + (e && e.message || e); }
    if(composer === null) buildComposer();
    setTimeout(() => { loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 900); }, 250);
    ready = true;
  })();
  let ready = false;

  function createWorldTree(){
    const T = createTrees([{ x: 0, z: 0, s: 1, r: 0, type: 8 }], 1, 'high');
    const grp = T.group;
    grp.traverse(m => { if(m.isInstancedMesh && m.material.alphaTest){ m.material = m.material.clone(); m.material.color.set('#e8e09a'); m.material.emissive = new THREE.Color('#5a4a10'); m.material.emissiveIntensity = .25; } });
    return grp;
  }

  // hero figure: body & outfit from the wardrobe, gear from class & equipment
  let heroInst = null, heroBusy = false;
  function weaponGear(it){
    if(!it) return {};
    const gold = it.tier >= 3, col = ['#5ac8ff', '#7ad8ff', '#a07aff', '#ff7a5a', '#ffd25a'][it.tier];
    switch(it.w){
      case 'sword': return { right: { type: it.tier >= 2 ? 'greatsword' : 'sword', gold, len: .82 + it.tier*.06 } };
      case 'axe2': return { right: { type: 'axe', two: true } };
      case 'mace': return { right: { type: 'mace', gold } };
      case 'staff': return { right: { type: 'staff', color: col } };
      case 'skullstaff': return { right: { type: 'staff', skull: true, color: '#b46aff' } };
      case 'bow': return { left: { type: 'bow' } };
      case 'dagger': return { right: { type: 'dagger' }, left: { type: 'dagger' } };
      case 'scepter': return { right: { type: 'scepter' } };
    }
    return {};
  }
  let spawnSeq = 0;
  async function spawnHero(){
    const seq = ++spawnSeq;
    const S = saveGet();
    const kind = (S.look3d && F.BODIES[S.look3d.kind]) ? S.look3d.kind : 'man';
    const C = P.reg ? RPG.CLASSES[P.cls] : null;
    const chosen = S.look3d && S.look3d.outfit != null ? OUTFITS[S.look3d.outfit] : null;
    const look = Object.assign({ hat: false }, chosen || (C ? { top: C.look.top, bottom: C.look.bottom, shoes: '#2a201a' } : OUTFITS[0]));
    if(kind === 'soldier') look.armor = C && C.look.armor ? C.look.armor : (chosen ? chosen.top : undefined);
    const gear = Object.assign({}, P.reg ? weaponGear(P.eq.weapon) : {});
    if(P.reg && P.eq.shield && C.off) gear.left = { type: 'shield', kite: P.cls === 'paladin' };
    if(C){ gear.cape = C.look.cape; if(C.look.hat){ gear.hat = C.look.hat; gear.hatColor = C.look.hatColor; } }
    if(C) await F.preload([kind], C.atk.concat(C.skills.map(s => s.anim), ['Hit', 'Death', 'Interact', 'Cheer']));
    const inst = await F.make({ body: kind, look, gear, height: kind === 'woman' ? 1.68 : kind.startsWith('nm_') ? F.BODIES[kind].height : 1.8 });
    if(seq !== spawnSeq) return;
    if(heroInst){ heroObj.remove(heroInst.obj); }
    heroInst = inst; heroObj.add(inst.obj); inst.obj.rotation.y = agent.heading;
    const os = inst.oneShot; inst.oneShot = (name, o) => { myAct = [(myAct[0] + 1) % 1000, name, (o && o.speed) || 1]; return os(name, o); };
  }
  let myAct = [0, '', 1];

  // ---------- labels ----------
  const labelsEl = root.querySelector('.gm-labels');
  const labels = [];
  town.interactives.forEach(b => { const el = document.createElement('div'); el.className = 'gm-label'; el.textContent = b.name; labelsEl.appendChild(el); labels.push({ el, pos: new THREE.Vector3(b.pos.x, b.labelY || 4.5, b.pos.z), max: 24 }); });
  npcs.forEach(n => { const el = document.createElement('div'); el.className = 'gm-label npc'; el.textContent = n.def.name; labelsEl.appendChild(el); labels.push({ el, npc: n, max: 9 }); });
  const bubble = document.createElement('div'); bubble.className = 'gm-bubble'; labelsEl.appendChild(bubble);
  let bubbleNpc = null;

  // ---------- sheet ----------
  const sheet = root.querySelector('.gm-sheet');
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function sheetOpts(o){
    sheet.querySelector('h3').textContent = o.title;
    sheet.querySelector('.gm-body').innerHTML = o.html || '';
    sheet.querySelector('.gm-soon').style.display = o.soon ? '' : 'none';
    const bx = sheet.querySelector('.gm-btns'); bx.innerHTML = '';
    (o.buttons || [{ label: 'Закрити', fn: hideSheet }]).forEach(b => { const el = document.createElement('button'); el.className = 'gm-btn' + (b.primary ? ' primary' : '') + (b.ghost ? ' ghost' : '') + (o.buttons && o.buttons.length > 2 ? ' opt' : ''); el.textContent = b.label; el.onclick = () => { sfx('ui'); b.fn && b.fn(); }; bx.appendChild(el); });
    sheet.scrollTop = 0; sheet.classList.add('on');
    if(o.after) o.after(sheet);
  }
  function showSheet(title, text, soon){ sheetOpts({ title, html: '<p>' + esc(text) + '</p>', soon: soon !== false }); }
  function hideSheet(){ sheet.classList.remove('on'); }
  const resEl = root.querySelector('.gm-res');
  function refreshRes(){
    const S = saveGet(); const td = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    let h = '<div class="gm-chip" title="Іскри мудрості">✦ ' + (S.sparks || 0) + '</div>';
    const pt = S.patron && Features.PATRONS.find(p => p.id === S.patron); if(pt) h += '<div class="gm-chip" title="Покровитель: ' + pt.n + '">' + pt.e + '</div>';
    const rn = S.rune && S.rune.date === td && Features.RUNES.find(r => r.id === S.rune.id); if(rn) h += '<div class="gm-chip" title="Руна дня: ' + rn.n + '">' + rn.r + '</div>';
    resEl.innerHTML = h;
  }
  refreshRes();
  const featApi = { sheet: sheetOpts, hide: hideSheet, hero, refresh: refreshRes };
  root.querySelector('.gm-res').style.display = 'none';
  const P = RPG.state();
  let combat = null;
  const ui = createUI({ root, camera, P, dungeon: () => town.dungeon, others: () => remotePlayers(), sheet: sheetOpts, hide: hideSheet, combat: () => combat, heroName: () => saveGet().heroName || hero.name || 'Мандрівник',
    onAttack: () => { if(!combat || !P.reg) return; if(!combat.H.target || combat.H.target.dead){ const n = combat.nearestMonster(16); if(n) combat.setTarget(n); else ui.toast('Немає цілі поруч'); } },
    onSkill: i => combat && combat.useSkill(i), onPotion: k => combat && combat.usePotion(k),
    onGear: () => { combat && combat.recalc(); spawnHero(); ui.hud(); }, onClass: () => { combat && combat.recalc(); combat && combat.fullHeal(); spawnHero(); },
    goWild: () => walkTo(0, 80), goGuild: () => goTo('guild'), onRank: () => {}, onMap: () => { nav && nav.openMap(); }, miniOverlay: (mc, W, sc) => nav && nav.miniArrows(mc, W, sc) });
  const net = createNet();
  const remotes = new Map();
  const remotePlayers = () => { const out = []; remotes.forEach((r, peer) => { if(r.x != null) out.push({ peer, x: r.x, z: r.z, dead: r.dead, name: r.name }); }); return out; };
  let advs = null, myFol = null;
  const life = createLife({ root, scene, camera, renderer, P, ui, sheet: sheetOpts, hide: hideSheet, combat: () => combat, agent, heroObj, heroInst: () => heroInst, town, npcs, say: (n, t) => say(n, t), sky, net, get cam(){ return cam; }, keys: kset,
    openService: s2 => openService(s2), quality: () => qualitySheet(), under: () => under, travelFade: cb => { hideSheet(); fadeEl.style.opacity = 1; setTimeout(() => { cb(); setTimeout(() => { fadeEl.style.opacity = 0; }, 160); }, 380); } });
  life.preSpawns(town.wild.spawns);
  combat = createCombat({ guard: () => life.guard(), mods: () => life.mods(), onKill: m => life.onKill(m), partyShare: m => life.partyShare(m), scene, town, ui, P, appStats: hero.stats, net, players: remotePlayers, extra: () => advs ? advs.targets() : [], hitNpc: (i, d) => advs && advs.hit(i, d),
    hero: { obj: heroObj, agent, inst: () => heroInst },
    moveTo: (x, z) => { agent.path = route(x, z); agent.onArrive = null; agent.chasing = true; agent.run = true; },
    respawn: () => { const tps = town.interactives.filter(q => q.id === 'temple' || q.id === 'temple2'); let b = tps[0] || town.interactives.find(q => q.id === 'guild'); tps.forEach(q => { if(Math.hypot(q.door.x - agent.x, q.door.z - agent.z) < Math.hypot(b.door.x - agent.x, b.door.z - agent.z)) b = q; }); agent.x = b.door.x; agent.z = b.door.z; agent.path = []; heroObj.position.set(agent.x, 0, agent.z); camSmooth.set(0, 0, 0); } });
  life.postCombat(combat);
  advs = createAdventurers({ npcs, net, town, heightAt, step: (a, dt, sp) => stepAgent(a, dt, sp), say: (n, t) => say(n, t), combat: () => combat, players: remotePlayers,
    me: () => ({ x: agent.x, z: agent.z, dead: !!(combat && combat.H.dead) }), proj: (f, m, c, ar) => combat && combat.proj(f, m, c, ar),
    healFx: (x, z) => combat && combat.emit(x, heightAt(x, z) + .3, z, 30, '#ffe9a0', 1, 1.1, .14, 2.2),
    request: (k, on) => { myFol = [k, on ? 1 : 0]; },
    onFollow: (k, key) => { if(!key && myFol && myFol[0] === k) myFol = null; } });
  let nav = null, stepT = 0, ambT = 0;
  nav = createNav({ root, P, town, agent, scene, npcs, combat: () => combat, advs: () => advs, others: () => remotePlayers(), camYaw: () => cam.yaw,
    toast: (t, k) => ui.toast(t, k), gainXp: n => combat && combat.gainXp(n), walkTo: (x, z) => walkTo(x, z),
    teleport: (x, z) => { if(under) return; sfx('tele'); agent.x = x; agent.z = z; agent.path = []; agent.onArrive = null; heroObj.position.set(x, heightAt(x, z), z); camSmooth.set(0, 0, 0); if(combat) combat.setTarget(null); } });
  function advSheet(n){
    const k = n.def.party, Pt = PARTIES[k], pt = advs.party(k), mine = advs.followsMe(k), busy = pt && pt.follow && !mine;
    const mates = ADV_DEFS.filter(d => d.party === k).map(d => d.name).join(' і ');
    sheetOpts({ title: Pt.n, html: '<p>' + esc(mates) + ' — авантюристи ' + Pt.lvl + '-го рівня. Полюють там, де потрібна допомога, і завжди підсоблять у бою.</p>' + (busy ? '<p>Зараз вони вже супроводжують іншого авантюриста.</p>' : mine ? '<p>Загін іде з вами.</p>' : ''), soon: false, buttons: [
      mine ? { label: '👋 Відпустити загін', primary: true, fn: () => { advs.invite(k, false); myFol = [k, 0]; hideSheet(); say(n, 'Добре, ще побачимося на стежках!'); } }
           : { label: '🤝 Ходімо разом', primary: true, disabled: busy, fn: () => { if(busy) return; advs.invite(k, true); hideSheet(); say(n, 'Залюбки! Ведіть — ми за вами.'); ui.toast('🤝 ' + Pt.n + ' йде з вами (15 хв)'); } },
      { label: 'Бувайте', ghost: true, fn: hideSheet }] });
  }
  ui.hud();

  // ---------- multiplayer: other adventurers in the same world ----------
  const chatLog = root.querySelector('.gm-chatlog'), chatIn = root.querySelector('.gm-chatin'), chatInput = root.querySelector('#gm-chat-input');
  let mySay = null;
  const cleanText = t => String(t || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').slice(0, 120);
  function logChat(name, text, sys){ const d = document.createElement('div'); if(sys){ d.textContent = text; d.style.opacity = .8; } else { const b = document.createElement('b'); b.textContent = name + ': '; d.appendChild(b); d.appendChild(document.createTextNode(text)); } chatLog.appendChild(d); while(chatLog.children.length > 7) chatLog.firstChild.remove(); setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 1200); }, 14000); }
  function openChat(){ chatIn.hidden = false; chatInput.value = ''; chatInput.focus(); }
  chatIn.addEventListener('submit', e => { e.preventDefault(); const t = cleanText(chatInput.value).trim(); chatIn.hidden = true; chatInput.blur(); if(!t) return; mySay = [Date.now(), t]; logChat(myName(), t); bubbleFor({ obj: heroObj }, t); });
  chatInput.addEventListener('keydown', e => { if(e.key === 'Escape'){ chatIn.hidden = true; chatInput.blur(); } e.stopPropagation(); });
  const myName = () => (saveGet().heroName || hero.name || 'Мандрівник');
  const bubbles = [];
  function bubbleFor(r, text){ const el = document.createElement('div'); el.className = 'gm-bubble on'; el.textContent = text; labelsEl.appendChild(el); bubbles.push({ el, r, t: 6 }); }
  function presenceOut(now){
    if(!net.room) return;
    const S = saveGet(), C = P.reg ? RPG.CLASSES[P.cls] : null, w = P.eq && P.eq.weapon;
    const pr = { g: 1, n: cleanText(myName()).slice(0, 24), c: P.reg ? P.cls : '', l: P.lvl, r: P.rank || 0,
      k: (S.look3d && S.look3d.kind) || 'man', o: S.look3d && S.look3d.outfit != null ? S.look3d.outfit : -1, w: w ? w.w + ':' + w.tier : '', sh: P.eq && P.eq.shield && C && C.off ? 1 : 0,
      x: Math.round(agent.x*10), z: Math.round(agent.z*10), hd: Math.round(agent.heading*100), mv: agent.moving ? (agent.run ? 2 : 1) : 0, fol: myFol,
      d: combat && combat.H.dead ? 1 : 0, hp: combat ? Math.round(combat.H.hp/Math.max(1, combat.D.maxHp)*100) : 100,
      a: myAct, hits: combat && !combat.isHost() ? combat.hitOut : [], say: mySay };
    Object.assign(pr, life.presence());
    net.self(pr, now);
  }
  function lookOf(p){ return [p.k, p.o, p.c, p.w, p.sh].join('|'); }
  async function buildRemote(r, p){
    const key = lookOf(p); if(r.building || r.key === key) return; r.building = true; r.key = key;
    const kind = F.BODIES[p.k] ? p.k : 'man', C = RPG.CLASSES[p.c] || null;
    const outfit = p.o >= 0 && OUTFITS[p.o] ? OUTFITS[p.o] : null;
    const look = Object.assign({ hat: false }, outfit || (C ? { top: C.look.top, bottom: C.look.bottom, shoes: '#2a201a' } : OUTFITS[0]));
    if(kind === 'soldier') look.armor = C && C.look.armor ? C.look.armor : (outfit ? outfit.top : undefined);
    let gear = {}; if(p.w){ const [wk, tr] = String(p.w).split(':'); if(RPG.WEAPONS[wk]) gear = weaponGear({ w: wk, tier: Math.max(0, Math.min(4, +tr || 0)) }); }
    if(p.sh && C && C.off) gear.left = { type: 'shield', kite: p.c === 'paladin' };
    if(C){ gear.cape = C.look.cape; if(C.look.hat){ gear.hat = C.look.hat; gear.hatColor = C.look.hatColor; } }
    try{
      if(C) await F.preload([kind], C.atk.concat(C.skills.map(s2 => s2.anim), ['Hit', 'Death', 'Cheer']));
      const inst = await F.make({ body: kind, look, gear, height: kind === 'woman' ? 1.68 : kind.startsWith('nm_') ? F.BODIES[kind].height : 1.8 });
      if(!remotes.has(r.peer)){ return; }
      if(r.inst) r.obj.remove(r.inst.obj);
      r.inst = inst; r.obj.add(inst.obj);
    }catch(e){ console.warn('remote figure', e); }
    r.building = false;
  }
  function syncRemotes(dt, now){
    const seen = new Set();
    net.others().forEach(o2 => {
      const p = o2.presence || {}; seen.add(o2.peer);
      let r = remotes.get(o2.peer);
      if(!r){ r = { peer: o2.peer, obj: new THREE.Group(), x: null, z: null, act: null, sayT: 0 }; scene.add(r.obj);
        const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: softSprite(), color: '#7ad8ff', transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI/2; ring.position.y = .04; r.obj.add(ring);
        const el = document.createElement('div'); el.className = 'gm-label'; el.style.borderColor = 'rgba(122,216,255,.5)'; labelsEl.appendChild(el); r.label = el;
        remotes.set(o2.peer, r); if(p.n) logChat('', '👋 ' + cleanText(p.n) + ' приєднується до гри', true); }
      r.guest = o2.guest;
      const tx = (+p.x || 0)/10, tz = (+p.z || 0)/10;
      if(r.x == null || Math.hypot(tx - r.x, tz - r.z) > 12){ r.x = tx; r.z = tz; } else { const k = Math.min(1, dt*10); r.x += (tx - r.x)*k; r.z += (tz - r.z)*k; }
      r.hd = (+p.hd || 0)/100; r.mv = p.mv | 0; r.dead = !!p.d; r.name = cleanText(p.n || 'Авантюрист').slice(0, 24); r.lvl = +p.l || 1; r.cls = p.c; r.hp = +p.hp || 0; r.rank = +p.r || 0;
      life.remote(o2.peer, p, r);
      r.label.textContent = r.name + ' · ' + r.lvl + (p.c && RPG.CLASSES[p.c] ? ' ' + RPG.CLASSES[p.c].i : '');
      if(lookOf(p) !== r.key) buildRemote(r, p);
      r.obj.position.set(r.x, heightAt(r.x, r.z), r.z);
      const inst = r.inst;
      if(inst){
        inst.obj.rotation.y = lerpAngle(inst.obj.rotation.y, r.hd, Math.min(1, dt*10));
        if(Array.isArray(p.a) && r.act !== p.a[0]){ if(r.act != null && typeof p.a[1] === 'string' && /^[A-Za-z0-9]{1,16}$/.test(p.a[1])) inst.oneShot(p.a[1], { speed: Math.max(.5, Math.min(2, +p.a[2] || 1)) }); r.act = p.a[0]; }
        if(r.dead){ if(!r.wasDead){ inst.oneShot('Death', { keep: true, fade: .1 }); r.wasDead = true; } }
        else { if(r.wasDead){ inst.play('Idle', { fade: .2, restart: true }); r.wasDead = false; } if(!inst.busy()) inst.play(r.mv === 2 ? 'Run' : r.mv === 1 ? 'Walk' : 'Idle'); }
        const far = Math.hypot(r.x - agent.x, r.z - agent.z); r.obj.visible = far < 160 && (r.x > 2500) === under;
        if(r.obj.visible && far < 80) inst.update(dt, r.mv > 0); inst.tick(dt);
      }
      if(Array.isArray(p.say) && p.say[0] !== r.sayT && typeof p.say[1] === 'string'){ const t = cleanText(p.say[1]); if(r.sayT !== 0 && t) { logChat(r.name, t); bubbleFor(r, t); } r.sayT = p.say[0]; }
      if(combat && combat.isHost() && Array.isArray(p.hits)) combat.absorbHits(o2.peer, p.hits);
    });
    remotes.forEach((r, peer) => { if(!seen.has(peer)){ life.gone(peer); scene.remove(r.obj); r.label.remove(); remotes.delete(peer); logChat('', '🚪 ' + (r.name || 'Гравець') + ' виходить', true); } });
    root.querySelector('[data-gm=players] span').textContent = String(remotes.size + 1);
    // labels & bubbles over remote players
    const w2 = root.clientWidth, h2 = root.clientHeight;
    remotes.forEach(r => { if(!r.obj.visible){ r.label.style.opacity = 0; return; } v3.set(r.x, r.obj.position.y + 2.25, r.z); const dist = camera.position.distanceTo(v3); v3.project(camera); const vis = v3.z < 1 && dist < 45 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1; r.label.style.opacity = vis ? 1 : 0; if(vis) r.label.style.transform = 'translate(-50%,-100%) translate(' + ((v3.x*.5 + .5)*w2).toFixed(1) + 'px,' + ((-v3.y*.5 + .5)*h2).toFixed(1) + 'px)'; });
    for(let i = bubbles.length - 1; i >= 0; i--){ const b = bubbles[i]; b.t -= dt; if(b.t <= 0){ b.el.remove(); bubbles.splice(i, 1); continue; } const o3 = b.r.obj; v3.set(o3.position.x, o3.position.y + 2.6, o3.position.z); v3.project(camera); b.el.style.opacity = v3.z < 1 ? Math.min(1, b.t) : 0; b.el.style.transform = 'translate(-50%,-100%) translate(' + ((v3.x*.5 + .5)*w2).toFixed(1) + 'px,' + ((-v3.y*.5 + .5)*h2 - 6).toFixed(1) + 'px)'; }
  }
  function playersSheet(){
    const rows = ['<div><span><b>' + esc(myName()) + '</b> (ви)</span><span>' + (P.reg ? RPG.CLASSES[P.cls].i + ' ' + RPG.CLASSES[P.cls].n + ' · ' : '') + P.lvl + ' рів.</span></div>'];
    remotes.forEach(r => rows.push('<div><span>' + esc(r.name) + (r.guest ? ' <small style="opacity:.6">гість</small>' : '') + '</span><span>' + (r.cls && RPG.CLASSES[r.cls] ? RPG.CLASSES[r.cls].i + ' ' + RPG.CLASSES[r.cls].n + ' · ' : '') + r.lvl + ' рів.' + (r.dead ? ' · 💀' : '') + '</span></div>'));
    const worldUrl = (() => { try{ return location.href.split('#')[0]; }catch(e){ return ''; } })();
    if(net.p2p){
      const note2 = '<p class="gm-note">Надішліть друзям посилання на гру — усі, хто його відкриє, з\'являться в одному світі. Для окремого світу лише для вашої компанії додайте до адреси <b>?w=назва</b>, наприклад <b>?w=druzi</b>.</p><p style="word-break:break-all;font-size:12px;opacity:.85">' + esc(worldUrl) + '</p>';
      sheetOpts({ title: 'Гравці онлайн · ' + (remotes.size + 1), html: '<div class="gm-pl">' + rows.join('') + '</div>' + note2, buttons: [{ label: '🔗 Скопіювати посилання', primary: true, fn: () => { const done = () => ui.toast('🔗 Посилання скопійовано'); try{ navigator.clipboard.writeText(worldUrl).then(done, () => ui.toast(worldUrl)); }catch(e){ ui.toast(worldUrl); } } }, { label: '💬 Написати всім', fn: () => { hideSheet(); openChat(); } }, { label: 'Закрити', ghost: true, fn: hideSheet }] });
      return;
    }
    const note = net.room ? '<p class="gm-note">Друзі бачать вас, якщо ви запросили їх до цього артефакту через «Поділитися», і вони увійшли в акаунт Claude.</p>' : '<p class="gm-note">Зараз ви граєте самі: спільна гра працює для друзів, запрошених до артефакту за email.</p>';
    sheetOpts({ title: 'Гравці онлайн · ' + (remotes.size + 1), html: '<div class="gm-pl">' + rows.join('') + '</div>' + note, buttons: [{ label: '💬 Написати всім', primary: true, fn: () => { hideSheet(); openChat(); } }, { label: 'Закрити', ghost: true, fn: hideSheet }] });
  }
  cloudInit().then(newer => { if(!newer) return; const S2 = saveGet(); const fresh = S2.rpg; if(!fresh) return; Object.keys(P).forEach(k => delete P[k]); Object.assign(P, fresh); S2.rpg = P; combat.recalc(); combat.fullHeal(); spawnHero(); ui.buildActions && ui.buildActions(); ui.hud(); ui.toast('☁️ Завантажено ваше збереження з іншого пристрою'); });
  net.start().then(() => { if(net.room) logChat('', net.p2p ? '🌐 Ви онлайн. Друзі, які відкриють це саме посилання, з\'являться тут.' : '🌐 Ви онлайн. Запрошені друзі з\'являться тут, щойно відкриють гру.', true); });
  if(!P.reg) setTimeout(() => ui.toast('Ви прокинулися в незнайомому місті. Зайдіть до Гільдії авантюристів, щоб отримати картку.', 'big'), 4500);


  function wardrobe(){
    const S = saveGet(); S.look3d = S.look3d || { kind: 'man', outfit: 0 };
    const kinds = [['man', '🧔', 'Чоловік'], ['woman', '👩', 'Жінка'], ['soldier', '🛡️', 'У латах'], ['nm_catfig', '🐱', 'Котяча шапка'],
      ['nm_mx_akai', '🏹', 'Акай'], ['nm_mx_erika', '🎯', 'Еріка'], ['nm_mx_arissa', '🗡️', 'Арісса'], ['nm_mx_kachujin', '⚔️', 'Качуджин'], ['nm_mx_maria', '⚒️', 'Марія'], ['nm_mx_maria_w', '🗡️', 'Марія з мечем'],
      ['nm_mx_eve', '🧭', 'Єва'], ['nm_mx_medea', '🔮', 'Медея'], ['nm_mx_brute', '💪', 'Громило'], ['nm_mx_ch05', '⛑️', 'Ветеран'], ['nm_mx_dreyar', '🛡️', 'Дреяр'], ['nm_mx_ganfaul', '🧙', 'Ганфаул'],
      ['nm_mx_heraklios', '🎭', 'Гераклій'], ['nm_mx_paladin', '✝️', 'Паладин'], ['nm_mx_uriel', '👑', 'Уріель'], ['nm_mx_peasant_m', '🌾', 'Селянин'], ['nm_mx_peasant_f', '🧺', 'Селянка']];
    const html = '<p>Оберіть тіло героя й колір одягу. Колір одягу змінює лише перші три тіла. Зброя, плащ і капелюх залежать від класу та спорядження.</p><div class="gm-pick" style="max-height:42vh;overflow:auto">' + kinds.map(k => '<button data-k="' + k[0] + '"' + (S.look3d.kind === k[0] ? ' class="on"' : '') + '><i>' + k[1] + '</i>' + k[2] + '</button>').join('') + '</div>' +
      '<p style="margin-bottom:6px">Колір одягу</p><div class="gm-sw">' + OUTFITS.map((o, i) => '<button data-o="' + i + '" style="background:linear-gradient(135deg,' + o.top + ' 50%,' + o.bottom + ' 50%)"' + ((S.look3d.outfit || 0) === i ? ' class="on"' : '') + '></button>').join('') + '</div>';
    sheetOpts({ title: 'Герой', html, buttons: [{ label: 'Готово', primary: true, fn: hideSheet }], after: el => {
      el.querySelectorAll('[data-k]').forEach(b => b.onclick = async () => { S.look3d.kind = b.dataset.k; saveCommit(); el.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); await spawnHero(); });
      el.querySelectorAll('[data-o]').forEach(b => b.onclick = async () => { S.look3d.outfit = +b.dataset.o; saveCommit(); el.querySelectorAll('[data-o]').forEach(x => x.classList.toggle('on', x === b)); await spawnHero(); });
    } });
  }
  function qualitySheet(){
    const names = [['low', 'Низька — для слабких телефонів'], ['medium', 'Середня — баланс'], ['high', 'Висока — максимум реалізму']];
    sheetOpts({ title: 'Якість графіки', html: '<p>Зараз: <b>' + ({ low: 'низька', medium: 'середня', high: 'висока' })[qName] + '</b>. Висока вмикає повну SSAO-тінь, 4K тіні й густу траву.</p>', buttons: names.map(([k, l]) => ({ label: l, primary: k === qName, fn: () => { setQuality(k); autoLocked = true; qualitySheet(); } })).concat([{ label: 'Закрити', ghost: true, fn: hideSheet }]) });
  }
  function setQuality(k){
    qName = k; Q = QUALITY[k]; lsSet('ritm-game-quality', k);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
    sky.sun.shadow.mapSize.set(Q.shadow, Q.shadow); if(sky.sun.shadow.map){ sky.sun.shadow.map.dispose(); sky.sun.shadow.map = null; }
    if(grassField) grassField.setDensity(Q.grassK/230);
    if(forest) forest.setNear(Q.treeR, Q.treeMax);
    buildPool(Q.lights); poolT = 0;
    resize(); buildComposer();
  }

  // tap marker
  const marker = new THREE.Mesh(new THREE.RingGeometry(.3, .42, 32), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI/2; marker.position.y = .06; scene.add(marker);
  let markerT = 0;

  // camera state
  const cam = { yaw: 0, pitch: .36, dist: 9.5, tYaw: 0, tPitch: .36, tDist: 9.5, introT: 0, mode: 0 };

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pick(cx, cy){
    const rc = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - rc.left)/rc.width)*2 - 1, -((cy - rc.top)/rc.height)*2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(combat ? combat.pickables().concat(town.pickables) : town.pickables, false);
    if(hits.length){ const m = hits[0].object; if(m.userData.mon) return { mon: m.userData.mon }; if(m.userData.npc) return { npc: m.userData.npc }; if(m.userData.interact) return { building: m.userData.interact }; }
    const wh = town.where(agent.x, agent.z);
    if(wh !== 'town' && wh !== 'dungeon'){ const gh = ray.intersectObject(ground.mesh, true); if(gh.length) return { point: gh[0].point }; }
    const p = new THREE.Vector3();
    if(ray.ray.intersectPlane(groundPlane, p)) return { point: p };
    return null;
  }
  function route(x, z){
    const from = town.where(agent.x, agent.z), to = town.where(x, z);
    if(from === 'dungeon' || to === 'dungeon') return from === to ? dun.findPath(agent.x, agent.z, x, z) : [[agent.x, agent.z]];
    if(from === 'town' && to === 'town') return town.findPath(agent.x, agent.z, x, z);
    const gateFor = (px, pz) => { let best = GATES[0], bd = 1e9; GATES.forEach(G => { const d = Math.hypot(G.out[0] - px, G.out[1] - pz) + Math.hypot(G.in[0] - agent.x, G.in[1] - agent.z)*.3; if(d < bd){ bd = d; best = G; } }); return best; };
    if(from === 'town'){ const G = gateFor(x, z); const post = town.findPathWild(G.out[0], G.out[1], x, z); return town.findPath(agent.x, agent.z, G.in[0], G.in[1]).concat([[G.cx*(WALL_R + 3), G.sz*(WALL_R + 3)], G.out]).concat(post.length ? post : [[x, z]]); }
    if(from === 'gate' && to === 'town'){ return town.findPath(agent.x, agent.z, x, z); }
    if(to === 'town' || to === 'gate'){ const G = town.nearestGate(agent.x, agent.z); const pre = town.findPathWild(agent.x, agent.z, G.out[0], G.out[1]); return pre.concat([[G.cx*(WALL_R + 3), G.sz*(WALL_R + 3)], G.in.slice()]).concat(to === 'town' ? town.findPath(G.in[0], G.in[1], x, z) : [[x, z]]); }
    const pw = town.findPathWild(agent.x, agent.z, x, z); return pw.length ? pw : [[x, z]];
  }
  function walkTo(x, z, onArrive){
    agent.chasing = false;
    agent.path = route(x, z);
    agent.onArrive = onArrive || null;
    let L = 0, px = agent.x, pz = agent.z; agent.path.forEach(([a, b]) => { L += Math.hypot(a - px, b - pz); px = a; pz = b; });
    agent.run = L > 7;
    if(!agent.path.length && onArrive){ onArrive(); agent.onArrive = null; }
  }
  function doInteract(){ if(!heroInst) return; heroBusy = true; heroInst.play('Interact', { once: true, fade: .2 }); setTimeout(() => { heroBusy = false; }, 1400); }
  function say(npc, text){ bubbleNpc = npc; npc.bubbleT = 4.6; bubble.textContent = text; bubble.classList.add('on'); if(npc.inst){ npc.inst.talk(Math.min(3.5, text.length*.06)); npc.inst.smile(.6); setTimeout(() => npc.inst && npc.inst.smile(0), 4000); } }
  function onTap(cx, cy){
    hint.style.opacity = 0;
    if(life.tap(cx, cy)) return;
    const r = pick(cx, cy); if(!r) return;
    hideSheet();
    if(r.mon){ if(!P.reg){ ui.toast('Спершу зареєструйтеся в Гільдії'); return; } combat.setTarget(r.mon); combat.H.queued = null; return; }
    if(combat && combat.H.dead) return;
    if(combat) combat.setTarget(null);
    if(r.point){
      marker.position.set(r.point.x, heightAt(r.point.x, r.point.z) + .06, r.point.z); markerT = 1; life.noteTap(r.point.x, r.point.z);
      walkTo(r.point.x, r.point.z);
    } else if(r.building){
      const b = r.building; marker.position.set(b.door.x, heightAt(b.door.x, b.door.z) + .06, b.door.z); markerT = 1;
      walkTo(b.door.x, b.door.z, () => { agent.heading = Math.atan2(b.pos.x - agent.x, b.pos.z - agent.z); doInteract(); openBuilding(b); });
    } else if(r.npc){
      const n = r.npc; const dx = agent.x - n.a.x, dz = agent.z - n.a.z, d = Math.hypot(dx, dz) || 1;
      const tx = n.a.x + dx/d*1.4, tz = n.a.z + dz/d*1.4;
      n.a.path = []; n.wait = 7;
      walkTo(tx, tz, () => { agent.heading = Math.atan2(n.a.x - agent.x, n.a.z - agent.z); n.a.heading = Math.atan2(agent.x - n.a.x, agent.z - n.a.z); doInteract(); if(n.inst){ n.inst.play('Cheer', { once: true }); setTimeout(() => { if(n.inst) n.inst.play(n.def.idle || 'Idle'); }, 1800); } const L = n.def.lines; say(n, L[Math.floor(Math.random()*L.length)]); const qn = P.reg && (RPG.QUEST_POOL.some(q => q.giver === n.def.id && !P.done[q.id]) || P.quests.some(a => { const Q = RPG.QUEST_POOL.find(q => q.id === a.id); return Q && ((Q.type === 'talk' && Q.to === n.def.id && !a.prog) || Q.giver === n.def.id); }));
        if(!qn && !n.def.adv && life.talk(n)) return;
        if(n.def.service) setTimeout(() => openService(n.def.service), 900); else if(n.def.adv) setTimeout(() => advSheet(n), 900); else if(P.reg) setTimeout(() => talkTo(n), 900); });
    }
  }
  function temple(){
    sheetOpts({ title: 'Храм Світла', html: '<p>Тиша, ладан і тепле світло вітражів. Жриця Оранта лікує авантюристів без плати.</p>', buttons: [
      { label: '✨ Прийняти зцілення', primary: true, fn: () => { combat && combat.fullHeal(); const p = heroObj.position; combat && combat.emit(p.x, p.y + .3, p.z, 50, '#ffe9a0', 1, 1.3, .16, 2.6); ui.toast('Світло зцілило ваші рани'); hideSheet(); } },
      { label: 'Помолитися й піти', ghost: true, fn: hideSheet }] });
  }
  // side quests: deliveries finish on talking, givers open their list
  function talkTo(n){
    const id = n.def.id; let delivered = false;
    P.quests.forEach(a => { const Q = RPG.QUEST_POOL.find(q => q.id === a.id); if(Q && Q.type === 'talk' && Q.to === id && !a.prog){ a.prog = 1; delivered = true; ui.toast('📦 Доручення «' + Q.n + '» виконано — поверніться до замовника', 'loot'); } });
    if(delivered) RPG.save();
    if(RPG.QUEST_POOL.some(q => q.giver === id)) ui.npcQuests(id, n.def.name, n.def.lines[Math.floor(Math.random()*n.def.lines.length)]);
  }
  function questMark(id){ if(!P.reg) return ''; const act = P.quests.map(a => ({ a, Q: RPG.QUEST_POOL.find(q => q.id === a.id) })).filter(x => x.Q && x.Q.giver === id);
    if(act.some(x => RPG.questDone(P, x.a, x.Q))) return '❓ '; if(RPG.QUEST_POOL.some(q => q.giver === id && !P.done[q.id] && !P.quests.some(a => a.id === q.id))) return '❗ '; return ''; }
  let questT = 0;
  function questTick(dt){
    questT -= dt; if(questT > 0) return; questT = 1;
    npcs.forEach(n => { const lb = labels.find(l => l.npc === n); if(lb){ const t = questMark(n.def.id) + n.def.name; if(lb.el.textContent !== t) lb.el.textContent = t; } });
    if(!P.reg) return; const zn = zoneAt(agent.x, agent.z);
    if(zn) P.quests.forEach(a => { const Q = RPG.QUEST_POOL.find(q => q.id === a.id); if(Q && Q.type === 'visit' && Q.zone === zn.id && !a.prog){ a.prog = 1; RPG.save(); ui.toast('🧭 «' + Q.n + '»: місце знайдено — поверніться до замовника', 'loot'); } });
  }
  function openService(s){ if(s === 'shop'){ const zz = zoneAt(agent.x, agent.z); if(zz && life.shop(zz.id)) return; } if(s === 'temple') return temple(); if(s === 'dungeon') return dungeonSheet(town.interactives.find(q => q.id === 'dun_enter')); if(s === 'guild') ui.guild(); else if(s === 'shop') P.reg ? ui.shop() : ui.toast('Крамниця обслуговує лише зареєстрованих авантюристів'); else if(s === 'forge') P.reg ? ui.forge() : ui.toast('Спершу зареєструйтеся в Гільдії'); }
  function openBuilding(b0){
    if(life.building(b0)) return;
    const b = /^(guild|shop|forge|tavern|temple)2$/.test(b0.id || '') ? Object.assign({}, b0, { id: b0.id.slice(0, -1) }) : b0;
    if(b.id && b.id.startsWith('dun_')) return dungeonSheet(b);
    if(b.id === 'guild') return ui.guild();
    if(b.id === 'temple') return temple();
    if(b.id === 'board') return P.reg ? ui.questBoard() : ui.guild();
    if(b.id === 'shop' || b.id === 'forge') return openService(b.id);
    if(b.id === 'tavern') return ui.tavern();
    if(b.id === 'wardrobe') return wardrobe();
    if(b.id === 'arena') return ui.gate();
    if(b.id && b.id.startsWith('way:')){ if(nav) nav.openMap(); return; }
    if(b.action && Features.run(b.action, featApi)) return;
    showSheet(b.name, b.desc);
  }
  // ---------- Підземелля Авантюристів ----------
  const fadeEl = document.createElement('div'); fadeEl.className = 'gm-fade'; root.appendChild(fadeEl);
  let under = false, curFloor = -1;
  const lantern = new THREE.PointLight('#ffc48a', 0, 24, 2); scene.add(lantern);
  function setUnder(on){
    under = on; surface.forEach(o => { o.visible = !on; }); dun.group.visible = on; sky.setUnderground(on); lantern.intensity = on ? 28 : 0;
    if(on){ cam.tPitch = Math.max(cam.tPitch, .62); cam.tDist = Math.min(Math.max(cam.tDist, 10.5), 16); }
  }
  function travel(x, z, heading, after){
    hideSheet(); fadeEl.style.opacity = 1;
    setTimeout(() => {
      agent.x = x; agent.z = z; agent.path = []; agent.onArrive = null; agent.heading = heading; agent.moving = false;
      heroObj.position.set(x, heightAt(x, z), z); if(heroInst) heroInst.obj.rotation.y = heading;
      if(combat){ combat.setTarget(null); combat.H.queued = null; }
      let y = heading + Math.PI; while(y > Math.PI) y -= Math.PI*2; cam.yaw = cam.tYaw = y; camSmooth.set(0, 0, 0);
      after && after();
      setTimeout(() => { fadeEl.style.opacity = 0; }, 160);
    }, 380);
  }
  function enterFloor(i, atStairs){
    const F = DFLOORS[i], OX = dun.floors[i].OX;
    if(i > P.dun.max){ P.dun.max = i; RPG.save(); }
    if(atStairs && F.down) travel(OX + F.down[0], F.down[1] + 3.6, 0);
    else travel(OX + F.start[0], F.start[1], Math.PI);
  }
  function toSurface(){ travel(DENTRY.x + 3.4, DENTRY.z, Math.PI/2); }
  const rankR = i => RPG.RANKS[i].r;
  function dungeonSheet(b){
    if(!b) return;
    if(!P.reg){ ui.toast('Підземелля відкрите лише для зареєстрованих авантюристів Гільдії'); return; }
    const fi = b.floor;
    if(b.id === 'dun_enter'){
      const rows = DFLOORS.map((F, i) => '<div class="rp-q"><b>' + (i <= P.dun.max ? '' : '🔒 ') + F.n + '</b> <span style="opacity:.6;font-size:11px">ранг ' + rankR(F.rank) + '+ · рів. ' + F.lvl + '</span><div style="font-size:12px">' + ['Печери кобольдів і отруйних слизів. Внизу — Вождь кобольдів Гракх.', 'Склепи з упирями, привидами й скелетами. Їх охороняє Кістяний лицар Морен.', 'Культисти Безодні, темні лицарі та мінотаври. На дні — Астерій, Мінотавр Глибин.'][i] + '</div></div>').join('');
      const low = P.lvl < 6 ? '<p class="gm-note">Наглядачка хмуриться: «Ви ще зелений, рівень ' + P.lvl + '. На I ярусі монстри 6–10 рівня. Візьміть зілля!»</p>' : '';
      const btns = [{ label: '⬇️ Спуститися на I ярус', primary: true, fn: () => enterFloor(0) }];
      for(let i = 1; i <= P.dun.max && i < DFLOORS.length; i++) btns.push({ label: '🌀 Портал Гільдії: одразу на ' + ['I', 'II', 'III'][i] + ' ярус', fn: () => enterFloor(i) });
      btns.push({ label: 'Не зараз', ghost: true, fn: hideSheet });
      sheetOpts({ title: 'Підземелля Авантюристів', html: '<p>Гільдія охороняє вхід у древній лабіринт. Що глибше ярус — то сильніші монстри й цінніший лут. Біля входу на кожен ярус світиться руна повернення.</p>' + rows + low, buttons: btns });
    } else if(b.id === 'dun_up'){
      const btns = [{ label: '☀️ Вийти на поверхню', primary: true, fn: toSurface }];
      if(fi > 0) btns.push({ label: '⬆️ Піднятися на ' + ['I', 'II'][fi - 1] + ' ярус', fn: () => enterFloor(fi - 1, true) });
      btns.push({ label: 'Залишитися', ghost: true, fn: hideSheet });
      sheetOpts({ title: 'Руна повернення', html: '<p>Блакитна руна тремтить під ногами. Вона може підняти вас нагору.</p>', buttons: btns });
    } else if(b.id === 'dun_down'){
      const N = DFLOORS[fi + 1];
      sheetOpts({ title: 'Спуск на ' + N.n.split(' · ')[0], html: '<p>Сходи йдуть у темряву. Знизу тягне холодом і чути гуркіт.</p><div class="rp-q"><b>' + N.n + '</b><div style="font-size:12px">Рекомендовано: ранг ' + rankR(N.rank) + '+, рівні ' + N.lvl + '. Ваш рівень: ' + P.lvl + '.</div></div>',
        buttons: [{ label: '⬇️ Спуститися', primary: true, fn: () => enterFloor(fi + 1) }, { label: 'Ще ні', ghost: true, fn: hideSheet }] });
    } else if(b.id === 'dun_chest'){
      if(!P.dun.chest){ sheetOpts({ title: 'Скарбниця Мінотавра', html: '<p>Важка скриня окута золотом. Замок не піддається — його зламає лише смерть Астерія.</p>', buttons: [{ label: 'Закрити', fn: hideSheet }] }); return; }
      const C = RPG.CLASSES[P.cls]; const items = [RPG.makeEquip(C.wpn, 4, 4), RPG.makeEquip(['armor', 'helm', 'ring', 'amulet'][Math.floor(Math.random()*4)], 4, 3 + (Math.random() < .35 ? 1 : 0)), { k: 'use', id: 'hp3', q: 3 }, { k: 'use', id: 'mp2', q: 2 }, { k: 'mat', id: 'mhorn', q: 1 }];
      const gold = 650 + Math.floor(Math.random()*350);
      P.dun.chest = false; P.gold += gold; const got = items.filter(it => RPG.addItem(P, it));
      RPG.save(); ui.hud(); const L = dun.floors[2].chestLid; if(L) L.rotation.x = -1.1;
      if(combat){ const p = heroObj.position; combat.emit(p.x, p.y + 1, p.z - 1.5, 80, '#ffd27a', 3, 1.4, .2, 2.5); }
      sheetOpts({ title: '🗝️ Скарбниця відчинена!', html: '<p>Золото, самоцвіти й зброя давніх героїв.</p><div class="rp-q"><b>+' + gold + ' 💰</b>' + got.map(it => '<div style="color:' + RPG.itemColor(it) + '">' + RPG.itemIcon(it) + ' ' + RPG.itemName(it) + (it.q > 1 ? ' ×' + it.q : '') + '</div>').join('') + (got.length < items.length ? '<div class="gm-note">Рюкзак переповнений — частина скарбів лишилася.</div>' : '') + '</div>',
        buttons: [{ label: 'Чудово!', primary: true, fn: () => { hideSheet(); setTimeout(() => { if(L) L.rotation.x = 0; }, 2500); } }] });
    }
  }
  const dunTrig = new Map();
  function dungeonTick(dt){
    const now = isDun(agent.x);
    if(now !== under) setUnder(now);
    if(!now){ curFloor = -1; return; }
    const fi = dun.floorIndex(agent.x);
    if(fi !== curFloor){ curFloor = fi; dun.floors.forEach((f, i) => { f.fg.visible = i === fi; }); }
    // step-on prompts: rune circle & stairs
    town.interactives.forEach(b => { if(b.floor !== fi || (b.id !== 'dun_up' && b.id !== 'dun_down')) return;
      const d = Math.hypot(agent.x - b.door.x, agent.z - b.door.z); const st = dunTrig.get(b) || { armed: false };
      if(d > 3) st.armed = true; else if(d < (b.id === 'dun_up' ? 1.0 : 1.3) && st.armed && !(combat && combat.H.dead)){ st.armed = false; agent.path = []; openBuilding(b); }
      dunTrig.set(b, st); });
    const cg = dun.floors[2].chestGlow; if(cg) cg.material.opacity = P.dun.chest ? .55 + Math.sin(T*3)*.2 : 0;
  }
  const hint = root.querySelector('.gm-hint');

  // input
  const dom = renderer.domElement, ptrs = new Map(); let moved = 0, pinch = 0, downAt = 0;
  dom.addEventListener('pointerdown', e => { dom.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if(ptrs.size === 1){ moved = 0; downAt = performance.now(); } if(ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); moved = 99; } });
  dom.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if(!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if(ptrs.size === 1){ moved += Math.abs(dx) + Math.abs(dy); if(moved > 8){ cam.tYaw -= dx*.0065*life.camSens(); cam.tPitch = Math.max(.06, Math.min(1.3, cam.tPitch + dy*.0045*life.camSens())); } }
    else if(ptrs.size === 2){ const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); cam.tDist = Math.max(2.6, Math.min(48, cam.tDist*(pinch/d))); pinch = d; }
  });
  const up = e => { const had = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); if(had && ptrs.size === 0 && moved <= 8 && performance.now() - downAt < 600 && e.type === 'pointerup') onTap(e.clientX, e.clientY); };
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  dom.addEventListener('wheel', e => { e.preventDefault(); cam.tDist = Math.max(2.6, Math.min(48, cam.tDist*(1 + e.deltaY*.0012))); }, { passive: false });
  const keys = kset;
  const kd = e => { if(e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; if(e.code === 'Tab') e.preventDefault(); if(life.key(e)) return; if(e.code === 'Enter'){ e.preventDefault(); openChat(); return; } if(e.code === 'KeyM' && nav){ nav.isOpen() ? nav.closeMap() : nav.openMap(); return; } if(e.code === 'Escape' && nav && nav.isOpen()){ nav.closeMap(); return; } keys.add(e.code); if(combat && P.reg){ if(e.code === 'Tab'){ e.preventDefault(); const ev = combat.H.target; if(!ev || ev.dead){ const n = combat.nearestMonster(16); if(n) combat.setTarget(n); } } if(e.code === 'Digit1') combat.useSkill(0); if(e.code === 'Digit2') combat.useSkill(1); if(e.code === 'Digit3') combat.useSkill(2); if(e.code === 'KeyQ') combat.usePotion('hp'); if(e.code === 'KeyE') combat.usePotion('mp'); if(e.code === 'KeyI') ui.inventory(); } if(/Key[WASD]|Arrow/.test(e.code)){ agent.path = []; agent.onArrive = null; hint.style.opacity = 0; } };
  const ku = e => { keys.delete(e.code); life.key(e, false); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

  root.addEventListener('click', e => {
    const a = e.target.closest('[data-gm]'); if(!a) return;
    const k = a.getAttribute('data-gm');
    if(k === 'back'){ close(); if(ctx.onExit) ctx.onExit(); }
    else if(k === 'bag') ui.inventory();
    else if(k === 'players') playersSheet();
    else if(k === 'chat') openChat();
    else if(k === 'quests') P.reg ? ui.questBoard() : ui.guild();
    else if(k === 'card') P.reg ? ui.showCard() : ui.guild();
    else if(k === 'wardrobe') wardrobe();
    else if(k === 'quality') qualitySheet();
    else if(k === 'time'){ todIdx = (todIdx + 1) % todPresets.length; sky.setTime(todPresets[todIdx].h); a.textContent = todPresets[todIdx].i; lsSet('ritm-game-tod', String(todIdx)); }
    else if(k === 'sound'){ setSound(!soundOn()); root.querySelector('[data-gm=sound]').textContent = soundOn() ? '🔊' : '🔇'; ui.toast(soundOn() ? '🔊 Звук увімкнено' : '🔇 Звук вимкнено'); }
    else if(k === 'map'){ nav && (nav.isOpen() ? nav.closeMap() : nav.openMap()); }
    else if(k === 'cam'){ cam.mode = (cam.mode + 1) % 3; camSmooth.set(0, 0, 0); const m = [[9.5, .36], [4.2, .16], [24, .85]][cam.mode]; cam.tDist = m[0]; cam.tPitch = m[1]; }
  });

  function resize(){ const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w, h, false); camera.aspect = w/h; camera.fov = w/h < .8 ? 60 : 48; camera.updateProjectionMatrix(); if(composer){ composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); } }
  window.addEventListener('resize', resize); resize();
  buildComposer();

  // ---------- loop ----------
  const clock = new THREE.Clock(); let raf = 0, T = 0, fpsAcc = 0, fpsN = 0;
  const v3 = new THREE.Vector3(), focus = new THREE.Vector3(), camSmooth = new THREE.Vector3(), _cv = new THREE.Vector3(); let camHitPrev = 1;
  // camera occlusion vs. tall colliders (oriented boxes with a height)
  const tallAll = town.colliders.filter(c => c.h); let tall = [], tallC = [];
  function camBlock(ax, ay, az, bx, by, bz){
    let best = 1;
    // tree canopies (spheres) and trunks
    const dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx*dx + dy*dy + dz*dz;
    for(const t of camNear){
      const ox = ax - t.x, oy = ay - (heightAt(t.x, t.z) + t.y), oz = az - t.z;
      const b = ox*dx + oy*dy + oz*dz, c = ox*ox + oy*oy + oz*oz - t.r*t.r; const disc = b*b - L2*c;
      if(disc > 0){ const t0 = (-b - Math.sqrt(disc))/L2; if(t0 > .05 && t0 < best) best = t0; }
    }
    for(const c of tall){
      const cs = Math.cos(c.ang), sn = Math.sin(c.ang);
      const lax = (ax - c.x)*cs - (az - c.z)*sn, laz = (ax - c.x)*sn + (az - c.z)*cs;
      const lbx = (bx - c.x)*cs - (bz - c.z)*sn, lbz = (bx - c.x)*sn + (bz - c.z)*cs;
      const dx = lbx - lax, dz = lbz - laz;
      let t0 = 0, t1 = 1;
      const slab = (p, d, h) => { if(Math.abs(d) < 1e-6) return Math.abs(p) <= h; let u0 = (-h - p)/d, u1 = (h - p)/d; if(u0 > u1){ const q = u0; u0 = u1; u1 = q; } t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); return t0 <= t1; };
      if(!slab(lax, dx, c.hw + .2) || !slab(laz, dz, c.hd + .2)) continue;
      const yAt = ay + (by - ay)*t0; if(yAt > c.h) continue;
      if(t0 < best) best = t0;
    }
    for(const c of tallC){ // towers, pillars, waystones: vertical cylinders
      const ox = ax - c.x, oz = az - c.z, ddx = bx - ax, ddz = bz - az; const A = ddx*ddx + ddz*ddz; if(A < 1e-6) continue; const B = ox*ddx + oz*ddz, Cc = ox*ox + oz*oz - (c.r + .2)*(c.r + .2); const disc = B*B - A*Cc; if(disc <= 0) continue;
      const t0 = (-B - Math.sqrt(disc))/A; if(t0 <= .05 || t0 >= best) continue; const yAt = ay + (by - ay)*t0; if(yAt > c.h) continue; best = t0; }
    return best;
  }
  function stepAgent(a, dt, speed){
    a.moving = false;
    if(a.path.length){
      const [tx, tz] = a.path[0]; const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
      const step = (speed || a.speed)*dt;
      if(d <= step + .02){ a.x = tx; a.z = tz; a.path.shift(); if(!a.path.length && a.onArrive){ const f = a.onArrive; a.onArrive = null; f(); } }
      else { a.x += dx/d*step; a.z += dz/d*step; a.heading = Math.atan2(dx, dz); a.moving = true; }
      WOPT.hero = a === agent; const [rx, rz] = town.resolve(a.x, a.z, .38); WOPT.hero = false; a.x = rx; a.z = rz;
    }
  }
  let paused = false, lowFps = 0, autoLocked = false, hudT = 0;
  let skipRender = false;
  function frame(fixedDt){
    if(!paused) raf = requestAnimationFrame(() => frame());
    const dt = fixedDt || Math.min(.05, clock.getDelta()); T += dt;
    if(life.inInterior()){ syncRemotes(dt); presenceOut(performance.now()); life.interiorFrame(dt); return; }
    fpsAcc += dt; fpsN++;
    if(fpsAcc > 1){
      const fps = fpsN/fpsAcc; fpsEl.textContent = Math.round(fps) + ' fps · ' + qName; fpsAcc = 0; fpsN = 0;
      // adaptive quality: step down once per level if the device struggles for ~5 s
      if(ready && !paused && !document.hidden){ lowFps = fps < 24 ? lowFps + 1 : 0; if(lowFps >= 5 && qName !== 'low' && !autoLocked){ const next = qName === 'high' ? 'medium' : 'low'; setQuality(next); lowFps = 0; hint.textContent = 'Якість графіки знижено до «' + (next === 'medium' ? 'середньої' : 'низької') + '» для плавності. Змінити — ⚙️'; hint.style.opacity = 1; setTimeout(() => hint.style.opacity = 0, 5000); } }
    }
    // keyboard
    let kx = 0, kz = 0;
    if(keys.has('KeyW') || keys.has('ArrowUp')) kz -= 1; if(keys.has('KeyS') || keys.has('ArrowDown')) kz += 1;
    if(keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1; if(keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
    if(combat && combat.H.dead){ kx = 0; kz = 0; agent.path = []; }
    if(kx || kz){ if(combat) combat.setTarget(null);
      const run = !(keys.has('ShiftLeft') || keys.has('ShiftRight'));
      const sp = (run ? 4.4 : 1.6)*(combat ? combat.D.mods.spd : 1)*life.speedMul(), c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
      const wx = kx*c + kz*s, wz = -kx*s + kz*c, l = Math.hypot(wx, wz);
      agent.x += wx/l*sp*dt; agent.z += wz/l*sp*dt; agent.heading = Math.atan2(wx, wz); agent.moving = true; agent.run = run;
      WOPT.hero = true; const [rx, rz] = town.resolve(agent.x, agent.z, .38); WOPT.hero = false; agent.x = rx; agent.z = rz;
    } else stepAgent(agent, dt, (agent.run ? 4.4 : 1.6)*(combat ? combat.D.mods.spd : 1)*life.speedMul());
    heroObj.position.set(agent.x, life.heroY(heightAt(agent.x, agent.z)), agent.z);
    dungeonTick(dt);
    if(heroInst){ heroInst.obj.rotation.y = lerpAngle(heroInst.obj.rotation.y, agent.heading, Math.min(1, dt*10)); heroInst.update(dt, agent.moving); heroInst.tick(dt); if(!heroBusy && !heroInst.busy() && !(combat && combat.H.dead) && !life.blocking() && !life.riding()) heroInst.play(agent.moving ? (agent.run ? 'Run' : 'Walk') : 'Idle'); }
    life.update(dt);
    if(combat){ combat.update(dt, T); }
    if(forest) forest.update(agent.x, agent.z);
    if(!under){ terrain.update(agent.x, agent.z); if(grassField) grassField.update(agent.x, agent.z); if(flowerField) flowerField.update(agent.x, agent.z); }
    syncRemotes(dt); presenceOut(performance.now()); questTick(dt);
    if(advs) advs.update(dt);
    if(nav) nav.update(dt);
    if(agent.moving && heroInst && !(combat && combat.H.dead)){ stepT -= dt; if(stepT <= 0){ stepT = agent.run ? .3 : .45; sfx('step'); } } else stepT = .1;
    ambT -= dt; if(ambT <= 0){ ambT = .25; const wh = town.where(agent.x, agent.z); ambience(.25, { day: sky.state.lampLevel < .5 ? 1 : 0, town: wh === 'town' || Math.hypot(agent.x - CITY2.x, agent.z - CITY2.z) < CITY2.R, quiet: under }); }
    if(town.cull) town.cull(agent.x, agent.z, Q.drawR || 340);
    ringMat.opacity = .35 + Math.sin(T*2.5)*.1;

    npcs.forEach(n => {
      const a = n.a;
      if(n.def.adv) return;
      const dA = Math.hypot(a.x - agent.x, a.z - agent.z);
      if(dA > 140 && !a.path.length){ n.obj.visible = false; return; }
      if(n.def.stat || n.def.post || n.def.at){ /* stays on post */ }
      else if(!a.path.length && n.wait > 0){ n.wait -= dt; }
      else if(!a.path.length){
        if(n.def.area){ const [x, z] = town.randomFree(n.def.area[0], n.def.area[1], n.def.area[2]); a.path = town.findPathWild(a.x, a.z, x, z); n.wait = 4 + Math.random()*8; }
        else { const home = n.def.home ? n.homePos : [0, 0], rad = n.def.home ? 5 : 16;
          const [x, z] = town.randomFree(home[0], home[1], rad); a.path = town.where(home[0], home[1]) === 'town' ? town.findPath(a.x, a.z, x, z) : town.findPathWild(a.x, a.z, x, z); n.wait = 3 + Math.random()*7; }
      }
      const far = dA > 55; n.obj.visible = !far;
      if(far && !a.path.length) return;
      stepAgent(a, dt);
      n.obj.position.set(a.x, heightAt(a.x, a.z), a.z);
      n.obj.rotation.y = lerpAngle(n.obj.rotation.y, a.heading, Math.min(1, dt*6));
      if(n.inst && !far){ n.inst.update(dt, a.moving); if(!n.inst.busy()) n.inst.play(a.moving ? 'Walk' : 'Idle', { speed: a.moving ? .95 : 1 }); }
      if(n.bubbleT > 0){ n.bubbleT -= dt; if(n.bubbleT <= 0 && bubbleNpc === n){ bubble.classList.remove('on'); bubbleNpc = null; } }
    });
    town.anim.forEach(f => f(T, dt));
    wind.time.value = T;

    // night lighting
    const lamp = sky.state.lampLevel;
    poolT -= dt;
    if(poolT <= 0){
      poolT = .3;
      const hx = heroObj.position.x, hz = heroObj.position.z;
      const act = lightSrc.filter(sr => Math.max(lamp, sr.always) > .02).map(sr => ({ sr, d: Math.hypot(sr.pos.x - hx, sr.pos.z - hz) })).sort((a, b) => a.d - b.d).slice(0, pool.length);
      const keep = new Set(act.map(a => a.sr));
      pool.forEach(p => { if(p.src && !keep.has(p.src)) p.src = null; });
      act.forEach(a => { if(!pool.some(p => p.src === a.sr)){ const free = pool.find(p => !p.src); if(free){ free.src = a.sr; free.light.position.copy(a.sr.pos); free.light.color.copy(a.sr.color); free.light.distance = a.sr.dist; free.fade = 0; } } });
    }
    pool.forEach(p => {
      if(!p.src){ p.light.intensity = Math.max(0, p.light.intensity - dt*40); return; }
      const sr = p.src; p.fade = Math.min(1, (p.fade || 0) + dt*2);
      const d = Math.hypot(sr.pos.x - heroObj.position.x, sr.pos.z - heroObj.position.z);
      p.light.intensity = sr.l.base*Math.max(lamp, sr.always)*(sr.l.light.userData.flicker || 1)*p.fade*(1 - THREE.MathUtils.smoothstep(d, 24, 34));
    });
    town.glows.forEach(g => { const op = Math.max(lamp, g.always)*.75; g.s.material.opacity = op; if(!g.wp) g.wp = g.s.getWorldPosition(new THREE.Vector3()); g.s.visible = op > .01 && Math.abs(g.wp.x - agent.x) < 260 && Math.abs(g.wp.z - agent.z) < 260; });
    town.M.glass.emissiveIntensity = town.M.glass.userData.nightGlow*Math.pow(lamp, 1.5);
    town.M.lampGlass.emissiveIntensity = town.M.lampGlass.userData.nightGlow*lamp + .05;
    fireObjs.forEach(f => f.parts.forEach((p, i) => { p.t += dt*(1.3 + i*.15); const k = p.t % 1; const s = f.s*(p.k ? (1 - k)*.9 + .2 : .5 + Math.sin(T*20 + i)*.08); p.sp.position.set(Math.sin(T*7 + i*2)*.05*f.s, k*f.s*.9*(p.k ? 1 : .3), Math.cos(T*6 + i)*.05*f.s); p.sp.scale.set(s, s*1.4, 1); p.sp.material.opacity = (p.k ? (1 - k)*.8 : .9); }));
    birds.forEach(b => { b.mx.update(dt); const a = T*b.sp + b.ph; b.b.position.set(Math.cos(a)*b.r, b.h + Math.sin(T*.4 + b.ph)*2, Math.sin(a)*b.r); b.b.rotation.y = -a; });

    // camera
    cam.introT = Math.min(1, cam.introT + dt/3.2);
    const e = 1 - Math.pow(1 - cam.introT, 3);
    const k = Math.min(1, dt*5);
    cam.pitch += (cam.tPitch - cam.pitch)*k;
    if(cam.introT < 1){ cam.dist = 38 + (cam.tDist - 38)*e; cam.yaw = -1.4 + (cam.tYaw + 1.4)*e; cam.pitch = .75 + (cam.tPitch - .75)*e; }
    else { cam.dist += (cam.tDist - cam.dist)*k; cam.yaw += (cam.tYaw - cam.yaw)*k; }
    const tx = heroObj.position.x, tz = heroObj.position.z;
    const lookY = heroObj.position.y + 1.25 + Math.min(1, cam.dist/20)*.4;
    let cy = lookY + Math.sin(cam.pitch)*cam.dist;
    const cx = tx + Math.sin(cam.yaw)*Math.cos(cam.pitch)*cam.dist, cz = tz + Math.cos(cam.yaw)*Math.cos(cam.pitch)*cam.dist;
    let ccx = cx, ccy = cy, ccz = cz;
    camNearT -= dt; if(camNearT <= 0){ camNearT = .4; camNear = allTrees.filter(t => Math.abs(t.x - tx) < 26 && Math.abs(t.z - tz) < 26); const nr = tallAll.filter(c => Math.abs(c.x - tx) < 45 && Math.abs(c.z - tz) < 45); tall = nr.filter(c => c.type === 'rect'); tallC = nr.filter(c => c.type === 'circle'); }
    if(under){ cam.tPitch = Math.max(cam.tPitch, .4); DCUT.hero.value.set(tx, lookY, tz); lantern.position.set(tx, heroObj.position.y + 3.4, tz); }
    const hit = under ? 1 : camBlock(tx, lookY, tz, cx, cy, cz);
    if(hit < 1){ const k2 = Math.max(.12, hit - .35/cam.dist); ccx = tx + (cx - tx)*k2; ccy = lookY + (cy - lookY)*k2; ccz = tz + (cz - tz)*k2; }
    camSmooth.lerp(_cv.set(ccx, ccy, ccz), camSmooth.lengthSq() ? Math.min(1, dt*(hit < camHitPrev ? 18 : 4)) : 1); camHitPrev = hit;
    camSmooth.y = Math.max(camSmooth.y, heightAt(camSmooth.x, camSmooth.z) + .4);
    camera.position.copy(camSmooth); if(under) DCUT.cam.value.copy(camSmooth);
    const sh = combat ? combat.shake() : 0; if(sh > 0) camera.position.add(_cv.set((Math.random() - .5)*sh*.4, (Math.random() - .5)*sh*.4, (Math.random() - .5)*sh*.4));
    camera.lookAt(tx, lookY, tz);
    focus.set(tx, 0, tz);
    sky.update(dt, T, focus);
    renderer.toneMappingExposure = sky.exposure();
    life.post();

    if(markerT > 0){ markerT -= dt*1.2; marker.material.opacity = Math.max(0, markerT); const s = 1 + (1 - markerT)*.8; marker.scale.set(s, s, s); }

    // labels
    const w = root.clientWidth, h = root.clientHeight;
    labels.forEach(l => {
      if(l.npc){ v3.set(l.npc.a.x, heightAt(l.npc.a.x, l.npc.a.z) + 2.25, l.npc.a.z); } else v3.copy(l.pos);
      const dist = camera.position.distanceTo(v3);
      v3.project(camera);
      const vis = v3.z < 1 && dist < (l.max || 30) + cam.dist*.4 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 && !(l.npc && bubbleNpc === l.npc);
      l.el.style.opacity = vis ? 1 : 0;
      if(vis) l.el.style.transform = 'translate(-50%,-100%) translate(' + ((v3.x*.5 + .5)*w).toFixed(1) + 'px,' + ((-v3.y*.5 + .5)*h).toFixed(1) + 'px)';
    });
    if(bubbleNpc){ v3.set(bubbleNpc.a.x, heightAt(bubbleNpc.a.x, bubbleNpc.a.z) + 2.15, bubbleNpc.a.z); v3.project(camera); bubble.style.transform = 'translate(-50%,-100%) translate(' + ((v3.x*.5 + .5)*w).toFixed(1) + 'px,' + ((-v3.y*.5 + .5)*h - 6).toFixed(1) + 'px)'; }

    if(combat){ ui.frame(dt, agent, agent.heading, combat.monsters, npcs); hudT -= dt; if(hudT <= 0){ hudT = .25; ui.hud(); } }
    if(skipRender) return;
    if(composer) composer.render(dt); else renderer.render(scene, camera);
  }
  frame();

  function goTo(id){ const b = town.interactives.find(q => q.id === id); if(!b) return; walkTo(b.door.x, b.door.z, () => { agent.heading = Math.atan2(b.pos.x - agent.x, b.pos.z - agent.z); doInteract(); openBuilding(b); }); }
  state = { T3: THREE, life, nav: () => nav, goTo, pause(v){ paused = v; if(!v){ clock.getDelta(); frame(); } }, step(n, d){ for(let i = 0; i < (n || 1); i++) frame(d || 1/30); }, sim(n, d){ skipRender = true; try{ for(let i = 0; i < (n || 1); i++) frame(d || 1/30); } finally { skipRender = false; } }, setTime(h){ sky.setTime(h, true); }, root, renderer, raf: () => raf, resize, scene, town, agent, npcs, cam, camera, heroObj, sky, setQuality, kd, ku, isReady: () => ready, combat: () => combat, ui, P, spawnHero: () => spawnHero(), teleport: (x, z) => { agent.x = x; agent.z = z; agent.path = []; camSmooth.set(0, 0, 0); }, enterFloor, toSurface, dun, dungeonSheet, under: () => under };
  window.__gm = state;
}

function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; }

export function close(){
  if(!state) return;
  try{ RPG.saveNow(); }catch(e){}
  cancelAnimationFrame(state.raf());
  window.removeEventListener('resize', state.resize);
  window.removeEventListener('keydown', state.kd); window.removeEventListener('keyup', state.ku);
  state.scene.traverse(o => { if(o.geometry) o.geometry.dispose(); });
  state.renderer.dispose();
  state.root.remove();
  state = null; window.__gm = null;
}

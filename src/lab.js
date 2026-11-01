// =====================================================================================
//  Лабораторія вигляду: quick preview of hero looks with the game's own figure code.
//  Variants can be voted on (👍/👎 + comment); votes live in the artifact db so Claude can
//  read them and move the approved ones into the game.
// =====================================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as F from './figures.js';
import { tex } from './assets.js';
import { NEW_MODELS, GROUPS } from './newmodels.js';

const SKIN = ['#f3d5bf', '#e8c0a0', '#d6a47c', '#b07a52', '#8a5636', '#5e3a24', '#3e2618'];
const HAIR = ['#1a1412', '#3a2a1e', '#6a4428', '#a86a3a', '#d8b070', '#efe2c0', '#b8b8c0', '#8a2a1a', '#2a3a6a'];
const CLOTH = ['#2f4a6a', '#6a1e2a', '#2a5a3a', '#4a3a2a', '#1e1e22', '#d8d0c0', '#8a6a2a', '#5a2a6a', '#a8642a'];
const RACES = [['human', 'Людина'], ['elf', 'Ельф'], ['dwarf', 'Гном'], ['orc', 'Орк'], ['cat', 'Котолюд'], ['wolf', 'Вовколюд'], ['fox', 'Лисолюд'], ['rabbit', 'Зайцелюд']];
const STYLES = [['model', 'Як у моделі'], ['short', 'Коротке'], ['long', 'Довге'], ['ponytail', 'Хвіст'], ['bun', 'Пучок'], ['mohawk', 'Ірокез'], ['bald', 'Голомозий']];
const WEAPONS = [['', 'Без зброї'], ['sword', 'Меч'], ['greatsword', 'Дворучник'], ['axe', 'Сокира'], ['bow', 'Лук'], ['staff', 'Посох'], ['dagger', 'Кинджали']];
const BUILDS = { slim: { n: 'Худа', width: .9, b: { shoulders: .94, torso: .92, arms: 1.0, legs: 1.04, head: 1.0 } }, normal: { n: 'Звичайна', width: 1, b: {} }, athletic: { n: 'Атлетична', width: 1.04, b: { shoulders: 1.14, torso: 1.06, arms: 1.02, legs: 1.0, head: .98 } }, heavy: { n: 'Кремезна', width: 1.2, b: { shoulders: 1.12, torso: 1.18, arms: 1.0, legs: .97, head: 1.0 } } };

// editor state -> figure spec
function toSpec(s){
  const look = { skin: s.skin, hair: s.hairC, eyes: s.eyes, top: s.top, bottom: s.bottom, shoes: '#1a1410', hat: s.hat ? s.top : false, beard: s.sex === 'man' && (s.beard || s.race === 'dwarf') ? undefined : false };
  if(s.sex === 'man' && !(s.beard || s.race === 'dwarf')) look.beard = false;
  const gear = {};
  if(s.race === 'elf') gear.ears = true;
  if(s.race === 'orc'){ gear.ears = true; gear.tusks = true; }
  if(['cat', 'wolf', 'fox', 'rabbit'].includes(s.race)) gear.beast = { kind: s.race, color: s.hairC, inner: '#e8c0b0', tip: s.race === 'fox' ? '#f6f2ea' : s.race === 'rabbit' ? '#ffffff' : '#d8d4d0' };
  if(s.weapon === 'dagger'){ gear.right = { type: 'dagger' }; gear.left = { type: 'dagger' }; }
  else if(s.weapon) gear.right = { type: s.weapon };
  if(s.cape) gear.cape = s.capeC;
  const B = BUILDS[s.build] || BUILDS.normal;
  const build = Object.assign({}, B.b, { head: (B.b.head || 1)*s.head, legs: (B.b.legs || 1)*s.legs });
  let height = s.height, width = B.width;
  if(s.race === 'dwarf'){ height = Math.min(height, 1.42); width *= 1.32; }
  if(s.race === 'elf') height = Math.max(height, s.sex === 'woman' ? 1.74 : 1.84);
  if(s.race === 'orc'){ width *= 1.12; }
  if(s.sex === 'woman'){ delete look.skin; delete look.top; delete look.bottom; delete look.hair; if(s.race === 'orc') look.skin = s.skin; }
  return { body: s.sex, look, gear, height, width, build, hairStyle: s.sex === 'woman' || s.hairStyle === 'model' ? null : s.hairStyle };
}
const BASE = { sex: 'man', race: 'human', height: 1.8, build: 'normal', head: 1, legs: 1, skin: SKIN[1], hairC: HAIR[1], hairStyle: 'model', beard: false, eyes: '#4a6a8a', top: CLOTH[0], bottom: '#2a2a30', hat: false, cape: false, capeC: '#6a1e2a', weapon: '' };
const V = (id, n, o) => ({ id, n, st: Object.assign({}, BASE, o) });
const KNIGHT = { body: 'soldier', height: 1.95, width: 1.08, look: { armor: '#c4c6cc', metal: true }, gear: { right: { type: 'sword', gold: true }, left: { type: 'shield', kite: true, color: '#6a1a16', trim: '#d0a040' }, cape: '#7a1a14', capeLen: 1.35, crest: '#d4a83a', tabard: { color: '#7a1a14', trim: '#d4a83a' } } };
const PRESETS = NEW_MODELS.map(m => ({ id: m.id, n: m.n, g: m.g, note: m.note, st: { raw: { body: m.id, height: m.h } } })).concat([
  { id: 'img-berserker2', n: 'Берсерк — версія 2 (на відеокарті, з текстурами)', st: { raw: { body: 'gen_berserker2', height: 1.95 } } },
  { id: 'img-berserker', n: 'Берсерк — версія 1 (без відеокарти)', g: 'old', st: { raw: { body: 'gen_berserker', height: 1.95 } } }
]);
PRESETS.forEach(p => { if(!p.g) p.g = 'old'; });

export async function openLab(root){
  const css = document.createElement('style'); css.textContent = `
  .lb{position:fixed;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 340px;background:var(--bg);color:var(--fg)}
  @media (max-width:760px){.lb{grid-template-columns:1fr;grid-template-rows:52vh 1fr}}
  .lb-view{position:relative;min-height:0}.lb-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  .lb-bar{position:absolute;left:max(10px,env(safe-area-inset-left,0px));right:10px;bottom:10px;display:flex;flex-wrap:wrap;gap:6px}
  .lb-bar button,.lb-p button{background:var(--chip);color:var(--fg);border:1px solid var(--line);border-radius:9px;padding:6px 10px;font-size:13px;cursor:pointer}
  .lb-bar button.on,.lb-p button.on{background:var(--acc);color:#1a1208;border-color:var(--acc);font-weight:700}
  .lb-top{position:absolute;left:max(12px,env(safe-area-inset-left,0px));top:10px;right:12px;display:flex;gap:10px;align-items:baseline;pointer-events:none}
  .lb-top h1{margin:0;font:400 20px Georgia,serif;letter-spacing:.06em}.lb-top span{font-size:12px;opacity:.7}
  .lb-p{overflow:auto;border-left:1px solid var(--line);padding:12px max(14px,env(safe-area-inset-right,0px)) 24px 14px;background:var(--panel);min-width:0}
  @media (max-width:760px){.lb-p{border-left:0;border-top:1px solid var(--line);padding-left:max(14px,env(safe-area-inset-left,0px))}}
  .lb-tabs{display:flex;gap:6px;margin-bottom:10px}
  .lb-card{border:1px solid var(--line);border-radius:12px;padding:9px 10px;margin-bottom:8px;cursor:pointer;background:var(--card)}
  .lb-card.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}
  .lb-card b{display:block;font:600 14px Georgia,serif;margin-bottom:5px}
  .lb-vote{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .lb-vote input{flex:1;min-width:120px;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:5px 8px;font-size:12.5px}
  .lb-row{margin:10px 0}.lb-row label{display:block;font-size:12px;opacity:.75;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em}
  .lb-chips{display:flex;flex-wrap:wrap;gap:5px}.lb-sw{width:26px;height:26px;border-radius:50%;border:2px solid var(--line);cursor:pointer;padding:0}
  .lb-sw.on{border-color:var(--acc);box-shadow:0 0 0 2px var(--acc)}
  .lb-row input[type=range]{width:100%}
  .lb-note{font-size:12px;opacity:.7;line-height:1.45}
  .lb-cmp{font-size:12px;opacity:.75;margin:-4px 0 8px}`;
  document.head.appendChild(css);
  root.innerHTML = '<div class="lb"><div class="lb-view"><div class="lb-top"><h1>Лабораторія вигляду</h1><span>тягніть — обертати · колесо/щипок — наблизити</span></div><div class="lb-bar"></div></div><div class="lb-p"></div></div>';
  const view = root.querySelector('.lb-view'), bar = root.querySelector('.lb-bar'), panel = root.querySelector('.lb-p');

  // ---------- 3D scene in the game's look ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  view.insertBefore(renderer.domElement, view.firstChild);
  const scene = new THREE.Scene(); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  const cam = new THREE.PerspectiveCamera(35, 1, .05, 200); cam.position.set(0, 1.5, 4.6);
  const ctl = new OrbitControls(cam, renderer.domElement); ctl.target.set(0, 1.0, 0); ctl.enableDamping = true; ctl.minDistance = 1.2; ctl.maxDistance = 9; ctl.maxPolarAngle = Math.PI*.52;
  const hemi = new THREE.HemisphereLight('#cfe2ff', '#4a3a28', .7); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1dc', 2.4); sun.position.set(3, 6, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 40 }); sun.shadow.bias = -.0004; scene.add(sun);
  const gtex = tex('grass.jpg', { srgb: true, repeat: 6 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(24, 96), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1, color: '#c8d0b8' })); ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
  const LIGHTS = { day: ['#9cc4ea', '#fff1dc', 2.4, .7, .95], sunset: ['#e8a070', '#ffb070', 1.8, .45, .9], night: ['#1a2440', '#9ab0ff', .55, .3, .8] };
  function setLight(k){ const L = LIGHTS[k]; scene.background = new THREE.Color(L[0]); sun.color.set(L[1]); sun.intensity = L[2]; hemi.intensity = L[3]; renderer.toneMappingExposure = L[4]; sun.position.set(k === 'sunset' ? 6 : 3, k === 'sunset' ? 2.2 : 6, 4); }
  setLight('day');
  function resize(){ const r = view.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width/Math.max(1, r.height); cam.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(view); resize();

  // ---------- figures on stage ----------
  let stage = [], anim = 'Idle', buildSeq = 0;
  async function show(list){
    const seq = ++buildSeq; const made = [];
    for(const st of list){ try{ made.push(await F.make(st.raw ? st.raw : toSpec(st))); }catch(e){ console.warn(e); } if(seq !== buildSeq) return; }
    stage.forEach(f => scene.remove(f.obj)); stage = made;
    const n = made.length; const ws = made.map(f => { f.obj.updateMatrixWorld(true); const b = new THREE.Box3().expandByObject(f.obj, true); return b.isEmpty() ? 1 : Math.max(.8, b.max.x - b.min.x) + .35; });
    const tot = ws.reduce((a, b) => a + b, 0); let x = -tot/2;
    made.forEach((f, i) => { f.obj.position.set(x + ws[i]/2, 0, 0); x += ws[i]; scene.add(f.obj); f.play(anim); });
    const box = new THREE.Box3(); made.forEach(f => { f.obj.updateMatrixWorld(true); box.expandByObject(f.obj, true); });
    const sz = box.isEmpty() ? new THREE.Vector3(1, 1.8, 1) : box.getSize(new THREE.Vector3()); const big = Math.max(sz.y, sz.x*.75, sz.z*.6, .4);
    ctl.target.set(0, Math.max(.2, sz.y*.52), 0); ctl.maxDistance = Math.max(9, big*5); cam.near = Math.max(.01, big*.01); cam.updateProjectionMatrix();
    const d = big*2.35 + (n > 1 ? n*.5 : 0); const dir = cam.position.clone().sub(ctl.target).normalize(); cam.position.copy(ctl.target).addScaledVector(dir, d);
  }
  const ANIMS = [['Idle', 'Стоїть'], ['Walk', 'Йде'], ['Run', 'Біжить'], ['Attack1H', 'Удар'], ['Cast', 'Чари'], ['Cheer', 'Радіє']];
  function drawBar(){
    bar.innerHTML = ANIMS.map(([k, n]) => '<button data-a="' + k + '" class="' + (anim === k ? 'on' : '') + '">' + n + '</button>').join('') + '<span style="flex:1"></span>' + [['day', '☀️'], ['sunset', '🌇'], ['night', '🌙']].map(([k, e]) => '<button data-l="' + k + '">' + e + '</button>').join('');
    bar.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { anim = b.dataset.a; stage.forEach(f => f.play(anim, { restart: true })); drawBar(); });
    bar.querySelectorAll('[data-l]').forEach(b => b.onclick = () => setLight(b.dataset.l));
  }
  drawBar();
  const clock = new THREE.Clock();
  (function loop(){ requestAnimationFrame(loop); const dt = Math.min(.05, clock.getDelta()); stage.forEach(f => { f.update(dt, anim === 'Walk' || anim === 'Run'); f.tick && f.tick(dt); }); ctl.update(); renderer.render(scene, cam); })();

  // ---------- votes in the artifact db ----------
  let db = null; const votes = {}; const mine = [];
  try{ db = window.claude && window.claude.use ? await Promise.race([window.claude.use('db'), new Promise(r => setTimeout(() => r(null), 10000))]) : null; }catch(e){ db = null; }
  if(db){ try{ db.collection('lab').onSnapshot(snap => { snap.docs.forEach(d => { const v = d.data(); if(!v) return; votes[d.id] = v; if(v.custom && !mine.some(m => m.id === d.id)) mine.push({ id: d.id, n: v.n, st: v.st }); }); render(); }, () => {}); }catch(e){} }
  async function saveVote(item, patch){
    const cur = Object.assign({ n: item.n, st: item.st }, votes[item.id] || {}, patch, { t: Date.now() }); votes[item.id] = cur; render();
    if(!db) return; try{ await db.collection('lab').doc(item.id).set(cur); }catch(e){ console.warn(e); }
  }

  // ---------- panel ----------
  let tab = 'variants', grp = 'all', sel = [PRESETS[0].id], ed = Object.assign({}, BASE);
  const all = () => PRESETS.concat(mine);
  function render(){
    let h = '<div class="lb-tabs"><button data-t="variants" class="' + (tab === 'variants' ? 'on' : '') + '">Варіанти</button></div>';
    if(tab === 'variants'){
      const cnt = g => all().filter(it => g === 'all' || it.g === g).length;
      h += '<div class="lb-chips" style="margin-bottom:8px">' + [['all', 'Усі']].concat(GROUPS).filter(([k]) => cnt(k)).map(([k, n]) => '<button data-g="' + k + '" class="' + (grp === k ? 'on' : '') + '">' + n + ' · ' + cnt(k) + '</button>').join('') + '</div>';
      const rated = all().filter(it => (votes[it.id] || {}).vote).length;
      h += '<p class="lb-cmp">Оцінено ' + rated + ' з ' + all().length + '. Торкніться картки, щоб показати; «＋ порівняти» ставить поруч до трьох.</p>';
      h += all().filter(it => grp === 'all' || it.g === grp).map(it => { const v = votes[it.id] || {}; return '<div class="lb-card' + (sel.includes(it.id) ? ' on' : '') + '" data-id="' + it.id + '"><b>' + esc(it.n) + '</b>' + (it.note ? '<div class="lb-note" style="margin:-2px 0 6px">' + esc(it.note) + '</div>' : '') + '<div class="lb-vote"><button data-v="1" class="' + (v.vote === 1 ? 'on' : '') + '">👍</button><button data-v="-1" class="' + (v.vote === -1 ? 'on' : '') + '">👎</button><button data-c="1">＋ порівняти</button><input data-m placeholder="коментар…" value="' + esc(v.comment || '') + '"></div></div>'; }).join('');
      h += '<p class="lb-note">' + (db ? 'Ваші 👍/👎 і коментарі зберігаються тут, Claude прочитає їх сам.' : 'Збереження оцінок недоступне в цьому перегляді — оцінки працюватимуть лише до перезавантаження.') + '</p>';
    } else {
      const sw = (key, list) => '<div class="lb-chips">' + list.map(c => '<button class="lb-sw' + (ed[key] === c ? ' on' : '') + '" style="background:' + c + '" data-sw="' + key + '" data-val="' + c + '"></button>').join('') + '</div>';
      const ch = (key, list) => '<div class="lb-chips">' + list.map(([k, n]) => '<button data-ch="' + key + '" data-val="' + k + '" class="' + (String(ed[key]) === String(k) ? 'on' : '') + '">' + n + '</button>').join('') + '</div>';
      const sl = (key, n, a, b, st) => '<div class="lb-row"><label>' + n + ' · <span>' + (+ed[key]).toFixed(2) + '</span></label><input type="range" data-sl="' + key + '" min="' + a + '" max="' + b + '" step="' + st + '" value="' + ed[key] + '"></div>';
      h += '<div class="lb-row"><label>Стать</label>' + ch('sex', [['man', 'Чоловік'], ['woman', 'Жінка']]) + '</div>';
      h += '<div class="lb-row"><label>Раса</label>' + ch('race', RACES) + '</div>';
      h += '<div class="lb-row"><label>Статура</label>' + ch('build', Object.entries(BUILDS).map(([k, b]) => [k, b.n])) + '</div>';
      h += sl('height', 'Зріст, м', 1.45, 2.05, .01) + sl('head', 'Голова', .9, 1.12, .01) + sl('legs', 'Ноги', .9, 1.12, .01);
      if(ed.sex === 'woman') h += '<p class="lb-note">Жіноча модель — цільна, з одним малюнком: колір шкіри, волосся, одягу й зачіску в неї окремо не змінити. Працюють раса (вуха, хвіст), статура, зріст, зброя і плащ. Хутро звіролюдки береться з кольору волосся.</p>';
      h += '<div class="lb-row"><label>Шкіра</label>' + sw('skin', SKIN.concat(['#6a8a3a', '#c8d8e8'])) + '</div>';
      h += '<div class="lb-row"><label>Волосся / хутро</label>' + sw('hairC', HAIR) + '</div>';
      if(ed.sex === 'man') h += '<div class="lb-row"><label>Зачіска</label>' + ch('hairStyle', STYLES) + '</div>';
      if(ed.sex === 'man') h += '<div class="lb-row"><label>Борода</label>' + ch('beard', [[true, 'Є'], [false, 'Немає']]) + '</div>';
      h += '<div class="lb-row"><label>Очі</label>' + sw('eyes', ['#4a6a8a', '#3a5a2a', '#6a4a2a', '#2a2a2a', '#9ad8ff', '#ffb030', '#c03030']) + '</div>';
      h += '<div class="lb-row"><label>Верх одягу</label>' + sw('top', CLOTH) + '</div><div class="lb-row"><label>Низ одягу</label>' + sw('bottom', CLOTH.concat(['#2a2a30'])) + '</div>';
      h += '<div class="lb-row"><label>Плащ</label>' + ch('cape', [[true, 'Є'], [false, 'Немає']]) + (ed.cape ? sw('capeC', CLOTH) : '') + '</div>';
      h += '<div class="lb-row"><label>Капелюх</label>' + ch('hat', [[true, 'Є'], [false, 'Немає']]) + '</div>';
      h += '<div class="lb-row"><label>Зброя</label>' + ch('weapon', WEAPONS) + '</div>';
      h += '<div class="lb-row"><label>Назва варіанта</label><div class="lb-vote"><input data-name placeholder="Напр. «Мій лучник»"><button data-save class="on">Зберегти для оцінки</button></div></div>';
    }
    panel.innerHTML = h;
    panel.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { grp = b.dataset.g; render(); });
    panel.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); if(tab === 'editor') show([ed]); else showSel(); });
    panel.querySelectorAll('.lb-card').forEach(c => { const id = c.dataset.id, it = all().find(x => x.id === id);
      c.onclick = e => { if(e.target.closest('button,input')) return; if(e.shiftKey) toggleCmp(id); else { sel = [id]; ed = it.st.raw ? ed : Object.assign({}, BASE, it.st); showSel(); render(); } };
      c.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { const v = +b.dataset.v; saveVote(it, { vote: (votes[id] || {}).vote === v ? 0 : v }); });
      c.querySelector('[data-c]').onclick = () => toggleCmp(id);
      const inp = c.querySelector('[data-m]'); inp.onchange = () => saveVote(it, { comment: inp.value.slice(0, 300) }); });
    panel.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { ed[b.dataset.sw] = b.dataset.val; render(); show([ed]); });
    panel.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { const v = b.dataset.val; ed[b.dataset.ch] = v === 'true' ? true : v === 'false' ? false : v; render(); show([ed]); });
    let slT = 0; panel.querySelectorAll('[data-sl]').forEach(r => r.oninput = () => { ed[r.dataset.sl] = +r.value; r.previousElementSibling.querySelector('span').textContent = (+r.value).toFixed(2); clearTimeout(slT); slT = setTimeout(() => show([ed]), 180); });
    const sv = panel.querySelector('[data-save]'); if(sv) sv.onclick = () => { const n = (panel.querySelector('[data-name]').value || 'Мій варіант').slice(0, 60); const it = { id: 'my-' + Date.now().toString(36), n, st: Object.assign({}, ed) }; mine.push(it); saveVote(it, { custom: true }); tab = 'variants'; sel = [it.id]; render(); showSel(); };
  }
  function toggleCmp(id){ if(sel.includes(id)){ if(sel.length > 1) sel = sel.filter(x => x !== id); } else { sel = sel.concat(id).slice(-3); } showSel(); render(); }
  function showSel(){ show(sel.map(id => (all().find(x => x.id === id) || PRESETS[0]).st)); }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  render(); showSel();
}

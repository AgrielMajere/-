// =====================================================================================
//  Enterable interiors as separate small scenes: tavern, royal throne hall, dwarven hall.
//  Built procedurally (no downloads); NPCs are regular figures.
// =====================================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { softSprite } from './assets.js';

export const INTERIORS = {
  tavern: { n: '🍺 Таверна «Лимонний Дракон»', w: 16, d: 11, music: 'tavern' },
  throne: { n: '👑 Тронна зала Сонцеграда', w: 18, d: 26, music: 'town' },
  dwarfhall: { n: '⛏️ Зала Предків під горою', w: 20, d: 20, music: 'dungeon' }
};

function canvasTex(w, h, draw, rep){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if(rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; return t; }
const rnd = (a => () => { a = (a*16807) % 2147483647; return (a - 1)/2147483646; })(12345);
function planks(base){ return (g, w, h) => { const n = 8; for(let i = 0; i < n; i++){ const c = new THREE.Color(base).offsetHSL(0, 0, (rnd() - .5)*.08); g.fillStyle = '#' + c.getHexString(); g.fillRect(0, i*h/n, w, h/n); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i*h/n, w, 2); for(let k = 0; k < 40; k++){ g.fillStyle = 'rgba(0,0,0,' + (rnd()*.08) + ')'; g.fillRect(rnd()*w, i*h/n + rnd()*h/n, rnd()*60 + 10, 1); } const cut = rnd()*w; g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(cut, i*h/n, 2, h/n); } }; }
function stones(base){ return (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const rows = 8; for(let r = 0; r < rows; r++){ let x = (r % 2)*20 - 20; while(x < w){ const bw = 40 + rnd()*30; const c = new THREE.Color(base).offsetHSL(0, 0, (rnd() - .5)*.12); g.fillStyle = '#' + c.getHexString(); g.fillRect(x + 2, r*h/rows + 2, bw - 4, h/rows - 4); x += bw; } } }; }
function mat(color, o){ return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .85 }, o || {})); }

export function buildInterior(id, opts){
  const I = INTERIORS[id], W = I.w, D = I.d;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b0806');
  const pm = new THREE.PMREMGenerator(opts.renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .25;
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 200);
  const pickables = [], anim = [], npcs = [];
  const hemi = new THREE.HemisphereLight('#ffe8c8', '#3a2a1a', .55); scene.add(hemi);
  const add = (m, x, y, z) => { m.position.set(x, y, z); scene.add(m); return m; };
  const box = (w, h, d, m, x, y, z, ry) => { const b = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z); if(ry) b.rotation.y = ry; b.castShadow = true; b.receiveShadow = true; return b; };
  const cyl = (r1, r2, h, m, x, y, z, seg) => { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 14), m), x, y, z); c.castShadow = true; return c; };
  const solids = []; // axis-aligned blockers [x0,z0,x1,z1]
  const solid = (x, z, w, d) => solids.push([x - w/2, z - d/2, x + w/2, z + d/2]);
  function fire(x, y, z, s, color){
    const L = new THREE.PointLight(color || '#ffa04a', 12*s, 9*s, 2); L.position.set(x, y + .6, z); scene.add(L);
    const parts = []; for(let i = 0; i < 6; i++){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: i < 2 ? '#fff0c0' : (color || '#ff8a2a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(sp); parts.push({ sp, t: Math.random() }); }
    anim.push(dt => { const t = performance.now()/1000; L.intensity = 12*s*(.85 + Math.sin(t*13)*.08 + Math.sin(t*7.3)*.07); parts.forEach((p, i) => { p.t += dt*(1.4 + i*.2); const k = p.t % 1; const sc = s*(1 - k)*.7 + .1; p.sp.position.set(x + Math.sin(t*6 + i)*.05*s, y + k*s*.9, z); p.sp.scale.set(sc, sc*1.4, 1); p.sp.material.opacity = 1 - k; }); });
  }
  function candle(x, y, z){ cyl(.03, .03, .14, mat('#efe6cf'), x, y + .07, z, 8); const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#ffcf7a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), x, y + .2, z); sp.scale.set(.25, .35, 1); anim.push(() => { sp.material.opacity = .8 + Math.sin(performance.now()*.02 + x)*.15; }); }
  function npc(spec, x, z, face, info){
    const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = face || 0; scene.add(o); solid(x, z, .7, .7);
    const rec = Object.assign({ x, z, inst: null }, info);
    opts.F.make(spec).then(inst => { o.add(inst.obj); rec.inst = inst; inst.play(info.idle || 'Idle'); }).catch(() => {});
    const px = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 2, 8), new THREE.MeshBasicMaterial({ visible: false })); px.position.y = 1; o.add(px);
    const dx = Math.sin(face || 0)*1.3, dz = Math.cos(face || 0)*1.3; px.userData = { npc: rec, x: x + dx, z: z + dz }; pickables.push(px); npcs.push(rec);
    // name tag
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d'); g.font = '600 30px Georgia'; g.textAlign = 'center'; g.fillStyle = 'rgba(15,10,6,.7)'; const tw = g.measureText(info.name).width + 30; g.fillRect(256 - tw/2, 10, tw, 44); g.fillStyle = '#ffe9b8'; g.fillText(info.name, 256, 42);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); tag.scale.set(2.6, .33, 1); tag.position.y = (spec.height || 1.8) + .45; o.add(tag);
    return rec;
  }
  function door(x, z, face){
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face || 0; scene.add(g);
    const wood = mat('#5a3a20'); const d1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, .12), wood); d1.position.y = 1.3; g.add(d1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.08, .015, 6, 12), mat('#c8a050', { metalness: .9, roughness: .3 })); ring.position.set(.5, 1.2, .08); g.add(ring);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#ffd27a', transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(2.6, 3, 1); glow.position.set(0, 1.3, .2); g.add(glow);
    const px = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, .6), new THREE.MeshBasicMaterial({ visible: false })); px.position.y = 1.3; g.add(px);
    px.userData = { exit: true, x: x + Math.sin(face || 0)*1.2, z: z + Math.cos(face || 0)*1.2 }; pickables.push(px);
    anim.push(() => { glow.material.opacity = .25 + Math.sin(performance.now()*.003)*.12; });
  }
  // shell
  function room(floorTex, wallTex, H, ceil){
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: .8 })); fl.rotation.x = -Math.PI/2; fl.receiveShadow = true; scene.add(fl);
    const wm = new THREE.MeshStandardMaterial({ map: wallTex, roughness: .95, side: THREE.DoubleSide });
    [[0, -D/2, W, 0], [-W/2, 0, D, Math.PI/2], [W/2, 0, D, -Math.PI/2]].forEach(([x, z, w, r]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wm); p.position.set(x, H/2, z); p.rotation.y = r; p.receiveShadow = true; scene.add(p); });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H*.35), wm); front.position.set(0, H*.82, D/2); front.rotation.y = Math.PI; scene.add(front);
    if(ceil){ const c = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(ceil)); c.rotation.x = Math.PI/2; c.position.y = H; scene.add(c); }
  }
  const hero = { x: 0, z: D/2 - 4.2, heading: Math.PI, target: null };
  let music = I.music, camDist = 6.5;

  if(id === 'tavern'){
    room(canvasTex(512, 512, planks('#6a4428'), [4, 3]), canvasTex(512, 512, stones('#8a7a66'), [3, 1]), 4.2, '#2a1c12');
    const beam = mat('#3a2614'); for(let x = -W/2 + 2; x < W/2; x += 3) box(.3, .3, D, beam, x, 4.0, 0);
    // bar
    box(6, 1.1, .9, mat('#5a3a20'), -3, .55, -D/2 + 2.2); box(6.2, .12, 1.1, mat('#7a5230', { roughness: .4 }), -3, 1.14, -D/2 + 2.2); solid(-3, -D/2 + 2.2, 6.2, 1.2);
    box(6, 2.4, .5, mat('#4a2e18'), -3, 1.6, -D/2 + .3); for(let i = 0; i < 12; i++) cyl(.06, .08, .32, mat(['#2a6a3a', '#6a2a1a', '#c8a050'][i % 3], { roughness: .2, metalness: .1, transparent: true, opacity: .85 }), -5.5 + i*.45, 1.95 + (i % 2)*.55, -D/2 + .45, 8);
    [[-6.6, -D/2 + 1.2], [4.8, -D/2 + 1], [6.6, -D/2 + 1]].forEach(([x, z]) => { const b = cyl(.45, .45, 1.1, mat('#6a4428'), x, .55, z); solid(x, z, 1, 1); [.2, .9].forEach(y => cyl(.47, .47, .06, mat('#2a2a2a', { metalness: .7 }), x, y, z)); });
    // fireplace
    box(2.6, 2.6, .9, mat('#5a5048'), W/2 - .6, 1.3, 0, Math.PI/2); box(1.6, 1.1, .5, mat('#0a0806'), W/2 - .95, .55, 0, Math.PI/2); solid(W/2 - .6, 0, 1.2, 2.8); fire(W/2 - 1.05, .15, 0, 1.2);
    // tables
    [[-3, 1], [1.5, -1], [1.5, 2.6], [-3.8, 3.2], [4.5, 3.4]].forEach(([x, z]) => { cyl(.75, .75, .08, mat('#7a5230'), x, .8, z, 18); cyl(.1, .18, .8, mat('#4a2e18'), x, .4, z, 8); solid(x, z, 1.6, 1.6);
      [0, 1.6, 3.2, 4.7].forEach(a => cyl(.22, .22, .45, mat('#5a3a20'), x + Math.cos(a)*1.1, .23, z + Math.sin(a)*1.1, 10)); candle(x, .84, z);
      cyl(.05, .045, .14, mat('#c8a050', { metalness: .8, roughness: .3 }), x + .3, .91, z + .1, 8); });
    const ch = new THREE.PointLight('#ffb070', 6, 12, 2); ch.position.set(-1, 3.4, 1); scene.add(ch);
    npc({ body: 'man', look: { top: '#6a4a2a', bottom: '#2a2018', hat: false, beard: true }, height: 1.78 }, -3, -D/2 + 1.3, 0, { id: 'barkeep', name: 'Шинкар Гордій', line: 'Медовуха, пиво, гаряча юшка! Сідайте!', service: 'tavern' });
    npc({ body: 'man', look: { top: '#5a2a6a', bottom: '#2a2030', hat: '#5a2a6a' }, height: 1.76 }, 3.8, -1.6, -2.2, { id: 'bard', name: 'Бард Ярема', line: 'Заспівати баладу?', idle: 'Cheer' });
    npc({ body: 'woman', look: { top: '#2a5a4a', bottom: '#3a2a20' }, height: 1.66 }, 1.5, -2.3, .3, { id: 'tav1', name: 'Мандрівниця Віра', line: 'Кажуть, у Покинутих шахтах світиться місячний камінь…' });
    npc({ body: 'soldier', look: { armor: '#a8a098' }, height: 1.86 }, -3.8, 4.4, Math.PI, { id: 'tav2', name: 'Найманець Кирило', line: 'Набіги на Вербівку — щокривавого місяця. Ходімо разом, як почуєш ріг.' });
    door(0, D/2 - .1, Math.PI);
  }
  else if(id === 'throne'){
    room(canvasTex(512, 512, stones('#b8ad9a'), [4, 6]), canvasTex(512, 512, stones('#9a8e7c'), [3, 1.5]), 8, '#3a3026');
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3, D - 3), mat('#7a1a14')); carpet.rotation.x = -Math.PI/2; carpet.position.set(0, .01, 1); scene.add(carpet);
    const trim = mat('#d4a83a', { metalness: .9, roughness: .3 });
    [-1.55, 1.55].forEach(x => { const t = new THREE.Mesh(new THREE.PlaneGeometry(.12, D - 3), trim); t.rotation.x = -Math.PI/2; t.position.set(x, .012, 1); scene.add(t); });
    for(let z = -D/2 + 4; z < D/2 - 2; z += 4.5) [-5.5, 5.5].forEach(x => { cyl(.55, .65, 8, mat('#d8d0c0'), x, 4, z, 20); cyl(.8, .8, .4, mat('#c8c0b0'), x, .2, z, 20); solid(x, z, 1.4, 1.4);
      const bn = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.2), new THREE.MeshStandardMaterial({ color: '#1e2a6a', side: THREE.DoubleSide, roughness: .9 })); bn.position.set(x + (x > 0 ? -.75 : .75), 5, z); bn.rotation.y = Math.PI/2; scene.add(bn);
      const sun = new THREE.Mesh(new THREE.CircleGeometry(.35, 16), trim); sun.position.set(x + (x > 0 ? -.76 : .76), 5.3, z); sun.rotation.y = x > 0 ? -Math.PI/2 : Math.PI/2; scene.add(sun); });
    // dais & throne
    box(8, .5, 4, mat('#c8c0b0'), 0, .25, -D/2 + 2.2); box(6, .5, 3, mat('#d8d0c0'), 0, .75, -D/2 + 2); solid(0, -D/2 + 2.2, 8, 4.2);
    box(1.6, .6, 1.2, trim, 0, 1.3, -D/2 + 1.6); box(1.6, 2.6, .25, trim, 0, 2.3, -D/2 + 1.05); box(1.3, 2.2, .1, mat('#7a1a14'), 0, 2.2, -D/2 + 1.2);
    [[-3.2, -D/2 + 3.8], [3.2, -D/2 + 3.8], [-3.2, D/2 - 4], [3.2, D/2 - 4]].forEach(([x, z]) => { cyl(.3, .2, 1.2, mat('#3a3026', { metalness: .6 }), x, .6, z, 10); fire(x, 1.25, z, .9, '#ffb04a'); solid(x, z, .7, .7); });
    const L1 = new THREE.PointLight('#fff0d0', 10, 28, 2); L1.position.set(0, 7, -2); scene.add(L1);
    npc({ body: 'soldier', look: { armor: '#e0c870' }, gear: { right: { type: 'scepter', gold: true }, crown: '#e2b552', cape: '#1e2a6a' }, height: 1.95 }, 0, -D/2 + 1.9, 0, { id: 'king', name: 'Король Ярополк', line: 'Прийшлий! Чув про тебе. Королівство потребує героїв — Три Катастрофи не сплять.' });
    npc({ body: 'soldier', look: { armor: '#d8d0c0' }, gear: { right: { type: 'greatsword', gold: true }, cape: '#1e2a6a' }, height: 1.9 }, -2.6, -D/2 + 4.6, 0, { id: 'kg1', name: 'Лицар Варти', line: 'Тримайтеся подалі від трону.' });
    npc({ body: 'soldier', look: { armor: '#d8d0c0' }, gear: { right: { type: 'greatsword', gold: true }, cape: '#1e2a6a' }, height: 1.9 }, 2.6, -D/2 + 4.6, 0, { id: 'kg2', name: 'Лицар Варти', line: 'Слава Сонцю!' });
    npc({ body: 'man', look: { top: '#1e2a6a', bottom: '#e8e0cc', hat: '#1e2a6a' }, gear: { right: { type: 'scepter' } }, height: 1.8 }, -2.2, 0, .6, { id: 'herald', name: 'Герольд Остромир', line: 'Його Величність приймає авантюристів рангу C і вище.' });
    door(0, D/2 - .1, Math.PI); camDist = 10;
  }
  else if(id === 'dwarfhall'){
    room(canvasTex(512, 512, stones('#5a524a'), [5, 5]), canvasTex(512, 512, stones('#4a423a'), [4, 1.6]), 7, '#1a1612');
    // lava channel
    const lavaM = new THREE.MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ff3a0a', emissiveIntensity: 2.2, roughness: .4 });
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(1.4, D - 2), lavaM); lava.rotation.x = -Math.PI/2; lava.position.set(-W/2 + 3, .02, 0); scene.add(lava); solid(-W/2 + 3, 0, 1.8, D - 2);
    anim.push(() => { lavaM.emissiveIntensity = 2 + Math.sin(performance.now()*.002)*.4; });
    for(let z = -D/2 + 3; z < D/2 - 2; z += 4){ const L = new THREE.PointLight('#ff6a2a', 5, 9, 2); L.position.set(-W/2 + 3, 1, z); scene.add(L); }
    // pillars carved
    [[-4, -5], [4, -5], [-4, 3], [4, 3]].forEach(([x, z]) => { cyl(.9, 1.1, 7, mat('#6a6058'), x, 3.5, z, 8); for(let y = 1; y < 7; y += 2) cyl(1.15, 1.15, .25, mat('#c8a050', { metalness: .8, roughness: .35 }), x, y, z, 8); solid(x, z, 2.2, 2.2); });
    // forge + anvils
    box(2.6, 1.6, 2, mat('#3a3430'), W/2 - 2, .8, -D/2 + 2.5); fire(W/2 - 2, 1.6, -D/2 + 2.5, 1.1, '#ff7a2a'); solid(W/2 - 2, -D/2 + 2.5, 2.8, 2.2);
    [[W/2 - 4.5, -D/2 + 4], [W/2 - 3, -D/2 + 5.6]].forEach(([x, z]) => { box(.8, .5, .45, mat('#2a2a2e', { metalness: .9, roughness: .4 }), x, .75, z); box(.45, .5, .35, mat('#2a2a2e', { metalness: .9 }), x, .25, z); solid(x, z, .9, .6); });
    // mine cart & rails
    const rail = mat('#4a4a50', { metalness: .9, roughness: .4 }); [-.45, .45].forEach(o => box(.08, .06, D - 4, rail, W/2 - 1.6 + o, .03, 2));
    box(1.2, .8, 1.6, mat('#5a4030'), W/2 - 1.6, .6, 4.5); for(let i = 0; i < 5; i++){ const s = new THREE.Mesh(new THREE.OctahedronGeometry(.18, 0), mat('#d8e0f0', { metalness: .6, emissive: '#6a7aff', emissiveIntensity: .3 })); s.position.set(W/2 - 1.6 + (i - 2)*.2, 1.1, 4.5 + (i % 2)*.3); scene.add(s); } solid(W/2 - 1.6, 4.5, 1.4, 1.8);
    // long table with mugs
    box(6, .15, 1.3, mat('#5a3a20'), 1, .85, 6.5); box(5.6, .8, .2, mat('#3a2614'), 1, .4, 6.5); solid(1, 6.5, 6.2, 1.5); for(let i = 0; i < 6; i++) cyl(.08, .07, .18, mat('#8a6a3a'), -1.5 + i, 1.02, 6.5 + (i % 2 ? .3 : -.3), 8);
    // throne of the Thane
    box(3, .4, 2, mat('#6a6058'), 0, .2, -D/2 + 1.6); box(1.4, 2.6, .3, mat('#c8a050', { metalness: .85, roughness: .3 }), 0, 1.7, -D/2 + .9); solid(0, -D/2 + 1.6, 3, 2);
    const dw = (top, hair, beard) => ({ top, bottom: '#3a2a1e', hat: false, beard: beard !== false, hair, shoes: '#1a1410' });
    npc({ body: 'man', height: 1.42, width: 1.45, look: dw('#5a3a1a', '#d8d0c0'), gear: { right: { type: 'axe' }, crown: '#e2b552', cape: '#6a1a1a' } }, 0, -D/2 + 2.6, 0, { id: 'dwarfking', name: 'Тан Бруні Залізнобородий', line: 'Ха! Ласкаво просимо до Зали Предків!' });
    npc({ body: 'man', height: 1.34, width: 1.45, look: dw('#2a2a2a', '#3a2a1a'), gear: { right: { type: 'mace' } } }, W/2 - 4.5, -D/2 + 5.2, -.6, { id: 'dwarfsmith', name: 'Коваль Двалін', line: 'Гномська заточка — найкраща у світі.', service: 'forge' });
    npc({ body: 'man', height: 1.3, width: 1.38, look: dw('#3a3a5a', '#8a8a90') }, 1, 5.2, Math.PI, { id: 'brewer', name: 'Пивовар Борін', line: 'Гномське пиво валить з ніг навіть орків!' });
    door(0, D/2 - .1, Math.PI); camDist = 10; scene.background = new THREE.Color('#060504');
  }
  const heroHolder = new THREE.Group(); scene.add(heroHolder);
  const pad = .5;
  function clamp(x, z){
    x = Math.max(-W/2 + pad, Math.min(W/2 - pad, x)); z = Math.max(-D/2 + pad, Math.min(D/2 - pad, z));
    for(const [x0, z0, x1, z1] of solids){ if(x > x0 - .35 && x < x1 + .35 && z > z0 - .35 && z < z1 + .35){ const dl = x - (x0 - .35), dr = x1 + .35 - x, dt = z - (z0 - .35), db = z1 + .35 - z; const m = Math.min(dl, dr, dt, db); if(m === dl) x = x0 - .35; else if(m === dr) x = x1 + .35; else if(m === dt) z = z0 - .35; else z = z1 + .35; } }
    return [x, z];
  }
  const it = {
    scene, camera, heroHolder, heroState: hero, pickables, clamp, music, camDist, camYaw: 0, camYawT: 0, roomW: W, roomD: D, camH: id === 'tavern' ? 3.7 : id === 'throne' ? 6.5 : 5.5,
    update(dt){ anim.forEach(f => f(dt)); npcs.forEach(n => { if(n.inst){ n.inst.update(dt, false); n.inst.tick(dt); } }); },
    dispose(){ scene.traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material && o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose(); }); pm.dispose(); }
  };
  return it;
}

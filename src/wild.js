import * as THREE from 'three';
import { boxM, cylM, mesh, uvBox, tex, canvasTexture, softSprite, rot } from './assets.js';
import { heightAt, ZONES, inWild, fbm2 } from './nature.js';
import { Z as zone, LAKE, ISLAND, SWAMP, FORD, CITY2, PASSES, roadDist, WALL_R, boundaryR, landDist, waterLevel, deepWater } from './world.js';
import { tex as tex2 } from './assets.js';
import { uvCylLathe, painted } from './town.js';
import { ENTRY } from './dungeon.js';

// The wild lands beyond the Gate of Trials: four hunting zones, trails, props, spawns.
export function buildWild(ctx){
  const { world, colliders, anim, M, rand, fires, nightLight, glowSprite, paint, interactives } = ctx;
  const treeSpots = [], rockSpots = [], spawns = [], deadTrees = [];
  const Y = (x, z) => heightAt(x, z);
  const place = (g, x, z, ry) => { g.position.set(x, Y(x, z), z); if(ry != null) g.rotation.y = ry; world.add(g); return g; };
  const circ = (x, z, r) => colliders.push({ type: 'circle', x, z, r, wild: true });

  // ---------- crossroads signpost south of the town ----------
  const cross = [0, 140];
  ZONES.forEach(Zn => paint(c => { if(Zn.safe) return; const g = c.createRadialGradient(Zn.x, Zn.z, 0, Zn.x, Zn.z, Zn.r*(Zn.id === 'meadow' ? .4 : .7)); g.addColorStop(0, `rgba(255,0,0,${Zn.id === 'meadow' ? .25 : .55})`); g.addColorStop(1, 'rgba(255,0,0,0)'); c.fillStyle = g; c.fillRect(Zn.x - Zn.r, Zn.z - Zn.r, Zn.r*2, Zn.r*2); }));
  { const g = new THREE.Group(); g.add(cylM(.08, .09, 2.8, 8, M.wood, 0, 1.4, 0));
    const signs = [['ГАЙ ГОБЛІНІВ', -2.4, 2.4], ['ТАБІР ОРКІВ', 2.4, 2.0], ['РУЇНИ', 0, 1.6]];
    signs.forEach(([t, dir, y]) => { const bg = new THREE.Group(); bg.position.y = y; bg.rotation.y = dir === 0 ? -Math.PI/2 : dir < 0 ? 0 : Math.PI; g.add(bg); bg.add(boxM(1.4, .3, .06, M.beam, .65, 0, 0));
      const st = canvasTexture(512, 110, (c, w, h) => { c.fillStyle = '#3a2a1c'; c.fillRect(0, 0, w, h); c.font = 'bold 54px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e8dcc0'; c.fillText(t, w/2, h/2 + 3); });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .27), new THREE.MeshStandardMaterial({ map: st, roughness: .9 })); p.position.set(.65, 0, .035); p.userData.keep = true; bg.add(p);
      const p2 = p.clone(); p2.rotation.y = Math.PI; p2.position.z = -.035; bg.add(p2); });
    place(g, cross[0] + 3.2, cross[1], .3); circ(cross[0] + 3.2, cross[1], .35); }

  // ---------- meadow: pond, reeds, rocks ----------
  { const Z = ZONES[0]; const px = Z.x + 9, pz = Z.z + 6;
    const wn = tex('water_n.jpg', { repeat: .5 });
    const water = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshStandardMaterial({ color: '#16262a', roughness: .04, metalness: .1, normalMap: wn, normalScale: new THREE.Vector2(.25, .25), envMapIntensity: 1.5, transparent: true, opacity: .93 }));
    water.rotation.x = -Math.PI/2; water.position.set(px, Y(px, pz) + .06, pz); water.userData.keep = true; world.add(water);
    anim.push(t => { wn.offset.set(t*.01, t*.007); });
    paint(c => { const g = c.createRadialGradient(px, pz, 0, px, pz, 5.6); g.addColorStop(0, 'rgba(255,0,0,.9)'); g.addColorStop(1, 'rgba(255,0,0,0)'); c.fillStyle = g; c.fillRect(px - 6, pz - 6, 12, 12); });
    const reedM = new THREE.MeshStandardMaterial({ color: '#6a7a3a', roughness: .9 });
    for(let i = 0; i < 46; i++){ const a = rand()*6.28, d = 3.9 + rand()*1.0; const x = px + Math.cos(a)*d, z = pz + Math.sin(a)*d; const h = .7 + rand()*.7; const r = mesh(new THREE.CylinderGeometry(.008, .014, h, 4), reedM, x, Y(x, z) + h/2, z); r.rotation.set((rand() - .5)*.3, 0, (rand() - .5)*.3); world.add(r); if(i % 3 === 0){ const cat = mesh(new THREE.CapsuleGeometry(.02, .12, 3, 6), new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: .9 }), x, Y(x, z) + h + .02, z); world.add(cat); } }
    circ(px, pz, 4.4);
    for(let i = 0; i < 8; i++){ const a = rand()*6.28, d = 8 + rand()*14; rockSpots.push({ x: Z.x + Math.cos(a)*d, z: Z.z + Math.sin(a)*d, s: .6 + rand()*1.1, r: rand()*6, sy: .6, v: i }); }
    for(let i = 0; i < 9; i++){ const a = i/9*6.28 + rand(), d = 4 + rand()*13; spawns.push({ type: i < 7 ? 'slime' : 'slime_b', x: Z.x + Math.cos(a)*d, z: Z.z + Math.sin(a)*d, wander: 6 }); }
    spawns.push({ type: 'king_slime', x: Z.x - 10, z: Z.z + 14, wander: 4 });
  }

  // ---------- goblin grove: huts, totems, campfire, dense trees ----------
  { const Z = ZONES[1];
    const thatch = new THREE.MeshStandardMaterial({ color: '#8a7448', roughness: 1, map: tex('grass2.jpg', { srgb: true, repeat: 1.5 }) });
    const hut = (x, z, s) => { const g = new THREE.Group(); const k = s || 1;
      const wall = mesh(new THREE.CylinderGeometry(1.5*k, 1.6*k, 1.4*k, 14, 1, true), M.planks, 0, .7*k, 0); wall.material = M.planks; g.add(wall);
      const roof = mesh(new THREE.ConeGeometry(2.1*k, 2.0*k, 14), thatch, 0, 2.3*k, 0); g.add(roof);
      g.add(boxM(.8*k, 1.1*k, .1, M.dark, 0, .55*k, 1.55*k));
      for(let i = 0; i < 6; i++){ const a = i/6*6.28; const p = cylM(.05, .05, 1.6*k, 5, M.wood, Math.cos(a)*1.55*k, .8*k, Math.sin(a)*1.55*k); g.add(p); }
      place(g, x, z, rand()*6); circ(x, z, 1.75*k); };
    hut(Z.x - 6, Z.z - 4, 1); hut(Z.x + 5, Z.z - 7, .85); hut(Z.x - 2, Z.z + 8, 1.1); hut(Z.x + 9, Z.z + 5, .9);
    // totem
    const totem = (x, z) => { const g = new THREE.Group(); for(let i = 0; i < 3; i++){ const c = cylM(.24 - i*.02, .26 - i*.02, .8, 8, M.wood, 0, .4 + i*.8, 0); g.add(c); g.add(boxM(.5, .08, .1, M.paint ? M.beam : M.beam, 0, .55 + i*.8, .2)); }
      const sk = mesh(new THREE.SphereGeometry(.16, 12, 10), new THREE.MeshStandardMaterial({ color: '#ddd3bc', roughness: .6 }), 0, 2.6, .05); sk.scale.set(.9, 1, 1.1); g.add(sk);
      [-1, 1].forEach(s => { const h = mesh(new THREE.ConeGeometry(.05, .5, 6), new THREE.MeshStandardMaterial({ color: '#efe4c8', roughness: .5 }), s*.22, 2.8, 0); h.rotation.z = -s*.6; g.add(h); });
      place(g, x, z, rand()*6); circ(x, z, .4); };
    totem(Z.x + 1, Z.z - 1); totem(Z.x - 9, Z.z + 3);
    campfire(Z.x + 1.5, Z.z + 2.5);
    for(let i = 0; i < 26; i++){ const a = rand()*6.28, d = 10 + rand()*16; const x = Z.x + Math.cos(a)*d, z = Z.z + Math.sin(a)*d; if(!inWild(x, z, 4)) continue; treeSpots.push({ x, z, s: .8 + rand()*.4, r: rand()*6, type: [0, 1, 3, 4, 5][i % 5] }); circ(x, z, .55); }
    for(let i = 0; i < 8; i++){ const a = i/8*6.28 + rand()*.4, d = 5 + rand()*12; spawns.push({ type: i % 4 === 3 ? 'goblin_sh' : 'goblin', x: Z.x + Math.cos(a)*d, z: Z.z + Math.sin(a)*d, wander: 6 }); }
    spawns.push({ type: 'goblin_chief', x: Z.x - 12, z: Z.z + 12, wander: 3 });
  }

  // ---------- orc camp: palisade, tents, banners, fire ----------
  { const Z = ZONES[2];
    const logM = M.wood;
    for(let i = 0; i < 44; i++){ const a = i/44*Math.PI*2; if(Math.abs(Math.sin((a - Math.atan2(cross[1] - Z.z, cross[0] - Z.x))/2)) < .12) continue;
      const R2 = Z.r*.92 + (rand() - .5)*.4; const x = Z.x + Math.cos(a)*R2, z = Z.z + Math.sin(a)*R2; const h = 2.6 + rand()*.8;
      const g = new THREE.Group(); g.add(cylM(.17, .19, h, 7, logM, 0, h/2, 0)); g.add(mesh(new THREE.ConeGeometry(.17, .45, 7), logM, 0, h + .22, 0)); g.rotation.z = (rand() - .5)*.12;
      place(g, x, z); circ(x, z, .45); }
    const hideTex = canvasTexture(256, 256, (c, w, h) => { c.fillStyle = '#6a4a30'; c.fillRect(0, 0, w, h); for(let i = 0; i < 400; i++){ c.fillStyle = `rgba(${40 + Math.random()*60},${25 + Math.random()*30},${10 + Math.random()*20},.25)`; c.fillRect(Math.random()*w, Math.random()*h, 4 + Math.random()*30, 2 + Math.random()*10); } c.strokeStyle = 'rgba(30,20,10,.6)'; c.lineWidth = 2; for(let i = 0; i < 6; i++){ c.beginPath(); c.moveTo(0, i*45 + 10); c.lineTo(w, i*45 + 14); c.stroke(); } });
    hideTex.wrapS = hideTex.wrapT = THREE.RepeatWrapping;
    const hideM = new THREE.MeshStandardMaterial({ map: hideTex, roughness: .95, side: THREE.DoubleSide });
    const tent = (x, z, s, ry) => { const g = new THREE.Group(); const k = s || 1;
      const cg = new THREE.ConeGeometry(2.4*k, 3.2*k, 6, 1, true); const cp = cg.attributes.position; for(let i = 0; i < cp.count; i++){ if(cp.getY(i) < 0){ cp.setX(i, cp.getX(i)*(1 + Math.sin(i*1.7)*.05)); } } cg.computeVertexNormals();
      g.add(mesh(cg, hideM, 0, 1.6*k, 0)); [0, 1, 2].forEach(i => { const p = cylM(.04, .04, 1.2*k, 5, M.wood, Math.cos(i*2.1)*.22, 3.5*k, Math.sin(i*2.1)*.22); p.rotation.set((rand() - .5)*.6, 0, (rand() - .5)*.6); g.add(p); });
      g.add(boxM(1.0*k, 1.6*k, .05, M.dark, 0, .8*k, 2.0*k));
      place(g, x, z, ry); circ(x, z, 2.3*k); };
    tent(Z.x - 7, Z.z + 5, 1, 1); tent(Z.x + 6, Z.z + 7, 1.1, 2); tent(Z.x + 8, Z.z - 6, .9, 4); tent(Z.x - 6, Z.z - 8, 1.2, 0.5);
    // banners
    const banTex = canvasTexture(128, 256, (c, w, h) => { c.fillStyle = '#6a1210'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a0e08'; c.beginPath(); c.moveTo(w/2, 50); c.lineTo(w*.8, 120); c.lineTo(w/2, 200); c.lineTo(w*.2, 120); c.closePath(); c.fill(); c.fillStyle = '#d8c8a0'; c.beginPath(); c.arc(w/2, 120, 18, 0, 7); c.fill(); });
    [[-4, 0], [4, 0], [0, 10]].forEach(([dx, dz]) => { const x = Z.x + dx, z = Z.z + dz; const g = new THREE.Group(); g.add(cylM(.06, .07, 4.4, 6, M.wood, 0, 2.2, 0)); g.add(rot(cylM(.04, .04, 1.1, 6, M.wood, 0, 4.1, .0), 'z', Math.PI/2));
      const geo = new THREE.PlaneGeometry(1.0, 2.0, 4, 8); const b = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: banTex, side: THREE.DoubleSide, roughness: .9 })); b.position.set(0, 3.05, .02); b.castShadow = true; b.userData.keep = true; g.add(b);
      const p0 = geo.attributes.position.array.slice(); anim.push(t => { const p = geo.attributes.position; for(let i = 0; i < p.count; i++){ const y = p0[i*3 + 1]; const k = (1 - y)/2; p.setZ(i, Math.sin(t*2.2 + y*2 + dx)*.08*k); } p.needsUpdate = true; });
      g.userData.keepGroup = true; place(g, x, z, rand()); circ(x, z, .3); });
    campfire(Z.x, Z.z + 1.5, true);
    // weapon rack & skulls on poles
    for(let i = 0; i < 4; i++){ const a = i/4*6.28 + .4; const x = Z.x + Math.cos(a)*14, z = Z.z + Math.sin(a)*14; const g = new THREE.Group(); g.add(cylM(.05, .06, 2.2, 6, M.wood, 0, 1.1, 0)); const sk = mesh(new THREE.SphereGeometry(.15, 12, 10), new THREE.MeshStandardMaterial({ color: '#d8ceb8', roughness: .6 }), 0, 2.3, 0); sk.scale.set(.9, 1, 1.1); g.add(sk); place(g, x, z); circ(x, z, .25); }
    for(let i = 0; i < 8; i++){ const a = i/8*6.28 + rand()*.3, d = 4 + rand()*12; spawns.push({ type: i % 3 === 2 ? 'orc_brute' : 'orc', x: Z.x + Math.cos(a)*d, z: Z.z + Math.sin(a)*d, wander: 5 }); }
    spawns.push({ type: 'orc_chief', x: Z.x + 2, z: Z.z + 12, wander: 3 });
  }

  // ---------- ruins: columns, walls, graves, crypt ----------
  { const Z = ZONES[3];
    const col = (x, z, h, fallen) => { const g = new THREE.Group();
      const shaft = new THREE.CylinderGeometry(.36, .4, h, 16, 4); uvCylLathe(shaft); const sm = mesh(shaft, M.marble, 0, h/2 + .3, 0); g.add(sm);
      g.add(boxM(1.1, .3, 1.1, M.marble, 0, .15, 0)); if(h > 3) g.add(boxM(1.05, .28, 1.05, M.marble, 0, h + .44, 0));
      if(fallen){ g.rotation.z = Math.PI/2*.97; g.position.y = .3; }
      place(g, x, z, rand()*6); if(fallen) g.position.y = Y(x, z) + .4; circ(x, z, fallen ? 1.2 : .55); };
    for(let i = 0; i < 12; i++){ const a = i/12*Math.PI*2; const x = Z.x + Math.cos(a)*11, z = Z.z + Math.sin(a)*11; const r = rand(); col(x, z, r < .3 ? 1.2 + rand() : r < .8 ? 2.5 + rand()*2 : 5, r < .15); }
    const wall = (x, z, w, h, ry) => { const g = new THREE.Group(); const n = Math.round(w/1.0); for(let i = 0; i < n; i++){ const hh = h*(.4 + rand()*.6); g.add(boxM(1.0, hh, .7, M.stone, -w/2 + .5 + i, hh/2, 0)); } place(g, x, z, ry); colliders.push({ type: 'rect', x, z, hw: w/2, hd: .45, ang: ry, wild: true }); };
    wall(Z.x - 15, Z.z - 4, 7, 2.8, 1.2); wall(Z.x + 15, Z.z + 2, 8, 3.2, -1.1); wall(Z.x - 6, Z.z + 17, 6, 2.2, .2);
    // graves
    const graveM = M.stoneDark;
    for(let i = 0; i < 16; i++){ const x = Z.x - 9 + (i % 4)*3.2 + rand()*.6, z = Z.z - 19 + Math.floor(i/4)*2.6 + rand()*.6; if(Math.hypot(x - Z.x, z - Z.z) < 6) continue;
      const g = new THREE.Group(); const top = new THREE.Shape(); top.moveTo(-.32, 0); top.lineTo(.32, 0); top.lineTo(.32, .7); top.absarc(0, .7, .32, 0, Math.PI, false); top.lineTo(-.32, 0);
      const sg = new THREE.ExtrudeGeometry(top, { depth: .12, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 1 }); sg.translate(0, 0, -.06); const st = mesh(uvBox(sg), graveM); st.rotation.x = (rand() - .5)*.25; st.rotation.z = (rand() - .5)*.2; g.add(st);
      g.add(boxM(.7, .08, 1.6, M.stone, 0, .02, .9)); place(g, x, z, Math.PI + (rand() - .5)*.2); circ(x, z, .45); }
    // crypt (lich lair) at the far end
    { const x = Z.x, z = Z.z + 20; const g = new THREE.Group();
      g.add(boxM(7, 4.2, 5, M.stone, 0, 2.1, -1.0)); g.add(boxM(7.6, .5, 5.6, M.stoneDark, 0, 4.4, -1.0));
      const arch = new THREE.Shape(); arch.moveTo(-1.3, 0); arch.lineTo(-1.3, 2.0); arch.absarc(0, 2.0, 1.3, Math.PI, 0, true); arch.lineTo(1.3, 0); arch.lineTo(1.7, 0); arch.lineTo(1.7, 3.6); arch.lineTo(-1.7, 3.6); arch.lineTo(-1.7, 0); arch.closePath();
      const ag = new THREE.ExtrudeGeometry(arch, { depth: .6, bevelEnabled: false, curveSegments: 14 }); g.add(mesh(uvBox(ag), M.stone, 0, 0, 1.4));
      g.add(boxM(2.6, 3.2, .1, M.dark, 0, 1.6, 1.45));
      [-2.6, 2.6].forEach(s => { g.add(boxM(.9, 5.2, .9, M.stone, s, 2.6, 1.7)); g.add(mesh(new THREE.ConeGeometry(.6, 1.2, 4), M.stoneDark, s, 5.8, 1.7)); });
      place(g, x, z, Math.PI); colliders.push({ type: 'rect', x, z: z + 1, hw: 3.8, hd: 2.9, ang: Math.PI, wild: true, h: 5 });
      const L = nightLight('#5aff8a', 8, 12, x, Y(x, z) + 2, z - 2.2); L.userData.always = .8;
      glowSprite('#5aff8a', 3.5, x, Y(x, z) + 1.6, z - 2.0, null, .7);
    }
    // eerie mist
    const mist = []; for(let i = 0; i < 22; i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#9ab8a8', transparent: true, opacity: .18, depthWrite: false })); const a = rand()*6.28, d = rand()*Z.r; s.position.set(Z.x + Math.cos(a)*d, Y(Z.x, Z.z) + .6, Z.z + Math.sin(a)*d); s.scale.set(7, 2.2, 1); world.add(s); mist.push({ s, p: rand()*6, x0: s.position.x }); }
    anim.push(t => mist.forEach(m => { m.s.position.x = m.x0 + Math.sin(t*.15 + m.p)*2; m.s.material.opacity = .12 + Math.sin(t*.3 + m.p)*.06; }));
    for(let i = 0; i < 12; i++){ const a = rand()*6.28, d = 14 + rand()*12; const x = Z.x + Math.cos(a)*d, z = Z.z + Math.sin(a)*d; if(!inWild(x, z, 4)) continue; deadTrees.push({ x, z, s: .9 + rand()*.4, r: rand()*6, type: 'dead' }); circ(x, z, .5); }
    for(let i = 0; i < 9; i++){ const a = i/9*6.28 + rand()*.3, d = 5 + rand()*13; spawns.push({ type: i % 3 === 1 ? 'skeleton_ar' : 'skeleton', x: Z.x + Math.cos(a)*d, z: Z.z + Math.sin(a)*d, wander: 5 }); }
    spawns.push({ type: 'lich', x: Z.x, z: Z.z + 14, wander: 2 });
  }

  // ---------- the new regions: lake, heath, dark wood, swamp, mines, farm, shrine ----------
  const reserve = [];   // keep trees off props
  const res = (x, z, r) => reserve.push([x, z, r]);
  const inZ = (Zn, k, tries) => { for(let t = 0; t < (tries || 30); t++){ const a = rand()*6.28, d = Math.sqrt(rand())*Zn.r*k; const x = Zn.x + Math.cos(a)*d, z = Zn.z + Math.sin(a)*d; if(inWild(x, z, 2) && !deepWater(x, z)) return [x, z]; } return [Zn.x, Zn.z]; };
  const hideM2 = (c1) => { const t = canvasTexture(256, 256, (c, w, h) => { c.fillStyle = c1; c.fillRect(0, 0, w, h); for(let i = 0; i < 300; i++){ c.fillStyle = `rgba(0,0,0,${Math.random()*.18})`; c.fillRect(Math.random()*w, Math.random()*h, 4 + Math.random()*30, 2 + Math.random()*8); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, roughness: .95, side: THREE.DoubleSide }); };
  const tentAt = (x, z, k, ry, mat) => { const g = new THREE.Group(); const cg = new THREE.ConeGeometry(2.3*k, 3.0*k, 6, 1, true); g.add(mesh(cg, mat, 0, 1.5*k, 0)); [0, 1, 2].forEach(i => { const pp = cylM(.04, .04, 1.1*k, 5, M.wood, Math.cos(i*2.1)*.2, 3.3*k, Math.sin(i*2.1)*.2); pp.rotation.set((rand() - .5)*.6, 0, (rand() - .5)*.6); g.add(pp); }); g.add(boxM(1.0*k, 1.5*k, .05, M.dark, 0, .75*k, 1.9*k)); place(g, x, z, ry); circ(x, z, 2.2*k); res(x, z, 3*k); };
  const lanternPost = (x, z, col) => { const g = new THREE.Group(); g.add(cylM(.07, .08, 2.6, 6, M.wood, 0, 1.3, 0)); g.add(boxM(.6, .06, .06, M.wood, .28, 2.5, 0)); g.add(cylM(.12, .1, .25, 6, M.lampGlass, .52, 2.28, 0)); place(g, x, z); circ(x, z, .2); const yy = Y(x, z); const L = nightLight(col || '#ffb35c', 6, 11, x + .52, yy + 2.3, z); L.userData.always = .45; glowSprite(col || '#ffc27a', 1.4, x + .52, yy + 2.28, z, null, .5); };
  const standingStone = (x, z, h, ry) => { const geo = new THREE.BoxGeometry(1.0, h, .7, 3, 6, 2); const pp = geo.attributes.position; for(let i = 0; i < pp.count; i++){ const vx = pp.getX(i), vy = pp.getY(i), vz = pp.getZ(i); const k = 1 - Math.pow(Math.max(0, (vy + h/2)/h), 2.2)*.45; const n = (fbm2(vx*2 + x, vy*1.3 + z, 2) - .5)*.22; pp.setXYZ(i, vx*k + n, vy + (vy > h/2 - .01 ? (fbm2(vx*3 + z, vz*3, 2) - .5)*.5 : 0), vz*k + n*.6); } geo.computeVertexNormals();
    const m = mesh(uvBox(geo), M.stoneDark, x, Y(x, z) + h/2 - .3, z); m.rotation.set((rand() - .5)*.12, ry, (rand() - .5)*.12); world.add(m); circ(x, z, .6); };
  const spawnIn = (Zn, type, n, k, wander) => { for(let i = 0; i < n; i++){ const [x, z] = inZ(Zn, k); spawns.push({ type, x, z, wander: wander || 6 }); } };

  // Тихе озеро: fisherman's pier & hut, stepping stones to the island
  { const Zn = zone('lake'); const hx = -146, hz = 24;
    const g = new THREE.Group(); g.add(boxM(4.2, 2.6, 3.4, M.planks, 0, 1.3, 0)); const rg = new THREE.Group(); rg.position.y = 2.6; g.add(rg);
    const roofM = new THREE.MeshStandardMaterial({ color: '#8a7448', roughness: 1, map: tex2('grass2.jpg', { srgb: true, repeat: 1.5 }) });
    [-1, 1].forEach(sd => { const r = boxM(2.7, .14, 4.2, roofM, sd*1.1, 2.6 + .7, 0); r.rotation.z = -sd*.62; g.add(r); });
    g.add(boxM(1.0, 1.9, .08, M.dark, 0, .95, 1.72)); place(g, hx, hz, -Math.PI/2); colliders.push({ type: 'rect', x: hx, z: hz, hw: 2.4, hd: 2.0, ang: -Math.PI/2, wild: true, h: 4 }); res(hx, hz, 5);
    // pier
    const py = LAKE.level + .45; const pier = new THREE.Group(); pier.position.set(-158, py, 26);
    for(let i = 0; i < 9; i++){ pier.add(boxM(2.0, .1, .9, M.planks, -i*1.0, 0, 0)); if(i % 2 === 0) [-1, 1].forEach(sd => pier.add(cylM(.09, .09, 2.4, 6, M.wood, -i*1.0, -1.0, sd*.9))); }
    world.add(pier);
    const boat = new THREE.Group(); const hullG = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI*2, Math.PI/2, Math.PI/2); boat.add(mesh(hullG, M.wood, 0, .25, 0).scale.set(.8, .45, 2.0) && mesh(hullG, M.wood, 0, .25, 0)); boat.children[0].scale.set(.8, .45, 2.0); boat.position.set(-163, LAKE.level + .1, 28.6); boat.rotation.y = .3; world.add(boat);
    anim.push(t => { boat.position.y = LAKE.level + .08 + Math.sin(t*1.3)*.04; boat.rotation.z = Math.sin(t*1.1)*.03; });
    lanternPost(-157, 24.6, '#ffc27a');
    for(let i = 0; i <= 16; i++){ const t = i/16; const x = FORD[0][0] + (FORD[1][0] - FORD[0][0])*t + (rand() - .5)*.6, z = FORD[0][1] + (FORD[1][1] - FORD[0][1])*t + (rand() - .5)*.6; rockSpots.push({ x, z, y: LAKE.level - .1, s: 1.1 + rand()*.4, r: rand()*6, sy: .32, v: i, sink: .02 }); }
    // the island: a broken idol and old stones
    { const ix = ISLAND.x, iz = ISLAND.z; const g2 = new THREE.Group(); for(let i = 0; i < 6; i++){ const a = i/6*6.28; const st = boxM(.6, 1.4 + rand()*1.2, .5, M.stoneDark, Math.cos(a)*5, .5, Math.sin(a)*5); st.rotation.set((rand() - .5)*.3, a, (rand() - .5)*.3); g2.add(st); } place(g2, ix, iz);
      const L = nightLight('#5affe0', 6, 14, ix, Y(ix, iz) + 2, iz); L.userData.always = .7; glowSprite('#5affe0', 3.2, ix, Y(ix, iz) + 1.2, iz, null, .7); }
    for(let i = 0; i < 40; i++){ const a = rand()*6.28, d = LAKE.r*(.55 + rand()*.4); const x = LAKE.x + Math.cos(a)*d, z = LAKE.z + Math.sin(a)*d; if(Math.hypot(x - ISLAND.x, z - ISLAND.z) < 12) continue; const lp = mesh(new THREE.CircleGeometry(.35 + rand()*.3, 10, .3, 5.6), new THREE.MeshStandardMaterial({ color: '#3a6a2a', roughness: .6, side: THREE.DoubleSide }), x, LAKE.level + .02, z, false); lp.rotation.x = -Math.PI/2; lp.rotation.z = rand()*6; world.add(lp); }
    for(let i = 0; i < 18; i++){ const a = rand()*6.28, d = LAKE.r*(1.0 + rand()*.25); const x = LAKE.x + Math.cos(a)*d, z = LAKE.z + Math.sin(a)*d; if(!inWild(x, z, 1)) continue; spawns.push({ type: i % 3 === 2 ? 'rusalka' : 'drowner', x, z, wander: 6 }); }
    spawns.push({ type: 'vodyanyk', x: ISLAND.x + 1, z: ISLAND.z + 1, wander: 2 });
    spawns.push({ type: 'drowner', x: ISLAND.x - 3, z: ISLAND.z + 3, wander: 0, dormant: true }, { type: 'drowner', x: ISLAND.x + 3, z: ISLAND.z - 3, wander: 0, dormant: true });
  }
  // Вовчі пагорби: menhir ring and a den
  { const Zn = zone('heath');
    for(let i = 0; i < 9; i++){ const a = i/9*6.28; standingStone(Zn.x + Math.cos(a)*9, Zn.z + Math.sin(a)*9, 2.6 + rand()*1.4, a + Math.PI/2); }
    res(Zn.x, Zn.z, 12);
    for(let i = 0; i < 14; i++){ const [x, z] = inZ(Zn, .8); const b = mesh(new THREE.CapsuleGeometry(.035, .5, 3, 6), new THREE.MeshStandardMaterial({ color: '#d8ccb0', roughness: .7 }), x, Y(x, z) + .05, z); b.rotation.set(Math.PI/2, rand()*6, 0); world.add(b); }
    spawnIn(Zn, 'wolfling', 11, .85, 8); spawns.push({ type: 'wolf_alpha', x: Zn.x + 2, z: Zn.z, wander: 3 });
  }
  // Темний ліс: the bandits' camp
  { const Zn = zone('darkwood'); const cx = Zn.x - 6, cz = Zn.z + 4;
    const hm = hideM2('#3a3428');
    tentAt(cx - 7, cz + 3, 1, .8, hm); tentAt(cx + 6, cz + 6, .9, 2.4, hm); tentAt(cx + 4, cz - 7, 1.1, 4.2, hm); tentAt(cx - 6, cz - 6, .95, 5.4, hm);
    campfire(cx, cz); res(cx, cz, 13);
    // lookout tower
    { const g = new THREE.Group(); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b2]) => g.add(cylM(.12, .14, 6.5, 6, M.wood, a*1.1, 3.25, b2*1.1))); g.add(boxM(3, .15, 3, M.planks, 0, 6.2, 0)); [[0, 1.5], [0, -1.5], [1.5, 0], [-1.5, 0]].forEach(([a, b2]) => g.add(boxM(a ? .08 : 3, .9, a ? 3 : .08, M.planks, a, 6.7, b2)));
      const rr = mesh(new THREE.ConeGeometry(2.4, 1.6, 4), M.beam, 0, 8.0, 0); rr.rotation.y = Math.PI/4; g.add(rr); place(g, cx + 11, cz - 1); circ(cx + 11, cz - 1, 1.8); res(cx + 11, cz - 1, 3); }
    // cages & loot
    for(let k = 0; k < 2; k++){ const g = new THREE.Group(); for(let i = 0; i < 10; i++){ const a = i/10*6.28; g.add(cylM(.03, .03, 1.8, 4, M.iron, Math.cos(a)*.8, .9, Math.sin(a)*.8)); } g.add(cylM(.85, .85, .08, 12, M.iron, 0, 1.8, 0)); g.add(cylM(.85, .85, .08, 12, M.iron, 0, .04, 0)); const x = cx - 2 + k*4, z = cz + 9; place(g, x, z); circ(x, z, .9); }
    spawnIn({ x: cx, z: cz, r: 26 }, 'bandit', 8, 1, 7); spawnIn({ x: cx, z: cz, r: 22 }, 'bandit_ar', 4, 1, 5);
    spawns.push({ type: 'raven', x: cx + 1, z: cz - 2, wander: 2 }, { type: 'bandit', x: cx - 3, z: cz + 2, wander: 0, dormant: true }, { type: 'bandit', x: cx + 3, z: cz + 2, wander: 0, dormant: true });
  }
  // Гниле болото: the witch's stilt hut, cauldron, marsh lights
  { const Zn = zone('swamp'); const hx = Zn.x + 4, hz = Zn.z - 6;
    const g = new THREE.Group(); [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]].forEach(([a, b2]) => g.add(cylM(.12, .15, 3.4, 6, M.beam, a, 1.2, b2)));
    g.add(boxM(3.4, 2.4, 3.0, M.planks, 0, 3.6, 0)); const rf = mesh(new THREE.ConeGeometry(3.0, 2.6, 5), new THREE.MeshStandardMaterial({ color: '#4a4a2a', roughness: 1 }), 0, 6.1, 0); rf.rotation.z = .12; g.add(rf);
    g.add(boxM(1, 1.7, .06, M.dark, 0, 3.3, 1.52)); g.add(rot(boxM(1.0, .1, 3.2, M.planks, 0, 1.2, 3.0), 'x', .65));
    place(g, hx, hz, .4); circ(hx, hz, 2.2); res(hx, hz, 7);
    const cg = new THREE.Group(); cg.add(mesh(new THREE.SphereGeometry(.7, 16, 10, 0, Math.PI*2, Math.PI*.35, Math.PI*.65), M.iron, 0, .7, 0)); cg.add(mesh(new THREE.CircleGeometry(.55, 16), new THREE.MeshStandardMaterial({ color: '#2a4a10', emissive: '#7aff3a', emissiveIntensity: .8 }), 0, .9, 0).rotateX(-Math.PI/2));
    place(cg, hx + 4, hz + 3); circ(hx + 4, hz + 3, .8); fires.push({ parent: cg, x: 0, y: .1, z: 0, s: .6, color: '#7aff3a' });
    { const L = nightLight('#7aff3a', 7, 11, hx + 4, Y(hx + 4, hz + 3) + 1.5, hz + 3); L.userData.always = .8; }
    const lights2 = []; for(let i = 0; i < 26; i++){ const [x, z] = inZ(Zn, 1); const sp = glowSprite('#b8ff6a', .5, x, Y(x, z) + 1 + rand(), z, null, .9); lights2.push({ sp, x, z, p: rand()*6, y0: sp.position.y }); }
    anim.push(t => lights2.forEach(l => { l.sp.position.set(l.x + Math.sin(t*.5 + l.p)*1.4, l.y0 + Math.sin(t*1.3 + l.p)*.4, l.z + Math.cos(t*.4 + l.p)*1.4); }));
    const mist2 = []; for(let i = 0; i < 26; i++){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#a8b898', transparent: true, opacity: .16, depthWrite: false })); const [x, z] = inZ(Zn, 1.1); sp.position.set(x, SWAMP.level + .7, z); sp.scale.set(9, 2.4, 1); world.add(sp); mist2.push({ sp, p: rand()*6, x0: x }); }
    anim.push(t => mist2.forEach(m => { m.sp.position.x = m.x0 + Math.sin(t*.12 + m.p)*2.5; m.sp.material.opacity = .1 + Math.sin(t*.3 + m.p)*.06; }));
    spawnIn(Zn, 'lizard', 9, .95, 7); spawnIn(Zn, 'bogslime', 6, .9, 5);
    spawns.push({ type: 'witch', x: hx + 2, z: hz + 6, wander: 2 }, { type: 'bogslime', x: hx - 3, z: hz + 8, wander: 0, dormant: true }, { type: 'bogslime', x: hx + 6, z: hz + 9, wander: 0, dormant: true });
  }
  // Покинуті шахти: timbered adit, rails, carts, ore heaps
  { const Zn = zone('mines'); const mx = Zn.x, mz = Zn.z - 14;
    const g = new THREE.Group();
    g.add(boxM(.5, 4.2, .5, M.beam, -2.4, 2.1, 0)); g.add(boxM(.5, 4.2, .5, M.beam, 2.4, 2.1, 0)); g.add(boxM(5.6, .5, .6, M.beam, 0, 4.35, 0)); g.add(boxM(4.4, 4.0, 3.0, M.dark, 0, 2.0, -1.6));
    for(let i = 0; i < 6; i++) g.add(boxM(.12, .08, 2.0, M.iron, (i % 2 ? .6 : -.6), .05, 1.5 + Math.floor(i/2)*2.0));
    for(let i = 0; i < 8; i++) g.add(boxM(1.8, .1, .25, M.beam, 0, .03, .6 + i*.8));
    const sign = canvasTexture(512, 128, (c, w, h) => { c.fillStyle = '#2a1e14'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8d0a0'; c.font = 'bold 56px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ШАХТА «ЗОРЯНА»', w/2, h/2 + 3); });
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .8), new THREE.MeshStandardMaterial({ map: sign, roughness: .9 })); sp.position.set(0, 5.1, .32); sp.userData.keep = true; g.add(sp);
    place(g, mx, mz, 0); colliders.push({ type: 'rect', x: mx, z: mz - 1.4, hw: 3.2, hd: 2.2, ang: 0, wild: true, h: 6 }); res(mx, mz, 8);
    [[-6, -9, 4.5, .8], [6, -9, 4.0, .85], [0, -12, 6, .9], [-9, -5, 3, .8], [9, -5, 3.2, .8]].forEach(([lx, lz, s2, sy], k) => rockSpots.push({ x: mx + lx, z: mz + lz, s: s2, r: k, sy, v: k + 7 }));
    for(let k = 0; k < 3; k++){ const cart = new THREE.Group(); cart.add(boxM(1.1, .6, 1.5, M.iron, 0, .55, 0)); [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]].forEach(([a, b2]) => cart.add(mesh(new THREE.CylinderGeometry(.18, .18, .08, 10), M.iron, a, .2, b2).rotateZ(Math.PI/2))); const ore = mesh(new THREE.IcosahedronGeometry(.45, 0), new THREE.MeshStandardMaterial({ color: '#6a5a8a', emissive: '#4a3aaa', emissiveIntensity: .25, roughness: .5 }), 0, .95, 0); ore.scale.y = .6; cart.add(ore); const x = mx + (k - 1)*4.5, z = mz + 5 + (k % 2)*2; place(cart, x, z, rand()); circ(x, z, .9); }
    lanternPost(mx - 3.5, mz + 2, '#ffb85a'); lanternPost(mx + 3.5, mz + 2, '#ffb85a');
    spawnIn({ x: mx, z: mz + 14, r: 26 }, 'golem', 6, 1, 6); spawnIn({ x: mx, z: mz + 12, r: 24 }, 'minerghost', 4, 1, 5);
    spawns.push({ type: 'colossus', x: mx, z: mz + 9, wander: 2 }, { type: 'golem', x: mx - 4, z: mz + 6, wander: 0, dormant: true }, { type: 'golem', x: mx + 4, z: mz + 6, wander: 0, dormant: true });
  }
  // Хутір Вербівка: farmhouses, a windmill, fields and fences
  { const Zn = zone('farm');
    const farmHouse = (x, z, ry, w, d) => { const g = new THREE.Group(); g.add(boxM(w + .3, .5, d + .3, M.stoneDark, 0, .25, 0)); g.add(boxM(w, 2.6, d, M.plaster('#e8dcc0'), 0, 1.8, 0));
      [-1, 1].forEach(sd => [-1, 1].forEach(sz => g.add(boxM(.2, 2.6, .2, M.beam, sd*(w/2 - .05), 1.8, sz*(d/2 - .05)))));
      const thatch = new THREE.MeshStandardMaterial({ color: '#c8a868', roughness: 1, map: tex2('wood_c.jpg', { srgb: true, repeat: 1.2 }) });
      [-1, 1].forEach(sd => { const r = boxM(w*.62, .3, d + .8, thatch, sd*w*.26, 3.75, 0); r.rotation.z = -sd*.72; g.add(r); });
      g.add(boxM(1.0, 1.9, .08, M.planks, 0, 1.45, d/2 + .03)); [-1, 1].forEach(sd => g.add(boxM(.7, .7, .06, M.glass, sd*(w/2 - 1), 2.0, d/2 + .03)));
      place(g, x, z, ry); colliders.push({ type: 'rect', x, z, hw: w/2 + .3, hd: d/2 + .3, ang: ry, wild: true, h: 5 }); res(x, z, Math.max(w, d)*.75 + 1.5); };
    farmHouse(Zn.x - 6, Zn.z - 4, .4, 6, 5); farmHouse(Zn.x + 8, Zn.z - 8, -.3, 5, 4.5); farmHouse(Zn.x - 12, Zn.z + 9, 1.4, 7, 5.5);
    // windmill
    { const wx = Zn.x + 12, wz = Zn.z + 10; const g = new THREE.Group(); const tw = new THREE.CylinderGeometry(1.6, 2.4, 8, 12); g.add(mesh(uvCylLathe(tw), M.plaster('#e8e0cc'), 0, 4, 0)); g.add(mesh(new THREE.ConeGeometry(2.0, 2.4, 12), M.roofDark, 0, 9.2, 0));
      const hub = new THREE.Group(); hub.position.set(0, 7.6, 1.9); g.add(hub); hub.add(mesh(new THREE.CylinderGeometry(.2, .2, .6, 8), M.beam, 0, 0, 0).rotateX(Math.PI/2));
      for(let i = 0; i < 4; i++){ const arm = new THREE.Group(); arm.rotation.z = i*Math.PI/2; hub.add(arm); arm.add(boxM(.14, 5.2, .1, M.beam, 0, 2.7, .2)); arm.add(boxM(.9, 4.2, .04, new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: .9, side: THREE.DoubleSide }), .55, 3.0, .25)); }
      hub.userData.keepGroup = true; g.userData.keepGroup = true; anim.push(t => { hub.rotation.z = t*.6; });
      g.add(boxM(1.0, 1.9, .1, M.planks, 0, .95, 2.15)); place(g, wx, wz, -.6); circ(wx, wz, 2.4); res(wx, wz, 5); }
    // fields with crop rows
    const cropM = new THREE.MeshStandardMaterial({ color: '#b8a040', roughness: .9 }), cropG = new THREE.MeshStandardMaterial({ color: '#5a8a2a', roughness: .9 });
    [[Zn.x + 2, Zn.z + 14, 0, cropM], [Zn.x - 16, Zn.z - 8, .3, cropG], [Zn.x + 16, Zn.z - 4, -.2, cropM]].forEach(([fx, fz, ry, cm]) => {
      paint(c => { c.save(); c.translate(fx, fz); c.rotate(-ry); c.fillStyle = 'rgba(255,0,0,.55)'; c.fillRect(-7, -5, 14, 10); c.restore(); });
      const g = new THREE.Group(); for(let r2 = 0; r2 < 8; r2++) for(let i = 0; i < 16; i++){ const st = mesh(new THREE.ConeGeometry(.12, .7 + rand()*.3, 4), cm, -6.5 + i*.87, .4, -4 + r2*1.15, false); g.add(st); } place(g, fx, fz, ry); res(fx, fz, 9);
      // fence
      const fg = new THREE.Group(); for(let i = 0; i <= 16; i++){ [-5.6, 5.6].forEach(zz => fg.add(boxM(.08, 1, .08, M.wood, -7.6 + i*.95, .5, zz))); } [-5.6, 5.6].forEach(zz => { fg.add(boxM(15.2, .08, .05, M.wood, 0, .8, zz)); fg.add(boxM(15.2, .08, .05, M.wood, 0, .45, zz)); }); place(fg, fx, fz, ry); });
    // haystacks
    for(let i = 0; i < 4; i++){ const [x, z] = inZ(Zn, .7); const hs = mesh(new THREE.SphereGeometry(1.2, 14, 10, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: '#c8a85a', roughness: 1, map: tex2('grass2.jpg', { srgb: true, repeat: 1 }) }), x, Y(x, z) - .1, z); hs.scale.y = 1.3; world.add(hs); circ(x, z, 1.2); res(x, z, 2); }
    lanternPost(Zn.x - 2, Zn.z + 1); lanternPost(Zn.x + 5, Zn.z - 3);
  }
  // Святилище Велеса: menhir ring, carved idol, eternal fire
  { const Zn = zone('shrine');
    for(let i = 0; i < 10; i++){ const a = i/10*6.28; standingStone(Zn.x + Math.cos(a)*8, Zn.z + Math.sin(a)*8, 3.2 + (i % 2)*.8, a + Math.PI/2); }
    const g = new THREE.Group(); g.add(mesh(uvCylLathe(new THREE.CylinderGeometry(.45, .55, 4.2, 10)), M.beam, 0, 2.1, 0));
    const face = canvasTexture(256, 512, (c, w, h) => { c.fillStyle = '#4a3a2c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a1e14'; c.lineWidth = 8; c.beginPath(); c.arc(w/2, 150, 60, 0, 7); c.stroke(); c.fillStyle = '#ffd27a'; [-26, 26].forEach(dx => { c.beginPath(); c.arc(w/2 + dx, 140, 9, 0, 7); c.fill(); }); c.beginPath(); c.moveTo(w/2 - 40, 330); c.lineTo(w/2 + 40, 330); c.stroke(); for(let i = 0; i < 6; i++){ c.beginPath(); c.moveTo(20, 380 + i*20); c.lineTo(w - 20, 380 + i*20); c.stroke(); } });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.8), new THREE.MeshStandardMaterial({ map: face, roughness: .8, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: .12 })); fp.position.set(0, 2.9, .5); fp.userData.keep = true; g.add(fp);
    [-1, 1].forEach(sd => { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(sd*.35, 4.0, 0), new THREE.Vector3(sd*.9, 4.4, .1), new THREE.Vector3(sd*1.1, 5.0, .2), new THREE.Vector3(sd*.9, 5.4, .3)]); g.add(mesh(new THREE.TubeGeometry(curve, 12, .08, 6), new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: .5 }))); });
    place(g, Zn.x, Zn.z - 1, 0); circ(Zn.x, Zn.z - 1, .7);
    interactives.push({ id: 'oracle', name: 'Оракул Велеса', action: 'oracle', desc: '', door: { x: Zn.x, z: Zn.z + 1.6 }, group: g, labelY: Y(Zn.x, Zn.z) + 6, pos: new THREE.Vector3(Zn.x, Y(Zn.x, Zn.z), Zn.z - 1) });
    { const ax = Zn.x + 5, az = Zn.z + 5; const ag = new THREE.Group(); ag.add(boxM(1.6, .9, 1.0, M.stoneDark, 0, .45, 0)); const rt = canvasTexture(256, 128, (c, w, h) => { c.fillStyle = '#2a2622'; c.fillRect(0, 0, w, h); c.fillStyle = '#7ae0ff'; c.font = 'bold 54px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ᚠ ᚢ ᚦ ᚨ ᚱ', w/2, h/2); });
      const rp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .75), new THREE.MeshStandardMaterial({ map: rt, emissive: '#ffffff', emissiveMap: rt, emissiveIntensity: .6, roughness: .8 })); rp.rotation.x = -Math.PI/2; rp.position.y = .91; rp.userData.keep = true; ag.add(rp);
      place(ag, ax, az, .6); circ(ax, az, .9); interactives.push({ id: 'runes', name: 'Коло Рун', action: 'runes', desc: '', door: { x: ax + 1.6, z: az + 1.2 }, group: ag, labelY: Y(ax, az) + 2.4, pos: new THREE.Vector3(ax, Y(ax, az), az) }); }
    const fb = new THREE.Group(); fb.add(cylM(.5, .35, .5, 12, M.stone, 0, .25, 0)); fires.push({ parent: fb, x: 0, y: .5, z: 0, s: .8, color: '#ff9a3a' }); place(fb, Zn.x, Zn.z + 2.5); circ(Zn.x, Zn.z + 2.5, .7);
    { const L = nightLight('#ff9a4a', 8, 13, Zn.x, Y(Zn.x, Zn.z) + 1.6, Zn.z + 2.5); L.userData.always = .8; }
    res(Zn.x, Zn.z, 12);
  }

  // =====================================================================================
  //  Settlements of the friendly peoples
  // =====================================================================================
  const strawTex = canvasTexture(256, 256, (c, w, h) => { c.fillStyle = '#b39352'; c.fillRect(0, 0, w, h); for(let i = 0; i < 1400; i++){ const x = Math.random()*w, y = Math.random()*h, l = 10 + Math.random()*26; const v = Math.random(); c.strokeStyle = v < .4 ? 'rgba(90,64,30,.45)' : v < .8 ? 'rgba(230,200,120,.45)' : 'rgba(60,44,20,.5)'; c.lineWidth = 1 + Math.random()*1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (Math.random() - .5)*4, y + l); c.stroke(); } for(let y = 0; y < h; y += 32){ c.fillStyle = 'rgba(40,28,12,.25)'; c.fillRect(0, y, w, 4); } });
  strawTex.wrapS = strawTex.wrapT = THREE.RepeatWrapping; strawTex.repeat.set(1.5, 1.5);
  const thatchM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, map: strawTex });
  const shingleM = M.roofDark;
  const gableTri = (w, rh, mat, zz) => { const s = new THREE.Shape(); s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(0, rh); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: .2, bevelEnabled: false }); g.translate(0, 0, zz - .1); return mesh(uvBox(g), mat); };
  // a cottage on a stone plinth that reaches into the slope; door faces local +z
  const cottage = (x, z, ry, w, d, o) => { o = o || {}; const g = new THREE.Group(); const h = o.h || 2.8, wall = o.wallM || M.plaster(o.wall || '#e8dcc0');
    g.add(boxM(w + .5, 2.4, d + .5, M.stoneDark, 0, -.9, 0)); g.add(boxM(w, h, d, wall, 0, .3 + h/2, 0));
    if(o.beams !== false) [-1, 1].forEach(sd => [-1, 1].forEach(sz => g.add(boxM(.22, h, .22, M.beam, sd*(w/2 - .05), .3 + h/2, sz*(d/2 - .05)))));
    const top = .3 + h, rh = w*.42, roofM = o.roof === 'slate' ? M.slate : o.roof === 'tile' ? M.roof : o.roof === 'shingle' ? shingleM : thatchM;
    [-1, 1].forEach(sd => { const L = Math.hypot(w/2 + .5, rh + .2); const r = boxM(L, o.roof === 'thatch' || !o.roof ? .32 : .16, d + .9, roofM, sd*(w/4 + .05), top + rh/2 + .05, 0); r.rotation.z = -sd*Math.atan2(rh + .2, w/2 + .5); g.add(r); });
    [-1, 1].forEach(sz => g.add(gableTri(w, rh, o.gableM || wall, sz*(d/2 - .1))));
    g.add(boxM(1.0, 1.95, .1, M.planks, 0, 1.28, d/2 + .03)); g.add(boxM(1.25, .14, .2, M.beam, 0, 2.3, d/2 + .06));
    [-1, 1].forEach(sd => { g.add(boxM(.72, .72, .06, M.glass, sd*(w/2 - 1.05), 1.85, d/2 + .03)); g.add(boxM(.9, .1, .18, M.beam, sd*(w/2 - 1.05), 1.44, d/2 + .08)); });
    if(o.side !== false) [-1, 1].forEach(sd => g.add(boxM(.06, .7, .7, M.glass, sd*(w/2 + .02), 1.85, 0)));
    if(o.chimney){ g.add(boxM(.6, rh + 1.4, .6, M.stone, w*.28, top + rh/2 + .4, -d*.2)); }
    if(o.lamp){ const lg = new THREE.Group(); lg.position.set(.85, 2.2, d/2 + .25); g.add(lg); lg.add(cylM(.1, .08, .26, 6, M.lampGlass, 0, 0, 0)); }
    place(g, x, z, ry); colliders.push({ type: 'rect', x, z, hw: w/2 + .3, hd: d/2 + .3, ang: ry, wild: true, h: top + rh }); res(x, z, Math.max(w, d)*.75 + 1.8); return g; };
  const facing = (Zn, x, z) => Math.atan2(Zn.x - x, Zn.z - z);
  const ringSpots = (Zn, n, r0, r1, minGap, test) => { const out = []; for(let t = 0; t < n*40 && out.length < n; t++){ const a = rand()*6.28, d = r0 + rand()*(r1 - r0); const x = Zn.x + Math.cos(a)*d, z = Zn.z + Math.sin(a)*d; if(!inWild(x, z, 5) || roadDist(x, z) < 5.5 || deepWater(x, z)) continue; if(out.some(p => Math.hypot(p[0] - x, p[1] - z) < minGap)) continue; if(test && !test(x, z)) continue; out.push([x, z]); } return out; };
  const crateAt = (x, z, s) => { const b = boxM(s, s, s, M.planks, 0, s/2, 0); const g = new THREE.Group(); g.add(b); place(g, x, z, rand()*6); circ(x, z, s*.6); };
  const barrelAt = (x, z) => { const g = new THREE.Group(); g.add(mesh(uvCylLathe(new THREE.CylinderGeometry(.38, .38, .95, 12)), M.planks, 0, .48, 0)); [.15, .8].forEach(y => g.add(cylM(.4, .4, .06, 12, M.iron, 0, y, 0))); place(g, x, z); circ(x, z, .45); };
  const fireRing = (x, z, s) => { const g = new THREE.Group(); for(let i = 0; i < 9; i++){ const a = i/9*6.28; g.add(mesh(new THREE.DodecahedronGeometry(.24*s, 0), M.stoneDark, Math.cos(a)*.75*s, .1, Math.sin(a)*.75*s)); } [0, 1, 2].forEach(i => { const l = cylM(.07, .07, 1.1*s, 6, M.beam, 0, .2, 0); l.rotation.set(Math.PI/2, 0, i*1.05); g.add(l); }); fires.push({ parent: g, x: 0, y: .35, z: 0, s: .9*s, color: '#ff9a3a' }); place(g, x, z); circ(x, z, .9*s); const L = nightLight('#ff9a4a', 9, 16, x, Y(x, z) + 1.6, z); L.userData.always = .7; };

  // ---- Рибальське Поріччя: a human fishing hamlet on the north shore of the lake ----
  { const Zn = zone('fishing'); const dx = LAKE.x - Zn.x, dz = LAKE.z - Zn.z, dl = Math.hypot(dx, dz), ux = dx/dl, uz = dz/dl;
    const spots = ringSpots(Zn, 6, 7, 18, 9, (x, z) => heightAt(x, z) > waterLevel(x, z) + .6 && ((x - Zn.x)*ux + (z - Zn.z)*uz) < 9);
    const pal = ['#e8dcc0', '#d8c8a8', '#efe6d2', '#cdbb9a', '#e2d2b4', '#d4c4a0'];
    spots.forEach(([x, z], i) => cottage(x, z, facing(Zn, x, z), 5 + rand()*1.5, 4.2 + rand()*.8, { wall: pal[i % 6], roof: i % 3 === 0 ? 'shingle' : 'thatch', chimney: i % 2 === 0, lamp: i % 2 === 1 }));
    // pier from the shore into the lake
    let sx = Zn.x, sz = Zn.z; for(let k = 0; k < 80; k++){ sx += ux; sz += uz; if(heightAt(sx, sz) < LAKE.level + .15) break; }
    const pier = new THREE.Group(); const ry = Math.atan2(ux, uz); const len = 16, wl = LAKE.level;
    pier.add(boxM(2.4, .14, len, M.planks, 0, .45, len/2 - 3)); for(let k = 0; k <= 6; k++){ [-1, 1].forEach(sd => pier.add(cylM(.12, .12, 2.6, 6, M.beam, sd*1.1, -.75, k*len/6 - 3))); }
    [-1, 1].forEach(sd => pier.add(boxM(.08, .08, len, M.beam, sd*1.15, 1.25, len/2 - 3)));
    pier.position.set(sx, wl, sz); pier.rotation.y = ry; world.add(pier); res(sx + ux*5, sz + uz*5, 8);
    // two boats on the water by the pier and one pulled ashore
    const boat = (bx, bz, by, rr) => { const g = new THREE.Group(); const hull = new THREE.CylinderGeometry(.9, .9, 4.2, 14, 1, true, Math.PI/2, Math.PI); hull.rotateZ(Math.PI/2); hull.scale(1, .55, 1); const hm = mesh(hull, painted('#5a4a3a'), 0, .5, 0); hm.material = hm.material.clone(); hm.material.side = THREE.DoubleSide; g.add(hm); g.add(boxM(1.6, .06, .3, M.planks, 0, .35, .6)); g.add(boxM(1.6, .06, .3, M.planks, 0, .35, -.8)); g.position.set(bx, by, bz); g.rotation.y = rr; world.add(g); };
    boat(sx + ux*8 + uz*2.8, sz + uz*8 - ux*2.8, wl - .25, ry); boat(sx + ux*12 - uz*2.8, sz + uz*12 + ux*2.8, wl - .25, ry + .2);
    { const bx = sx - ux*4 + uz*5, bz = sz - uz*4 - ux*5; boat(bx, bz, heightAt(bx, bz) - .1, ry + 1.2); circ(bx, bz, 1.6); }
    // fish drying racks and nets
    for(let k = 0; k < 3; k++){ const rx = Zn.x + ux*(4 + k*2.5) - uz*(7 + k), rz = Zn.z + uz*(4 + k*2.5) + ux*(7 + k); const g = new THREE.Group(); [-1, 1].forEach(sd => g.add(cylM(.06, .07, 2.0, 6, M.beam, sd*1.4, 1.0, 0))); g.add(cylM(.04, .04, 3.0, 6, M.beam, 0, 1.9, 0).rotateZ(Math.PI/2));
      for(let f = 0; f < 7; f++){ const fm = mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshStandardMaterial({ color: '#9aa0a0', metalness: .4, roughness: .4 }), -1.2 + f*.4, 1.6, 0); fm.scale.set(1, 3.4, .5); g.add(fm); }
      place(g, rx, rz, ry + Math.PI/2); circ(rx, rz, 1.0); }
    const net = new THREE.Mesh(new THREE.PlaneGeometry(3, 2, 6, 4), new THREE.MeshStandardMaterial({ color: '#6a6248', wireframe: true })); net.position.set(Zn.x - uz*10, Y(Zn.x - uz*10, Zn.z + ux*10) + 1.1, Zn.z + ux*10); net.rotation.y = ry; net.userData.keep = true; world.add(net);
    barrelAt(Zn.x + 3, Zn.z - 2); barrelAt(Zn.x + 3.8, Zn.z - 1.3); crateAt(Zn.x - 3, Zn.z + 2.5, .8); crateAt(Zn.x - 3.6, Zn.z + 1.6, .6);
    fireRing(Zn.x, Zn.z, 1); lanternPost(sx - ux*2 + uz*2, sz - uz*2 - ux*2, '#ffc070');
    paint(c => { const gr = c.createRadialGradient(Zn.x, Zn.z, 0, Zn.x, Zn.z, 16); gr.addColorStop(0, 'rgba(255,0,0,.55)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); c.fillStyle = gr; c.fillRect(Zn.x - 16, Zn.z - 16, 32, 32); });
  }

  // ---- Лісова Гавань: the elven haven among giant oaks ----
  { const Zn = zone('elves');
    const elfWhite = M.marble, elfLeaf = new THREE.MeshStandardMaterial({ color: '#3e6a3a', roughness: .7, metalness: 0 });
    const glowM = new THREE.MeshStandardMaterial({ color: '#bff5e8', emissive: '#7fffe0', emissiveIntensity: .9, roughness: .3 });
    const giants = []; for(let i = 0; i < 6; i++){ const a = i/6*6.28 + .3, d = 26 + (i % 2)*8; const x = Zn.x + Math.cos(a)*d, z = Zn.z + Math.sin(a)*d; if(!inWild(x, z, 6)) continue; giants.push([x, z]); treeSpots.push({ x, z, s: 3.1 + rand()*.4, r: rand()*6.28, type: 0 }); circ(x, z, 2.2); res(x, z, 10); }
    // platforms with railings and spiral stairs around each giant, plus a pavilion up in the branches
    giants.forEach(([x, z], gi) => { const g = new THREE.Group(); const y0 = 7 + (gi % 3)*1.5;
      g.add(mesh(new THREE.CylinderGeometry(5.2, 5.2, .3, 28, 1, false), M.planks, 0, y0, 0));
      for(let k = 0; k < 24; k++){ const a = k/24*6.28; g.add(cylM(.05, .05, 1.0, 5, M.beam, Math.cos(a)*5.05, y0 + .65, Math.sin(a)*5.05)); }
      const rail = new THREE.Mesh(new THREE.TorusGeometry(5.05, .05, 6, 48), M.beam); rail.rotation.x = Math.PI/2; rail.position.y = y0 + 1.15; g.add(rail);
      for(let k = 0; k < 28; k++){ const a = k/28*6.28*1.6, y = k/28*y0; g.add(boxM(1.4, .12, .55, M.planks, Math.cos(a)*4.2, y, Math.sin(a)*4.2).rotateY(-a)); }
      // pavilion: white columns and a leaf-shaped dome
      const pv = new THREE.Group(); pv.position.set(2.6, y0, 0); g.add(pv); for(let k = 0; k < 6; k++){ const a = k/6*6.28; pv.add(cylM(.12, .14, 2.6, 10, elfWhite, Math.cos(a)*1.7, 1.3, Math.sin(a)*1.7)); }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 18, 10, 0, 6.283, 0, Math.PI/2), elfLeaf); dome.position.y = 2.6; dome.scale.y = .8; pv.add(dome); pv.add(mesh(new THREE.ConeGeometry(.25, 1.4, 8), elfWhite, 0, 4.7, 0));
      const lan = mesh(new THREE.SphereGeometry(.22, 12, 10), glowM, 0, 2.2, 0); pv.add(lan);
      place(g, x, z, gi); glowSprite('#7fffe0', 2.4, x + 2.6*Math.cos(gi), Y(x, z) + y0 + 2.2, z - 2.6*Math.sin(gi), null, .6); });
    // ground pavilions: the market hall and the elder's moon court
    const pavilion = (x, z, r, cols) => { const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(r + .6, r + .9, .8, 32), elfWhite, 0, -.1, 0)); for(let k = 0; k < cols; k++){ const a = k/cols*6.28; g.add(cylM(.22, .26, 4.6, 12, elfWhite, Math.cos(a)*r, 2.6, Math.sin(a)*r)); }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r + .9, 28, 12, 0, 6.283, 0, Math.PI/2), elfLeaf); dome.position.y = 4.8; dome.scale.y = .6; g.add(dome); g.add(mesh(new THREE.ConeGeometry(.35, 2.2, 10), elfWhite, 0, 7.4, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + .2, .12, 8, 40), elfWhite); ring.rotation.x = Math.PI/2; ring.position.y = 4.9; g.add(ring);
      for(let k = 0; k < cols; k += 2){ const a = (k + .5)/cols*6.28; const s = mesh(new THREE.SphereGeometry(.18, 10, 8), glowM, Math.cos(a)*r*.92, 4.2, Math.sin(a)*r*.92); g.add(s); }
      place(g, x, z); for(let k = 0; k < cols; k++){ const a = k/cols*6.28; circ(x + Math.cos(a)*r, z + Math.sin(a)*r, .35); } res(x, z, r + 4); };
    pavilion(Zn.x, Zn.z, 5.5, 10); pavilion(Zn.x + 14, Zn.z - 9, 3.6, 8);
    // the moonwell
    { const x = Zn.x - 12, z = Zn.z + 8; const g = new THREE.Group(); g.add(mesh(new THREE.TorusGeometry(2.4, .35, 10, 36), elfWhite, 0, .35, 0).rotateX(Math.PI/2)); const w = new THREE.Mesh(new THREE.CircleGeometry(2.3, 32), new THREE.MeshStandardMaterial({ color: '#2a6a7a', emissive: '#4ad8d0', emissiveIntensity: .55, roughness: .05, metalness: .3 })); w.rotation.x = -Math.PI/2; w.position.y = .45; g.add(w);
      for(let k = 0; k < 4; k++){ const a = k/4*6.28 + .4; g.add(cylM(.12, .15, 3.2, 8, elfWhite, Math.cos(a)*3.2, 1.6, Math.sin(a)*3.2)); g.add(mesh(new THREE.SphereGeometry(.2, 10, 8), glowM, Math.cos(a)*3.2, 3.35, Math.sin(a)*3.2)); }
      place(g, x, z); circ(x, z, 2.8); res(x, z, 6); interactives.push({ id: 'mimir', name: 'Джерело Мімира', action: 'mimir', desc: '', door: { x: x + 3.6, z: z + 1 }, group: g, labelY: Y(x, z) + 4.2, pos: new THREE.Vector3(x, Y(x, z), z) }); const L = nightLight('#7fffe0', 9, 16, x, Y(x, z) + 2.5, z); L.userData.always = .6; glowSprite('#7fffe0', 6, x, Y(x, z) + 1, z, null, .4); }
    // lantern stones along the paths
    for(let k = 0; k < 16; k++){ const a = k/16*6.28, d = 19; const x = Zn.x + Math.cos(a)*d, z = Zn.z + Math.sin(a)*d; if(!inWild(x, z, 2)) continue; const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(.2, .32, 1.2, 8), elfWhite, 0, .6, 0)); g.add(mesh(new THREE.SphereGeometry(.2, 10, 8), glowM, 0, 1.35, 0)); place(g, x, z); circ(x, z, .35); }
    paint(c => { c.strokeStyle = 'rgba(255,0,0,.35)'; c.lineWidth = 2.6; c.beginPath(); c.arc(Zn.x, Zn.z, 19, 0, 6.29); c.stroke(); });
  }

  // ---- Залізний Кряж: the dwarven hold carved into the mountain ----
  { const Zn = zone('dwarves'); const fx = Zn.x, fz = Zn.z - 30; const H = Math.max(Y(fx, fz), Y(fx - 10, fz), Y(fx + 10, fz));
    const g = new THREE.Group(); g.position.set(fx, H - 1, fz);
    // the cliff-face fortress: stepped stone masses, a huge arched gate and two guardian pillars
    g.add(boxM(46, 26, 16, M.stoneDark, 0, 12, -6)); g.add(boxM(34, 32, 12, M.stone, 0, 15, -9)); g.add(boxM(22, 40, 10, M.stoneDark, 0, 19, -12));
    const arch = new THREE.Shape(); arch.moveTo(-4.5, 0); arch.lineTo(-4.5, 7); arch.absarc(0, 7, 4.5, Math.PI, 0, true); arch.lineTo(4.5, 0); arch.closePath();
    g.add(mesh(new THREE.ShapeGeometry(arch), M.dark, 0, 1, 2.05));
    const door = new THREE.Shape(); door.moveTo(-3.9, 0); door.lineTo(-3.9, 7); door.absarc(0, 7, 3.9, Math.PI, 0, true); door.lineTo(3.9, 0); door.closePath();
    const dg = new THREE.ExtrudeGeometry(door, { depth: .4, bevelEnabled: false }); const dm = mesh(uvBox(dg), M.iron, 0, 1, 1.6); g.add(dm);
    for(let k = -3; k <= 3; k++) g.add(boxM(.25, 10, .2, M.bronze, k*1.1, 6, 2.05));
    g.add(boxM(13, 1.6, 2.6, M.stone, 0, 13.2, 2.4)); 
    const rune = canvasTexture(1024, 128, (c, w, h) => { c.fillStyle = '#2a2622'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8b04a'; c.font = 'bold 72px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ᚦ ЗАЛІЗНИЙ КРЯЖ ᚦ', w/2, h/2 + 4); });
    const rp = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.5), new THREE.MeshStandardMaterial({ map: rune, emissive: '#ffffff', emissiveMap: rune, emissiveIntensity: .25, roughness: .8 })); rp.position.set(0, 13.2, 3.72); rp.userData.keep = true; g.add(rp);
    [-1, 1].forEach(sd => { g.add(boxM(4, 18, 4, M.stone, sd*9, 9, 2.5)); g.add(boxM(5, 1.2, 5, M.stoneDark, sd*9, 18.6, 2.5)); g.add(cylM(1.2, .8, 1.2, 12, M.iron, sd*9, 19.8, 2.5));
      fires.push({ parent: g, x: sd*9, y: 20.6, z: 2.5, s: 2.2, color: '#ff8a3a' }); nightLight('#ff8a3a', 14, 26, sd*9, 21.5, 4, g);
      // a carved dwarf guardian: blocky body, beard and a great axe
      const st = new THREE.Group(); st.position.set(sd*16, 0, 3.5); g.add(st); st.add(boxM(3.2, 1, 3.2, M.stoneDark, 0, .5, 0)); st.add(boxM(2.6, 4.2, 1.8, M.stone, 0, 3.1, 0)); st.add(boxM(1.6, 1.5, 1.4, M.stone, 0, 6, 0)); st.add(mesh(new THREE.ConeGeometry(.9, 2.2, 6), M.stone, 0, 4.6, .55).rotateX(Math.PI));
      st.add(mesh(new THREE.SphereGeometry(.95, 12, 8, 0, 6.283, 0, Math.PI/2), M.stoneDark, 0, 6.6, 0)); st.add(boxM(.25, 6.5, .25, M.stoneDark, sd*-1.6, 3.6, .4)); st.add(boxM(1.6, 1.4, .2, M.stoneDark, sd*-1.6, 6.4, .4)); });
    world.add(g); colliders.push({ type: 'rect', x: fx, z: fz - 6, hw: 23.5, hd: 8.4, ang: 0, h: 30, wild: true }); res(fx, fz, 30);
    // a tiny interactive door: lore sheet
    interactives.push({ id: 'dwarfgate', name: 'Брама Залізного Кряжу', desc: 'Кована брама під горою. Гноми кажуть: «Двері відчиняються тим, хто приносить руду, а не балачки». Колись тут буде вхід у підгірне царство.', door: { x: fx, z: fz + 5 }, group: dm, labelY: H + 9, pos: new THREE.Vector3(fx, H, fz + 2) });
    // stone houses and forges in front of the hold
    const spots = ringSpots(Zn, 7, 9, 24, 10, (x, z) => z > fz + 10);
    spots.forEach(([x, z], i) => cottage(x, z, facing(Zn, x, z), 6.5 + rand(), 5.2 + rand()*.6, { wallM: M.stone, gableM: M.stone, roof: 'slate', h: 2.4, beams: false, chimney: true, lamp: true }));
    const forge = (x, z, ry) => { const f = new THREE.Group(); f.add(boxM(4.2, .4, 3.2, M.stoneDark, 0, .2, 0)); [-1, 1].forEach(sd => [-1, 1].forEach(sz => f.add(boxM(.3, 3, .3, M.beam, sd*1.9, 1.7, sz*1.4)))); const rf = boxM(4.8, .2, 3.8, M.slate, 0, 3.3, 0); rf.rotation.x = .12; f.add(rf);
      f.add(boxM(1.6, 1.1, 1.3, M.stone, -1, .95, -.7)); f.add(boxM(.6, 2.4, .6, M.stone, -1, 2.3, -1.0)); fires.push({ parent: f, x: -1, y: 1.6, z: -.6, s: .7, color: '#ff7a2a' }); nightLight('#ff7a2a', 7, 10, -1, 2, -.2, f);
      f.add(boxM(.8, .3, .35, M.iron, 1, .95, .3)); f.add(boxM(.35, .55, .3, M.iron, 1, .6, .3)); place(f, x, z, ry); colliders.push({ type: 'rect', x, z, hw: 2.2, hd: 1.7, ang: ry, wild: true, h: 3.4 }); res(x, z, 4); };
    forge(Zn.x - 8, Zn.z - 10, .3); forge(Zn.x + 9, Zn.z - 12, -.3);
    // carts and rails to the gate
    for(let k = 0; k < 14; k++){ const t = k/14; const x = fx + 1.5, z = fz + 4 + t*22; const sl = boxM(.18, .08, 1.4, M.beam, 0, .04, 0); const gg = new THREE.Group(); gg.add(sl.rotateY(Math.PI/2)); place(gg, x, z); }
    [-1, 1].forEach(sd => { const r = new THREE.Group(); r.add(boxM(.06, .06, 22, M.iron, 0, .1, 0)); place(r, fx + 1.5 + sd*.5, fz + 15); });
    { const c = new THREE.Group(); c.add(boxM(1.2, .8, 1.6, M.iron, 0, .8, 0)); for(let k = 0; k < 5; k++) c.add(mesh(new THREE.DodecahedronGeometry(.28, 0), M.stoneDark, (rand() - .5)*.7, 1.25, (rand() - .5)*.9)); [-1, 1].forEach(sd => [-1, 1].forEach(sz => c.add(cylM(.22, .22, .1, 10, M.iron, sd*.62, .3, sz*.55).rotateZ(Math.PI/2)))); place(c, fx + 1.5, fz + 12); circ(fx + 1.5, fz + 12, 1); }
    barrelAt(Zn.x + 2, Zn.z + 3); barrelAt(Zn.x + 2.8, Zn.z + 3.6); crateAt(Zn.x - 2.5, Zn.z + 3.5, .9); fireRing(Zn.x, Zn.z + 8, 1.2);
    paint(c => { const gr = c.createRadialGradient(Zn.x, Zn.z - 8, 0, Zn.x, Zn.z - 8, 30); gr.addColorStop(0, 'rgba(255,0,0,.6)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); c.fillStyle = gr; c.fillRect(Zn.x - 30, Zn.z - 38, 60, 60); });
  }

  // ---- Пухнасті Пагорби: the beastfolk village of round huts and totems ----
  { const Zn = zone('beasts');
    const hide = (c1) => new THREE.MeshStandardMaterial({ color: c1, roughness: .95, map: tex2('plaster_c.jpg', { srgb: true, repeat: 1 }) });
    const roundHut = (x, z, r, wallC) => { const g = new THREE.Group(); g.add(mesh(uvCylLathe(new THREE.CylinderGeometry(r, r + .1, 2.2, 18)), hide(wallC), 0, 1.1, 0)); g.add(mesh(new THREE.CylinderGeometry(r + .25, r + .35, .3, 18), M.stoneDark, 0, .05, 0));
      const roof = mesh(new THREE.ConeGeometry(r + .9, r*1.35, 18), thatchM, 0, 2.2 + r*.66, 0); g.add(roof); g.add(cylM(.05, .05, .9, 5, M.beam, 0, 2.2 + r*1.4, 0));
      g.add(boxM(.95, 1.7, .2, M.planks, 0, .85, r)); g.add(boxM(1.3, .16, .3, M.beam, 0, 1.78, r + .02)); for(let k = 0; k < 8; k++){ const a = k/8*6.28; g.add(cylM(.06, .06, 2.3, 5, M.beam, Math.cos(a)*(r + .02), 1.15, Math.sin(a)*(r + .02))); }
      place(g, x, z, facing(Zn, x, z)); circ(x, z, r + .3); res(x, z, r + 2.5); };
    const spots = ringSpots(Zn, 9, 9, 26, 8.5); const wc = ['#b89a70', '#a8865a', '#c4a882', '#9a7a52'];
    spots.forEach(([x, z], i) => roundHut(x, z, 2.2 + rand()*.8, wc[i % 4]));
    // totems with carved animal faces: wolf, fox, cat, rabbit
    const totem = (x, z, kind) => { const g = new THREE.Group(); g.add(mesh(uvCylLathe(new THREE.CylinderGeometry(.45, .55, 5.5, 10)), M.beam, 0, 2.75, 0)); const cols = { wolf: '#7a7a82', fox: '#c8641e', cat: '#2a2a30', rabbit: '#efe6d8' };
      const head = new THREE.Group(); head.position.y = 5.0; g.add(head); head.add(boxM(1.1, .9, .9, painted(cols[kind]), 0, 0, .1)); head.add(boxM(.5, .35, .5, painted(cols[kind]), 0, -.15, .65));
      const ear = kind === 'rabbit' ? [.16, .9] : [.24, .55]; [-1, 1].forEach(sd => { const e = mesh(new THREE.ConeGeometry(ear[0], ear[1], 4), painted(cols[kind]), sd*.35, .45 + ear[1]/2, 0); head.add(e); });
      [-1, 1].forEach(sd => head.add(mesh(new THREE.SphereGeometry(.08, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb030', emissiveIntensity: .8 }), sd*.25, .12, .56)));
      for(let k = 0; k < 3; k++) g.add(mesh(new THREE.TorusGeometry(.5, .07, 6, 16), painted(['#8a2a1a', '#2a4a8a', '#e8b030'][k]), 0, 1 + k*1.1, 0).rotateX(Math.PI/2));
      place(g, x, z, facing(Zn, x, z)); circ(x, z, .6); };
    ['wolf', 'fox', 'cat', 'rabbit'].forEach((k, i) => { const a = i/4*6.28 + .78; totem(Zn.x + Math.cos(a)*6.5, Zn.z + Math.sin(a)*6.5, k); });
    fireRing(Zn.x, Zn.z, 1.4);
    // hide-drying racks and a palisade arc
    for(let k = 0; k < 4; k++){ const a = k/4*6.28 + .3, d = 13; const x = Zn.x + Math.cos(a)*d, z = Zn.z + Math.sin(a)*d; if(!inWild(x, z, 2) || roadDist(x, z) < 4) continue; const g = new THREE.Group(); [-1, 1].forEach(sd => g.add(cylM(.06, .07, 2.4, 6, M.beam, sd*1.1, 1.2, 0))); g.add(cylM(.05, .05, 2.4, 6, M.beam, 0, 2.3, 0).rotateZ(Math.PI/2)); const h2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), new THREE.MeshStandardMaterial({ color: ['#8a6a4a', '#b89a7a', '#6a5a4a', '#a8805a'][k], roughness: 1, side: THREE.DoubleSide })); h2.position.y = 1.55; h2.userData.keep = true; g.add(h2); place(g, x, z, a); circ(x, z, .9); }
    for(let k = 0; k < 110; k++){ const a = k/110*6.28; if(Math.abs(Math.sin(a*2)) > .92) continue; const d = 32; const x = Zn.x + Math.cos(a)*d, z = Zn.z + Math.sin(a)*d; if(!inWild(x, z, 1) || roadDist(x, z) < 5) continue; const g = new THREE.Group(); const h = 2.2 + rand()*.6; g.add(cylM(.18, .2, h, 6, M.beam, 0, h/2 - .2, 0)); g.add(mesh(new THREE.ConeGeometry(.2, .45, 6), M.beam, 0, h - .05, 0)); place(g, x, z); circ(x, z, .3); }
    paint(c => { const gr = c.createRadialGradient(Zn.x, Zn.z, 0, Zn.x, Zn.z, 22); gr.addColorStop(0, 'rgba(255,0,0,.5)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); c.fillStyle = gr; c.fillRect(Zn.x - 22, Zn.z - 22, 44, 44); });
  }

  // =====================================================================================
  //  The Calamities: dormant lords with their hordes. They ignore travellers unless attacked.
  // =====================================================================================
  { const T = zone('titan'); spawns.push({ type: 'titan', x: T.x, z: T.z, wander: 6, passive: true, horde: 'titan', lord: true });
    for(let i = 0; i < 10; i++){ const a = i/10*6.28 + rand()*.3, d = 18 + rand()*55; const x = T.x + Math.cos(a)*d, z = T.z + Math.sin(a)*d; if(!inWild(x, z, 3)) continue; spawns.push({ type: i % 3 === 2 ? 'stone_giant' : 'titan_guard', x, z, wander: 10, passive: true, horde: 'titan' }); }
    for(let i = 0; i < 4; i++){ const a = i/4*6.28; spawns.push({ type: 'titan_guard', x: T.x + Math.cos(a)*9, z: T.z + Math.sin(a)*9, wander: 4, passive: true, horde: 'titan', dormant: true }); }
    // an ancient throne of boulders where the titan rests
    const g = new THREE.Group(); for(let k = 0; k < 9; k++){ const a = (k/9 - .5)*Math.PI*1.2 + Math.PI; const b = mesh(new THREE.DodecahedronGeometry(2.4 + rand()*1.4, 1), M.stoneDark, Math.cos(a)*14, 1.2 + rand(), Math.sin(a)*14); b.rotation.set(rand()*3, rand()*3, rand()*3); g.add(b); }
    place(g, T.x, T.z); for(let k = 0; k < 9; k++){ const a = (k/9 - .5)*Math.PI*1.2 + Math.PI; circ(T.x + Math.cos(a)*14, T.z + Math.sin(a)*14, 2.6); } res(T.x, T.z, 22); }
  { const F = zone('fenrir'); spawns.push({ type: 'fenrir', x: F.x, z: F.z, wander: 8, passive: true, horde: 'fenrir', lord: true });
    for(let i = 0; i < 12; i++){ const a = i/12*6.28 + rand()*.3, d = 16 + rand()*60; const x = F.x + Math.cos(a)*d, z = F.z + Math.sin(a)*d; if(!inWild(x, z, 3)) continue; spawns.push({ type: i % 4 === 3 ? 'moon_alpha' : 'moonwolf', x, z, wander: 14, passive: true, horde: 'fenrir' }); }
    for(let i = 0; i < 5; i++){ const a = i/5*6.28; spawns.push({ type: 'moonwolf', x: F.x + Math.cos(a)*8, z: F.z + Math.sin(a)*8, wander: 4, passive: true, horde: 'fenrir', dormant: true }); }
    for(let i = 0; i < 7; i++){ const a = i/7*6.28; standingStone(F.x + Math.cos(a)*20, F.z + Math.sin(a)*20, 5 + (i % 2)*2, a + Math.PI/2); } res(F.x, F.z, 26);
    for(let k = 0; k < 40; k++){ const a = rand()*6.28, d = 6 + rand()*40; const x = F.x + Math.cos(a)*d, z = F.z + Math.sin(a)*d; rockSpots.push({ x, z, s: .3 + rand()*.5, r: rand()*6, sy: .5, v: k }); } }
  { const S = zone('slimes'); spawns.push({ type: 'slime_mother', x: S.x, z: S.z, wander: 4, passive: true, horde: 'slimes', lord: true });
    for(let i = 0; i < 14; i++){ const a = i/14*6.28 + rand()*.3, d = 14 + rand()*55; const x = S.x + Math.cos(a)*d, z = S.z + Math.sin(a)*d; if(!inWild(x, z, 3)) continue; spawns.push({ type: i % 3 === 0 ? 'slime_knight' : 'slime_royal', x, z, wander: 10, passive: true, horde: 'slimes' }); }
    for(let i = 0; i < 6; i++){ const a = i/6*6.28; spawns.push({ type: 'slime_royal', x: S.x + Math.cos(a)*11, z: S.z + Math.sin(a)*11, wander: 4, passive: true, horde: 'slimes', dormant: true }); }
    res(S.x, S.z, 18);
    paint(c => { const gr = c.createRadialGradient(S.x, S.z, 0, S.x, S.z, 70); gr.addColorStop(0, 'rgba(0,0,255,.75)'); gr.addColorStop(1, 'rgba(0,0,255,0)'); c.fillStyle = gr; c.fillRect(S.x - 70, S.z - 70, 140, 140); }); }

  // ---- Сфінкс: a riddling guardian on the road to the ruins ----
  { const Zr = zone('ruins'); let sx = Zr.x + 14, sz = Zr.z - 46; for(let k = 0; k < 30 && (roadDist(sx, sz) < 6 || !inWild(sx, sz, 4)); k++){ sx += 1.5; }
    const g = new THREE.Group(); const sm = M.sand || M.stone;
    g.add(boxM(3.2, .6, 6.4, M.stoneDark, 0, .3, 0)); const body = mesh(new THREE.CapsuleGeometry(1.0, 3.2, 6, 14), sm, 0, 1.5, -.4); body.rotation.x = Math.PI/2; body.scale.set(1.1, 1, .85); g.add(body);
    [-1, 1].forEach(sd => { g.add(boxM(.6, .5, 2.4, sm, sd*.75, .85, 2.1)); g.add(boxM(.7, 1.3, 1.2, sm, sd*.95, 1.15, -2.3)); });
    g.add(boxM(1.3, 1.6, 1.1, sm, 0, 2.5, 1.6)); const head = new THREE.Group(); head.position.set(0, 3.6, 1.8); g.add(head); head.add(mesh(new THREE.SphereGeometry(.62, 16, 12), sm, 0, 0, 0)); head.add(boxM(1.5, 1.2, .9, painted('#2a4a8a'), 0, .05, -.25)); for(let k = -2; k <= 2; k++) head.add(boxM(.08, 1.22, .92, painted('#d8b04a'), k*.28, .05, -.25));
    head.add(boxM(.5, .9, .5, sm, 0, -.6, .2)); g.add(mesh(new THREE.CylinderGeometry(.12, .12, 1.4, 6), sm, 0, 1.0, -3.6).rotateX(-.6));
    place(g, sx, sz, Math.PI); circ(sx, sz, 2.4); colliders.push({ type: 'rect', x: sx, z: sz, hw: 1.6, hd: 3.3, ang: Math.PI, wild: true, h: 4 }); res(sx, sz, 7);
    interactives.push({ id: 'sphinx', name: 'Сфінкс', action: 'sphinx', desc: '', door: { x: sx, z: sz - 4.6 }, group: g, labelY: Y(sx, sz) + 5.2, pos: new THREE.Vector3(sx, Y(sx, sz), sz) }); }

  // ---- signposts where the roads leave for the passes ----
  { const dest = ['СОНЦЕГРАД', 'ЛІСОВА ГАВАНЬ', 'ЗАЛІЗНИЙ КРЯЖ', 'ПУХНАСТІ ПАГОРБИ', '☠ КАМ\'ЯНІ ВИСІ', '☠ СИВИЙ СТЕП', '☠ ДРАГЛИСТІ ТОПІ'];
    PASSES.slice(0, 7).forEach(([a, b], i) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx/L, uz = dz/L; let x = a[0] - ux*6 - uz*6, z = a[1] - uz*6 + ux*6; if(!inWild(x, z, 1)){ x = a[0] - ux*6 + uz*6; z = a[1] - uz*6 - ux*6; }
      const g = new THREE.Group(); g.add(cylM(.09, .1, 3.0, 8, M.wood, 0, 1.5, 0)); const danger = dest[i].startsWith('☠');
      const st = canvasTexture(512, 128, (c, w, h) => { c.fillStyle = danger ? '#4a1a14' : '#3a2a1c'; c.fillRect(0, 0, w, h); c.fillStyle = danger ? '#ffb0a0' : '#f0d8a0'; c.font = 'bold 50px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('↑ ' + dest[i], w/2, h/2 + 3); });
      const bd = new THREE.Group(); bd.position.y = 2.5; bd.rotation.y = Math.atan2(-ux, -uz); g.add(bd); bd.add(boxM(2.3, .5, .07, M.beam, 0, 0, 0)); const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .45), new THREE.MeshStandardMaterial({ map: st, roughness: .9 })); pl.position.z = .04; pl.userData.keep = true; bd.add(pl); const pl2 = pl.clone(); pl2.position.z = -.04; pl2.rotation.y = Math.PI; bd.add(pl2);
      place(g, x, z); circ(x, z, .25); });
  }

  // ---------- forests, groves and rocks across the whole land ----------
  const keepOut = (x, z, m) => { if(!inWild(x, z, 3)) return true; if(roadDist(x, z) < 4.5 + (m || 0)) return true; for(const Zn of ZONES){ const k = Zn.calamity ? .18 : Zn.id === 'elves' ? .38 : Zn.id === 'beasts' ? .55 : Zn.id === 'dwarves' ? .6 : Zn.id === 'fishing' ? .9 : Zn.id === 'grove' || Zn.id === 'darkwood' || Zn.id === 'heath' || Zn.id === 'swamp' ? .45 : .9; if(Math.hypot(x - Zn.x, z - Zn.z) < Zn.r*k) return true; } if(Math.hypot(x - ENTRY.x, z - ENTRY.z) < 13) return true; for(const r of reserve){ if(Math.hypot(x - r[0], z - r[1]) < r[2]) return true; } return false; };
  const forestKind = (x, z) => { const dw = Math.hypot(x - zone('darkwood').x, z - zone('darkwood').z); if(dw < zone('darkwood').r*1.5) return 'dark';
    if(Math.hypot(x - SWAMP.x, z - SWAMP.z) < SWAMP.r*1.3) return 'swamp'; if(Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r*1.7) return 'lake';
    if(Math.hypot(x - zone('heath').x, z - zone('heath').z) < zone('heath').r*1.4) return 'heath';
    const near = id => { const Zn = zone(id); return Math.hypot(x - Zn.x, z - Zn.z) < Zn.r*1.25; };
    if(near('elves')) return 'elf'; if(near('fenrir')) return 'steppe'; if(near('titan')) return 'stone'; if(near('slimes')) return 'swamp'; if(near('dwarves')) return 'edge'; if(near('beasts')) return 'mixed';
    if(landDist(x, z) < 40) return 'edge'; return 'mixed'; };
  const TYPES = { dark: [3, 3, 3, 5, 0], swamp: ['dead', 6, 7, 'dead', 1], lake: [1, 1, 4, 6, 0], heath: [5, 3, 6, 7, 5], edge: [3, 3, 0, 5, 1], mixed: [0, 1, 0, 2, 4, 6, 7], elf: [1, 0, 1, 6, 0, 2], steppe: [5, 7, 6, 'dead'], stone: [5, 3, 'dead', 6] };
  const DENS = { dark: .62, swamp: .22, lake: .3, heath: .16, edge: .5, mixed: .2, elf: .55, steppe: .07, stone: .1 };
  { let n = 0;
    for(let k = 0; k < 60000 && n < 7200; k++){
      const x = (rand()*2 - 1)*560, z = (rand()*2 - 1)*560; if(keepOut(x, z)) continue; if(Math.hypot(x - CITY2.x, z - CITY2.z) < CITY2.R + 14) continue;
      const kind = forestKind(x, z); const f = fbm2(x*.018 + 11, z*.018 - 7, 3);
      if(f < 1 - DENS[kind] - .25 && !(kind === 'dark' && f > .25)) continue;
      const types = TYPES[kind], type = types[(rand()*types.length)|0];
      if(type === 'dead') deadTrees.push({ x, z, s: .8 + rand()*.4, r: rand()*6, type: 'dead' });
      else treeSpots.push({ x, z, s: type === 8 ? .9 + rand()*.4 : .8 + rand()*.5, r: rand()*6.28, type });
      if(type === 'dead' || type < 6) circ(x, z, .5);
      n++;
    }
    // grove trees close around the goblin huts
    const Zg = ZONES[1]; for(let i = 0; i < 40; i++){ const a = rand()*6.28, d = 12 + rand()*20; const x = Zg.x + Math.cos(a)*d, z = Zg.z + Math.sin(a)*d; if(!inWild(x, z, 4) || roadDist(x, z) < 4) continue; treeSpots.push({ x, z, s: .8 + rand()*.4, r: rand()*6, type: [0, 1, 3, 4, 5][i % 5] }); circ(x, z, .55); }
  }
  for(let i = 0; i < 1100; i++){ const x = (rand()*2 - 1)*560, z = (rand()*2 - 1)*560; if(keepOut(x, z, -2)) continue; if(Math.hypot(x - CITY2.x, z - CITY2.z) < CITY2.R + 10) continue; const kind = forestKind(x, z); if(kind === 'mixed' && rand() < .45) continue; if(kind === 'stone' && rand() < .3){ const s2 = 2 + rand()*4; rockSpots.push({ x, z, s: s2, r: rand()*6, sy: .6 + rand()*.5, v: i }); circ(x, z, s2*.45); continue; } const s = .6 + rand()*(kind === 'heath' || kind === 'edge' ? 2.6 : 1.6); rockSpots.push({ x, z, s, r: rand()*6, sy: .5 + rand()*.45, v: i }); if(s > .9) circ(x, z, s*.45); }
  // ground tints: dark forest floor (G), dry heath & swamp (B)
  paint(c => { const D = zone('darkwood'); const g = c.createRadialGradient(D.x, D.z, 0, D.x, D.z, D.r*1.6); g.addColorStop(0, 'rgba(0,255,0,.95)'); g.addColorStop(.7, 'rgba(0,180,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(D.x - D.r*2, D.z - D.r*2, D.r*4, D.r*4);
    [[SWAMP.x, SWAMP.z, SWAMP.r*1.25, .95], [zone('heath').x, zone('heath').z, zone('heath').r*1.4, .6]].forEach(([x, z, r, a]) => { const g2 = c.createRadialGradient(x, z, 0, x, z, r); g2.addColorStop(0, `rgba(0,0,255,${a})`); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g2; c.fillRect(x - r, z - r, r*2, r*2); }); });

  // ---------- lake & swamp water ----------
  { const wn = tex2('water_n.jpg', { repeat: 1 });
    const lakeM = new THREE.MeshStandardMaterial({ color: '#163038', roughness: .05, metalness: .1, normalMap: wn, normalScale: new THREE.Vector2(.35, .35), envMapIntensity: 1.6, transparent: true, opacity: .9 });
    const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r*1.45, 96), lakeM); lake.rotation.x = -Math.PI/2; lake.position.set(LAKE.x, LAKE.level, LAKE.z); lake.receiveShadow = true; lake.userData.keep = true; world.add(lake);
    const swM = new THREE.MeshStandardMaterial({ color: '#2a3020', roughness: .25, metalness: 0, normalMap: wn, normalScale: new THREE.Vector2(.18, .18), envMapIntensity: .8, transparent: true, opacity: .85 });
    const sw = new THREE.Mesh(new THREE.CircleGeometry(SWAMP.r*1.3, 64), swM); sw.rotation.x = -Math.PI/2; sw.position.set(SWAMP.x, SWAMP.level, SWAMP.z); sw.userData.keep = true; world.add(sw);
    anim.push(t => { wn.offset.set(t*.012, t*.008); });
    // reeds around the shores
    const reedM = new THREE.MeshStandardMaterial({ color: '#6a7a3a', roughness: .9 });
    for(let i = 0; i < 160; i++){ const useS = i % 3 === 0; const C2 = useS ? SWAMP : LAKE; const a = rand()*6.28, d = C2.r*(useS ? rand()*1.1 : .8 + rand()*.35); const x = C2.x + Math.cos(a)*d, z = C2.z + Math.sin(a)*d; const h0 = heightAt(x, z); if(h0 < C2.level - .5 || h0 > C2.level + .4) continue;
      const g = new THREE.Group(); g.position.set(x, h0, z); for(let k = 0; k < 6; k++){ const hh = .8 + rand()*.9; const r = mesh(new THREE.CylinderGeometry(.008, .014, hh, 4), reedM, (rand() - .5)*.6, hh/2, (rand() - .5)*.6); r.rotation.set((rand() - .5)*.3, 0, (rand() - .5)*.3); g.add(r); } world.add(g); }
  }

  function campfire(x, z, big){
    const g = new THREE.Group(); const k = big ? 1.3 : 1;
    for(let i = 0; i < 9; i++){ const a = i/9*6.28; const s = mesh(new THREE.DodecahedronGeometry(.16*k, 0), M.stoneDark, Math.cos(a)*.55*k, .08, Math.sin(a)*.55*k); s.scale.y = .7; g.add(s); }
    for(let i = 0; i < 4; i++){ const l = cylM(.06*k, .07*k, .8*k, 6, M.beam, 0, .2, 0); l.rotation.set(Math.PI/2 - .5, i*Math.PI/2, 0); g.add(l); }
    g.add(mesh(new THREE.CircleGeometry(.45*k, 12), M.dark, 0, .02, 0).rotateX(-Math.PI/2));
    place(g, x, z); circ(x, z, .8*k);
    fires.push({ parent: g, x: 0, y: .25, z: 0, s: .75*k, color: '#ff7a2a' });
    const L = nightLight('#ff8a3a', 9, 11, x, Y(x, z) + 1.2, z); L.userData.always = .55; L.userData.flicker = 1;
    anim.push(t => { L.userData.flicker = 1 + Math.sin(t*9 + x)*.18 + Math.sin(t*21)*.08; });
  }

  // gate interactive on the outside, so the way home is tappable
  return { treeSpots, rockSpots, spawns, deadTrees };
}

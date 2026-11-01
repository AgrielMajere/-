import * as THREE from 'three';
import { rng } from './util.js';
import { pbr, tex, boxM, cylM, mesh, uvBox, uvCyl, canvasTexture, softSprite, rot } from './assets.js';
import { mergeStatic } from './merge.js';
import { buildWild } from './wild.js';
import { buildDungeon, isDun } from './dungeon.js';
import { inWild, TOWN_R, WALL_R, GATES, ROADS, CITY2, ZONES as ZONES_ALL, heightAt } from './world.js';

export const R = TOWN_R;       // walkable town radius
export const PLAZA = 11;

// ---------- shared materials ----------

// ---------- shared materials ----------
export function materials(){
  if(materials.M) return materials.M;
  const brick = new THREE.MeshStandardMaterial({ map: tex('brick_diffuse.jpg', { srgb: true, repeat: .5 }), bumpMap: tex('brick_bump.jpg', { repeat: .5 }), bumpScale: 2, roughnessMap: tex('brick_roughness.jpg', { repeat: .5 }), roughness: 1, color: '#d8c8bc' });
  const planks = new THREE.MeshStandardMaterial({ map: tex('hardwood2_diffuse.jpg', { srgb: true, repeat: .6 }), bumpMap: tex('hardwood2_bump.jpg', { repeat: .6 }), bumpScale: 1.5, roughnessMap: tex('hardwood2_roughness.jpg', { repeat: .6 }), color: '#8a6a52', roughness: 1 });
  const M = materials.M = {
    stone: pbr('stonewall', { scale: 2.4 }),
    stoneDark: pbr('stonewall', { scale: 2.4, color: '#8d877d' }),
    cobble: pbr('cobble', { scale: 2.6 }),
    plaster: c => pbr('plaster', { scale: 3, color: c }),
    brick, planks,
    wood: pbr('wood', { scale: 1.6, color: '#7a6450' }),
    beam: pbr('wood', { scale: 1.6, color: '#4a3a2c' }),
    roof: pbr('rooftiles', { scale: 2.2, normal: 1.2 }),
    roofDark: pbr('rooftiles', { scale: 2.2, color: '#9a8a80' }),
    slate: pbr('slate', { scale: 2.0 }),
    iron: pbr('iron', { scale: 1, metalness: .85, roughness: 1, color: '#9a9a9a' }),
    marble: pbr('marble', { scale: 3 }),
    sand: pbr('sandstone', { scale: 3 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#b07a3a', metalness: 1, roughness: .32 }),
    gold: new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 1, roughness: .22 }),
    glass: new THREE.MeshStandardMaterial({ color: '#1a2026', roughness: .06, metalness: .2, emissive: '#ffaa55', emissiveIntensity: 0 }),
    lampGlass: new THREE.MeshStandardMaterial({ color: '#fff2d0', roughness: .2, emissive: '#ffb35c', emissiveIntensity: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0c0a08', roughness: 1 }),
    paint: {}
  };
  M.glass.userData.nightGlow = 2.2; M.lampGlass.userData.nightGlow = 6;
  return M;
}
export function painted(c){ const M = materials(); if(!M.paint[c]) M.paint[c] = pbr('wood', { scale: 1.2, color: c }); return M.paint[c]; }

function clothTex(c1, c2){
  return canvasTexture(256, 256, (g, w, h) => {
    for(let i = 0; i < 8; i++){ g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i*w/8, 0, w/8, h); }
    const im = g.getImageData(0, 0, w, h), d = im.data;
    for(let i = 0; i < d.length; i += 4){ const n = (Math.random() - .5)*18 + ((i/4/w|0) % 3 === 0 ? -6 : 0); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  });
}
function signTex(text, fg, bg){
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg || '#3a2a1c'; g.fillRect(0, 0, w, h);
    for(let i = 0; i < 40; i++){ g.strokeStyle = `rgba(0,0,0,${Math.random()*.25})`; g.beginPath(); const y = Math.random()*h; g.moveTo(0, y); g.bezierCurveTo(w*.3, y + 6, w*.6, y - 6, w, y); g.stroke(); }
    g.font = 'bold 64px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillText(text, w/2 + 3, h/2 + 4);
    g.fillStyle = fg || '#e8c27a'; g.fillText(text, w/2, h/2 + 2);
    g.strokeStyle = 'rgba(232,194,122,.6)'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  });
}

export function buildTown(opts){
  opts = opts || {};
  const M = materials();
  const rand = rng(11);
  const world = new THREE.Group();
  const colliders = [];      // {type:'circle',x,z,r} | {type:'rect',x,z,hw,hd,ang}
  const pickables = [];
  const interactives = [];   // {id,name,desc,door,group,pos}
  const anim = [];           // fn(t,dt)
  const lights = [];         // {light, base}  -> scaled by lampLevel at night
  const glows = [];          // sprites scaled by lampLevel
  const paths = [];          // {x0,z0,x1,z1,w} for the ground mask
  const fires = [];

  function nightLight(color, intensity, dist, x, y, z, parent){
    const l = new THREE.PointLight(color, 0, dist, 2); l.position.set(x, y, z); (parent || world).add(l); lights.push({ light: l, base: intensity }); return l;
  }
  function glowSprite(color, size, x, y, z, parent, alwaysOn){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.scale.set(size, size, 1); s.position.set(x, y, z); (parent || world).add(s); glows.push({ s, base: 1, always: alwaysOn ? alwaysOn : 0 }); return s;
  }
  function pathTo(x, z, w){
    const L = Math.hypot(x, z), ux = x/L, uz = z/L;
    paths.push({ x0: ux*(PLAZA - .6), z0: uz*(PLAZA - .6), x1: x, z1: z, w });
  }

  // ---------- houses ----------
  function windowAt(g, x, y, z, ry, o){
    o = o || {};
    const W = o.w || .9, H = o.h || 1.15;
    const wg = new THREE.Group(); wg.position.set(x, y, z); wg.rotation.y = ry; g.add(wg);
    wg.add(boxM(W, H, .06, M.glass, 0, 0, -.02));
    const fr = M.beam, t = .1;
    wg.add(boxM(W + t*2, t, .14, fr, 0, H/2 + t/2, 0), boxM(W + t*2, t, .14, fr, 0, -H/2 - t/2, 0), boxM(t, H, .14, fr, -W/2 - t/2, 0, 0), boxM(t, H, .14, fr, W/2 + t/2, 0, 0));
    wg.add(boxM(.05, H, .08, fr, 0, 0, .01), boxM(W, .05, .08, fr, 0, H*.12, .01));
    wg.add(boxM(W + .4, .09, .26, M.stone, 0, -H/2 - .15, .08));
    if(o.shutters !== false){
      const sc = painted(o.shutter || '#4a6a5a');
      [-1, 1].forEach(s => { const sh = new THREE.Group(); sh.position.set(s*(W/2 + t), 0, .06); sh.rotation.y = s*-1.95; wg.add(sh); const b = boxM(W/2 + .02, H + .08, .05, sc, s*(W/4 + .01), 0, 0); sh.add(b); sh.add(boxM(W/2 - .05, .05, .03, M.iron, s*(W/4), H*.3, .03), boxM(W/2 - .05, .05, .03, M.iron, s*(W/4), -H*.3, .03)); });
    }
    if(o.box){ // flower box
      wg.add(boxM(W + .1, .22, .25, M.wood, 0, -H/2 - .3, .2));
      const fc = ['#d8323a', '#f0c030', '#e86aa0', '#ffffff'];
      for(let i = 0; i < 7; i++){ const f = mesh(new THREE.IcosahedronGeometry(.07 + rand()*.04, 1), new THREE.MeshStandardMaterial({ color: fc[i % 4], roughness: .7 }), -W/2 + .1 + i*(W - .2)/6, -H/2 - .12, .2 + (rand() - .5)*.08); wg.add(f); }
      const bush = mesh(new THREE.IcosahedronGeometry(.25, 1), new THREE.MeshStandardMaterial({ color: '#3f6a2e', roughness: .9 }), 0, -H/2 - .2, .2); bush.scale.set(W*1.9, .5, .6); wg.add(bush);
    }
    return wg;
  }
  function lantern(g, x, y, z, ry, real){
    const lg = new THREE.Group(); lg.position.set(x, y, z); lg.rotation.y = ry; g.add(lg);
    lg.add(boxM(.05, .05, .45, M.iron, 0, .32, .2));
    lg.add(cylM(.02, .02, .2, 6, M.iron, 0, .22, .4));
    lg.add(cylM(.13, .11, .28, 6, M.lampGlass, 0, 0, .4));
    lg.add(cylM(.04, .17, .1, 6, M.iron, 0, .18, .4), cylM(.12, .12, .04, 6, M.iron, 0, -.15, .4));
    const sp = glowSprite('#ffc27a', 1.4, 0, 0, .4, lg);
    if(real) nightLight('#ffb35c', real, 9, 0, 0, .55, lg);
    return lg;
  }
  function gableRoof(g, w, d, yT, roofH, mat, over){
    over = over || .45;
    const ang = Math.atan2(roofH, w/2), half = w/2 + over, slope = half/Math.cos(ang) + .1;
    const L = d + .7;
    [-1, 1].forEach(s => {
      const ug = uvBox(new THREE.BoxGeometry(slope, .14, L));
      const uv = ug.attributes.uv; for(let i = 0; i < uv.count; i++){ const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, u); }
      const m = mesh(ug, mat);
      const cx = half/2 - .05;
      m.rotation.z = -s*ang;
      m.position.set(s*cx, yT + Math.tan(ang)*(w/2 - cx) + .08, 0);
      g.add(m);
    });
    const ridge = mesh(uvCyl(new THREE.CylinderGeometry(.13, .13, L + .05, 10), .13), M.roofDark, 0, yT + roofH + .08, 0); ridge.rotation.x = Math.PI/2; g.add(ridge);
    return { ang, L };
  }
  function gableWall(g, w, roofH, yT, z, mat, timber){
    const s = new THREE.Shape(); s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(0, roofH); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: .3, bevelEnabled: false }); geo.translate(0, 0, -.15);
    const m = mesh(uvBox(geo, 0, yT, 0), mat, 0, yT, z); g.add(m);
    if(timber){
      const zz = z + Math.sign(z)*.16;
      g.add(boxM(.16, roofH*.92, .08, M.beam, 0, yT + roofH*.46, zz));
      g.add(boxM(w*.62, .16, .08, M.beam, 0, yT + roofH*.42, zz));
      [-1, 1].forEach(sg => { const b = boxM(.14, Math.hypot(w/2, roofH)*.98, .08, M.beam, sg*w/4, yT + roofH/2, zz); b.rotation.z = sg*Math.atan2(w/2, roofH); g.add(b); });
    }
  }
  // ---------- buildings: house(o) at (x, z) with yaw (door faces local +z) ----------
  function house(o){
    const x = o.x, z = o.z, yaw = o.yaw;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw;
    const { w, d, h } = o;
    const wallMat = o.style === 'brick' ? M.brick : o.style === 'stone' ? M.stone : M.plaster(o.wall);
    const upperMat = M.plaster(o.wall);
    const roofMat = o.roofType === 'slate' ? M.slate : o.roofType === 'dark' ? M.roofDark : M.roof;
    const h1 = h*.52, h2 = h - h1, jet = .28, y0 = .55;
    g.add(boxM(w + .34, y0, d + .34, M.stoneDark, 0, y0/2, 0));
    g.add(boxM(w, h1, d, wallMat, 0, y0 + h1/2, 0));
    g.add(boxM(w + .2, .22, d + jet*2 + .1, M.beam, 0, y0 + h1 + .11, 0));
    for(let i = 0; i < Math.floor(w/.7); i++){ const xx = -w/2 + .35 + i*.7; [1, -1].forEach(s => g.add(boxM(.14, .14, .2, M.beam, xx, y0 + h1 - .02, s*(d/2 + .05)))); }
    const yU = y0 + h1 + .22;
    g.add(boxM(w, h2 - .22, d + jet*2, upperMat, 0, yU + (h2 - .22)/2, 0));
    const yT = y0 + h;
    [1, -1].forEach(s => {
      const zf = s*(d/2 + jet + .04), hh = h2 - .22;
      const nb = Math.max(2, Math.round(w/2.2));
      for(let k = 0; k <= nb; k++) g.add(boxM(.16, hh, .08, M.beam, -w/2 + .08 + k*(w - .16)/nb, yU + hh/2, zf));
      g.add(boxM(w, .15, .08, M.beam, 0, yT - .07, zf)); g.add(boxM(w, .12, .08, M.beam, 0, yU + .3, zf));
      for(let k = 0; k < nb; k++){ const cx = -w/2 + .08 + (k + .5)*(w - .16)/nb, sw = (w - .16)/nb; const L2 = Math.hypot(sw*.8, hh*.62); const b = boxM(.1, L2, .07, M.beam, cx, yU + hh*.38, zf); b.rotation.z = (k % 2 ? 1 : -1)*Math.atan2(sw*.8, hh*.62); g.add(b); }
    });
    [1, -1].forEach(s => { const xf = s*(w/2 + .04); [-1, 0, 1].forEach(k => g.add(boxM(.08, h2 - .22, .16, M.beam, xf, yU + (h2 - .22)/2, k*(d/2 + jet - .1)))); g.add(boxM(.08, .15, d + jet*2, M.beam, xf, yT - .07, 0)); });
    if(o.style !== 'brick' && o.style !== 'stone') [-1, 1].forEach(sx => [-1, 1].forEach(sz => g.add(boxM(.2, h1, .2, M.beam, sx*(w/2 - .02), y0 + h1/2, sz*(d/2 - .02)))));
    const roofH = o.roofH || 2.4;
    gableRoof(g, w, d + jet*2, yT, roofH, roofMat);
    gableWall(g, w, roofH, yT, d/2 + jet, upperMat, true); gableWall(g, w, roofH, yT, -(d/2 + jet), upperMat, true);
    const dz = d/2, dw = o.doubleDoor ? 2.0 : 1.12;
    g.add(boxM(dw + .4, 2.45 + (o.doubleDoor ? .4 : 0), .12, M.stone, 0, y0 + 1.2 + (o.doubleDoor ? .2 : 0), dz + .02));
    g.add(boxM(dw, 2.15 + (o.doubleDoor ? .4 : 0), .1, M.dark, 0, y0 + 1.07 + (o.doubleDoor ? .2 : 0), dz + .06));
    if(o.doubleDoor){ [-1, 1].forEach(s => { const dr = boxM(dw/2 - .04, 2.5, .08, o.doorMat || M.planks, s*dw/4, y0 + 1.25, dz + .1); g.add(dr); [.5, 1.9].forEach(yy => g.add(boxM(dw/2 - .14, .07, .03, M.iron, s*dw/4, y0 + yy, dz + .155))); }); }
    else { const door = boxM(1.06, 2.1, .08, o.doorMat || M.planks, 0, y0 + 1.05, dz + .1); g.add(door); [.5, 1.6].forEach(yy => g.add(boxM(.9, .07, .03, M.iron, -.05, y0 + yy, dz + .155))); g.add(mesh(new THREE.TorusGeometry(.07, .015, 6, 14), M.iron, .38, y0 + 1.05, dz + .17)); }
    g.add(boxM(dw + .8, .18, .9, M.stone, 0, .09, dz + .55)); g.add(boxM(dw + .4, .16, .5, M.stone, 0, .27, dz + .4));
    const sh = o.shutter || '#4a6a5a';
    const wy1 = y0 + h1*.55, wy2 = yU + (h2 - .22)*.52;
    const nwin = Math.max(1, Math.floor((w - 2.2)/2.4));
    for(let k = 0; k < nwin; k++){ const off = (k + 1)*(w/2 - .6)/(nwin + .5); [-1, 1].forEach(s => { if(w > 4.5) windowAt(g, s*(off + .45), wy1, dz + .06, 0, { shutter: sh, box: o.flowers && k === 0 }); }); }
    [-1, 1].forEach(s => windowAt(g, s*(w/4 + .15), wy2, d/2 + jet + .06, 0, { shutter: sh, w: .75, h: .95, box: s > 0 && o.flowers }));
    [-1, 1].forEach(s => windowAt(g, -s*(w/4 + .15), wy2, -(d/2 + jet + .06), Math.PI, { shutter: sh, w: .75, h: .95 }));
    [-1, 1].forEach(s => { windowAt(g, s*(w/2 + .04), wy1, 0, s*Math.PI/2, { shutter: sh }); windowAt(g, s*(w/2 + .04), wy2, 0, s*Math.PI/2, { shutter: sh, w: .75, h: .95 }); });
    windowAt(g, 0, yT + roofH*.35, d/2 + jet + .17, 0, { w: .5, h: .6, shutters: false });
    if(o.chimney){ g.add(boxM(.75, roofH + 1.6, .75, M.stone, w/2 - 1.0, yT + roofH*.5 + .3, -d/4)); g.add(boxM(.95, .14, .95, M.stoneDark, w/2 - 1.0, yT + roofH + 1.15, -d/4)); }
    lantern(g, dw/2 + .45, y0 + 2.0, dz + .02, 0, o.light ? 5 : 0);
    if(o.sign){
      const sgG = new THREE.Group(); sgG.position.set(-w/2 + .2, y0 + h1 + .5, dz + .1); g.add(sgG);
      sgG.add(boxM(.06, .06, 1.25, M.iron, 0, 0, .6)); sgG.add(rot(boxM(.04, .5, .04, M.iron, 0, -.22, .25), 'x', .8));
      const board = new THREE.Group(); board.userData.keepGroup = true; board.position.set(0, -.08, 1.05); sgG.add(board);
      const st = signTex(o.sign, o.signFg, o.signBg); const bm = new THREE.MeshStandardMaterial({ map: st, roughness: .8 });
      board.add(boxM(.06, .55, 1.05, M.beam, 0, -.36, 0));
      [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .5), bm); p.position.set(s*.035, -.36, 0); p.rotation.y = s*Math.PI/2; p.castShadow = true; p.userData.keep = true; board.add(p); });
      [-.4, .4].forEach(zz => board.add(boxM(.02, .12, .02, M.iron, 0, -.04, zz)));
      anim.push(t => { board.rotation.x = Math.sin(t*1.3 + x)*.05; });
    }
    if(o.awning){
      const ct = clothTex(o.awning[0], o.awning[1]);
      const geo = new THREE.PlaneGeometry(w - .6, 1.6, 16, 6); const p = geo.attributes.position;
      for(let i = 0; i < p.count; i++){ const yy = p.getY(i); p.setZ(i, Math.sin((yy/1.6 + .5)*Math.PI)*.06); }
      geo.computeVertexNormals();
      const aw = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ct, side: THREE.DoubleSide, roughness: .9 })); aw.castShadow = true; aw.receiveShadow = true; aw.userData.keep = true;
      aw.rotation.x = -Math.PI/2 + .42; aw.position.set(0, y0 + h1 - .15, dz + .75); g.add(aw);
      const val = new THREE.Mesh(new THREE.PlaneGeometry(w - .6, .25), new THREE.MeshStandardMaterial({ map: ct, side: THREE.DoubleSide, roughness: .9 })); val.position.set(0, y0 + h1 - .62, dz + 1.48); val.castShadow = true; val.userData.keep = true; g.add(val);
      [-1, 1].forEach(s => { g.add(rot(cylM(.04, .04, 1.0, 6, M.iron, s*(w/2 - .35), y0 + h1 - .55, dz + .8), 'x', 1.1)); });
    }
    world.add(g);
    colliders.push({ type: 'rect', x, z, hw: w/2 + .35, hd: d/2 + jet + .2, ang: yaw, h: y0 + h + roofH*.7 });
    const ux = Math.sin(yaw), uz = Math.cos(yaw);
    const doorPt = new THREE.Vector3(x + ux*(d/2 + 2.1), 0, z + uz*(d/2 + 2.1));
    const B = { g, x, z, yaw, ux, uz, h: yT, roofH, w, d, door: doorPt };
    if(o.id){ B.info = { id: o.id, name: o.name, desc: o.desc || '', door: doorPt, group: g, labelY: yT + roofH + .9 + (o.labelUp || 0), pos: new THREE.Vector3(x, 0, z) }; interactives.push(B.info); }
    paths.push({ x0: x + ux*(d/2 + .4), z0: z + uz*(d/2 + .4), x1: x + ux*(d/2 + 3.2), z1: z + uz*(d/2 + 3.2), w: 2.2 });
    return B;
  }
  const at = (a, r) => [Math.cos(a)*r, Math.sin(a)*r];
  const faceC = (x, z) => Math.atan2(-x, -z);   // yaw that faces the plaza
  const deg = Math.PI/180;
  // local -> world helper for a building
  const W = (b, lx, lz) => [b.x + lx*Math.cos(b.yaw) + lz*Math.sin(b.yaw), b.z - lx*Math.sin(b.yaw) + lz*Math.cos(b.yaw)];

  // ---------- streets (cobble): plaza, four gate roads, a ring street ----------
  const cob = []; // {x0,z0,x1,z1,w} painted green
  GATES.forEach(G => cob.push({ x0: G.cx*PLAZA*.8, z0: G.sz*PLAZA*.8, x1: G.cx*(WALL_R + 3), z1: G.sz*(WALL_R + 3), w: 5.6 }));
  const RING = 34;
  for(let i = 0; i < 48; i++){ const a0 = i/48*Math.PI*2, a1 = (i + 1)/48*Math.PI*2; cob.push({ x0: Math.cos(a0)*RING, z0: Math.sin(a0)*RING, x1: Math.cos(a1)*RING, z1: Math.sin(a1)*RING, w: 4.2 }); }
  const onStreet = (x, z, m) => { m = m || 0; if(Math.hypot(x, z) < PLAZA + 1.5 + m) return true; if(Math.abs(Math.hypot(x, z) - RING) < 2.3 + m) return true; for(const G of GATES){ const al = x*G.cx + z*G.sz, pe = Math.abs(-x*G.sz + z*G.cx); if(al > 0 && pe < 3.0 + m) return true; } return false; };

  // ---------- key buildings around the plaza ----------
  const B = {};
  { const [x, z] = at(225*deg, 21.5); B.guild = house({ id: 'guild', name: 'Гільдія авантюристів', x, z, yaw: faceC(x, z), w: 12, d: 8.5, h: 7.6, wall: '#e2dccd', roofType: 'slate', roofH: 4.2, chimney: true, sign: 'ГІЛЬДІЯ', style: 'stone', shutter: '#2f4a6a', light: true, flowers: true, doubleDoor: true, labelUp: 1.4 });
    const b = B.guild;
    // corner tower with a conical roof
    const tw = new THREE.Group(); tw.position.set(b.w/2 + .6, 0, b.d/2 - .4); b.g.add(tw);
    const tg = new THREE.CylinderGeometry(2.0, 2.15, 11.5, 20, 1); tw.add(mesh(uvCyl(tg, 2.1), M.stone, 0, 5.75, 0));
    tw.add(mesh(uvCyl(new THREE.CylinderGeometry(2.35, 2.35, .4, 20), 2.35), M.stoneDark, 0, 11.6, 0));
    const cone = mesh(new THREE.ConeGeometry(2.7, 5.2, 20), M.slate, 0, 14.4, 0); tw.add(cone);
    tw.add(cylM(.05, .05, 2.2, 6, M.iron, 0, 17.6, 0));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .8, 6, 2), new THREE.MeshStandardMaterial({ color: '#7a1a1a', side: THREE.DoubleSide, roughness: .9 })); flag.position.set(.72, 18.2, 0); flag.userData.keep = true; tw.add(flag);
    const fp = flag.geometry.attributes.position, f0 = fp.array.slice(); anim.push(t => { for(let i = 0; i < fp.count; i++){ const xx = f0[i*3]; fp.setZ(i, Math.sin(t*4 + xx*4)*.12*(xx + .7)); } fp.needsUpdate = true; });
    for(let k = 0; k < 3; k++) windowAt(tw, 0, 3.2 + k*3, 2.08, 0, { w: .5, h: .9, shutters: false });
    // guild banners beside the door
    const emb = canvasTexture(256, 512, (c, w2, h2) => { c.fillStyle = '#7a1a1a'; c.fillRect(0, 0, w2, h2); c.fillStyle = '#d9a24a'; c.fillRect(0, 0, w2, 18); c.fillRect(0, h2 - 60, w2, 10);
      c.save(); c.translate(w2/2, 210); c.fillStyle = '#e8d8b0'; c.beginPath(); c.moveTo(-70, -80); c.lineTo(70, -80); c.lineTo(70, 10); c.quadraticCurveTo(60, 80, 0, 110); c.quadraticCurveTo(-60, 80, -70, 10); c.closePath(); c.fill();
      c.strokeStyle = '#3a1a10'; c.lineWidth = 12; [-1, 1].forEach(s => { c.beginPath(); c.moveTo(-50*s, -55); c.lineTo(50*s, 75); c.stroke(); }); c.restore();
      c.fillStyle = '#d9a24a'; for(let i = 0; i < 5; i++){ c.beginPath(); c.moveTo(i*w2/5, h2 - 50); c.lineTo((i + .5)*w2/5, h2); c.lineTo((i + 1)*w2/5, h2 - 50); c.fill(); } });
    [-1, 1].forEach(s => { const bn = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.6), new THREE.MeshStandardMaterial({ map: emb, roughness: .9, side: THREE.DoubleSide })); bn.position.set(s*2.3, 4.0, b.d/2 + .32); bn.userData.keep = true; bn.castShadow = true; b.g.add(bn); b.g.add(boxM(1.3, .08, .08, M.iron, s*2.3, 5.33, b.d/2 + .3)); });
    // steps & stone lions-like plinths
    b.g.add(boxM(4.2, .3, 1.6, M.stone, 0, .15, b.d/2 + 1.6));
    [-1, 1].forEach(s => { b.g.add(boxM(.9, 1.1, .9, M.stone, s*2.6, .55, b.d/2 + 2.2)); b.g.add(cylM(.32, .38, .5, 12, M.iron, s*2.6, 1.35, b.d/2 + 2.2)); fires.push({ parent: b.g, x: s*2.6, y: 1.6, z: b.d/2 + 2.2, s: .55, color: '#ff8a3a' }); nightLight('#ff9a4a', 6, 9, s*2.6, 2.2, b.d/2 + 2.5, b.g); });
    { const [tx, tz] = W(b, b.w/2 + .6, b.d/2 - .4); colliders.push({ type: 'circle', x: tx, z: tz, r: 2.3, h: 16 }); }
    [-1, 1].forEach(s => { const [px, pz] = W(b, s*2.6, b.d/2 + 2.2); colliders.push({ type: 'circle', x: px, z: pz, r: .65 }); });
    B.guild.info.door.set(...(() => { const [dx, dz] = W(b, 0, b.d/2 + 3.4); return [dx, 0, dz]; })());
  }
  { const [x, z] = at(315*deg, 21.5); B.temple = house({ id: 'temple', name: 'Храм Світла', x, z, yaw: faceC(x, z), w: 9, d: 11, h: 7.0, wall: '#f0ebe0', roofType: 'slate', roofH: 4.6, style: 'stone', shutter: '#6a5a3a', doubleDoor: true, labelUp: 4 });
    const b = B.temple;
    // bell tower over the entrance
    const bt = new THREE.Group(); bt.position.set(0, 0, b.d/2 - 1.2); b.g.add(bt);
    bt.add(boxM(3.0, 13, 3.0, M.stone, 0, 6.5, 0)); bt.add(boxM(3.4, .35, 3.4, M.stoneDark, 0, 13.1, 0));
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([sx, sz]) => { const ar = boxM(1.4, 2.0, .2, M.dark, sx*1.42, 11.6, sz*1.42); if(sx) ar.rotation.y = Math.PI/2; bt.add(ar); });
    bt.add(mesh(new THREE.ConeGeometry(2.6, 5.5, 4), M.slate, 0, 16.0, 0).rotateY(Math.PI/4));
    const bell = mesh(new THREE.CylinderGeometry(.35, .6, .8, 16, 1, true), M.bronze, 0, 11.7, 0); bell.material = M.bronze; bt.add(bell);
    bt.add(boxM(.1, 1.4, .1, M.gold, 0, 19.4, 0)); bt.add(boxM(.8, .1, .1, M.gold, 0, 19.6, 0));
    // rose window
    const rose = canvasTexture(256, 256, (c, w2, h2) => { c.translate(w2/2, h2/2); const cols = ['#c0392b', '#2e5aa8', '#e6b422', '#3a8a4a']; for(let i = 0; i < 12; i++){ c.fillStyle = cols[i % 4]; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 120, i/12*Math.PI*2, (i + 1)/12*Math.PI*2); c.fill(); } c.strokeStyle = '#2a2018'; c.lineWidth = 8; for(let i = 0; i < 12; i++){ c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i/12*Math.PI*2)*124, Math.sin(i/12*Math.PI*2)*124); c.stroke(); } [40, 80, 122].forEach(r => { c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); }); });
    const rm = new THREE.MeshStandardMaterial({ map: rose, emissive: '#ffffff', emissiveMap: rose, emissiveIntensity: .25, roughness: .3 });
    const rw = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32), rm); rw.position.set(0, 9.4, b.d/2 + .34); rw.userData.keep = true; b.g.add(rw);
    b.roseMat = rm;
    { const [tx, tz] = W(b, 0, b.d/2 - 1.2); colliders.push({ type: 'rect', x: tx, z: tz, hw: 1.6, hd: 1.6, ang: b.yaw, h: 18 }); }
  }
  { const [x, z] = at(135*deg, 21.5); B.tavern = house({ id: 'tavern', name: 'Таверна «Лимонний Дракон»', x, z, yaw: faceC(x, z), w: 10, d: 7.5, h: 6.4, wall: '#e0c9a6', roofH: 3.4, chimney: true, sign: 'ТАВЕРНА', style: 'brick', shutter: '#5a4a2a', light: true }); }
  { const [x, z] = at(45*deg, 21.5); B.shop = house({ id: 'shop', name: 'Крамниця Ореста', x, z, yaw: faceC(x, z), w: 8, d: 6.5, h: 5.6, wall: '#e6d6b4', roofH: 3.0, sign: 'КРАМНИЦЯ', awning: ['#a8322c', '#e9dcc0'], shutter: '#7a3a2a', flowers: true, light: true }); }
  { const x = 31, z = -12; B.forge = house({ id: 'forge', name: 'Кузня Назара', x, z, yaw: 0, w: 8, d: 6, h: 5.0, wall: '#cfc6b8', roofType: 'slate', roofH: 2.6, chimney: true, sign: 'КУЗНЯ', style: 'stone', shutter: '#3a3a3a' }); }
  { const x = -31, z = 12; B.wardrobe = house({ id: 'wardrobe', name: 'Ательє Миросі', x, z, yaw: Math.PI, w: 7, d: 5.5, h: 5.0, wall: '#ead2c8', roofH: 2.7, sign: 'АТЕЛЬЄ', awning: ['#6a3a62', '#efe2d8'], shutter: '#7a5a8a', flowers: true }); }

  // ---------- town wall with towers & four gatehouses ----------
  { const WH = 6.2, WT = 2.4;
    const gateGap = 5.2/WALL_R;
    const seg = 96;
    for(let i = 0; i < seg; i++){
      const a0 = i/seg*Math.PI*2, a1 = (i + 1)/seg*Math.PI*2, am = (a0 + a1)/2;
      if(GATES.some(G => Math.abs(Math.atan2(Math.sin(am - G.a), Math.cos(am - G.a))) < gateGap)) continue;
      const L = 2*WALL_R*Math.sin((a1 - a0)/2) + .08, [x, z] = at(am, WALL_R);
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -am + Math.PI/2;
      g.add(boxM(L, WH, WT, M.stone, 0, WH/2 - .6, 0)); g.add(boxM(L, .3, WT + .3, M.stoneDark, 0, WH - .45, 0));
      g.add(boxM(L*.42, .9, .5, M.stone, -L*.25, WH + .15, -WT/2 + .25)); g.add(boxM(L*.42, .9, .5, M.stone, -L*.25, WH + .15, WT/2 - .25));
      world.add(g);
    }
    for(let k = 0; k < 8; k++){ const a = (k + .5)/8*Math.PI*2; const [x, z] = at(a, WALL_R); const t = new THREE.Group(); t.position.set(x, 0, z);
      t.add(mesh(uvCyl(new THREE.CylinderGeometry(2.6, 2.9, 9.5, 18), 2.8), M.stone, 0, 4.15, 0)); t.add(mesh(uvCyl(new THREE.CylinderGeometry(3.0, 3.0, .4, 18), 3), M.stoneDark, 0, 9.0, 0));
      for(let m2 = 0; m2 < 8; m2++){ const b2 = m2/8*Math.PI*2; t.add(boxM(.8, .9, .5, M.stone, Math.cos(b2)*2.7, 9.6, Math.sin(b2)*2.7).rotateY(-b2)); }
      t.add(mesh(new THREE.ConeGeometry(3.2, 4.2, 18), M.roofDark, 0, 12.0, 0)); world.add(t); colliders.push({ type: 'circle', x, z, r: 3.0, h: 13 }); }
    GATES.forEach(G => {
      const [x, z] = at(G.a, WALL_R); const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -G.a + Math.PI/2;
      [-1, 1].forEach(s => { g.add(boxM(2.6, 9.0, 3.4, M.stone, s*3.9, 3.9, 0)); g.add(boxM(3.0, .35, 3.8, M.stoneDark, s*3.9, 8.55, 0)); for(let q = 0; q < 4; q++) g.add(boxM(.6, .7, .6, M.stone, s*3.9 + (q % 2 ? .95 : -.95), 9.05, q < 2 ? 1.35 : -1.35));
        const tg = new THREE.Group(); tg.position.set(s*2.5, 4.4, 1.85); g.add(tg); tg.add(rot(cylM(.05, .04, .7, 6, M.wood, 0, 0, .15), 'x', .5)); tg.add(cylM(.1, .07, .18, 8, M.iron, 0, .3, .32)); fires.push({ parent: tg, x: 0, y: .48, z: .32, s: .5, color: '#ff8a3a' });
        nightLight('#ff8a3a', 8, 11, s*2.5, 4.9, 2.6, g); });
      const arch = new THREE.Shape(); arch.moveTo(-2.6, 0); arch.lineTo(-2.6, 4.4); arch.absarc(0, 4.4, 2.6, Math.PI, 0, true); arch.lineTo(2.6, 0); arch.lineTo(2.7, 0); arch.lineTo(2.7, 7.4); arch.lineTo(-2.7, 7.4); arch.lineTo(-2.7, 0); arch.closePath();
      const ag = new THREE.ExtrudeGeometry(arch, { depth: 3.0, bevelEnabled: false, curveSegments: 16 }); ag.translate(0, 0, -1.5); g.add(mesh(uvBox(ag), M.stone));
      const pc = new THREE.Group(); pc.position.set(0, 5.6, .9); g.add(pc); for(let i = -5; i <= 5; i++) pc.add(boxM(.08, 2.2, .08, M.iron, i*.47, 1.0, 0)); for(let j = 0; j < 3; j++) pc.add(boxM(4.9, .07, .07, M.iron, 0, .1 + j*.8, .04));
      [-1, 1].forEach(s => { const dr = new THREE.Group(); dr.position.set(s*2.55, 0, -1.4); dr.rotation.y = s*1.25; g.add(dr); dr.add(boxM(2.5, 5.2, .16, M.planks, -s*1.25, 2.6, 0)); [1.0, 2.6, 4.2].forEach(yy => dr.add(boxM(2.4, .12, .05, M.iron, -s*1.25, yy, .1))); });
      // coat of arms
      const ca = new THREE.Mesh(new THREE.CircleGeometry(.7, 24), new THREE.MeshStandardMaterial({ color: '#7a1a1a', roughness: .6 })); ca.position.set(0, 6.4, 1.52); ca.userData.keep = true; g.add(ca);
      world.add(g);
      [-1, 1].forEach(s => { const [cx, cz] = [x + (-Math.sin(G.a))*s*3.9*(-1), z + Math.cos(G.a)*s*3.9*(-1)]; colliders.push({ type: 'rect', x: x - G.sz*s*3.9, z: z + G.cx*s*3.9, hw: 1.5, hd: 1.9, ang: -G.a + Math.PI/2, h: 9 }); void cx; void cz; });
      if(G.id === 'S'){ const info = { id: 'arena', name: 'Брама Випробувань', desc: '', door: new THREE.Vector3(G.cx*(TOWN_R - 6), 0, G.sz*(TOWN_R - 6)), group: g, labelY: 10.5, pos: new THREE.Vector3(x, 0, z) }; interactives.push(info); }
    });
  }

  // ---------- fountain ----------
  // ---------- fountain ----------
  {
    const f = new THREE.Group();
    const prof = (pts) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 48);
    const basin = prof([[0, 0], [3.4, 0], [3.55, .08], [3.55, .62], [3.4, .72], [3.15, .72], [3.05, .55], [0, .5]]);
    const bm = mesh(basin, M.stone); uvCylLathe(basin); f.add(bm);
    const col = prof([[0, 0], [.75, 0], [.6, .2], [.42, .4], [.36, 1.4], [.5, 1.6], [0, 1.65]]); uvCylLathe(col); f.add(mesh(col, M.stone, 0, .5, 0));
    const bowl = prof([[0, 0], [.3, 0], [1.2, .15], [1.62, .35], [1.66, .52], [1.5, .55], [1.4, .42], [0, .3]]); uvCylLathe(bowl); f.add(mesh(bowl, M.stone, 0, 2.1, 0));
    const top = prof([[0, 0], [.22, 0], [.16, .3], [.12, .9], [.22, 1.0], [.1, 1.12], [0, 1.15]]); uvCylLathe(top); f.add(mesh(top, M.stone, 0, 2.55, 0));
    // water
    const wn = tex('water_n.jpg', { repeat: 1 }); const wn2 = tex('water_n.jpg', { repeat: .7 });
    const water = new THREE.MeshStandardMaterial({ color: '#0d1d22', roughness: .14, metalness: .1, normalMap: wn, normalScale: new THREE.Vector2(.22, .22), envMapIntensity: 1.6, transparent: true, opacity: .96 });
    const w1 = new THREE.Mesh(new THREE.CircleGeometry(3.12, 48), water); w1.rotation.x = -Math.PI/2; w1.position.y = .6; w1.receiveShadow = true; w1.userData.keep = true; f.add(w1);
    const w2 = new THREE.Mesh(new THREE.CircleGeometry(1.45, 32), water); w2.rotation.x = -Math.PI/2; w2.position.y = 2.6; w2.userData.keep = true; f.add(w2);
    anim.push((t) => { wn.offset.set(t*.03, t*.021); });
    world.add(f);
    colliders.push({ type: 'circle', x: 0, z: 0, r: 3.75 });
    // spray: main jet + falling streams from bowl lip
    const N = 420, pos = new Float32Array(N*3), vel = [];
    for(let i = 0; i < N; i++) vel.push({ k: i < 140 ? 0 : 1, a: rand()*Math.PI*2, s: .3 + rand()*.6, t: rand()*2 });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: softSprite(), color: '#dff2ff', size: .14, transparent: true, opacity: .55, depthWrite: false }));
    pts.frustumCulled = false; world.add(pts);
    anim.push((t, dt) => {
      for(let i = 0; i < N; i++){
        const v = vel[i]; v.t += dt; let x, y, z;
        if(v.k === 0){ if(v.t > 1.1){ v.t = 0; v.a = rand()*Math.PI*2; v.s = .15 + rand()*.35; } const tt = v.t; const r = v.s*tt; x = Math.cos(v.a)*r; z = Math.sin(v.a)*r; y = 3.7 + 3.2*tt - 4.9*tt*tt; if(y < 2.6){ y = 2.6; } }
        else { if(v.t > .7){ v.t = 0; v.a = rand()*Math.PI*2; } const tt = v.t; const r = 1.64 + tt*.45; x = Math.cos(v.a)*r; z = Math.sin(v.a)*r; y = 2.62 - 4.9*tt*tt; if(y < .6) y = .6; }
        pos[i*3] = x; pos[i*3 + 1] = y; pos[i*3 + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
    });
    nightLight('#9fd8ff', 6, 10, 0, 1.2, 0);
  }

  // ---------- benches & street lamps ----------
  function bench(x, z, yaw){
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw;
    for(let i = 0; i < 3; i++) g.add(boxM(1.9, .05, .14, M.wood, 0, .46, -.17 + i*.17));
    for(let i = 0; i < 3; i++) g.add(rot(boxM(1.9, .1, .04, M.wood, 0, .65 + i*.13, -.3), 'x', -.1));
    [-.78, .78].forEach(s => { g.add(boxM(.05, .46, .5, M.iron, s, .23, -.05)); g.add(boxM(.05, .5, .05, M.iron, s, .7, -.29)); });
    world.add(g); colliders.push({ type: 'rect', x, z, hw: 1.0, hd: .4, ang: yaw });
  }
  for(let i = 0; i < 8; i++){ const a = (i*45 + 22.5)*deg; const [x, z] = at(a, 8.3); bench(x, z, faceC(x, z)); }
  function lamp(x, z, real){
    const g = new THREE.Group(); g.position.set(x, 0, z);
    g.add(cylM(.18, .22, .3, 8, M.stoneDark, 0, .15, 0)); g.add(cylM(.06, .08, 3.2, 8, M.iron, 0, 1.9, 0));
    g.add(cylM(.1, .1, .12, 8, M.iron, 0, .4, 0), cylM(.09, .09, .1, 8, M.iron, 0, 3.45, 0));
    g.add(cylM(.17, .13, .4, 6, M.lampGlass, 0, 3.72, 0)); g.add(cylM(.05, .25, .18, 6, M.iron, 0, 4.0, 0), cylM(.02, .02, .2, 6, M.iron, 0, 4.18, 0));
    for(let k = 0; k < 6; k++){ const ang = k/6*Math.PI*2; g.add(boxM(.02, .42, .02, M.iron, Math.cos(ang)*.16, 3.72, Math.sin(ang)*.16)); }
    glowSprite('#ffc27a', 2.2, 0, 3.72, 0, g); if(real) nightLight('#ffb35c', 10, 14, 0, 3.6, 0, g);
    world.add(g); colliders.push({ type: 'circle', x, z, r: .3 });
  }
  for(let i = 0; i < 12; i++){ const [x, z] = at((i*30 + 15)*deg, PLAZA + 1.2); lamp(x, z, i % 3 === 1); }
  GATES.forEach(G => { for(let r2 = 18; r2 < TOWN_R - 4; r2 += 11){ [-1, 1].forEach((s, si) => lamp(G.cx*r2 - G.sz*s*3.4, G.sz*r2 + G.cx*s*3.4, si === 0 && r2 > 30)); } });

  // ---------- market on the south street ----------
  const stall = (x, z, yaw, c1, c2, goods) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw;
    [[-1.1, -.75], [1.1, -.75], [-1.1, .75], [1.1, .75]].forEach(([a, b]) => g.add(boxM(.1, 2.5, .1, M.wood, a, 1.25, b)));
    const ct = clothTex(c1, c2);
    const geo = new THREE.PlaneGeometry(2.7, 2.1, 10, 6); const p = geo.attributes.position; for(let i = 0; i < p.count; i++) p.setZ(i, -Math.sin((p.getX(i)/2.7 + .5)*Math.PI)*.12); geo.computeVertexNormals();
    const roof = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ct, side: THREE.DoubleSide, roughness: .9 })); roof.rotation.x = -Math.PI/2 + .14; roof.position.y = 2.5; roof.castShadow = true; roof.userData.keep = true; g.add(roof);
    g.add(boxM(2.2, .08, 1.0, M.wood, 0, .9, -.05)); g.add(boxM(2.2, .85, .06, M.planks, 0, .45, .44)); g.add(boxM(.06, .85, 1.0, M.planks, -1.08, .45, -.05)); g.add(boxM(.06, .85, 1.0, M.planks, 1.08, .45, -.05));
    for(let i = 0; i < 40; i++){ const f = goods[i % goods.length]; const s = mesh(new THREE.IcosahedronGeometry(f[1], 1), new THREE.MeshStandardMaterial({ color: f[0], roughness: .5 }), -.95 + (i % 12)*.17 + rand()*.04, .98 + (i/12|0)*.05, -.35 + ((i/12|0) % 4)*.18); g.add(s); }
    [-.6, .6].forEach(xx => g.add(boxM(.6, .3, .45, M.planks, xx, .2, -.9)));
    world.add(g); colliders.push({ type: 'rect', x, z, hw: 1.3, hd: 1.0, ang: yaw });
  };
  const fruit = [['#b8241c', .07], ['#e0a020', .075], ['#6a9a2a', .065], ['#d86a1a', .12]], fish = [['#9aa8b0', .09], ['#c8d0d8', .07]], bread = [['#c8964a', .1], ['#a8743a', .08]], cloth = [['#3a5a8a', .1], ['#8a2a3a', .1], ['#d8c8a0', .1]];
  [[6.2, 17, fruit, '#2f6a8a', '#e8dcc0'], [-6.2, 17, bread, '#8a5a2a', '#efe0c0'], [6.2, 24, fish, '#2a6a4a', '#e0e8d8'], [-6.2, 24, cloth, '#6a2a5a', '#f0e0e8']].forEach(([x, z, gd, c1, c2]) => stall(x, z, x > 0 ? -Math.PI/2 : Math.PI/2, c1, c2, gd));

  // ---------- smithy yard ----------
  { const b = B.forge;
    const sh = new THREE.Group(); const [sx, sz] = W(b, 0, b.d/2 + 2.6); sh.position.set(sx, 0, sz); sh.rotation.y = b.yaw; world.add(sh);
    [[-3, -1.4], [3, -1.4], [-3, 1.6], [3, 1.6]].forEach(([a, c]) => sh.add(boxM(.22, 3.0, .22, M.beam, a, 1.5, c)));
    sh.add(rot(boxM(6.8, .14, 3.9, M.slate, 0, 3.1, .1), 'x', -.18));
    // anvil
    const an = new THREE.Shape(); an.moveTo(-.45, 0); an.lineTo(.3, 0); an.quadraticCurveTo(.6, .02, .7, .12); an.lineTo(.3, .16); an.lineTo(-.45, .16); an.closePath();
    const ag = new THREE.ExtrudeGeometry(an, { depth: .22, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 2 }); ag.translate(0, 0, -.11);
    sh.add(cylM(.3, .38, .55, 10, M.wood, -1.2, .27, .6)); sh.add(mesh(uvBox(ag), M.iron, -1.2, .72, .6)); sh.add(boxM(.3, .17, .16, M.iron, -1.25, .62, .6));
    // hearth
    sh.add(boxM(1.6, 1.0, 1.2, M.stone, 1.6, .5, -.6)); sh.add(boxM(1.2, .1, .8, M.dark, 1.6, 1.01, -.6));
    fires.push({ parent: sh, x: 1.6, y: 1.1, z: -.6, s: .75, color: '#ff6a2a', coals: true });
    const [fx, fz] = W(b, 1.6, b.d/2 + 2.0); const fl = nightLight('#ff6a2a', 10, 9, fx, 1.7, fz); lights[lights.length - 1].always = .7; anim.push(t => { fl.userData.flicker = 1 + Math.sin(t*9)*.15 + Math.sin(t*23)*.1; });
    // quench barrel, weapon rack
    const pts = []; for(let i = 0; i <= 10; i++){ const t = i/10; pts.push(new THREE.Vector2(.38 + Math.sin(t*Math.PI)*.08, t*1.0)); }
    const bg = new THREE.LatheGeometry(pts, 18); uvCylLathe(bg); sh.add(mesh(bg, M.wood, 2.7, 0, .9));
    const rack = new THREE.Group(); rack.position.set(-2.6, 0, -1.0); sh.add(rack); rack.add(boxM(.1, 1.8, .1, M.beam, -.8, .9, 0), boxM(.1, 1.8, .1, M.beam, .8, .9, 0), boxM(1.8, .08, .1, M.beam, 0, 1.6, 0), boxM(1.8, .08, .1, M.beam, 0, .4, 0));
    for(let i = 0; i < 4; i++){ const sw = boxM(.06, 1.2, .02, M.iron, -.6 + i*.4, 1.0, .08); sw.rotation.z = .08; rack.add(sw); rack.add(boxM(.22, .04, .06, M.bronze, -.6 + i*.4, 1.5, .08)); }
    colliders.push({ type: 'rect', x: sx, z: sz, hw: 3.3, hd: 1.9, ang: b.yaw });
    B.forge.info.door.set(...(() => { const [dx, dz] = W(b, -.5, b.d/2 + 5.2); return [dx, 0, dz]; })());
  }

  // ---------- tavern terrace ----------
  { const b = B.tavern;
    for(let k = 0; k < 3; k++){ const [tx, tz] = W(b, -3 + k*3, b.d/2 + 4.8); const g = new THREE.Group(); g.position.set(tx, 0, tz); g.rotation.y = b.yaw; world.add(g);
      g.add(cylM(.5, .5, .08, 14, M.wood, 0, .78, 0)); g.add(cylM(.06, .1, .74, 8, M.beam, 0, .37, 0));
      [-1, 1].forEach(s => g.add(boxM(1.1, .06, .32, M.wood, 0, .45, s*.85)));
      g.add(cylM(.06, .05, .16, 8, M.iron, .15, .9, .1)); colliders.push({ type: 'circle', x: tx, z: tz, r: 1.0 }); }
    [[-4.6, 2.6], [-4.6, 3.6], [4.7, 2.8]].forEach(([lx, lz]) => { const [x, z] = W(b, lx, b.d/2 + lz); const pts = []; for(let i = 0; i <= 10; i++){ const t = i/10; pts.push(new THREE.Vector2(.38 + Math.sin(t*Math.PI)*.08, t*1.0)); } const bg = new THREE.LatheGeometry(pts, 18); uvCylLathe(bg); world.add(mesh(bg, M.wood, x, 0, z)); [.12, .88].forEach(y => world.add(mesh(new THREE.TorusGeometry(.39, .018, 6, 24), M.iron, x, y, z).rotateX(Math.PI/2))); colliders.push({ type: 'circle', x, z, r: .55 }); });
  }

  // ---------- quest board in front of the guild ----------
  { const b = B.guild; const [x, z] = W(b, -5.2, b.d/2 + 3.6);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = b.yaw;
    [-.9, .9].forEach(s => g.add(boxM(.14, 2.8, .14, M.wood, s, 1.4, 0)));
    g.add(boxM(2.0, 1.4, .08, M.planks, 0, 1.95, 0));
    const paper = canvasTexture(128, 160, (c, w2, h2) => { c.fillStyle = '#efe4c8'; c.fillRect(0, 0, w2, h2); c.strokeStyle = 'rgba(60,40,20,.55)'; c.lineWidth = 2; for(let i = 0; i < 9; i++){ c.beginPath(); c.moveTo(12, 24 + i*14); c.lineTo(w2 - 12 - Math.random()*40, 24 + i*14); c.stroke(); } c.fillStyle = 'rgba(140,30,20,.8)'; c.beginPath(); c.arc(w2 - 26, h2 - 24, 10, 0, 7); c.fill(); });
    const pm = new THREE.MeshStandardMaterial({ map: paper, roughness: .95 });
    [[-.55, 2.05, .06], [0, 2.2, -.05], [.55, 1.95, .08], [-.2, 1.65, .02]].forEach(([px, py, rz]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(.42, .55), pm); p.position.set(px, py, .05); p.rotation.z = rz; p.userData.keep = true; p.castShadow = true; g.add(p); });
    const rg = new THREE.Group(); rg.position.y = 2.85; g.add(rg); gableRoof(rg, 2.2, .6, 0, .45, M.roof, .15);
    world.add(g); colliders.push({ type: 'rect', x, z, hw: 1.1, hd: .35, ang: b.yaw });
    const [dx, dz] = W(b, -5.2, b.d/2 + 5.4);
    interactives.push({ id: 'board', name: 'Дошка завдань', desc: '', door: new THREE.Vector3(dx, 0, dz), group: g, labelY: 3.9, pos: new THREE.Vector3(x, 0, z) }); }

  // ---------- residential houses along the ring street and gate roads ----------
  const PAL = [['#e8dcc4', '#3f5a3a'], ['#d9c6a8', '#6a3a2a'], ['#efe6d6', '#2f4a6a'], ['#e2cfb8', '#5a4a2a'], ['#dcd2c2', '#4a2a3a'], ['#f0e2c8', '#3a5a6a']];
  const homes = [];
  for(let q = 0; q < 4; q++){
    const qa = q*90*deg + 45*deg;
    [[-28, 44], [-14, 46], [0, 47.5], [14, 46], [28, 44], [-24, 26.5], [24, 26.5]].forEach(([da, r2], k) => {
      const a = qa + da*deg*(r2 > 40 ? .78 : 1); const [x, z] = at(a, r2);
      const big = r2 > 40;
      const w = big ? 6 + rand()*1.6 : 5.5 + rand()*1.2, d = 5 + rand()*1.2;
      // keep off streets & the key buildings
      if(onStreet(x, z, Math.max(w, d)*.5 + .6)) return;
      if(Object.values(B).some(b => Math.hypot(b.x - x, b.z - z) < 11.5)) return;
      if(homes.some(h => Math.hypot(h.x - x, h.z - z) < 8.6)) return;
      const yaw = big ? faceC(x, z) : Math.atan2(Math.cos(a)*-1, Math.sin(a)*-1);
      const p = PAL[(q*7 + k) % PAL.length];
      const style = rand() < .25 ? 'brick' : rand() < .2 ? 'stone' : null;
      homes.push(house({ x, z, yaw, w, d, h: 4.6 + rand()*1.4, wall: p[0], shutter: p[1], roofType: rand() < .3 ? 'dark' : rand() < .2 ? 'slate' : null, roofH: 2.3 + rand()*.6, chimney: rand() < .55, flowers: rand() < .5, style }));
    });
  }

  // ---------- small props: wells, carts, crates, barrels, gardens ----------
  function crate(x, z, s, ry){ const c = boxM(s, s, s, M.planks, x, s/2, z); c.rotation.y = ry || 0; world.add(c); const e = boxM(s + .02, .08, s + .02, M.beam, x, s - .04, z); e.rotation.y = ry || 0; world.add(e); colliders.push({ type: 'circle', x, z, r: s*.8 }); }
  function barrel(x, z){
    const pts = []; for(let i = 0; i <= 10; i++){ const t = i/10; pts.push(new THREE.Vector2(.38 + Math.sin(t*Math.PI)*.08, t*1.0)); }
    const geo = new THREE.LatheGeometry(pts, 20); uvCylLathe(geo); world.add(mesh(geo, M.wood, x, 0, z));
    [.12, .4, .6, .88].forEach(y => world.add(mesh(new THREE.TorusGeometry(.39 + Math.sin(y*Math.PI)*.08, .018, 6, 24), M.iron, x, y, z).rotateX(Math.PI/2)));
    world.add(mesh(new THREE.CircleGeometry(.37, 20), M.wood, x, .99, z).rotateX(-Math.PI/2)); colliders.push({ type: 'circle', x, z, r: .55 });
  }
  function well(x, z){
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const ring = new THREE.Shape(); ring.absarc(0, 0, 1.2, 0, Math.PI*2); const hole = new THREE.Path(); hole.absarc(0, 0, .9, 0, Math.PI*2, true); ring.holes.push(hole);
    const rg = new THREE.ExtrudeGeometry(ring, { depth: 1.0, bevelEnabled: false, curveSegments: 32 }); rg.rotateX(-Math.PI/2); uvCylLathe(rg);
    g.add(mesh(rg, M.stone)); g.add(mesh(new THREE.CircleGeometry(.9, 24), M.dark, 0, .5, 0).rotateX(-Math.PI/2));
    [-1.0, 1.0].forEach(s => g.add(boxM(.16, 2.4, .16, M.wood, s, 2.0, 0))); g.add(rot(cylM(.08, .08, 2.3, 8, M.wood, 0, 2.6, 0), 'z', Math.PI/2));
    g.add(cylM(.012, .012, 1.4, 4, M.wood, 0, 1.9, 0)); g.add(cylM(.17, .14, .28, 10, M.planks, 0, 1.1, 0));
    const roofG = new THREE.Group(); roofG.position.y = 3.15; g.add(roofG); gableRoof(roofG, 2.4, 1.6, 0, .9, M.roof, .2);
    world.add(g); colliders.push({ type: 'circle', x, z, r: 1.45 });
  }
  [[40, 10], [-40, -10], [10, -40]].forEach(([a, r2], i) => { const [x, z] = at((a + i*90 + 30)*deg, 40); if(!onStreet(x, z, 1.6) && !homes.some(h => Math.hypot(h.x - x, h.z - z) < 6)) well(x, z); });
  homes.forEach((h, i) => { if(i % 3) return; const [x, z] = W(h, h.w/2 + .9, h.d/2 - .3); if(onStreet(x, z, .8)) return; if(i % 2) barrel(x, z); else crate(x, z, .75, i); });
  { const b = B.shop; [[3.6, 0], [4.4, -1.2]].forEach(([lx, lz], i) => { const [x, z] = W(b, lx + 1.6, b.d/2 + 2.5 + lz); crate(x, z, .8, i*.7); }); }
  // hay cart & stable corner near the south gate
  { const x = 11, z = 46; const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = 1.1;
    g.add(boxM(1.5, .1, 2.4, M.planks, 0, .75, 0)); [-1, 1].forEach(s => { g.add(boxM(.06, .4, 2.4, M.planks, s*.75, .98, 0)); });
    [-1, 1].forEach(s => { const wh = mesh(new THREE.TorusGeometry(.5, .06, 8, 20), M.wood, s*.85, .55, -.4); wh.rotation.y = Math.PI/2; g.add(wh); for(let k = 0; k < 6; k++){ const sp = boxM(.04, .95, .04, M.wood, s*.85, .55, -.4); sp.rotation.x = k/6*Math.PI; g.add(sp); } });
    g.add(rot(boxM(.08, .08, 1.8, M.wood, -.3, .55, 1.9), 'x', .3)); g.add(rot(boxM(.08, .08, 1.8, M.wood, .3, .55, 1.9), 'x', .3));
    const hay = new THREE.MeshStandardMaterial({ color: '#c8a85a', roughness: 1, map: tex('grass2.jpg', { srgb: true, repeat: 1 }) });
    const hm = mesh(new THREE.IcosahedronGeometry(.9, 3), hay, 0, 1.15, 0); hm.scale.set(.82, .48, 1.3); g.add(hm);
    world.add(g); colliders.push({ type: 'rect', x, z, hw: 1.0, hd: 1.7, ang: 1.1 }); }

  // smoke from chimneys
  const smokes = [];
  [B.forge, B.tavern, B.guild].concat(homes.filter((h, i) => i % 4 === 0)).forEach((b, bi) => {
    const lx = b.w/2 - 1.0, lz = -b.d/4, ch = b.h + b.roofH + 1.3;
    const cos = Math.cos(b.yaw), sin = Math.sin(b.yaw);
    const wx = b.x + lx*cos + lz*sin, wz = b.z - lx*sin + lz*cos;
    for(let i = 0; i < 6; i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#9a9590', transparent: true, opacity: 0, depthWrite: false })); s.position.set(wx, ch, wz); world.add(s); smokes.push({ s, wx, wz, y0: ch, t: i/6*5 + bi }); }
  });
  anim.push((t, dt) => { smokes.forEach(m => { m.t += dt*.45; const k = (m.t % 5)/5; m.s.position.set(m.wx + k*2.2 + Math.sin(m.t*1.3)*.25, m.y0 + k*5, m.wz + k*.6); const sc = .7 + k*3; m.s.scale.set(sc, sc, 1); m.s.material.opacity = (1 - k)*.32*Math.min(1, k*5); }); });

  // =====================================================================================
  //  Сонцеград — the royal capital beyond the eastern pass
  // =====================================================================================
  const C2 = CITY2, cob2 = [], dirt2 = [];
  const B2 = {};
  const at2 = (a, r) => [C2.x + Math.cos(a)*r, C2.z + Math.sin(a)*r];
  const face2 = (x, z) => Math.atan2(C2.x - x, C2.z - z);
  const GATES2 = [{ id: 'W', a: Math.PI }, { id: 'N', a: -Math.PI/2 }, { id: 'S', a: Math.PI/2 }];
  const onStreet2 = (x, z, m) => { m = m || 0; const dx = x - C2.x, dz = z - C2.z, r = Math.hypot(dx, dz); if(r < 17 + m) return true; if(Math.abs(r - 31) < 2.6 + m || Math.abs(r - 56) < 2.4 + m) return true; for(const G of GATES2){ const cx = Math.cos(G.a), sz = Math.sin(G.a); const al = dx*cx + dz*sz, pe = Math.abs(-dx*sz + dz*cx); if(al > 0 && pe < 3.4 + m) return true; } if(dz < -30 && Math.abs(dx) < 3.4 + m) return true; return false; };
  { // streets
    GATES2.forEach(G => cob2.push({ x0: C2.x + Math.cos(G.a)*14, z0: C2.z + Math.sin(G.a)*14, x1: C2.x + Math.cos(G.a)*(C2.R + 6), z1: C2.z + Math.sin(G.a)*(C2.R + 6), w: 6.4 }));
    [31, 56].forEach((rr, k) => { for(let i = 0; i < 64; i++){ const a0 = i/64*Math.PI*2, a1 = (i + 1)/64*Math.PI*2; cob2.push({ x0: C2.x + Math.cos(a0)*rr, z0: C2.z + Math.sin(a0)*rr, x1: C2.x + Math.cos(a1)*rr, z1: C2.z + Math.sin(a1)*rr, w: k ? 4.6 : 5.2 }); } });
  }
  // castle on the north side
  { const kx = C2.x, kz = C2.z - 50; const g = new THREE.Group(); g.position.set(kx, 0, kz);
    g.add(boxM(30, 11, 22, M.stone, 0, 5.5, 0)); for(let i = 0; i < 15; i++){ g.add(boxM(1.1, 1.3, 1.1, M.stone, -14 + i*2, 11.6, 11)); g.add(boxM(1.1, 1.3, 1.1, M.stone, -14 + i*2, 11.6, -11)); }
    [[-15, -11], [15, -11], [-15, 11], [15, 11]].forEach(([tx, tz]) => { g.add(mesh(uvCyl(new THREE.CylinderGeometry(3.2, 3.6, 18, 20), 3.4), M.stone, tx, 9, tz)); g.add(mesh(new THREE.ConeGeometry(4.0, 7, 20), M.slate, tx, 21.5, tz));
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), new THREE.MeshStandardMaterial({ color: '#d9a24a', side: THREE.DoubleSide, roughness: .8 })); fl.position.set(tx + .9, 26.5, tz); fl.userData.keep = true; g.add(fl); g.add(cylM(.05, .05, 3, 6, M.iron, tx, 26, tz)); });
    g.add(boxM(12, 26, 12, M.stone, 0, 13, -2)); g.add(boxM(13, .5, 13, M.stoneDark, 0, 26.2, -2)); for(let i = 0; i < 6; i++){ [-6, 6].forEach(zz => g.add(boxM(1, 1.2, .8, M.stone, -5 + i*2, 27, -2 + zz))); }
    g.add(mesh(new THREE.ConeGeometry(7.5, 9, 4), M.slate, 0, 31, -2).rotateY(Math.PI/4));
    for(let k = 0; k < 4; k++) for(let q = 0; q < 3; q++) windowAt(g, -9 + k*6, 4 + q*2.6, 11.05, 0, { w: .7, h: 1.2, shutters: false });
    const arch = new THREE.Shape(); arch.moveTo(-2.8, 0); arch.lineTo(-2.8, 4); arch.absarc(0, 4, 2.8, Math.PI, 0, true); arch.lineTo(2.8, 0); arch.closePath(); g.add(mesh(new THREE.ShapeGeometry(arch), M.dark, 0, 0, 11.06));
    const ban = canvasTexture(256, 512, (c, w2, h2) => { c.fillStyle = '#1e2a6a'; c.fillRect(0, 0, w2, h2); c.fillStyle = '#e8c24a'; c.beginPath(); c.arc(w2/2, 200, 70, 0, 7); c.fill(); for(let i = 0; i < 12; i++){ c.save(); c.translate(w2/2, 200); c.rotate(i/12*Math.PI*2); c.fillRect(-6, -120, 12, 40); c.restore(); } });
    [-8, 8].forEach(bx => { const bn = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.5), new THREE.MeshStandardMaterial({ map: ban, roughness: .9, side: THREE.DoubleSide })); bn.position.set(bx, 6.5, 11.08); bn.userData.keep = true; g.add(bn); });
    world.add(g); colliders.push({ type: 'rect', x: kx, z: kz, hw: 18.5, hd: 14.6, ang: 0, h: 26 });
    B2.castle = { x: kx, z: kz }; }
  // cathedral to the east of the plaza
  { const x = C2.x + 42, z = C2.z + 4; const yaw = -Math.PI/2; B2.temple = house({ id: 'temple2', name: 'Собор Сонця', x, z, yaw, w: 12, d: 22, h: 11, wall: '#f2ecde', roofType: 'slate', roofH: 6.5, style: 'stone', shutter: '#6a5a3a', doubleDoor: true, labelUp: 8 });
    const b = B2.temple; [-1, 1].forEach(sd => { const tw = new THREE.Group(); tw.position.set(sd*5.2, 0, b.d/2 - 1.6); b.g.add(tw); tw.add(boxM(3.6, 22, 3.6, M.stone, 0, 11, 0)); tw.add(boxM(4, .4, 4, M.stoneDark, 0, 22.2, 0)); tw.add(mesh(new THREE.ConeGeometry(2.9, 9, 4), M.slate, 0, 27, 0).rotateY(Math.PI/4)); tw.add(boxM(.15, 1.6, .15, M.gold, 0, 32.2, 0)); tw.add(boxM(1, .15, .15, M.gold, 0, 32.5, 0)); for(let q = 0; q < 3; q++) windowAt(tw, 0, 5 + q*5, 1.82, 0, { w: .6, h: 1.6, shutters: false }); });
    const rose = canvasTexture(256, 256, (c, w2, h2) => { c.translate(w2/2, h2/2); const cols = ['#e8b422', '#c0392b', '#2e5aa8', '#e8b422']; for(let i = 0; i < 16; i++){ c.fillStyle = cols[i % 4]; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 120, i/16*Math.PI*2, (i + 1)/16*Math.PI*2); c.fill(); } c.strokeStyle = '#2a2018'; c.lineWidth = 7; [40, 80, 122].forEach(r => { c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); }); });
    const rw = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshStandardMaterial({ map: rose, emissive: '#ffffff', emissiveMap: rose, emissiveIntensity: .3, roughness: .3 })); rw.position.set(0, 13.5, b.d/2 + .34); rw.userData.keep = true; b.g.add(rw);
    [-1, 1].forEach(sd => { const [tx, tz] = W(b, sd*5.2, b.d/2 - 1.6); colliders.push({ type: 'rect', x: tx, z: tz, hw: 2, hd: 2, ang: b.yaw, h: 30 }); }); }
  // guild hall, shops, tavern around the plaza
  [['guild2', 'Гільдія авантюристів · Сонцеград', 215, 12, 8.5, 8, '#e2dccd', 'slate', 'ГІЛЬДІЯ', 'stone'], ['shop2', 'Королівський базар', 315, 10, 7, 6.2, '#efe2c8', null, 'БАЗАР', null], ['forge2', 'Кузня «Сонячний молот»', 160, 9, 6.5, 5.8, '#cfc6b8', 'slate', 'КУЗНЯ', 'stone'], ['tavern2', 'Корчма «Золотий Грифон»', 115, 11, 8, 6.8, '#e0c9a6', null, 'КОРЧМА', 'brick']].forEach(([id, name, ang, w, d, h, wall, roof, sign, style]) => {
    const [x, z] = at2(ang*deg, 23.5); B2[id] = house({ id, name, x, z, yaw: face2(x, z), w, d, h, wall, roofType: roof, roofH: 3.2, sign, style, chimney: true, light: true, flowers: true, shutter: '#2f4a6a', awning: id === 'shop2' ? ['#1e3a8a', '#efe6d0'] : null, doubleDoor: id === 'guild2', labelUp: 1 }); });
  // grand monument: a column with the golden sun
  { const g = new THREE.Group(); g.position.set(C2.x, 0, C2.z); g.add(mesh(uvCyl(new THREE.CylinderGeometry(4.5, 5, 1.0, 32), 5), M.marble, 0, .5, 0)); g.add(mesh(uvCyl(new THREE.CylinderGeometry(3.6, 3.9, .9, 32), 3.8), M.marble, 0, 1.4, 0));
    g.add(mesh(uvCyl(new THREE.CylinderGeometry(.75, .9, 12, 20), .9), M.marble, 0, 7.8, 0)); g.add(boxM(2.2, .7, 2.2, M.marble, 0, 14.1, 0));
    const sun = new THREE.Group(); sun.position.y = 16.2; g.add(sun); sun.add(mesh(new THREE.SphereGeometry(1.0, 24, 16), M.gold)); for(let i = 0; i < 12; i++){ const ray = mesh(new THREE.ConeGeometry(.22, 1.3, 6), M.gold, Math.cos(i/12*6.283)*1.6, Math.sin(i/12*6.283)*1.6, 0); ray.rotation.z = i/12*6.283 - Math.PI/2; sun.add(ray); }
    sun.userData.keepGroup = true; anim.push(t => { sun.rotation.y = t*.3; });
    world.add(g); colliders.push({ type: 'circle', x: C2.x, z: C2.z, r: 5.2 }); interactives.push({ id: 'pantheon', name: 'Пантеон Богів', action: 'pantheon', desc: '', door: { x: C2.x, z: C2.z + 6.6 }, group: g, labelY: 18.5, pos: new THREE.Vector3(C2.x, 0, C2.z) }); nightLight('#ffd27a', 10, 18, C2.x, 8, C2.z); }
  // market stalls ringing the plaza
  for(let i = 0; i < 10; i++){ const a = i/10*Math.PI*2 + .3; const [x, z] = at2(a, 12.5); if(onStreet2(x, z, -2.2) && Math.abs(Math.hypot(x - C2.x, z - C2.z) - 12.5) > 5) continue; stall(x, z, face2(x, z) + Math.PI, ['#2f6a8a', '#8a5a2a', '#2a6a4a', '#6a2a5a', '#8a2a2a'][i % 5], '#efe6d6', [fruit, bread, fish, cloth][i % 4]); }
  for(let i = 0; i < 12; i++){ const [x, z] = at2((i*30 + 15)*deg, 17.4); lamp(x, z, i % 3 === 0); }
  for(let i = 0; i < 16; i++){ const [x, z] = at2((i*22.5 + 11)*deg, 33.6); lamp(x, z, i % 4 === 0); }
  for(let i = 0; i < 8; i++){ const a = (i*45 + 22.5)*deg; const [x, z] = at2(a, 9.2); bench(x, z, face2(x, z)); }
  // residential quarters: tall town houses
  const homes2 = [];
  for(let ring = 0; ring < 3; ring++){ const rr = [41, 48.5, 66][ring], nA = [22, 26, 34][ring];
    for(let i = 0; i < nA; i++){ const a = i/nA*Math.PI*2 + ring*.13; const [x, z] = at2(a, rr + (rand() - .5)*1.5); const w = 6 + rand()*2, d = 5.2 + rand()*1.2;
      if(onStreet2(x, z, Math.max(w, d)*.5 + .4)) continue; if(Math.hypot(x - B2.castle.x, z - B2.castle.z) < 26) continue; if(Object.values(B2).some(b => b.x != null && b.d && Math.hypot(b.x - x, b.z - z) < 13)) continue; if(homes2.some(h => Math.hypot(h.x - x, h.z - z) < 7.6)) continue;
      const p2 = PAL[(i + ring*3) % PAL.length]; homes2.push(house({ x, z, yaw: ring === 1 ? face2(x, z) + Math.PI : face2(x, z), w, d, h: 6.2 + rand()*2.2, wall: p2[0], shutter: p2[1], roofType: rand() < .4 ? 'slate' : rand() < .3 ? 'dark' : null, roofH: 2.8 + rand()*.8, chimney: rand() < .6, flowers: rand() < .6, style: rand() < .3 ? 'brick' : rand() < .2 ? 'stone' : null })); } }
  // city wall with towers and three gatehouses
  { const WH = 8, WT = 2.8, R2 = C2.R + 1.5, gap = 6/R2, seg = 120;
    for(let i = 0; i < seg; i++){ const a0 = i/seg*Math.PI*2, a1 = (i + 1)/seg*Math.PI*2, am = (a0 + a1)/2;
      if(GATES2.some(G => Math.abs(Math.atan2(Math.sin(am - G.a), Math.cos(am - G.a))) < gap)) continue;
      const L = 2*R2*Math.sin((a1 - a0)/2) + .08, x = C2.x + Math.cos(am)*R2, z = C2.z + Math.sin(am)*R2;
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -am + Math.PI/2;
      g.add(boxM(L, WH, WT, M.stone, 0, WH/2 - .6, 0)); g.add(boxM(L, .3, WT + .3, M.stoneDark, 0, WH - .45, 0)); g.add(boxM(L*.42, 1, .5, M.stone, -L*.25, WH + .2, -WT/2 + .25)); g.add(boxM(L*.42, 1, .5, M.stone, -L*.25, WH + .2, WT/2 - .25));
      world.add(g); colliders.push({ type: 'rect', x, z, hw: L/2 + .05, hd: WT/2, ang: -am + Math.PI/2, h: WH }); }
    for(let k = 0; k < 12; k++){ const a = (k + .5)/12*Math.PI*2; if(GATES2.some(G => Math.abs(Math.atan2(Math.sin(a - G.a), Math.cos(a - G.a))) < .2)) continue; const x = C2.x + Math.cos(a)*R2, z = C2.z + Math.sin(a)*R2; const t = new THREE.Group(); t.position.set(x, 0, z);
      t.add(mesh(uvCyl(new THREE.CylinderGeometry(3.2, 3.5, 12, 18), 3.4), M.stone, 0, 5.4, 0)); t.add(mesh(new THREE.ConeGeometry(3.8, 5, 18), M.slate, 0, 13.9, 0)); world.add(t); colliders.push({ type: 'circle', x, z, r: 3.6, h: 15 }); }
    GATES2.forEach(G => { const x = C2.x + Math.cos(G.a)*R2, z = C2.z + Math.sin(G.a)*R2; const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -G.a + Math.PI/2;
      [-1, 1].forEach(sd => { g.add(boxM(3.2, 11, 4, M.stone, sd*4.8, 4.9, 0)); g.add(mesh(new THREE.ConeGeometry(2.6, 3.6, 4), M.slate, sd*4.8, 12.2, 0).rotateY(Math.PI/4)); const tg = new THREE.Group(); tg.position.set(sd*3.1, 4.6, 2.2); g.add(tg); tg.add(cylM(.1, .07, .18, 8, M.iron, 0, .3, .32)); fires.push({ parent: tg, x: 0, y: .48, z: .32, s: .5, color: '#ff8a3a' }); nightLight('#ff8a3a', 8, 11, sd*3.1, 5, 3, g); });
      const arch = new THREE.Shape(); arch.moveTo(-3.2, 0); arch.lineTo(-3.2, 5); arch.absarc(0, 5, 3.2, Math.PI, 0, true); arch.lineTo(3.2, 0); arch.lineTo(3.3, 0); arch.lineTo(3.3, 9); arch.lineTo(-3.3, 9); arch.lineTo(-3.3, 0); arch.closePath();
      const ag = new THREE.ExtrudeGeometry(arch, { depth: 3.6, bevelEnabled: false, curveSegments: 16 }); ag.translate(0, 0, -1.8); g.add(mesh(uvBox(ag), M.stone));
      const sg = canvasTexture(512, 128, (c, w2, h2) => { c.fillStyle = '#1e2a6a'; c.fillRect(0, 0, w2, h2); c.fillStyle = '#e8c24a'; c.font = 'bold 60px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('СОНЦЕГРАД', w2/2, h2/2 + 4); });
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshStandardMaterial({ map: sg, roughness: .8 })); sp.position.set(0, 9.9, 1.85); sp.userData.keep = true; g.add(sp); g.add(boxM(5.4, 1.5, .2, M.beam, 0, 9.9, 1.7));
      world.add(g); [-1, 1].forEach(sd => colliders.push({ type: 'rect', x: x - Math.sin(G.a)*sd*4.8, z: z + Math.cos(G.a)*sd*4.8, hw: 1.7, hd: 2.1, ang: -G.a + Math.PI/2, h: 11 })); });
  }
  B2.homes = homes2;

  // ---------- trees & hedges inside the walls ----------
  const treeSpots = [];
  { let placed = 0, tries = 0;
    while(placed < 26 && tries < 3000){ tries++;
      const a = rand()*Math.PI*2, d = 14 + rand()*(R - 17); const x = Math.cos(a)*d, z = Math.sin(a)*d;
      if(onStreet(x, z, 2.2)) continue; if(blockedLin(x, z, 1.6)) continue; if(treeSpots.some(t => Math.hypot(t.x - x, t.z - z) < 5)) continue;
      const r2 = rand(); treeSpots.push({ x, z, s: .75 + rand()*.35, r: rand()*6.28, type: r2 < .35 ? 0 : r2 < .55 ? 1 : r2 < .7 ? 2 : r2 < .85 ? 4 : 5 }); colliders.push({ type: 'circle', x, z, r: .55 }); placed++; }
    for(let i = 0, tries2 = 0; i < 40 && tries2 < 2000; tries2++){ const a = rand()*Math.PI*2, d = 10 + rand()*(R - 12); const x = Math.cos(a)*d, z = Math.sin(a)*d; if(onStreet(x, z, 1.2) || blockedLin(x, z, 1.0)) continue; treeSpots.push({ x, z, s: .8 + rand()*.6, r: rand()*6.28, type: 6 + (i % 2) }); colliders.push({ type: 'circle', x, z, r: .7 }); i++; }
  }
  const rimRocks = [];

  // ---------- collision: spatial hash over colliders ----------
  function rectLocal(c, x, z){ const dx = x - c.x, dz = z - c.z, cs = Math.cos(c.ang), sn = Math.sin(c.ang); return [dx*cs - dz*sn, dx*sn + dz*cs, cs, sn]; }
  const HS = 8; let hash = null, hashN = 0;
  function buildHash(){ hash = new Map(); hashN = colliders.length; colliders.forEach(c => { const rr = c.type === 'circle' ? c.r : Math.hypot(c.hw, c.hd); const i0 = Math.floor((c.x - rr)/HS), i1 = Math.floor((c.x + rr)/HS), j0 = Math.floor((c.z - rr)/HS), j1 = Math.floor((c.z + rr)/HS); for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const k = i*100003 + j; let a = hash.get(k); if(!a){ a = []; hash.set(k, a); } a.push(c); } }); }
  const EMPTY = [];
  function near(x, z){ if(!hash || hashN !== colliders.length) buildHash(); return hash.get(Math.floor(x/HS)*100003 + Math.floor(z/HS)) || EMPTY; }
  function hitC(c, x, z, r){ if(c.type === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + r; const [lx, lz] = rectLocal(c, x, z); const cx = Math.max(-c.hw, Math.min(c.hw, lx)), cz = Math.max(-c.hd, Math.min(c.hd, lz)); return Math.hypot(lx - cx, lz - cz) < r; }
  function blockedLin(x, z, r){ for(const c of colliders){ if(Math.abs(c.x - x) > 12 || Math.abs(c.z - z) > 12) continue; if(hitC(c, x, z, r)) return true; } return false; }
  const inTownR = (x, z, r) => Math.hypot(x, z) < R - 1.6 - r;
  const gateOf = (x, z, r) => GATES.find(G => { const al = x*G.cx + z*G.sz, pe = Math.abs(-x*G.sz + z*G.cx); return al > R - 10 && al < WALL_R + 11 && pe < 2.5 - r; });
  const inWildR = (x, z, r) => inWild(x, z, r + .3);
  let dungeon = null;
  function walkable(x, z, r){ if(isDun(x)) return dungeon.walkable(x, z, r); return inTownR(x, z, r) || !!gateOf(x, z, r) || inWildR(x, z, r); }
  function blocked(x, z, r){
    if(isDun(x)) return !dungeon.walkable(x, z, r);
    if(!walkable(x, z, r)) return true;
    for(const c of near(x, z)) if(hitC(c, x, z, r)) return true;
    return false;
  }
  function resolve(x, z, r){
    if(isDun(x)) return dungeon.resolve(x, z, r);
    let px = x, pz = z;
    for(const c of near(x, z)){
      if(c.type === 'circle'){ const dx = px - c.x, dz = pz - c.z, d = Math.hypot(dx, dz), m = c.r + r; if(d < m && d > 1e-4){ px = c.x + dx/d*m; pz = c.z + dz/d*m; } }
      else { const [lx, lz, cs, sn] = rectLocal(c, px, pz); const cx = Math.max(-c.hw, Math.min(c.hw, lx)), cz = Math.max(-c.hd, Math.min(c.hd, lz)); const dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz);
        if(d < r){ let nx, nz; if(d > 1e-4){ nx = dx/d; nz = dz/d; } else { nx = lx > 0 ? 1 : -1; nz = 0; } const ex = cx + nx*r, ez = cz + nz*r; px = c.x + ex*cs + ez*sn; pz = c.z - ex*sn + ez*cs; } }
    }
    if(!walkable(px, pz, r)){
      const cands = [];
      { const L = Math.hypot(px, pz) || 1, k = Math.min(1, (R - 1.61 - r)/L); cands.push([px*k, pz*k]); }
      GATES.forEach(G => { const al = Math.max(R - 9.9, Math.min(WALL_R + 10.9, px*G.cx + pz*G.sz)); let pe = -px*G.sz + pz*G.cx; pe = Math.max(-(2.49 - r), Math.min(2.49 - r, pe)); cands.push([G.cx*al - G.sz*pe, G.sz*al + G.cx*pe]); });
      { const L = Math.hypot(px, pz) || 1; const lo = (WALL_R + 2.21 + r + .3)/L; if(lo > 1) cands.push([px*lo, pz*lo]); }
      let best = null, bd = 1e9; for(const c of cands){ if(!walkable(c[0], c[1], r)) continue; const d = Math.hypot(c[0] - x, c[1] - z); if(d < bd){ bd = d; best = c; } }
      if(best){ px = best[0]; pz = best[1]; } else { px = x; pz = z; }
      if(bd > 3 && best){ /* far jump means we were pushed against water or the border: stay */ }
    }
    return [px, pz];
  }
  function where(x, z){ if(isDun(x)) return 'dungeon'; if(inTownR(x, z, 0)) return 'town'; const G = gateOf(x, z, 0); if(G) return 'gate'; return 'wild'; }
  function nearestGate(x, z){ let best = GATES[0], bd = 1e9; GATES.forEach(G => { const d = Math.hypot(G.out[0] - x, G.out[1] - z); if(d < bd){ bd = d; best = G; } }); return best; }

  // grid A* inside the walls
  const CELL = 1, N = Math.ceil(R*2/CELL), OFF = R;
  const grid = new Uint8Array(N*N);
  for(let j = 0; j < N; j++) for(let i = 0; i < N; i++){ const x = i*CELL - OFF + CELL/2, z = j*CELL - OFF + CELL/2; grid[j*N + i] = (!inTownR(x, z, .5) && !gateOf(x, z, .5)) || blocked(x, z, .5) ? 1 : 0; }
  const toCell = v => Math.max(0, Math.min(N - 1, Math.floor((v + OFF)/CELL)));
  function nearestFree(ci, cj){ if(!grid[cj*N + ci]) return [ci, cj]; for(let rr = 1; rr < 8; rr++) for(let dj = -rr; dj <= rr; dj++) for(let di = -rr; di <= rr; di++){ const i = ci + di, j = cj + dj; if(i >= 0 && j >= 0 && i < N && j < N && !grid[j*N + i]) return [i, j]; } return [ci, cj]; }
  function lineClear(ax, az, bx, bz){ const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d/.35); for(let k = 1; k < n; k++){ const t = k/n; if(blocked(ax + (bx - ax)*t, az + (bz - az)*t, .42)) return false; } return true; }
  function findPath(sx, sz, tx, tz){
    if(lineClear(sx, sz, tx, tz) && !blocked(tx, tz, .42)) return [[tx, tz]];
    const [si, sj] = nearestFree(toCell(sx), toCell(sz)), [ti, tj] = nearestFree(toCell(tx), toCell(tz));
    const NN = N*N, gS = new Float32Array(NN).fill(1e9), from = new Int32Array(NN).fill(-1), closed = new Uint8Array(NN);
    const heap = []; const push = (k, p) => { heap.push([p, k]); let i = heap.length - 1; while(i > 0){ const pa = (i - 1) >> 1; if(heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if(heap.length){ heap[0] = last; let i = 0; for(;;){ const l = i*2 + 1, r = l + 1; let m = i; if(l < heap.length && heap[l][0] < heap[m][0]) m = l; if(r < heap.length && heap[r][0] < heap[m][0]) m = r; if(m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const s0 = sj*N + si, goal = tj*N + ti; gS[s0] = 0; push(s0, 0); let found = false;
    while(heap.length){ const [, k] = pop(); if(closed[k]) continue; closed[k] = 1; if(k === goal){ found = true; break; }
      const ci = k % N, cj = (k - ci)/N;
      for(let dj = -1; dj <= 1; dj++) for(let di = -1; di <= 1; di++){ if(!di && !dj) continue; const ni = ci + di, nj = cj + dj; if(ni < 0 || nj < 0 || ni >= N || nj >= N || grid[nj*N + ni]) continue; if(di && dj && (grid[cj*N + ni] || grid[nj*N + ci])) continue;
        const nk = nj*N + ni, ng = gS[k] + (di && dj ? 1.414 : 1); if(ng < gS[nk]){ gS[nk] = ng; from[nk] = k; push(nk, ng + Math.hypot(ni - ti, nj - tj)); } } }
    if(!found) return [];
    const cells = []; for(let k = goal; k !== s0 && k !== -1; k = from[k]) cells.push(k); cells.reverse();
    const pts = cells.map(c => [(c % N)*CELL - OFF + CELL/2, Math.floor(c/N)*CELL - OFF + CELL/2]);
    const out = []; let ax = sx, az = sz, idx = 0;
    while(idx < pts.length){ let far = idx; for(let j = pts.length - 1; j >= idx; j--){ if(lineClear(ax, az, pts[j][0], pts[j][1])){ far = j; break; } } out.push(pts[far]); ax = pts[far][0]; az = pts[far][1]; idx = far + 1; }
    if(!blocked(tx, tz, .42)) out.push([tx, tz]);
    return out;
  }
  // general A* outside the walls (capital streets, villages, forests): local grid around start/target, lazily sampled
  function findPathWild(sx, sz, tx, tz){
    if(lineClear(sx, sz, tx, tz) && !blocked(tx, tz, .42)) return [[tx, tz]];
    const dist = Math.hypot(tx - sx, tz - sz); if(dist > 420) return [[tx, tz]];
    const cs = dist < 120 ? 1 : dist < 240 ? 1.5 : 2.2, pad = 30;
    const x0 = Math.min(sx, tx) - pad, z0 = Math.min(sz, tz) - pad, NX = Math.ceil((Math.abs(tx - sx) + pad*2)/cs), NZ = Math.ceil((Math.abs(tz - sz) + pad*2)/cs), NN = NX*NZ;
    const st = new Uint8Array(NN); // 0 unknown, 1 free, 2 blocked
    const free = k => { if(!st[k]){ const i = k % NX, j = (k - i)/NX; st[k] = blocked(x0 + (i + .5)*cs, z0 + (j + .5)*cs, .5) ? 2 : 1; } return st[k] === 1; };
    const cell = (x, z) => { const i = Math.max(0, Math.min(NX - 1, Math.floor((x - x0)/cs))), j = Math.max(0, Math.min(NZ - 1, Math.floor((z - z0)/cs))); return j*NX + i; };
    const nearF = k => { if(free(k)) return k; const ci = k % NX, cj = (k - ci)/NX; for(let rr = 1; rr < 10; rr++) for(let dj = -rr; dj <= rr; dj++) for(let di = -rr; di <= rr; di++){ const i = ci + di, j = cj + dj; if(i >= 0 && j >= 0 && i < NX && j < NZ && free(j*NX + i)) return j*NX + i; } return k; };
    const s0 = nearF(cell(sx, sz)), goal = nearF(cell(tx, tz)); const ti = goal % NX, tj = (goal - ti)/NX;
    const gS = new Float32Array(NN).fill(1e9), from = new Int32Array(NN).fill(-1), closed = new Uint8Array(NN);
    const heap = []; const push = (k, p) => { heap.push([p, k]); let i = heap.length - 1; while(i > 0){ const pa = (i - 1) >> 1; if(heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if(heap.length){ heap[0] = last; let i = 0; for(;;){ const l = i*2 + 1, r = l + 1; let m = i; if(l < heap.length && heap[l][0] < heap[m][0]) m = l; if(r < heap.length && heap[r][0] < heap[m][0]) m = r; if(m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    gS[s0] = 0; push(s0, 0); let found = false, it = 0, best = s0, bestH = 1e9;
    while(heap.length && it++ < 60000){ const [, k] = pop(); if(closed[k]) continue; closed[k] = 1; if(k === goal){ found = true; break; }
      const ci = k % NX, cj = (k - ci)/NX; const h0 = Math.hypot(ci - ti, cj - tj); if(h0 < bestH){ bestH = h0; best = k; }
      for(let dj = -1; dj <= 1; dj++) for(let di = -1; di <= 1; di++){ if(!di && !dj) continue; const ni = ci + di, nj = cj + dj; if(ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue; const nk = nj*NX + ni; if(closed[nk] || !free(nk)) continue; if(di && dj && (!free(cj*NX + ni) || !free(nj*NX + ci))) continue;
        const ng = gS[k] + (di && dj ? 1.414 : 1); if(ng < gS[nk]){ gS[nk] = ng; from[nk] = k; push(nk, ng + Math.hypot(ni - ti, nj - tj)*1.05); } } }
    const end = found ? goal : best; if(end === s0) return found ? [[tx, tz]] : [];
    const cells = []; for(let k = end; k !== s0 && k !== -1; k = from[k]) cells.push(k); cells.reverse();
    const pts = cells.map(c => [x0 + ((c % NX) + .5)*cs, z0 + (Math.floor(c/NX) + .5)*cs]);
    const out = []; let ax = sx, az = sz, idx = 0;
    while(idx < pts.length){ let far = idx; for(let j = Math.min(pts.length - 1, idx + 60); j >= idx; j--){ if(lineClear(ax, az, pts[j][0], pts[j][1])){ far = j; break; } } out.push(pts[far]); ax = pts[far][0]; az = pts[far][1]; idx = far + 1; }
    if(found && !blocked(tx, tz, .42)) out.push([tx, tz]);
    return out;
  }
  function randomFree(cx, cz, rad){ for(let k = 0; k < 40; k++){ const a = Math.random()*Math.PI*2, d = Math.random()*rad; const x = cx + Math.cos(a)*d, z = cz + Math.sin(a)*d; if(!blocked(x, z, .6) && where(x, z) === where(cx, cz)) return [x, z]; } return [cx, cz]; }

  // ---------- ground masks: town (R = dirt, G = cobble) and the world (R = trails, G = dark forest, B = dry / swamp) ----------
  const MASK = 180, MP = 2048;
  const cv = document.createElement('canvas'); cv.width = cv.height = MP; const cx2 = cv.getContext('2d');
  cx2.fillStyle = '#000'; cx2.fillRect(0, 0, MP, MP);
  const toP = v => (v/MASK + .5)*MP;
  cx2.globalCompositeOperation = 'lighter';
  [[1.0, .22], [.75, .3], [.5, .5]].forEach(([wk, al]) => { paths.forEach(p => { cx2.strokeStyle = `rgba(255,0,0,${al})`; cx2.lineCap = 'round'; cx2.lineWidth = p.w*wk*MP/MASK*1.25; cx2.beginPath(); cx2.moveTo(toP(p.x0), toP(p.z0)); cx2.lineTo(toP(p.x1), toP(p.z1)); cx2.stroke(); }); });
  [[1.0, .5], [.85, 1]].forEach(([wk, al]) => { cob.forEach(p => { cx2.strokeStyle = `rgba(0,255,0,${al})`; cx2.lineCap = 'round'; cx2.lineWidth = p.w*wk*MP/MASK; cx2.beginPath(); cx2.moveTo(toP(p.x0), toP(p.z0)); cx2.lineTo(toP(p.x1), toP(p.z1)); cx2.stroke(); }); });
  { const gr = cx2.createRadialGradient(MP/2, MP/2, 0, MP/2, MP/2, (PLAZA + 1.4)*MP/MASK); gr.addColorStop(0, 'rgba(0,255,0,1)'); gr.addColorStop(PLAZA/(PLAZA + 1.4), 'rgba(0,255,0,1)'); gr.addColorStop(1, 'rgba(0,255,0,0)'); cx2.fillStyle = gr; cx2.fillRect(0, 0, MP, MP); }
  cx2.globalCompositeOperation = 'source-over';
  const M2S = 200, M2P = 2048;
  const cv2 = document.createElement('canvas'); cv2.width = cv2.height = M2P; const c3 = cv2.getContext('2d'); c3.fillStyle = '#000'; c3.fillRect(0, 0, M2P, M2P);
  const toP2 = (v, c) => ((v - c)/M2S + .5)*M2P;
  c3.globalCompositeOperation = 'lighter';
  [[1.0, .5], [.85, 1]].forEach(([wk, al]) => { cob2.forEach(p2 => { c3.strokeStyle = `rgba(0,255,0,${al})`; c3.lineCap = 'round'; c3.lineWidth = p2.w*wk*M2P/M2S; c3.beginPath(); c3.moveTo(toP2(p2.x0, C2.x), toP2(p2.z0, C2.z)); c3.lineTo(toP2(p2.x1, C2.x), toP2(p2.z1, C2.z)); c3.stroke(); }); });
  { const gr = c3.createRadialGradient(M2P/2, M2P/2, 0, M2P/2, M2P/2, 18*M2P/M2S); gr.addColorStop(0, 'rgba(0,255,0,1)'); gr.addColorStop(.92, 'rgba(0,255,0,1)'); gr.addColorStop(1, 'rgba(0,255,0,0)'); c3.fillStyle = gr; c3.fillRect(0, 0, M2P, M2P); }
  paths.filter(p2 => Math.hypot(p2.x0 - C2.x, p2.z0 - C2.z) < 100).forEach(p2 => { c3.strokeStyle = 'rgba(255,0,0,.6)'; c3.lineWidth = p2.w*M2P/M2S; c3.beginPath(); c3.moveTo(toP2(p2.x0, C2.x), toP2(p2.z0, C2.z)); c3.lineTo(toP2(p2.x1, C2.x), toP2(p2.z1, C2.z)); c3.stroke(); });
  c3.globalCompositeOperation = 'source-over';
  const mask2Data = c3.getImageData(0, 0, M2P, M2P).data;
  const WMS = 1150, WMP = 2048;
  const wcv = document.createElement('canvas'); wcv.width = wcv.height = WMP; const wcx = wcv.getContext('2d'); wcx.fillStyle = '#000'; wcx.fillRect(0, 0, WMP, WMP);
  const paint = fn => { wcx.save(); wcx.setTransform(WMP/WMS, 0, 0, WMP/WMS, WMP/2, WMP/2); wcx.globalCompositeOperation = 'lighter'; fn(wcx); wcx.restore(); };
  ROADS.forEach(Rd => paint(c => { [[1.3, .25], [.95, .35], [.6, .5]].forEach(([k, a]) => { c.strokeStyle = `rgba(255,0,0,${a})`; c.lineWidth = 3.4*k; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); Rd.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); }); }));
  const wild = buildWild({ world, colliders, anim, M, rand, fires, nightLight, glowSprite, paint, interactives });
  dungeon = buildDungeon({ world, colliders, anim, M, rand, fires, nightLight, glowSprite, paint, interactives });
  dungeon.spawns.forEach(sp => wild.spawns.push(sp)); dungeon.surfaceRocks.forEach(r => wild.rockSpots.push(r));
  const maskData = cx2.getImageData(0, 0, MP, MP).data, wmaskData = wcx.getImageData(0, 0, WMP, WMP).data;
  function maskAt(x, z){
    const px = Math.floor(toP(x)), pz = Math.floor(toP(z));
    let d = 0, c = 0; if(px >= 0 && pz >= 0 && px < MP && pz < MP){ const i = (pz*MP + px)*4; d = maskData[i]/255; c = maskData[i + 1]/255; }
    { const qx = Math.floor(toP2(x, C2.x)), qz = Math.floor(toP2(z, C2.z)); if(qx >= 0 && qz >= 0 && qx < M2P && qz < M2P){ const i = (qz*M2P + qx)*4; d = Math.max(d, mask2Data[i]/255); c = Math.max(c, mask2Data[i + 1]/255); } }
    const wx = Math.floor((x/WMS + .5)*WMP), wz = Math.floor((z/WMS + .5)*WMP); let g = 0, b = 0;
    if(wx >= 0 && wz >= 0 && wx < WMP && wz < WMP){ const i = (wz*WMP + wx)*4; d = Math.max(d, wmaskData[i]/255); g = wmaskData[i + 1]/255; b = wmaskData[i + 2]/255; }
    return [d, c, g, b];
  }
  buildHash();

  // ---------- waystones: fast travel between the places of the world ----------
  const waystones = [];
  { const runeM = new THREE.MeshStandardMaterial({ color: '#9ae8ff', emissive: '#4ad8ff', emissiveIntensity: 1.2, roughness: .3 });
    const crystM = new THREE.MeshStandardMaterial({ color: '#bff4ff', emissive: '#6ad8ff', emissiveIntensity: .9, roughness: .1, metalness: .2, transparent: true, opacity: .9 });
    const freeNear = (x, z, inside) => { for(let r = 0; r < 26; r += 1.5) for(let k = 0; k < 12; k++){ const a = k/12*Math.PI*2 + r; const px = x + Math.cos(a)*r, pz = z + Math.sin(a)*r; if(blockedLin(px, pz, 2.4)) continue; if(inside ? !inTownR(px, pz, 2) : !inWild(px, pz, 3)) continue; return [px, pz]; } return [x, z]; };
    const Zo = id => ZONES_ALL.find(z => z.id === id);
    const spots = [['town', 'Місто Шляху', 8, 44, true], ['sun', 'Сонцеград', CITY2.x - 92, CITY2.z + 9], ['fishing', 'Рибальське Поріччя', Zo('fishing').x + 5, Zo('fishing').z + 7], ['farm', 'Хутір Вербівка', Zo('farm').x - 2, Zo('farm').z + 2],
      ['shrine', 'Святилище Велеса', Zo('shrine').x + 12, Zo('shrine').z + 6], ['elves', 'Лісова Гавань', Zo('elves').x - 4, Zo('elves').z - 13], ['dwarves', 'Залізний Кряж', Zo('dwarves').x + 7, Zo('dwarves').z + 4], ['beasts', 'Пухнасті Пагорби', Zo('beasts').x + 10, Zo('beasts').z + 7]];
    spots.forEach(([id, n, x0, z0, inside]) => { const [x, z] = freeNear(x0, z0, inside); const g = new THREE.Group(); const y = heightAt(x, z); g.position.set(x, y, z);
      g.add(mesh(uvCyl(new THREE.CylinderGeometry(1.6, 1.9, .5, 8), 1.8), M.stoneDark, 0, .1, 0)); g.add(mesh(uvCyl(new THREE.CylinderGeometry(1.15, 1.3, .3, 8), 1.2), M.stone, 0, .5, 0));
      const ob = mesh(uvCyl(new THREE.CylinderGeometry(.42, .62, 3.4, 4), .6), M.stone, 0, 2.3, 0); ob.rotation.y = Math.PI/4; g.add(ob); g.add(mesh(new THREE.ConeGeometry(.45, .7, 4), M.stoneDark, 0, 4.35, 0).rotateY(Math.PI/4));
      [1.4, 2.3, 3.2].forEach(yy => { const ring = new THREE.Mesh(new THREE.TorusGeometry(.56 - (yy - 1.4)*.05, .045, 6, 4), runeM); ring.rotation.x = Math.PI/2; ring.rotation.z = Math.PI/4; ring.position.y = yy; ring.userData.keep = true; g.add(ring); });
      const cr = new THREE.Group(); cr.position.y = 5.3; g.add(cr); cr.add(new THREE.Mesh(new THREE.OctahedronGeometry(.42, 0), crystM)); cr.userData.keepGroup = true; anim.push(t => { cr.rotation.y = t*.8; cr.position.y = 5.3 + Math.sin(t*1.6)*.15; });
      world.add(g); colliders.push({ type: 'circle', x, z, r: 1.4 }); glowSprite('#7ae0ff', 3.2, x, y + 5.3, z, null, .55);
      const L = nightLight('#7ae0ff', 6, 10, x, y + 4, z); L.userData.always = .5;
      const info = { id: 'way:' + id, name: '💠 ' + n, desc: '', door: { x: x + 2.4, z: z }, group: g, labelY: y + 6.4, pos: new THREE.Vector3(x, y, z) };
      interactives.push(info); waystones.push({ id, n, x, z, door: info.door }); });
  }

  const merged = mergeStatic(world, interactives, pickables, 96);
  // distance culling for baked props and small lights/sprites far from the viewer (big draw-call saver on a 1 km map)
  const cullList = merged.map(m => ({ o: m, c: m.geometry.boundingSphere.center.clone(), r: m.geometry.boundingSphere.radius }));
  world.children.forEach(o => { if(merged.includes(o) || o.isLight) return; const b = new THREE.Box3().setFromObject(o); if(b.isEmpty()) return; const sp = b.getBoundingSphere(new THREE.Sphere()); if(sp.radius > 60) return; cullList.push({ o, c: sp.center, r: sp.radius }); });
  let cullX = 1e9, cullZ = 1e9;
  function cull(x, z, R){ if(Math.hypot(x - cullX, z - cullZ) < 6) return; cullX = x; cullZ = z; for(const it of cullList){ const d = Math.hypot(it.c.x - x, it.c.z - z) - it.r; it.o.visible = d < R; } }
  dungeon.interactives.forEach(i => interactives.push(i)); dungeon.pickables.forEach(p => pickables.push(p));

  return { group: world, colliders, pickables, interactives, anim, lights, glows, fires, blocked, resolve, findPath, findPathWild, randomFree, walkable, where, nearestGate, wild, dungeon, buildings: B, homes, treeSpots, rimRocks, mask: { canvas: cv, size: MASK, at: maskAt }, wmask: { canvas: wcv, size: WMS }, mask2: { canvas: cv2, size: M2S, x: C2.x, z: C2.z }, city2: B2, cull, waystones, M };
}



// cylindrical UVs for lathe/extruded round shapes (u around in meters, v = height)
export function uvCylLathe(geo){
  const p = geo.attributes.position; let uv = geo.attributes.uv;
  if(!uv){ uv = new THREE.BufferAttribute(new Float32Array(p.count*2), 2); geo.setAttribute('uv', uv); }
  const n = geo.attributes.normal;
  for(let i = 0; i < p.count; i++){
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
    const flat = n && Math.abs(n.getY(i)) > .7;
    if(flat) uv.setXY(i, x, z); else uv.setXY(i, (Math.atan2(x, z)/(Math.PI*2) + .5)*Math.PI*2*Math.max(r, .3), y);
  }
  uv.needsUpdate = true; return geo;
}


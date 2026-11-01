import * as THREE from 'three';
import { pbr, mesh, boxM, cylM, canvasTexture, softSprite, rot } from './assets.js';
import { mergeStatic } from './merge.js';
import { fbm2, heightAt } from './nature.js';

// =====================================================================================
//  Підземелля Авантюристів — three underground floors far east of the world (x ≥ 3000).
//  Each floor is a signed-distance field (rooms ∪ tunnels, minus pillars/obstacles) sampled
//  on a 0.5 m grid; walls, rock ceiling-cap and floor are built from it with marching
//  squares, and the same grid drives collision, path-finding and camera occlusion.
// =====================================================================================

export const DX0 = 3000, DSTEP = 300, WALL_H = 5;
const CELL = .5, HALF = 58, NG = Math.round(HALF*2/CELL) + 1;
export const ENTRY = { x: -34, z: 84 };            // surface entrance (Wild lands, west of the meadow)
export const isDun = x => x > 2500;
export const floorX = i => DX0 + i*DSTEP;

// shapes: ['c',x,z,r] chamber · ['r',x,z,w,d] room · ['s',x1,z1,x2,z2,w] tunnel
export const FLOORS = [
  { n: 'I ярус · Вологі печери', sub: 'рекомендований ранг D · рівні 6–10', style: 'cave', lvl: '6–10', rank: 2, seed: 3,
    shapes: [['c', 0, 38, 6.5], ['s', 0, 33, 0, 22, 4.4], ['c', 0, 14, 10], ['s', -6, 10, -22, 4, 4], ['c', -26, 2, 8.5], ['s', 7, 8, 22, -2, 4.4], ['c', 25, -6, 10],
      ['s', -24, -6, -14, -20, 4], ['c', -12, -24, 9.5], ['s', 22, -15, 10, -37, 3.8], ['s', -8, -31, 2, -38, 4.2], ['c', 4, -42, 6.5], ['s', -2, 5, -9, -16, 3.8]],
    pillars: [[3, 17, 1.3], [-4, 10, 1.0], [27, -2, 1.4], [-27, 5, .9], [-14, -21, 1.1]],
    start: [0, 37], up: [0, 41], down: [4, -44.5],
    crystals: [[-31, 6, '#5ad8ff'], [-21, -3, '#9a6aff'], [31, -10, '#5ad8ff'], [19, 1, '#7affd0'], [-17, -30, '#9a6aff'], [9, -45, '#5ad8ff'], [-5, 36, '#7affd0']],
    spawns: [['slime_p', 3, 12], ['slime_p', -5, 17], ['slime_p', 6, 9], ['kobold', -2, 8], ['kobold', 4, 19],
      ['kobold', -28, 0], ['kobold', -23, 5], ['kobold', -30, 4], ['kobold_sl', -25, -3],
      ['kobold', 22, -3], ['kobold', 27, -9], ['kobold_sl', 30, -4], ['kobold_sl', 24, -11], ['slime_p', 20, -8],
      ['slime_p', -16, -13], ['kobold_chief', -12, -26, 2], ['kobold', -8, -22], ['kobold', -16, -27], ['slime_p', 14, -26]] },
  { n: 'II ярус · Забуті склепи', sub: 'рекомендований ранг C · рівні 12–17', style: 'crypt', lvl: '12–17', rank: 3, seed: 11,
    shapes: [['r', 0, 38, 12, 9], ['s', 0, 33.5, 0, 24, 4.2], ['r', 0, 14, 26, 20], ['s', -13, 14, -21, 14, 4], ['r', -28, 12, 14, 22], ['s', 13, 18, 21, 18, 4], ['r', 28, 18, 14, 14],
      ['s', 28, 11, 28, -4, 4], ['r', 28, -10, 12, 12], ['s', 22, -12, 11, -22, 4], ['s', 0, 4, 0, -13, 5], ['r', 0, -22, 24, 18], ['s', -28, 1, -28, -22, 4], ['s', -28, -22, -12, -22, 4],
      ['s', 0, -31, 0, -38, 4.2], ['r', 0, -41.5, 10, 8]],
    cols: [[-7, 8], [7, 8], [-7, 14], [7, 14], [-7, 20], [7, 20], [-7, -17], [7, -17], [-7, -27], [7, -27]],
    sarc: [[-31.5, 6, 0], [-24.5, 6, 0], [-31.5, 18, 0], [-24.5, 18, 0], [24.5, 18, Math.PI/2], [31, -10, 0], [0, -22, 0]],
    start: [0, 37], up: [0, 40.5], down: [0, -43],
    spawns: [['skeleton', -4, 12], ['skeleton', 4, 17], ['skeleton', 2, 7], ['skeleton_ar', -10, 22], ['skeleton_ar', 10, 22],
      ['ghoul', -28, 9], ['ghoul', -26, 16], ['ghoul', -29, 20], ['wraith', -28, 2],
      ['skeleton', 26, 16], ['skeleton', 30, 21], ['ghoul', 28, 14], ['wraith', 26, -9], ['wraith', 30, -12], ['ghoul', -28, -12],
      ['bone_knight', 0, -25, 2], ['skeleton', -4, -20], ['skeleton', 4, -20], ['skeleton', -3, -29, 0, 1], ['skeleton', 3, -29, 0, 1], ['skeleton', 0, -18, 0, 1]] },
  { n: 'III ярус · Лігво Мінотавра', sub: 'рекомендований ранг B · рівні 18–24', style: 'lair', lvl: '18–24', rank: 4, seed: 23,
    shapes: [['r', 0, 38, 12, 9], ['s', 0, 33.5, 0, 25, 4.6], ['c', 0, 16, 10.5], ['s', -8, 20, -20, 12, 4.2], ['r', -28, 10, 16, 16], ['s', 8, 20, 20, 12, 4.2], ['r', 28, 10, 16, 16],
      ['s', -28, 2, -13, -13, 4.6], ['s', 28, 2, 13, -13, 4.6], ['s', 0, 6, 0, -7, 5], ['c', 0, -24, 18], ['s', 0, -41, 0, -46, 4.2], ['r', 0, -49.5, 10, 7]],
    pillars: [[-14.5, -27, 1.3], [14.5, -27, 1.3], [-31, 14, 1.0], [31, 6, 1.0]],
    lava: [[0, 16, 2.4], [-10.5, -15, 1.8], [10.5, -15, 1.8], [-10.5, -33, 1.8], [10.5, -33, 1.8], [-32, 5, 1.4], [32, 15, 1.4]],
    start: [0, 37], up: [0, 40.5], chest: [0, -51],
    spawns: [['dark_knight', -5, 18], ['dark_knight', 5, 13], ['cultist', 0, 22],
      ['cultist', -30, 13], ['cultist', -25, 6], ['minotaur_w', -28, 9],
      ['dark_knight', 25, 12], ['dark_knight', 30, 7], ['cultist', 27, 15],
      ['dark_knight', -21, -6], ['cultist', 21, -6], ['minotaur_w', 0, 1],
      ['minotaur', 0, -27, 2], ['minotaur_w', -6, -38, 0, 1], ['minotaur_w', 6, -38, 0, 1]] }
];

// ------------------------------------------------------------------ wall cut-away -
// Fragments of walls / rock cap that lie between the camera and the hero are dissolved,
// so the camera can stay high above the maze and never loses the hero behind a wall.
export const CUT = { cam: { value: new THREE.Vector3() }, hero: { value: new THREE.Vector3() } };
function cutaway(m){
  m.onBeforeCompile = sh => {
    sh.uniforms.uCutCam = CUT.cam; sh.uniforms.uCutHero = CUT.hero;
    sh.vertexShader = 'varying vec3 vCutW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vCutW = (modelMatrix*vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec3 uCutCam; uniform vec3 uCutHero; varying vec3 vCutW;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { vec3 ab = uCutHero - uCutCam; float L2 = max(dot(ab, ab), 1e-4); float t = dot(vCutW - uCutCam, ab)/L2;
        if(t > 0.0 && t < 1.0 && vCutW.y > 0.08){ float r = mix(1.2, 3.0, t); float d = length(vCutW - (uCutCam + ab*t));
          float k = d - r; if(k < 0.0) discard; if(k < 0.6){ vec2 q = floor(gl_FragCoord.xy*.5); if(mod(q.x + q.y, 2.0) < 1.0 && k < 0.3) discard; } } }`);
  };
  m.customProgramCacheKey = () => 'cutaway';
  return m;
}

// ------------------------------------------------------------------ SDF ----------
function sdShape(s, x, z){
  if(s[0] === 'c') return s[3] - Math.hypot(x - s[1], z - s[2]);
  if(s[0] === 'r'){ const dx = Math.abs(x - s[1]) - s[3]/2, dz = Math.abs(z - s[2]) - s[4]/2; return -(Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0)); }
  const x1 = s[1], z1 = s[2], vx = s[3] - x1, vz = s[4] - z1, L2 = vx*vx + vz*vz; let t = ((x - x1)*vx + (z - z1)*vz)/L2; t = Math.max(0, Math.min(1, t));
  return s[5]/2 - Math.hypot(x - x1 - vx*t, z - z1 - vz*t);
}
const gi = (i, j) => j*NG + i;
function sample(G, lx, lz){
  const u = (lx + HALF)/CELL, v = (lz + HALF)/CELL;
  if(u < 0 || v < 0 || u >= NG - 1 || v >= NG - 1) return -6;
  const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
  const a = G[gi(i, j)], b = G[gi(i + 1, j)], c = G[gi(i, j + 1)], d = G[gi(i + 1, j + 1)];
  return (a*(1 - fu) + b*fu)*(1 - fv) + (c*(1 - fu) + d*fu)*fv;
}
function grad(G, lx, lz){ const e = .3; const gx = sample(G, lx + e, lz) - sample(G, lx - e, lz), gz = sample(G, lx, lz + e) - sample(G, lx, lz - e); const l = Math.hypot(gx, gz) || 1; return [gx/l, gz/l]; }

// marching squares: closed iso-lines (V = 0) as point loops
function contours(G){
  const pts = new Map(), adj = new Map();
  const link = (a, b) => { if(!adj.has(a)) adj.set(a, []); if(!adj.has(b)) adj.set(b, []); adj.get(a).push(b); adj.get(b).push(a); };
  for(let j = 0; j < NG - 1; j++) for(let i = 0; i < NG - 1; i++){
    const va = G[gi(i, j)], vb = G[gi(i + 1, j)], vc = G[gi(i + 1, j + 1)], vd = G[gi(i, j + 1)];
    const ia = va >= 0, ib = vb >= 0, ic = vc >= 0, id = vd >= 0;
    if(ia === ib && ib === ic && ic === id) continue;
    const x0 = -HALF + i*CELL, z0 = -HALF + j*CELL, E = [];
    if(ia !== ib){ const k = 'h' + i + '_' + j; if(!pts.has(k)) pts.set(k, [x0 + va/(va - vb)*CELL, z0]); E[0] = k; }
    if(ib !== ic){ const k = 'v' + (i + 1) + '_' + j; if(!pts.has(k)) pts.set(k, [x0 + CELL, z0 + vb/(vb - vc)*CELL]); E[1] = k; }
    if(id !== ic){ const k = 'h' + i + '_' + (j + 1); if(!pts.has(k)) pts.set(k, [x0 + vd/(vd - vc)*CELL, z0 + CELL]); E[2] = k; }
    if(ia !== id){ const k = 'v' + i + '_' + j; if(!pts.has(k)) pts.set(k, [x0, z0 + va/(va - vd)*CELL]); E[3] = k; }
    const ks = [0, 1, 2, 3].filter(q => E[q]);
    if(ks.length === 2) link(E[ks[0]], E[ks[1]]);
    else if(ks.length === 4){ const cin = (va + vb + vc + vd)/4 >= 0; const sepBD = ia ? cin : !cin;
      if(sepBD){ link(E[0], E[1]); link(E[2], E[3]); } else { link(E[3], E[0]); link(E[1], E[2]); } }
  }
  const seen = new Set(), loops = [];
  for(const k of adj.keys()){
    if(seen.has(k)) continue; const loop = []; let cur = k, prev = null;
    while(cur != null && !seen.has(cur)){ seen.add(cur); loop.push(pts.get(cur)); const nb = adj.get(cur); const nx = nb[0] !== prev ? nb[0] : nb[1]; prev = cur; cur = nx; }
    if(loop.length > 3) loops.push(loop);
  }
  return loops;
}

// filled polygons of one side of the iso-line, at height y (runs of full cells merged)
function fillGeo(G, y, solid, band, hole){
  const pos = [], uv = [];
  const tri = (a, b, c) => { const cr = (b[1] - a[1])*(c[0] - a[0]) - (b[0] - a[0])*(c[1] - a[1]); const T = cr >= 0 ? [a, b, c] : [a, c, b]; T.forEach(p => { pos.push(p[0], y, p[1]); uv.push(p[0], p[1]); }); };
  const take = v => solid ? v < 0 : v >= 0;
  for(let j = 0; j < NG - 1; j++){
    let run = -1;
    const flush = i => { if(run < 0) return; const x0 = -HALF + run*CELL, x1 = -HALF + i*CELL, z0 = -HALF + j*CELL, z1 = z0 + CELL; tri([x0, z0], [x1, z0], [x1, z1]); tri([x0, z0], [x1, z1], [x0, z1]); run = -1; };
    for(let i = 0; i < NG - 1; i++){
      const va = G[gi(i, j)], vb = G[gi(i + 1, j)], vc = G[gi(i + 1, j + 1)], vd = G[gi(i, j + 1)];
      const x0 = -HALF + i*CELL, z0 = -HALF + j*CELL;
      const ta = take(va), tb = take(vb), tc = take(vc), td = take(vd);
      const inHole = hole && x0 + CELL*.5 > hole[0] && x0 + CELL*.5 < hole[1] && z0 + CELL*.5 > hole[2] && z0 + CELL*.5 < hole[3];
      const far = solid && (va + vb + vc + vd)/4 < -band;
      if(ta && tb && tc && td && !inHole && !far){ if(run < 0) run = i; continue; }
      flush(i);
      if(inHole || far || (!ta && !tb && !tc && !td)) continue;
      const poly = [];
      const ex = (v1, v2, p1, p2) => { const t = v1/(v1 - v2); return [p1[0] + (p2[0] - p1[0])*t, p1[1] + (p2[1] - p1[1])*t]; };
      const A = [x0, z0], B = [x0 + CELL, z0], C = [x0 + CELL, z0 + CELL], D = [x0, z0 + CELL];
      if(ta) poly.push(A); if(ta !== tb) poly.push(ex(va, vb, A, B));
      if(tb) poly.push(B); if(tb !== tc) poly.push(ex(vb, vc, B, C));
      if(tc) poly.push(C); if(tc !== td) poly.push(ex(vc, vd, C, D));
      if(td) poly.push(D); if(td !== ta) poly.push(ex(vd, va, D, A));
      for(let k = 1; k < poly.length - 1; k++) tri(poly[0], poly[k], poly[k + 1]);
    }
    flush(NG - 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const n = new Float32Array(pos.length); for(let i = 1; i < n.length; i += 3) n[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

function wallGeo(loops, G, style, seed){
  const pos = [], uv = [], idx = [];
  const ROWS = style === 'crypt' ? 2 : 6;
  for(const L of loops){
    const n = L.length, base = pos.length/3, R1 = ROWS + 1;
    const nrm = L.map(p => grad(G, p[0], p[1]));
    let arc = 0;
    for(let k = 0; k <= n; k++){
      const p = L[k % n]; if(k){ const q = L[k - 1]; arc += Math.hypot(p[0] - q[0], p[1] - q[1]); }
      const nn = nrm[k % n];
      for(let r = 0; r <= ROWS; r++){
        const y = r/ROWS*WALL_H; let d = 0;
        if(style !== 'crypt'){ const s = Math.sin(Math.PI*r/ROWS); d = ((fbm2(p[0]*.33 + y*.29 + seed, p[1]*.33 - y*.23, 3) - .5)*1.5 - .32)*s + (r === ROWS ? 0 : 0); }
        pos.push(p[0] + nn[0]*d, y, p[1] + nn[1]*d); uv.push(arc, y);
      }
    }
    // winding: faces must point into the walkable side (+gradient)
    const a0 = L[0], a1 = L[1 % n]; const ex = a1[0] - a0[0], ez = a1[1] - a0[1];
    const flip = (-ez*nrm[0][0] + ex*nrm[0][1]) < 0;   // quad normal = (-ez, 0, ex)
    for(let k = 0; k < n; k++) for(let r = 0; r < ROWS; r++){
      const a = base + k*R1 + r, b = a + R1, c = b + 1, d = a + 1;
      if(!flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ textures -----
let TX = null;
function textures(){
  if(TX) return TX;
  const lava = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#3a0802'; c.fillRect(0, 0, w, h);
    for(let i = 0; i < 260; i++){ const x = Math.random()*w, y = Math.random()*h, r = 6 + Math.random()*26; const g = c.createRadialGradient(x, y, 0, x, y, r); const hot = Math.random();
      g.addColorStop(0, hot > .7 ? 'rgba(255,230,120,.9)' : 'rgba(255,120,20,.7)'); g.addColorStop(1, 'rgba(160,20,0,0)'); c.fillStyle = g; for(const ox of [-w, 0, w]) for(const oy of [-h, 0, h]) c.fillRect(x - r + ox, y - r + oy, r*2, r*2); }
    c.strokeStyle = 'rgba(30,6,2,.75)'; c.lineWidth = 3; for(let i = 0; i < 26; i++){ c.beginPath(); let x = Math.random()*w, y = Math.random()*h; c.moveTo(x, y); for(let k = 0; k < 5; k++){ x += (Math.random() - .5)*60; y += (Math.random() - .5)*60; c.lineTo(x, y); } c.stroke(); }
  });
  lava.wrapS = lava.wrapT = THREE.RepeatWrapping;
  const rune = canvasTexture(512, 512, (c, w, h) => {
    c.translate(w/2, h/2); c.strokeStyle = '#bff4ff'; c.fillStyle = '#bff4ff'; c.shadowColor = '#5ad8ff'; c.shadowBlur = 18;
    [236, 206, 120].forEach((r, i) => { c.lineWidth = i === 1 ? 3 : 6; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); });
    c.font = 'bold 34px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; const R = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗ';
    for(let i = 0; i < 20; i++){ c.save(); c.rotate(i/20*Math.PI*2); c.fillText(R[i], 0, -222 + 1); c.restore(); }
    c.lineWidth = 4; c.beginPath(); for(let i = 0; i < 6; i++){ const a = i/6*Math.PI*2; c.lineTo(Math.cos(a)*200, Math.sin(a)*200); } c.closePath(); c.stroke();
    c.beginPath(); for(let i = 0; i < 6; i++){ const a = i/6*Math.PI*2 + Math.PI/6; c.lineTo(Math.cos(a)*200, Math.sin(a)*200); } c.closePath(); c.stroke();
  });
  const seal = canvasTexture(1024, 1024, (c, w, h) => {
    c.translate(w/2, h/2); c.strokeStyle = 'rgba(255,90,40,.9)'; c.fillStyle = 'rgba(255,90,40,.9)'; c.shadowColor = '#ff3a10'; c.shadowBlur = 14;
    [500, 470, 300, 140].forEach((r, i) => { c.lineWidth = i % 2 ? 4 : 9; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); });
    c.lineWidth = 6; c.beginPath(); for(let i = 0; i <= 5; i++){ const a = i*4/5*Math.PI*2 - Math.PI/2; c.lineTo(Math.cos(a)*460, Math.sin(a)*460); } c.stroke();
    c.font = 'bold 44px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; const R = 'ᛟᛞᛚᛜᛗᛖᛒᛏᛊᛉᛈᛇᛃᛁᚾᚺᚹᚷᚲᚱᚨᚦᚢᚠ';
    for(let i = 0; i < 24; i++){ c.save(); c.rotate(i/24*Math.PI*2); c.fillText(R[i], 0, -485); c.restore(); }
  });
  const web = canvasTexture(256, 256, (c, w, h) => {
    c.strokeStyle = 'rgba(235,235,235,.75)'; c.lineWidth = 1.2;
    for(let i = 0; i < 9; i++){ const a = i/9*Math.PI/2*1.0; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a)*250, Math.sin(a)*250); c.stroke(); }
    for(let r = 18; r < 250; r += 16 + Math.random()*10){ c.beginPath(); for(let i = 0; i <= 9; i++){ const a = i/9*Math.PI/2; const rr = r*(1 + (Math.random() - .5)*.1); const x = Math.cos(a)*rr, y = Math.sin(a)*rr; i ? c.quadraticCurveTo(Math.cos(a - .09)*rr*.93, Math.sin(a - .09)*rr*.93, x, y) : c.moveTo(x, y); } c.stroke(); }
  });
  return (TX = { lava, rune, seal, web });
}

// ======================================================================= build =====
export function buildDungeon(o){
  const { world, colliders, anim, M, fires, nightLight, glowSprite, paint, rand } = o;
  const dg = new THREE.Group(); dg.name = 'dungeon';
  const dInter = [], dPick = [], spawns = [], rockSpots = [], surfaceRocks = [];
  const T = textures();
  const mats = {
    cave: { wall: pbr('caverock', { scale: 3.4, normal: 1.6, color: '#b8ab98' }), floor: pbr('caverock', { scale: 2.4, normal: 1.3, color: '#857a6c' }), cap: pbr('caverock', { scale: 4, color: '#a69a88' }) },
    crypt: { wall: pbr('stonewall', { scale: 2.4, color: '#9c968c' }), floor: pbr('flagstone', { scale: 2.6, color: '#b0aca4' }), cap: pbr('stonewall', { scale: 2.4, color: '#9a948a' }) },
    lair: { wall: pbr('caverock', { scale: 3.4, normal: 1.6, color: '#94705e' }), floor: pbr('caverock', { scale: 2.4, normal: 1.3, color: '#6e5448' }), cap: pbr('caverock', { scale: 4, color: '#8a6e60' }) }
  };
  Object.values(mats).forEach(q => { cutaway(q.wall); cutaway(q.cap); q.cap.emissive = new THREE.Color('#5a524a'); q.cap.emissiveMap = q.cap.map; q.cap.emissiveIntensity = .55; });
  const ironM = pbr('iron', { scale: 1, metalness: .85, roughness: 1, color: '#6a6660' });
  const woodM = pbr('wood', { scale: 1.6, color: '#4a3a2c' });
  const marbleM = pbr('marble', { scale: 3, color: '#a7a298' });
  const boneM = new THREE.MeshStandardMaterial({ color: '#d8ccb0', roughness: .7 });

  const FL = FLOORS.map((F, fi) => {
    const OX = floorX(fi);
    const fg = new THREE.Group(); fg.position.x = OX; dg.add(fg);
    const W = (lx, lz) => [OX + lx, lz];
    // ---- visual SDF ----
    const V = new Float32Array(NG*NG), C = new Float32Array(NG*NG);
    for(let j = 0; j < NG; j++) for(let i = 0; i < NG; i++){
      const x = -HALF + i*CELL, z = -HALF + j*CELL;
      let d = -1e9; for(const s of F.shapes){ const v = sdShape(s, x, z); if(v > d) d = v; }
      if(F.style !== 'crypt') d += (fbm2(x*.09 + F.seed, z*.09 - F.seed, 3) - .5)*1.7 + (fbm2(x*.31 - F.seed, z*.31, 2) - .5)*.45 + .25;
      (F.pillars || []).forEach(p => { const v = Math.hypot(x - p[0], z - p[1]) - p[2] - (F.style !== 'crypt' ? (fbm2(x*.6, z*.6, 2) - .5)*.5 : 0); if(v < d) d = v; });
      if(i === 0 || j === 0 || i === NG - 1 || j === NG - 1) d = Math.min(d, -1);
      V[gi(i, j)] = d;
    }
    // ---- low obstacles (collision only) ----
    const lows = [];
    (F.cols || []).forEach(c => lows.push(['c', c[0], c[1], .62]));
    (F.sarc || []).forEach(s => lows.push(s[2] ? ['r', s[0], s[1], 2.7, 1.3] : ['r', s[0], s[1], 1.3, 2.7]));
    (F.lava || []).forEach(l => lows.push(['c', l[0], l[1], l[2] + .25]));
    let hole = null;
    if(F.down){ const [x, z] = F.down; hole = [x - 1.5, x + 1.5, z - 2.5, z + 1.5]; lows.push(['r', x, z - .5, 3.6, 4.6]); }
    // rubble / stalagmites near walls (scanned rock instances, added by main)
    const R = mulberry(F.seed*977 + 5);
    const nRock = F.style === 'crypt' ? 26 : 80;
    for(let k = 0, tries = 0; k < nRock && tries < 6000; tries++){
      const x = (R()*2 - 1)*(HALF - 2), z = (R()*2 - 1)*(HALF - 2); const v = sample(V, x, z);
      if(v < .15 || v > (F.style === 'crypt' ? .9 : 2.2)) continue;
      if(Math.hypot(x - F.start[0], z - F.start[1]) < 5 || (F.down && Math.hypot(x - F.down[0], z - F.down[1]) < 4.5) || (F.chest && Math.hypot(x - F.chest[0], z - F.chest[1]) < 4)) continue;
      const tall = F.style !== 'crypt' && k % 6 === 0;
      const s = F.style === 'crypt' ? .25 + R()*.35 : tall ? .55 + R()*.35 : .35 + R()*.9*Math.min(1, v);
      rockSpots.push({ x: OX + x, z, y: 0, s, r: R()*6.28, sy: tall ? 2.4 + R()*1.2 : .55 + R()*.4, v: k, sink: tall ? .1 : .2 });
      if(s > .6 || tall) lows.push(['c', x, z, s*(tall ? .45 : .55)]);
      k++;
    }
    for(let j = 0; j < NG; j++) for(let i = 0; i < NG; i++){
      const x = -HALF + i*CELL, z = -HALF + j*CELL; let d = V[gi(i, j)];
      for(const s of lows){ const v = -sdShape(s, x, z); if(v < d) d = v; }
      C[gi(i, j)] = d;
    }
    // ---- geometry ----
    const Mt = mats[F.style];
    const loops = contours(V);
    const walls = new THREE.Mesh(wallGeo(loops, V, F.style, F.seed), Mt.wall); walls.receiveShadow = true; walls.castShadow = false; walls.userData.keep = true; fg.add(walls);
    const cap = new THREE.Mesh(fillGeo(V, WALL_H, true, 9), Mt.cap); cap.userData.keep = true; fg.add(cap);
    const floor = new THREE.Mesh(fillGeo(V, 0, false, 0, hole), Mt.floor); floor.receiveShadow = true; floor.userData.keep = true; fg.add(floor);

    // ---- torches along the walls ----
    const torchSpots = [];
    loops.forEach(L => {
      let len = 0; for(let k = 1; k < L.length; k++) len += Math.hypot(L[k][0] - L[k - 1][0], L[k][1] - L[k - 1][1]);
      if(len < 14) return;
      const step = F.style === 'crypt' ? 8 : 9.5; let acc = step*.5;
      for(let k = 1; k < L.length; k++){ acc += Math.hypot(L[k][0] - L[k - 1][0], L[k][1] - L[k - 1][1]); if(acc >= step){ acc = 0; const [nx, nz] = grad(V, L[k][0], L[k][1]); torchSpots.push([L[k][0], L[k][1], nx, nz]); } }
    });
    torchSpots.forEach(([x, z, nx, nz], k) => {
      const g = new THREE.Group(); g.position.set(x + nx*.32, 0, z + nz*.32); g.rotation.y = Math.atan2(nx, nz); fg.add(g);
      g.add(boxM(.1, .34, .06, ironM, 0, 2.62, -.02)); g.add(boxM(.05, .05, .3, ironM, 0, 2.55, .12));
      g.add(cylM(.075, .045, .14, 8, ironM, 0, 2.66, .27)); g.add(rot(cylM(.032, .026, .46, 6, woodM, 0, 2.8, .27), 'x', .12));
      fires.push({ parent: g, x: 0, y: 3.02, z: .29, s: .5, color: '#ff8a3a' });
      const L = nightLight('#ff9550', 11, 16, x + nx*.9, 3.0, z + nz*.9, fg); L.userData.always = 1; L.userData.flicker = 1;
      const ph = k*1.7; anim.push(t => { L.userData.flicker = 1 + Math.sin(t*9 + ph)*.12 + Math.sin(t*23 + ph*3)*.06; });
    });

    // ---- per-style dressing ----
    const lights = (color, base, dist, x, y, z) => { const L = nightLight(color, base, dist, x, y, z, fg); L.userData.always = 1; return L; };
    if(F.style === 'cave'){
      (F.crystals || []).forEach(([cx, cz, col], k) => {
        // nudge onto the floor near a wall
        let x = cx, z = cz; for(let it = 0; it < 6; it++){ const v = sample(V, x, z); if(v > .4 && v < 1.6) break; const [gx, gz] = grad(V, x, z); x -= gx*(v - 1); z -= gz*(v - 1); }
        const cm = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, roughness: .15, metalness: .1 });
        const g = new THREE.Group(); g.position.set(x, 0, z); fg.add(g);
        for(let i = 0; i < 7; i++){ const h = .5 + R()*1.3; const c = mesh(new THREE.OctahedronGeometry(.18, 0), cm, (R() - .5)*.7, h*.45, (R() - .5)*.7); c.scale.set(1, h*2.6, 1); c.rotation.set((R() - .5)*.7, R()*6, (R() - .5)*.7); g.add(c); }
        lights(col, 4.5, 9, x, 1.2, z); glowSprite(col, 2.6, x, 1.0, z, fg, 1);
        lows.push(['c', x, z, .55]); C.forEach((v, q) => { const ii = q % NG, jj = (q - ii)/NG; const vx = -HALF + ii*CELL, vz = -HALF + jj*CELL; const dd = Math.hypot(vx - x, vz - z) - .55; if(dd < v) C[q] = dd; });
      });
      // glowing mushrooms
      const mm = new THREE.MeshStandardMaterial({ color: '#2a6a5a', emissive: '#3affc0', emissiveIntensity: .9, roughness: .5 });
      const stem = new THREE.MeshStandardMaterial({ color: '#c8c0a8', roughness: .8 });
      for(let k = 0, tries = 0; k < 26 && tries < 3000; tries++){ const x = (R()*2 - 1)*(HALF - 2), z = (R()*2 - 1)*(HALF - 2); const v = sample(C, x, z); if(v < .2 || v > .8) continue;
        const g = new THREE.Group(); g.position.set(x, 0, z); fg.add(g);
        for(let i = 0; i < 4; i++){ const h = .08 + R()*.18, r = .05 + R()*.09; const px = (R() - .5)*.4, pz = (R() - .5)*.4; g.add(cylM(.012, .016, h, 5, stem, px, h/2, pz)); const c = mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI*2, 0, Math.PI/2), mm, px, h, pz); c.scale.y = .6; g.add(c); }
        if(k % 3 === 0) glowSprite('#3affc0', .9, x, .25, z, fg, 1);
        k++; }
    }
    if(F.style === 'crypt'){
      (F.cols || []).forEach(([x, z]) => { const g = new THREE.Group(); g.position.set(x, 0, z); fg.add(g);
        g.add(boxM(1.15, .38, 1.15, marbleM, 0, .19, 0)); g.add(boxM(.95, .2, .95, marbleM, 0, .48, 0));
        const sh = new THREE.CylinderGeometry(.4, .44, 4.0, 18, 1); const sm = mesh(sh, marbleM, 0, 2.58, 0); g.add(sm);
        g.add(boxM(.95, .2, .95, marbleM, 0, 4.68, 0)); g.add(boxM(1.2, .3, 1.2, marbleM, 0, 4.88, 0)); });
      (F.sarc || []).forEach(([x, z, ry], k) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; fg.add(g);
        g.add(boxM(1.1, .78, 2.4, Mt.wall, 0, .39, 0)); g.add(boxM(1.24, .16, 2.56, marbleM, 0, .86, 0));
        const ef = mesh(new THREE.CapsuleGeometry(.2, 1.3, 4, 10), marbleM, 0, 1.05, 0); ef.rotation.x = Math.PI/2; ef.scale.set(1, 1, .55); g.add(ef);
        const hd = mesh(new THREE.SphereGeometry(.17, 12, 10), marbleM, 0, 1.08, -.86); g.add(hd);
        // candles
        for(let i = 0; i < 3; i++){ const cx = (i - 1)*.3, cz = 1.05; const h = .12 + R()*.14; g.add(cylM(.03, .03, h, 8, boneM, cx, .94 + h/2, cz)); }
        const wp = new THREE.Vector3(0, 1.25, 1.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry); glowSprite('#ffc070', .55, x + wp.x, 1.2, z + wp.z, fg, 1);
        if(k % 2 === 0) lights('#ffb060', 2.2, 6, x + wp.x, 1.5, z + wp.z); });
      // cobwebs in corners (high curvature points of the walls)
      const wm = new THREE.MeshBasicMaterial({ map: T.web, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: .55, fog: true });
      let webs = 0;
      loops.forEach(L => { for(let k = 2; k < L.length - 2 && webs < 18; k += 3){ const a = L[k - 2], b = L[k], c = L[k + 2]; const v1x = b[0] - a[0], v1z = b[1] - a[1], v2x = c[0] - b[0], v2z = c[1] - b[1]; const cr = v1x*v2z - v1z*v2x, dt = v1x*v2x + v1z*v2z; if(Math.abs(Math.atan2(cr, dt)) < .9 || R() < .55) continue;
        const [nx, nz] = grad(V, b[0], b[1]); const w = mesh(new THREE.PlaneGeometry(1.6, 1.6), wm, b[0] + nx*.55, WALL_H - .75, b[1] + nz*.55, false); w.rotation.set(-.5, Math.atan2(nx, nz) + Math.PI, Math.PI/4); w.userData.keep = true; fg.add(w); webs++; } });
    }
    if(F.style === 'lair'){
      const lm = new THREE.MeshStandardMaterial({ color: '#2a0600', emissive: '#ffffff', emissiveMap: T.lava, emissiveIntensity: .8, map: T.lava, roughness: .6 });
      (F.lava || []).forEach(([x, z, r], k) => {
        const d = mesh(new THREE.CircleGeometry(r, 40), lm, x, .035, z, false); d.rotation.x = -Math.PI/2; d.userData.keep = true; fg.add(d);
        const rim = mesh(new THREE.TorusGeometry(r + .05, .22, 8, 40), Mt.wall, x, .02, z); rim.rotation.x = Math.PI/2; rim.scale.z = .55; fg.add(rim);
        const L = lights('#ff6a1a', 7, 11, x, 1.2, z); L.userData.flicker = 1; anim.push(t => { L.userData.flicker = 1 + Math.sin(t*2.3 + k)*.15; });
        glowSprite('#ff5a10', r*1.7, x, .4, z, fg, 1);
        // embers
        const em = []; for(let i = 0; i < 6; i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#ffa040', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(.12); fg.add(s); em.push({ s, p: R()*3, a: R()*6.28, rr: R()*r }); }
        anim.push((t) => em.forEach(e => { const q = (t*.35 + e.p) % 3; e.s.position.set(x + Math.cos(e.a + q)*e.rr, .1 + q*1.4, z + Math.sin(e.a + q)*e.rr); e.s.material.opacity = Math.max(0, 1 - q/3); }));
      });
      anim.push((t, dt) => { T.lava.offset.x += (dt || .016)*.012; T.lava.offset.y += (dt || .016)*.007; });
      // boss arena seal
      const seal = mesh(new THREE.CircleGeometry(12.5, 64), new THREE.MeshBasicMaterial({ map: T.seal, color: '#7a2a14', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .3 }), 0, .03, -24, false);
      seal.rotation.x = -Math.PI/2; seal.userData.keep = true; fg.add(seal); anim.push(t => { seal.material.opacity = .22 + Math.sin(t*1.3)*.08; });
      // great fire-bowl hanging over the arena
      { const g = new THREE.Group(); g.position.set(0, 0, -24); fg.add(g);
        const bowl = mesh(new THREE.CylinderGeometry(1.1, .5, .6, 18, 1, true), ironM, 0, 6.2, 0); g.add(bowl);
        for(let i = 0; i < 4; i++){ const a = i/4*Math.PI*2 + .4; const ch = cylM(.025, .025, 4.2, 4, ironM, Math.cos(a)*.9, 8.6, Math.sin(a)*.9); ch.rotation.set(Math.sin(a)*.18, 0, -Math.cos(a)*.18); g.add(ch); }
        fires.push({ parent: g, x: 0, y: 6.45, z: 0, s: 1.6, color: '#ff7a2a' });
        const L = lights('#ff8a40', 26, 30, 0, 5.2, -24); L.userData.flicker = 1; anim.push(t => { L.userData.flicker = 1 + Math.sin(t*6.3)*.08 + Math.sin(t*17)*.05; }); }
      // braziers
      [[-8, 33], [8, 33], [-6, -9], [6, -9], [-16, -20], [16, -20], [-15, -33], [15, -33], [-4, -46], [4, -46]].forEach(([x, z]) => { let px = x, pz = z; if(sample(V, px, pz) < 1) return;
        const g = new THREE.Group(); g.position.set(px, 0, pz); fg.add(g);
        for(let i = 0; i < 3; i++){ const a = i/3*Math.PI*2; const l = rot(cylM(.03, .03, 1.1, 6, ironM, Math.cos(a)*.22, .55, Math.sin(a)*.22), 'z', Math.cos(a)*.2); l.rotation.x = Math.sin(a)*.2; g.add(l); }
        const bowl = mesh(new THREE.CylinderGeometry(.42, .2, .3, 14, 1, true), ironM, 0, 1.15, 0); bowl.material = ironM; g.add(bowl);
        g.add(mesh(new THREE.CircleGeometry(.4, 14), new THREE.MeshStandardMaterial({ color: '#2a0a04', emissive: '#ff4a10', emissiveIntensity: 1.2 }), 0, 1.22, 0).rotateX(-Math.PI/2));
        fires.push({ parent: g, x: 0, y: 1.3, z: 0, s: .9, color: '#ff7a2a' });
        const L = lights('#ff7a30', 8, 13, px, 2.0, pz); L.userData.flicker = 1; const ph = px*.3 + pz; anim.push(t => { L.userData.flicker = 1 + Math.sin(t*8 + ph)*.15 + Math.sin(t*19 + ph)*.07; });
        lows.push(['c', px, pz, .5]); C.forEach((v, q) => { const ii = q % NG, jj = (q - ii)/NG; const dd = Math.hypot(-HALF + ii*CELL - px, -HALF + jj*CELL - pz) - .5; if(dd < v) C[q] = dd; });
      });
      // skull piles & spikes
      for(let k = 0, tries = 0; k < 22 && tries < 3000; tries++){ const x = (R()*2 - 1)*(HALF - 2), z = (R()*2 - 1)*(HALF - 2); const v = sample(C, x, z); if(v < .2 || v > .9) continue;
        const g = new THREE.Group(); g.position.set(x, 0, z); fg.add(g);
        for(let i = 0; i < 5; i++){ const sk = mesh(new THREE.SphereGeometry(.12, 10, 8), boneM, (R() - .5)*.5, .1 + (i > 2 ? .16 : 0), (R() - .5)*.5); sk.scale.set(.9, 1, 1.15); sk.rotation.y = R()*6; g.add(sk); }
        for(let i = 0; i < 4; i++){ const b = mesh(new THREE.CapsuleGeometry(.03, .38, 3, 6), boneM, (R() - .5)*.7, .05, (R() - .5)*.7); b.rotation.set(Math.PI/2, R()*6, 0); g.add(b); }
        k++; }
      // horned skull trophy above the arena's north wall
      { let z = -41.5; const g = new THREE.Group(); g.position.set(0, 3.2, z); fg.add(g);
        const sk = mesh(new THREE.SphereGeometry(.6, 16, 12), boneM, 0, 0, 0); sk.scale.set(1, .85, 1.25); g.add(sk);
        [-1, 1].forEach(s => { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(s*.45, .2, 0), new THREE.Vector3(s*1.2, .45, .1), new THREE.Vector3(s*1.7, 1.1, .2), new THREE.Vector3(s*1.6, 1.7, .35)]); g.add(mesh(new THREE.TubeGeometry(curve, 16, .13, 8, false), boneM)); });
        [-1, 1].forEach(s => { const e = mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3a10' }), s*.22, .05, .62); e.userData.keep = true; g.add(e); }); }
    }

    // ---- entry rune circle (way up) ----
    { const [x, z] = F.up; const g = new THREE.Group(); g.position.set(x, 0, z); fg.add(g);
      const d = mesh(new THREE.CircleGeometry(1.5, 48), new THREE.MeshBasicMaterial({ map: T.rune, color: '#3a8aaa', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, .04, 0, false); d.rotation.x = -Math.PI/2; d.userData.keep = true; g.add(d);
      anim.push(t => { d.rotation.z = t*.25; d.material.opacity = .55 + Math.sin(t*2)*.15; });
      const L = lights('#7ad8ff', 4, 8, x, 1.4, z); void L; glowSprite('#7ad8ff', 2.4, x, .6, z, fg, 1);
      const motes = []; for(let i = 0; i < 10; i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#9fe8ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(.14); g.add(s); motes.push({ s, p: i/10*3, a: i*2.4 }); }
      anim.push(t => motes.forEach(m => { const q = (t*.5 + m.p) % 3; m.s.position.set(Math.cos(m.a + t*.4)*1.2, q*.9, Math.sin(m.a + t*.4)*1.2); m.s.material.opacity = Math.sin(q/3*Math.PI); }));
      dInter.push({ id: 'dun_up', floor: fi, name: fi === 0 ? 'Вихід на поверхню' : 'Підйом на ' + ['I', 'II'][fi - 1] + ' ярус', desc: '', door: new THREE.Vector3(OX + x, 0, z), group: g, labelY: 2.4, pos: new THREE.Vector3(OX + x, 0, z) });
    }
    // ---- stairs down ----
    if(F.down){ const [x, z] = F.down; const g = new THREE.Group(); g.position.set(x, 0, z); fg.add(g);
      const st = Mt.wall, dark = new THREE.MeshStandardMaterial({ color: '#050404', roughness: 1 });
      for(let i = 0; i < 9; i++){ const y = -.3 - i*.32; g.add(boxM(3, .32, .5, F.style === 'crypt' ? marbleM : st, 0, y + .16 - .16, 1.25 - i*.42 - .2)); }
      g.add(boxM(.3, 3.4, 4.4, st, -1.65, -1.7 + .0, -.5)); g.add(boxM(.3, 3.4, 4.4, st, 1.65, -1.7, -.5)); g.add(boxM(3.6, 3.4, .3, st, 0, -1.7, -2.65));
      g.add(boxM(3, .1, 3, dark, 0, -3.3, -1.4));
      // balustrade
      g.add(boxM(.3, .9, 4.2, F.style === 'crypt' ? marbleM : st, -1.75, .45, -.5)); g.add(boxM(.3, .9, 4.2, F.style === 'crypt' ? marbleM : st, 1.75, .45, -.5)); g.add(boxM(3.8, .9, .3, F.style === 'crypt' ? marbleM : st, 0, .45, -2.75));
      // sign post
      const sp = new THREE.Group(); sp.position.set(2.4, 0, 1.6); g.add(sp); sp.add(cylM(.06, .07, 2.2, 6, woodM, 0, 1.1, 0));
      const tx = canvasTexture(256, 96, (c, w, h) => { c.fillStyle = '#2a1e14'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a6a3a'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); c.fillStyle = '#f0d9a8'; c.font = 'bold 44px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('↓ ' + ['II', 'III'][fi] + ' ЯРУС', w/2, h/2 + 2); });
      const pl = mesh(new THREE.PlaneGeometry(.9, .34), new THREE.MeshStandardMaterial({ map: tx, roughness: .9 }), 0, 2.0, .05); pl.userData.keep = true; sp.add(pl);
      glowSprite('#ff7a3a', 3.2, x, -2.6, z - 1.4, fg, 1);
      dInter.push({ id: 'dun_down', floor: fi, name: 'Спуск на ' + ['II', 'III'][fi] + ' ярус', desc: '', door: new THREE.Vector3(OX + x, 0, z + 2.6), group: g, labelY: 2.8, pos: new THREE.Vector3(OX + x, 0, z) });
    }
    // ---- treasure chest (bottom floor) ----
    let chestGlow = null, chestLid = null;
    if(F.chest){ const [x, z] = F.chest; const g = new THREE.Group(); g.position.set(x, 0, z); fg.add(g);
      const gold = new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 1, roughness: .25 });
      g.add(boxM(1.6, .75, 1.0, woodM, 0, .38, 0)); [-.7, .7].forEach(s => g.add(boxM(.08, .78, 1.04, gold, s, .39, 0)));
      chestLid = new THREE.Group(); chestLid.position.set(0, .76, -.5); chestLid.userData.keepGroup = true; g.add(chestLid);
      const lidG = new THREE.CylinderGeometry(.5, .5, 1.6, 16, 1, false, 0, Math.PI); const lid = mesh(lidG, woodM, 0, 0, .5); lid.rotation.z = Math.PI/2; lid.scale.set(1, 1, 1); chestLid.add(lid);
      const band = mesh(new THREE.CylinderGeometry(.52, .52, .08, 16, 1, true, 0, Math.PI), gold, -.7, 0, .5); band.rotation.z = Math.PI/2; chestLid.add(band); const band2 = band.clone(); band2.position.x = .7; chestLid.add(band2);
      g.add(boxM(.22, .26, .06, gold, 0, .62, .52));
      chestGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#ffd27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); chestGlow.scale.setScalar(3.2); chestGlow.position.set(x, 1.0, z); fg.add(chestGlow);
      lights('#ffd27a', 3, 8, x, 2.2, z + 1.5);
      dInter.push({ id: 'dun_chest', floor: fi, name: 'Скарбниця Мінотавра', desc: '', door: new THREE.Vector3(OX + x, 0, z + 1.9), group: g, labelY: 2.4, pos: new THREE.Vector3(OX + x, 0, z) });
    }

    // ---- spawns (nudged onto free ground) ----
    F.spawns.forEach(([type, x, z, wander, dormant]) => {
      let px = x, pz = z; for(let it = 0; it < 6; it++){ const v = sample(C, px, pz); if(v >= 1.0) break; const [gx, gz] = grad(C, px, pz); px += gx*(1.05 - v); pz += gz*(1.05 - v); }
      spawns.push({ type, x: OX + px, z: pz, wander: wander != null ? wander : 4, dormant: !!dormant, dungeon: fi });
    });

    // ---- minimap image ----
    const mini = document.createElement('canvas'); mini.width = mini.height = NG; const mc = mini.getContext('2d'); const im = mc.createImageData(NG, NG);
    for(let j = 0; j < NG; j++) for(let i = 0; i < NG; i++){ const v = V[gi(i, j)], c = C[gi(i, j)], q = (j*NG + i)*4;
      let col = [0, 0, 0, 0];
      if(v >= 0){ col = v < .7 ? [140, 124, 104, 255] : c < 0 ? [86, 72, 58, 255] : [68, 58, 48, 255]; }
      else if(v > -1.2) col = [24, 20, 16, 255];
      im.data[q] = col[0]; im.data[q + 1] = col[1]; im.data[q + 2] = col[2]; im.data[q + 3] = col[3]; }
    (F.lava || []).forEach(([x, z, r]) => { for(let j = -Math.ceil(r/CELL); j <= Math.ceil(r/CELL); j++) for(let i = -Math.ceil(r/CELL); i <= Math.ceil(r/CELL); i++){ if(Math.hypot(i*CELL, j*CELL) > r) continue; const ii = Math.round((x + HALF)/CELL) + i, jj = Math.round((z + HALF)/CELL) + j; const q = (jj*NG + ii)*4; im.data[q] = 230; im.data[q + 1] = 90; im.data[q + 2] = 20; im.data[q + 3] = 255; } });
    mc.putImageData(im, 0, 0);
    return { F, OX, V, C, fg, mini, chestGlow, chestLid };
  });

  // merge static meshes per floor group (interactives become pick boxes)
  dg.updateMatrixWorld(true);
  FL.forEach((f, i) => { const its = dInter.filter(q => q.floor === i), pk = []; f.fg.position.x = 0; f.fg.updateMatrixWorld(true); mergeStatic(f.fg, its, pk); f.fg.position.x = f.OX; pk.forEach(p => dPick.push(p)); });
  dg.updateMatrixWorld(true);
  // the merged meshes don't need shadows (no sun underground)
  dg.traverse(m => { if(m.isMesh){ m.castShadow = false; } });

  // ---------------- surface entrance (in the Wild lands) ----------------
  buildEntrance();
  function buildEntrance(){
    const g = new THREE.Group(); const y0 = heightAt(ENTRY.x, ENTRY.z);
    g.position.set(ENTRY.x, y0, ENTRY.z); g.rotation.y = Math.PI/2; // faces +x (towards the meadow trail)
    const S = M.stone, SD = M.stoneDark;
    g.add(boxM(1.3, 5.6, 1.5, S, -2.4, 1.8, 0)); g.add(boxM(1.3, 5.6, 1.5, S, 2.4, 1.8, 0));
    g.add(boxM(6.4, 1.0, 1.8, SD, 0, 5.0, 0));
    { const em = new THREE.Group(); em.position.set(0, 5.0, .93); g.add(em); const gold = M.gold;
      const sh = new THREE.Shape(); sh.moveTo(-.38, .34); sh.lineTo(.38, .34); sh.lineTo(.38, -.05); sh.quadraticCurveTo(.3, -.32, 0, -.44); sh.quadraticCurveTo(-.3, -.32, -.38, -.05); sh.closePath();
      const sg2 = new THREE.ExtrudeGeometry(sh, { depth: .06, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 1 }); em.add(mesh(sg2, M.iron));
      [-1, 1].forEach(s2 => { const sw = boxM(.05, .62, .03, gold, 0, 0, .1); sw.rotation.z = s2*.7; em.add(sw); const gd = boxM(.2, .04, .04, gold, s2*-.16, -.19, .11); gd.rotation.z = s2*.7; em.add(gd); }); }
    // earth mound the passage is cut into
    { const mg = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI*2, 0, Math.PI/2); const mp = mg.attributes.position;
      for(let i = 0; i < mp.count; i++){ const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i); const n = 1 + (fbm2(x*2.1 + 4, z*2.1 + y*1.5, 3) - .5)*.35; mp.setXYZ(i, x*n, y*n, z*n); }
      mg.computeVertexNormals();
      const mm = mesh(mg, pbr('caverock', { scale: 3, color: '#6e6a58' }), 0, -.6, -4.2); mm.scale.set(7.6, 6.2, 6.4); g.add(mm);
      const tuft = mesh(mg, new THREE.MeshStandardMaterial({ color: '#3d4a26', roughness: 1 }), 0, 4.2, -5.2); tuft.scale.set(4.8, 1.6, 4.2); g.add(tuft); }
    g.add(boxM(4.0, 5.0, 4.0, M.dark, 0, 1.5, -2.3));
    for(let i = 0; i < 4; i++) g.add(boxM(3.5, .3, .55, SD, 0, .12 - i*.3, .45 - i*.5));
    g.add(boxM(3.5, .06, 3.5, M.dark, 0, -.9, -1.4));
    // braziers
    [-3.6, 3.6].forEach(s => { const b = new THREE.Group(); b.position.set(s, 0, 1.3); g.add(b);
      b.add(cylM(.12, .18, 1.0, 8, M.iron, 0, .5, 0)); const bowl = mesh(new THREE.CylinderGeometry(.42, .22, .32, 14, 1, true), M.iron, 0, 1.15, 0); b.add(bowl);
      fires.push({ parent: b, x: 0, y: 1.25, z: 0, s: .85, color: '#ff7a2a' });
      const wp = new THREE.Vector3(s, 1.9, 1.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y).add(g.position);
      const L = nightLight('#ff8a3a', 8, 12, wp.x, wp.y, wp.z); L.userData.always = .6; L.userData.flicker = 1; anim.push(t => { L.userData.flicker = 1 + Math.sin(t*9 + s)*.15; }); });
    // guild sign
    const sg = new THREE.Group(); sg.position.set(-3.4, 0, 3.2); sg.rotation.y = -.35; g.add(sg);
    sg.add(cylM(.08, .09, 2.6, 8, M.wood, -1.3, 1.3, 0)); sg.add(cylM(.08, .09, 2.6, 8, M.wood, 1.3, 1.3, 0));
    const tx = canvasTexture(640, 240, (c, w, h) => { c.fillStyle = '#2c2016'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c9a24a'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16);
      c.fillStyle = '#f2dcae'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 52px Georgia, serif'; c.fillText('ПІДЗЕМЕЛЛЯ', w/2, 70); c.font = 'bold 40px Georgia, serif'; c.fillText('АВАНТЮРИСТІВ', w/2, 124);
      c.font = 'italic 28px Georgia, serif'; c.fillStyle = '#d8b878'; c.fillText('Гільдія · три яруси · бос на дні', w/2, 186); });
    const board = mesh(new THREE.BoxGeometry(2.7, 1.0, .08), M.beam, 0, 2.0, 0); sg.add(board);
    const face = mesh(new THREE.PlaneGeometry(2.6, .95), new THREE.MeshStandardMaterial({ map: tx, roughness: .85 }), 0, 2.0, .045); face.userData.keep = true; sg.add(face);
    const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -.045; sg.add(back);
    world.add(g);
    // the hill around the mouth
    [[-4.6, -1.2, 3.4, .9], [4.6, -1.2, 3.4, .9], [0, -4.6, 5.2, .85], [-3.6, -5.0, 4.2, .9], [3.8, -4.6, 4.2, .9], [-6.4, -3.6, 2.6, .8], [6.6, -3.2, 2.8, .8], [0, -1.6, 2.6, .55], [-1.6, -8, 4, .8], [2.4, -8.5, 3.6, .8]].forEach(([lx, lz, s, sy], k) => {
      const x = ENTRY.x + lz, z = ENTRY.z - lx; surfaceRocks.push({ x, z, y: heightAt(x, z) + (lx === 0 && lz === -1.6 ? 4.6 : 0), s, r: k*1.3, sy, v: k + 3 }); });
    colliders.push({ type: 'rect', x: ENTRY.x - 2.5, z: ENTRY.z, hw: 5.5, hd: 4.0, ang: Math.PI/2, wild: true, h: y0 + 6 });
    { const sp = new THREE.Vector3(-3.4, 0, 3.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI/2); colliders.push({ type: 'rect', x: ENTRY.x + sp.x, z: ENTRY.z + sp.z, hw: 1.45, hd: .2, ang: Math.PI/2 - .35, wild: true }); }
    const door = new THREE.Vector3(ENTRY.x + 2.4, 0, ENTRY.z);
    o.interactives.push({ id: 'dun_enter', name: 'Підземелля Авантюристів', desc: '', door, group: g, labelY: y0 + 7, pos: new THREE.Vector3(ENTRY.x, 0, ENTRY.z), clear: 10 });
    // trail from the main road
    paint(c => { [[1.25, .25], [.9, .35], [.55, .5]].forEach(([k, a]) => { c.strokeStyle = `rgba(255,0,0,${a})`; c.lineCap = 'round'; c.lineWidth = 2.6*k; c.beginPath(); c.moveTo(0, 88); c.quadraticCurveTo(-14, 90, ENTRY.x + 3, ENTRY.z); c.stroke(); }); });
  }

  // ---------------- runtime queries ----------------
  const floorOf = x => FL[Math.max(0, Math.min(FL.length - 1, Math.round((x - DX0)/DSTEP)))];
  function sdf(x, z){ const f = floorOf(x); return sample(f.C, x - f.OX, z); }
  function vis(x, z){ const f = floorOf(x); return sample(f.V, x - f.OX, z); }
  function walkable(x, z, r){ return sdf(x, z) >= (r || 0); }
  function resolve(x, z, r){
    const f = floorOf(x); let lx = x - f.OX, lz = z;
    for(let k = 0; k < 4; k++){ const d = sample(f.C, lx, lz); if(d >= r) break; const [gx, gz] = grad(f.C, lx, lz); lx += gx*(r - d + .005); lz += gz*(r - d + .005); }
    return [lx + f.OX, lz];
  }
  // A* on a 1 m grid + string pulling
  const S2 = 1, NA = Math.floor((NG - 1)/S2) + 1;
  function findPath(x0, z0, x1, z1){
    const f = floorOf(x0); if(floorOf(x1) !== f) return [[x1, z1]];
    const ok = (i, j) => i >= 0 && j >= 0 && i < NA && j < NA && f.C[gi(i*S2, j*S2)] >= .42;
    const toN = (x, z) => [Math.round((x - f.OX + HALF)/(CELL*S2)), Math.round((z + HALF)/(CELL*S2))];
    const toW = (i, j) => [f.OX - HALF + i*CELL*S2, -HALF + j*CELL*S2];
    const near = ([i, j]) => { if(ok(i, j)) return [i, j]; for(let r = 1; r < 9; r++) for(let dj = -r; dj <= r; dj++) for(let di = -r; di <= r; di++){ if(ok(i + di, j + dj)) return [i + di, j + dj]; } return null; };
    const a = near(toN(x0, z0)), b = near(toN(x1, z1));
    if(!a || !b) return [resolve(x1, z1, .4)];
    const N = NA*NA, gS = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; const push = (k, p) => { heap.push([p, k]); let i = heap.length - 1; while(i > 0){ const pa = (i - 1) >> 1; if(heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if(heap.length){ heap[0] = last; let i = 0; for(;;){ const l = i*2 + 1, r = l + 1; let m = i; if(l < heap.length && heap[l][0] < heap[m][0]) m = l; if(r < heap.length && heap[r][0] < heap[m][0]) m = r; if(m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const H = (i, j) => { const dx = Math.abs(i - b[0]), dy = Math.abs(j - b[1]); return Math.max(dx, dy) + .414*Math.min(dx, dy); };
    const s0 = a[1]*NA + a[0], goal = b[1]*NA + b[0]; gS[s0] = 0; push(s0, H(a[0], a[1]));
    let found = false, it = 0;
    while(heap.length && it++ < 120000){ const [, k] = pop(); if(closed[k]) continue; closed[k] = 1; if(k === goal){ found = true; break; }
      const i = k % NA, j = (k - i)/NA;
      for(let dj = -1; dj <= 1; dj++) for(let di = -1; di <= 1; di++){ if(!di && !dj) continue; const ni = i + di, nj = j + dj; if(!ok(ni, nj)) continue; if(di && dj && (!ok(i + di, j) || !ok(i, j + dj))) continue;
        const nk = nj*NA + ni; const g2 = gS[k] + (di && dj ? 1.414 : 1); if(g2 < gS[nk]){ gS[nk] = g2; from[nk] = k; push(nk, g2 + H(ni, nj)); } } }
    if(!found) return [resolve(x1, z1, .4)];
    const nodes = []; for(let k = goal; k !== -1; k = from[k]){ const i = k % NA, j = (k - i)/NA; nodes.push(toW(i, j)); } nodes.reverse();
    nodes[nodes.length - 1] = resolve(x1, z1, .4);
    const los = (p, q) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.ceil(L/.35); for(let s = 1; s < n; s++){ const t = s/n; if(sdf(p[0] + (q[0] - p[0])*t, p[1] + (q[1] - p[1])*t) < .45) return false; } return true; };
    const out = []; let cur = [x0, z0], idx = 0;
    while(idx < nodes.length){ let far = idx; for(let k = nodes.length - 1; k > idx; k--){ if(los(cur, nodes[k])){ far = k; break; } } out.push(nodes[far]); cur = nodes[far]; idx = far + 1; }
    return out;
  }
  function camBlock(ax, ay, az, bx, by, bz){
    const N = 36;
    for(let s = 2; s <= N; s++){ const t = s/N; const x = ax + (bx - ax)*t, z = az + (bz - az)*t, y = ay + (by - ay)*t; if(y < WALL_H + .35 && vis(x, z) < .25) return Math.max(.06, t - 1.5/N); }
    return 1;
  }
  const startOf = i => { const f = FL[i]; return [f.OX + f.F.start[0], f.F.start[1]]; };
  return { group: dg, interactives: dInter, pickables: dPick, spawns, rockSpots, surfaceRocks, floors: FL, sdf, walkable, resolve, findPath, camBlock, startOf, floorIndex: x => FL.indexOf(floorOf(x)), HALF };
}

function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; }

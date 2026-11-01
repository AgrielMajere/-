import * as THREE from 'three';
import { Tree } from '../node_modules/@dgreenheck/ez-tree/src/lib/index.js';
import { loadModel, tex } from './assets.js';

import { vnoise, fbm2, heightAt, normalAt, ZONES, inWild, wildDist, zoneAt, FLAT_R, LAKE, SWAMP } from './world.js';
export { vnoise, fbm2, heightAt, ZONES, inWild, wildDist, zoneAt, FLAT_R };

// ---------- terrain: 64 m chunks with distance LOD + a coarse far ring ----------
const GROUND_VS_PARS = `varying vec3 vWPos; varying vec3 vWN;\n`;
const GROUND_FS_PARS = `
varying vec3 vWPos; varying vec3 vWN;
uniform sampler2D uMask, uMask2, uWMask, uGrass, uGrass2, uDirt, uDirtN, uCob, uCobN, uCobR, uRock, uRockN, uSand;
uniform float uMaskSize, uWMaskSize; uniform vec3 uMask2P; uniform vec4 uLake, uSwamp;
float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float gNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(gHash(i), gHash(i+vec2(1,0)), u.x), mix(gHash(i+vec2(0,1)), gHash(i+vec2(1,1)), u.x), u.y); }
float gFbm(vec2 p){ float v = 0.0, a = .5; for(int i=0;i<4;i++){ v += a*gNoise(p); p *= 2.07; a *= .5; } return v; }
`;
export function groundMaterial(town, wmask, m2){
  const mask = new THREE.CanvasTexture(town.canvas); mask.colorSpace = THREE.NoColorSpace; mask.flipY = false;
  const mk2 = new THREE.CanvasTexture(m2.canvas); mk2.colorSpace = THREE.NoColorSpace; mk2.flipY = false;
  const wm = new THREE.CanvasTexture(wmask.canvas); wm.colorSpace = THREE.NoColorSpace; wm.flipY = false;
  const grass = tex('grass.jpg', { srgb: true }), grass2 = tex('grass2.jpg', { srgb: true }), dirt = tex('dirt_c.jpg', { srgb: true }), dirtN = tex('dirt_n.jpg');
  const cob = tex('cobble_c.jpg', { srgb: true }), cobN = tex('cobble_n.jpg'), cobR = tex('cobble_r.jpg');
  const rock = tex('caverock_c.jpg', { srgb: true }), rockN = tex('caverock_n.jpg'), sand = tex('sandstone_c.jpg', { srgb: true });
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, normalMap: dirtN });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uMask: { value: mask }, uMask2: { value: mk2 }, uMask2P: { value: new THREE.Vector3(m2.x, m2.z, m2.size) }, uWMask: { value: wm }, uGrass: { value: grass }, uGrass2: { value: grass2 }, uDirt: { value: dirt }, uDirtN: { value: dirtN }, uCob: { value: cob }, uCobN: { value: cobN }, uCobR: { value: cobR }, uRock: { value: rock }, uRockN: { value: rockN }, uSand: { value: sand }, uLake: { value: new THREE.Vector4(LAKE.x, LAKE.z, LAKE.r, LAKE.level) }, uSwamp: { value: new THREE.Vector4(SWAMP.x, SWAMP.z, SWAMP.r, SWAMP.level) }, uMaskSize: { value: town.size }, uWMaskSize: { value: wmask.size } });
    sh.vertexShader = GROUND_VS_PARS + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWPos = (modelMatrix*vec4(transformed,1.0)).xyz; vWN = normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = GROUND_FS_PARS + sh.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 wp = vWPos.xz;
        vec2 muv = wp/uMaskSize + .5;
        vec4 mk = (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) ? texture2D(uMask, muv) : vec4(0.0);
        vec2 m2uv = (wp - uMask2P.xy)/uMask2P.z + .5;
        if(m2uv.x > 0.0 && m2uv.x < 1.0 && m2uv.y > 0.0 && m2uv.y < 1.0) mk = max(mk, texture2D(uMask2, m2uv));
        vec2 wuv = wp/uWMaskSize + .5;
        vec4 wk = (wuv.x > 0.0 && wuv.x < 1.0 && wuv.y > 0.0 && wuv.y < 1.0) ? texture2D(uWMask, wuv) : vec4(0.0);
        mk.r = max(mk.r, wk.r);
        float nB = gFbm(wp*.05);
        float nS = gFbm(wp*.45);
        vec3 gA = texture2D(uGrass, wp/7.0).rgb;
        vec3 gB = texture2D(uGrass2, wp/11.0 + .37).rgb;
        vec3 grassC = mix(gA, gB, smoothstep(.35, .7, nB));
        grassC *= mix(.78, 1.08, nS);
        grassC = mix(grassC, grassC*vec3(1.05, .92, .6), wk.b*.85);          // dry / swampy tint
        grassC = mix(grassC, grassC*vec3(.55, .62, .5), wk.g*.9);            // dark forest floor
        float slope = 1.0 - clamp(normalize(vWN).y, 0.0, 1.0);
        vec3 dirtC = texture2D(uDirt, wp/4.0).rgb;
        float dirtAmt = clamp(mk.r + smoothstep(.62, .8, nB)*.45*(1.0 - mk.g), 0.0, 1.0);
        float edgeN = gFbm(wp*1.3);
        dirtAmt = smoothstep(.25, .75, dirtAmt + (edgeN - .5)*.45);
        vec3 cobC = texture2D(uCob, wp/2.2).rgb*vec3(1.06, 1.0, .9);
        float cobAmt = smoothstep(.35, .6, mk.g + (edgeN - .5)*.25);
        vec3 col = mix(grassC, dirtC, dirtAmt);
        col = mix(col, cobC, cobAmt);
        float rockAmt = smoothstep(.28, .5, slope + (nS - .5)*.2) + smoothstep(30.0, 60.0, vWPos.y)*.8;
        rockAmt = clamp(rockAmt, 0.0, 1.0)*(1.0 - cobAmt);
        vec3 rockC = texture2D(uRock, wp/9.0).rgb*vec3(1.1, 1.05, 1.0);
        col = mix(col, rockC, rockAmt);
        float snow = smoothstep(120.0, 170.0, vWPos.y + (nB - .5)*40.0)*(1.0 - smoothstep(.55, .8, slope));
        col = mix(col, vec3(.86, .88, .92), snow);
        float nearLake = 1.0 - smoothstep(uLake.z*1.05, uLake.z*1.35, length(wp - uLake.xy));
        float shore = (1.0 - smoothstep(uLake.w + .1, uLake.w + 1.2, vWPos.y))*nearLake*(1.0 - cobAmt);
        vec3 sandC = texture2D(uSand, wp/5.0).rgb*vec3(.82, .76, .62);
        col = mix(col, mix(sandC, sandC*.55, smoothstep(-.5, -2.5, vWPos.y)), shore);
        float nearSw = 1.0 - smoothstep(uSwamp.z*.9, uSwamp.z*1.2, length(wp - uSwamp.xy));
        vec3 mudC = dirtC*vec3(.45, .42, .34);
        col = mix(col, mudC, nearSw*(1.0 - smoothstep(uSwamp.w - .05, uSwamp.w + .5, vWPos.y))*.85);
        diffuseColor.rgb *= col;
      `)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(mix(.95, texture2D(uCobR, wp/2.2).g, cobAmt), .55, snow*.6);`)
      .replace('#include <normal_fragment_maps>', `
        vec3 nD = texture2D(uDirtN, wp/4.0).xyz*2.0 - 1.0;
        vec3 nC = texture2D(uCobN, wp/2.2).xyz*2.0 - 1.0;
        vec3 nR = texture2D(uRockN, wp/9.0).xyz*2.0 - 1.0;
        vec3 mapN = normalize(mix(mix(mix(vec3(0,0,1), nD, max(dirtAmt, .25)), nC, cobAmt), nR, rockAmt*.9));
        mapN.xy *= normalScale;
        normal = normalize(tbn*mapN);
      `);
  };
  m.customProgramCacheKey = () => 'ground2';
  return m;
}

export function createTerrain(material, opts){
  opts = opts || {};
  const CH = 64, HALF = 576, NC = HALF*2/CH, group = new THREE.Group();
  const LODS = [32, 16, 8];
  const chunks = [];
  for(let j = 0; j < NC; j++) for(let i = 0; i < NC; i++) chunks.push({ x0: -HALF + i*CH, z0: -HALF + j*CH, geo: [null, null, null], lod: -1, mesh: null });
  function build(c, lod){
    const S = LODS[lod], st = CH/S, N1 = S + 1;
    const pos = new Float32Array((N1*N1 + S*4*2 + 8)*3), nrm = new Float32Array(pos.length), uv = new Float32Array(pos.length/3*2);
    const idx = []; let v = 0; const tmp = new THREE.Vector3();
    const put = (x, y, z) => { const n = normalAt(x, z, tmp); pos[v*3] = x; pos[v*3 + 1] = y; pos[v*3 + 2] = z; nrm[v*3] = n.x; nrm[v*3 + 1] = n.y; nrm[v*3 + 2] = n.z; uv[v*2] = x; uv[v*2 + 1] = z; return v++; };
    for(let jj = 0; jj <= S; jj++) for(let ii = 0; ii <= S; ii++){ const x = c.x0 + ii*st, z = c.z0 + jj*st; put(x, heightAt(x, z), z); }
    for(let jj = 0; jj < S; jj++) for(let ii = 0; ii < S; ii++){ const a = jj*N1 + ii, b = a + 1, cc = a + N1, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
    // skirts hide LOD cracks
    const edge = (list) => { const base = []; list.forEach(k => { base.push(put(pos[k*3], pos[k*3 + 1] - 4, pos[k*3 + 2])); }); for(let q = 0; q < list.length - 1; q++){ const a = list[q], b = list[q + 1], a2 = base[q], b2 = base[q + 1]; idx.push(a, b, a2, b, b2, a2, a, a2, b, b, a2, b2); } };
    const top = [], bot = [], lef = [], rig = []; for(let q = 0; q <= S; q++){ top.push(q); bot.push(S*N1 + q); lef.push(q*N1); rig.push(q*N1 + S); }
    edge(top); edge(bot); edge(lef); edge(rig);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v*3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm.subarray(0, v*3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv.subarray(0, v*2), 2));
    g.setIndex(idx); g.computeBoundingSphere();
    return g;
  }
  // far ring: 32 m grid outside the chunked square
  { const FS = 32, FH = 2400, n = FH*2/FS; const pos = [], idx = [], map = new Map(); const tmp = new THREE.Vector3();
    const vid = (i, j) => { const k = j*(n + 1) + i; if(map.has(k)) return map.get(k); const x = -FH + i*FS, z = -FH + j*FS; const h = heightAt(x, z) - (Math.max(Math.abs(x), Math.abs(z)) <= HALF + 1 ? 1.5 : 0); const nn = normalAt(x, z, tmp); pos.push(x, h, z, nn.x, nn.y, nn.z); map.set(k, pos.length/6 - 1); return pos.length/6 - 1; };
    for(let j = 0; j < n; j++) for(let i = 0; i < n; i++){ const x = -FH + i*FS, z = -FH + j*FS; if(x >= -HALF && x + FS <= HALF && z >= -HALF && z + FS <= HALF) continue; const a = vid(i, j), b = vid(i + 1, j), c = vid(i, j + 1), d = vid(i + 1, j + 1); idx.push(a, c, b, b, c, d); }
    const P = new Float32Array(pos.length/2), Nn = new Float32Array(pos.length/2), U = new Float32Array(pos.length/3); for(let q = 0; q < pos.length/6; q++){ P[q*3] = pos[q*6]; P[q*3 + 1] = pos[q*6 + 1]; P[q*3 + 2] = pos[q*6 + 2]; Nn[q*3] = pos[q*6 + 3]; Nn[q*3 + 1] = pos[q*6 + 4]; Nn[q*3 + 2] = pos[q*6 + 5]; U[q*2] = P[q*3]; U[q*2 + 1] = P[q*3 + 2]; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex(idx); g.computeBoundingSphere();
    const far = new THREE.Mesh(g, material); far.receiveShadow = false; group.add(far); }
  let lx = 1e9, lz = 1e9;
  function update(x, z, force){
    if(!force && Math.hypot(x - lx, z - lz) < 6) return 0; lx = x; lz = z;
    let built = 0;
    for(const c of chunks){
      const cx = c.x0 + CH/2, cz = c.z0 + CH/2, d = Math.max(0, Math.hypot(cx - x, cz - z) - CH*.71);
      const lod = d < 110 ? 0 : d < 300 ? 1 : 2;
      if(lod === c.lod) continue;
      if(!c.geo[lod]){ if(built > (force ? 999 : 3)){ lx = 1e9; continue; } c.geo[lod] = build(c, lod); built++; }
      c.lod = lod;
      if(!c.mesh){ c.mesh = new THREE.Mesh(c.geo[lod], material); c.mesh.receiveShadow = true; group.add(c.mesh); } else c.mesh.geometry = c.geo[lod];
    }
    return built;
  }
  return { group, update, chunks };
}

// ---------- wind shader injection ----------
export const wind = { time: { value: 0 }, strength: { value: 1 } };
function addWind(material, amount, useUvY){
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    if(prev) prev(sh, r);
    sh.uniforms.uWindT = wind.time; sh.uniforms.uWindS = wind.strength;
    sh.vertexShader = 'uniform float uWindT; uniform float uWindS;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float w = ${useUvY ? 'uv.y' : 'clamp(position.y, 0.0, 2.0)'};
        float ph = dot(ip.xz, vec2(.31, .23)) + position.x*.4;
        float s = sin(uWindT*1.6 + ph)*.6 + sin(uWindT*3.7 + ph*1.7)*.25 + sin(uWindT*7.3 + ph*2.3)*.1;
        transformed.x += s*w*${amount.toFixed(3)}*uWindS;
        transformed.z += cos(uWindT*1.3 + ph)*w*${(amount*.6).toFixed(3)}*uWindS;
      }`);
  };
  material.customProgramCacheKey = () => 'wind' + amount + useUvY;
}

// ---------- grass ----------
export async function createGrass(opts){
  const g = await loadModel('grass');
  const src = g.scene.getObjectByProperty('isMesh', true);
  const geo = src.geometry.clone();
  geo.computeBoundingBox(); const bb = geo.boundingBox;
  const hgt = bb.max.y - bb.min.y; const k = .42/hgt;
  geo.translate(0, -bb.min.y, 0); geo.scale(k*1.25, k, k*1.25);
  const mat = new THREE.MeshStandardMaterial({ map: src.material.map, alphaTest: .45, side: THREE.DoubleSide, roughness: .95, color: '#ffffff' });
  mat.map.colorSpace = THREE.SRGBColorSpace;
  addWind(mat, .09, false);
  const count = opts.count;
  const im = new THREE.InstancedMesh(geo, mat, count);
  const d = new THREE.Object3D(), c = new THREE.Color();
  let n = 0, tries = 0;
  while(n < count && tries < count*8){
    tries++;
    let x, z;
    if(opts.sample){ [x, z] = opts.sample(); } else { const a = Math.random()*Math.PI*2, r = Math.sqrt(Math.random())*opts.radius; x = Math.cos(a)*r; z = Math.sin(a)*r; }
    if(!opts.accept(x, z)) continue;
    const s = .7 + Math.random()*.8;
    d.position.set(x, heightAt(x, z) - .02, z); d.rotation.set(0, Math.random()*Math.PI*2, 0); d.scale.set(s, s*(.8 + Math.random()*.6), s);
    d.updateMatrix(); im.setMatrixAt(n, d.matrix);
    c.setRGB(.25 + Math.random()*.1, .3 + Math.random()*.3, .1); c.multiplyScalar(1.15); im.setColorAt(n, c);
    n++;
  }
  im.count = n; im.instanceMatrix.needsUpdate = true; if(im.instanceColor) im.instanceColor.needsUpdate = true;
  im.receiveShadow = true; im.castShadow = false; im.frustumCulled = false;
  return im;
}

// ---------- flowers ----------
export async function createFlowers(opts){
  const grp = new THREE.Group();
  for(const name of ['flower_white', 'flower_blue', 'flower_yellow']){
    const g = await loadModel(name);
    g.scene.updateMatrixWorld(true);
    const meshes = []; g.scene.traverse(o => { if(o.isMesh) meshes.push(o); });
    const box = new THREE.Box3().setFromObject(g.scene); const k = .32/(box.max.y - box.min.y);
    meshes.forEach(src => {
      const geo = src.geometry.clone(); geo.applyMatrix4(src.matrixWorld); geo.translate(0, -box.min.y, 0); geo.scale(k, k, k);
      const mt = new THREE.MeshStandardMaterial({ map: src.material.map || null, color: src.material.color, roughness: .8, side: THREE.DoubleSide, alphaTest: src.material.map ? .5 : 0 });
      addWind(mt, .25, false);
      const im = new THREE.InstancedMesh(geo, mt, opts.count); im.castShadow = false; im.receiveShadow = true;
      meshes.im = meshes.im || []; meshes.im.push(im); grp.add(im);
    });
    const ims = meshes.im; const d = new THREE.Object3D(); let n = 0, tries = 0;
    // clustered placement
    while(n < opts.count && tries < opts.count*10){
      tries++;
      let cx, cz;
      if(opts.sample){ [cx, cz] = opts.sample(); } else { const a = Math.random()*Math.PI*2, r = Math.sqrt(Math.random())*opts.radius; cx = Math.cos(a)*r; cz = Math.sin(a)*r; }
      for(let k2 = 0; k2 < 5 && n < opts.count; k2++){
        const x = cx + (Math.random() - .5)*1.6, z = cz + (Math.random() - .5)*1.6;
        if(!opts.accept(x, z)) continue;
        const s = .7 + Math.random()*.7;
        d.position.set(x, heightAt(x, z), z); d.rotation.set(0, Math.random()*6.28, 0); d.scale.setScalar(s); d.updateMatrix();
        ims.forEach(im => im.setMatrixAt(n, d.matrix)); n++;
      }
    }
    ims.forEach(im => { im.count = n; im.instanceMatrix.needsUpdate = true; });
  }
  return grp;
}

// ---------- streamed grass & flowers: cells around the hero are refilled as it moves ----------
export async function createField(opts){
  // opts: kind 'grass'|'flowers', k (instances per cell), rc (cell radius), accept(x,z), tint(x,z,color)
  const parts = [];
  if(opts.kind === 'grass'){
    const g = await loadModel('grass'); const src = g.scene.getObjectByProperty('isMesh', true);
    const geo = src.geometry.clone(); geo.computeBoundingBox(); const bb = geo.boundingBox; const k = .42/(bb.max.y - bb.min.y);
    geo.translate(0, -bb.min.y, 0); geo.scale(k*1.25, k, k*1.25);
    const mat = new THREE.MeshStandardMaterial({ map: src.material.map, alphaTest: .45, side: THREE.DoubleSide, roughness: .95 }); mat.map.colorSpace = THREE.SRGBColorSpace;
    addWind(mat, .09, false); parts.push({ geo, mat });
  } else {
    for(const name of ['flower_white', 'flower_blue', 'flower_yellow']){
      const g = await loadModel(name); g.scene.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(g.scene); const k = .32/(box.max.y - box.min.y);
      const sub = []; g.scene.traverse(o => { if(o.isMesh){ const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.translate(0, -box.min.y, 0); geo.scale(k, k, k); const mt = new THREE.MeshStandardMaterial({ map: o.material.map || null, color: o.material.color, roughness: .8, side: THREE.DoubleSide, alphaTest: o.material.map ? .5 : 0 }); addWind(mt, .25, false); sub.push({ geo, mat: mt }); } });
      parts.push({ group: sub });
    }
  }
  const CELL = opts.cell || 12, RC = opts.rc || 3, K = opts.k || 200, SL = (RC*2 + 1)*(RC*2 + 1), CAP = SL*K;
  const group = new THREE.Group(); const meshes = [];
  // grass: one mesh; flowers: each flower type gets an equal share of a cell
  parts.forEach((p, pi) => { (p.group || [p]).forEach(q => { const im = new THREE.InstancedMesh(q.geo, q.mat, CAP); im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; im.userData.pi = pi; if(opts.kind === 'grass') im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP*3).fill(1), 3); group.add(im); meshes.push(im); }); });
  const zero = new THREE.Matrix4().makeScale(0, 0, 0); meshes.forEach(im => { for(let i = 0; i < CAP; i++) im.setMatrixAt(i, zero); });
  const slots = new Array(SL).fill(null), cellSlot = new Map(); const d = new THREE.Object3D(), col = new THREE.Color();
  let lcx = 1e9, lcz = 1e9, kMul = 1;
  function fill(slot, ci, cj){
    let seed = (ci*73856093 ^ cj*19349663) >>> 0; const R = () => { seed = (seed*1664525 + 1013904223) >>> 0; return seed/4294967296; };
    const base = slot*K, kk = Math.round(K*kMul);
    meshes.forEach(im => { for(let i = 0; i < K; i++) im.setMatrixAt(base + i, zero); });
    let n = 0;
    for(let t = 0; t < kk*2 && n < kk; t++){
      let x, z;
      if(opts.kind === 'flowers'){ if(t % 6 === 0){ R.cx = (ci + R())*CELL; R.cz = (cj + R())*CELL; } x = R.cx + (R() - .5)*1.8; z = R.cz + (R() - .5)*1.8; }
      else { x = (ci + R())*CELL; z = (cj + R())*CELL; }
      if(!opts.accept(x, z, R)) continue;
      const s = opts.kind === 'grass' ? .7 + R()*.8 : .7 + R()*.7;
      d.position.set(x, heightAt(x, z) - .02, z); d.rotation.set(0, R()*Math.PI*2, 0); d.scale.set(s, s*(.8 + R()*.6), s); d.updateMatrix();
      if(opts.kind === 'grass'){ meshes[0].setMatrixAt(base + n, d.matrix); col.setRGB(.25 + R()*.1, .3 + R()*.3, .1).multiplyScalar(1.15); if(opts.tint) opts.tint(x, z, col); meshes[0].setColorAt(base + n, col); }
      else { const pi = (R()*parts.length)|0; meshes.forEach(im => { if(im.userData.pi === pi) im.setMatrixAt(base + n, d.matrix); }); }
      n++;
    }
  }
  function update(x, z, force){
    const cx = Math.floor(x/CELL), cz = Math.floor(z/CELL);
    if(!force && cx === lcx && cz === lcz) return; lcx = cx; lcz = cz;
    const need = new Set(); for(let j = -RC; j <= RC; j++) for(let i = -RC; i <= RC; i++) need.add((cx + i) + ',' + (cz + j));
    for(const [key, sl] of cellSlot){ if(!need.has(key)){ cellSlot.delete(key); slots[sl] = null; } }
    let dirty = false;
    for(const key of need){ if(cellSlot.has(key) && !force) continue; let sl = cellSlot.get(key); if(sl == null){ sl = slots.indexOf(null); if(sl < 0) continue; slots[sl] = key; cellSlot.set(key, sl); } const [ci, cj] = key.split(',').map(Number); fill(sl, ci, cj); dirty = true; }
    if(dirty) meshes.forEach(im => { im.instanceMatrix.needsUpdate = true; if(im.instanceColor) im.instanceColor.needsUpdate = true; });
  }
  return { group, update, setDensity(k){ kMul = k; update(lcx*CELL + 1, lcz*CELL + 1, true); } };
}

// ---------- rocks ----------
export async function rockSources(){
  const out = [];
  for(const name of ['rock1', 'rock2', 'rock3']){
    const g = await loadModel(name); const src = g.scene.getObjectByProperty('isMesh', true);
    src.updateMatrixWorld(true);
    const geo = src.geometry.clone(); geo.applyMatrix4(src.matrixWorld);
    geo.computeBoundingBox(); const b = geo.boundingBox; const s = 1/Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    geo.translate(-(b.min.x + b.max.x)/2, -b.min.y, -(b.min.z + b.max.z)/2); geo.scale(s, s, s);
    const mat = src.material.clone(); mat.envMapIntensity = .8;
    out.push({ geo, mat });
  }
  return out;
}
export function rockInstances(srcs, items){
  const grp = new THREE.Group(); const d = new THREE.Object3D();
  srcs.forEach((s, si) => {
    const mine = items.filter((it, i) => (it.v != null ? it.v : i) % srcs.length === si);
    if(!mine.length) return;
    const im = new THREE.InstancedMesh(s.geo, s.mat, mine.length);
    mine.forEach((it, i) => { d.position.set(it.x, (it.y != null ? it.y : heightAt(it.x, it.z)) - (it.sink || .15)*it.s, it.z); d.rotation.set(it.rx || 0, it.r || 0, it.rz || 0); d.scale.set(it.s*(it.sx || 1), it.s*(it.sy || .8), it.s*(it.sz || 1)); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.castShadow = true; im.receiveShadow = true; grp.add(im);
  });
  return grp;
}

// ---------- trees ----------
const TREE_TYPES = [
  { preset: 'Oak Medium', h: 11 }, { preset: 'Ash Medium', h: 12 }, { preset: 'Oak Medium', h: 10 },
  { preset: 'Pine Medium', h: 13 }, { preset: 'Oak Small', h: 7 }, { preset: 'Pine Small', h: 8 }, { preset: 'Bush 1', h: 1.8 }, { preset: 'Bush 2', h: 1.6 }, { preset: 'Oak Large', h: 21, leafScale: .8 }
];
function buildTreeVariant(t, seed, leafMul){
  const tree = new Tree();
  tree.loadPreset(t.preset);
  tree.options.seed = seed;
  tree.options.leaves.size *= (t.leafScale || .72); tree.options.leaves.count = Math.round(tree.options.leaves.count*(leafMul || 1.9)); if(leafMul && leafMul < 1.9) tree.options.leaves.size *= Math.sqrt(1.9/leafMul)*.9;
  tree.generate();
  const bg = tree.branchesMesh.geometry, lg = tree.leavesMesh.geometry;
  const box = new THREE.Box3().setFromObject(tree);
  const k = t.h/(box.max.y - box.min.y);
  bg.scale(k, k, k); lg.scale(k, k, k);
  const pm = tree.branchesMesh.material, lm = tree.leavesMesh.material;
  const bark = new THREE.MeshStandardMaterial({ map: pm.map, normalMap: pm.normalMap, roughnessMap: pm.roughnessMap, aoMap: pm.aoMap, color: pm.color, roughness: 1 });
  const leaves = new THREE.MeshStandardMaterial({ map: lm.map, color: lm.color.clone().multiplyScalar(.85), side: THREE.DoubleSide, alphaTest: .5, roughness: .75 });
  // two-sided foliage lighting: light leaves from both sides
  leaves.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(normal + vec3(0.0, .6, 0.0));'); };
  addWind(leaves, .18, true);
  bark.map && (bark.map.anisotropy = 8);
  return { bg, lg, bark, leaves, h: t.h, preset: t.preset };
}

export function createTrees(placements, variantsWanted, quality){
  // placements: [{x,z,s,r,type}] where type indexes TREE_TYPES
  const variants = {};
  const grp = new THREE.Group(); const d = new THREE.Object3D();
  const byType = {};
  placements.forEach(p => { (byType[p.type] = byType[p.type] || []).push(p); });
  Object.keys(byType).forEach(ti => {
    const t = TREE_TYPES[ti];
    const nv = Math.min(variantsWanted, byType[ti].length);
    for(let v = 0; v < nv; v++){
      const V = buildTreeVariant(t, 1000 + ti*37 + v*101);
      variants[ti + ':' + v] = V;
      const list = byType[ti].filter((_, i) => i % nv === v);
      const ib = new THREE.InstancedMesh(V.bg, V.bark, list.length), il = new THREE.InstancedMesh(V.lg, V.leaves, list.length);
      list.forEach((p, i) => { d.position.set(p.x, heightAt(p.x, p.z) - .1, p.z); d.rotation.set(0, p.r, 0); d.scale.setScalar(p.s); d.updateMatrix(); ib.setMatrixAt(i, d.matrix); il.setMatrixAt(i, d.matrix); });
      ib.castShadow = il.castShadow = true; ib.receiveShadow = il.receiveShadow = true;
      grp.add(ib, il);
    }
  });
  return { group: grp, variants };
}

// impostor billboards for the distant forest
export function createImpostorForest(renderer, variant, items){
  const W = 256, H = 512;
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  const sc = new THREE.Scene();
  sc.add(new THREE.AmbientLight('#ffffff', 1.2)); const dl = new THREE.DirectionalLight('#ffffff', 2.2); dl.position.set(.3, 1, .8); sc.add(dl);
  const t = new THREE.Group(); t.add(new THREE.Mesh(variant.bg, variant.bark), new THREE.Mesh(variant.lg, variant.leaves)); sc.add(t);
  const box = new THREE.Box3().setFromObject(t); const hw = Math.max(box.max.x - box.min.x, box.max.z - box.min.z)/2*1.05, hh = (box.max.y - box.min.y)*1.02;
  const cam = new THREE.OrthographicCamera(-hh/4, hh/4, hh, 0, -100, 100); cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0);
  const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevTM = renderer.toneMapping;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping; renderer.clear(); renderer.render(sc, cam);
  renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA); renderer.toneMapping = prevTM;
  const quadW = hh/2;
  const geo = new THREE.PlaneGeometry(quadW, hh); geo.translate(0, hh/2, 0);
  const mat = new THREE.MeshStandardMaterial({ map: rt.texture, alphaTest: .45, roughness: 1, side: THREE.DoubleSide, color: '#c9d2c0' });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>`)
      .replace('#include <project_vertex>', `
        vec3 ipos = instanceMatrix[3].xyz;
        float isc = length(instanceMatrix[0].xyz);
        vec3 toCam = normalize(vec3(cameraPosition.x - ipos.x, 0.0, cameraPosition.z - ipos.z));
        vec3 right = vec3(toCam.z, 0.0, -toCam.x);
        vec3 wp = ipos + right*position.x*isc + vec3(0.0, position.y*isc, 0.0);
        vec4 mvPosition = viewMatrix*vec4(wp, 1.0);
        gl_Position = projectionMatrix*mvPosition;`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        transformedNormal = normalize((viewMatrix*vec4(normalize(vec3(cameraPosition.x - instanceMatrix[3].x, 2.0, cameraPosition.z - instanceMatrix[3].z)), 0.0)).xyz);`);
  };
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((p, i) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, heightAt(p.x, p.z) - .2, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s)); im.setMatrixAt(i, m); });
  im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false;
  return im;
}
export { TREE_TYPES };

// ---------- forest with distance LOD (full trees near the hero, impostors far away) ----------
function makeImpostor(renderer, variant, capacity){
  const W = 256, H = 512;
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  const sc = new THREE.Scene();
  sc.add(new THREE.AmbientLight('#ffffff', 1.2)); const dl = new THREE.DirectionalLight('#ffffff', 2.2); dl.position.set(.3, 1, .8); sc.add(dl);
  const t = new THREE.Group(); t.add(new THREE.Mesh(variant.bg, variant.bark), new THREE.Mesh(variant.lg, variant.leaves)); sc.add(t);
  const box = new THREE.Box3().setFromObject(t); const hh = (box.max.y - box.min.y)*1.02;
  const cam = new THREE.OrthographicCamera(-hh/4, hh/4, hh, 0, -100, 100); cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0);
  const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevTM = renderer.toneMapping;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping; renderer.clear(); renderer.render(sc, cam);
  renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA); renderer.toneMapping = prevTM;
  const geo = new THREE.PlaneGeometry(hh/2, hh); geo.translate(0, hh/2, 0);
  const mat = new THREE.MeshStandardMaterial({ map: rt.texture, alphaTest: .45, roughness: 1, side: THREE.DoubleSide, color: '#c9d2c0' });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
        vec3 ipos = instanceMatrix[3].xyz; float isc = length(instanceMatrix[0].xyz);
        vec3 toCam = normalize(vec3(cameraPosition.x - ipos.x, 0.0, cameraPosition.z - ipos.z));
        vec3 right = vec3(toCam.z, 0.0, -toCam.x);
        vec3 wp = ipos + right*position.x*isc + vec3(0.0, position.y*isc, 0.0);
        vec4 mvPosition = viewMatrix*vec4(wp, 1.0); gl_Position = projectionMatrix*mvPosition;`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        transformedNormal = normalize((viewMatrix*vec4(normalize(vec3(cameraPosition.x - instanceMatrix[3].x, 2.0, cameraPosition.z - instanceMatrix[3].z)), 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'impostor';
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, capacity)); im.count = 0; im.frustumCulled = false;
  return im;
}

export function createForest(renderer, placements, opts){
  opts = opts || {};
  const group = new THREE.Group(); const d = new THREE.Object3D(); const M4 = new THREE.Matrix4();
  const byType = {}; placements.forEach(p => { (byType[p.type] = byType[p.type] || []).push(p); });
  const sets = []; const variants = {};
  Object.keys(byType).forEach(ti => {
    const dead = ti === 'dead';
    const t = dead ? { preset: 'Oak Medium', h: 10 } : TREE_TYPES[ti];
    const nv = Math.min(opts.variants || 2, byType[ti].length);
    for(let v = 0; v < nv; v++){
      const V = buildTreeVariant(t, 2000 + (dead ? 99 : +ti)*37 + v*101, opts.leaf);
      if(dead){ V.bark = V.bark.clone(); V.bark.color.set('#6a6258'); }
      variants[ti + ':' + v] = V;
      const list = byType[ti].filter((_, i) => i % nv === v).map(p => { d.position.set(p.x, heightAt(p.x, p.z) - .1, p.z); d.rotation.set(0, p.r, 0); d.scale.setScalar(p.s); d.updateMatrix(); return { p, m: d.matrix.clone() }; });
      const ib = new THREE.InstancedMesh(V.bg, V.bark, list.length); ib.castShadow = ib.receiveShadow = true; group.add(ib);
      let il = null; if(!dead){ il = new THREE.InstancedMesh(V.lg, V.leaves, list.length); il.castShadow = il.receiveShadow = true; group.add(il); }
      const isBush = /Bush/.test(t.preset);
      const imp = (!dead && !isBush) ? makeImpostor(renderer, V, list.length) : null; if(imp) group.add(imp);
      sets.push({ list, ib, il, imp, isBush, dead });
    }
  });
  let lx = 1e9, lz = 1e9;
  function update(x, z, force){
    if(!force && Math.hypot(x - lx, z - lz) < 4) return; lx = x; lz = z;
    const R = opts.nearR || 60;
    sets.forEach(S => {
      let n = 0, f = 0; const near = [];
      const cap = S.imp ? (opts.maxFull || 30) : 1e9;
      for(const it of S.list){
        const dd = Math.hypot(it.p.x - x, it.p.z - z);
        if(dd < R || !S.imp){ if(dd < (S.isBush ? R*.8 : 1e9)){ it.dd = dd; near.push(it); } }
        else { S.imp.setMatrixAt(f++, it.m); }
      }
      if(near.length > cap) near.sort((a, b) => a.dd - b.dd);
      near.forEach((it, k) => { if(k < cap){ S.ib.setMatrixAt(n, it.m); if(S.il) S.il.setMatrixAt(n, it.m); n++; } else S.imp.setMatrixAt(f++, it.m); });
      S.ib.count = n; S.ib.instanceMatrix.needsUpdate = true; if(S.il){ S.il.count = n; S.il.instanceMatrix.needsUpdate = true; }
      if(S.imp){ S.imp.count = f; S.imp.instanceMatrix.needsUpdate = true; }
      S.ib.computeBoundingSphere(); if(S.il) S.il.computeBoundingSphere();
    });
  }
  return { group, update, variants, setNear(r, mx){ opts.nearR = r; if(mx) opts.maxFull = mx; update(lx, lz, true); } };
}

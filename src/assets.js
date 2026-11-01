import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const BASE = () => (window.RITM_GAME_BASE || '');
// Binary models are shipped with a .wasm extension (some hosts refuse .glb uploads)
const MODEL_EXT = () => (window.RITM_GAME_MODEL_EXT || '.wasm');

const gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader();
const cache = new Map();

export function loadModel(name){
  const url = BASE() + 'models/' + name + MODEL_EXT();
  if(!cache.has(url)) cache.set(url, url.endsWith('.json')
    // model packed as JSON { glb: base64 } — decoded here, so no data: URLs are fetched
    ? fetch(url).then(r => { if(!r.ok) throw new Error(r.status + ' ' + url); return r.json(); }).then(j => new Promise((res, rej) => {
        const bin = atob(j.glb); const buf = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        gltf.parse(buf.buffer, '', res, rej); }))
    : new Promise((res, rej) => gltf.load(url, res, undefined, rej)));
  return cache.get(url);
}

let maxAniso = 8;
export function setAnisotropy(n){ maxAniso = n; }

const texCache = new Map();
export function tex(file, opts){
  opts = opts || {};
  const key = file + (opts.srgb ? ':s' : '') + ':' + (opts.repeat || 1);
  if(texCache.has(key)) return texCache.get(key);
  const t = texLoader.load(BASE() + 'tex/' + file, () => { pending.n--; if(pending.cb) pending.cb(); }, undefined, () => { pending.n--; });
  pending.n++;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if(opts.srgb) t.colorSpace = THREE.SRGBColorSpace;
  if(opts.repeat) t.repeat.set(opts.repeat, opts.repeat);
  texCache.set(key, t);
  return t;
}
export const pending = { n: 0, cb: null };

// PBR material from a generated texture set: <name>_c.jpg, _n.jpg, _r.jpg
// UVs in world meters are expected (see uvBox / uvCyl); `scale` = meters per texture tile.
const matCache = new Map();
export function pbr(name, o){
  o = o || {};
  const key = name + JSON.stringify(o);
  if(matCache.has(key)) return matCache.get(key);
  const s = 1/(o.scale || 2);
  const c = tex(name + '_c.jpg', { srgb: true, repeat: s }), n = tex(name + '_n.jpg', { repeat: s }), r = tex(name + '_r.jpg', { repeat: s });
  const m = new THREE.MeshStandardMaterial({
    map: c, normalMap: n, roughnessMap: r,
    normalScale: new THREE.Vector2(o.normal || 1, o.normal || 1),
    roughness: o.roughness != null ? o.roughness : 1, metalness: o.metalness || 0,
    color: o.color || '#ffffff', envMapIntensity: o.env != null ? o.env : 1
  });
  if(o.emissive){ m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity || 1; }
  matCache.set(key, m);
  return m;
}

// --- UV helpers: world-space (meters) UV projection so textures keep real-world scale ---
const _n = new THREE.Vector3();
export function uvBox(geo, ox, oy, oz){
  geo = geo.index ? geo.toNonIndexed() : geo;
  const p = geo.attributes.position, nr = geo.attributes.normal;
  const uv = new Float32Array(p.count*2);
  ox = ox || 0; oy = oy || 0; oz = oz || 0;
  for(let i = 0; i < p.count; i++){
    _n.fromBufferAttribute(nr, i);
    const x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i) + oz;
    const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
    let u, v;
    if(ay >= ax && ay >= az){ u = x; v = z; }
    else if(ax >= az){ u = z*Math.sign(_n.x || 1); v = y; }
    else { u = -x*Math.sign(_n.z || 1); v = y; }
    uv[i*2] = u; uv[i*2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
export function uvCyl(geo, radius){
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for(let i = 0; i < p.count; i++){
    const a = Math.atan2(p.getX(i), p.getZ(i));
    uv.setXY(i, (a/(Math.PI*2) + .5)*Math.PI*2*radius, p.getY(i));
  }
  uv.needsUpdate = true;
  return geo;
}

export function mesh(geo, material, x, y, z, cast){
  const m = new THREE.Mesh(geo, material);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = cast !== false; m.receiveShadow = true;
  return m;
}
export function boxM(w, h, d, material, x, y, z){ return mesh(uvBox(new THREE.BoxGeometry(w, h, d)), material, x, y, z); }
export function cylM(rt, rb, h, seg, material, x, y, z){ return mesh(uvCyl(new THREE.CylinderGeometry(rt, rb, h, seg), Math.max(rt, rb)), material, x, y, z); }

export function canvasTexture(w, h, draw){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}
export function softSprite(){
  if(softSprite.t) return softSprite.t;
  softSprite.t = canvasTexture(128, 128, (g, w, h) => { const im = g.createImageData(w, h); for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const dx = (x + .5)/w*2 - 1, dy = (y + .5)/h*2 - 1; const r = Math.min(1, Math.sqrt(dx*dx + dy*dy)); const a = Math.pow(1 - r, 2.6)*(1 - r*r); const i = (y*w + x)*4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(a*255); } g.putImageData(im, 0, 0); });
  softSprite.t.colorSpace = THREE.NoColorSpace;
  return softSprite.t;
}

export function rot(m, axis, v){ m.rotation[axis] = v; return m; }

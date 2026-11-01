import * as THREE from 'three';

export function rng(seed){
  let s = seed|0;
  return function(){
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function canvasTex(w, h, draw, repeat){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if(repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

const matCache = {};
export function mat(color, opts){
  const key = color + JSON.stringify(opts||{});
  if(matCache[key]) return matCache[key];
  const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .85, metalness: 0, flatShading: true }, opts||{}));
  matCache[key] = m;
  return m;
}
export function glow(color, intensity){
  return mat(color, { emissive: color, emissiveIntensity: intensity||1.2, flatShading: false });
}

export function box(w, h, d, m, x, y, z){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x||0, y||0, z||0);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
export function cyl(rt, rb, h, seg, m, x, y, z){
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x||0, y||0, z||0);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
export function sphere(r, m, x, y, z, detail){
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail==null?1:detail), m);
  mesh.position.set(x||0, y||0, z||0);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

export function radialSprite(color, size, opacity){
  const t = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
    gr.addColorStop(0, color); gr.addColorStop(.35, color.replace(')', ',.35)').replace('rgb(', 'rgba(')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: opacity==null?1:opacity }));
  s.scale.set(size, size, 1);
  return s;
}

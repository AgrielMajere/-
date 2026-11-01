import * as THREE from 'three';
import { pbr, softSprite } from './assets.js';

// Procedural PBR weapons & gear. Grip space: origin at the grip, +Y = blade/head direction.
const MAT = {};
function mats(){
  if(MAT.steel) return MAT;
  MAT.steel = new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 1, roughness: .26 });
  MAT.dsteel = new THREE.MeshStandardMaterial({ color: '#6e7076', metalness: 1, roughness: .38 });
  MAT.rust = new THREE.MeshStandardMaterial({ color: '#7a5a44', metalness: .7, roughness: .7 });
  MAT.gold = new THREE.MeshStandardMaterial({ color: '#e2b552', metalness: 1, roughness: .25 });
  MAT.bronze = new THREE.MeshStandardMaterial({ color: '#b07a3a', metalness: 1, roughness: .35 });
  MAT.leather = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: .8 });
  MAT.wood = pbr('wood', { scale: .5, color: '#9a7a5a' });
  MAT.darkwood = pbr('wood', { scale: .5, color: '#4a3a30' });
  MAT.bone = new THREE.MeshStandardMaterial({ color: '#e2d8c0', roughness: .6 });
  MAT.string = new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: .9 });
  return MAT;
}
function m(geo, mat, x, y, z){ const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; return o; }
function gem(color, r){ return m(new THREE.OctahedronGeometry(r || .05, 1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, roughness: .1, metalness: .2 })); }
function glow(color, size){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .8 })); s.scale.set(size, size, 1); return s; }

function blade(len, w, mat, opts){
  opts = opts || {};
  const s = new THREE.Shape();
  s.moveTo(-w/2, 0); s.lineTo(-w/2*(opts.taper || .92), len*.82); s.lineTo(0, len); s.lineTo(w/2*(opts.taper || .92), len*.82); s.lineTo(w/2, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: opts.thick || .012, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 1 });
  g.translate(0, 0, -(opts.thick || .012)/2);
  return m(g, mat);
}

const builders = {
  sword(o){ const M = mats(); const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(.018, .02, .2, 8), M.leather, 0, 0, 0));
    g.add(m(new THREE.SphereGeometry(.032, 10, 8), o.gold ? M.gold : M.dsteel, 0, -.12, 0));
    g.add(m(new THREE.BoxGeometry(.2, .03, .04), o.gold ? M.gold : M.dsteel, 0, .11, 0));
    const b = blade(o.len || .82, .055, o.mat || M.steel); b.position.y = .12; g.add(b);
    return g; },
  greatsword(o){ return builders.sword(Object.assign({ len: 1.25 }, o)); },
  dagger(o){ const M = mats(); const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(.015, .017, .12, 8), M.leather));
    g.add(m(new THREE.BoxGeometry(.1, .02, .03), M.dsteel, 0, .07, 0));
    const b = blade(.28, .04, M.steel, { taper: .7 }); b.position.y = .08; g.add(b); return g; },
  axe(o){ const M = mats(); const g = new THREE.Group(); const L = o.two ? 1.25 : .75;
    g.add(m(new THREE.CylinderGeometry(.022, .026, L, 8), M.wood, 0, L/2 - .15, 0));
    const s = new THREE.Shape(); s.moveTo(0, -.09); s.quadraticCurveTo(.12, -.12, .2, -.2); s.quadraticCurveTo(.27, 0, .2, .2); s.quadraticCurveTo(.12, .12, 0, .09); s.closePath();
    const hg = new THREE.ExtrudeGeometry(s, { depth: .02, bevelEnabled: true, bevelThickness: .008, bevelSize: .006, bevelSegments: 1 }); hg.translate(0, 0, -.01);
    const k = o.two ? 1.6 : 1;
    const h = m(hg, o.mat || M.steel, .02, L - .3, 0); h.scale.setScalar(k); h.rotation.y = Math.PI/2; g.add(h);
    if(o.two){ const h2 = m(hg, o.mat || M.steel, -.02, L - .3, 0); h2.scale.setScalar(k); h2.rotation.y = -Math.PI/2; g.add(h2); }
    return g; },
  mace(o){ const M = mats(); const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(.02, .022, .6, 8), M.leather, 0, .15, 0));
    g.add(m(new THREE.SphereGeometry(.06, 12, 10), o.gold ? M.gold : M.dsteel, 0, .5, 0));
    for(let i = 0; i < 6; i++){ const f = m(new THREE.BoxGeometry(.018, .14, .08), o.gold ? M.gold : M.steel, 0, .5, 0); f.rotation.y = i/6*Math.PI; f.translateZ(.05); g.add(f); }
    return g; },
  club(){ const M = mats(); const g = new THREE.Group(); const c = new THREE.CylinderGeometry(.06, .025, .6, 8); g.add(m(c, M.darkwood, 0, .22, 0));
    for(let i = 0; i < 5; i++){ const sp = m(new THREE.ConeGeometry(.012, .06, 5), M.rust, 0, .35 + i*.04, 0); sp.rotation.z = Math.PI/2; sp.rotation.y = i*1.3; sp.translateY(.05); g.add(sp); } return g; },
  staff(o){ const M = mats(); const g = new THREE.Group(); const L = 1.7;
    const pts = []; for(let i = 0; i <= 10; i++){ const t = i/10; pts.push(new THREE.Vector3(Math.sin(t*5)*.012, -.55 + t*L, Math.cos(t*4)*.01)); }
    g.add(m(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .022, 7), M.darkwood));
    if(o.skull){ const sk = m(new THREE.SphereGeometry(.07, 12, 10), M.bone, 0, L - .5, 0); sk.scale.set(1, 1.1, 1.05); g.add(sk); [-1, 1].forEach(s => g.add(m(new THREE.SphereGeometry(.016, 8, 6), new THREE.MeshStandardMaterial({ color: '#000', emissive: o.color || '#8a3aff', emissiveIntensity: 3 }), s*.026, L - .49, .06))); }
    else { for(let i = 0; i < 4; i++){ const pr = m(new THREE.ConeGeometry(.012, .2, 5), M.darkwood, 0, L - .58, 0); pr.rotation.z = .5; pr.rotation.y = i*Math.PI/2; pr.translateY(.08); g.add(pr); } const gm = gem(o.color || '#5ac8ff', .07); gm.position.y = L - .45; g.add(gm); }
    const gl = glow(o.color || '#5ac8ff', .5); gl.position.y = L - .45; g.add(gl); g.userData.glow = gl;
    return g; },
  scepter(o){ const M = mats(); const g = new THREE.Group();
    g.add(m(new THREE.CylinderGeometry(.016, .02, .55, 8), M.gold, 0, .12, 0));
    g.add(m(new THREE.TorusGeometry(.07, .012, 8, 20), M.gold, 0, .47, 0));
    const gm = gem(o.color || '#ffe9a0', .045); gm.position.y = .47; g.add(gm); const gl = glow('#ffe9a0', .4); gl.position.y = .47; g.add(gl);
    return g; },
  bow(){ const M = mats(); const g = new THREE.Group();
    const pts = []; for(let i = 0; i <= 16; i++){ const t = i/16*2 - 1; pts.push(new THREE.Vector3(0, t*.72, -(1 - t*t)*.16 + Math.pow(Math.abs(t), 6)*.05)); }
    const c = new THREE.CatmullRomCurve3(pts); const tg = new THREE.TubeGeometry(c, 40, .016, 6);
    const pp = tg.attributes.position; // taper towards the tips
    g.add(m(tg, M.darkwood));
    g.add(m(new THREE.CylinderGeometry(.022, .022, .14, 8), M.leather));
    const sg = new THREE.BufferGeometry().setFromPoints([pts[0], pts[16]]);
    const str = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: '#ddd5c4' })); g.add(str);
    return g; },
  shield(o){ const M = mats(); const g = new THREE.Group();
    if(o.kite){ const s = new THREE.Shape(); s.moveTo(-.25, .3); s.lineTo(.25, .3); s.quadraticCurveTo(.27, -.1, 0, -.42); s.quadraticCurveTo(-.27, -.1, -.25, .3);
      const geo = new THREE.ExtrudeGeometry(s, { depth: .03, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 2 });
      g.add(m(geo, new THREE.MeshStandardMaterial({ color: o.color || '#e8e4dc', roughness: .5, metalness: .3 })));
      const cr = new THREE.MeshStandardMaterial({ color: o.trim || '#c9a040', metalness: 1, roughness: .3 });
      g.add(m(new THREE.BoxGeometry(.06, .5, .02), cr, 0, -.02, .05), m(new THREE.BoxGeometry(.32, .06, .02), cr, 0, .1, .05));
    } else {
      const disc = m(new THREE.CylinderGeometry(.33, .33, .035, 28), pbr('wood', { scale: .4, color: o.color || '#8a6a4a' })); disc.rotation.x = Math.PI/2; g.add(disc);
      const rim = m(new THREE.TorusGeometry(.33, .02, 8, 32), M.dsteel); g.add(rim);
      g.add(m(new THREE.SphereGeometry(.07, 14, 10, 0, Math.PI*2, 0, Math.PI/2), M.steel, 0, 0, .02)).children;
      g.children[g.children.length - 1].rotation.x = Math.PI/2;
    }
    return g; }
};

export function buildWeapon(type, o){ const b = builders[type]; return b ? b(o || {}) : null; }

// Cape hanging from the upper back (rigid, sways procedurally)
export function buildCape(color, len){
  const L = len || 1.1;
  const geo = new THREE.PlaneGeometry(.46, L, 6, 10);
  const p = geo.attributes.position;
  for(let i = 0; i < p.count; i++){ const y = p.getY(i), x = p.getX(i); const t = Math.max(0, Math.min(1, (L/2 - y)/L)); p.setX(i, x*(1 + t*.45)); p.setZ(i, -Math.pow(t, 1.5)*.12 - Math.cos(x*5)*.02*t); p.setY(i, y - L/2); }
  geo.computeVertexNormals();
  const mat = pbr('plaster', { scale: .6, color: color });
  const c = new THREE.Color(color); const hsl = {}; c.getHSL(hsl); if(hsl.l > .55) c.setHSL(hsl.h, hsl.s, .55);
  const mm = new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide, normalMap: mat.normalMap, normalScale: new THREE.Vector2(.8, .8), envMapIntensity: .5 });
  const cape = new THREE.Mesh(geo, mm); cape.castShadow = true;
  return cape;
}
export function buildWizardHat(color){
  const g = new THREE.Group(); const mt = new THREE.MeshStandardMaterial({ color, roughness: .85, side: THREE.DoubleSide });
  g.add(m(new THREE.CylinderGeometry(.3, .3, .015, 28), mt));
  const pts = []; for(let i = 0; i <= 12; i++){ const t = i/12; pts.push(new THREE.Vector3(Math.sin(t*1.4)*.08, t*.42, 0)); }
  const cone = new THREE.ConeGeometry(.14, .45, 20, 6, true); const cp = cone.attributes.position;
  for(let i = 0; i < cp.count; i++){ const y = cp.getY(i) + .225; cp.setX(i, cp.getX(i) - Math.pow(y/.45, 2.2)*.09); }
  cone.computeVertexNormals();
  g.add(m(cone, mt, 0, .225, 0));
  g.add(m(new THREE.TorusGeometry(.135, .018, 6, 24), new THREE.MeshStandardMaterial({ color: '#c9a040', metalness: .8, roughness: .35 }), 0, .03, 0)).children;
  g.children[g.children.length - 1].rotation.x = Math.PI/2;
  return g;
}
export function buildHood(color){
  const g = new THREE.SphereGeometry(.15, 18, 12, 0, Math.PI*2, 0, Math.PI*.62); g.scale(1, 1.12, 1.18);
  const h = m(g, new THREE.MeshStandardMaterial({ color, roughness: .9, side: THREE.DoubleSide })); h.rotation.x = -.25; return h;
}
export function buildCrown(color){
  const g = new THREE.Group(); const mt = new THREE.MeshStandardMaterial({ color: color || '#e2b552', metalness: 1, roughness: .25 });
  g.add(m(new THREE.CylinderGeometry(.13, .12, .07, 24, 1, true), mt));
  for(let i = 0; i < 8; i++){ const a = i/8*Math.PI*2; const sp = m(new THREE.ConeGeometry(.022, .09, 6), mt, Math.cos(a)*.125, .07, Math.sin(a)*.125); g.add(sp); }
  const gm = gem('#ff3a4a', .025); gm.position.set(0, .01, .125); g.add(gm);
  return g;
}
export { mats as weaponMaterials };

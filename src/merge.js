import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Bakes static meshes of `root` into one mesh per material (fewer draw calls).
// Meshes with userData.keep, transparent/array/basic materials and anything under a
// userData.keepGroup ancestor stay untouched. Interactive groups are replaced by invisible pick boxes.
export function mergeStatic(root, interactives, pickables, cell){
  root.updateMatrixWorld(true);
  // pick proxies first (use bounds of the original geometry)
  pickables.length = 0;
  interactives.forEach(info => {
    const b = new THREE.Box3().setFromObject(info.group), c = new THREE.Vector3(), s = new THREE.Vector3();
    b.getCenter(c); b.getSize(s);
    const p = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z), new THREE.MeshBasicMaterial({ visible: false }));
    p.position.copy(c); p.userData.interact = info; p.userData.proxy = true; root.add(p); pickables.push(p);
  });
  root.updateMatrixWorld(true);
  const buckets = new Map(), remove = [];
  root.traverse(o => {
    if(!o.isMesh || o.isInstancedMesh || o.userData.proxy || o.userData.keep) return;
    const m = o.material;
    if(Array.isArray(m) || !m.isMeshStandardMaterial || m.transparent) return;
    for(let a = o.parent; a; a = a.parent){ if(a.userData && a.userData.keepGroup) return; }
    if(!o.geometry.attributes.position) return;
    let g = o.geometry.clone();
    if(g.index) g = g.toNonIndexed();
    g.applyMatrix4(o.matrixWorld);
    Object.keys(g.attributes).forEach(k => { if(k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); });
    if(!g.attributes.uv){ g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2), 2)); }
    if(!g.attributes.normal) g.computeVertexNormals();
    let key = m;
    if(cell){ g.computeBoundingSphere(); const c = g.boundingSphere.center; key = m.uuid + ':' + Math.floor(c.x/cell) + ':' + Math.floor(c.z/cell); }
    let list = buckets.get(key); if(!list){ list = []; list.mat = m; buckets.set(key, list); }
    list.push(g); remove.push(o);
  });
  remove.forEach(o => { if(o.parent) o.parent.remove(o); });
  const out = [];
  buckets.forEach((list) => {
    const m = list.mat;
    const merged = mergeGeometries(list, false);
    if(!merged) return;
    const mesh = new THREE.Mesh(merged, m); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); merged.computeBoundingSphere(); out.push(mesh);
    list.forEach(g => g.dispose());
  });
  return out;
}

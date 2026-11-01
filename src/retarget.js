import * as THREE from 'three';

// World-space retargeting between humanoid skeletons.
// Bones are matched by a canonical key (Mixamo naming). Sources/targets may use
// Mixamo / Ready Player Me names (with or without "mixamorig") or the KayKit rig
// (hips, spine, chest, upperarm.l …). Each target bone is first swung so its rest
// direction matches the source rest direction (handles T-pose vs A-pose), then the
// source's world-rotation delta (frame vs. rest) is applied on top.

export const CANON = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
// direction child used for swing alignment
const DIR = { Hips: 'Spine', Spine: 'Spine2', Spine2: 'Head', Head: null, LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand',
  LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase' };
const KAYKIT = { Hips: 'hips', Spine: 'spine', Spine2: 'chest', Head: 'head', LeftArm: 'upperarml', LeftForeArm: 'lowerarml', LeftHand: 'wristl', RightArm: 'upperarmr', RightForeArm: 'lowerarmr', RightHand: 'wristr',
  LeftUpLeg: 'upperlegl', LeftLeg: 'lowerlegl', LeftFoot: 'footl', LeftToeBase: 'toesl', RightUpLeg: 'upperlegr', RightLeg: 'lowerlegr', RightFoot: 'footr', RightToeBase: 'toesr' };

function findBones(root){
  const names = new Map(); root.traverse(o => { if(o.name && !names.has(o.name)) names.set(o.name, o); });
  const out = new Map();
  if(names.has('hips') && names.has('upperarml')){ for(const [k, n] of Object.entries(KAYKIT)) if(names.has(n)) out.set(k, names.get(n)); return out; }
  for(const k of CANON){
    let o = null;
    for(const [n, ob] of names){ if(n === k || n === 'mixamorig' + k || n === 'mixamorig:' + k){ o = ob; break; } }
    if(o) out.set(k, o);
  }
  return out;
}
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

function restInfo(root){
  root.updateMatrixWorld(true);
  const map = findBones(root), info = new Map();
  map.forEach((o, k) => info.set(k, { o, wq: o.getWorldQuaternion(new THREE.Quaternion()), wp: o.getWorldPosition(new THREE.Vector3()) }));
  info.forEach((v, k) => { const c = DIR[k]; if(c && info.has(c)){ const d = info.get(c).wp.clone().sub(v.wp); v.dir = d.lengthSq() > 1e-12 ? d.normalize() : null; } });
  return info;
}

export function bakeRetarget(clip, sourceRoot, targetRoot, opts){
  opts = opts || {};
  const fps = opts.fps || 30;
  const S = restInfo(sourceRoot), T = restInfo(targetRoot);
  const keys = [...T.keys()].filter(k => S.has(k));
  const tT = new Map();
  if(opts.srcRef && opts.tgtRef){
    // reference-pose mode: source pose `srcRef` corresponds to target pose `tgtRef`
    const poseWorld = (root, clipR, time, info) => { const mx = new THREE.AnimationMixer(root); const a = mx.clipAction(clipR); a.play(); mx.setTime(time || 0); root.updateMatrixWorld(true); const out = new Map(); info.forEach((v, k) => out.set(k, { wq: v.o.getWorldQuaternion(new THREE.Quaternion()), wp: v.o.getWorldPosition(new THREE.Vector3()) })); a.stop(); mx.uncacheRoot(root); return out; };
    const restS = snapshotRest(sourceRoot), restT = snapshotRest(targetRoot);
    const sr = poseWorld(sourceRoot, opts.srcRef.clip, opts.srcRef.time, S); restS();
    const tr = poseWorld(targetRoot, opts.tgtRef.clip, opts.tgtRef.time, T); restT(); targetRoot.updateMatrixWorld(true); sourceRoot.updateMatrixWorld(true);
    keys.forEach(k => { S.get(k).wq = sr.get(k).wq; tT.set(k, tr.get(k).wq); });
    S.get('Hips').wp = sr.get('Hips').wp; T.get('Hips').wpRef = tr.get('Hips').wp;
  } else keys.forEach(k => {
    const s = S.get(k), t = T.get(k);
    let q = t.wq.clone();
    if(s.dir && t.dir){ q = new THREE.Quaternion().setFromUnitVectors(t.dir, s.dir).multiply(q); }
    tT.set(k, q);
  });
  // every target bone in hierarchy order (mapped or not)
  const order = []; const isT = new Set([...T.values()].map(t => t.o));
  const keyOf = new Map([...T.entries()].map(([k, t]) => [t.o, k]));
  const tHips = T.get('Hips').o;
  tHips.traverse(o => order.push(o));
  const sH = S.get('Hips'), tH = T.get('Hips');
  const ratio = tH.wp.y/Math.max(1e-6, sH.wp.y);

  const mixer = new THREE.AnimationMixer(sourceRoot);
  const action = mixer.clipAction(clip); action.play();
  const n = Math.max(2, Math.round(clip.duration*fps) + 1);
  const times = new Float32Array(n);
  const qv = new Map(); keys.forEach(k => qv.set(k, new Float32Array(n*4)));
  const hp = new Float32Array(n*3);
  const world = new Map();
  const hipsParentW = tHips.parent.getWorldQuaternion(new THREE.Quaternion());
  for(let i = 0; i < n; i++){
    const t = Math.min(clip.duration, i/fps); times[i] = t;
    mixer.setTime(t); sourceRoot.updateMatrixWorld(true);
    world.clear();
    for(const o of order){
      const pw = o === tHips ? hipsParentW : world.get(o.parent);
      let w;
      const k = keyOf.get(o);
      if(k && tT.has(k)){ const s = S.get(k); s.o.getWorldQuaternion(_q); _q2.copy(s.wq).invert(); w = _q.clone().multiply(_q2).multiply(tT.get(k)); }
      else w = pw.clone().multiply(o.quaternion);
      world.set(o, w);
      if(k && qv.has(k)) pw.clone().invert().multiply(w).toArray(qv.get(k), i*4);
    }
    sH.o.getWorldPosition(_v); _v.sub(sH.wp).multiplyScalar(ratio);
    hp[i*3] = _v.x; hp[i*3 + 1] = _v.y; hp[i*3 + 2] = _v.z;
  }
  action.stop(); mixer.uncacheRoot(sourceRoot);
  const x0 = hp[0], z0 = hp[2], xN = hp[(n - 1)*3], zN = hp[(n - 1)*3 + 2];
  tHips.parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(tHips.parent.matrixWorld).invert();
  const pos = new Float32Array(n*3);
  for(let i = 0; i < n; i++){
    const k = i/(n - 1);
    const dx = opts.keepRoot ? hp[i*3] : hp[i*3] - (x0 + (xN - x0)*k), dz = opts.keepRoot ? hp[i*3 + 2] : hp[i*3 + 2] - (z0 + (zN - z0)*k);
    const base = tH.wpRef || tH.wp;
    _v2.set(base.x + dx, base.y + hp[i*3 + 1]*(opts.ySquash || 1), base.z + dz).applyMatrix4(inv); _v2.toArray(pos, i*3);
  }
  const tracks = [];
  qv.forEach((arr, k) => tracks.push(new THREE.QuaternionKeyframeTrack(T.get(k).o.name + '.quaternion', times, arr)));
  tracks.push(new THREE.VectorKeyframeTrack(tHips.name + '.position', times, pos));
  return new THREE.AnimationClip(opts.name || clip.name, clip.duration, tracks);
}

export function snapshotRest(root){ const m = []; root.traverse(o => m.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()])); return () => m.forEach(([o, p, q, s]) => { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }); }
export function findBone(root, key){ return findBones(root).get(key); }

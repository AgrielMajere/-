import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadModel, softSprite } from './assets.js';
import { bakeRetarget, snapshotRest, findBone } from './retarget.js';
import { buildWeapon, buildCape, buildWizardHat, buildHood, buildCrown } from './weapons.js';

// Figures: realistic humans, armoured soldiers, procedural skeletons and slimes,
// animated by mocap (walk/idle) + KayKit combat clips retargeted at load time.

export const BODIES = {
  man: { file: 'man', height: 1.80, yaw: 0, walk: ['x', 'walk'], run: ['x', 'run'] },
  woman: { file: 'woman', height: 1.68, yaw: 0, walk: ['x', 'walk'], run: ['x', 'run'] },
  soldier: { file: 'soldier', height: 1.86, yaw: Math.PI, walk: ['s', 'Walk'], run: ['s', 'Run'], idle: ['s', 'Idle'] },
  bones: { file: 'anims_x', height: 1.78, yaw: 0, walk: ['x', 'walk'], run: ['x', 'run'] },
  gen_berserker: { file: 'gen_berserker', height: 1.95, yaw: 0, walk: ['x', 'walk'], run: ['x', 'run'], gen: true },
  gen_berserker2: { file: 'gen_berserker2', height: 1.95, yaw: 0, walk: ['x', 'walk'], run: ['x', 'run'], gen: true }
};
const K = { Attack1H: '1H_Melee_Attack_Chop', Slash: '1H_Melee_Attack_Slice_Diagonal', SlashH: '1H_Melee_Attack_Slice_Horizontal', Stab: '1H_Melee_Attack_Stab',
  Attack2H: '2H_Melee_Attack_Chop', Slice2H: '2H_Melee_Attack_Slice', Spin: '2H_Melee_Attack_Spin', Shoot: '1H_Ranged_Shoot', Bow: '2H_Ranged_Shoot', Aim: '2H_Ranged_Aiming',
  Cast: 'Spellcast_Shoot', CastLong: 'Spellcast_Long', Raise: 'Spellcast_Raise', Dual: 'Dualwield_Melee_Attack_Chop', DualStab: 'Dualwield_Melee_Attack_Stab', DualSlice: 'Dualwield_Melee_Attack_Slice',
  Throw: 'Throw', Block: 'Block', Blocking: 'Blocking', Hit: 'Hit_A', HitB: 'Hit_B', Death: 'Death_A', DeathB: 'Death_B', Dodge: 'Dodge_Backward', DodgeF: 'Dodge_Forward',
  Cheer: 'Cheer', PickUp: 'PickUp', Use: 'Use_Item', Interact: 'Interact', Jump: 'Jump_Full_Short', Kick: 'Unarmed_Melee_Attack_Kick', Punch: 'Unarmed_Melee_Attack_Punch_A',
  Sit: 'Sit_Floor_Idle', Lie: 'Lie_Idle', CombatIdle: '2H_Melee_Idle' };
const ALIAS = { Walking_A: 'Walk', Running_A: 'Run', '2H_Melee_Idle': 'Idle', Talk: 'Shake' };

let SRC = null;
function sources(){
  if(!SRC) SRC = Promise.all([loadModel('anims_x'), loadModel('anims_s'), loadModel('anims_k')]).then(([x, s, k]) => ({ x, s, k, rest: { x: snapshotRest(x.scene), s: snapshotRest(s.scene), k: snapshotRest(k.scene) } }));
  return SRC;
}
const rigs = new Map();
async function rig(body){
  if(rigs.has(body)) return rigs.get(body);
  const p = (async () => {
    const def = BODIES[body];
    const A = await sources();
    const g = body === 'bones' ? { scene: A.x.scene.clone(true) } : await loadModel(def.file);
    g.scene.updateMatrixWorld(true);
    let top = 0, head = 0, y0 = 0; g.scene.traverse(o => { if(/HeadTop_End$/.test(o.name)) top = o.getWorldPosition(new THREE.Vector3()).y; if(/Head$/.test(o.name) && !/Top/.test(o.name)) head = o.getWorldPosition(new THREE.Vector3()).y; });
    if(def.gen || def.bbox){ const bb = new THREE.Box3().setFromObject(g.scene, true); const sz = bb.getSize(new THREE.Vector3()); top = def.fit === 'max' ? Math.max(sz.x, sz.y, sz.z) : sz.y; y0 = bb.min.y; }
    const R = { g, A, clips: {}, h: top || head*1.09 || 1.8, y0, def, body };
    return R;
  })();
  rigs.set(body, p);
  return p;
}
function clipFrom(R, name){
  if(R.clips[name] !== undefined) return R.clips[name];
  const { A, g, def } = R;
  let out = null;
  if(def.static){ R.clips[name] = null; return null; }
  if(def.own){ R.clips[name] = ownClip(g.animations || [], name); return R.clips[name]; }
  const direct = (src, cn) => {
    const S = A[src]; const c = S.animations.find(a => a.name === cn); if(!c) return null;
    if(R.body === 'bones' && src === 'x') return c;   // the bones rig IS the Xbot skeleton
    const r = bakeRetarget(c, S.scene, g.scene, { name }); A.rest[src](); return r;
  };
  if(name === 'Idle') out = def.idle ? direct(...def.idle) : direct('x', 'idle');
  else if(name === 'Walk') out = direct(...def.walk);
  else if(name === 'Run') out = direct(...def.run);
  else if(name === 'Nod') out = direct('x', 'agree');
  else if(name === 'Shake') out = direct('x', 'headShake');
  else if(name === 'Sad') out = direct('x', 'sad_pose');
  else if(name === 'Sneak') out = direct('x', 'sneak_pose');
  else if(K[name]){
    const c = A.k.animations.find(a => a.name === K[name]); const ref = A.k.animations.find(a => a.name === 'Unarmed_Idle');
    const idle = clipFrom(R, 'Idle');
    if(c && ref && idle){ out = bakeRetarget(c, A.k.scene, g.scene, { name, srcRef: { clip: ref, time: 0 }, tgtRef: { clip: idle, time: 0 } }); A.rest.k(); }
  }
  R.clips[name] = out;
  return out;
}
// creatures that bring their own animations: pick a clip by what its name says
const OWN = { Idle: /idle|stand|breath|look|howl|sit/i, Walk: /walk|move|crawl|swim/i, Run: /run|gallop|trot|sprint|fly|charge/i,
  Death: /death|die|dead/i, Hit: /hit|recoil|damage|hurt/i, Cheer: /howl|roar|cheer|taunt|intimid|dance/i,
  Attack: /attack|bite|claw|swipe|strike|slash|combo|punch/i };
function ownClip(list, name){
  if(!list.length) return null;
  const key = /Attack|Slash|Stab|Spin|Kick|Punch|Dual|Bow|Shoot|Cast|Throw|Slice/.test(name) ? 'Attack' : OWN[name] ? name : null;
  const good = list.filter(c => c.duration > .2 && !/t-?pose|startpose|^pose|bind/i.test(c.name));
  const pool = good.length ? good : list;
  const re = key && OWN[key];
  return (re && pool.find(c => re.test(c.name))) || (name === 'Idle' ? pool[0] : null) || pool[0];
}
export function findBoneOf(inst, k){ inst._b = inst._b || {}; if(!(k in inst._b)) inst._b[k] = findBone(inst.obj, k); return inst._b[k]; }
export async function preload(bodies, clipNames){
  for(const b of bodies){ const R = await rig(b); (clipNames || []).forEach(n => clipFrom(R, n)); }
}

// ---------- procedural skeleton body ----------
let boneMat = null;
function buildBones(root, o){
  boneMat = boneMat || new THREE.MeshStandardMaterial({ color: '#ddd3bc', roughness: .62, metalness: 0 });
  const mat = o.boneColor ? new THREE.MeshStandardMaterial({ color: o.boneColor, roughness: .62 }) : boneMat;
  const dark = new THREE.MeshStandardMaterial({ color: '#0a0806', roughness: 1 });
  const B = k => findBone(root, k);
  const limb = (a, b, r) => { const A = B(a), Bb = B(b); if(!A || !Bb) return; const v = Bb.position.clone(); const L = v.length(); if(L < 1e-3) return;
    const g = new THREE.CapsuleGeometry(r, Math.max(.01, L - r*2), 4, 8); const ms = new THREE.Mesh(g, mat); ms.castShadow = true;
    ms.position.copy(v).multiplyScalar(.5); ms.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()); A.add(ms);
    // knobby joint
    const j = new THREE.Mesh(new THREE.SphereGeometry(r*1.35, 8, 6), mat); j.castShadow = true; A.add(j); };
  ['Left', 'Right'].forEach(s => {
    limb(s + 'Shoulder', s + 'Arm', 1.2); limb(s + 'Arm', s + 'ForeArm', 2.1); limb(s + 'ForeArm', s + 'Hand', 1.4); limb(s + 'UpLeg', s + 'Leg', 2.7); limb(s + 'Leg', s + 'Foot', 2.1); limb(s + 'Foot', s + 'ToeBase', 1.8);
    const hand = B(s + 'Hand'); if(hand){ const hb = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 1.8), mat); hb.position.y = 4; hb.castShadow = true; hand.add(hb); }
  });
  limb('Hips', 'Spine', 1.6); limb('Spine', 'Spine1', 1.6); limb('Spine1', 'Spine2', 1.6); limb('Spine2', 'Neck', 1.4); limb('Neck', 'Head', 1.3);
  // ribcage
  const sp1 = B('Spine1'), sp2 = B('Spine2');
  [[sp1, 2, 11, 7], [sp1, 7, 12, 8], [sp2, 0, 12.5, 8.5], [sp2, 5, 12, 8], [sp2, 10, 10.5, 7.2], [sp2, 14, 8.5, 6]].forEach(([bn, y, rx, rz]) => { if(!bn) return;
    const t = new THREE.Mesh(new THREE.TorusGeometry(1, .09, 5, 20, Math.PI*1.72), mat); t.rotation.x = Math.PI/2; t.rotation.z = Math.PI/2 + Math.PI*.14; t.scale.set(rx, rz, rx*.9); t.position.set(0, y, 1.5); t.castShadow = true; bn.add(t); });
  if(sp2){ const st = new THREE.Mesh(new THREE.BoxGeometry(2.2, 16, 1.4), mat); st.position.set(0, 6, 9.4); sp2.add(st); }
  // pelvis
  const hips = B('Hips'); if(hips){ const pv = new THREE.Mesh(new THREE.TorusGeometry(8, 2.2, 8, 20), mat); pv.rotation.x = Math.PI/2 - .3; pv.scale.set(1, .8, 1); pv.position.y = -3; pv.castShadow = true; hips.add(pv); }
  // skull
  const head = B('Head');
  if(head){
    const sk = new THREE.Group(); sk.position.set(0, 8.5, 1.2); head.add(sk);
    const cr = new THREE.Mesh(new THREE.SphereGeometry(9.6, 20, 16), mat); cr.scale.set(.95, 1.08, 1.12); cr.castShadow = true; sk.add(cr);
    const face = new THREE.Mesh(new THREE.SphereGeometry(7.4, 16, 12), mat); face.position.set(0, -4.2, 4.2); face.scale.set(1, .9, .85); sk.add(face);
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(2.7, 12, 10), dark); e.position.set(s*3.6, -1.2, 8.4); sk.add(e); });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 3), dark); nose.position.set(0, -4.6, 10.2); nose.rotation.x = Math.PI; sk.add(nose);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 7), mat); jaw.position.set(0, -10.2, 5.6); jaw.castShadow = true; sk.add(jaw);
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(7, 1.4, 1), new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: .4 })); teeth.position.set(0, -8.2, 9.2); sk.add(teeth);
    const ec = o.eyes || '#ff5a2a';
    [-1, 1].forEach(s => { const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: ec, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(5, 5, 1); gl.position.set(s*3.6, -1.2, 9); sk.add(gl);
      const core = new THREE.Mesh(new THREE.SphereGeometry(.9, 8, 6), new THREE.MeshBasicMaterial({ color: ec })); core.position.set(s*3.6, -1.2, 9.6); sk.add(core); });
  }
}

// ---------- figure factory ----------
// spec: { body, height, width, look:{...}, gear:{ right:{type,...}, left:{type,...}, cape, hat, ears, tusks, robe, crown }, idle }
export async function make(spec){
  spec = spec || {};
  const body = spec.body || 'man';
  const R = await rig(body);
  const def = R.def;
  const obj = body === 'bones' ? R.g.scene.clone(true) : skClone(R.g.scene);
  const look = spec.look || {};
  const morphs = [];
  if(body === 'bones') buildBones(obj, look);
  obj.traverse(m => {
    if(!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    if(body === 'bones') return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const nm = mats.map(src => {
      const mt = src.clone();
      const n = (src.name || '') + ' ' + (m.name || '');
      if(/Outfit_Top/.test(n) && look.top) mt.color.set(look.top);
      if(/Outfit_Bottom/.test(n) && look.bottom) mt.color.set(look.bottom);
      if(/Footwear/.test(n) && look.shoes) mt.color.set(look.shoes);
      if(/Headwear/.test(n)){ if(look.hat === false) m.visible = false; else if(look.hat) mt.color.set(look.hat); }
      if(/Beard/.test(n) && look.beard === false) m.visible = false;
      if(/Beard|Hair/.test(n) && look.hair) mt.color.set(look.hair);
      if(/Wolf3D_Skin|Wolf3D_Body|Ch03/.test(n) && look.skin){ mt.color.set(look.skin); }
      if(/Eye/.test(n) && look.eyes){ mt.color.set(look.eyes); mt.emissive = new THREE.Color(look.eyes); mt.emissiveIntensity = .6; }
      if(/Vanguard/.test(n) && look.armor) mt.color.set(look.armor);
      if(/Vanguard/.test(n) && !/Visor/.test(n) && look.metal){ mt.metalness = .92; mt.roughness = .3; mt.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n { float l = dot(diffuseColor.rgb, vec3(.3,.59,.11)); diffuseColor.rgb = vec3(clamp(.35 + l*1.1, 0., 1.))*diffuse; }'); }; mt.customProgramCacheKey = () => 'metalArmor'; }
      if(/Vanguard_Visor/.test(n) && look.visor){ mt.emissive = new THREE.Color(look.visor); mt.emissiveIntensity = 1.5; }
      if(def.gen){ mt.metalness = Math.min(mt.metalness || 0, .2); mt.roughness = Math.min(mt.roughness == null ? .6 : mt.roughness, .62); }
      mt.envMapIntensity = .9;
      if(body === 'woman' && !look.raw){
        mt.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n { float l = dot(diffuseColor.rgb, vec3(.3,.59,.11)); vec3 tint = vec3(l)*vec3(1.0,.93,.82); float sat = smoothstep(.25,.6, max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b) - min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b)); diffuseColor.rgb = mix(diffuseColor.rgb, tint*.8, .75*sat); }'); };
        mt.customProgramCacheKey = () => 'womanTone';
      }
      if(mt.roughness != null && /Skin|Body|Head/.test(n)) mt.roughness = Math.max(mt.roughness, .55);
      return mt;
    });
    m.material = Array.isArray(m.material) ? nm : nm[0];
    if(m.morphTargetDictionary && m.morphTargetInfluences){ const k = m.morphTargetDictionary.mouthOpen, s = m.morphTargetDictionary.mouthSmile; if(k != null || s != null) morphs.push({ m, open: k, smile: s }); }
  });
  const H = spec.height || def.height;
  const scale = H/R.h;
  const inner = new THREE.Group(); inner.add(obj); inner.scale.set(scale*(spec.width || 1), scale, scale*(spec.width || 1)); inner.rotation.y = def.yaw; if(R.y0) inner.position.y = -R.y0*scale;
  const wrap = new THREE.Group(); wrap.add(inner);
  wrap.updateMatrixWorld(true);
  // body build: proportions on top of the overall height/width (bone scaling; clips only key rotations + hips position)
  const BLD = spec.build;
  if(BLD && body !== 'bones'){
    const fb = k => findBone(obj, k), _w = new THREE.Vector3();
    const footY = () => { const f = fb('LeftFoot') || fb('LeftToeBase'); return f ? f.getWorldPosition(_w).y : 0; };
    const y0 = footY();
    if(BLD.head && fb('Head')) fb('Head').scale.multiplyScalar(BLD.head);
    if(BLD.neck && fb('Neck')) fb('Neck').scale.multiplyScalar(BLD.neck);
    if(BLD.shoulders) ['LeftShoulder', 'RightShoulder'].forEach(k => { const b = fb(k); if(b) b.position.x *= BLD.shoulders; });
    if(BLD.arms) ['LeftArm', 'RightArm'].forEach(k => { const b = fb(k); if(b) b.scale.multiplyScalar(BLD.arms); });
    if(BLD.legs) ['LeftUpLeg', 'RightUpLeg'].forEach(k => { const b = fb(k); if(b) b.scale.multiplyScalar(BLD.legs); });
    if(BLD.torso && fb('Spine1')){ const b = fb('Spine1'); b.scale.set(b.scale.x*BLD.torso, b.scale.y, b.scale.z*BLD.torso); ['LeftShoulder', 'RightShoulder', 'Neck'].forEach(k => { const c = fb(k); if(c && c.parent && c.parent !== b) {} }); }
    wrap.updateMatrixWorld(true);
    const dy = y0 - footY(); inner.position.y += dy;
    wrap.updateMatrixWorld(true);
  }

  const mixer = new THREE.AnimationMixer(obj);
  const actions = {}; let cur = null, curName = '', onceCb = null, locked = 0;
  function act(name){ if(actions[name]) return actions[name]; const c = clipFrom(R, name); if(!c) return null; return (actions[name] = mixer.clipAction(c)); }
  function play(name, o){
    o = o || {};
    name = ALIAS[name] || name;
    let a = act(name); if(!a){ a = act('Idle'); name = 'Idle'; } if(!a) return null;
    if(a === cur && !o.restart){ if(o.speed) a.setEffectiveTimeScale(o.speed); return a; }
    a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setEffectiveTimeScale(o.speed || 1);
    a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
    if(cur && cur !== a) a.crossFadeFrom(cur, o.fade == null ? .2 : o.fade, true);
    a.play(); cur = a; curName = name;
    return a;
  }
  // gear
  const gear = spec.gear || {};
  const attached = {};
  const _s = new THREE.Vector3();
  function attach(boneKey, objG, pos, rot, sc){
    const b = findBone(obj, boneKey); if(!b) return null;
    const holder = new THREE.Group(); b.add(holder); b.updateMatrixWorld(true); b.getWorldScale(_s);
    const k = 1/_s.x*(sc || 1); holder.scale.set(k, k*_s.x/_s.y, k*_s.x/_s.z);
    if(pos) holder.position.set(pos[0]/_s.x, pos[1]/_s.y, pos[2]/_s.z);
    if(rot) holder.rotation.set(rot[0], rot[1], rot[2]);
    holder.add(objG); objG.traverse(o => { if(o.isMesh){ o.castShadow = true; } });
    return holder;
  }
  // grip computed in the rest pose: weapon +Y along the fist axis (world forward, tilted up by `lift`),
  // weapon +X along the fingers, offset into the palm.
  function grip(side, w, lift, roll, off){
    const b = findBone(obj, side + 'Hand'); const kids = b && b.children.filter(c => /Hand(Middle|Index)1$/.test(c.name));
    if(!b) return null;
    const bp = b.getWorldPosition(new THREE.Vector3());
    const tip = kids && kids.length ? kids[0].getWorldPosition(new THREE.Vector3()) : bp.clone().add(new THREE.Vector3(side === 'Right' ? -.08 : .08, 0, 0));
    const along = tip.clone().sub(bp).normalize();
    const fwd = new THREE.Vector3(0, lift || 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.yaw).normalize();
    let x, y;
    if(VERT[w.userData.type]){ y = fwd.clone(); x = along.clone().sub(y.clone().multiplyScalar(along.dot(y))).normalize(); }
    else { y = fwd.clone().sub(along.clone().multiplyScalar(fwd.dot(along))).normalize(); x = along.clone(); }
    const z = new THREE.Vector3().crossVectors(x, y);
    const wq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    if(roll) wq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll));
    const palm = new THREE.Vector3().crossVectors(side === 'Right' ? fwd : along, side === 'Right' ? along : fwd).normalize();
    const wpos = bp.clone().addScaledVector(along, .085).addScaledVector(palm, (off == null ? .03 : off)*H/1.8);
    const holder = new THREE.Group(); b.add(holder);
    const bq = b.getWorldQuaternion(new THREE.Quaternion());
    holder.quaternion.copy(bq.clone().invert().multiply(wq));
    holder.position.copy(b.worldToLocal(wpos));
    b.getWorldScale(_s); holder.scale.setScalar(1/_s.x*Math.max(1, H/1.8));
    holder.add(w); w.traverse(o => { if(o.isMesh) o.castShadow = true; });
    return holder;
  }
  // pose the figure in its idle frame so grips match how weapons are held at rest
  play(spec.idle || 'Idle', { fade: 0 }); mixer.update(0); wrap.updateMatrixWorld(true);
  if(def.own){ // own clips may move/rotate the root: put the posed creature back on the ground, centred
    const bb = new THREE.Box3().setFromObject(obj, true); if(!bb.isEmpty()){ const c = bb.getCenter(new THREE.Vector3()); inner.position.y -= bb.min.y; inner.position.x -= c.x; inner.position.z -= c.z; wrap.updateMatrixWorld(true); } }
  const VERT = { staff: 1, scepter: 1, bow: 1 };
  const LIFT = { staff: 4, scepter: .6, sword: -.15, greatsword: -.1, axe: -.1, mace: -.1, club: -.1, dagger: -.3, bow: 5 };
  if(gear.right){ const w = buildWeapon(gear.right.type, gear.right); if(w){ w.userData.type = gear.right.type; attached.right = grip('Right', w, LIFT[gear.right.type]); attached.rightObj = w; } }
  if(gear.left){
    const w = buildWeapon(gear.left.type, gear.left);
    if(w){ w.userData.type = gear.left.type;
      if(gear.left.type === 'shield'){ const sc = (gear.left.kite ? .85 : .9)*Math.max(1, H/1.8); w.scale.setScalar(sc); attached.left = attach('LeftForeArm', w, [0, 0, 0], [0, 0, 0]);
        // orient the shield face outward from the forearm in rest pose
        const fa = findBone(obj, 'LeftForeArm');
        const fq = fa.getWorldQuaternion(new THREE.Quaternion()); const out = new THREE.Vector3(.35, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), def.yaw).normalize();
        const up = new THREE.Vector3(0, 1, 0); const xx = new THREE.Vector3().crossVectors(up, out).normalize(); const yy = new THREE.Vector3().crossVectors(out, xx);
        const wq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xx, yy, out));
        attached.left.quaternion.copy(fq.clone().invert().multiply(wq));
        const hand = findBone(obj, 'LeftHand'); const mid = fa.getWorldPosition(new THREE.Vector3()).lerp(hand.getWorldPosition(new THREE.Vector3()), .55).addScaledVector(out, .07*H/1.8);
        attached.left.position.copy(fa.worldToLocal(mid));
      }
      else attached.left = grip('Left', w, LIFT[gear.left.type], gear.left.type === 'bow' ? Math.PI/2 : 0, gear.left.type === 'bow' ? .02 : .03);
      attached.leftObj = w;
    }
  }
  if(gear.cape){ const c = buildCape(gear.cape, gear.capeLen || (H*.52)); attached.cape = attach('Spine2', c, [0, .16, -.16], [.08, 0, 0]); attached.capeMesh = c; }
  if(gear.hat === 'wizard'){ attach('Head', buildWizardHat(gear.hatColor || '#2a3a6a'), [0, .16, .01], [-.12, 0, 0]); }
  // knightly extras: a crest fin on the helm and a cloth tabard hanging front and back
  if(gear.crest){ const cm = new THREE.MeshStandardMaterial({ color: gear.crest, metalness: 1, roughness: .28 }); const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(.02, .11, .1, .14); sh.quadraticCurveTo(.16, .07, .18, -.05); sh.lineTo(.12, -.06); sh.quadraticCurveTo(.1, .04, 0, .04); sh.closePath();
    const fg = new THREE.ExtrudeGeometry(sh, { depth: .022, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 1 }); fg.translate(-.08, 0, -.011); const fin = new THREE.Mesh(fg, cm); fin.rotation.y = -Math.PI/2; attach('Head', fin, [0, .2, .02]); }
  if(gear.tabard){ const T = gear.tabard, k = H/1.8; const tm = new THREE.MeshStandardMaterial({ color: T.color || '#7a1a14', roughness: .85, side: THREE.DoubleSide }); const gm = new THREE.MeshStandardMaterial({ color: T.trim || '#c9a040', metalness: .8, roughness: .35 });
    [1, -1].forEach(sd => { const g2 = new THREE.Group(); const cloth = new THREE.Mesh(new THREE.PlaneGeometry(.26*k, .62*k, 1, 6), tm); cloth.position.y = -.31*k; g2.add(cloth); [-1, 1].forEach(e => { const st = new THREE.Mesh(new THREE.BoxGeometry(.025*k, .62*k, .01), gm); st.position.set(e*.115*k, -.31*k, .006*sd); g2.add(st); }); const ord = new THREE.Mesh(new THREE.BoxGeometry(.07*k, .3*k, .012), gm); ord.position.set(0, -.3*k, .008*sd); g2.add(ord);
      if(sd < 0) g2.rotation.y = Math.PI; attach('Hips', g2, [0, -.02, sd*.17*k], [sd*.06, 0, 0]); }); }
  if(gear.crown){ attach('Head', buildCrown(gear.crown), body === 'bones' ? [0, .2, .01] : [0, .19, 0], [0, 0, 0]); }
  // extra hairstyles on top of (or instead of) the model's own hair
  if(spec.hairStyle && body !== 'bones' && body !== 'soldier'){
    const hs = spec.hairStyle, hm = new THREE.MeshStandardMaterial({ color: look.hair || '#3a2a1e', roughness: .62 });
    if(hs !== 'model') obj.traverse(m => { if(m.isMesh && /Hair/.test((m.name || '') + ' ' + (m.material && m.material.name || ''))) m.visible = false; });
    const cap = () => { const c = new THREE.Mesh(new THREE.SphereGeometry(.105, 20, 14, 0, Math.PI*2, 0, Math.PI*.55), hm); c.scale.set(1, 1.05, 1.12); return c; };
    if(hs === 'long'){ attach('Head', cap(), [0, .095, -.005]); const b = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .2, 6, 14), hm); b.scale.set(1.25, 1, .45); attach('Head', b, [0, -.02, -.075]); }
    if(hs === 'ponytail'){ attach('Head', cap(), [0, .095, -.005]); attach('Head', new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 10), hm), [0, .12, -.1]); const t = new THREE.Mesh(new THREE.CapsuleGeometry(.03, .2, 5, 10), hm); attach('Head', t, [0, .0, -.135], [.25, 0, 0]); }
    if(hs === 'bun'){ attach('Head', cap(), [0, .095, -.005]); attach('Head', new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 12), hm), [0, .19, -.06]); }
    if(hs === 'mohawk'){ const m2 = new THREE.Mesh(new THREE.BoxGeometry(.03, .1, .21), hm); attach('Head', m2, [0, .135, -.01]); }
    if(hs === 'short'){ attach('Head', cap(), [0, .097, -.004]); }
  }
  if(gear.ears){ const skin = new THREE.MeshStandardMaterial({ color: look.skin || '#6a8a3a', roughness: .6 }); [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.ConeGeometry(.035, .16, 8), skin); e.scale.set(1, 1, .35); attach('Head', e, [s*.085, .085, -.005], [0, 0, -s*1.25]); }); }
  if(gear.tusks){ const tm = new THREE.MeshStandardMaterial({ color: '#efe4c8', roughness: .35 }); [-1, 1].forEach(s => attach('Head', new THREE.Mesh(new THREE.ConeGeometry(.012, .06, 8), tm), [s*.028, .02, .085], [-.4, 0, s*.25])); }
  if(gear.horns){ const hm = new THREE.MeshStandardMaterial({ color: gear.horns, roughness: .45, metalness: .05 }); const k = H/1.8*(body === 'soldier' ? .95 : 1.1);
    [-1, 1].forEach(s => { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(s*.07, .1, 0), new THREE.Vector3(s*.19, .13, .03), new THREE.Vector3(s*.28, .23, .07), new THREE.Vector3(s*.27, .35, .04)].map(v => v.multiplyScalar(k)));
      const tg = new THREE.TubeGeometry(curve, 14, .034*k, 8, false); const tp = tg.attributes.position; const cen = new THREE.Vector3(), v = new THREE.Vector3();
      for(let i = 0; i < tp.count; i++){ const t = Math.floor(i/9)/14; curve.getPointAt(Math.min(1, t), cen); v.fromBufferAttribute(tp, i).sub(cen).multiplyScalar(1 - t*.88).add(cen); tp.setXYZ(i, v.x, v.y, v.z); }
      tg.computeVertexNormals(); const hn = new THREE.Mesh(tg, hm); attach('Head', hn, [0, .02*k, 0], [0, 0, 0]); }); }
  // beastfolk: ears on the head and a swaying tail
  let tail = null;
  if(gear.beast){ const B = gear.beast, k = H/1.8;
    const fur = new THREE.MeshStandardMaterial({ color: B.color || '#8a5a3a', roughness: .85 }); const inner = new THREE.MeshStandardMaterial({ color: B.inner || '#e8b8a8', roughness: .7 });
    const tip = new THREE.MeshStandardMaterial({ color: B.tip || '#f2ede4', roughness: .85 });
    const ear = (s2) => { const g = new THREE.Group(); const L = (B.kind === 'rabbit' ? .3 : B.kind === 'fox' ? .2 : B.kind === 'wolf' ? .18 : .15)*k, W2 = (B.kind === 'rabbit' ? .055 : B.kind === 'fox' ? .09 : .085)*k;
      const sh = new THREE.Shape(); sh.moveTo(-W2, 0); sh.quadraticCurveTo(-W2*.9, L*.6, 0, L); sh.quadraticCurveTo(W2*.9, L*.6, W2, 0); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: .018*k, bevelEnabled: true, bevelSize: .008*k, bevelThickness: .008*k, bevelSegments: 2, curveSegments: 8 }); geo.translate(0, 0, -.009*k);
      const e = new THREE.Mesh(geo, fur); g.add(e);
      const sh2 = new THREE.Shape(); sh2.moveTo(-W2*.6, L*.08); sh2.quadraticCurveTo(-W2*.5, L*.55, 0, L*.85); sh2.quadraticCurveTo(W2*.5, L*.55, W2*.6, L*.08); sh2.closePath();
      const ie = new THREE.Mesh(new THREE.ShapeGeometry(sh2, 6), inner); ie.position.z = .02*k; g.add(ie);
      if(B.kind === 'fox'){ const t2 = new THREE.Mesh(new THREE.ConeGeometry(W2*.45, L*.25, 8), B.tipEar ? tip : new THREE.MeshStandardMaterial({ color: '#2a1a14', roughness: .8 })); t2.position.y = L*.9; g.add(t2); }
      g.rotation.set(-.15, 0, -s2*(B.kind === 'rabbit' ? .15 : .32));
      return g; };
    if(B.ears !== false) [-1, 1].forEach(s2 => attach('Head', ear(s2), [s2*.07*k, .16*k, -.015*k], [0, 0, 0]));
    // tail: tapered tube along a curve, bushy for wolves and foxes
    const len = (B.kind === 'cat' ? .62 : B.kind === 'rabbit' ? .1 : .55)*k, r0 = (B.kind === 'cat' ? .022 : B.kind === 'rabbit' ? .05 : .055)*k, bushy = B.kind === 'fox' || B.kind === 'wolf';
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -len*.25, -len*.35), new THREE.Vector3(0, -len*.3, -len*.7), new THREE.Vector3(0, -len*.05, -len)]);
    const tg = new THREE.TubeGeometry(curve, 18, r0, 10, false); const tp = tg.attributes.position; const cen = new THREE.Vector3(), v = new THREE.Vector3(); const cols = new Float32Array(tp.count*3); const cA = new THREE.Color(B.color || '#8a5a3a'), cB = new THREE.Color(B.tip || '#f2ede4');
    for(let i = 0; i < tp.count; i++){ const t = Math.floor(i/11)/18; curve.getPointAt(Math.min(1, t), cen); const prof = B.kind === 'rabbit' ? 1 : bushy ? (.6 + Math.sin(Math.min(1, t*1.15)*Math.PI)*1.5)*(1 - Math.pow(t, 6)*.9) : 1 - t*.5; v.fromBufferAttribute(tp, i).sub(cen).multiplyScalar(prof).add(cen); tp.setXYZ(i, v.x, v.y, v.z); const c = (B.kind === 'fox' && t > .78) || (B.kind === 'cat' && B.tip && t > .9) ? cB : cA; cols[i*3] = c.r; cols[i*3 + 1] = c.g; cols[i*3 + 2] = c.b; }
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); tg.computeVertexNormals();
    const tm = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }));
    if(B.kind === 'rabbit'){ tm.geometry = new THREE.SphereGeometry(.07*k, 12, 10); tm.material = tip; }
    tail = attach('Hips', tm, [0, .02*k, -.1*k], [.2, 0, 0]);
  }
  if(gear.robe){ const rg = new THREE.CylinderGeometry(.2, .42, 1.15, 18, 6, true); const rp = rg.attributes.position; for(let i = 0; i < rp.count; i++){ const y = rp.getY(i); if(y < -.4) rp.setY(i, y + Math.sin(Math.atan2(rp.getX(i), rp.getZ(i))*9)*.05); } rg.computeVertexNormals();
    const rm = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: gear.robe, roughness: .95, side: THREE.DoubleSide })); attach('Hips', rm, [0, -.38, 0], [0, 0, 0]);
    const tm = new THREE.Mesh(new THREE.CylinderGeometry(.16, .21, .55, 16, 1, true), rm.material); attach('Spine1', tm, [0, .05, 0], [0, 0, 0]); }
  if(gear.aura){ const a = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: gear.aura, transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending })); a.scale.set(H*1.6, H*1.6, 1); a.position.y = H*.55; wrap.add(a); }

  // one-shot action that returns to `back` afterwards; `hitAt` fraction triggers onHit
  function oneShot(name, o){
    o = o || {};
    const a = play(name, { once: true, fade: o.fade == null ? .12 : o.fade, speed: o.speed, restart: true }); if(!a) { o.onHit && o.onHit(); o.onDone && o.onDone(); return 0; }
    const dur = a.getClip().duration/(o.speed || 1);
    locked = dur*(o.lockFrac || .92);
    onceCb = { t: 0, dur, hitAt: dur*(o.hitAt == null ? .45 : o.hitAt), hit: o.onHit, done: o.onDone, hitFired: false, back: o.back, keep: o.keep };
    return dur;
  }
  // swing the arms a little away from the body (bulky clothes): world-space rotation about the facing axis
  const _aq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _fw = new THREE.Vector3();
  function armsOut(a){
    obj.updateMatrixWorld(true); _fw.set(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(_pq));
    [['LeftArm', -1], ['RightArm', 1]].forEach(([k, sgn]) => { const b = findBone(obj, k); if(!b || !b.parent) return;
      b.parent.getWorldQuaternion(_pq); b.getWorldQuaternion(_bq); _aq.setFromAxisAngle(_fw, sgn*a); _bq.premultiply(_aq); b.quaternion.copy(_pq.invert().multiply(_bq)); });
  }
  let talkT = 0, smile = 0, capeT = Math.random()*10;
  const inst = {
    obj: wrap, inner, body, mixer, play, oneShot, attached, height: H,
    current: () => curName,
    busy: () => locked > 0,
    talk(sec){ talkT = sec; }, smile(v){ smile = v; },
    update(dt, moving){
      mixer.update(dt);
      if(def.armOut) armsOut(def.armOut);
      if(locked > 0) locked -= dt;
      if(onceCb){ onceCb.t += dt; if(!onceCb.hitFired && onceCb.t >= onceCb.hitAt){ onceCb.hitFired = true; onceCb.hit && onceCb.hit(); }
        if(onceCb.t >= onceCb.dur){ const c = onceCb; onceCb = null; if(!c.keep) play(c.back || 'Idle', { fade: .25 }); c.done && c.done(); } }
      if(tail){ capeT += 0; tail.rotation.y = Math.sin(performance.now()*.0021 + 1.3)*(moving ? .45 : .28); tail.rotation.x = .2 + (moving ? .35 : 0) + Math.sin(performance.now()*.0013)*.08; }
      if(attached.cape){ capeT += dt; attached.cape.rotation.x = .08 + (moving ? .35 : 0) + Math.sin(capeT*2.1)*.04; }
      if(morphs.length){ talkT = Math.max(0, talkT - dt); const t = performance.now()/1000; const open = talkT > 0 ? Math.max(0, Math.sin(t*14)*.5 + Math.sin(t*23)*.3 + .15)*.55 : 0;
        morphs.forEach(q => { if(q.open != null) q.m.morphTargetInfluences[q.open] += (open - q.m.morphTargetInfluences[q.open])*Math.min(1, dt*18); if(q.smile != null) q.m.morphTargetInfluences[q.smile] += (smile - q.m.morphTargetInfluences[q.smile])*Math.min(1, dt*4); }); }
    },
    flash(color){ obj.traverse(m => { if(m.isMesh && m.material && m.material.emissive){ if(!m.userData.e0){ m.userData.e0 = m.material.emissive.clone(); m.userData.ei0 = m.material.emissiveIntensity; } m.material.emissive.set(color || '#ff3a2a'); m.material.emissiveIntensity = .6; } }); inst._flash = .12; },
    tick(dt){ if(inst._flash > 0){ inst._flash -= dt; if(inst._flash <= 0) obj.traverse(m => { if(m.isMesh && m.userData.e0){ m.material.emissive.copy(m.userData.e0); m.material.emissiveIntensity = m.userData.ei0; } }); } },
    setOpacity(a){ wrap.traverse(m => { if(m.material){ const ms = Array.isArray(m.material) ? m.material : [m.material]; ms.forEach(mt => { mt.transparent = a < 1; mt.opacity = a; mt.depthWrite = a >= 1; }); } }); }
  };
  mixer.setTime(Math.random()*3);
  return inst;
}

// ---------- slime ----------
export function makeSlime(o){
  o = o || {};
  const size = o.size || .7, color = new THREE.Color(o.color || '#5ad06a');
  const geo = new THREE.SphereGeometry(.5, 40, 28);
  const p = geo.attributes.position; for(let i = 0; i < p.count; i++){ const y = p.getY(i); if(y < 0) p.setY(i, y*.55); p.setY(i, p.getY(i) + .275); }
  geo.computeVertexNormals();
  const uni = { uT: { value: Math.random()*10 }, uSquash: { value: 0 } };
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: .12, metalness: 0, clearcoat: 1, clearcoatRoughness: .06, transparent: true, opacity: .78, sheen: .4, sheenColor: color.clone().offsetHSL(0, 0, .2), emissive: color.clone().multiplyScalar(.12), envMapIntensity: 1.4 });
  mat.onBeforeCompile = sh => { sh.uniforms.uT = uni.uT; sh.uniforms.uSquash = uni.uSquash;
    sh.vertexShader = 'uniform float uT; uniform float uSquash;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float wob = sin(uT*3.0 + position.y*9.0 + position.x*5.0)*.025 + sin(uT*5.3 + position.z*7.0)*.015;
      transformed.xz *= 1.0 + uSquash*.35 + wob; transformed.y *= 1.0 - uSquash*.45;`); };
  mat.customProgramCacheKey = () => 'slime';
  const body = new THREE.Mesh(geo, mat); body.castShadow = true; body.receiveShadow = true;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.13, 3), new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(.5), emissive: color, emissiveIntensity: .5, roughness: .4 })); core.position.y = .22;
  const eyeM = new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: .05 });
  const eyes = new THREE.Group(); eyes.position.set(0, .34, .36);
  [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(.055, 14, 10), eyeM); e.scale.set(1, 1.3, .6); e.position.x = s*.11; eyes.add(e); const hl = new THREE.Mesh(new THREE.SphereGeometry(.016, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' })); hl.position.set(s*.11 + .015, .025, .03); eyes.add(hl); });
  const inner = new THREE.Group(); inner.add(body, core, eyes);
  if(o.crown){ const c = buildCrown(o.crown); c.position.y = .72; c.scale.setScalar(1.4); inner.add(c); }
  inner.scale.setScalar(size);
  const wrap = new THREE.Group(); wrap.add(inner);
  let hop = 0, dead = 0;
  return {
    obj: wrap, inner, body: 'slime', height: size*.6, attached: {}, current: () => 'slime', busy: () => false,
    play(){}, talk(){}, smile(){},
    oneShot(name, o2){ o2 = o2 || {}; if(name === 'Death'){ dead = .001; setTimeout(() => o2.onDone && o2.onDone(), 900); return .9; } if(/Attack|Slash|Cast/.test(name)){ hop = 1; setTimeout(() => o2.onHit && o2.onHit(), 260); setTimeout(() => o2.onDone && o2.onDone(), 600); return .6; } if(name === 'Hit'){ uni.uSquash.value = .6; } o2.onDone && o2.onDone(); return 0; },
    update(dt, moving){
      uni.uT.value += dt;
      if(dead > 0){ dead += dt; inner.scale.set(size*(1 + dead*.8), size*Math.max(.05, 1 - dead*1.2), size*(1 + dead*.8)); mat.opacity = Math.max(0, .78 - dead*.6); return; }
      if(moving || hop > 0){ hop += dt*2.6; const ph = hop % 1; const up = Math.max(0, Math.sin(ph*Math.PI)); inner.position.y = up*.35*Math.min(size, 2.6); uni.uSquash.value = ph < .12 ? (1 - ph/.12)*.5 : ph > .88 ? (ph - .88)/.12*.5 : -up*.15; if(!moving && hop > 1) hop = 0; }
      else { inner.position.y *= .8; uni.uSquash.value = Math.sin(uni.uT.value*2.2)*.05; }
    },
    flash(){ mat.emissiveIntensity = 3; setTimeout(() => mat.emissiveIntensity = 1, 110); },
    tick(){}, setOpacity(a){ mat.opacity = .78*a; }
  };
}

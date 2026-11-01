import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
const W = 360, H = 480;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W*3, H); document.body.appendChild(r.domElement);
r.toneMapping = THREE.ACESFilmicToneMapping; r.setScissorTest(true);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#8a9aa8');
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), .04).texture;
scene.add(new THREE.HemisphereLight('#fff', '#556', 1.2)); const d = new THREE.DirectionalLight('#fff', 2); d.position.set(2, 4, 5); scene.add(d);
const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
window.shoot = async (url) => {
  const g = await L.loadAsync(url); const o = g.scene; scene.add(o); o.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(o, true); const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  const R = Math.max(sz.x, sz.y, sz.z)*.62;
  const cam = new THREE.PerspectiveCamera(30, W/H, R*.01, R*50);
  [[0, 0, 1], [1, 0, 0], [0, .9, .01]].forEach((v, i) => {
    const dir = new THREE.Vector3(...v).normalize(); cam.position.copy(c).addScaledVector(dir, R/Math.tan(15*Math.PI/180)*1.05); cam.up.set(0, i === 2 ? 0 : 1, i === 2 ? -1 : 0); cam.lookAt(c);
    r.setViewport(i*W, 0, W, H); r.setScissor(i*W, 0, W, H); r.render(scene, cam); });
  scene.remove(o);
  return { size: sz.toArray().map(x => +x.toFixed(3)), anims: g.animations.map(a => a.name + ':' + a.duration.toFixed(1)) };
};
window.ready = true;

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

// Physically based sky (Preetham) + procedural cloud dome + stars + moon,
// with time-of-day driving sun/moon lights, fog and the PMREM environment map.

const CLOUD_VS = `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix*vec4(position,1.0)).xyz - cameraPosition); vec4 p = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); gl_Position = p.xyww; }`;
const CLOUD_FS = `
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb; uniform float uCover; uniform float uNight;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = .5; mat2 m = mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<6;i++){ v += a*noise(p); p = m*p; a *= .5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  if(d.y < 0.01) discard;
  vec2 uv = d.xz/(d.y + .12)*1.3;
  vec2 w = vec2(uTime*.006, uTime*.002);
  float n = fbm(uv + w);
  float n2 = fbm(uv*2.3 - w*1.7 + 3.1);
  float c = smoothstep(uCover, uCover + .28, n*.75 + n2*.35);
  // fake self-shadowing: sample towards sun
  vec2 sd = normalize(uSunDir.xz + 1e-4)*.06;
  float ns = fbm(uv + w + sd)*.75 + fbm((uv + sd)*2.3 - w*1.7 + 3.1)*.35;
  float shade = clamp(1.0 - (ns - (n*.75 + n2*.35))*5.0, .35, 1.25);
  float sunAmt = max(dot(d, uSunDir), 0.0);
  vec3 lit = uSunCol*shade*(0.55 + .45*pow(sunAmt, 6.0)) + uAmb;
  float silver = pow(sunAmt, 12.0)*(1.0 - c)*2.0;
  vec3 col = lit + uSunCol*silver*.4;
  float fade = smoothstep(.01, .22, d.y);
  gl_FragColor = vec4(col, c*fade*.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky(renderer, scene){
  const skyGain = { value: .38 };
  function gainSky(sk){ sk.material.uniforms.uGain = skyGain; sk.material.fragmentShader = 'uniform float uGain;\n' + sk.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor*uGain, 1.0 );'); sk.material.needsUpdate = true; }
  const sky = new Sky(); sky.scale.setScalar(4500); sky.frustumCulled = false; gainSky(sky);
  const U = sky.material.uniforms;
  U.turbidity.value = 2.4; U.rayleigh.value = 1.0; U.mieCoefficient.value = .0022; U.mieDirectionalG.value = .86;
  scene.add(sky);

  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
    uniforms: { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uCover: { value: .48 }, uNight: { value: 0 } }
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), cloudMat); clouds.frustumCulled = false; clouds.renderOrder = -1;
  scene.add(clouds);

  // stars
  const N = 2400, p = new Float32Array(N*3), c = new Float32Array(N*3);
  for(let i = 0; i < N; i++){
    const u = Math.random()*2 - 1, th = Math.random()*Math.PI*2, r = Math.sqrt(1 - u*u);
    const y = Math.abs(u); p[i*3] = r*Math.cos(th)*3800; p[i*3 + 1] = y*3800; p[i*3 + 2] = r*Math.sin(th)*3800;
    const k = .4 + Math.random()*.6, t = Math.random();
    c[i*3] = k*(t < .2 ? .8 : 1); c[i*3 + 1] = k*(.9 + Math.random()*.1); c[i*3 + 2] = k*(t > .8 ? .8 : 1);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3)); sg.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const starMat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const stars = new THREE.Points(sg, starMat); stars.frustumCulled = false; scene.add(stars);

  // moon
  const moonTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(.92, '#e9e3cc'); gr.addColorStop(1, 'rgba(230,225,200,0)'); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
    for(let i = 0; i < 40; i++){ g.fillStyle = `rgba(150,145,130,${.1 + Math.random()*.2})`; g.beginPath(); g.arc(40 + Math.random()*176, 40 + Math.random()*176, 4 + Math.random()*22, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, color: new THREE.Color(3, 3, 3) }));
  moon.scale.set(180, 180, 1); scene.add(moon);

  // lights
  const sun = new THREE.DirectionalLight('#ffffff', 3);
  sun.castShadow = true;
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .035;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight('#bcd4ff', '#5a4a3a', .35); scene.add(hemi);

  scene.fog = new THREE.FogExp2('#b8c4d0', .0042);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky(); envSky.scale.setScalar(100); envScene.add(envSky); gainSky(envSky);
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(100, 32), new THREE.MeshBasicMaterial({ color: '#4a5a3a' })); envGround.rotation.x = -Math.PI/2; envGround.position.y = -2; envScene.add(envGround);
  let envRT = null;

  const state = { tod: 18.9, target: 18.9, dirty: true, envT: 0, sunDir: new THREE.Vector3(), night: 0, lampLevel: 0 };
  const AZ = THREE.MathUtils.degToRad(228);

  const tmpC = new THREE.Color();
  function apply(){
    const t = state.tod;
    const elev = 64*Math.sin(Math.PI*(t - 6.6)/13.4); // degrees
    const az = AZ + (t - 19)*.12;
    const phi = THREE.MathUtils.degToRad(90 - elev);
    state.sunDir.setFromSphericalCoords(1, phi, az);
    U.sunPosition.value.copy(state.sunDir);
    envSky.material.uniforms.sunPosition.value.copy(state.sunDir);
    ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'].forEach(k => envSky.material.uniforms[k].value = U[k].value);

    const day = THREE.MathUtils.smoothstep(elev, -6, 10);       // 0 night .. 1 day
    const golden = Math.max(0, 1 - Math.abs(elev - 4)/14)*day;  // warm near horizon
    const night = 1 - THREE.MathUtils.smoothstep(elev, -10, 2);
    state.night = night; state.day = day; state.golden = golden;
    state.lampLevel = 1 - THREE.MathUtils.smoothstep(elev, -2, 14);

    // sun light
    const sunCol = tmpC.setRGB(1, .97, .92).lerp(new THREE.Color(1, .55, .28), golden);
    sun.color.copy(sunCol);
    sun.intensity = (3.4 + golden*1.2)*day*THREE.MathUtils.smoothstep(elev, -2, 5);
    // moon light at night
    const moonDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), AZ + Math.PI*.85);
    moon.position.copy(moonDir).multiplyScalar(3600);
    moon.material.opacity = night;
    if(night > .5){ sun.color.set('#9fb4e8'); sun.intensity = .55*night; state.lightDir = moonDir; }
    else state.lightDir = state.sunDir;

    hemi.color.setRGB(.55, .68, 1).lerp(new THREE.Color(1, .7, .5), golden*.6).lerp(new THREE.Color(.25, .3, .55), night);
    hemi.groundColor.setRGB(.35, .3, .22).lerp(new THREE.Color(.08, .08, .12), night);
    hemi.intensity = .12 + .22*day - golden*.08;

    // fog color = horizon tint
    const fogDay = new THREE.Color('#a9bccf'), fogGold = new THREE.Color('#d8a27a'), fogNight = new THREE.Color('#141a2c');
    scene.fog.color.copy(fogDay).lerp(fogGold, golden*.85).lerp(fogNight, night);
    scene.fog.density = .0024 + night*.0015;

    starMat.opacity = night*.95;
    cloudMat.uniforms.uSunDir.value.copy(night > .5 ? moonDir : state.sunDir);
    cloudMat.uniforms.uSunCol.value.setRGB(1.6, 1.5, 1.4).lerp(new THREE.Color(2.2, 1.1, .6), golden).lerp(new THREE.Color(.10, .12, .2), night);
    cloudMat.uniforms.uAmb.value.setRGB(.55, .62, .75).lerp(new THREE.Color(.45, .35, .42), golden).lerp(new THREE.Color(.02, .025, .045), night);
    sky.visible = night < .995;
    U.rayleigh.value = 1.0 + golden*1.6;
    state.dirty = true;
    if(state.under) underground();
  }
  // underground: no sky, no sun — torch light, dim cold ambience, dense dark fog
  function underground(){
    sky.visible = false; clouds.visible = false; stars.visible = false; moon.visible = false;
    sun.intensity = 0; sun.castShadow = false;
    hemi.color.set('#a8b2cc'); hemi.groundColor.set('#5a4a3a'); hemi.intensity = 1.7;
    scene.fog.color.set('#1a1714'); scene.fog.density = .011;
    state.lampLevel = 0;
  }

  function updateEnv(){
    if(envRT) envRT.dispose();
    envSky.material.uniforms.rayleigh.value = U.rayleigh.value;
    // at night the sky shader is nearly black: add a dim blue ambience
    envScene.background = null;
    envGround.material.color.setRGB(.28, .3, .22).multiplyScalar(state.day*.9 + .05);
    const prevExp = renderer.toneMappingExposure;
    envRT = pmrem.fromScene(envScene, 0, .1, 300);
    renderer.toneMappingExposure = prevExp;
    scene.environment = envRT.texture;
    scene.environmentIntensity = state.under ? .16 : .3 + .45*state.day - .15*(state.golden || 0) + .5*state.night;
    state.dirty = false;
  }

  apply(); updateEnv();

  return {
    sun, hemi, sky, clouds, state,
    setTime(h, instant){ state.target = h; if(instant){ state.tod = h; apply(); updateEnv(); } },
    setUnderground(on){ if(!!state.under === !!on) return; state.under = !!on;
      if(on){ underground(); } else { clouds.visible = true; stars.visible = true; moon.visible = true; sun.castShadow = true; apply(); }
      updateEnv(); },
    update(dt, t, focus){
      cloudMat.uniforms.uTime.value = t;
      if(Math.abs(state.target - state.tod) > .001){
        let d = state.target - state.tod; if(d > 12) d -= 24; if(d < -12) d += 24;
        const step = Math.sign(d)*Math.min(Math.abs(d), dt*3.2);
        state.tod = (state.tod + step + 24) % 24; apply();
        state.envT += dt; if(state.envT > .35){ state.envT = 0; updateEnv(); }
      } else if(state.dirty){ updateEnv(); }
      // shadow box follows focus
      const L = state.lightDir || state.sunDir;
      sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(L, 80);
      sun.target.updateMatrixWorld();
      stars.position.copy(focus); stars.rotation.y = t*.004;
      clouds.position.set(focus.x, 0, focus.z);
    },
    exposure(){ return state.under ? 1.65 : 0.95 + .35*state.night; }
  };
}

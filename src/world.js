import * as THREE from 'three';

// =====================================================================================
//  World layout: the walled town in the middle, regions around it, lakes & swamp,
//  mountains as the natural border. Heights are sampled once into a cache grid.
// =====================================================================================

function hash2(x, y){ let h = x*374761393 + y*668265263; h = (h ^ (h >>> 13))*1274126177; return ((h ^ (h >>> 16)) >>> 0)/4294967296; }
export function vnoise(x, y){
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf*xf*(3 - 2*xf), v = yf*yf*(3 - 2*yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a)*u + (c - a)*v + (a - b - c + d)*u*v;
}
export function fbm2(x, y, oct){ let s = 0, a = .5, f = 1; for(let i = 0; i < (oct || 5); i++){ s += a*vnoise(x*f, y*f); f *= 2.03; a *= .5; } return s; }
const ss = THREE.MathUtils.smoothstep;

export const TOWN_R = 58;          // walkable radius inside the town wall
export const WALL_R = 60.5;        // wall centre line
export const FLAT_R = 64;          // terrain is flat inside this radius
export const WORLD_R = 345;        // mean radius of the walkable land
export const GATES = [             // angle (rad): 0 = +x (east), PI/2 = +z (south)
  { id: 'S', a: Math.PI/2, n: 'Південна брама' },
  { id: 'N', a: -Math.PI/2, n: 'Північна брама' },
  { id: 'E', a: 0, n: 'Східна брама' },
  { id: 'W', a: Math.PI, n: 'Західна брама' }
];
GATES.forEach(g => { g.cx = Math.cos(g.a); g.sz = Math.sin(g.a); g.in = [g.cx*(TOWN_R - 5), g.sz*(TOWN_R - 5)]; g.out = [g.cx*(WALL_R + 8), g.sz*(WALL_R + 8)]; });

// regions (rank shown on banners; safe = no monsters)
export const ZONES = [
  { id: 'meadow', x: 0, z: 118, r: 28, n: 'Луг слизів', rank: 'F–E' },
  { id: 'grove', x: -112, z: 150, r: 32, n: 'Гоблінський гай', rank: 'E–D' },
  { id: 'camp', x: 118, z: 160, r: 30, n: 'Табір орків', rank: 'C–B' },
  { id: 'ruins', x: 0, z: 262, r: 34, n: 'Руїни мертвих', rank: 'B–A' },
  { id: 'lake', x: -200, z: 10, r: 52, n: 'Тихе озеро', rank: 'D–C' },
  { id: 'swamp', x: -215, z: 200, r: 46, n: 'Гниле болото', rank: 'B' },
  { id: 'darkwood', x: 205, z: -50, r: 58, n: 'Темний ліс', rank: 'C–B' },
  { id: 'farm', x: 165, z: 70, r: 30, n: 'Хутір Вербівка', rank: 'безпечно', safe: true },
  { id: 'mines', x: -55, z: -255, r: 40, n: 'Покинуті шахти', rank: 'A–S' },
  { id: 'shrine', x: 125, z: -215, r: 24, n: 'Святилище Велеса', rank: 'безпечно', safe: true },
  { id: 'heath', x: -120, z: -120, r: 45, n: 'Вовчі пагорби', rank: 'D–C' },
  { id: 'fishing', x: -178, z: 82, r: 22, n: 'Рибальське Поріччя', rank: 'безпечно', safe: true },
  // lands beyond the mountain passes
  { id: 'sun', x: 515, z: 40, r: 92, n: 'Сонцеград', rank: 'столиця королівства', safe: true },
  { id: 'elves', x: -455, z: -150, r: 70, n: 'Лісова Гавань ельфів', rank: 'безпечно', safe: true },
  { id: 'dwarves', x: 62, z: -472, r: 55, n: 'Залізний Кряж гномів', rank: 'безпечно', safe: true },
  { id: 'beasts', x: 30, z: 478, r: 58, n: 'Пухнасті Пагорби', rank: 'село звіролюдей', safe: true },
  { id: 'titan', x: 360, z: -365, r: 120, n: 'Кам\'яні Висі', rank: '☠ КАТАСТРОФА', calamity: true },
  { id: 'fenrir', x: -420, z: 305, r: 120, n: 'Сивий степ', rank: '☠ КАТАСТРОФА', calamity: true },
  { id: 'slimes', x: 405, z: 375, r: 105, n: 'Драглисті топі', rank: '☠ КАТАСТРОФА', calamity: true }
];
// separate valleys joined to the central land by mountain passes
export const LANDS = [
  { x: 515, z: 40, r: 125 }, { x: -455, z: -150, r: 100 }, { x: 62, z: -472, r: 82 }, { x: 30, z: 478, r: 88 },
  { x: 360, z: -365, r: 140 }, { x: -420, z: 305, r: 140 }, { x: 405, z: 375, r: 125 }
];
export const PASSES = [
  [[300, 25], [400, 38], 18], [[-295, -95], [-370, -125], 16], [[25, -320], [50, -400], 16], [[8, 330], [22, 400], 16],
  [[228, -232], [285, -292], 18], [[-252, 222], [-318, 262], 18], [[245, 245], [315, 305], 18],
  [[480, 155], [440, 262], 16], [[470, -78], [420, -240], 16]
];
export const CITY2 = { x: 515, z: 40, R: 80 };
export const Z = id => ZONES.find(z => z.id === id);
export const LAKE = { x: -205, z: 12, r: 46, level: -.7 };
export const ISLAND = { x: -214, z: 4, r: 9 };
export const FORD = [[-158, 10], [-206, 5]];
function distSegW(px, pz, ax, az, bx, bz){ const vx = bx - ax, vz = bz - az, L2 = vx*vx + vz*vz; let t = ((px - ax)*vx + (pz - az)*vz)/L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - vx*t, pz - az - vz*t); }
export const SWAMP = { x: -215, z: 200, r: 48, level: -.08 };

// main roads (polylines), painted as dirt and used for travel
export const ROADS = [
  [[0, 66], [0, 92], [-2, 118], [0, 140], [3, 175], [0, 228]],                 // south road to the ruins
  [[0, 140], [-40, 146], [-80, 150]],                                         // to the goblin grove
  [[0, 140], [45, 150], [92, 158]],                                           // to the orc camp
  [[-66, 0], [-110, 6], [-150, 12]],                                          // west road to the lake
  [[66, 0], [110, 20], [140, 52], [158, 68]],                                 // east road to the farm
  [[140, 52], [175, 10], [190, -30]],                                         // into the dark wood
  [[0, -66], [-10, -110], [-30, -170], [-48, -222]],                          // north road to the mines
  [[-10, -110], [40, -150], [100, -195], [118, -208]],                        // to the shrine
  [[-10, -110], [-70, -115], [-105, -118]],                                   // to the wolf hills
  [[-150, 12], [-170, 80], [-190, 150], [-205, 175]],                         // lake → swamp
  [[200, 20], [300, 25], [400, 38], [434, 40]],                               // east pass to Sonsograd
  [[-190, -60], [-295, -95], [-370, -125], [-420, -140]],                     // west pass to the elves
  [[-10, -110], [10, -240], [25, -320], [50, -400], [60, -440]],              // north pass to the dwarves
  [[0, 228], [8, 330], [22, 400], [28, 440]],                                 // south pass to the beastfolk
  [[118, -208], [228, -232], [285, -292], [330, -340]],                       // to the Stone Heights
  [[-205, 175], [-252, 222], [-318, 262], [-380, 290]],                       // to the Grey Steppe
  [[118, 160], [245, 245], [315, 305], [370, 350]],                           // to the Jelly Marshes
  [[515, 120], [480, 155], [440, 262], [420, 320]], [[515, -40], [470, -78], [420, -240], [390, -300]]
];

function distSeg2(px, pz, ax, az, bx, bz){ const vx = bx - ax, vz = bz - az, L2 = vx*vx + vz*vz; let t = ((px - ax)*vx + (pz - az)*vz)/L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - vx*t, pz - az - vz*t); }
// > 0 inside the walkable land (metres to its edge), < 0 out in the mountains
export function landDist(x, z){
  const a = Math.atan2(z, x);
  let d = WORLD_R + (fbm2(Math.cos(a)*2.2 + 7, Math.sin(a)*2.2 + 3, 3) - .5)*70 - Math.hypot(x, z);
  for(const L of LANDS){ const dl = Math.hypot(x - L.x, z - L.z); if(dl - L.r - 20 > -d) continue; const v = L.r + (fbm2(x*.012 + L.x*.01, z*.012 - L.z*.01, 3) - .5)*40 - dl; if(v > d) d = v; }
  for(const P of PASSES){ const ds = distSeg2(x, z, P[0][0], P[0][1], P[1][0], P[1][1]); if(ds - P[2]/2 - 3 > -d) continue; const v = P[2]/2 + (fbm2(x*.05, z*.05, 2) - .5)*6 - ds; if(v > d) d = v; }
  return d;
}
export function boundaryR(x, z){ const a = Math.atan2(z, x); return WORLD_R + (fbm2(Math.cos(a)*2.2 + 7, Math.sin(a)*2.2 + 3, 3) - .5)*70; }
export function wildDist(x, z){ return landDist(x, z) > 0 ? .5 : 1.5; }
export function zoneAt(x, z){ for(const Zn of ZONES){ if(Math.hypot(x - Zn.x, z - Zn.z) < Zn.r + 6) return Zn; } return null; }

function distSeg(px, pz, ax, az, bx, bz){ const vx = bx - ax, vz = bz - az, L2 = vx*vx + vz*vz; let t = ((px - ax)*vx + (pz - az)*vz)/L2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - vx*t, pz - az - vz*t); }
export function roadDist(x, z){ let d = 1e9; for(const R of ROADS) for(let i = 1; i < R.length; i++){ const v = distSeg(x, z, R[i - 1][0], R[i - 1][1], R[i][0], R[i][1]); if(v < d) d = v; } return d; }

// ------------------------------------------------------------------ heights ----------
function heightRaw(x, z){
  if(x > 2500) return 0;
  const r = Math.hypot(x, z);
  if(r < FLAT_R) return 0;
  const k = ss(r, FLAT_R, FLAT_R + 46);
  let h = (fbm2(x*.0085 + 10, z*.0085 - 4, 5) - .42)*26*k + k*1.5;
  h += (fbm2(x*.03 - 3, z*.03 + 8, 3) - .5)*3.5*k;
  // regions are gentler
  for(const Zn of ZONES){ const d = Math.hypot(x - Zn.x, z - Zn.z); const f = 1 - ss(d, Zn.r*.55, Zn.r*1.25); if(f > 0){ const base = (fbm2(Zn.x*.0085 + 10, Zn.z*.0085 - 4, 2) - .42)*14 + 1.5; h = h*(1 - f*.8) + base*f*.8; } }
  // roads flatten the terrain a little
  const rd = roadDist(x, z); if(rd < 7){ const f = (1 - rd/7)*.35; h = h*(1 - f) + (fbm2(x*.0085 + 10, z*.0085 - 4, 2) - .42)*18*f; }
  // lake bowl with an island
  { const d = Math.hypot(x - LAKE.x, z - LAKE.z) + (fbm2(x*.05, z*.05, 2) - .5)*14; const f = 1 - ss(d, LAKE.r*.62, LAKE.r*1.12);
    if(f > 0){ h = h*(1 - f) + (-4.2 + (1 - Math.min(1, d/LAKE.r))*-1.5)*f; }
    // stone ford from the east shore to the island
    { const fd = distSegW(x, z, FORD[0][0], FORD[0][1], FORD[1][0], FORD[1][1]); const ff = 1 - ss(fd, 1.6, 3.2); if(ff > 0) h = Math.max(h, h*(1 - ff) + (LAKE.level - .35)*ff); }
    const di = Math.hypot(x - ISLAND.x, z - ISLAND.z); const fi = 1 - ss(di, ISLAND.r*.5, ISLAND.r*1.2); if(fi > 0) h = h*(1 - fi) + (1.1 + (fbm2(x*.2, z*.2, 2) - .5))*fi; }
  // swamp: low and flat with puddles
  { const d = Math.hypot(x - SWAMP.x, z - SWAMP.z); const f = 1 - ss(d, SWAMP.r*.6, SWAMP.r*1.15); if(f > 0){ const p = (fbm2(x*.07 + 2, z*.07 - 1, 3) - .5)*1.4 + .12; h = h*(1 - f) + p*f; } }
  // mountains beyond the border
  const ld = landDist(x, z), m = ss(-ld, -6, 90);
  if(m > 0) h += Math.pow(m, 1.25)*(55 + fbm2(x*.012 + 3, z*.012 + 7, 5)*150);
  const far = ss(r, 460, 900)*ss(-ld, 0, 80); if(far > 0) h += Math.pow(Math.max(0, fbm2(x*.004 + 3, z*.004 + 7, 5) - .25), 1.3)*420*far;
  // the capital sits on a levelled terrace
  { const dc = Math.hypot(x - CITY2.x, z - CITY2.z); const fc = 1 - ss(dc, CITY2.R + 4, CITY2.R + 30); if(fc > 0) h = h*(1 - fc); }
  return h;
}

// cached grid (2 m) over the playable area; analytic outside
const HC = { min: -560, step: 2, n: 561 };
let HG = null;
export function initHeights(){
  if(HG) return;
  HG = new Float32Array(HC.n*HC.n);
  for(let j = 0; j < HC.n; j++){ const z = HC.min + j*HC.step; for(let i = 0; i < HC.n; i++) HG[j*HC.n + i] = heightRaw(HC.min + i*HC.step, z); }
}
export function heightAt(x, z){
  if(x > 2500) return 0;
  if(!HG) return heightRaw(x, z);
  const u = (x - HC.min)/HC.step, v = (z - HC.min)/HC.step;
  if(u < 0 || v < 0 || u >= HC.n - 1 || v >= HC.n - 1) return heightRaw(x, z);
  const i = u | 0, j = v | 0, fu = u - i, fv = v - j, k = j*HC.n + i;
  const a = HG[k], b = HG[k + 1], c = HG[k + HC.n], d = HG[k + HC.n + 1];
  return (a*(1 - fu) + b*fu)*(1 - fv) + (c*(1 - fu) + d*fu)*fv;
}
export function normalAt(x, z, out){ const e = 1.0; const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e); return (out || new THREE.Vector3()).set(-hx, 2*e, -hz).normalize(); }

// water
export function waterLevel(x, z){
  if(Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r*1.3) return LAKE.level;
  if(Math.hypot(x - SWAMP.x, z - SWAMP.z) < SWAMP.r*1.25) return SWAMP.level;
  return -99;
}
export function deepWater(x, z){ const w = waterLevel(x, z); return w > -50 && heightAt(x, z) < w - .55; }

// the open land outside the town wall
export const OPT = { hero: false };   // set while resolving the hero (who can swim)
export function inWild(x, z, margin){
  const m = margin || 0, r = Math.hypot(x, z);
  if(x > 2500) return false;
  if(r < WALL_R + 2.2 + m) return false;
  if(landDist(x, z) < m) return false;
  return OPT.hero || !deepWater(x, z);
}

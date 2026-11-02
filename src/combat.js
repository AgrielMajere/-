import * as THREE from 'three';
import { sfx } from './audio.js';
import * as F from './figures.js';
import * as RPG from './rpg.js';
import { heightAt } from './nature.js';
import { WALL_R } from './world.js';
import { softSprite } from './assets.js';

// Combat runtime: monsters, hero attacks & skills, projectiles, effects, loot.
export function createCombat(o){
  const { scene, town, ui, hero, P } = o;
  const monsters = [], projectiles = [], bags = [], allies = [];
  const tmpV = new THREE.Vector3();
  let D = RPG.derived(P, o.appStats);
  const H = { hp: P.hp > 0 ? P.hp : D.maxHp, mp: P.mp > 0 ? P.mp : D.maxMp, cd: {}, atkCd: 0, target: null, buffs: [], dead: false, potCd: 0, queued: null, regenT: 0, combatT: 0 };
  H.hp = Math.min(H.hp, D.maxHp); H.mp = Math.min(H.mp, D.maxMp);
  let shake = 0;

  // ---------------- particles ----------------
  const PN = 900;
  const pPos = new Float32Array(PN*3), pCol = new Float32Array(PN*3), pSize = new Float32Array(PN);
  const parts = []; for(let i = 0; i < PN; i++) parts.push({ life: 0 });
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pCol, 3)); pg.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
  const pm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, uniforms: { map: { value: softSprite() }, scale: { value: 600 } },
    vertexShader: 'attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*600.0/max(.1,-mv.z); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC*t.a, t.a); }' });
  const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; scene.add(pts);
  let pIdx = 0;
  function emit(x, y, z, n, color, spd, life, size, up, spread){
    const c = new THREE.Color(color);
    for(let k = 0; k < n; k++){
      const p = parts[pIdx = (pIdx + 1) % PN];
      const a = Math.random()*Math.PI*2, e = (Math.random() - .3)*Math.PI*(spread || .8);
      const s = spd*(.4 + Math.random()*.8);
      p.x = x; p.y = y; p.z = z; p.vx = Math.cos(a)*Math.cos(e)*s; p.vy = Math.sin(e)*s + (up || 0); p.vz = Math.sin(a)*Math.cos(e)*s;
      p.life = p.max = life*(.6 + Math.random()*.6); p.c = c; p.size = size*(.6 + Math.random()*.7); p.g = up ? -.5 : -6;
    }
  }
  function updParts(dt){
    for(let i = 0; i < PN; i++){
      const p = parts[i];
      if(p.life > 0){ p.life -= dt; p.vy += p.g*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt; p.vx *= .97; p.vz *= .97; const k = Math.max(0, p.life/p.max);
        pPos[i*3] = p.x; pPos[i*3 + 1] = p.y; pPos[i*3 + 2] = p.z; pCol[i*3] = p.c.r*k; pCol[i*3 + 1] = p.c.g*k; pCol[i*3 + 2] = p.c.b*k; pSize[i] = p.size*(.5 + k*.5); }
      else if(pSize[i] !== 0){ pSize[i] = 0; }
    }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true; pg.attributes.size.needsUpdate = true;
  }

  // ---------------- simple FX meshes ----------------
  const fx = [];
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.75, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  function ring(x, y, z, color, r1, dur){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI/2; m.position.set(x, y + .08, z); scene.add(m); fx.push({ m, t: 0, dur: dur || .5, upd: (k) => { const s = .5 + k*r1*2; m.scale.set(s, s, 1); m.material.opacity = 1 - k; } });
  }
  function flashSprite(x, y, z, color, size, dur){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(x, y, z); scene.add(s);
    fx.push({ m: s, t: 0, dur: dur || .35, upd: (k) => { const sc = size*(.6 + k*.8); s.scale.set(sc, sc, 1); s.material.opacity = 1 - k; } });
  }
  const slashTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.7, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 22, 256, 20); return new THREE.CanvasTexture(c); })();
  function slash(x, y, z, heading, color){
    const m = new THREE.Mesh(new THREE.RingGeometry(.9, 1.25, 24, 1, -1.1, 2.2), new THREE.MeshBasicMaterial({ map: slashTex, color: color || '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(-Math.PI/2 + .35, 0, heading + Math.PI/2); scene.add(m);
    fx.push({ m, t: 0, dur: .22, upd: (k) => { m.material.opacity = 1 - k; m.rotation.z = heading + Math.PI/2 - k*.8; } });
  }
  function pillar(x, y, z, color, dur){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.6, .9, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: .5 }));
    m.position.set(x, y + 3, z); scene.add(m); fx.push({ m, t: 0, dur: dur || 1.2, upd: k => { m.material.opacity = .5*(1 - k); m.scale.set(1 + k*.3, 1, 1 + k*.3); } });
  }
  function updFx(dt){ for(let i = fx.length - 1; i >= 0; i--){ const f = fx[i]; f.t += dt; const k = Math.min(1, f.t/f.dur); f.upd(k); if(k >= 1){ scene.remove(f.m); f.m.geometry && f.m.geometry.dispose(); f.m.material.dispose(); fx.splice(i, 1); } } }

  // ---------------- monsters ----------------
  const spawnDefs = town.wild.spawns;
  spawnDefs.forEach((s, i) => {
    const def = RPG.MONSTERS[s.type];
    const sr = ((i*2654435761) >>> 0)/4294967296; // deterministic per spawn so every player agrees
    const lvl = def.lvl[0] + Math.floor(sr*(def.lvl[1] - def.lvl[0] + 1));
    const st = RPG.monsterStats(def, lvl);
    monsters.push({ i, type: s.type, def, lvl, hp: st.hp, atk: st.atk, arm: st.def, maxHp: st.hp, sx: s.x, sz: s.z, wander: s.wander, passive: !!s.passive, horde: s.horde || null, lord: !!s.lord, x: s.x, z: s.z, heading: s.dungeon != null ? Math.PI + (Math.random() - .5) : Math.random()*6.28, state: 'idle', t: Math.random()*3, fig: null, loading: false, dead: !!s.dormant, dormant: !!s.dormant, atkCd: 1 + Math.random(), deadT: s.dormant ? 99 : 0, slow: 0, dots: [], rad: def.slime ? def.slime.size*.42 : (def.fig.width || 1)*.42*(def.fig.height || 1.8)/1.8 + .1, home: true, spCd: 4 });
  });
  async function ensureFig(m){
    if(m.fig || m.loading) return; m.loading = true;
    const def = m.def;
    const f = def.slime ? F.makeSlime(def.slime) : await F.make(def.fig);
    m.fig = f; f.obj.position.set(m.x, heightAt(m.x, m.z), m.z); f.obj.rotation.y = m.heading; scene.add(f.obj);
    if(m.dead) f.obj.visible = false;
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(.5, m.rad + .2), Math.max(.5, m.rad + .2), (f.height || 1.8) + .4, 8), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.y = ((f.height || 1.8) + .4)/2; proxy.userData.mon = m; f.obj.add(proxy); m.proxy = proxy;
  }
  function pickables(){ return monsters.filter(m => m.proxy && !m.dead).map(m => m.proxy); }

  function heroPos(){ return hero.obj.position; }
  function inTownSafe(x, z){ return x < 2500 && Math.hypot(x, z) < WALL_R + 3; }
  const net = o.net || null;
  const isHost = () => !net || net.isHost();
  // everyone a monster may chase: this hero plus remote players
  function targets(){ const p = heroPos(); const list = [{ me: true, x: p.x, z: p.z, dead: H.dead }]; if(o.players) o.players().forEach(r => list.push({ peer: r.peer, x: r.x, z: r.z, dead: r.dead })); if(o.extra) o.extra().forEach(t => list.push(t)); return list; }

  function damageMonster(m, amount, opts){
    if(m.dead) return;
    opts = opts || {};
    m.hp -= amount; m.aggroT = 8; if(m.state !== 'chase' && m.state !== 'attack') m.state = 'chase';
    if(m.horde && !m.provoked) provoke(m);
    const y = heightAt(m.x, m.z) + (m.fig ? m.fig.height : 1.5) + .2;
    ui.float(String(amount), m.x, y, m.z, opts.crit ? 'crit' : opts.dot ? 'dot' : 'dmg');
    if(m.fig){ m.fig.flash(opts.holy ? '#ffe9a0' : '#ff2a1a'); if(!m.fig.busy() && Math.random() < .35 && !m.def.boss) m.fig.oneShot('Hit', { back: 'Idle', speed: 1.4 }); }
    emit(m.x, y - .6, m.z, opts.crit ? 22 : 12, opts.color || (m.def.slime ? m.def.slime.color : m.def.undead ? '#e8e0c8' : '#ff3a2a'), 3.5, .5, .12);
    if(D.buffLeech && !opts.remote && !opts.dot){ heal(amount*D.buffLeech, true); }
    if(m.hp <= 0){ kill(m); return; }
    const def = m.def, k = m.hp/m.maxHp;
    if(def.enrage && !m.enraged && k < def.enrage){ m.enraged = true; ui.toast('🔥 ' + def.n + ' впадає в лють!', 'big'); shake = .5; const yy = heightAt(m.x, m.z); ring(m.x, yy, m.z, '#ff3a10', 6, .8); emit(m.x, yy + 1.5, m.z, 80, '#ff4a1a', 4, 1.1, .22, 2.5); if(m.fig) m.fig.flash('#ff3a10'); }
    if(def.adds && !m.addsDone && k < def.adds.at){ m.addsDone = true; let n = 0;
      monsters.forEach(a => { if(a.dormant && a.dead && a.type === def.adds.type && Math.hypot(a.sx - m.sx, a.sz - m.sz) < 60){ revive(a, a.sx, a.sz); n++; } });
      if(n) ui.toast('📯 ' + def.n + ' кличе підкріплення!', 'big'); }
  }
  // a Calamity's horde wakes as one: hit any of them and the lord with every subject comes for you
  function provoke(m){
    let lord = null;
    monsters.forEach(a => { if(a.horde !== m.horde || a.dead) return; a.provoked = true; if(a.state !== 'chase' && a.state !== 'attack') a.state = 'chase'; if(a.lord) lord = a; });
    if(lord){ ui.toast('☠ ' + lord.def.n + ' прокидається! Уся орда йде на вас!', 'big'); shake = .8; sfx('horn'); }
  }
  function revive(s, x, z){
    s.dead = false; s.hp = s.maxHp; s.x = x; s.z = z; s.state = 'chase'; s.deadT = 0; s.dots = []; if(s.horde) s.provoked = true;
    if(s.fig){ s.fig.obj.visible = true; s.fig.obj.position.set(x, heightAt(x, z), z); s.fig.play('Idle', { fade: 0, restart: true }); }
    emit(x, heightAt(x, z) + .3, z, 40, s.def.undead ? '#5aff8a' : '#ff6a2a', 2, .9, .2, 2); ring(x, heightAt(x, z), z, s.def.undead ? '#5aff8a' : '#ff6a2a', 2, .6);
  }
  function kill(m){
    m.dead = true; m.hp = 0; m.state = 'dead'; m.deadT = 0; m.deaths = (m.deaths || 0) + 1;
    onDeath(m);
  }
  // runs on every client when a monster dies; only those who fought it get rewards
  function onDeath(m){
    if(m.sp){ m.sp.dec && m.sp.dec.dispose(); m.sp = null; }
    if(H.target === m){ H.target = null; ui.target(null); }
    if(m.fig){ m.fig.oneShot(Math.random() < .5 ? 'Death' : 'DeathB', { keep: true, fade: .1 }); }
    if(!m.hitByMe || performance.now() - m.hitByMe > 45000){
      const sh = o.partyShare && o.partyShare(m); // a party member's kill near me
      if(sh){ const lk = Math.max(.25, Math.min(1.6, 1 + (m.lvl - P.lvl)*.12)); gainXp(Math.round(m.def.xp*lk*sh.xp*D.mods.xp)); const g = Math.round(m.def.gold[0]*sh.gold); if(g > 0){ P.gold += g; ui.float('+' + g + ' 💰 (загін)', m.x, heightAt(m.x, m.z) + 2.2, m.z, 'gold'); } RPG.save(); ui.hud(); }
      return;
    }
    m.hitByMe = 0;
    const def = m.def; const WM = o.mods ? o.mods() : { xp: 1, loot: 1 };
    // rewards
    const lvlK = Math.max(.25, Math.min(1.6, 1 + (m.lvl - P.lvl)*.12));
    gainXp(Math.round(def.xp*(1 + (m.lvl - def.lvl[0])*.15)*lvlK*D.mods.xp*WM.xp));
    const gold = Math.round((def.gold[0] + Math.random()*(def.gold[1] - def.gold[0]))*D.mods.gold);
    P.gold += gold; ui.float('+' + gold + ' 💰', m.x, heightAt(m.x, m.z) + 2.2, m.z, 'gold');
    P.kills[m.type] = (P.kills[m.type] || 0) + 1;
    P.quests.forEach(q => { const Q = RPG.QUEST_POOL.find(x => x.id === q.id); if(Q && Q.type === 'kill' && Q.target.includes(m.type) && q.prog < Q.need){ q.prog++; if(q.prog >= Q.need) ui.toast('📜 Завдання «' + Q.n + '» виконано — поверніться до Гільдії'); } });
    if(def.boss){ P.bosses[m.type] = (P.bosses[m.type] || 0) + 1; ui.toast('👑 Переможено боса: ' + def.n + '!', 'big'); shake = .6; }
    if(def.chest){ P.dun.chest = true; P.dun.clears = (P.dun.clears || 0) + 1; setTimeout(() => ui.toast('🗝️ Скарбниця Мінотавра відчинилася — вона за ареною!', 'big'), 1600); }
    const items = [];
    def.drops.forEach(([id, ch, q]) => { if(Math.random() < Math.min(1, ch*D.mods.loot*WM.loot)) items.push({ k: 'mat', id, q }); });
    if(Math.random() < Math.min(1, def.eq*D.mods.loot)){
      const own = Math.random() < .6;
      const C = RPG.CLASSES[P.cls];
      let kind;
      if(own) kind = Math.random() < .55 ? C.wpn : ['armor', 'helm', 'ring', 'amulet', C.off ? 'shield' : 'armor'][Math.floor(Math.random()*5)];
      else { const ks = Object.keys(RPG.WEAPONS).concat(['armor', 'helm', 'shield', 'ring', 'amulet']); kind = ks[Math.floor(Math.random()*ks.length)]; }
      const tier = Math.max(0, Math.min(4, Math.floor((m.lvl - 1)/4.5)));
      const rar = Math.max(def.eqRar || 0, RPG.rarityRoll(D.mods.loot));
      items.push(RPG.makeEquip(kind, tier, rar));
    }
    if(Math.random() < .18) items.push({ k: 'use', id: Math.random() < .6 ? (m.lvl > 9 ? 'hp2' : 'hp1') : (m.lvl > 9 ? 'mp2' : 'mp1'), q: 1 });
    if(items.length) dropBag(m.x, m.z, items);
    o.onKill && o.onKill(m);
    RPG.save(); ui.hud();
  }
  function dropBag(x, z, items){
    const best = items.reduce((a, it) => Math.max(a, it.rar != null ? it.rar : -1), -1);
    const g = new THREE.Group();
    const sack = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 10), new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: .9 })); sack.scale.set(1, .85, 1); sack.position.y = .17; sack.castShadow = true; g.add(sack);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(.05, .09, .1, 8), sack.material); tie.position.y = .36; g.add(tie);
    const col = best >= 0 ? RPG.RARITY[best].c : '#ffd27a';
    const BH = best >= 0 ? [2.6, 4, 8, 12, 18][best] : 2.2;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(best >= 3 ? .14 : .08, best >= 3 ? .35 : .2, BH, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = BH/2; g.add(beam);
    if(best >= 1){ const top = items.find(it => it.rar === best); const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64; const cg = cv.getContext('2d'); cg.font = '600 30px Georgia'; cg.textAlign = 'center'; const nm = RPG.itemIcon(top) + ' ' + RPG.itemName(top); const tw = cg.measureText(nm).width + 28; cg.fillStyle = 'rgba(10,8,6,.72)'; cg.fillRect(256 - tw/2, 8, tw, 46); cg.fillStyle = col; cg.fillText(nm, 256, 41);
      const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false })); lab.scale.set(3.2, .4, 1); lab.position.y = 1.1; lab.renderOrder = 5; g.add(lab); }
    if(best >= 3) sfx('chime');
    beam.position.y = (best >= 2 ? 6 : 2.2)/2; g.add(beam);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(1.2, 1.2, 1); gl.position.y = .3; g.add(gl);
    g.position.set(x + (Math.random() - .5)*.6, heightAt(x, z), z + (Math.random() - .5)*.6); scene.add(g);
    bags.push({ g, items, t: 0, beam });
  }
  function gainXp(n){
    P.xp += n; ui.float('+' + n + ' XP', heroPos().x, heroPos().y + 2.5, heroPos().z, 'xp');
    let up = false;
    while(P.xp >= RPG.xpNeed(P.lvl)){ P.xp -= RPG.xpNeed(P.lvl); P.lvl++; up = true; }
    if(up){ D = RPG.derived(P, o.appStats); H.hp = D.maxHp; H.mp = D.maxMp; const p = heroPos(); pillar(p.x, p.y, p.z, '#ffd27a', 1.6); ring(p.x, p.y, p.z, '#ffd27a', 4, .9); emit(p.x, p.y + .5, p.z, 60, '#ffd27a', 2.5, 1.4, .18, 3); ui.toast('⭐ Новий рівень: ' + P.lvl + '!', 'big'); o.onLevel && o.onLevel(P.lvl); }
  }
  function heal(n, silent){ const before = H.hp; H.hp = Math.min(D.maxHp, H.hp + n); if(!silent && H.hp > before){ const p = heroPos(); ui.float('+' + Math.round(H.hp - before), p.x, p.y + 2.2, p.z, 'heal'); } }

  // ---------------- hero actions ----------------
  function C(){ return RPG.CLASSES[P.cls] || RPG.CLASSES.warrior; }
  function range(){ return C().range || 2.2; }
  function buffVal(k){ let v = 0; H.buffs.forEach(b => { if(b.buff[k]) v += b.buff[k]; }); return v; }
  function heroAtk(){ return Math.round(D.atk*(1 + buffVal('atk'))); }
  function rollCrit(force){ const c = D.crit + buffVal('crit'); return force || Math.random()*100 < c; }
  function faceTo(x, z){ const p = heroPos(); hero.agent.heading = Math.atan2(x - p.x, z - p.z); }
  function nearestMonster(maxD, from){ const p = from || heroPos(); let best = null, bd = maxD || 1e9; monsters.forEach(m => { if(m.dead || !m.fig) return; const d = Math.hypot(m.x - p.x, m.z - p.z); if(d < bd){ bd = d; best = m; } }); return best; }
  function setTarget(m){ H.target = m; ui.target(m); }

  let hitSeq = 0; const hitOut = [];
  function hitMonster(m, mult, opt){
    opt = opt || {};
    if(m.dead) return 0;
    const crit = rollCrit(opt.crit);
    let dmg = RPG.dmgCalc(heroAtk(), m.arm*(opt.pierce ? .5 : 1), mult*(crit ? 1.8 : 1));
    if(opt.holy && m.def.undead) dmg = Math.round(dmg*1.6);
    const dot = opt.dot ? Math.max(1, Math.round(heroAtk()*opt.dot.mult)) : 0;
    m.hitByMe = performance.now();
    if(m.horde && !m.provoked && !isHost() && !m.warned){ m.warned = true; setTimeout(() => { m.warned = false; }, 30000); ui.toast('☠ Ви потривожили орду Катастрофи!', 'big'); }
    if(isHost()){
      damageMonster(m, dmg, { crit, holy: opt.holy, color: opt.color });
      if(dot) m.dots.push({ t: 0, n: opt.dot.ticks, dmg: dot });
      if(opt.slow) m.slow = 3;
    } else {
      // show it now, the host applies it
      hitFx(m, dmg, { crit, holy: opt.holy, color: opt.color });
      hitOut.push([++hitSeq, m.i, dmg, (crit ? 1 : 0) | (opt.holy ? 2 : 0) | (opt.slow ? 4 : 0), dot, opt.dot ? opt.dot.ticks : 0]); while(hitOut.length > 10) hitOut.shift();
      m.hpShown = Math.max(0, (m.hpShown != null ? m.hpShown : m.hp) - dmg);
      if(D.buffLeech) heal(dmg*D.buffLeech, true);
    }
    if(opt.drain) heal(dmg*opt.drain);
    return dmg;
  }
  function hitFx(m, amount, opts){
    const y = heightAt(m.x, m.z) + (m.fig ? m.fig.height : 1.5) + .2;
    ui.float(String(amount), m.x, y, m.z, opts.crit ? 'crit' : 'dmg');
    if(m.fig){ m.fig.flash(opts.holy ? '#ffe9a0' : '#ff2a1a'); if(!m.fig.busy() && Math.random() < .35 && !m.def.boss) m.fig.oneShot('Hit', { back: 'Idle', speed: 1.4 }); }
    emit(m.x, y - .6, m.z, opts.crit ? 22 : 12, opts.color || (m.def.slime ? m.def.slime.color : m.def.undead ? '#e8e0c8' : '#ff3a2a'), 3.5, .5, .12);
  }
  // host: apply hits other players announced in their presence
  const lastSeq = new Map();
  function absorbHits(peer, list){
    if(!Array.isArray(list)) return; const last = lastSeq.get(peer) || 0; let mx = last;
    for(const h of list){ if(!Array.isArray(h) || h.length < 4) continue; const [sq, i, dmg, fl, dot, ticks] = h; if(!(sq > last)) continue; mx = Math.max(mx, sq);
      const m = monsters[i]; if(!m || m.dead || typeof dmg !== 'number' || !(dmg > 0) || dmg > 1e6) continue;
      if(!m.fig){ m.hp -= dmg; if(m.hp <= 0) kill(m); continue; }
      damageMonster(m, Math.round(dmg), { crit: fl & 1, holy: fl & 2, remote: true });
      if(dot > 0 && ticks > 0) m.dots.push({ t: 0, n: Math.min(10, ticks), dmg: Math.min(dot, 1e5) });
      if(fl & 4) m.slow = 3;
      m.aggroPeer = peer; }
    lastSeq.set(peer, mx);
  }
  function basicAttack(){
    const m = H.target; if(!m || m.dead) return;
    const c = C(); const anim = c.atk[Math.floor(Math.random()*c.atk.length)];
    faceTo(m.x, m.z); sfx(c.type === 'melee' ? 'swing' : P.cls === 'archer' ? 'arrow' : 'cast');
    H.atkCd = c.type === 'melee' ? (P.cls === 'rogue' ? .85 : P.cls === 'berserker' ? 1.35 : 1.1) : 1.15;
    H.atkCd /= (1 + buffVal('spd'));
    hero.inst().oneShot(anim, { hitAt: c.type === 'melee' ? .42 : .5, speed: P.cls === 'rogue' ? 1.3 : 1.15, onHit: () => {
      if(m.dead) return;
      if(c.type === 'melee'){ const p = heroPos(); if(Math.hypot(m.x - p.x, m.z - p.z) > range() + m.rad + 1.2) return; slash((p.x + m.x)/2, p.y + 1.2, (p.z + m.z)/2, hero.agent.heading); hitMonster(m, 1); }
      else shoot(m, 1, Object.assign({}, c.bolt));
    } });
  }
  function shoot(m, mult, opt){
    opt = opt || {};
    const p = heroPos(); const from = new THREE.Vector3(p.x + Math.sin(hero.agent.heading)*.5, p.y + 1.35, p.z + Math.cos(hero.agent.heading)*.5);
    spawnProj(from, m, opt.color || '#7ad8ff', opt.speed || 22, opt.arrow, (tgt) => { hitMonster(tgt, mult, opt); if(opt.aoe){ const q = tgt; ring(q.x, heightAt(q.x, q.z), q.z, opt.color, opt.aoe, .5); emit(q.x, heightAt(q.x, q.z) + .6, q.z, 30, opt.color, 5, .6, .2); monsters.forEach(o2 => { if(o2 !== q && !o2.dead && Math.hypot(o2.x - q.x, o2.z - q.z) < opt.aoe) hitMonster(o2, mult*.6, opt); }); } }, opt.big);
  }
  function spawnProj(from, target, color, speed, arrow, onHit, big, hostile){
    let mesh;
    if(arrow){ mesh = new THREE.Group(); const sh = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .8, 5), new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: .8 })); sh.rotation.x = Math.PI/2; mesh.add(sh); const tip = new THREE.Mesh(new THREE.ConeGeometry(.03, .1, 6), new THREE.MeshStandardMaterial({ color: '#aab', metalness: 1, roughness: .3 })); tip.rotation.x = Math.PI/2; tip.position.z = .44; mesh.add(tip); }
    else { mesh = new THREE.Group(); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(big ? 1.6 : .7); mesh.add(s); const core = new THREE.Mesh(new THREE.SphereGeometry(big ? .22 : .09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); mesh.add(core); }
    mesh.position.copy(from); scene.add(mesh);
    projectiles.push({ mesh, target, color, speed, arrow, onHit, hostile, t: 0 });
  }
  function updProj(dt){
    for(let i = projectiles.length - 1; i >= 0; i--){
      const pr = projectiles[i]; pr.t += dt;
      let tx, ty, tz;
      if(pr.hostile){ const p = pr.target === 'hero' ? heroPos() : pr.target.obj.position; tx = p.x; ty = p.y + 1.2; tz = p.z; }
      else { const m = pr.target; tx = m.x; ty = heightAt(m.x, m.z) + (m.fig ? m.fig.height*.6 : 1); tz = m.z; }
      tmpV.set(tx - pr.mesh.position.x, ty - pr.mesh.position.y, tz - pr.mesh.position.z);
      const d = tmpV.length(); const step = pr.speed*dt;
      if(d <= step + .2 || pr.t > 4 || (!pr.hostile && pr.target.dead)){
        scene.remove(pr.mesh); projectiles.splice(i, 1);
        if(!(!pr.hostile && pr.target.dead) && pr.t <= 4){ flashSprite(tx, ty, tz, pr.color, 1.4, .3); emit(tx, ty, tz, 14, pr.color, 3, .4, .14); pr.onHit(pr.target); }
        continue;
      }
      tmpV.multiplyScalar(step/d); pr.mesh.position.add(tmpV);
      if(pr.arrow) pr.mesh.lookAt(tx, ty, tz); else if(Math.random() < .7) emit(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, 1, pr.color, .4, .35, .16, .4);
    }
  }

  function useSkill(idx){
    if(H.dead) return;
    const c = C(); const sk = c.skills[idx]; if(!sk) return;
    if((H.cd[sk.id] || 0) > 0){ ui.toast('Ще перезаряджається'); return; }
    if(H.mp < sk.mp){ ui.toast('Не вистачає мани'); return; }
    const inst = hero.inst(); if(inst && inst.busy()) { H.queued = idx; return; }
    const needT = ['melee', 'proj', 'dash', 'multi'].includes(sk.kind);
    if(needT && (!H.target || H.target.dead)){ const n = nearestMonster(sk.kind === 'melee' ? 6 : 18); if(n) setTarget(n); else { ui.toast('Немає цілі поруч'); return; } }
    const m = H.target, p = heroPos();
    if(sk.kind === 'melee'){ const d = Math.hypot(m.x - p.x, m.z - p.z); if(d > range() + m.rad + .4){ H.queued = idx; o.moveTo(m.x, m.z); return; } }
    if(sk.kind === 'proj' || sk.kind === 'multi'){ const d = Math.hypot(m.x - p.x, m.z - p.z); if(d > (c.range || 14) + 2){ H.queued = idx; o.moveTo(m.x, m.z); return; } }
    H.mp -= sk.mp; H.cd[sk.id] = sk.cd; sfx(sk.kind === 'melee' ? 'swing' : 'cast'); H.combatT = 6;
    if(m && needT) faceTo(m.x, m.z);
    hero.agent.path = [];
    const col = sk.color || (sk.holy ? '#ffe9a0' : '#ffffff');
    const done = { hitAt: sk.kind === 'melee' ? .45 : .5, speed: 1.1 };
    switch(sk.kind){
      case 'melee': inst.oneShot(sk.anim, Object.assign(done, { onHit: () => { if(m.dead) return; slash((p.x + m.x)/2, p.y + 1.2, (p.z + m.z)/2, hero.agent.heading, sk.holy ? '#ffe9a0' : '#ffd0a0'); if(sk.holy) flashSprite(m.x, heightAt(m.x, m.z) + 1, m.z, '#ffe9a0', 3, .4); hitMonster(m, sk.mult, { crit: sk.crit, holy: sk.holy, dot: sk.dot, color: col }); shake = .15; } })); break;
      case 'aoe': inst.oneShot(sk.anim, Object.assign(done, { hitAt: .5, onHit: () => { const q = heroPos(); ring(q.x, q.y, q.z, '#ffd0a0', sk.radius, .45); emit(q.x, q.y + .8, q.z, 40, '#ffe0b0', 6, .5, .14); monsters.forEach(mm => { if(!mm.dead && Math.hypot(mm.x - q.x, mm.z - q.z) < sk.radius + mm.rad) hitMonster(mm, sk.mult); }); shake = .25; } })); break;
      case 'buff': inst.oneShot(sk.anim, Object.assign(done, { onHit: () => { H.buffs = H.buffs.filter(b => b.id !== sk.id); H.buffs.push({ id: sk.id, buff: sk.buff, t: sk.dur, n: sk.n, i: sk.i }); const q = heroPos(); ring(q.x, q.y, q.z, '#ffcf5a', 2.5, .6); emit(q.x, q.y + .2, q.z, 40, sk.buff.dr ? '#ffe9a0' : sk.buff.leech ? '#ff3a4a' : '#ffcf5a', 1.2, 1.2, .16, 2.4); ui.toast(sk.i + ' ' + sk.n); } })); break;
      case 'heal': inst.oneShot(sk.anim, Object.assign(done, { onHit: () => { heal(D.maxHp*sk.heal); const q = heroPos(); pillar(q.x, q.y, q.z, '#7aff9a', 1); emit(q.x, q.y + .2, q.z, 50, '#7aff9a', 1, 1.3, .16, 2.6); } })); break;
      case 'proj': inst.oneShot(sk.anim, Object.assign(done, { onHit: () => shoot(m, sk.mult, { color: col, speed: sk.arrow ? 32 : 20, arrow: sk.arrow, aoe: sk.aoe, slow: sk.slow, drain: sk.drain, holy: sk.holy, crit: sk.crit, big: !!sk.aoe }) })); break;
      case 'multi': inst.oneShot(sk.anim, Object.assign(done, { onHit: () => { const list = monsters.filter(mm => !mm.dead && mm.fig && Math.hypot(mm.x - p.x, mm.z - p.z) < (c.range || 14) + 2).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).slice(0, sk.count); list.forEach((mm, k) => setTimeout(() => shoot(mm, sk.mult, { color: '#e8d8b0', speed: 32, arrow: true }), k*90)); } })); break;
      case 'meteor': { const tx = m ? m.x : p.x + Math.sin(hero.agent.heading)*6, tz = m ? m.z : p.z + Math.cos(hero.agent.heading)*6;
        inst.oneShot(sk.anim, Object.assign(done, { hitAt: .6, onHit: () => { const from = new THREE.Vector3(tx + 6, heightAt(tx, tz) + 22, tz - 4); const fake = { x: tx, z: tz, dead: false, fig: null };
          spawnProj(from, fake, '#ff6a1a', 26, false, () => { const y = heightAt(tx, tz); flashSprite(tx, y + 1, tz, '#ffaa3a', 9, .6); ring(tx, y, tz, '#ff7a2a', sk.radius, .6); emit(tx, y + .5, tz, 90, '#ff8a3a', 8, .9, .25); shake = .5; monsters.forEach(mm => { if(!mm.dead && Math.hypot(mm.x - tx, mm.z - tz) < sk.radius + mm.rad) hitMonster(mm, sk.mult, { color: '#ff7a2a' }); }); }, true); } })); break; }
      case 'dash': { const d = Math.hypot(m.x - p.x, m.z - p.z); const k = Math.max(0, (d - m.rad - .9)/d); const tx = p.x + (m.x - p.x)*k, tz = p.z + (m.z - p.z)*k;
        emit(p.x, p.y + 1, p.z, 30, '#6a5aff', 2, .5, .2); hero.agent.x = tx; hero.agent.z = tz; hero.obj.position.set(tx, heightAt(tx, tz), tz);
        inst.oneShot(sk.anim, Object.assign(done, { hitAt: .3, onHit: () => { if(!m.dead){ slash(m.x, heightAt(m.x, m.z) + 1.1, m.z, hero.agent.heading, '#a08aff'); hitMonster(m, sk.mult, { crit: true }); } } })); break; }
      case 'summon': inst.oneShot(sk.anim, Object.assign(done, { hitAt: .6, onHit: () => summon(sk.dur) })); break;
    }
    ui.hud();
  }
  async function summon(dur){
    allies.forEach(a => { a.t = 0; }); const p = heroPos();
    const f = await F.make({ body: 'bones', look: { eyes: '#b46aff' }, gear: { right: { type: 'sword' }, left: { type: 'shield' } } });
    const x = p.x + Math.sin(hero.agent.heading + 1.2)*1.5, z = p.z + Math.cos(hero.agent.heading + 1.2)*1.5;
    f.obj.position.set(x, heightAt(x, z), z); scene.add(f.obj); emit(x, heightAt(x, z) + .3, z, 60, '#b46aff', 2, 1, .2, 2.4); ring(x, heightAt(x, z), z, '#b46aff', 2, .7);
    allies.push({ fig: f, x, z, t: dur, atkCd: 0, heading: 0 });
  }
  function usePotion(kind){
    if(H.potCd > 0 || H.dead) return;
    const ids = kind === 'hp' ? ['hp3', 'hp2', 'hp1'] : ['mp2', 'mp1'];
    const it = P.inv.find(x => x.k === 'use' && ids.includes(x.id) && x.q > 0);
    if(!it){ ui.toast(kind === 'hp' ? 'Немає зілля здоров\'я' : 'Немає зілля мани'); return; }
    consume(it);
  }
  function consume(it){
    const Cn = RPG.CONSUMABLES[it.id]; it.q--; if(it.q <= 0) P.inv.splice(P.inv.indexOf(it), 1);
    if(Cn.heal) heal(Cn.heal); if(Cn.mana){ H.mp = Math.min(D.maxMp, H.mp + Cn.mana); const p = heroPos(); ui.float('+' + Cn.mana + ' MP', p.x, p.y + 2, p.z, 'mana'); }
    H.potCd = 1; const p = heroPos(); emit(p.x, p.y + .4, p.z, 24, Cn.heal ? '#ff5a6a' : '#5a8aff', 1, .9, .14, 2); RPG.save(); ui.hud();
  }

  function damageHero(amount, srcName){
    if(H.dead) return;
    const gf = o.guard ? o.guard() : 1; if(gf <= 0) return; amount *= gf;
    let dr = D.mods.dr + buffVal('dr'); const defB = 1 + buffVal('def');
    const dmg = Math.max(1, Math.round(RPG.dmgCalc(amount, D.def*defB, 1)*(1 - Math.min(.8, dr))));
    H.hp -= dmg; H.combatT = 6;
    const p = heroPos(); ui.float('-' + dmg, p.x, p.y + 2.1, p.z, 'hurt'); ui.hurt();
    const inst = hero.inst(); if(inst && !inst.busy() && Math.random() < .25) inst.oneShot('Hit', { speed: 1.5, fade: .08 });
    if(H.hp <= 0){ H.hp = 0; heroDie(srcName); }
    ui.hud();
  }
  function heroDie(src){
    H.dead = true; H.target = null; ui.target(null); hero.agent.path = []; sfx('death');
    const inst = hero.inst(); inst && inst.oneShot('Death', { keep: true, fade: .1 });
    P.deaths = (P.deaths || 0) + 1;
    const lost = Math.floor(P.gold*.1); P.gold -= lost;
    monsters.forEach(m => { if(m.state === 'chase' || m.state === 'attack') m.state = 'return'; });
    setTimeout(() => ui.death(src, lost, () => {
      H.dead = false; H.hp = D.maxHp; H.mp = D.maxMp; o.respawn(); const i2 = hero.inst(); i2 && i2.play('Idle', { fade: .3 }); RPG.save(); ui.hud();
    }), 2200);
  }

  // ---------------- per-frame ----------------
  let lazyT = 0;
  function update(dt, t){
    const p = heroPos();
    D = RPG.derived(P, o.appStats); D.buffLeech = buffVal('leech');
    // cooldowns & buffs
    Object.keys(H.cd).forEach(k => { H.cd[k] = Math.max(0, H.cd[k] - dt); });
    H.atkCd = Math.max(0, H.atkCd - dt); H.potCd = Math.max(0, H.potCd - dt);
    H.buffs.forEach(b => { b.t -= dt; if(b.regen && !H.dead) H.hp = Math.min(D.maxHp, H.hp + D.maxHp*b.regen*dt); }); H.buffs = H.buffs.filter(b => b.t > 0);
    H.combatT = Math.max(0, H.combatT - dt);
    H.regenT += dt;
    if(H.regenT > 1 && !H.dead){ H.regenT = 0; const inTown = town.where(p.x, p.z) === 'town'; const k = (H.combatT > 0 ? .004 : inTown ? .05 : .012) + D.mods.regen + buffVal('regen'); H.hp = Math.min(D.maxHp, H.hp + D.maxHp*k); H.mp = Math.min(D.maxMp, H.mp + D.maxMp*(k + .006)); }
    P.hp = Math.round(H.hp); P.mp = Math.round(H.mp);

    // lazy monster creation when the hero approaches
    lazyT -= dt; if(lazyT <= 0){ lazyT = .5; monsters.forEach(m => { if(!m.fig && !m.loading && Math.hypot(m.sx - p.x, m.sz - p.z) < (m.def.calamity ? 200 : 95)) ensureFig(m); }); }

    // hero auto-attack
    const tg = H.target;
    if(tg && !tg.dead && !H.dead){
      const d = Math.hypot(tg.x - p.x, tg.z - p.z), R = range() + tg.rad + (C().type === 'melee' ? .2 : 0);
      if(H.queued != null){ const q = H.queued; const sk = C().skills[q]; const need = sk.kind === 'melee' ? R + .2 : (C().range || 14) + 2; if(d <= need || !['melee', 'proj', 'multi'].includes(sk.kind)){ H.queued = null; hero.agent.path = []; useSkill(q); } }
      else if(d > R){ if(!hero.agent.path.length || (hero.agent._chaseT = (hero.agent._chaseT || 0) - dt) <= 0){ hero.agent._chaseT = .35; const k2 = Math.max(0, (d - R*.8)/d); o.moveTo(p.x + (tg.x - p.x)*k2, p.z + (tg.z - p.z)*k2, true); } }
      else { if(hero.agent.path.length && hero.agent.chasing) hero.agent.path = []; const inst = hero.inst(); if(H.atkCd <= 0 && inst && !inst.busy()) { H.combatT = 6; basicAttack(); } else faceTo(tg.x, tg.z); }
    }

    // monsters: the host simulates, everyone else follows the host's snapshot
    const host = isHost();
    const T = host ? targets() : null;
    monsters.forEach(m => {
      const f = m.fig;
      const dme = Math.hypot(m.x - p.x, m.z - p.z);
      if(f){ f.obj.visible = dme < (m.def.calamity ? 230 : 120) && !(m.dead && m.deadT > 4.5); }
      if(!host){ clientMonster(m, f, dt, dme); return; }
      let tg = null, dh = 1e9, dAny = 1e9;
      for(const t of T){ const d = Math.hypot(m.x - t.x, m.z - t.z); if(d < dAny) dAny = d; if(t.dead || inTownSafe(t.x, t.z)) continue; if(d < dh){ dh = d; tg = t; } }
      // keep chasing the same player while they stay close
      if(m.tgtKey && (m.state === 'chase' || m.state === 'attack')){ const keep = T.find(t => (t.me ? 'me' : t.peer) === m.tgtKey && !t.dead && !inTownSafe(t.x, t.z)); if(keep){ const d = Math.hypot(m.x - keep.x, m.z - keep.z); if(d < dh + 4){ tg = keep; dh = d; } } }
      m.active = dAny < (m.def.calamity ? 200 : 118);
      if(m.dead){
        m.deadT += dt;
        if(f){ if(m.deadT > 3 && m.deadT < 4.5){ f.obj.position.y = heightAt(m.x, m.z) - (m.deadT - 3)*.6; } }
        if(m.dormant) return;
        if(m.deadT > (m.def.respawn || 30) && dAny > 18){ // respawn
          m.enraged = false; m.addsDone = false; m.spCd = 4;
          m.dead = false; m.hp = m.maxHp; m.x = m.sx; m.z = m.sz; m.state = 'idle'; m.dots = [];
          if(f){ f.obj.visible = true; f.obj.position.set(m.x, heightAt(m.x, m.z), m.z); if(f.body === 'slime'){ scene.remove(f.obj); m.fig = null; m.loading = false; m.proxy = null; } else f.play('Idle', { fade: 0, restart: true }); }
        }
        return;
      }
      if(!m.active) return;
      const fx = f || NOFIG;
      m.dots = m.dots.filter(dd => { dd.t += dt; if(dd.t >= 1){ dd.t = 0; dd.n--; damageMonster(m, dd.dmg, { dot: true, color: '#7aff5a' }); } return dd.n > 0 && !m.dead; });
      if(m.dead) return;
      m.slow = Math.max(0, m.slow - dt);
      const spd = m.def.spd*(m.slow > 0 ? .5 : 1)*(m.enraged ? 1.25 : 1);
      const pT = tg || { x: m.sx, z: m.sz };
      if(m.sp){ special(m, dt, pT, fx); if(f){ f.obj.position.set(m.x, heightAt(m.x, m.z), m.z); let dr0 = m.heading - f.obj.rotation.y; while(dr0 > Math.PI) dr0 -= Math.PI*2; while(dr0 < -Math.PI) dr0 += Math.PI*2; f.obj.rotation.y += dr0*Math.min(1, dt*10); f.update(dt, true); f.tick(dt); } return; }
      if(m.def.slam || m.def.charge) m.spCd -= dt*(m.enraged ? 1.4 : 1);
      const fromSpawn = Math.hypot(m.x - m.sx, m.z - m.sz);
      const heroOk = !!tg;
      let moving = false;
      m.atkCd -= dt;
      if(m.state === 'idle' || m.state === 'wander'){
        if(heroOk && dh < (m.provoked ? 90 : m.def.aggro) && (!m.passive || m.provoked)){ m.state = 'chase'; m.tgtKey = tg.me ? 'me' : tg.peer; }
        else { m.t -= dt; if(m.t <= 0){ if(m.state === 'idle'){ m.state = 'wander'; const a = Math.random()*6.28, r = Math.random()*m.wander; m.wx = m.sx + Math.cos(a)*r; m.wz = m.sz + Math.sin(a)*r; m.t = 6; } else { m.state = 'idle'; m.t = 2 + Math.random()*5; } }
          if(m.state === 'wander'){ const dx = m.wx - m.x, dz = m.wz - m.z, dd = Math.hypot(dx, dz); if(dd > .3){ m.x += dx/dd*spd*.45*dt; m.z += dz/dd*spd*.45*dt; m.heading = Math.atan2(dx, dz); moving = 'walk'; } else { m.state = 'idle'; m.t = 2 + Math.random()*4; } } }
      } else if(m.state === 'chase' || m.state === 'attack'){
        const leash = m.horde ? (m.def.calamity ? 75 : 85) : m.def.boss ? 26 : 22;
        if(!heroOk || fromSpawn > leash){ m.state = 'return'; m.tgtKey = null; }
        else {
          m.tgtKey = tg.me ? 'me' : tg.peer;
          const R = m.def.range + m.rad + .3;
          if(dh > R && m.spCd <= 0 && !fx.busy() && trySpecial(m, dh, pT)){ /* started */ }
          else if(dh > R){ const dx = pT.x - m.x, dz = pT.z - m.z; m.x += dx/dh*spd*dt; m.z += dz/dh*spd*dt; m.heading = Math.atan2(dx, dz); moving = 'run'; m.state = 'chase'; }
          else { m.state = 'attack'; m.heading = Math.atan2(pT.x - m.x, pT.z - m.z);
            if(m.spCd <= 0 && !fx.busy() && trySpecial(m, dh, pT)){ /* started */ }
            else if(m.atkCd <= 0 && !fx.busy()){ m.atkCd = m.def.boss ? 1.6 : (m.def.ranged ? 2.2 : 1.7) + Math.random()*.4; monsterAttack(m, tg); } }
        }
      } else if(m.state === 'return'){
        const dx = m.sx - m.x, dz = m.sz - m.z, dd = Math.hypot(dx, dz);
        if(dd > .5){ m.x += dx/dd*spd*1.2*dt; m.z += dz/dd*spd*1.2*dt; m.heading = Math.atan2(dx, dz); moving = 'run'; m.hp = Math.min(m.maxHp, m.hp + m.maxHp*.2*dt); }
        else { m.state = 'idle'; m.t = 2; m.hp = m.maxHp; m.enraged = false; m.addsDone = false; if(m.horde){ m.provoked = false; if(m.lord) monsters.forEach(a => { if(a.horde === m.horde){ a.provoked = false; if(a.dormant && !a.dead){ a.dead = true; a.deadT = 99; if(a.fig) a.fig.obj.visible = false; } } }); } }
      }
      if(moving){ const [rx, rz] = town.resolve(m.x, m.z, Math.max(.3, m.rad*.8)); m.x = rx; m.z = rz; if(inTownSafe(m.x, m.z)){ m.state = 'return'; } }
      m.mv = moving === 'run' ? 2 : moving === 'walk' ? 1 : 0;
      if(!f) return;
      f.obj.position.set(m.x, heightAt(m.x, m.z), m.z);
      let dr = m.heading - f.obj.rotation.y; while(dr > Math.PI) dr -= Math.PI*2; while(dr < -Math.PI) dr += Math.PI*2; f.obj.rotation.y += dr*Math.min(1, dt*8);
      if(!f.busy()) f.play(moving === 'run' ? 'Run' : moving === 'walk' ? 'Walk' : 'Idle', { speed: moving === 'run' ? Math.min(1.3, spd/3.2 + .3) : 1 });
      if(dme < 70) f.update(dt, !!moving); else if(Math.random() < .2) f.update(dt*5, !!moving);
      f.tick(dt);
    });
    if(host && net && net.room){ snapT -= dt; if(snapT <= 0){ snapT = .12; net.mobsOut(buildSnap(), performance.now()); } }
    else if(!host && net) { if(wasHost){ wasHost = false; } }
    if(host && net && !wasHost){ wasHost = true; monsters.forEach(m => { if(m.state === 'attack' || m.state === 'chase') m.state = 'chase'; }); }

    // allies (summoned skeletons)
    for(let i = allies.length - 1; i >= 0; i--){
      const a = allies[i]; a.t -= dt; const f = a.fig;
      if(a.t <= 0){ emit(a.x, heightAt(a.x, a.z) + .8, a.z, 40, '#b46aff', 2, .8, .2, 1); scene.remove(f.obj); allies.splice(i, 1); continue; }
      let tgt = H.target && !H.target.dead ? H.target : nearestMonster(10, { x: a.x, z: a.z });
      let moving = false;
      if(tgt){ const d = Math.hypot(tgt.x - a.x, tgt.z - a.z); if(d > 1.6 + tgt.rad){ a.x += (tgt.x - a.x)/d*3.2*dt; a.z += (tgt.z - a.z)/d*3.2*dt; moving = true; } else { a.atkCd -= dt; if(a.atkCd <= 0 && !f.busy()){ a.atkCd = 1.3; f.oneShot('Attack1H', { onHit: () => { if(!tgt.dead) hitMonster(tgt, .7, { color: '#b46aff' }); } }); } } a.heading = Math.atan2(tgt.x - a.x, tgt.z - a.z); }
      else { const d = Math.hypot(p.x - a.x, p.z - a.z); if(d > 2.5){ a.x += (p.x - a.x)/d*3.6*dt; a.z += (p.z - a.z)/d*3.6*dt; a.heading = Math.atan2(p.x - a.x, p.z - a.z); moving = true; } }
      const [rx, rz] = town.resolve(a.x, a.z, .35); a.x = rx; a.z = rz;
      f.obj.position.set(a.x, heightAt(a.x, a.z), a.z); f.obj.rotation.y = a.heading;
      if(!f.busy()) f.play(moving ? 'Run' : 'Idle'); f.update(dt, moving);
    }

    // loot bags
    for(let i = bags.length - 1; i >= 0; i--){
      const b = bags[i]; b.t += dt; b.g.rotation.y += dt*.8; b.beam.material.opacity = .25 + Math.sin(b.t*3)*.1 + (b.items.some(it => it.rar >= 3) ? Math.sin(b.t*8)*.12 : 0);
      if(Math.hypot(b.g.position.x - p.x, b.g.position.z - p.z) < (H.target && !H.target.dead ? 1.6 : 4) && !H.dead){
        b.items.forEach(it => { const r = RPG.addItem(P, it); if(r) ui.toast((it.k === 'mat' || it.k === 'use' ? RPG.itemIcon(it) + ' ' + RPG.itemName(it) + (it.q > 1 ? ' ×' + it.q : '') : '<b style="color:' + RPG.itemColor(it) + '">' + RPG.itemIcon(it) + ' ' + RPG.itemName(it) + '</b>'), 'loot'); else ui.toast('Рюкзак переповнений!'); });
        emit(b.g.position.x, b.g.position.y + .4, b.g.position.z, 20, '#ffd27a', 2, .6, .12, 2);
        scene.remove(b.g); bags.splice(i, 1); RPG.save(); ui.hud();
      } else if(b.t > 240){ scene.remove(b.g); bags.splice(i, 1); }
    }

    updProj(dt); updFx(dt); updParts(dt);
    shake = Math.max(0, shake - dt*1.6);
  }
  // ---------------- boss specials: telegraphed ground slam & charge ----------------
  const dMat = op => new THREE.MeshBasicMaterial({ color: '#ff2a10', transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  function disposeG(g){ scene.remove(g); g.traverse(o2 => { if(o2.geometry) o2.geometry.dispose(); if(o2.material) o2.material.dispose(); }); }
  function decalCircle(x, z, r){
    const g = new THREE.Group(); g.position.set(x, heightAt(x, z) + .06, z);
    const edge = new THREE.Mesh(new THREE.RingGeometry(r - .14, r, 56), dMat(.9)); edge.rotation.x = -Math.PI/2; g.add(edge);
    const base = new THREE.Mesh(new THREE.CircleGeometry(r, 56), dMat(.1)); base.rotation.x = -Math.PI/2; g.add(base);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 56), dMat(.3)); fill.rotation.x = -Math.PI/2; fill.scale.setScalar(.01); g.add(fill);
    scene.add(g);
    return { setK(k){ const q = Math.min(1, Math.max(.01, k)); fill.scale.set(q, q, 1); edge.material.opacity = .6 + Math.sin(k*28)*.3; }, dispose(){ disposeG(g); } };
  }
  function decalLane(x, z, ang, len, w){
    const g = new THREE.Group(); g.position.set(x, heightAt(x, z) + .06, z); g.rotation.y = ang;
    const mk = (op, ww, ll) => { const ge = new THREE.PlaneGeometry(ww, 1); ge.translate(0, -.5, 0); const m2 = new THREE.Mesh(ge, dMat(op)); m2.rotation.x = -Math.PI/2; m2.scale.y = ll; g.add(m2); return m2; };
    const base = mk(.12, w, len); void base; const fill = mk(.32, w, .01);
    [-1, 1].forEach(sd => { const e = mk(.85, .12, len); e.position.x = sd*(w/2 - .06); });
    scene.add(g);
    return { setK(k){ fill.scale.y = Math.max(.01, Math.min(1, k))*len; }, dispose(){ disposeG(g); } };
  }
  function trySpecial(m, dh, pT){
    const def = m.def; if(!(def.slam || def.charge) || dh > 18) return false;
    const fx = m.fig || NOFIG;
    if(def.charge && dh > 5.5 && (!def.slam || Math.random() < .7)){
      const c = def.charge, ang = Math.atan2(pT.x - m.x, pT.z - m.z); let len = 0;
      for(let d = .5; d <= c.len; d += .5){ if(town.blocked(m.x + Math.sin(ang)*d, m.z + Math.cos(ang)*d, Math.max(.4, m.rad*.7))) break; len = d; }
      if(len < 5) return false;
      m.spId = (m.spId || 0) + 1;
      m.sp = { id: m.spId, kind: 'charge', phase: 'tele', t: 0, tele: c.tele*(m.enraged ? .8 : 1), ang, len, w: c.w, done: 0, mult: c.mult, dec: decalLane(m.x, m.z, ang, len, c.w) };
      m.heading = ang; m.state = 'attack'; fx.play('Idle', { fade: .15 });
      if(Math.hypot(heroPos().x - m.x, heroPos().z - m.z) < 30) ui.toast('⚠️ ' + def.n + ' готується до ривка!'); return true;
    }
    if(def.slam && dh < def.slam.r + 1.2){
      const sl = def.slam; m.spId = (m.spId || 0) + 1;
      m.sp = { id: m.spId, kind: 'slam', t: 0, tele: sl.tele*(m.enraged ? .85 : 1), r: sl.r, mult: sl.mult, dec: decalCircle(m.x, m.z, sl.r) };
      m.state = 'attack'; fx.oneShot(def.atk_anim.includes('Attack2H') ? 'Attack2H' : 'Attack1H', { speed: .5, hitAt: .9, lockFrac: .4 });
      return true;
    }
    return false;
  }
  function slamImpact(m, r, mult){
    const y = heightAt(m.x, m.z), p = heroPos(), near = Math.hypot(p.x - m.x, p.z - m.z) < 60;
    if(near){ ring(m.x, y, m.z, '#ff6a2a', r, .55); flashSprite(m.x, y + .6, m.z, '#ff8a3a', r*1.8, .45); emit(m.x, y + .3, m.z, 70, '#b89870', 7, .9, .24, 2); emit(m.x, y + .3, m.z, 40, '#ff7a2a', 6, .6, .18); shake = Math.max(shake, .75*Math.max(0, 1 - Math.hypot(p.x - m.x, p.z - m.z)/40)); }
    if(!H.dead && Math.hypot(p.x - m.x, p.z - m.z) < r + .2) damageHero(m.atk*(m.enraged ? 1.35 : 1)*mult, m.def.n);
  }
  function chargeHit(m, ang, mult){
    const p = heroPos();
    damageHero(m.atk*(m.enraged ? 1.35 : 1)*mult, m.def.n); shake = .7;
    const kx = p.x + Math.sin(ang)*2.6, kz = p.z + Math.cos(ang)*2.6; const [hx, hz] = town.resolve(kx, kz, .38); hero.agent.x = hx; hero.agent.z = hz; hero.agent.path = [];
  }
  function special(m, dt, pT, f){
    const sp = m.sp, def = m.def; sp.t += dt;
    if(sp.kind === 'slam'){
      sp.dec.setK(sp.t/sp.tele);
      if(sp.t >= sp.tele){ slamImpact(m, sp.r, sp.mult); sp.dec.dispose(); m.sp = null; m.spCd = def.slam.cd*(.85 + Math.random()*.3); m.atkCd = 1.1; }
      return;
    }
    m.heading = sp.ang;
    if(sp.phase === 'tele'){
      sp.dec.setK(sp.t/sp.tele);
      if(Math.random() < .5) emit(m.x, heightAt(m.x, m.z) + .2, m.z, 2, '#a08868', 1.5, .5, .2, .6);
      if(sp.t >= sp.tele){ sp.phase = 'dash'; sp.t = 0; sp.dec.dispose(); sp.dec = null; f.play('Run', { speed: 2.4, fade: .08 }); }
      return;
    }
    const step = sp.len/.55*dt; const ox = m.x, oz = m.z;
    m.x += Math.sin(sp.ang)*step; m.z += Math.cos(sp.ang)*step; sp.done += step;
    const [rx, rz] = town.resolve(m.x, m.z, Math.max(.4, m.rad*.7)); const stuck = Math.hypot(rx - m.x, rz - m.z) > .2; m.x = rx; m.z = rz;
    emit((ox + m.x)/2, heightAt(m.x, m.z) + .2, (oz + m.z)/2, 4, '#a08868', 2, .6, .26, .8);
    const p = heroPos();
    if(!sp.hit && !H.dead && Math.hypot(p.x - m.x, p.z - m.z) < m.rad + 1.0){ sp.hit = true; chargeHit(m, sp.ang, sp.mult); }
    if(sp.done >= sp.len || stuck){
      m.sp = null; m.spCd = def.charge.cd*(.85 + Math.random()*.3); m.atkCd = .8; shake = Math.max(shake, .35);
      ring(m.x, heightAt(m.x, m.z), m.z, '#ff8a3a', 2.5, .4); f.oneShot(def.atk_anim[0], { speed: 1.2 });
    }
  }
  // one swing / shot. tg: { me } or { peer, x, z }. Damage only lands on this client's own hero.
  function monsterAttack(m, tg, fromNet){
    const f = m.fig || NOFIG, def = m.def;
    if(!fromNet){ m.atkSeq = ((m.atkSeq || 0) + 1) % 1000; m.atkTo = tg ? (tg.me ? (net && net.me) || 'me' : tg.peer) : null; m.atkKind = 0; }
    const anim = def.slime ? 'Attack' : def.atk_anim[Math.floor(Math.random()*def.atk_anim.length)];
    if(def.summons && !fromNet && Math.random() < .2){ m.atkKind = 1; f.oneShot('Raise', { hitAt: .6, onHit: () => { for(let k = 0; k < 2; k++){ const s = monsters.find(x => x.type === 'skeleton' && x.dead && Math.hypot(x.sx - m.sx, x.sz - m.sz) < 60); if(s){ const [rx, rz] = town.resolve(m.x + (k ? 2 : -2), m.z - 2, .5); revive(s, rx, rz); } } } }); return; }
    if(fromNet && m.atkKind === 1){ f.oneShot('Raise', {}); return; }
    const mine = tg && tg.me;
    f.oneShot(anim, { hitAt: def.ranged ? .5 : .45, speed: def.boss ? .9 : 1.1, onHit: () => {
      if(m.dead) return;
      const atk = Math.round(m.atk*(m.enraged ? 1.35 : 1)*(o.mods ? o.mods().matk : 1));
      const from = new THREE.Vector3(m.x + Math.sin(m.heading)*.5, heightAt(m.x, m.z) + ((m.fig && m.fig.height) || 1.6)*.75, m.z + Math.cos(m.heading)*.5);
      if(mine){
        const p = heroPos(); const d = Math.hypot(p.x - m.x, p.z - m.z);
        if(def.ranged){ if(m.fig) spawnProj(from, 'hero', def.ranged.color, def.ranged.speed, def.ranged.arrow, () => damageHero(atk, def.n), false, true); else setTimeout(() => damageHero(atk, def.n), 500); }
        else if(d < def.range + m.rad + 1.6){ damageHero(atk, def.n); if(def.boss){ shake = .3; ring(m.x, heightAt(m.x, m.z), m.z, '#ff6a3a', 3, .4); } }
      } else if(!fromNet && tg && tg.npc != null && o.hitNpc){
        const ad = o.extra().find(t => t.npc === tg.npc); if(ad){ const d = Math.hypot(ad.x - m.x, ad.z - m.z); if(def.ranged){ if(m.fig){ const fake = { obj: { position: new THREE.Vector3(ad.x, heightAt(ad.x, ad.z), ad.z) } }; spawnProj(from, fake, def.ranged.color, def.ranged.speed, def.ranged.arrow, () => o.hitNpc(tg.npc, atk), false, true); } else o.hitNpc(tg.npc, atk); } else if(d < def.range + m.rad + 1.6) o.hitNpc(tg.npc, atk); }
      } else if(def.ranged && m.fig && tg && tg.x != null){
        const fake = { obj: { position: new THREE.Vector3(tg.x, heightAt(tg.x, tg.z), tg.z) } };
        spawnProj(from, fake, def.ranged.color, def.ranged.speed, def.ranged.arrow, () => {}, false, true);
      }
    } });
  }

  // ---------------- network: host snapshot out, client snapshot in ----------------
  const NOFIG = { busy: () => false, play(){}, oneShot(n, o2){ if(o2 && o2.onHit) setTimeout(o2.onHit, 420); return .8; }, update(){}, tick(){}, flash(){}, height: 1.6 };
  let snapT = 0, wasHost = false;
  function buildSnap(){
    const list = monsters.filter(m => m.active && !(m.dormant && m.dead));
    const peers = []; const pIdx = k => { if(!k) return -1; let i = peers.indexOf(k); if(i < 0){ peers.push(k); i = peers.length - 1; } return i; };
    const T = targets();
    list.forEach(m => { let d = 1e9; T.forEach(t => { d = Math.min(d, Math.hypot(m.x - t.x, m.z - t.z)); }); m.snapD = d + (m.dead ? 30 : 0) + (m.state === 'idle' ? 10 : 0); });
    list.sort((a, b) => a.snapD - b.snapD);
    const out = [];
    for(const m of list){
      const st = m.dead ? 4 : m.state === 'attack' ? 3 : (m.mv || 0);
      const e = [m.i, Math.round(m.x*10), Math.round(m.z*10), Math.round(m.heading*100), Math.max(0, Math.round(m.hp/m.maxHp*1000)), st + (m.enraged ? 10 : 0), m.atkSeq || 0, pIdx(m.atkTo), m.atkKind || 0];
      if(m.sp){ const sp = m.sp; if(sp.kind === 'slam') e.push(sp.id, 1, Math.round(Math.max(0, sp.tele - sp.t)*100), Math.round(sp.r*10), Math.round(sp.mult*10)); else e.push(sp.id, sp.phase === 'tele' ? 2 : 3, Math.round(Math.max(0, sp.tele - sp.t)*100), Math.round(sp.ang*100), Math.round(sp.len*10), Math.round(sp.w*10), Math.round(sp.mult*10)); }
      out.push(e);
      if(out.length >= 75) break;
    }
    let snap = { m: out, T: peers, e: Date.now() % 1e7 };
    while(JSON.stringify(snap).length > 3900 && out.length > 5){ out.pop(); snap = { m: out, T: peers, e: snap.e }; }
    return snap;
  }
  function applySnap(snap){
    if(!snap || !Array.isArray(snap.m)) return;
    const now = performance.now();
    snap.m.forEach(e => { if(!Array.isArray(e)) return; const m = monsters[e[0]]; if(!m) return; m.net = e; m.netT = snap.T || []; m.netAt = now; });
  }
  function clientMonster(m, f, dt, dme){
    const e = m.net;
    if(!e || performance.now() - m.netAt > 4000){ // nothing from the host about it: idle in place
      if(f && !m.dead){ f.obj.position.set(m.x, heightAt(m.x, m.z), m.z); if(!f.busy()) f.play('Idle'); if(dme < 70) f.update(dt, false); f.tick(dt); }
      if(m.dead){ m.deadT += dt; }
      return;
    }
    const nx = e[1]/10, nz = e[2]/10, hd = e[3]/100, hp = e[4]/1000*m.maxHp, stc = e[5], st = stc % 10, enr = stc >= 10;
    const first = !m.seen; m.seen = true;
    if(st === 4){
      if(!m.dead){ m.dead = true; m.hp = 0; m.state = 'dead'; m.x = nx; m.z = nz; if(first){ m.deadT = 99; } else { m.deadT = 0; onDeath(m); } }
      m.deadT += dt; if(f){ if(m.deadT > 3 && m.deadT < 4.5) f.obj.position.y = heightAt(m.x, m.z) - (m.deadT - 3)*.6; }
      return;
    }
    if(m.dead){ // respawned or summoned
      m.dead = false; m.deadT = 0; m.x = nx; m.z = nz;
      if(f){ if(f.body === 'slime'){ scene.remove(f.obj); m.fig = null; m.loading = false; m.proxy = null; return; } f.obj.visible = true; f.play('Idle', { fade: 0, restart: true }); }
      if(!first) emit(nx, heightAt(nx, nz) + .3, nz, 30, m.def.undead ? '#5aff8a' : '#ff6a2a', 2, .9, .2, 2);
    }
    if(!m.enraged && enr && !first) ui.toast('🔥 ' + m.def.n + ' впадає в лють!', 'big');
    m.enraged = enr; m.hp = hp; m.state = st === 3 ? 'attack' : st ? 'chase' : 'idle';
    if(Math.hypot(nx - m.x, nz - m.z) > 8) { m.x = nx; m.z = nz; }
    else { const k = Math.min(1, dt*9); m.x += (nx - m.x)*k; m.z += (nz - m.z)*k; }
    m.heading = hd;
    // attack events
    const seq = e[6];
    if(m.lastSeq == null) m.lastSeq = seq;
    else if(seq !== m.lastSeq){ m.lastSeq = seq; m.atkKind = e[8];
      const to = (m.netT || [])[e[7]]; const mine = net && to === net.me;
      let tg = null; if(mine) tg = { me: true }; else if(to && o.players){ const r = o.players().find(q => q.peer === to); if(r) tg = { peer: to, x: r.x, z: r.z }; }
      if(f && dme < 90) monsterAttack(m, tg, true); else if(mine) monsterAttack(m, tg, true);
    }
    // specials announced by the host
    if(e.length > 9){
      const id = e[9], kind = e[10];
      if(m.spSeen !== id){ m.spSeen = id; if(m.csp && m.csp.dec) m.csp.dec.dispose(); m.csp = null;
        if(kind === 1) m.csp = { kind: 'slam', left: e[11]/100, r: e[12]/10, mult: e[13]/10, dec: decalCircle(nx, nz, e[12]/10) };
        else { m.csp = { kind: 'charge', left: e[11]/100, ang: e[12]/100, len: e[13]/10, w: e[14]/10, mult: e[15]/10, dec: kind === 2 ? decalLane(nx, nz, e[12]/100, e[13]/10, e[14]/10) : null, dashT: kind === 3 ? 0 : -1 };
          if(Math.hypot(heroPos().x - nx, heroPos().z - nz) < 30) ui.toast('⚠️ ' + m.def.n + ' готується до ривка!'); }
        if(m.csp) m.csp.tele = m.csp.left;
        if(f && kind === 1) f.oneShot(m.def.atk_anim.includes('Attack2H') ? 'Attack2H' : 'Attack1H', { speed: .5, hitAt: .9, lockFrac: .4 });
      }
    }
    const c = m.csp;
    if(c){
      c.left -= dt;
      if(c.kind === 'slam'){ if(c.dec) c.dec.setK(1 - Math.max(0, c.left)/Math.max(.01, c.tele)); if(c.left <= 0){ slamImpact(m, c.r, c.mult); if(c.dec) c.dec.dispose(); m.csp = null; } }
      else {
        if(c.dec){ c.dec.setK(1 - Math.max(0, c.left)/Math.max(.01, c.tele)); if(c.left <= 0){ c.dec.dispose(); c.dec = null; c.dashT = 0; if(f) f.play('Run', { speed: 2.4, fade: .08 }); } }
        else if(c.dashT >= 0){ c.dashT += dt; const p = heroPos(); if(!c.hit && !H.dead && Math.hypot(p.x - m.x, p.z - m.z) < m.rad + 1.0){ c.hit = true; chargeHit(m, c.ang, c.mult); } if(c.dashT > .8) m.csp = null; }
      }
    }
    if(!f) return;
    f.obj.position.set(m.x, heightAt(m.x, m.z), m.z);
    let dr = m.heading - f.obj.rotation.y; while(dr > Math.PI) dr -= Math.PI*2; while(dr < -Math.PI) dr += Math.PI*2; f.obj.rotation.y += dr*Math.min(1, dt*8);
    const moving = st === 1 || st === 2;
    if(!f.busy() && !(c && c.dashT >= 0)) f.play(st === 2 ? 'Run' : st === 1 ? 'Walk' : 'Idle', { speed: st === 2 ? Math.min(1.3, m.def.spd/3.2 + .3) : 1 });
    if(dme < 70) f.update(dt, moving); else if(Math.random() < .2) f.update(dt*5, moving);
    f.tick(dt);
  }
  if(net) net.listeners.snap.push(applySnap);
  return {
    update, monsters, pickables, setTarget, useSkill, usePotion, consume, H, get D(){ return D; }, recalc(){ D = RPG.derived(P, o.appStats); H.hp = Math.min(H.hp, D.maxHp); H.mp = Math.min(H.mp, D.maxMp); },
    gainXp, damage: damageMonster, absorbHits, hitOut, isHost, shake: () => shake, fullHeal(){ H.hp = D.maxHp; H.mp = D.maxMp; ui.hud(); }, nearestMonster, emit, ring, pillar,
    proj(from, m, color, arrow){ spawnProj(from, m, color, arrow ? 30 : 22, arrow, () => {}, false, false); }
  };
}

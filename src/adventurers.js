// =====================================================================================
//  NPC adventurers: three small parties that roam the hunting grounds, fight monsters,
//  help nearby players and can be invited to travel together.
//  The host simulates them and publishes a compact snapshot on the "npcs" channel;
//  everyone else interpolates that snapshot.
// =====================================================================================
import * as THREE from 'three';
import { Z as zone, inWild } from './world.js';

export const PARTIES = [
  { n: 'Загін «Іскра»', lvl: 9, zones: ['meadow', 'grove', 'heath', 'lake'] },
  { n: 'Загін «Сталеві Ікла»', lvl: 18, zones: ['darkwood', 'camp', 'heath', 'swamp'] },
  { n: 'Загін «Світанок»', lvl: 28, zones: ['ruins', 'mines', 'swamp', 'darkwood'] }
];

export const ADV_DEFS = [
  { id: 'adv0', party: 0, role: 'melee', body: 'soldier', look: { armor: '#a8a090' }, gear: { right: { type: 'greatsword' }, cape: '#8a2a1a' }, name: 'Воїн Добриня', atk: ['Attack2H', 'Slice2H'],
    lines: ['Слизи? Ха! Розминка перед обідом.', 'Тримайтеся за мною — я прикрию.', 'Ще одна пригода — і я куплю собі нового коня.'] },
  { id: 'adv1', party: 0, role: 'mage', body: 'woman', look: { top: '#2a3a6a', bottom: '#2a2a3a', hair: '#d8a050' }, gear: { right: { type: 'staff', color: '#7ad8ff' }, cape: '#2a3a6a' }, name: 'Магиня Злата', atk: ['Cast'], bolt: '#7ad8ff',
    lines: ['Не стійте в радіусі вогняної кулі, добре?', 'Я вивчаю магію лише третій рік. Але вже непогано!'] },
  { id: 'adv2', party: 1, role: 'ranged', body: 'man', look: { top: '#3a4a2a', bottom: '#2a2620', hat: '#3a3020' }, gear: { right: { type: 'bow' }, cape: '#3a4a2a' }, name: 'Мисливець Яр', atk: ['Bow'], arrow: true,
    lines: ['Вітер з півночі. Звір нас не почує.', 'У Темному лісі розбійники знову підняли голови.'] },
  { id: 'adv3', party: 1, role: 'melee', body: 'woman', look: { top: '#1e1e22', bottom: '#2a2228', hair: '#e8e2d8' }, gear: { right: { type: 'dagger' }, left: { type: 'dagger' }, beast: { kind: 'cat', color: '#e8e2d8', inner: '#e8b0b0', tip: '#2a2a30' } }, name: 'Котолюдка Тея', atk: ['Attack1H', 'Slash'],
    lines: ['Мяу! Я перша до здобичі!', 'Яр стріляє, я ріжу. Чесний поділ.'] },
  { id: 'adv4', party: 2, role: 'melee', body: 'soldier', look: { armor: '#d8c890' }, gear: { right: { type: 'sword', gold: true }, left: { type: 'shield', kite: true }, cape: '#e8e0c8' }, name: 'Паладин Ратибор', atk: ['Attack1H', 'Slash'],
    lines: ['Світло з нами. Нежить не пройде.', 'Ранг A — це не привід розслаблятися.'] },
  { id: 'adv5', party: 2, role: 'heal', body: 'woman', look: { top: '#efe8d8', bottom: '#d8d0c0', hair: '#3a2a20' }, gear: { right: { type: 'scepter' }, cape: '#efe8d8' }, name: 'Жриця Влада', atk: ['Cast'], bolt: '#ffe9a0',
    lines: ['Тримайтеся ближче — я встигну зцілити.', 'Ратибор знову поліз уперед без мене…'] }
];

export function createAdventurers(o){
  const { npcs, net, town, heightAt, step, say } = o;
  const list = ADV_DEFS.map((d, i) => { const n = npcs.find(q => q.def.id === d.id); if(!n) return null;
    const P = PARTIES[d.party]; const max = Math.round(140 + P.lvl*48);
    return { i, d, n, p: d.party, max, hp: max, atk: Math.round(10 + P.lvl*4.6), dead: false, deadT: 0, atkCd: Math.random(), healCd: 0, act: 0, actSeen: 0, chatT: 6 + Math.random()*20, tgt: null, net: null }; }).filter(Boolean);
  const parties = PARTIES.map((P, k) => ({ k, P, zi: k, goal: null, follow: null, followUntil: 0, tgt: null, idleT: 0 }));
  let ch = null, outT = 0, lastSnap = null;
  const host = () => !net || !net.room || net.isHost();
  const alive = k => list.filter(a => a.p === k && !a.dead);
  const posOf = key => { if(key === 'me' || key === (net && net.me)) return o.me(); const r = o.players().find(q => q.peer === key); return r ? { x: r.x, z: r.z, dead: r.dead } : null; };

  // spread the parties over their first zones
  list.forEach(a => { const Zn = zone(PARTIES[a.p].zones[a.p % PARTIES[a.p].zones.length]); const [x, z] = town.randomFree(Zn.x, Zn.z, Zn.r*.4); a.n.a.x = x + (a.i % 2)*1.5; a.n.a.z = z; parties[a.p].zi = a.p % PARTIES[a.p].zones.length; });

  function pickGoal(pt){
    const zs = pt.P.zones; pt.zi = (pt.zi + 1 + Math.floor(Math.random()*(zs.length - 1))) % zs.length; const Zn = zone(zs[pt.zi]);
    for(let t = 0; t < 20; t++){ const a = Math.random()*6.28, r = Math.random()*Zn.r*.55; const x = Zn.x + Math.cos(a)*r, z = Zn.z + Math.sin(a)*r; if(inWild(x, z, 2) && !town.blocked(x, z, .6)) return [x, z]; }
    return [Zn.x, Zn.z];
  }
  function canFight(m){ return m && !m.dead && !(m.passive && !m.provoked) && !(m.dormant && m.dead); }
  function findTarget(pt, lx, lz){
    const mons = o.combat() ? o.combat().monsters : []; let best = null, bd = 1e9;
    const me = o.me(); const pl = [me].concat(o.players());
    for(const m of mons){ if(!canFight(m) || !m.active) continue; const d = Math.hypot(m.x - lx, m.z - lz);
      // help: monsters already fighting a player close to the party
      let help = false; if(m.state === 'chase' || m.state === 'attack'){ for(const p of pl){ if(p && !p.dead && Math.hypot(p.x - lx, p.z - lz) < 26 && Math.hypot(p.x - m.x, p.z - m.z) < 10){ help = true; break; } } }
      const lim = help ? 30 : pt.follow ? 14 : 18; if(d > lim) continue; const sc = d - (help ? 12 : 0); if(sc < bd){ bd = sc; best = m; } }
    return best;
  }
  function anim(a, name, back){ const inst = a.n.inst; if(inst && !inst.busy()) inst.oneShot(name, { back: back || 'Idle', speed: 1.05 }); }
  function attack(a, m){
    a.act = (a.act + 1) % 100; const name = a.d.atk[Math.floor(Math.random()*a.d.atk.length)]; anim(a, name);
    const dmg = Math.max(1, Math.round(a.atk*(.85 + Math.random()*.3)));
    const C = o.combat(); if(!C) return;
    const hit = () => { if(!m.dead) C.damage(m, dmg, { color: a.d.bolt || '#ffd27a' }); };
    if(a.d.role === 'melee') setTimeout(hit, 380);
    else { const from = new THREE.Vector3(a.n.a.x, heightAt(a.n.a.x, a.n.a.z) + 1.4, a.n.a.z); const to = new THREE.Vector3(m.x, heightAt(m.x, m.z) + 1.2, m.z); o.proj && o.proj(from, m, a.d.bolt || '#e8d8b0', !!a.d.arrow); setTimeout(hit, 420 + Math.min(500, from.distanceTo(to)*25)); }
  }
  function moveTo(a, x, z, run){ a.n.a.path = [[x, z]]; a.run = !!run; }

  function hostTick(dt, T){
    parties.forEach(pt => {
      const mem = alive(pt.k); if(!mem.length) return;
      const L = mem[0], la = L.n.a;
      if(pt.follow){ const fp = posOf(pt.follow); if(!fp || performance.now() > pt.followUntil || Math.hypot(fp.x - la.x, fp.z - la.z) > 160){ pt.follow = null; o.onFollow && o.onFollow(pt.k, null); } }
      // combat target for the whole party
      if(!canFight(pt.tgt) || Math.hypot(pt.tgt.x - la.x, pt.tgt.z - la.z) > 34){ pt.tgt = null; }
      if(!pt.tgt){ pt.scanT = (pt.scanT || 0) - dt; if(pt.scanT <= 0){ pt.scanT = .6; pt.tgt = findTarget(pt, la.x, la.z); if(pt.tgt && Math.random() < .3){ const near = Math.hypot(o.me().x - la.x, o.me().z - la.z) < 20; if(near) say(L.n, ['До бою!', 'Бачу ціль!', 'Обережно, звір!', 'Прикрийте мене!'][Math.floor(Math.random()*4)]); } } }
      const m = pt.tgt;
      mem.forEach((a, idx) => {
        const A = a.n.a;
        // healer keeps the party standing
        a.healCd -= dt;
        if((a.d.role === 'heal' || a.d.role === 'mage') && a.healCd <= 0){ const hurt = mem.find(b => b.hp < b.max*.55); if(hurt){ a.healCd = a.d.role === 'heal' ? 4 : 9; hurt.hp = Math.min(hurt.max, hurt.hp + hurt.max*(a.d.role === 'heal' ? .3 : .15)); a.act = (a.act + 1) % 100; anim(a, 'Cast'); o.healFx && o.healFx(hurt.n.a.x, hurt.n.a.z); } }
        if(m){
          const R = a.d.role === 'melee' ? 1.6 + (m.rad || .5) : 9;
          const d = Math.hypot(m.x - A.x, m.z - A.z);
          if(d > R){ const k = (d - R*.8)/d; moveTo(a, A.x + (m.x - A.x)*k + (idx ? 1 : -1)*.6, A.z + (m.z - A.z)*k, true); }
          else { A.path = []; A.heading = Math.atan2(m.x - A.x, m.z - A.z); a.atkCd -= dt; if(a.atkCd <= 0){ a.atkCd = a.d.role === 'melee' ? 1.4 : 1.9; attack(a, m); } }
        } else if(idx === 0){
          // the leader travels: towards the followed player or the next hunting spot
          if(pt.follow){ let fp = posOf(pt.follow); if(fp && town.where(fp.x, fp.z) !== 'wild'){ const G = town.nearestGate(fp.x, fp.z); fp = { x: G.out[0], z: G.out[1] }; } if(fp){ const d = Math.hypot(fp.x - A.x, fp.z - A.z); if(d > 4.5 && (!A.path.length || (pt.repT = (pt.repT || 0) - dt) <= 0)){ pt.repT = 1; const k = (d - 3)/d; const gx = A.x + (fp.x - A.x)*k, gz = A.z + (fp.z - A.z)*k; A.path = d < 40 ? [[gx, gz]] : town.findPathWild(A.x, A.z, gx, gz); a.run = d > 9; } } }
          else if(!A.path.length){ pt.idleT -= dt; if(pt.idleT <= 0){ if(!pt.goal || Math.hypot(pt.goal[0] - A.x, pt.goal[1] - A.z) < 3 || Math.random() < .25) pt.goal = pickGoal(pt); const [gx, gz] = pt.goal; const d = Math.hypot(gx - A.x, gz - A.z); A.path = d > 400 ? [[A.x + (gx - A.x)*.5, A.z + (gz - A.z)*.5]] : town.findPathWild(A.x, A.z, gx, gz); if(!A.path.length) A.path = [[gx, gz]]; a.run = false; pt.idleT = 6 + Math.random()*10; } }
        } else {
          // the others keep beside the leader
          const side = idx % 2 ? 1 : -1, hx = Math.sin(la.heading), hz = Math.cos(la.heading);
          const tx = la.x - hx*1.6 + hz*side*1.8, tz = la.z - hz*1.6 - hx*side*1.8; const d = Math.hypot(tx - A.x, tz - A.z);
          if(d > 1.2){ moveTo(a, tx, tz, d > 5 || L.run); } else if(!la.moving){ A.path = []; }
        }
        // out of combat regeneration
        if(!m) a.hp = Math.min(a.max, a.hp + a.max*.03*dt);
        step(A, dt, a.run ? 4.0 : 1.7);
      });
    });
    // the dead get back on their feet near their party after a while
    list.forEach(a => { if(!a.dead) return; a.deadT += dt; if(a.deadT > 25){ const mem = alive(a.p); const L = mem[0]; let x, z; if(L){ x = L.n.a.x + 1.5; z = L.n.a.z + 1.5; } else { const G = town.nearestGate(a.n.a.x, a.n.a.z); x = G.out[0]; z = G.out[1]; } [x, z] = town.resolve(x, z, .5); a.n.a.x = x; a.n.a.z = z; a.n.a.path = []; a.dead = false; a.hp = a.max*.6; a.act = (a.act + 1) % 100; if(a.n.inst) a.n.inst.play('Idle', { fade: 0, restart: true }); } });
    // follow requests from players: own choice + others' presence
    if(net && net.room) net.others().forEach(r => { const f = r.presence && r.presence.fol; if(Array.isArray(f)){ const [k, on] = f; const pt = parties[k | 0]; if(!pt) return; if(on && !pt.follow){ setFollow(k, r.peer); } else if(!on && pt.follow === r.peer){ pt.follow = null; } } });
    // publish
    if(net && net.room){ if(!ch){ ch = net.channel('npcs'); } outT -= dt; if(outT <= 0){ outT = .2; ch.out({ v: 1, a: list.map(a => [Math.round(a.n.a.x*10), Math.round(a.n.a.z*10), Math.round(a.n.a.heading*100), Math.round(a.hp/a.max*1000), a.act, a.n.a.moving ? (a.run ? 2 : 1) : 0, a.dead ? 1 : 0]), f: parties.map(p => p.follow === 'me' ? (net.me || null) : p.follow) }, performance.now()); } }
  }
  function clientTick(dt){
    if(!ch && net && net.room) ch = net.channel('npcs');
    const S = ch && ch.snap; if(!S || !Array.isArray(S.a)) return;
    if(Array.isArray(S.f)) parties.forEach((p, k) => { p.follow = S.f[k] || null; });
    list.forEach((a, i) => { const r = S.a[i]; if(!Array.isArray(r)) return; const A = a.n.a;
      const tx = r[0]/10, tz = r[1]/10; if(Math.hypot(tx - A.x, tz - A.z) > 25){ A.x = tx; A.z = tz; } else { const k = Math.min(1, dt*6); A.x += (tx - A.x)*k; A.z += (tz - A.z)*k; }
      A.heading = r[2]/100; A.moving = r[5] > 0; a.run = r[5] === 2; a.hp = r[3]/1000*a.max;
      const dead = !!r[6]; if(dead && !a.dead){ a.dead = true; if(a.n.inst) a.n.inst.oneShot('Death', { keep: true, fade: .1 }); } else if(!dead && a.dead){ a.dead = false; if(a.n.inst) a.n.inst.play('Idle', { fade: 0, restart: true }); }
      if(r[4] !== a.actSeen){ a.actSeen = r[4]; if(!a.dead) anim(a, a.d.atk[Math.floor(Math.random()*a.d.atk.length)]); } });
  }
  function setFollow(k, key){ const pt = parties[k]; if(!pt) return; pt.follow = key; pt.followUntil = performance.now() + 15*60*1000; pt.tgt = null; o.onFollow && o.onFollow(k, key); }

  return {
    list, parties,
    update(dt){
      const isH = host();
      if(isH) hostTick(dt); else clientTick(dt);
      list.forEach(a => { const n = a.n, A = n.a; const far = Math.hypot(A.x - o.me().x, A.z - o.me().z) > 90;
        n.obj.visible = !far && !(a.dead && a.deadT > 6); n.obj.position.set(A.x, heightAt(A.x, A.z), A.z);
        let dr = A.heading - n.obj.rotation.y; while(dr > Math.PI) dr -= Math.PI*2; while(dr < -Math.PI) dr += Math.PI*2; n.obj.rotation.y += dr*Math.min(1, dt*8);
        if(n.inst && !far){ n.inst.update(dt, A.moving); if(!n.inst.busy() && !a.dead) n.inst.play(A.moving ? (a.run ? 'Run' : 'Walk') : 'Idle'); n.inst.tick && n.inst.tick(dt); }
        a.chatT -= dt; if(a.chatT <= 0 && !a.dead){ a.chatT = 25 + Math.random()*40; if(!far && Math.hypot(A.x - o.me().x, A.z - o.me().z) < 14) say(n, a.d.lines[Math.floor(Math.random()*a.d.lines.length)]); } });
    },
    // monsters may chase adventurers (host only)
    targets(){ return list.filter(a => !a.dead).map(a => ({ peer: 'npc:' + a.i, npc: a.i, x: a.n.a.x, z: a.n.a.z, dead: false })); },
    hit(i, dmg){ const a = list[i]; if(!a || a.dead) return; a.hp -= dmg*.75; if(a.n.inst && a.n.inst.flash) a.n.inst.flash('#ff2a1a'); if(a.hp <= 0){ a.hp = 0; a.dead = true; a.deadT = 0; a.act = (a.act + 1) % 100; parties[a.p].tgt = parties[a.p].tgt; if(a.n.inst) a.n.inst.oneShot('Death', { keep: true, fade: .1 }); } },
    party: k => parties[k],
    // the local player asks a party to come along (host applies directly, clients through presence)
    invite(k, on){ if(host()){ if(on) setFollow(k, (net && net.me) || 'me'); else if(parties[k]) { parties[k].follow = null; } } else { o.request(k, on); } },
    followsMe(k){ const f = parties[k] && parties[k].follow; return !!f && (f === 'me' || f === (net && net.me)); }
  };
}

import { p2pRoom, worldIdFromUrl } from './p2p.js';
// =====================================================================================
//  Multiplayer over the artifact "room" capability.
//  - Lobby presence: each player's own state (position, look, actions, hits, chat).
//  - Named room "mobs": the host's monster snapshot (one 4 KiB presence object).
//  The host is the game peer with the smallest peer label; it runs the monster AI,
//  every client simulates and renders itself, hits travel in presence.
// =====================================================================================

export function createNet(){
  const N = {
    room: null, mobs: null, me: null, online: false,
    peers: new Map(),          // peer -> { presence, updatedAt, guest }
    mobSnap: null, mobSnapFrom: null, mobSnapAt: 0,
    listeners: { peers: [], snap: [] },
    isHost(){ if(!this.room) return true; const ids = [...this.peers.keys()].filter(p => this.peers.get(p).presence && this.peers.get(p).presence.g); if(this.me) ids.push(this.me); ids.sort(); return !ids.length || ids[0] === this.me; },
    hostPeer(){ const ids = [...this.peers.keys()].filter(p => this.peers.get(p).presence && this.peers.get(p).presence.g); if(this.me) ids.push(this.me); ids.sort(); return ids[0] || null; },
    others(){ return [...this.peers.entries()].filter(([, v]) => v.presence && v.presence.g).map(([peer, v]) => ({ peer, ...v })); },
    count(){ return this.others().length + 1; }
  };
  let lastSelf = 0, lastMobs = 0, pendingSelf = null, pendingMobs = null, mobsBusy = false, selfBusy = false;

  N.start = async function(){
    const C = window.claude; let room = null;
    if(C && C.use){ try{ room = await C.use('room'); }catch(e){ room = null; } }
    else if(window.RITM_P2P){ try{ room = p2pRoom(worldIdFromUrl()); N.p2p = true; }catch(e){ console.warn('p2p failed', e); room = null; } }
    if(!room) return N;
    N.room = room;
    const take = change => {
      change.peers.forEach(p => { if(p.isMe && p.sameTab){ N.me = p.peer; return; } if(p.isMe) {} N.peers.set(p.peer, { presence: p.presence, updatedAt: p.updatedAt, guest: p.guest, by: p.by }); });
      change.left.forEach(p => N.peers.delete(p.peer));
      const live = new Set(change.peers.map(p => p.peer)); for(const k of [...N.peers.keys()]) if(!live.has(k)) N.peers.delete(k);
      N.listeners.peers.forEach(f => f(change));
    };
    try{ room.onPeers(take, () => {}); room.onConnection(c => { N.online = c; }, () => {}); }catch(e){}
    try{
      N.mobs = await room.join('mobs');
      N.mobs.onPeers(ch => {
        const host = N.hostPeer();
        ch.peers.forEach(p => { if(p.peer === host && !(p.isMe && p.sameTab) && p.presence && p.presence.m){ N.mobSnap = p.presence; N.mobSnapFrom = p.peer; N.mobSnapAt = performance.now(); N.listeners.snap.forEach(f => f(p.presence)); } });
      }, () => {});
    }catch(e){ N.mobs = null; }
    return N;
  };
  // extra host-owned channels (named rooms): the host writes, everyone reads the host's presence
  N.channel = function(name){
    const ch = { room: null, snap: null, at: 0, subs: [], busy: false, last: 0, pend: null };
    ch.ready = (async () => { if(!N.room) return; try{ ch.room = await N.room.join(name); ch.room.onPeers(c => { const host = N.hostPeer(); c.peers.forEach(p => { if(p.peer === host && !(p.isMe && p.sameTab) && p.presence && p.presence.v){ ch.snap = p.presence; ch.at = performance.now(); ch.subs.forEach(f => f(p.presence)); } }); }, () => {}); }catch(e){ ch.room = null; } })();
    ch.out = (obj, now) => { ch.pend = obj; if(!ch.room || ch.busy || now - ch.last < 150) return; ch.last = now; ch.busy = true; const o2 = ch.pend; ch.pend = null; ch.room.presence(o2).catch(() => {}).finally(() => { ch.busy = false; }); };
    ch.onSnap = f => ch.subs.push(f);
    return ch;
  };
  // throttled presence writers (absolute state; latest wins)
  N.self = function(obj, now){ pendingSelf = obj; if(!N.room || selfBusy || now - lastSelf < 100) return; lastSelf = now; selfBusy = true; const o = pendingSelf; pendingSelf = null; N.room.presence(o).catch(() => {}).finally(() => { selfBusy = false; }); };
  N.mobsOut = function(obj, now){ pendingMobs = obj; if(!N.mobs || mobsBusy || now - lastMobs < 120) return; lastMobs = now; mobsBusy = true; const o = pendingMobs; pendingMobs = null; N.mobs.presence(o).catch(() => {}).finally(() => { mobsBusy = false; }); };
  N.clearMobs = function(){ if(N.mobs) N.mobs.presence({ m: null, T: null, e: null }).catch(() => {}); };
  return N;
}

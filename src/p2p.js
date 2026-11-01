// =====================================================================================
//  Peer-to-peer "room" with the same shape as the artifact room capability, so the game
//  runs outside claude.ai (e.g. on GitHub Pages). Players find each other through public
//  Nostr relays (signalling only) and then talk directly over WebRTC.
//  Presence semantics: every peer holds one latest-state object per channel.
// =====================================================================================
import { joinRoom, selfId } from 'trystero';

export function p2pRoom(worldId){
  const tr = joinRoom({ appId: 'misto-shlyakhu-online', rtcConfig: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }] } }, worldId || 'world');
  const chans = new Map();
  let connected = false; const connSubs = [];
  function emit(ch){
    const peers = [{ peer: selfId, isMe: true, sameTab: true, presence: ch.mine, updatedAt: Date.now() }];
    ch.peers.forEach((v, peer) => peers.push({ peer, isMe: false, presence: v.presence, updatedAt: v.at, guest: false }));
    const change = { peers, left: [] };
    ch.subs.forEach(f => { try{ f(change); }catch(e){ console.warn(e); } });
  }
  function chan(name){
    if(chans.has(name)) return chans.get(name);
    const act = tr.makeAction(name === '' ? 'lobby' : name.slice(0, 12));
    const ch = { act, mine: null, peers: new Map(), subs: [] };
    act.onMessage = (data, meta) => { const peerId = meta && meta.peerId; if(!peerId) return; ch.peers.set(peerId, { presence: data, at: Date.now() }); emit(ch); };
    ch.api = {
      presence(obj){ ch.mine = obj; try{ act.send(obj); }catch(e){} return Promise.resolve(); },
      onPeers(fn){ ch.subs.push(fn); emit(ch); return () => { const i = ch.subs.indexOf(fn); if(i >= 0) ch.subs.splice(i, 1); }; },
      onConnection(fn){ connSubs.push(fn); fn(connected); },
      join(n){ return Promise.resolve(chan(n).api); },
      leave(){},
      emit(){}, on(){}
    };
    chans.set(name, ch);
    return ch;
  }
  tr.onPeerJoin = pid => { connected = true; connSubs.forEach(f => f(true)); chans.forEach(ch => { if(ch.mine) try{ ch.act.send(ch.mine, { target: pid }); }catch(e){} }); };
  tr.onPeerLeave = pid => { chans.forEach(ch => { if(ch.peers.delete(pid)) emit(ch); }); };
  // drop peers that went silent (closed laptop, lost network) after 20 s
  setInterval(() => { const now = Date.now(); chans.forEach(ch => { let ch2 = false; ch.peers.forEach((v, k) => { if(now - v.at > 20000){ ch.peers.delete(k); ch2 = true; } }); if(ch2) emit(ch); }); }, 5000);
  return chan('').api;
}

export function worldIdFromUrl(){
  try{ const q = new URLSearchParams(location.search); const w = (q.get('w') || '').toLowerCase().replace(/[^a-z0-9а-яіїєґ_-]/gi, '').slice(0, 32); return w ? 'w-' + w : 'world'; }catch(e){ return 'world'; }
}

// BroadcastChannel stand-in for trystero (same-browser tests only)
export const selfId = Math.random().toString(36).slice(2, 10);
export function joinRoom(cfg, roomId){
  const bc = new BroadcastChannel('tr-' + cfg.appId + '-' + roomId); const acts = {}; const peers = new Set();
  const room = { onPeerJoin: null, onPeerLeave: null,
    makeAction(name){ const a = { send(data, opt){ bc.postMessage({ t: 'a', n: name, from: selfId, to: opt && opt.target || null, data }); }, onMessage: null }; acts[name] = a; return a; } };
  bc.onmessage = e => { const m = e.data; if(m.from === selfId) return;
    if(m.t === 'hello' || m.t === 'hi'){ if(!peers.has(m.from)){ peers.add(m.from); room.onPeerJoin && room.onPeerJoin(m.from); } if(m.t === 'hello') bc.postMessage({ t: 'hi', from: selfId }); return; }
    if(m.t === 'a'){ if(m.to && m.to !== selfId) return; if(!peers.has(m.from)){ peers.add(m.from); room.onPeerJoin && room.onPeerJoin(m.from); } const a = acts[m.n]; a && a.onMessage && a.onMessage(m.data, { peerId: m.from }); } };
  setTimeout(() => bc.postMessage({ t: 'hello', from: selfId }), 50);
  return room;
}

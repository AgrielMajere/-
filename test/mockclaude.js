// Test double for the artifact runtime: a "room" shared by tabs of one browser context via BroadcastChannel.
(() => {
  const me = 'p' + Math.random().toString(36).slice(2, 10);
  function makeRoom(name){
    const ch = new BroadcastChannel('mockroom-' + name);
    const peers = new Map(); let mine = {}; const subs = []; const evs = [];
    const snapshot = () => [{ peer: me, presence: Object.freeze({ ...mine }), isMe: true, sameTab: true, by: null, kind: 'viewer', guest: false, updatedAt: Date.now() }, ...[...peers.entries()].map(([peer, v]) => ({ peer, presence: v.presence, isMe: false, sameTab: false, by: null, kind: 'viewer', guest: false, updatedAt: v.t }))];
    const fire = () => { const ps = snapshot(); subs.forEach(f => f({ peers: ps, joined: [], left: [], updated: ps })); };
    ch.onmessage = e => { const m = e.data; if(m.peer === me) return;
      if(m.t === 'pres'){ peers.set(m.peer, { presence: Object.freeze(m.presence), t: Date.now() }); fire(); }
      else if(m.t === 'hello'){ ch.postMessage({ t: 'pres', peer: me, presence: mine }); }
      else if(m.t === 'bye'){ peers.delete(m.peer); fire(); }
      else if(m.t === 'ev'){ evs.filter(x => x.topic === m.topic).forEach(x => x.fn({ topic: m.topic, data: m.data, peer: m.peer, isMe: false })); } };
    ch.postMessage({ t: 'hello', peer: me });
    addEventListener('beforeunload', () => ch.postMessage({ t: 'bye', peer: me }));
    return {
      name,
      presence(patch){ mine = { ...mine, ...patch }; Object.keys(mine).forEach(k => { if(mine[k] === null) delete mine[k]; }); if(JSON.stringify(mine).length > 4096) return Promise.reject({ code: 'invalid_argument' }); ch.postMessage({ t: 'pres', peer: me, presence: mine }); return Promise.resolve(); },
      onPeers(fn){ subs.push(fn); setTimeout(fire, 0); return () => {}; },
      peers: snapshot,
      emit(topic, data){ ch.postMessage({ t: 'ev', topic, data, peer: me }); return Promise.resolve(); },
      on(topic, fn){ evs.push({ topic, fn }); return () => {}; },
      connected: () => true, onConnection(fn){ setTimeout(() => fn(true), 0); return () => {}; },
      join(n){ return Promise.resolve(makeRoom(name + '.' + n)); }, leave(){ return Promise.resolve(); }
    };
  }
  const lobby = makeRoom('lobby');
  window.claude = { use(n){ return Promise.resolve(n === 'room' ? lobby : null); } };
  window.__mockPeer = me;
})();

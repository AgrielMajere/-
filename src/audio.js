// =====================================================================================
//  Procedural sound: no files to download. Effects are synthesised with WebAudio,
//  ambience (wind, birds by day, crickets at night) is generated on the fly.
//  Browsers only allow sound after the first tap/key, so everything starts silent.
// =====================================================================================
let ctx = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null, enabled = true, vol = .7;
try{ const v = localStorage.getItem('ritm-game-sound'); if(v != null){ enabled = v !== '0'; } const vv = localStorage.getItem('ritm-game-vol'); if(vv != null) vol = Math.max(0, Math.min(1, +vv)); }catch(e){}

function init(){
  if(ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return false;
  try{ ctx = new AC(); }catch(e){ ctx = null; return false; }
  master = ctx.createGain(); master.gain.value = enabled ? vol : 0; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = .9; sfxBus.connect(comp);
  ambBus = ctx.createGain(); ambBus.gain.value = .5; ambBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
  startAmbience();
  return true;
}
const unlock = () => { if(init() && ctx.state === 'suspended') ctx.resume(); };
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));

function env(g, t, a, peak, dec, sus){ g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(.0001, sus || .0001), t + a + dec); }
function noise(t, dur, f0, f1, q, peak, type, out){ const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); if(f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = ctx.createGain(); env(g, t, .006, peak, dur); s.connect(f); f.connect(g); g.connect(out || sfxBus); s.start(t, Math.random()*1.5); s.stop(t + dur + .05); }
function tone(t, dur, f0, f1, peak, type, out, a){ const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if(f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = ctx.createGain(); env(g, t, a || .008, peak, dur); o.connect(g); g.connect(out || sfxBus); o.start(t); o.stop(t + dur + .05); }

const last = {};
// k: effect name, d: distance from the listener (m) for attenuation
export function sfx(k, d){
  if(!ctx || !enabled || ctx.state !== 'running') return;
  const now = ctx.currentTime; if(last[k] && now - last[k] < .045) return; last[k] = now;
  const att = d == null ? 1 : Math.max(0, 1 - d/45); if(att <= 0) return; const v = att;
  const t = now + .005;
  switch(k){
    case 'swing': noise(t, .16, 2400, 600, 1.2, .25*v); break;
    case 'hit': noise(t, .09, 900, 300, .8, .45*v, 'lowpass'); tone(t, .12, 160, 70, .35*v, 'triangle'); break;
    case 'crit': noise(t, .12, 2200, 500, .9, .5*v); tone(t, .2, 220, 90, .45*v, 'square'); tone(t + .02, .18, 880, 660, .12*v, 'triangle'); break;
    case 'hurt': tone(t, .22, 140, 55, .5*v, 'sawtooth'); noise(t, .14, 500, 200, .7, .35*v, 'lowpass'); break;
    case 'cast': tone(t, .45, 300, 1200, .14*v, 'sine', null, .03); tone(t + .05, .4, 450, 1800, .08*v, 'triangle', null, .03); noise(t, .35, 3000, 6000, 3, .06*v, 'highpass'); break;
    case 'arrow': noise(t, .22, 4000, 1500, 2, .18*v); break;
    case 'heal': [523, 659, 784].forEach((f, i) => tone(t + i*.06, .5, f, f*1.01, .1*v, 'sine', null, .02)); break;
    case 'coin': tone(t, .12, 1320, 1320, .14*v, 'square'); tone(t + .07, .25, 1760, 1760, .12*v, 'square'); break;
    case 'xp': tone(t, .3, 660, 990, .07*v, 'sine'); break;
    case 'level': [523, 659, 784, 1047].forEach((f, i) => { tone(t + i*.11, .5, f, f, .16, 'triangle'); tone(t + i*.11, .5, f*2, f*2, .04, 'sine'); }); break;
    case 'quest': [392, 523, 659, 784].forEach((f, i) => tone(t + i*.09, .45, f, f, .14, 'triangle')); break;
    case 'chime': [784, 988, 1175].forEach((f, i) => tone(t + i*.07, .9, f, f, .09, 'sine', null, .01)); break;
    case 'ui': tone(t, .05, 1600, 1200, .05, 'triangle'); break;
    case 'step': noise(t, .07, 700, 300, .7, .05*v, 'lowpass'); break;
    case 'tele': tone(t, .9, 200, 1600, .14, 'sine', null, .2); noise(t, .9, 1500, 6000, 2, .08, 'bandpass'); break;
    case 'death': tone(t, 1.4, 220, 55, .25, 'sawtooth'); tone(t, 1.4, 165, 41, .2, 'triangle'); break;
    case 'horn': tone(t, 1.8, 82, 78, .35, 'sawtooth', null, .25); tone(t, 1.8, 123, 117, .2, 'sawtooth', null, .25); noise(t, 1.6, 200, 120, .5, .12, 'lowpass'); break;
    case 'roar': noise(t, .7, 400, 120, .6, .5*v, 'lowpass'); tone(t, .7, 90, 50, .3*v, 'sawtooth'); break;
  }
}

// ---------- ambience ----------
let amb = null, ambState = { day: 1, town: 0, quiet: 0 };
function startAmbience(){
  const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true; const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420; const wg = ctx.createGain(); wg.gain.value = .0;
  const lfo = ctx.createOscillator(); lfo.frequency.value = .07; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
  wind.connect(wf); wf.connect(wg); wg.connect(ambBus); wind.start();
  amb = { wg, t: 0 };
}
export function ambience(dt, o){
  if(!ctx || !amb || ctx.state !== 'running') return;
  Object.assign(ambState, o || {});
  const target = enabled ? (ambState.quiet ? .02 : ambState.town ? .05 : .11) : 0; amb.wg.gain.value += (target - amb.wg.gain.value)*Math.min(1, dt*.8);
  amb.t -= dt; if(amb.t > 0 || ambState.quiet) return;
  const t = ctx.currentTime + .02;
  if(ambState.day > .5){ // birds
    amb.t = 1.5 + Math.random()*4; const f = 2200 + Math.random()*1800, n = 2 + Math.floor(Math.random()*4);
    for(let i = 0; i < n; i++){ const tt = t + i*(.09 + Math.random()*.05); tone(tt, .08, f*(1 + Math.random()*.15), f*(.8 + Math.random()*.5), .025, 'sine', ambBus, .01); }
  } else { // crickets
    amb.t = .6 + Math.random()*1.2; const f = 4200 + Math.random()*500;
    for(let i = 0; i < 6; i++) tone(t + i*.045, .03, f, f, .018, 'sine', ambBus, .004);
  }
}
export function soundOn(){ return enabled; }
export function setSound(on){ enabled = !!on; try{ localStorage.setItem('ritm-game-sound', enabled ? '1' : '0'); }catch(e){} if(master) master.gain.value = enabled ? vol : 0; }

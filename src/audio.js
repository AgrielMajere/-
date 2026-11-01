// =====================================================================================
//  Procedural sound: no files to download. Effects are synthesised with WebAudio,
//  ambience (wind, birds by day, crickets at night) is generated on the fly.
//  Browsers only allow sound after the first tap/key, so everything starts silent.
// =====================================================================================
let musBus = null; const VOL = { sfx: 1, amb: 1, music: .8 };
try{ Object.assign(VOL, JSON.parse(localStorage.getItem('ritm-game-vols') || '{}')); }catch(e){}
let ctx = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null, enabled = true, vol = .7;
try{ const v = localStorage.getItem('ritm-game-sound'); if(v != null){ enabled = v !== '0'; } const vv = localStorage.getItem('ritm-game-vol'); if(vv != null) vol = Math.max(0, Math.min(1, +vv)); }catch(e){}

function init(){
  if(ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return false;
  try{ ctx = new AC(); }catch(e){ ctx = null; return false; }
  master = ctx.createGain(); master.gain.value = enabled ? vol : 0; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = .9*VOL.sfx; sfxBus.connect(comp);
  ambBus = ctx.createGain(); ambBus.gain.value = .5*VOL.amb; ambBus.connect(comp);
  musBus = ctx.createGain(); musBus.gain.value = .32*VOL.music; musBus.connect(comp);
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

export function setVolumes(v){ Object.assign(VOL, v); try{ localStorage.setItem('ritm-game-vols', JSON.stringify(VOL)); }catch(e){} if(sfxBus){ sfxBus.gain.value = .9*VOL.sfx; ambBus.gain.value = .5*VOL.amb; musBus.gain.value = .32*VOL.music; } }
export function volumes(){ return Object.assign({}, VOL); }
export function extraSfx(k){
  if(!ctx || !enabled || ctx.state !== 'running') return; const t = ctx.currentTime + .005;
  switch(k){
    case 'roll': noise(t, .25, 700, 250, .8, .25, 'lowpass'); break;
    case 'block': tone(t, .12, 900, 700, .2, 'square'); noise(t, .1, 3000, 1500, 2, .3); break;
    case 'perfect': [1200, 1800].forEach((f, i) => tone(t + i*.04, .25, f, f, .14, 'triangle')); noise(t, .08, 4000, 2000, 3, .25); break;
    case 'jump': noise(t, .12, 500, 300, .7, .12, 'lowpass'); break;
    case 'splash': noise(t, .5, 1800, 400, .6, .35, 'lowpass'); break;
    case 'cast': noise(t, .3, 3000, 900, 1.5, .12); break;
    case 'bite': [660, 990].forEach((f, i) => tone(t + i*.07, .15, f, f, .16, 'triangle')); break;
    case 'gather': noise(t, .18, 1200, 600, 1, .2); tone(t + .05, .1, 500, 380, .1, 'triangle'); break;
    case 'mine': tone(t, .09, 1700, 1500, .18, 'square'); noise(t, .09, 5000, 2500, 2, .22); break;
    case 'thunder': noise(t, 2.6, 160, 40, .4, .9, 'lowpass'); noise(t + .1, 1.6, 600, 80, .5, .35, 'lowpass'); break;
    case 'horn': tone(t, 1.8, 98, 96, .3, 'sawtooth', null, .3); tone(t, 1.8, 147, 145, .18, 'sawtooth', null, .3); break;
    case 'neigh': tone(t, .6, 600, 1100, .12, 'sawtooth'); tone(t + .25, .5, 1000, 500, .1, 'sawtooth'); break;
    case 'door': noise(t, .35, 400, 120, .6, .3, 'lowpass'); tone(t, .3, 110, 90, .12, 'triangle'); break;
  }
}
// ---------- rain bed ----------
let rainG = null;
export function rain(level){
  if(!ctx || ctx.state !== 'running') return;
  if(!rainG){ const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900; const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 7000; rainG = ctx.createGain(); rainG.gain.value = 0; s.connect(f); f.connect(f2); f2.connect(rainG); rainG.connect(ambBus); s.start(); }
  rainG.gain.value += ((enabled ? level*.28 : 0) - rainG.gain.value)*.08;
}
// ---------- procedural music ----------
// themes: town (lute arpeggios in D dorian), wild (sparse pad), battle (driving ostinato + drums),
// boss (low brass drones + toms), dungeon (dark drones), tavern (jig), none
const THEMES = {
  town: { bpm: 84, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 4, 0, 5, 3, 4, 4], arp: 'lute', pad: .05, drum: 0 },
  wild: { bpm: 70, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], arp: 'sparse', pad: .06, drum: 0 },
  battle: { bpm: 138, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 5, 3, 3, 4, 4], arp: 'ost', pad: .04, drum: 1 },
  boss: { bpm: 112, root: 38, scale: [0, 1, 3, 5, 6, 8, 10], prog: [0, 0, 1, 1, 0, 0, 6, 5], arp: 'brass', pad: .07, drum: 2 },
  dungeon: { bpm: 60, root: 38, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 6], arp: 'drip', pad: .07, drum: 0 },
  tavern: { bpm: 150, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 0, 4, 3, 4, 0, 0], arp: 'jig', pad: .02, drum: 3 }
};
let music = { theme: 'none', next: 0, step: 0, gain: null, target: 'none', fade: 1 };
const mf = n => 440*Math.pow(2, (n - 69)/12);
export function setMusic(theme){ music.target = THEMES[theme] ? theme : 'none'; }
function note(t, f, dur, peak, type, out, a){ tone(t, dur, f, f, peak, type, out, a); }
export function musicTick(){
  if(!ctx || !musBus || ctx.state !== 'running') return;
  if(!music.gain){ music.gain = ctx.createGain(); music.gain.gain.value = 1; music.gain.connect(musBus); }
  const now = ctx.currentTime;
  if(music.theme !== music.target){ // fade out, then switch
    music.fade -= .04; music.gain.gain.value = Math.max(0, music.fade);
    if(music.fade <= 0){ music.theme = music.target; music.step = 0; music.next = now + .1; music.fade = 0; }
    return;
  }
  if(music.fade < 1){ music.fade = Math.min(1, music.fade + .02); music.gain.gain.value = music.fade; }
  const Th = THEMES[music.theme]; if(!Th || !enabled) return;
  const spb = 60/Th.bpm/2; // eighth notes
  while(music.next < now + .25){
    const t = music.next, st = music.step, bar = Math.floor(st/8), b8 = st % 8;
    const deg = Th.prog[bar % Th.prog.length], sc = Th.scale;
    const chord = [0, 2, 4].map(i => Th.root + sc[(deg + i) % 7] + 12*Math.floor((deg + i)/7));
    const out = music.gain;
    if(b8 === 0 && Th.pad){ chord.forEach(n => { note(t, mf(n), spb*8.2, Th.pad, 'sine', out, .3); note(t, mf(n)*1.003, spb*8.2, Th.pad*.6, 'triangle', out, .4); }); note(t, mf(chord[0] - 12), spb*8, Th.pad*1.4, 'sine', out, .1); }
    const A = Th.arp;
    if(A === 'lute'){ const seq = [0, 1, 2, 1, 0, 2, 1, 2]; const n = chord[seq[b8]] + 12; note(t, mf(n), spb*1.6, .07, 'triangle', out, .004); if(b8 === 4 && Math.random() < .5) note(t, mf(chord[2] + 24), spb*2, .03, 'sine', out, .01); }
    else if(A === 'sparse'){ if(b8 === 0 || (b8 === 5 && Math.random() < .6)) note(t, mf(chord[Math.floor(Math.random()*3)] + 12), spb*5, .05, 'sine', out, .05); }
    else if(A === 'ost'){ const n = chord[b8 % 2 ? 0 : (b8 >> 1) % 3] + (b8 % 2 ? 0 : 12); note(t, mf(n), spb*.9, .06, 'sawtooth', out, .005); }
    else if(A === 'brass'){ if(b8 === 0 || b8 === 6) chord.forEach(n => note(t, mf(n - 12), spb*(b8 ? 2 : 5), .045, 'sawtooth', out, .08)); }
    else if(A === 'drip'){ if(Math.random() < .18) note(t, mf(chord[Math.floor(Math.random()*3)] + 24), spb*3, .03, 'sine', out, .002); }
    else if(A === 'jig'){ const seq = [0, 2, 1, 0, 2, 1, 2, 1]; note(t, mf(chord[seq[b8]] + 12 + (b8 === 6 ? 2 : 0)), spb*.9, .06, 'square', out, .003); }
    // drums
    if(Th.drum === 1){ if(b8 % 4 === 0) { tone(t, .18, 120, 45, .25, 'sine', out); } if(b8 % 4 === 2) noise(t, .12, 1800, 900, .8, .12, 'bandpass', out); noise(t, .03, 8000, 6000, 2, .03, 'highpass', out); }
    if(Th.drum === 2){ if(b8 === 0 || b8 === 3 || b8 === 6) tone(t, .35, 90, 40, .32, 'sine', out); if(b8 === 4) noise(t, .3, 400, 120, .6, .18, 'lowpass', out); }
    if(Th.drum === 3){ if(b8 % 2 === 0) noise(t, .05, 2500, 1500, 1, .06, 'bandpass', out); if(b8 === 0 || b8 === 4) tone(t, .12, 140, 60, .15, 'sine', out); }
    music.step++; music.next += spb;
  }
}

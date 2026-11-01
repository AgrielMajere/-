// Character save: browser storage always, plus the artifact's private per-person store when it is available.
const KEY = 'misto-online-v1';
let data = null, cloud = null, cloudBusy = false, cloudDirty = false, cloudT = 0;
function def(){ return { sparks: 0, last: {}, solved: {}, t: 0 }; }
function load(){
  try{ const raw = localStorage.getItem(KEY); data = raw ? Object.assign(def(), JSON.parse(raw)) : def(); }
  catch(e){ data = def(); }
}
export function get(){ if(!data) load(); return data; }
export function commit(){
  if(!data) load(); data.t = Date.now();
  try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){}
  cloudDirty = true; flush();
}
function flush(){
  if(!cloud || cloudBusy || !cloudDirty) return;
  const now = Date.now(); if(now - cloudT < 15000){ setTimeout(flush, 15000 - (now - cloudT) + 50); return; }
  cloudBusy = true; cloudDirty = false; cloudT = now;
  let payload; try{ payload = { json: JSON.stringify(data), t: data.t }; }catch(e){ cloudBusy = false; return; }
  cloud.set(payload).catch(() => { cloud = null; }).finally(() => { cloudBusy = false; if(cloudDirty) setTimeout(flush, 15000); });
}
// returns true when a newer save was pulled from the cloud
export async function cloudInit(){
  try{
    const C = window.claude; if(!C || !C.use) return false;
    const [db, user] = await Promise.all([C.use('db'), C.use('user')]);
    if(!db || !user) return false;
    const id = await user.id(); if(!id) return false;
    const ref = db.doc('data/users/' + id + '/hero');
    const snap = await Promise.race([ref.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
    cloud = ref;
    const d = snap && snap.exists !== false && snap.data ? snap.data() : null;
    if(d && typeof d.json === 'string' && (d.t || 0) > ((get().t) || 0)){
      try{ const parsed = JSON.parse(d.json); if(parsed && typeof parsed === 'object'){ data = Object.assign(def(), parsed); try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){} return true; } }catch(e){}
    }
    return false;
  }catch(e){ cloud = null; return false; }
}
export function today(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
export function addSparks(n){ const d = get(); d.sparks = Math.max(0, (d.sparks || 0) + n); commit(); }

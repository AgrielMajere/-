#!/bin/bash
set -e
cd /home/claude/mmo
rm -rf gh ghtmp && mkdir -p gh/models gh/tex
npx esbuild src/main.js --bundle --format=iife --global-name=RitmGame --loader:.jpg=file --loader:.png=file --asset-names=assets/[name]-[hash] --public-path=./ --minify --target=es2019 --outdir=ghtmp --log-level=warning
mv ghtmp/main.js gh/game.js && mv ghtmp/assets gh/assets && rm -rf ghtmp
for f in public/models/*.glb; do b=$(basename $f); case $b in nefertiti*|bust*|head*|chartest*|resttest*) continue;; nm_horse.glb) ;; nm_*) continue;; esac; cp $f gh/models/; done
cp public/tex/*.jpg gh/tex/
cat > gh/index.html <<'H'
<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Місто Шляху Онлайн</title>
<meta name="description" content="Онлайн 3D-ісекай RPG для гри з друзями: Місто Шляху, столиця Сонцеград, поселення ельфів, гномів і звіролюдей, три Катастрофи.">
<meta property="og:title" content="Місто Шляху Онлайн">
<meta property="og:description" content="3D-ісекай RPG у браузері. Відкрий посилання — і граєш разом з друзями.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚔️</text></svg>">
<style>
:root{color-scheme:dark}html,body{height:100%;margin:0;background:#0b0a09;color:#f1e3c8;overflow:hidden;font-family:system-ui,-apple-system,sans-serif}
#boot{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;z-index:5}
#boot h1{margin:0;font:400 26px Georgia,serif;letter-spacing:.16em;text-transform:uppercase}
#boot .bar{width:min(320px,80vw);height:6px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}
#boot .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#c9a040,#ffe08a);transition:width .2s}
#boot p{margin:0;font-size:14px;opacity:.85}
#boot pre{max-width:90vw;white-space:pre-wrap;font-size:12px;color:#ff9a8a;text-align:left}
</style>
</head>
<body>
<div id="boot"><h1>Місто Шляху</h1><div class="bar"><i></i></div><p>Завантаження гри…</p><pre></pre></div>
<script>
window.RITM_GAME_MODEL_EXT = ".glb"; window.RITM_P2P = true;
(function(){
  var boot = document.getElementById('boot'), bar = boot.querySelector('i'), txt = boot.querySelector('p'), pre = boot.querySelector('pre');
  var started = false; function fail(m){ if(started){ console.warn(m); return; } boot.style.display = 'flex'; boot.style.zIndex = 99999; txt.textContent = 'Гра не змогла запуститися. Надішліть цей текст розробнику:'; pre.textContent += m + '\n'; }
  window.addEventListener('error', function(e){ fail((e.message || 'error') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')); });
  window.addEventListener('unhandledrejection', function(e){ var r = e.reason; if(r && /WebSocket|relay/i.test(String(r && r.message || r))) return; fail('promise: ' + (r && (r.stack || r.message) || r)); });
  var c = document.createElement('canvas'); var gl = c.getContext('webgl2') || c.getContext('webgl');
  if(!gl){ fail('Ваш браузер не підтримує WebGL (3D-графіку). Спробуйте Chrome або Safari, увімкніть апаратне прискорення.'); return; }
  function start(){ txt.textContent = 'Будуємо світ…'; bar.style.width = '100%';
    var s = document.createElement('script'); s.src = 'game.js?v=2';
    s.onload = function(){ try{ RitmGame.open({ hero: { name: 'Мандрівник', accent: '#e6a23c', stats: [] } }); var t = setInterval(function(){ if(document.querySelector('.gm-root')){ clearInterval(t); setTimeout(function(){ started = true; }, 15000); boot.style.display = 'none'; } }, 200); }catch(e){ fail(e && (e.stack || e.message) || String(e)); } };
    s.onerror = function(){ fail('Не вдалося завантажити game.js'); };
    document.body.appendChild(s); }
  // download with progress so the screen is never just black on slow mobile internet
  try{
    var x = new XMLHttpRequest(); x.open('GET', 'game.js?v=2'); x.onprogress = function(e){ var tot = e.total || 6400000; bar.style.width = Math.min(100, e.loaded/tot*100).toFixed(0) + '%'; txt.textContent = 'Завантаження гри… ' + (e.loaded/1048576).toFixed(1) + ' МБ'; };
    x.onload = start; x.onerror = start; x.send();
  }catch(e){ start(); }
})();
</script>
</body>
</html>
H
touch gh/.nojekyll
du -sh gh

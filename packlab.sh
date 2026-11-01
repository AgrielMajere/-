#!/bin/bash
set -e
cd /home/claude/mmo
rm -rf labpub labtmp && mkdir -p labpub/models labpub/tex
npx esbuild src/labmain.js --bundle --format=iife --global-name=RitmLab --loader:.jpg=file --loader:.png=file --asset-names=assets/[name]-[hash] --public-path=./ --minify --target=es2019 --outdir=labtmp --log-level=warning
mv labtmp/labmain.js labpub/lab.js; [ -d labtmp/assets ] && mv labtmp/assets labpub/assets; rm -rf labtmp
mkdir -p /tmp/claude-0/gensrc && rm -f /tmp/claude-0/gensrc/* && cp public/models/gen_*.glb public/models/nm_*.glb public/models/{man,woman,soldier,anims_x,anims_s,anims_k}.glb /tmp/claude-0/gensrc/ && node tools_glbjson.mjs /tmp/claude-0/gensrc labpub/models
cp public/tex/*.jpg labpub/tex/
cat > labpub/index.html <<'H'
<title>Лабораторія вигляду</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#f4efe6;--fg:#2a2218;--panel:#fbf8f2;--card:#ffffff;--chip:#efe7da;--line:#d9cdb8;--acc:#c9902e;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#12100d;--fg:#f1e3c8;--panel:#18150f;--card:#201b14;--chip:#2a241b;--line:#3a3226;--acc:#d9a24a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#12100d;--fg:#f1e3c8;--panel:#18150f;--card:#201b14;--chip:#2a241b;--line:#3a3226;--acc:#d9a24a;color-scheme:dark}
html,body{height:100%;background:var(--bg);color:var(--fg);overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
#lab{position:fixed;inset:0}
</style>
<div id="lab"></div>
<script>window.RITM_GAME_MODEL_EXT = ".json";</script>
<script src="lab.js"></script>
<script>RitmLab.open();</script>
H
du -sh labpub; ls labpub

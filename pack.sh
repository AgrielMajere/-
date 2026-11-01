#!/bin/bash
set -e
cd /home/claude/mmo
rm -rf pub pubtmp && mkdir -p pub/models pub/tex
npx esbuild src/main.js --bundle --format=iife --global-name=RitmGame --loader:.jpg=file --loader:.png=file --asset-names=assets/[name]-[hash] --public-path=./ --minify --target=es2019 --outdir=pubtmp --log-level=warning
mv pubtmp/main.js pub/game.js && mv pubtmp/assets pub/assets && rm -rf pubtmp
mkdir -p /tmp/claude-0/glbsrc && rm -f /tmp/claude-0/glbsrc/* && for f in public/models/*.glb; do b=$(basename $f); case $b in nefertiti*|bust*|head*|chartest*|resttest*|nm_*) continue;; esac; cp $f /tmp/claude-0/glbsrc/; done
node tools_glbjson.mjs /tmp/claude-0/glbsrc pub/models
cp public/tex/*.jpg pub/tex/
cp page.html pub/index.html
du -sh pub; ls pub/models | wc -l; ls pub/assets | wc -l

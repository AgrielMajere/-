#!/bin/bash
set -e; cd /home/claude/mmo; rm -rf labtmp
npx esbuild src/labmain.js --bundle --format=iife --global-name=RitmLab --loader:.jpg=file --loader:.png=file --asset-names=assets/[name]-[hash] --public-path=./ --minify --target=es2019 --outdir=labtmp --log-level=warning
mv labtmp/labmain.js labpub/lab.js; rm -rf labtmp

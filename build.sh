#!/bin/bash
set -e
cd /home/claude/mmo
npx esbuild src/main.js --bundle --format=iife --global-name=RitmGame --loader:.jpg=dataurl --loader:.png=dataurl --target=es2019 --outfile=public/game.js --log-level=warning

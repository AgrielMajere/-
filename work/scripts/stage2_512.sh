#!/bin/bash
# usage: stage2.sh in.glb out.glb  -> textures <=1024 webp, meshopt-compressed geometry
set -e
t=$(mktemp -d /home/claude/work/tmp.XXXX)
gltf-transform dedup "$1" $t/a.glb >/dev/null
gltf-transform prune $t/a.glb $t/b.glb --keep-attributes false >/dev/null
gltf-transform resize $t/b.glb $t/c.glb --width 512 --height 512 >/dev/null
gltf-transform webp $t/c.glb $t/c2.glb --quality 82 >/dev/null
gltf-transform resample $t/c2.glb $t/d.glb --tolerance 0.002 >/dev/null
gltf-transform meshopt $t/d.glb "$2" --level medium >/dev/null
rm -rf $t

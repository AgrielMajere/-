import sys, json, bpy
src, out = sys.argv[sys.argv.index('--')+1:][:2] if '--' in sys.argv else sys.argv[1:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
if src.lower().endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=False)
else: bpy.ops.import_scene.gltf(filepath=src)
r = {'file': src.split('/')[-1]}
arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
r['arm'] = [{'name': a.name, 'nb': len(a.data.bones), 'bones': [b.name for b in a.data.bones][:60]} for a in arms]
tris = 0; skinned = 0
for m in meshes:
    me = m.data; tris += sum(len(p.vertices) - 2 for p in me.polygons)
    if any(md.type == 'ARMATURE' for md in m.modifiers): skinned += 1
r['meshes'] = len(meshes); r['skinned'] = skinned; r['tris'] = tris
r['anims'] = [(a.name, round(a.frame_range[1] - a.frame_range[0])) for a in bpy.data.actions][:30]
import mathutils
pts = [m.matrix_world @ mathutils.Vector(c) for m in meshes for c in m.bound_box]
if pts:
    mn = [min(p[i] for p in pts) for i in range(3)]; mx = [max(p[i] for p in pts) for i in range(3)]
    r['size'] = [round(mx[i] - mn[i], 3) for i in range(3)]
r['imgs'] = [(i.name, list(i.size)) for i in bpy.data.images][:20]
json.dump(r, open(out, 'w'), ensure_ascii=False)

#!/usr/bin/env python3
"""Prepare a downloaded model for the game.
usage: python3 prep_model.py src.(fbx|glb) out.glb TARGET_TRIS [anims=0|1] [join=0|1]
- keeps the skeleton (if any) and skin weights
- removes shape keys, cameras, lights
- decimates every mesh so the total is ~TARGET_TRIS (collapse, UV-seam aware)
- smooth shading by angle, exports GLB (textures are shrunk later by gltf-transform)"""
import sys, bpy, math

a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, out, target = a[0], a[1], int(a[2])
anims = len(a) > 3 and a[3] == '1'
join = len(a) > 4 and a[4] == '1'

bpy.ops.wm.read_factory_settings(use_empty=True)
if src.lower().endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=False, use_anim=anims)
else: bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
for o in list(sc.objects):
    if o.type in ('CAMERA', 'LIGHT'): bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in sc.objects if o.type == 'MESH']
for m in meshes:
    if m.data.shape_keys:
        bpy.context.view_layer.objects.active = m
        m.shape_key_clear() if hasattr(m, 'shape_key_clear') else None
        for kb in list(m.data.shape_keys.key_blocks if m.data.shape_keys else [])[::-1]: m.shape_key_remove(kb)
# tiny helper meshes with zero area (e.g. bounding helpers) and hidden objects
for m in list(meshes):
    if len(m.data.polygons) == 0: bpy.data.objects.remove(m, do_unlink=True)
meshes = [o for o in sc.objects if o.type == 'MESH']

# weld: many Sketchfab meshes are triangle soups, which collapse-decimation tears apart
import mathutils
for m in meshes:
    bb = [mathutils.Vector(c) for c in m.bound_box]; diag = (bb[6] - bb[0]).length or 1
    bpy.ops.object.select_all(action='DESELECT'); m.select_set(True); bpy.context.view_layer.objects.active = m
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=diag*float(__import__("os").environ.get("WELD","2e-5"))); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
def tris(m): return sum(len(p.vertices) - 2 for p in m.data.polygons)
total = sum(tris(m) for m in meshes)
ratio = min(1.0, target/max(1, total))
print('tris before', total, 'ratio', round(ratio, 4))
for m in meshes:
    t = tris(m)
    if ratio < .97 and t > 200:
        bpy.ops.object.select_all(action='DESELECT'); m.select_set(True); bpy.context.view_layer.objects.active = m
        d = m.modifiers.new('dec', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.ratio = ratio; d.use_collapse_triangulate = True
        bpy.ops.object.modifier_move_to_index(modifier='dec', index=0)
        bpy.ops.object.modifier_apply(modifier='dec')
    me = m.data
    try: me.free_normals_split() if hasattr(me, 'free_normals_split') else None
    except Exception: pass
    if me.has_custom_normals:
        bpy.ops.object.select_all(action='DESELECT'); m.select_set(True); bpy.context.view_layer.objects.active = m
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for p in me.polygons: p.use_smooth = True
    if hasattr(me, 'set_sharp_from_angle'): me.set_sharp_from_angle(angle=math.radians(60))
print('tris after', sum(tris(m) for m in meshes))

if join and len(meshes) > 1:
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes: m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]; bpy.ops.object.join()

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_skins=True, export_animations=anims,
    export_yup=True, export_apply=False, export_image_format='AUTO', export_morph=False,
    export_force_sampling=True, export_optimize_animation_size=True)
print('written', out)

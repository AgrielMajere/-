import sys, bpy, mathutils
src, out = sys.argv[1], sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for m in ms: m.select_set(True)
bpy.context.view_layer.objects.active = ms[0]; bpy.ops.object.join(); ob = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
dims = ob.dimensions; h = max(dims)
r = ob.modifiers.new('r', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = h/320; r.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier='r')
t = sum(len(p.vertices) - 2 for p in ob.data.polygons); print('after remesh', t)
d = ob.modifiers.new('d', 'DECIMATE'); d.ratio = min(1, 45000/t); bpy.ops.object.modifier_apply(modifier='d')
for p in ob.data.polygons: p.use_smooth = True
mat = bpy.data.materials.new('MinoSkin'); mat.use_nodes = True; b = mat.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (.16, .1, .07, 1); b.inputs['Roughness'].default_value = .7
ob.data.materials.clear(); ob.data.materials.append(mat)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')

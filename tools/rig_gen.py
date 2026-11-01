#!/usr/bin/env python3
"""Rig an AI-generated character shape for the game.
in:  shape GLB (untextured, any scale), the cut-out RGBA image it was made from
out: GLB with a Mixamo-named skeleton (Hips, Spine, ... LeftArm ...), automatic (heat) skin weights,
     the image projected front-to-back as a texture.
usage: python3 rig_gen.py shape.glb image_rgba.png out.glb [height_m]"""
import sys, math
import numpy as np
import bpy, bmesh
from mathutils import Vector

src, img_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
H = float(sys.argv[4]) if len(sys.argv) > 4 else 1.95

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')   # Sketchfab roots carry the up-axis rotation
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
ROT = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0   # yaw (deg) that turns the model to face the viewer
if ROT:
    ob.rotation_euler[2] = math.radians(ROT)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.context.scene.objects):
    if o != ob: bpy.data.objects.remove(o, do_unlink=True)

# ---- normalise: feet on z=0, centred, height H (Blender is z-up; glTF import already converted) ----
me = ob.data
V = np.array([v.co[:] for v in me.vertices])
mn, mx = V.min(0), V.max(0)
k = H/(mx[2] - mn[2])
ctr = np.array([(mn[0] + mx[0])/2, (mn[1] + mx[1])/2, mn[2]])
V = (V - ctr)*k
for v, c in zip(me.vertices, V): v.co = c
print('bbox after', V.min(0), V.max(0))
# which way is the front? glTF +z (viewer) became Blender -y. Hunyuan meshes face the camera.
FRONT = -1  # front is -y in Blender

KEEP = img_path == 'keep'
if not KEEP:
    # ---- texture: planar projection of the cut-out image (front), mirrored on the back ----
    from PIL import Image, ImageFilter
    im = Image.open(img_path).convert('RGBA'); a = np.array(im)
    # fill transparent pixels with the nearest opaque colour so seams/edges never show white
    rgb = a[:, :, :3].astype(np.float32); al = (a[:, :, 3] > 40).astype(np.float32)
    acc = rgb*al[..., None]; wsum = al.copy(); filled = al.copy()
    import itertools
    for it in range(80):
        if filled.min() > 0: break
        sh = [np.roll(np.roll(acc, dy, 0), dx, 1) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        sw = [np.roll(np.roll(filled, dy, 0), dx, 1) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        ssum = sum(sw); nacc = sum(sh)
        grow = (filled == 0) & (ssum > 0)
        acc[grow] = nacc[grow]/ssum[grow][:, None]; filled[grow] = 1
    acc[filled == 0] = rgb[al > 0].mean(0)
    tex_img = Image.fromarray(np.clip(acc, 0, 255).astype(np.uint8)); tex_img.thumbnail((1024, 1024))
    tex_path = img_path.rsplit('.', 1)[0] + '_tex.jpg'; tex_img.save(tex_path, quality=88)
    ys, xs = np.where(a[:, :, 3] > 40)
    bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
    W, Hh = im.size
    V = np.array([v.co[:] for v in me.vertices]); vmn, vmx = V.min(0), V.max(0)
    uvl = me.uv_layers.new(name='UV') if not me.uv_layers else me.uv_layers[0]
    # vertex -> uv : x maps across the image bbox, z maps up the image bbox
    def uv_of(co):
        u = (bx0 + (co[0] - vmn[0])/(vmx[0] - vmn[0])*(bx1 - bx0))/W
        v = 1 - (by1 - (co[2] - vmn[2])/(vmx[2] - vmn[2])*(by1 - by0))/Hh
        return (u, v)
    for poly in me.polygons:
        for li in poly.loop_indices:
            uvl.data[li].uv = uv_of(me.vertices[me.loops[li].vertex_index].co)
    # facing attribute (1 = front, 0 = back) for the shader to dim the mirrored back side
    col = me.color_attributes.new(name='Facing', type='FLOAT_COLOR', domain='POINT')
    me.calc_normals_split() if hasattr(me, 'calc_normals_split') else None
    for i, v in enumerate(me.vertices):
        f = .5 + .5*max(0.0, min(1.0, .5 + .5*(-v.normal[1])))
        col.data[i].color = (f, f, f, 1)
    mat = bpy.data.materials.new('GenSkin'); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(tex_path); tex.image.pack()
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = .55
    if 'Metallic' in bsdf.inputs: bsdf.inputs['Metallic'].default_value = .35
    me.materials.clear(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    if hasattr(me, 'set_sharp_from_angle'): me.set_sharp_from_angle(angle=3.1)


else:
    for p in me.polygons: p.use_smooth = True
# ---- landmarks from the mesh: slices along height ----
V = np.array([v.co[:] for v in me.vertices])
def slab(z0, z1):
    s = V[(V[:, 2] >= z0) & (V[:, 2] < z1)]
    return s if len(s) else np.zeros((1, 3))
def xr(z0, z1):
    s = slab(z0, z1); return s[:, 0].min(), s[:, 0].max()
hz = lambda f: f*H
# torso centre line ~ x=0; shoulders: widest point in 0.74..0.86H
sh_l, sh_r = xr(hz(.78), hz(.82))
torso_w = (sh_r - sh_l)
J = {}
J['Hips'] = (0, 0, hz(.53)); J['Spine'] = (0, 0, hz(.60)); J['Spine1'] = (0, 0, hz(.67)); J['Spine2'] = (0, 0, hz(.74))
J['Neck'] = (0, 0, hz(.845)); J['Head'] = (0, 0, hz(.88)); J['HeadTop_End'] = (0, 0, H)
# arms: hanging slightly outward. Measure outer extent of the body at hand height.
shx = max(abs(sh_l), abs(sh_r))*.62
ymid = np.median(V[:, 1])
def clusters(z0, z1, front=True, gap=.035):
    s2 = V[(V[:, 2] >= z0) & (V[:, 2] < z1)]
    if front: s2 = s2[s2[:, 1] < ymid]
    if len(s2) < 5: return []
    xs = np.sort(s2[:, 0]); cuts = np.where(np.diff(xs) > gap)[0]; out = []; st = 0
    for c in list(cuts) + [len(xs) - 1]:
        seg = xs[st:c + 1]
        if len(seg) > 8: out.append((seg.min(), seg.max()))
        st = c + 1
    return out
knee = clusters(hz(.25), hz(.30)); ank = clusters(hz(.06), hz(.10))
legx = None
for cl in (ank, knee):
    if len(cl) >= 2:
        cs = sorted([(c[0] + c[1])/2 for c in cl], key=lambda x: abs(x))[:2]; cs = sorted(cs)
        if cs[0] < 0 < cs[1]: legx = (cs[1], cs[0]); break
print('leg clusters', knee, ank, '->', legx)
for side, sgn in (('Left', 1), ('Right', -1)):
    # Blender +x is the character's LEFT when the character faces -y
    hand_x = (xr(hz(.40), hz(.50))[1] if sgn > 0 else -xr(hz(.40), hz(.50))[0])*.82
    J[side + 'Shoulder'] = (sgn*.06*H/1.8, 0, hz(.815)); J[side + 'Arm'] = (sgn*shx, 0, hz(.80))
    elbow_x = (shx + hand_x)/2
    J[side + 'ForeArm'] = (sgn*elbow_x, 0, hz(.63)); J[side + 'Hand'] = (sgn*hand_x, 0, hz(.47)); J[side + 'HandEnd'] = (sgn*hand_x, 0, hz(.41))
    lx = (legx[0] if sgn > 0 else legx[1]) if legx else sgn*.1*H/1.8
    J[side + 'UpLeg'] = (sgn*max(.08, abs(lx)*.8)*H/H, 0, hz(.505)); J[side + 'Leg'] = (lx, 0, hz(.285)); J[side + 'Foot'] = (lx*1.05, 0, hz(.05))
    J[side + 'ToeBase'] = (lx*1.05, FRONT*.12*H/1.8, hz(.01)); J[side + 'ToeEnd'] = (lx*1.05, FRONT*.2*H/1.8, hz(.01))
# put spine joints into the body depth centre
for kk in list(J):
    x, y, z = J[kk]; s = slab(z - .03, z + .03); s = s[np.abs(s[:, 0] - x) < .08] if len(s) > 3 else s
    if len(s) > 3: y = (s[:, 1].min() + s[:, 1].max())/2 if 'Toe' not in kk else y
    J[kk] = (x, y, z)
PARENT = {'Spine': 'Hips', 'Spine1': 'Spine', 'Spine2': 'Spine1', 'Neck': 'Spine2', 'Head': 'Neck',
          'LeftShoulder': 'Spine2', 'LeftArm': 'LeftShoulder', 'LeftForeArm': 'LeftArm', 'LeftHand': 'LeftForeArm',
          'RightShoulder': 'Spine2', 'RightArm': 'RightShoulder', 'RightForeArm': 'RightArm', 'RightHand': 'RightForeArm',
          'LeftUpLeg': 'Hips', 'LeftLeg': 'LeftUpLeg', 'LeftFoot': 'LeftLeg', 'LeftToeBase': 'LeftFoot',
          'RightUpLeg': 'Hips', 'RightLeg': 'RightUpLeg', 'RightFoot': 'RightLeg', 'RightToeBase': 'RightFoot'}
TAIL = {'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head', 'Head': 'HeadTop_End',
        'LeftShoulder': 'LeftArm', 'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand', 'LeftHand': 'LeftHandEnd',
        'RightShoulder': 'RightArm', 'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand', 'RightHand': 'RightHandEnd',
        'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot', 'LeftFoot': 'LeftToeBase', 'LeftToeBase': 'LeftToeEnd',
        'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot', 'RightFoot': 'RightToeBase', 'RightToeBase': 'RightToeEnd'}
arm = bpy.data.armatures.new('Armature'); ao = bpy.data.objects.new('Armature', arm); bpy.context.scene.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT')
eb = {}
for b in ['Hips'] + list(PARENT):
    e = arm.edit_bones.new(b); e.head = Vector(J[b]); e.tail = Vector(J[TAIL[b]])
    if (e.tail - e.head).length < 1e-3: e.tail = e.head + Vector((0, 0, .05))
    eb[b] = e
for b, p in PARENT.items(): eb[b].parent = eb[p]; eb[b].use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); ao.select_set(True); bpy.context.view_layer.objects.active = ao
# heat weighting needs a closed, welded surface: weight a welded proxy, then copy weights onto the real mesh
proxy = ob.copy(); proxy.data = ob.data.copy(); bpy.context.scene.collection.objects.link(proxy)
bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True); bpy.context.view_layer.objects.active = proxy
# watertight proxy: voxel remesh (works for armour plates, cloth, multi-part meshes)
for md in list(proxy.modifiers): proxy.modifiers.remove(md)
rm = proxy.modifiers.new('vox', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = H/110; rm.adaptivity = 0
bpy.ops.object.modifier_apply(modifier='vox')
print('proxy tris', len(proxy.data.polygons))
bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True); ao.select_set(True); bpy.context.view_layer.objects.active = ao
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
pz = sum(1 for v in proxy.data.vertices if len(v.groups) == 0); print('proxy verts without weights', pz, 'of', len(proxy.data.vertices))
for g in proxy.vertex_groups: ob.vertex_groups.new(name=g.name)
mod = ob.modifiers.new('wt', 'DATA_TRANSFER'); mod.object = proxy; mod.use_vert_data = True; mod.data_types_verts = {'VGROUP_WEIGHTS'}; mod.vert_mapping = 'POLYINTERP_NEAREST'; mod.layers_vgroup_select_src = 'ALL'; mod.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.modifier_apply(modifier='wt')
bpy.data.objects.remove(proxy, do_unlink=True)
ob.parent = ao; am = ob.modifiers.new('Armature', 'ARMATURE'); am.object = ao
nz = sum(1 for v in me.vertices if len(v.groups) == 0)
print('verts without weights', nz, 'of', len(me.vertices))

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_skins=True, export_animations=False, export_yup=True, export_image_format='JPEG', export_jpeg_quality=88)
print('written', out)

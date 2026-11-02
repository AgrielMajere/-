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
# T-pose / wide arms? (arm span at chest height much wider than the hips)
# many vertices far from the axis at shoulder height but few at chest height => arms stretched out
band = lambda a, b: V[(V[:, 2] > hz(a)) & (V[:, 2] < hz(b))]
hi, lo = band(.74, .88), band(.60, .70)
n_hi = int((np.abs(hi[:, 0]) > .26*H).sum()); n_lo = int((np.abs(lo[:, 0]) > .26*H).sum())
upper = hi[np.abs(hi[:, 0]) > .26*H]
wide = float(np.percentile(np.abs(upper[:, 0]), 98)) if len(upper) > 20 else 0
hipw = n_lo
TPOSE = (n_hi > 3*n_lo + 40 and wide > .3*H) or (len(sys.argv) > 6 and sys.argv[6] == 't')
if TPOSE and wide < .3*H: wide = float(np.percentile(np.abs(band(.7, .9)[:, 0]), 99.5))
armZ = hz(.80)
if TPOSE:
    far = upper[np.abs(upper[:, 0]) > .7*wide]; armZ = float(np.median(far[:, 2])) if len(far) else hz(.8)
    shx = .12*H
print('T-pose arms' if TPOSE else 'arms down', round(float(wide), 3), round(float(hipw), 3))
for side, sgn in (('Left', 1), ('Right', -1)):
    # Blender +x is the character's LEFT when the character faces -y
    if TPOSE:
        hx = wide*.86
        J[side + 'Shoulder'] = (sgn*.06*H/1.8, 0, armZ + .01*H); J[side + 'Arm'] = (sgn*shx, 0, armZ)
        J[side + 'ForeArm'] = (sgn*(shx + (hx - shx)*.5), 0, armZ); J[side + 'Hand'] = (sgn*hx, 0, armZ); J[side + 'HandEnd'] = (sgn*wide*.98, 0, armZ)
        continue
    hand_x = (xr(hz(.40), hz(.50))[1] if sgn > 0 else -xr(hz(.40), hz(.50))[0])*.82
    J[side + 'Shoulder'] = (sgn*.06*H/1.8, 0, hz(.815)); J[side + 'Arm'] = (sgn*shx, 0, hz(.80))
    elbow_x = (shx + hand_x)/2
    J[side + 'ForeArm'] = (sgn*elbow_x, 0, hz(.63)); J[side + 'Hand'] = (sgn*hand_x, 0, hz(.47)); J[side + 'HandEnd'] = (sgn*hand_x, 0, hz(.41))
for side, sgn in (('Left', 1), ('Right', -1)):
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
if nz > .3*len(me.vertices):
    # fallback: distance-to-bone weights (left/right kept apart), smoothed over the mesh
    print('heat weighting failed -> distance weights')
    bones = [b for b in ['Hips'] + list(PARENT)]
    A = np.array([J[b] for b in bones]); B = np.array([J[TAIL[b]] for b in bones])
    P = np.array([v.co[:] for v in me.vertices])
    D = np.empty((len(P), len(bones)))
    for j in range(len(bones)):
        ab = B[j] - A[j]; L2 = max(1e-9, ab @ ab)
        t = np.clip(((P - A[j]) @ ab)/L2, 0, 1)
        D[:, j] = np.linalg.norm(P - (A[j] + t[:, None]*ab), axis=1)
    side = P[:, 0]
    for j, b in enumerate(bones):
        if b.startswith('Left'): D[side < -.02*H, j] += H        # character's left = +x
        if b.startswith('Right'): D[side > .02*H, j] += H
        if b in ('LeftShoulder', 'RightShoulder'): D[:, j] *= 1.6
    W = 1.0/np.maximum(D, .01*H)**4
    k = 3; idx = np.argsort(-W, axis=1)[:, k:]; np.put_along_axis(W, idx, 0, axis=1)
    W /= W.sum(1, keepdims=True)
    # Laplacian smoothing over edges
    E = np.array([e.vertices[:] for e in me.edges])
    for it in range(6):
        acc = np.zeros_like(W); cnt = np.zeros(len(P))
        np.add.at(acc, E[:, 0], W[E[:, 1]]); np.add.at(acc, E[:, 1], W[E[:, 0]])
        np.add.at(cnt, E[:, 0], 1); np.add.at(cnt, E[:, 1], 1)
        m = cnt > 0; W[m] = .5*W[m] + .5*acc[m]/cnt[m][:, None]
    W /= W.sum(1, keepdims=True)
    for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
    G = [ob.vertex_groups.new(name=b) for b in bones]
    for j, g in enumerate(G):
        nzi = np.nonzero(W[:, j] > .01)[0]
        for i in nzi: g.add([int(i)], float(W[i, j]), 'REPLACE')
    nz = sum(1 for v in me.vertices if len(v.groups) == 0)
print('verts without weights', nz, 'of', len(me.vertices))

# legs: always side-separated distance weights below the hips (heat weights fuse legs that stand close together)
if len(sys.argv) > 7 and sys.argv[7] == 'legs':
    LB = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
    A_ = np.array([J[b] for b in LB]); B_ = np.array([J[TAIL[b]] for b in LB])
    P_ = np.array([v.co[:] for v in me.vertices]); sel = np.nonzero(P_[:, 2] < hz(.5))[0]
    for g in LB:
        if not ob.vertex_groups.get(g): ob.vertex_groups.new(name=g)
    allg = [g.index for g in ob.vertex_groups]
    W = np.zeros((len(P_), len(LB))); insel = np.zeros(len(P_), bool); insel[sel] = True
    # side of each vertex = the closer leg chain (not the sign of x: legs that stand close cross the midline)
    def dseg(p, a, b):
        ab = b - a; t = np.clip(np.dot(p - a, ab)/max(1e-9, ab @ ab), 0, 1); return np.linalg.norm(p - (a + t*ab))
    chain = {s: [(np.array(J[s + b]), np.array(J[TAIL[s + b]])) for b in ('UpLeg', 'Leg', 'Foot')] for s in ('Left', 'Right')}
    crotch = min(J['LeftUpLeg'][2], J['RightUpLeg'][2]) - .03*H
    SIDE = np.zeros(len(P_), int)
    for i in sel:
        p = P_[i]; dl = min(dseg(p, a, b) for a, b in chain['Left']); dr = min(dseg(p, a, b) for a, b in chain['Right']); SIDE[i] = -1 if dl < dr else 1
    for i in sel:
        p = P_[i]; side = SIDE[i]; low = p[2] < crotch
        for j, bn in enumerate(LB):
            dd = dseg(p, A_[j], B_[j])
            if low and ((bn.startswith('Left') and side > 0) or (bn.startswith('Right') and side < 0)): dd += H
            if bn == 'Hips': dd *= 1.0 + 3*max(0, (hz(.45) - p[2])/H)
            W[i, j] = 1/max(dd, .01*H)**4
        W[i] /= W[i].sum()
    # smooth along the surface so knees and ankles bend softly
    E = np.array([e.vertices[:] for e in me.edges]); E = E[insel[E[:, 0]] & insel[E[:, 1]]]
    E = E[(SIDE[E[:, 0]] == SIDE[E[:, 1]]) | ((P_[E[:, 0], 2] >= crotch) & (P_[E[:, 1], 2] >= crotch))]   # never smooth across the legs
    import os
    for it in range(int(os.environ.get('RIG_SMOOTH', '8'))):
        acc = np.zeros_like(W); cnt = np.zeros(len(P_))
        np.add.at(acc, E[:, 0], W[E[:, 1]]); np.add.at(acc, E[:, 1], W[E[:, 0]]); np.add.at(cnt, E[:, 0], 1); np.add.at(cnt, E[:, 1], 1)
        m = insel & (cnt > 0); W[m] = .5*W[m] + .5*acc[m]/cnt[m][:, None]
    for i in sel:
        w = W[i]; top = np.argsort(-w)[:3]; w2 = np.zeros_like(w); w2[top] = w[top]; w2 /= max(1e-9, w2.sum())
        for gi in allg: ob.vertex_groups[gi].remove([int(i)])
        for j in top:
            if w2[j] > .01: ob.vertex_groups[LB[j]].add([int(i)], float(w2[j]), 'REPLACE')
    print('legs reweighted', len(sel))
    # faces that bridge the two legs (legs modelled touching) would stretch into a web when the legs part: cut them
    import bmesh
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    web = [f for f in bm.faces if len({int(SIDE[v.index]) for v in f.verts}) > 1 and any(P_[v.index][2] < crotch for v in f.verts)]
    bmesh.ops.delete(bm, geom=web, context='FACES_ONLY'); bm.to_mesh(me); bm.free(); me.update()
    print('web faces cut', len(web))
    kn = J['LeftLeg'][2]; lowv = [i for i in sel if P_[i][2] < kn]; mism = sum(1 for i in lowv if SIDE[i] != (1 if P_[i][0] > 0 else -1))
    print('DIAG side', len(lowv), 'mismatch', mism, 'J', [tuple(round(x,3) for x in J[b]) for b in ('LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot')], 'H', H)
# keep hair / cloaks / props hanging near the arms out of the arm bones: anything far from the arm chain goes to the torso
ARMB = [b for b in ('LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand') if ob.vertex_groups.get(b)]
DRAPE = len(sys.argv) > 8 and sys.argv[8] == 'drape'   # T-pose model with cloth hanging from the arms
if ARMB and (not TPOSE or DRAPE):   # T-pose sleeves are wide by nature: leave them on the arms
    segs = [(np.array(J[b]), np.array(J[TAIL[b]])) for b in ARMB]
    def dseg(p, a, b):
        ab = b - a; t = max(0.0, min(1.0, float(np.dot(p - a, ab)/max(1e-9, np.dot(ab, ab))))); return float(np.linalg.norm(p - (a + t*ab)))
    gi = {ob.vertex_groups[b].index: b for b in ARMB}
    sp2 = ob.vertex_groups.get('Spine2') or ob.vertex_groups.new(name='Spine2'); hip = ob.vertex_groups.get('Hips') or ob.vertex_groups.new(name='Hips')
    R = (float(sys.argv[9]) if len(sys.argv) > 9 else .11 if DRAPE else .085)*H; moved = 0
    for v in me.vertices:
        arm_w = [(g.group, g.weight) for g in v.groups if g.group in gi]
        if not arm_w: continue
        p = np.array(v.co[:]); d = min(dseg(p, a, b) for a, b in segs)
        if d > R:
            k = min(1.0, (d - R)/(.05*H)); tot = 0.0
            for gidx, w in arm_w: ob.vertex_groups[gidx].add([v.index], w*(1 - k), 'REPLACE'); tot += w*k
            (sp2 if p[2] > hz(.6) else hip).add([v.index], tot, 'ADD'); moved += 1
    print('arm weights moved to torso on', moved, 'verts')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_skins=True, export_animations=False, export_yup=True, export_image_format='JPEG', export_jpeg_quality=88)
print('written', out)

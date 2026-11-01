#!/usr/bin/env python3
"""Build game-ready GLB humans from MakeHuman CC0 data.
Output per gender: skinned body + eyes, MakeHuman default skeleton (rest rotations = identity,
joints at MakeHuman joint positions), morph targets for body/face sliders (sparse), and a
_CLOTH vertex attribute (shirt, sleeve, pants, boots masks from bone weights)."""
import json, sys, os, struct, math
import numpy as np
import pygltflib as G

D = '/tmp/claude-0/mh/makehuman/data'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/mmo/public/models'
SCALE = .1

# ---------- base mesh ----------
V, VT, faces, grp = [], [], [], None
for l in open(f'{D}/3dobjs/base.obj'):
    if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
    elif l.startswith('vt '): VT.append([float(x) for x in l.split()[1:3]])
    elif l.startswith('g '): grp = l.split()[1].strip()
    elif l.startswith('f ') and grp == 'body':
        fv = [p.split('/') for p in l.split()[1:]]
        faces.append([(int(a[0]) - 1, int(a[1]) - 1) for a in fv])
V = np.array(V, dtype=np.float64); VT = np.array(VT, dtype=np.float64)
NV = len(V)
_tc = {}
def T(rel):
    if rel in _tc: return _tc[rel]
    d = np.zeros((NV, 3))
    p = f'{D}/targets/{rel}'
    if not os.path.exists(p): print('missing', rel); _tc[rel] = d; return d
    for l in open(p):
        l = l.strip()
        if not l or l.startswith('#'): continue
        s = l.split(); d[int(s[0])] = [float(s[1]), float(s[2]), float(s[3])]
    _tc[rel] = d; return d
RACES = ['african', 'asian', 'caucasian']
def macro(g, age='young', mus='averagemuscle', wt='averageweight'):
    return T(f'macrodetails/universal-{g}-{age}-{mus}-{wt}.target') + sum(T(f'macrodetails/{r}-{g}-{age}.target') for r in RACES)/3

skel = json.load(open(f'{D}/rigs/default.mhskel'))
wts = json.load(open(f'{D}/rigs/default_weights.mhw'))['weights']
bones = skel['bones']
order = []
def visit(b):
    order.append(b)
    for c in sorted(k for k, v in bones.items() if v['parent'] == b): visit(c)
visit('root')
bidx = {b: i for i, b in enumerate(order)}

# per-vertex top-4 weights
VW = [dict() for _ in range(NV)]
for b, lst in wts.items():
    if b not in bidx: continue
    for vi, w in lst: VW[vi][bidx[b]] = VW[vi].get(bidx[b], 0) + w

def cloth_masks():
    groups = {
        0: lambda n: n.startswith(('spine', 'clavicle', 'breast', 'shoulder01', 'upperarm')),
        1: lambda n: n.startswith('lowerarm'),
        2: lambda n: n in ('root',) or n.startswith(('pelvis', 'upperleg', 'lowerleg01')),
        3: lambda n: n.startswith(('foot', 'toe', 'lowerleg02')),
    }
    M = np.zeros((NV, 4), dtype=np.float32)
    for vi in range(NV):
        tot = sum(VW[vi].values()) or 1
        for bi, w in VW[vi].items():
            n = order[bi]
            for k, f in groups.items():
                if f(n): M[vi, k] += w/tot
    return M
CLOTH = cloth_masks()

# ---------- eyes (proxy fitted on the body) ----------
def load_obj(p):
    v, vt, f = [], [], []
    for l in open(p):
        if l.startswith('v '): v.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('vt '): vt.append([float(x) for x in l.split()[1:3]])
        elif l.startswith('f '): f.append([(int(a.split('/')[0]) - 1, int(a.split('/')[1]) - 1) for a in l.split()[1:]])
    return np.array(v), np.array(vt), f
def fit_proxy(mhclo, S):
    lines = open(mhclo).read().split('\n'); sc = {}; refs = []; obj = None; i = 0
    while i < len(lines):
        l = lines[i].strip(); i += 1
        if l.startswith('obj_file'): obj = l.split()[1]
        for a in ('x_scale', 'y_scale', 'z_scale'):
            if l.startswith(a): s = l.split(); sc[a[0]] = (int(s[1]), int(s[2]), float(s[3]))
        if l.startswith('verts'):
            while i < len(lines) and lines[i].strip() and not lines[i].startswith(('weights', 'delete', '#')):
                refs.append([float(x) for x in lines[i].split()]); i += 1
    k = np.array([np.linalg.norm(S[sc[a][0]] - S[sc[a][1]])/sc[a][2] for a in 'xyz'])
    out = []
    for r in refs:
        if len(r) == 1: out.append(S[int(r[0])])
        else:
            a, b, c = int(r[0]), int(r[1]), int(r[2]); out.append(r[3]*S[a] + r[4]*S[b] + r[5]*S[c] + np.array(r[6:9])*k)
    return os.path.join(os.path.dirname(mhclo), obj), np.array(out)

# ---------- assemble ----------
def build(g):
    base = V + macro(g)
    morphs = []   # (name, delta over NV)
    def add(name, d): morphs.append((name, d))
    add('muscle+', macro(g, mus='maxmuscle') - macro(g)); add('muscle-', macro(g, mus='minmuscle') - macro(g))
    add('weight+', macro(g, wt='maxweight') - macro(g)); add('weight-', macro(g, wt='minweight') - macro(g))
    add('age+', macro(g, age='old') - macro(g))
    add('heightLegs+', T(f'macrodetails/height/{g}-young-averagemuscle-averageweight-maxheight.target')); add('heightLegs-', T(f'macrodetails/height/{g}-young-averagemuscle-averageweight-minheight.target'))
    LR = lambda n: T(f'{n[0]}/l-{n[1]}') + T(f'{n[0]}/r-{n[1]}')
    for nm, rel in [('noseW+', 'nose/nose-scale-horiz-incr.target'), ('noseW-', 'nose/nose-scale-horiz-decr.target'), ('noseL+', 'nose/nose-scale-vert-incr.target'), ('noseL-', 'nose/nose-scale-vert-decr.target'), ('noseHump', 'nose/nose-hump-incr.target'),
                    ('chin+', 'chin/chin-prominent-incr.target'), ('chin-', 'chin/chin-prominent-decr.target'), ('jaw+', 'chin/chin-width-incr.target'), ('jaw-', 'chin/chin-width-decr.target'),
                    ('headFat+', 'head/head-fat-incr.target'), ('headFat-', 'head/head-fat-decr.target'), ('headSquare', 'head/head-square.target'), ('headRound', 'head/head-round.target'), ('headOval', 'head/head-oval.target'),
                    ('mouthW+', 'mouth/mouth-scale-horiz-incr.target'), ('mouthW-', 'mouth/mouth-scale-horiz-decr.target')]:
        add(nm, T(rel))
    add('lips+', T('mouth/mouth-upperlip-volume-incr.target') + T('mouth/mouth-lowerlip-volume-incr.target'))
    add('cheeks+', LR(('cheek', 'cheek-bones-incr.target'))); add('cheeks-', LR(('cheek', 'cheek-bones-decr.target')))
    add('eyes+', LR(('eyes', 'eye-scale-incr.target'))); add('eyes-', LR(('eyes', 'eye-scale-decr.target')))
    add('earsPointed', LR(('ears', 'ear-shape-pointed.target')) + .6*LR(('ears', 'ear-scale-vert-incr.target')))
    add('ears+', LR(('ears', 'ear-scale-incr.target')))
    if g == 'female':
        add('breast+', T('breast/female-young-averagemuscle-averageweight-maxcup-averagefirmness.target'))
        add('breast-', T('breast/female-young-averagemuscle-averageweight-mincup-averagefirmness.target'))

    # skeleton from joints
    J = {k: base[v].mean(0) for k, v in skel['joints'].items()}
    head = {b: J[bones[b]['head']] for b in order}
    miny = base[[vi for f in faces for vi, _ in f]][:, 1].min()
    off = np.array([0, -miny, 0])
    P = lambda x: ((x + off)*SCALE).astype(np.float32)

    # unique (v, vt) for the body
    key = {}; vmap = []; tmap = []; idx = []
    for f in faces:
        ids = []
        for vi, ti in f:
            k = (vi, ti)
            if k not in key: key[k] = len(vmap); vmap.append(vi); tmap.append(ti)
            ids.append(key[k])
        for t in range(1, len(ids) - 1): idx += [ids[0], ids[t], ids[t + 1]]
    vmap = np.array(vmap); pos = P(base[vmap]); uv = VT[tmap].astype(np.float32); uv[:, 1] = 1 - uv[:, 1]
    idx = np.array(idx, dtype=np.uint32)
    def normals(p, ix):
        n = np.zeros_like(p, dtype=np.float64); tri = ix.reshape(-1, 3); a, b, c = p[tri[:, 0]], p[tri[:, 1]], p[tri[:, 2]]; fn = np.cross(b - a, c - a)
        for k in range(3): np.add.at(n, tri[:, k], fn)
        # merge normals across uv seams (same original vertex)
        return n
    nrm = normals(pos, idx)
    acc = np.zeros((NV, 3)); np.add.at(acc, vmap, nrm); nrm = acc[vmap]; nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9
    JW = np.zeros((len(vmap), 4), np.uint16); WW = np.zeros((len(vmap), 4), np.float32)
    for i, vi in enumerate(vmap):
        it = sorted(VW[vi].items(), key=lambda x: -x[1])[:4]
        if not it: it = [(bidx['root'], 1.0)]
        s = sum(w for _, w in it)
        for j, (bi, w) in enumerate(it): JW[i, j] = bi; WW[i, j] = w/s
    cloth = CLOTH[vmap]

    # eyes
    eobj, efit = fit_proxy(f'{D}/eyes/low-poly/low-poly.mhclo', base)
    ev, evt, ef = load_obj(eobj)
    ekey = {}; evm = []; etm = []; eidx = []
    for f in ef:
        ids = []
        for vi, ti in f:
            k = (vi, ti)
            if k not in ekey: ekey[k] = len(evm); evm.append(vi); etm.append(ti)
            ids.append(ekey[k])
        for t in range(1, len(ids) - 1): eidx += [ids[0], ids[t], ids[t + 1]]
    epos = P(efit[evm]); euv = evt[etm].astype(np.float32); euv[:, 1] = 1 - euv[:, 1]; eidx = np.array(eidx, np.uint32)
    enrm = normals(epos, eidx); enrm /= np.linalg.norm(enrm, axis=1, keepdims=True) + 1e-9
    ej = np.zeros((len(evm), 4), np.uint16); ew = np.zeros((len(evm), 4), np.float32)
    for i in range(len(evm)): ej[i, 0] = bidx['eye.L'] if epos[i, 0] > 0 else bidx['eye.R']; ew[i, 0] = 1

    # ---------- write glTF ----------
    blob = bytearray(); views = []; accs = []
    def view(arr, target=None):
        b = arr.tobytes();
        while len(blob) % 4: blob.append(0)
        o = len(blob); blob.extend(b)
        views.append(G.BufferView(buffer=0, byteOffset=o, byteLength=len(b), target=target)); return len(views) - 1
    CT = {np.float32: G.FLOAT, np.uint32: G.UNSIGNED_INT, np.uint16: G.UNSIGNED_SHORT}
    def acc(arr, typ, target=G.ARRAY_BUFFER, minmax=False):
        arr = np.ascontiguousarray(arr); v = view(arr, target)
        a = G.Accessor(bufferView=v, componentType=CT[arr.dtype.type], count=len(arr), type=typ)
        if minmax: a.min = arr.min(0).tolist(); a.max = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1
    def sparse_acc(delta):
        nz = np.where(np.abs(delta).sum(1) > 1e-7)[0].astype(np.uint32)
        vals = delta[nz].astype(np.float32)
        if len(nz) == 0: nz = np.array([0], np.uint32); vals = np.zeros((1, 3), np.float32)
        iv = view(nz); vv = view(np.ascontiguousarray(vals))
        a = G.Accessor(componentType=G.FLOAT, count=len(delta), type=G.VEC3, min=vals.min(0).tolist(), max=vals.max(0).tolist(),
                       sparse=G.Sparse(count=len(nz), indices=G.AccessorSparseIndices(bufferView=iv, componentType=G.UNSIGNED_INT), values=G.AccessorSparseValues(bufferView=vv)))
        accs.append(a); return len(accs) - 1
    a_pos = acc(pos, G.VEC3, minmax=True); a_nrm = acc(nrm.astype(np.float32), G.VEC3); a_uv = acc(uv, G.VEC2)
    a_j = acc(JW, G.VEC4); a_w = acc(WW, G.VEC4); a_c = acc(cloth.astype(np.float32), G.VEC4); a_i = acc(idx, G.SCALAR, G.ELEMENT_ARRAY_BUFFER)
    targets = []; names = []
    for nm, d in morphs:
        dd = (d[vmap]*SCALE).astype(np.float32); targets.append(G.Attributes(POSITION=sparse_acc(dd))); names.append(nm)
    e_pos = acc(epos, G.VEC3, minmax=True); e_nrm = acc(enrm.astype(np.float32), G.VEC3); e_uv = acc(euv, G.VEC2); e_j = acc(ej, G.VEC4); e_w = acc(ew, G.VEC4); e_i = acc(eidx, G.SCALAR, G.ELEMENT_ARRAY_BUFFER)
    # eye texture
    img = open(f'{D}/eyes/materials/brown_eye.png', 'rb').read()
    while len(blob) % 4: blob.append(0)
    io = len(blob); blob.extend(img); views.append(G.BufferView(buffer=0, byteOffset=io, byteLength=len(img))); iview = len(views) - 1

    nodes = []
    for b in order:
        p = bones[b]['parent']; t = head[b] - (head[p] if p else -off)
        nodes.append(G.Node(name=b, translation=(t*SCALE).astype(float).tolist()))
    for b in order: nodes[bidx[b]].children = [bidx[c] for c in order if bones[c]['parent'] == b] or None
    # inverse bind matrices: bones are pure translations
    ibm = []
    for b in order:
        w = (head[b] + off)*SCALE; m = np.eye(4, dtype=np.float32); m[:3, 3] = -w; ibm.append(m.T.reshape(-1))
    a_ibm = acc(np.array(ibm, np.float32), G.MAT4, target=None)
    body_prim = G.Primitive(attributes=G.Attributes(POSITION=a_pos, NORMAL=a_nrm, TEXCOORD_0=a_uv, JOINTS_0=a_j, WEIGHTS_0=a_w), indices=a_i, material=0, targets=targets)
    body_prim.attributes._CLOTH = a_c
    eye_prim = G.Primitive(attributes=G.Attributes(POSITION=e_pos, NORMAL=e_nrm, TEXCOORD_0=e_uv, JOINTS_0=e_j, WEIGHTS_0=e_w), indices=e_i, material=1)
    mesh_body = G.Mesh(name='MH_Body', primitives=[body_prim], weights=[0.0]*len(targets), extras={'targetNames': names})
    mesh_eyes = G.Mesh(name='MH_Eyes', primitives=[eye_prim])
    nb = len(nodes); nodes.append(G.Node(name='MH_Body', mesh=0, skin=0)); nodes.append(G.Node(name='MH_Eyes', mesh=1, skin=0))
    nodes.append(G.Node(name='MH_' + g, children=[bidx['root'], nb, nb + 1]))
    gl = G.GLTF2(scene=0, scenes=[G.Scene(nodes=[len(nodes) - 1])], nodes=nodes, meshes=[mesh_body, mesh_eyes], skins=[G.Skin(joints=list(range(len(order))), inverseBindMatrices=a_ibm, skeleton=bidx['root'])],
                 materials=[G.Material(name='MH_Skin', pbrMetallicRoughness=G.PbrMetallicRoughness(baseColorFactor=[.85, .65, .52, 1], metallicFactor=0, roughnessFactor=.6)),
                            G.Material(name='MH_Eye', pbrMetallicRoughness=G.PbrMetallicRoughness(baseColorTexture=G.TextureInfo(index=0), metallicFactor=0, roughnessFactor=.15))],
                 textures=[G.Texture(source=0, sampler=0)], images=[G.Image(bufferView=iview, mimeType='image/png')], samplers=[G.Sampler()],
                 accessors=accs, bufferViews=views, buffers=[G.Buffer(byteLength=len(blob))])
    gl.set_binary_blob(bytes(blob))
    out = f'{OUT}/mh_{g}.glb'; gl.save_binary(out)
    print(g, 'verts', len(pos), 'tris', len(idx)//3, 'morphs', len(names), 'height', float(pos[:, 1].max()), 'size', os.path.getsize(out))

for g in ('male', 'female'): build(g)

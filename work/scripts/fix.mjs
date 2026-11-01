// node fix.mjs in.glb out.glb [drop-unskinned] [opaque] [drop-morphs] [keep-largest-skin]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const [i, o, ...ops] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(i); const root = doc.getRoot();
if(ops.includes('drop-unskinned')) for(const n of root.listNodes()) if(n.getMesh() && !n.getSkin()){ console.log('drop', n.getName()); n.setMesh(null); }
if(ops.includes('double')) for(const m of root.listMaterials()) m.setDoubleSided(true);
if(ops.includes('opaque')) for(const m of root.listMaterials()) { m.setAlphaMode('OPAQUE'); }
if(ops.includes('drop-morphs')) for(const m of root.listMeshes()) for(const p of m.listPrimitives()) { for(const t of p.listTargets()) { p.removeTarget(t); t.dispose(); } m.setWeights([]); }
if(ops.includes('drop-morphs')) for(const a of root.listAnimations()) for(const c of a.listChannels()) if(c.getTargetPath() === 'weights'){ const s = c.getSampler(); c.dispose(); s && s.dispose(); }
await doc.transform(prune());
await io.write(o, doc);

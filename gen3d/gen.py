# Image -> 3D shape on CPU with Hunyuan3D-2mini (turbo). Writes gen3d/out/<name>.glb and the cut-out <name>_rgba.png
import os, sys, time, glob, torch
from PIL import Image
torch.set_num_threads(os.cpu_count() or 4)
from hy3dgen.rembg import BackgroundRemover
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline, FloaterRemover, DegenerateFaceRemover, FaceReducer
os.makedirs('gen3d/out', exist_ok=True)
todo = [p for p in sorted(glob.glob('gen3d/in/*')) if not os.path.exists('gen3d/out/' + os.path.splitext(os.path.basename(p))[0] + '.glb')]
print('todo', todo, flush=True)
if not todo: sys.exit(0)
t0 = time.time()
pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2mini', subfolder='hunyuan3d-dit-v2-mini-turbo', use_safetensors=False, device='cpu', dtype=torch.float32)
print('model loaded', round(time.time() - t0), 's', flush=True)
rembg = BackgroundRemover()
for p in todo:
    name = os.path.splitext(os.path.basename(p))[0]; t = time.time()
    img = Image.open(p)
    img = img.convert('RGBA') if img.mode == 'RGBA' and img.getextrema()[3][0] < 250 else rembg(img.convert('RGB'))
    img.save(f'gen3d/out/{name}_rgba.png')
    mesh = pipe(image=img, num_inference_steps=8, octree_resolution=256, num_chunks=8000, generator=torch.manual_seed(1234), output_type='trimesh')[0]
    mesh = FloaterRemover()(mesh); mesh = DegenerateFaceRemover()(mesh); mesh = FaceReducer()(mesh, max_facenum=60000)
    mesh.export(f'gen3d/out/{name}.glb')
    print(name, 'done in', round(time.time() - t), 's, faces', len(mesh.faces), flush=True)

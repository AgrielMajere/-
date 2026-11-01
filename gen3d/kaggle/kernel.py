# Runs on a Kaggle GPU: Hunyuan3D-2 shape (turbo + FlashVDM) and full texture painting.
# Images are read from the public repo branch gen3d; results go to /kaggle/working/out.
import os, sys, subprocess, urllib.request, time, json
def sh(c): print('$', c, flush=True); subprocess.run(c, shell=True, check=True)
IMAGES = json.loads(os.environ.get('GEN_IMAGES', '__IMAGES__'))
REPO_RAW = 'https://raw.githubusercontent.com/AgrielMajere/-/gen3d/gen3d/in/'
W = '/kaggle/working'; os.makedirs(f'{W}/out', exist_ok=True)
sh(f'git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2 {W}/hy2')
sh('pip install -q "diffusers==0.32.2" "transformers==4.48.3" "huggingface_hub<0.30" accelerate einops omegaconf trimesh pymeshlab pygltflib xatlas rembg onnxruntime-gpu opencv-python-headless pybind11 ninja')
sh(f'cd {W}/hy2/hy3dgen/texgen/custom_rasterizer && python setup.py install 2>&1 | tail -3')
sh(f'cd {W}/hy2/hy3dgen/texgen/differentiable_renderer && python setup.py install 2>&1 | tail -3')
sys.path.insert(0, f'{W}/hy2')
import torch
from PIL import Image
from hy3dgen.rembg import BackgroundRemover
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline, FloaterRemover, DegenerateFaceRemover, FaceReducer
rembg = BackgroundRemover(); imgs = {}
for fn in IMAGES:
    name = os.path.splitext(fn)[0]; p = f'{W}/{fn}'; urllib.request.urlretrieve(REPO_RAW + fn, p)
    im = Image.open(p); im = im.convert('RGBA') if im.mode == 'RGBA' and im.getextrema()[3][0] < 250 else rembg(im.convert('RGB'))
    im.save(f'{W}/out/{name}_rgba.png'); imgs[name] = im
t = time.time()
shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2', subfolder='hunyuan3d-dit-v2-0-turbo', use_safetensors=True)
shape.enable_flashvdm(topk_mode='merge')
meshes = {}
for name, im in imgs.items():
    m = shape(image=im, num_inference_steps=5, octree_resolution=380, num_chunks=20000, generator=torch.manual_seed(1234), output_type='trimesh')[0]
    try: m = FloaterRemover()(m); m = DegenerateFaceRemover()(m); m = FaceReducer()(m, max_facenum=40000)
    except Exception as e: print('cleanup skipped', e)
    m.export(f'{W}/out/{name}_shape.glb'); meshes[name] = m; print(name, 'shape', round(time.time() - t), 's', flush=True)
del shape; torch.cuda.empty_cache()
from hy3dgen.texgen import Hunyuan3DPaintPipeline
paint = Hunyuan3DPaintPipeline.from_pretrained('tencent/Hunyuan3D-2', subfolder='hunyuan3d-paint-v2-0-turbo')
try: paint.enable_model_cpu_offload()
except Exception as e: print('no offload', e)
for name, m in meshes.items():
    t = time.time(); tm = paint(m, image=imgs[name]); tm.export(f'{W}/out/{name}.glb'); print(name, 'textured', round(time.time() - t), 's', flush=True)
print('ALL DONE', flush=True)

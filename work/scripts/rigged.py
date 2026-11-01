import json, subprocess, os
from concurrent.futures import ThreadPoolExecutor
import sys
M = [m for m in json.load(open('manifest.json')) if m['kind'] in ('hum', 'own') and (len(sys.argv) < 2 or m['id'] in sys.argv[1:])]
tri = {json.load(open(f'inspect/{m["src"]}.json'))['file']: json.load(open(f'inspect/{m["src"]}.json'))['tris'] for m in M}
os.makedirs('stage3', exist_ok=True)
def run(*a): r = subprocess.run(list(a), capture_output=True, text=True); return r.returncode, (r.stdout + r.stderr)[-600:]
def job(m):
    t = f'/home/claude/work/tmpr_{m["id"]}'; os.makedirs(t, exist_ok=True)
    src = ('tmpfix/' + m['id'] + '.glb') if os.path.exists('tmpfix/' + m['id'] + '.glb') else 'src/' + m['src']; ratio = min(1, m['tris']/max(1, tri[m['src']]))
    log = []
    c, o = run('gltf-transform', 'metalrough', src, f'{t}/a.glb'); log.append(o)
    if c: subprocess.run(['cp', src, f'{t}/a.glb'])
    c, o = run('gltf-transform', 'weld', f'{t}/a.glb', f'{t}/b.glb'); log.append(o)
    if ratio < .97: c, o = run('gltf-transform', 'simplify', f'{t}/b.glb', f'{t}/c.glb', '--ratio', str(round(ratio, 4)), '--error', '0.004'); log.append(o)
    else: subprocess.run(['cp', f'{t}/b.glb', f'{t}/c.glb'])
    c, o = run('./stage2.sh', f'{t}/c.glb', f'stage3/{m["id"]}.glb'); log.append(o)
    open(f'logs/r_{m["id"]}.log', 'w').write('\n'.join(log))
    subprocess.run(['rm', '-rf', t])
    return m['id'], os.path.exists(f'stage3/{m["id"]}.glb')
with ThreadPoolExecutor(3) as ex:
    for i, ok in ex.map(job, M): print(i, ok, flush=True)

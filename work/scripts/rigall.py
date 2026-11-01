import subprocess, os, sys
from concurrent.futures import ThreadPoolExecutor
R = {'druid': (1.85, 0), 'dark_orc': (1.95, 0), 'gravok': (2.3, 0), 'kyra': (1.75, 0), 'monk': (1.8, 0), 'orc_warrior': (1.9, 0), 'orc_shaman': (1.8, 0),
     'magma_golem': (3.4, -90), 'stone_monster': (3.4, -90), 'minotaur_boss': (3.0, 0), 'wolfgirl': (1.7, 0), 'catboy': (1.7, 0), 'chiya': (1.65, 0),
     'bunnygirl': (1.6, 0), 'foxgirl': (1.65, 0), 'dwarf': (1.4, 0), 'lich': (1.9, 0), 'oldwizard': (1.8, 0), 'lich_king': (2.3, 0)}
only = sys.argv[1:]
os.makedirs('/home/claude/work/rigged', exist_ok=True)
def job(k):
    h, rot = R[k]
    r = subprocess.run(['timeout', '1500', 'python3', '/home/claude/mmo/tools/rig_gen.py', f'/home/claude/work/stage1/{k}.glb', 'keep', f'/home/claude/work/rigged/{k}.glb', str(h), str(rot)], capture_output=True, text=True)
    open(f'/home/claude/work/logs/rig_{k}.log', 'w').write(r.stdout[-3000:] + r.stderr[-3000:])
    ok = os.path.exists(f'/home/claude/work/rigged/{k}.glb')
    if ok: subprocess.run(['/home/claude/work/stage2.sh', f'/home/claude/work/rigged/{k}.glb', f'/home/claude/work/stage3/{k}.glb'])
    return k, ok
with ThreadPoolExecutor(4) as ex:
    for k, ok in ex.map(job, only or list(R)): print(k, ok, flush=True)

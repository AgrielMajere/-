import json, subprocess, os, sys
from concurrent.futures import ThreadPoolExecutor
M = json.load(open('/home/claude/work/manifest.json'))
only = set(sys.argv[1:])
TOOL = '/home/claude/mmo/tools/' + 'prep_model.py'
def job(m):
    out = f"/home/claude/work/stage1/{m['id']}.glb"
    if os.path.exists(out) and not only: return m['id'], 'skip'
    r = subprocess.run(['timeout', '1500', 'python3', TOOL, '/home/claude/work/src/' + m['src'], out, str(m['tris']), str(m['anims']), '1' if m['kind'] == 'static' else '0'], capture_output=True, text=True)
    open(f"/home/claude/work/logs/{m['id']}.log", 'w').write(r.stdout[-4000:] + r.stderr[-4000:])
    return m['id'], 'ok' if os.path.exists(out) else 'FAIL'
todo = [m for m in M if not only or m['id'] in only]
todo.sort(key=lambda m: -os.path.getsize('/home/claude/work/src/' + m['src']))
with ThreadPoolExecutor(4) as ex:
    for i, s in ex.map(job, todo):
        if s != 'skip': print(i, s, flush=True)

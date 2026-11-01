import fs from 'fs'; import path from 'path';
const [src, dst] = process.argv.slice(2); fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src).filter(f => f.endsWith('.glb') && !/chartest|resttest|Xbot/.test(f)))
  fs.writeFileSync(path.join(dst, f.replace(/\.glb$/, '.json')), JSON.stringify({ format: 'glb-base64', glb: fs.readFileSync(path.join(src, f)).toString('base64') }));

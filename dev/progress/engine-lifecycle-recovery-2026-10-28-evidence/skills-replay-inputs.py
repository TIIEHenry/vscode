#!/usr/bin/env python3
"""Rebuild frozen validation inputs; this prepares files and never starts Node."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import tarfile

PREFIX = 'skills'
here = pathlib.Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo', type=pathlib.Path, required=True)
parser.add_argument('--scratch', type=pathlib.Path, required=True)
args = parser.parse_args()
repo = args.repo.resolve()
scratch = args.scratch.resolve()
assert not scratch.exists(), 'Use a new private scratch directory.'
assert (repo / 'build/next/transpile.ts').is_file()
archive = here / (PREFIX + '-runtime-artifacts.tar.gz')
inventory = json.loads((here / (PREFIX + '-artifact-inventory.json')).read_text())
digest = lambda data: hashlib.sha256(data).hexdigest()
assert digest(archive.read_bytes()) == inventory['archiveSha256']
scratch.mkdir(parents=True)
raw = scratch / 'raw'
raw.mkdir()
with tarfile.open(archive, 'r:gz') as bundle:
    members = bundle.getmembers()
    assert len(members) == len(inventory['members'])
    assert {member.name for member in members} == set(inventory['members'])
    for member in members:
        target = pathlib.Path(member.name)
        assert member.isfile() and not target.is_absolute() and '..' not in target.parts
        data = bundle.extractfile(member).read()
        assert digest(data) == inventory['members'][member.name]['sha256']
        output = raw / target
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
manifest = json.loads((raw / 'replay-manifest.json').read_text())
batch = subprocess.Popen(['git', 'cat-file', '--batch'], cwd=repo, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
entries = []
for entry in manifest['entries']:
    rel = entry['source']
    if rel in manifest['oldOverrides']:
        data = (raw / manifest['oldOverrides'][rel]).read_bytes()
    else:
        batch.stdin.write((manifest['baseline'] + ':' + rel + '\n').encode())
        batch.stdin.flush()
        header = batch.stdout.readline().decode().split()
        assert len(header) == 3 and header[1] == 'blob', rel
        data = batch.stdout.read(int(header[2]))
        assert batch.stdout.read(1) == b'\n'
    assert digest(data) == entry['sha256'], rel
    source = scratch / 'old' / rel
    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_bytes(data)
    dest = rel[4:]
    if rel.endswith('.ts'):
        dest = dest[:-3] + '.js'
    entries.append({'source': rel, 'snapshot': str(source), 'out': str(repo / 'out' / dest), 'kind': entry['kind']})
batch.stdin.close()
assert batch.wait() == 0
phases = {'old': entries}
for phase in ['new', 'final']:
    phases[phase] = []
    for rel, path in manifest.get(phase + 'Overrides', {}).items():
        entry = next(item for item in entries if item['source'] == rel)
        phases[phase].append({**entry, 'snapshot': str(raw / path)})
(scratch / 'replay.json').write_text(json.dumps({'root': str(repo), 'phases': phases}, indent=2))
(scratch / 'replay-transpile.mjs').write_text('''import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const m=JSON.parse(fs.readFileSync(new URL('./replay.json',import.meta.url),'utf8'));
const {transpileFile,mapWithConcurrency}=await import(pathToFileURL(m.root+'/build/next/transpile.ts').href);
const entries=m.phases[process.argv[2]]; if(!entries)throw Error('unknown phase');
const privateOut=m.root+'/out';
if(fs.existsSync(privateOut)){
 if(fs.lstatSync(privateOut).isSymbolicLink())throw Error('shared output directory');
 const scan=dir=>{for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const s=fs.lstatSync(p);if(s.isSymbolicLink()||(s.isFile()&&s.nlink>1))throw Error('shared output inode: '+p);if(s.isDirectory())scan(p);}};
 scan(privateOut);
}
await mapWithConcurrency(entries,16,async x=>{
 if(!x.out.startsWith(privateOut+'/'))throw Error('nonprivate output');
 for(let dir=path.dirname(x.out);dir!==m.root;dir=path.dirname(dir)){
  if(fs.existsSync(dir)&&fs.lstatSync(dir).isSymbolicLink())throw Error('shared output ancestor');
 }
 let st;try{st=fs.lstatSync(x.out);}catch(e){if(e.code!=='ENOENT')throw e;}
 if(st&&(st.isSymbolicLink()||st.nlink>1))throw Error('shared output inode');
 if(x.kind==='ts')await transpileFile(x.snapshot,x.out);
 else{fs.mkdirSync(path.dirname(x.out),{recursive:true});fs.copyFileSync(x.snapshot,x.out);}
});
console.log(JSON.stringify({phase:process.argv[2],refreshed:entries.length}));
''')
if PREFIX == 'providers':
    hook = (raw / 'tools/harness-fixture-preload.mjs').read_text()
    hook = hook.replace(manifest['originalScratch'], str(scratch)).replace(manifest['originalRepo'], str(repo))
    (scratch / 'harness-fixture-preload.mjs').write_text(hook)
    (scratch / 'harness-fixture.json').write_bytes((raw / 'tools/harness-fixture.json').read_bytes())
print(json.dumps({'preparedOnly': True, 'scratch': str(scratch), 'entries': len(entries), 'phases': list(phases)}))

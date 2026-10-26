import argparse,pathlib,subprocess,json,re,hashlib
parser=argparse.ArgumentParser()
parser.add_argument('--pack',required=True)
parser.add_argument('--dest',required=True)
a=parser.parse_args()
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
pack=pathlib.Path(a.pack)
manifest=json.loads((pack/'manifest.json').read_text())
root=pathlib.Path(a.dest)
root.mkdir(exist_ok=True)
test='src/vs/workbench/contrib/sources/test/node/sourcesWiringScan.test.ts'
source=(pack/test).read_text()
paths=set(re.findall(r"path\.join\(repoRoot, '([^']+)'\)",source))
assert all(p.startswith('src/') or p=='eslint.config.js' for p in paths)
changed=set(manifest['changedSourcePaths'])
records=[]
for file in sorted(paths):
 ref=manifest['themeRef'] if file in changed else manifest['baseHead']
 data=subprocess.check_output(['git','show',ref+':'+file],cwd=repo)
 dest=root/file
 dest.parent.mkdir(parents=True,exist_ok=True)
 dest.write_bytes(data)
 records.append({'path':file,'ref':ref,'sha256':hashlib.sha256(data).hexdigest()})
output=pathlib.Path('out')/pathlib.Path(test).relative_to('src').with_suffix('.js')
dest=root/output
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_bytes((pack/output).read_bytes())
(root/'out/vs/base').symlink_to(repo/'out/vs/base',target_is_directory=True)
(root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
(root/'package.json').write_text('{"type":"module"}\n')
(root/'manifest.json').write_text(json.dumps({'phase':'immutable-virtual-wiring-source-root','baseHead':manifest['baseHead'],'themeRef':manifest['themeRef'],'sources':records,'output':{'path':str(output),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}},indent=2)+'\n')
print(json.dumps({'root':str(root),'sourcePaths':len(records),'test':str(dest)}))

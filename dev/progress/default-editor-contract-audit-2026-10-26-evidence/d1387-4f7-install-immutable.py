import pathlib, subprocess, json, hashlib, os
repo = pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
os.chdir(repo)
ref='4f7e49d357a8a5f9e89de373c4e6a5759505c051'
base=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
assert base=='09f6da72d3056c0c28d4bfaa8b0ceb6dc809b62a'
assert subprocess.check_output(['git','status','--porcelain'],text=True)==''
pack=pathlib.Path('/tmp/vscode-d1387-4f7-pack')
pack.mkdir(exist_ok=True)
changed=subprocess.check_output(['git','diff','--name-only','133ef4e5cfa',ref,'--','src'],text=True).splitlines()
template=json.loads(pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1387-after-sources-audit-20261026/fresh-notice.template.json').read_text())
modules=set(changed)
modules.update('src/'+x['path'][4:-3]+'.ts' for x in template['outputs'])
modules.update(['src/vs/workbench/contrib/sources/test/browser/sourcesConversationOpenHarness.ts','src/vs/workbench/services/editor/test/common/editorOpenSlot.test.ts','src/vs/workbench/services/editor/test/browser/editorService.test.ts'])
node="import {transform} from 'esbuild'; let text=''; for await(const chunk of process.stdin){text+=chunk;} const result=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:false,sourcefile:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}}); process.stdout.write(result.code.replaceAll('.ts?esm','.js?esm'));"
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest={'phase':'virtual-theme-output-not-formally-merged','baseHead':base,'baseSourceTree':subprocess.check_output(['git','rev-parse',base+':src'],text=True).strip(),'themeRef':ref,'changedSourcePaths':changed,'modules':[]}
for file in sorted(modules):
 source=subprocess.check_output(['git','show',ref+':'+file])
 baseline=subprocess.check_output(['git','show',base+':'+file])
 if file not in changed: assert source==baseline,file
 saved=pack/file
 saved.parent.mkdir(parents=True,exist_ok=True)
 saved.write_bytes(source)
 output=pathlib.Path('out')/pathlib.Path(file).relative_to('src').with_suffix('.js')
 before=output.read_bytes()
 backup=pack/'before'/output
 backup.parent.mkdir(parents=True,exist_ok=True)
 backup.write_bytes(before)
 code=subprocess.check_output(['node','--input-type=module','-e',node,file],input=source)
 target=pack/output
 target.parent.mkdir(parents=True,exist_ok=True)
 target.write_bytes(code)
 output.write_bytes(code)
 manifest['modules'].append({'sourcePath':file,'sourceRef':ref,'sourceSha256':sha(source),'baseSourceSha256':sha(baseline),'changedSource':file in changed,'outputPath':str(output),'beforeOutputSha256':sha(before),'outputSha256':sha(code)})
assert subprocess.check_output(['git','status','--porcelain'],text=True)==''
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==base
(pack/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'pack':str(pack),'modules':len(manifest['modules']),'changed':len(changed),'srcUnchanged':True}))

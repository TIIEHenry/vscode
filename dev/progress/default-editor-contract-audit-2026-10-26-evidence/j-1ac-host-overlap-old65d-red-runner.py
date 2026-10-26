import pathlib, subprocess, json, hashlib, os, datetime, re
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
os.chdir(repo)
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(['git',*a],text=True).strip()
head=git('rev-parse','HEAD')
assert head=='8781acd0b2dccbc46fec5ede3022fbe1f1ee6dc5'
assert git('status','--porcelain')==''
assert git('rev-parse','HEAD:src')=='030defda3cc7cfac7148e84fac470a3bf5098d06'
patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit',"from 'esbuild'",'install-immutable']
processes=[]
for line in subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True).splitlines():
 if any(p in line for p in patterns) and 'python3 -' not in line and '/bin/bash -c' not in line:
  processes.append(line)
assert not processes,processes
base=pathlib.Path('/tmp/vscode-d1387-host-overlap-old65d-red')
native=json.loads(pathlib.Path('dev/progress/default-editor-contract-audit-2026-10-26-evidence/main-180fc-compile.json').read_text())
native_before=[{'path':x['outputPath'],'sha256':sha(pathlib.Path(x['outputPath']).read_bytes())} for x in native['outputs']]
assert all(a['sha256']==b['afterOutputSha256'] for a,b in zip(native_before,native['outputs']))
producer='src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts'
test='src/vs/workbench/contrib/sources/test/browser/sourcesChangesList.test.ts'
old='65d2288036fdad74ab607e231d3db758fa397aa8'
new='1ac1fdc4ae2db39f4e2c3a49e014bcc629b40419'
node="import {transform} from 'esbuild'; let text=''; for await(const chunk of process.stdin){text+=chunk;} const result=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:false,sourcefile:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}}); process.stdout.write(result.code.replaceAll('.ts?esm','.js?esm'));"
manifest={'phase':'exact65d-old-production-with-1ac-host-overlap-tests','sourceHead':head,'sourceTree':git('rev-parse','HEAD:src'),'producerRef':old,'testRef':new,'startedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'globalProcessScan':processes,'outFrozen':False,'entireOutClaimedSameBuild':False,'nativeIdentityScopeBefore':native_before,'modules':[],'runs':[]}
backups=[]
try:
 for file,ref in [(producer,old),(test,new)]:
  source=subprocess.check_output(['git','show',ref+':'+file])
  output=pathlib.Path('out')/pathlib.Path(file).relative_to('src').with_suffix('.js')
  before=output.read_bytes()
  backup=pathlib.Path(str(base)+'-native-backups')/output
  backup.parent.mkdir(parents=True,exist_ok=True)
  backup.write_bytes(before)
  transformed=subprocess.check_output(['node','--input-type=module','-e',node,file],input=source)
  backups.append((output,before))
  output.write_bytes(transformed)
  manifest['modules'].append({'sourcePath':file,'sourceRef':ref,'sourceSha256':sha(source),'outputPath':str(output),'nativeBeforeSha256':sha(before),'installedOutputSha256':sha(transformed),'nativeBackupPath':str(backup)})
 for name,selector,count in [('host','delegated host official',4),('overlap','Sources overlap same tuple .*settles first',2)]:
  command=['timeout','--foreground','-k','15s','180s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000','--run',test,'--grep',selector]
  log=pathlib.Path(str(base)+'-'+name+'.log')
  run={'name':name,'selector':selector,'expectedBusinessTests':count,'command':command,'logPath':str(log),'startedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  manifest['runs'].append(run)
  print(json.dumps({'starting':name,'expectedBusinessTests':count,'selector':selector}),flush=True)
  with log.open('wb') as f:
   result=subprocess.run(command,env={**os.environ,'VSCODE_SKIP_PRELAUNCH':'1'},stdout=f,stderr=subprocess.STDOUT)
  run.update({'exitCode':result.returncode,'finishedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'logBytes':log.stat().st_size,'logSha256':sha(log.read_bytes())})
  text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',log.read_text(errors='replace'))
  run['mochaCounts']={k:[int(x) for x in re.findall(r'(\d+) '+k,text)] for k in ['passing','failing','pending']}
  run['assertionErrorCount']=text.count('AssertionError')
  run['businessRedNotYetAccepted']=True
  print(json.dumps({'finished':name,'exitCode':result.returncode,'mochaCounts':run['mochaCounts'],'assertionErrorCount':run['assertionErrorCount']}),flush=True)
finally:
 for (output,before),module in zip(backups,manifest['modules']):
  output.write_bytes(before)
  module['restoredOutputSha256']=sha(output.read_bytes())
  assert module['restoredOutputSha256']==module['nativeBeforeSha256']
 manifest['nativeIdentityScopeAfter']=[{'path':x['outputPath'],'sha256':sha(pathlib.Path(x['outputPath']).read_bytes())} for x in native['outputs']]
 manifest['all34NativeOutputHashesRestored']=manifest['nativeIdentityScopeBefore']==manifest['nativeIdentityScopeAfter']
 manifest['sourceHeadUnchanged']=git('rev-parse','HEAD')==head
 manifest['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==manifest['sourceTree']
 manifest['worktreeCleanAfterRun']=git('status','--porcelain')==''
 manifest['finishedAtUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 pathlib.Path(str(base)+'-identity.json').write_text(json.dumps(manifest,indent=2)+'\n')
 assert manifest['all34NativeOutputHashesRestored']
print(json.dumps({'sourceHeadUnchanged':manifest['sourceHeadUnchanged'],'sourceTreeUnchanged':manifest['sourceTreeUnchanged'],'clean':manifest['worktreeCleanAfterRun'],'all34NativeOutputHashesRestored':manifest['all34NativeOutputHashesRestored']}),flush=True)

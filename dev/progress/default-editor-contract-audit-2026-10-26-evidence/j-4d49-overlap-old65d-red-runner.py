import argparse, pathlib, subprocess, json, hashlib, os, datetime, re, fcntl
args=argparse.ArgumentParser()
args.add_argument('--test-ref',required=True)
a=args.parse_args()
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(repo)
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *x:subprocess.check_output(['git',*x],text=True).strip()
head=git('rev-parse','HEAD');src=git('rev-parse','HEAD:src')
assert src=='7fa3c86d152420afeb66c6038bd961bb6d5b8f4b'
assert git('status','--porcelain')==''
ref=git('rev-parse','--verify',a.test_ref+'^{commit}')
prior='1ac1fdc4ae2db39f4e2c3a49e014bcc629b40419'
old='65d2288036fdad74ab607e231d3db758fa397aa8'
producer='src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts'
test='src/vs/workbench/contrib/sources/test/browser/sourcesChangesList.test.ts'
newsource=subprocess.check_output(['git','show',ref+':'+test])
priorsource=subprocess.check_output(['git','show',prior+':'+test])
assert priorsource.count(b'.hasListeners')==8
assert priorsource.replace(b'.hasListeners',b'.hasListeners()')==newsource
assert subprocess.check_output(['git','show',ref+':'+producer])==subprocess.check_output(['git','show',prior+':'+producer])
changed_ts=[x for x in git('diff','--name-only',prior,ref,'--','src').splitlines() if x.endswith('.ts')]
assert changed_ts==[test],changed_ts
base=pathlib.Path('/tmp/vscode-d1387-fixed-listener-old65d-overlap-red')
manifest={'phase':'fixed-listener-immutable-test-with-exact65d-old-helper','sourceHead':head,'sourceTree':src,'producerRef':old,'testRef':ref,'priorTestRef':prior,'exactEightHasListenersCallsOnly':True,'productionUnchangedFrom1ac':True,'expectedBusinessTests':2,'selector':'Sources overlap same tuple .*settles first','hostFourBusinessRedsNotRepeated':True,'startedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'outFrozen':False,'currentSourceTreeNotNativelyCompiled':True,'nativeOutputCompileSource':'ad80c9fe1cfaaa250ea0eac9e05de6d780f984c2','entireOutClaimedSameBuild':False,'modules':[]}
lock=pathlib.Path('/tmp/vscode-compile.lock').open('a+')
try:
 try:fcntl.flock(lock.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:
  manifest.update({'phase':'waiting-for-existing-compile-lock','compileLock':{'path':'/tmp/vscode-compile.lock','acquired':False}})
  pathlib.Path(str(base)+'-wait-identity.json').write_text(json.dumps(manifest,indent=2)+'\n')
  print(json.dumps({'waitingOnCompileLock':True}),flush=True)
  raise SystemExit(2)
 manifest['compileLock']={'path':'/tmp/vscode-compile.lock','acquired':True,'heldThroughTranspileTestAndRestoration':True}
 patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit',"from 'esbuild'",'install-immutable']
 processes=[l for l in subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True).splitlines() if any(p in l for p in patterns) and 'python3 -' not in l and '/bin/bash -c' not in l]
 manifest['globalProcessScan']=processes
 if processes:
  manifest['phase']='waiting-for-existing-global-lane'
  pathlib.Path(str(base)+'-wait-identity.json').write_text(json.dumps(manifest,indent=2)+'\n')
  print(json.dumps({'waitingOnGlobalLane':processes}),flush=True)
  raise SystemExit(2)
 parse="import ts from 'typescript'; let source=''; for await(const chunk of process.stdin){source+=chunk;} const sf=ts.createSourceFile(process.argv[1],source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS); process.stdout.write(JSON.stringify({diagnostics:sf.parseDiagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}))}));"
 manifest['testAst']=json.loads(subprocess.check_output(['node','--input-type=module','-e',parse,test],input=newsource));assert not manifest['testAst']['diagnostics']
 native=json.loads(pathlib.Path('dev/progress/default-editor-contract-audit-2026-10-26-evidence/main-180fc-compile.json').read_text())
 manifest['nativeIdentityScopeBefore']=[{'path':x['outputPath'],'sha256':sha(pathlib.Path(x['outputPath']).read_bytes())} for x in native['outputs']]
 assert all(x['sha256']==y['afterOutputSha256'] for x,y in zip(manifest['nativeIdentityScopeBefore'],native['outputs']))
 node="import {transform} from 'esbuild'; let text=''; for await(const chunk of process.stdin){text+=chunk;} const result=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:false,sourcefile:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}}); process.stdout.write(result.code.replaceAll('.ts?esm','.js?esm'));"
 backups=[]
 try:
  for file,chosen,source in [(producer,old,subprocess.check_output(['git','show',old+':'+producer])),(test,ref,newsource)]:
   output=pathlib.Path('out')/pathlib.Path(file).relative_to('src').with_suffix('.js');before=output.read_bytes()
   code=subprocess.check_output(['node','--input-type=module','-e',node,file],input=source)
   backup=pathlib.Path(str(base)+'-native-backups')/output;backup.parent.mkdir(parents=True,exist_ok=True);backup.write_bytes(before)
   backups.append((output,before));output.write_bytes(code)
   manifest['modules'].append({'sourcePath':file,'sourceRef':chosen,'sourceSha256':sha(source),'outputPath':str(output),'nativeBeforeSha256':sha(before),'installedOutputSha256':sha(code),'nativeBackupPath':str(backup)})
  command=['timeout','--foreground','-k','15s','180s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000','--run',test,'--grep',manifest['selector']]
  manifest['command']=command;log=pathlib.Path(str(base)+'.log')
  print(json.dumps({'starting':manifest['selector'],'expectedBusinessTests':2,'testRef':ref,'eightHasListenersCallsOnly':True,'globalLaneMatches':0,'compileLockAcquired':True}),flush=True)
  with log.open('wb') as f:result=subprocess.run(command,env={**os.environ,'VSCODE_SKIP_PRELAUNCH':'1'},stdout=f,stderr=subprocess.STDOUT)
  text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',log.read_text(errors='replace'))
  manifest.update({'exitCode':result.returncode,'logPath':str(log),'logBytes':log.stat().st_size,'logSha256':sha(log.read_bytes()),'mochaCounts':{k:[int(x) for x in re.findall(r'(\d+) '+k,text)] for k in ['passing','failing','pending']},'assertionErrorCount':text.count('AssertionError'),'rawPostRunReviewPending':True})
 finally:
  for (output,before),item in zip(backups,manifest['modules']):
   output.write_bytes(before);item['restoredOutputSha256']=sha(output.read_bytes());assert item['restoredOutputSha256']==item['nativeBeforeSha256']
  manifest['nativeIdentityScopeAfter']=[{'path':x['outputPath'],'sha256':sha(pathlib.Path(x['outputPath']).read_bytes())} for x in native['outputs']]
  manifest['all34NativeOutputHashesRestored']=manifest['nativeIdentityScopeBefore']==manifest['nativeIdentityScopeAfter']
  manifest['sourceHeadUnchanged']=git('rev-parse','HEAD')==head;manifest['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==src;manifest['worktreeCleanAfterRun']=git('status','--porcelain')=='';manifest['finishedAtUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
  pathlib.Path(str(base)+'-identity.json').write_text(json.dumps(manifest,indent=2)+'\n')
  assert manifest['all34NativeOutputHashesRestored']
 print(json.dumps({key:manifest.get(key) for key in ['exitCode','mochaCounts','assertionErrorCount','all34NativeOutputHashesRestored','sourceHeadUnchanged','sourceTreeUnchanged','worktreeCleanAfterRun']}),flush=True)
finally:
 fcntl.flock(lock.fileno(),fcntl.LOCK_UN);lock.close()

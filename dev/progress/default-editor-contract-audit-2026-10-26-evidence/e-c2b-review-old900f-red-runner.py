import pathlib,subprocess,json,hashlib,datetime,os,re,fcntl
r=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(r)
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(['git',*a],text=True).strip()
head=git('rev-parse','HEAD');source_tree=git('rev-parse','HEAD:src');assert git('status','--porcelain')=='';assert source_tree=='7fa3c86d152420afeb66c6038bd961bb6d5b8f4b'
old='900f772bfd139214651a7c15e82678a1a0ef6f69';new='c2b1266006b7c192fbaaf737e80be25726021fc4';base='5dd7d97d45b7dfa8827b5cb36f60e85fb61a4f8a'
assert git('rev-parse',new+'^')==old
assert git('rev-parse',old+':src')=='da5aa1664b65970dc72790749b1101c4534f074f'
test='src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts'
production=[p for p in git('diff','--name-only',base,old,'--','src').splitlines() if p.endswith('.ts') and '/test/' not in p];assert len(production)==14
chosen=[(p,old) for p in production]+[(test,new)]
titles=[
'response recovery review I1 timeline-only clientTool accepted remains blocked after respondable is removed',
'response recovery review I2 public disconnect closes writes before synchronous scope notice',
'response recovery review I2 published identity switch closes writes before synchronous scope notice and preserves cache owners',
'response recovery review I3 same-generation baseline question options retires old false while pending stays unchanged',
'response recovery review I3 same-generation baseline clientTool args retires old accepted while pending stays unchanged',
]
selector='(?:'+'|'.join(re.escape(t) for t in titles)+')$'
prefix=pathlib.Path('/tmp/vscode-response-review-old900f-red')
manifest={'phase':'exact900f-production-with-c2b-review-regression-tests','sourceHead':head,'sourceTree':source_tree,'currentSourceTreeNotNativelyCompiled':True,'producerRef':old,'producerSourceTree':git('rev-parse',old+':src'),'testRef':new,'expectedBusinessTitles':titles,'expectedBusinessTests':5,'selector':selector,'productionModuleCount':14,'outFrozen':False,'entireOutClaimedSameBuild':False,'startedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'modules':[]}
lock=pathlib.Path('/tmp/vscode-compile.lock').open('a+')
try:
 try:fcntl.flock(lock.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:
  manifest.update({'phase':'waiting-for-existing-compile-lock','compileLockAcquired':False});pathlib.Path(str(prefix)+'-wait-identity.json').write_text(json.dumps(manifest,indent=2)+'\n');print('waiting on existing compile lock',flush=True);raise SystemExit(2)
 manifest['compileLock']={'path':'/tmp/vscode-compile.lock','acquired':True,'heldThroughTranspileTestAndRestoration':True}
 patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit',"from 'esbuild'",'install-immutable']
 processes=[l for l in subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True).splitlines() if any(p in l for p in patterns) and 'python3 -' not in l and '/bin/bash -c' not in l];manifest['globalProcessScan']=processes
 if processes:
  manifest['phase']='waiting-for-existing-global-lane';pathlib.Path(str(prefix)+'-wait-identity.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'waitingOnGlobalLane':processes}),flush=True);raise SystemExit(2)
 native=json.loads((r/'dev/progress/default-editor-contract-audit-2026-10-26-evidence/main-180fc-compile.json').read_text())
 manifest['nativeIdentityScopeBefore']=[{'path':x['outputPath'],'sha256':sha((r/x['outputPath']).read_bytes())} for x in native['outputs']]
 assert all(x['sha256']==y['afterOutputSha256'] for x,y in zip(manifest['nativeIdentityScopeBefore'],native['outputs']))
 test_source=subprocess.check_output(['git','show',new+':'+test])
 parse="import ts from 'typescript'; let source=''; for await(const chunk of process.stdin){source+=chunk;} const sf=ts.createSourceFile(process.argv[1],source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS); process.stdout.write(JSON.stringify({diagnostics:sf.parseDiagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')})),imports:sf.statements.filter(ts.isImportDeclaration).map(i=>({specifier:i.moduleSpecifier.text,typeOnly:i.importClause?.isTypeOnly===true}))}));"
 manifest['testAst']=json.loads(subprocess.check_output(['node','--input-type=module','-e',parse,test],input=test_source));assert not manifest['testAst']['diagnostics'];assert not any('conversationResponseState' in x['specifier'] and not x['typeOnly'] for x in manifest['testAst']['imports'])
 node="import {transform} from 'esbuild'; let text=''; for await(const chunk of process.stdin){text+=chunk;} const result=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:false,sourcefile:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}}); process.stdout.write(result.code.replaceAll('.ts?esm','.js?esm'));"
 backups=[]
 try:
  for path,ref in chosen:
   source=subprocess.check_output(['git','show',ref+':'+path]);output=pathlib.Path('out')/pathlib.Path(path).relative_to('src').with_suffix('.js');before=output.read_bytes() if output.exists() else None
   code=subprocess.check_output(['node','--input-type=module','-e',node,path],input=source)
   backup=pathlib.Path(str(prefix)+'-native-backups')/output
   if before is not None:backup.parent.mkdir(parents=True,exist_ok=True);backup.write_bytes(before)
   backups.append((output,before));output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(code)
   manifest['modules'].append({'sourcePath':path,'sourceRef':ref,'sourceSha256':sha(source),'outputPath':str(output),'existedBefore':before is not None,'beforeOutputSha256':sha(before) if before is not None else None,'installedOutputSha256':sha(code),'nativeBackupPath':str(backup) if before is not None else None})
  command=['timeout','--foreground','-k','15s','180s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000','--run',test,'--grep',selector];manifest['command']=command;log=pathlib.Path(str(prefix)+'.log')
  print(json.dumps({'starting':'E review representative old900f business red','expectedBusinessTests':5,'productionModules':14,'newTestModules':1,'testAstErrors':0,'globalLaneMatches':0,'compileLockAcquired':True}),flush=True)
  with log.open('wb') as f:result=subprocess.run(command,env={**os.environ,'VSCODE_SKIP_PRELAUNCH':'1'},stdout=f,stderr=subprocess.STDOUT)
  text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',log.read_text(errors='replace'))
  manifest.update({'exitCode':result.returncode,'logPath':str(log),'logBytes':log.stat().st_size,'logSha256':sha(log.read_bytes()),'mochaCounts':{k:[int(x) for x in re.findall(r'(\d+) '+k,text)] for k in ['passing','failing','pending']},'assertionErrorCount':text.count('AssertionError'),'rawPostRunReviewPending':True})
 finally:
  for (output,before),item in zip(backups,manifest['modules']):
   if before is None:
    output.unlink();item['restoredOutputExists']=output.exists();assert not item['restoredOutputExists']
   else:
    output.write_bytes(before);item['restoredOutputSha256']=sha(output.read_bytes());assert item['restoredOutputSha256']==item['beforeOutputSha256']
  manifest['all15TouchedOutputIdentitiesRestored']=all((not pathlib.Path(x['outputPath']).exists()) if not x['existedBefore'] else sha(pathlib.Path(x['outputPath']).read_bytes())==x['beforeOutputSha256'] for x in manifest['modules'])
  manifest['nativeIdentityScopeAfter']=[{'path':x['outputPath'],'sha256':sha((r/x['outputPath']).read_bytes())} for x in native['outputs']];manifest['all34NativeOutputHashesRestored']=manifest['nativeIdentityScopeBefore']==manifest['nativeIdentityScopeAfter'];manifest['sourceHeadUnchanged']=git('rev-parse','HEAD')==head;manifest['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==source_tree;manifest['worktreeCleanAfterRun']=git('status','--porcelain')=='';manifest['finishedAtUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
  pathlib.Path(str(prefix)+'-identity.json').write_text(json.dumps(manifest,indent=2)+'\n');assert manifest['all34NativeOutputHashesRestored'] and manifest['all15TouchedOutputIdentitiesRestored']
 print(json.dumps({key:manifest.get(key) for key in ['exitCode','mochaCounts','assertionErrorCount','all15TouchedOutputIdentitiesRestored','all34NativeOutputHashesRestored','sourceHeadUnchanged','sourceTreeUnchanged','worktreeCleanAfterRun']}),flush=True)
finally:
 fcntl.flock(lock.fileno(),fcntl.LOCK_UN);lock.close()

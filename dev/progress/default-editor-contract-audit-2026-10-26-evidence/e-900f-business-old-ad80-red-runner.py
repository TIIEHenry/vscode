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
 if any(p in line for p in patterns) and 'python3 -' not in line and '/bin/bash -c' not in line: processes.append(line)
assert not processes,processes
base=pathlib.Path('/tmp/vscode-response-recovery-old-ad80-red')
test='src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts'
ref='900f772bfd139214651a7c15e82678a1a0ef6f69'
source=subprocess.check_output(['git','show',ref+':'+test])
parse="import ts from 'typescript'; let source=''; for await(const chunk of process.stdin){source+=chunk;} const sf=ts.createSourceFile(process.argv[1],source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS); const imports=sf.statements.filter(ts.isImportDeclaration).map(i=>({specifier:i.moduleSpecifier.text,typeOnly:i.importClause?.isTypeOnly===true})); process.stdout.write(JSON.stringify({parseDiagnostics:sf.parseDiagnostics.map(d=>({code:d.code,start:d.start,message:ts.flattenDiagnosticMessageText(d.messageText,' ')})),imports}));"
ast=json.loads(subprocess.check_output(['node','--input-type=module','-e',parse,test],input=source))
assert not ast['parseDiagnostics']
assert not any('conversationResponseState' in x['specifier'] and not x['typeOnly'] for x in ast['imports'])
assert b'.beginResponse(' not in source
core=[]
for name in ['conversationEngineRosterService','conversationEngineFrameSource','conversationSessionView','conversationTimelineRenderer','conversationTimelineHost','conversationQuestionSeat','conversationProcessFold']:
 file='src/vs/workbench/contrib/conversation/browser/'+name+'.ts'
 old=subprocess.check_output(['git','show','09f6da72d3056c0c28d4bfaa8b0ceb6dc809b62a:'+file])
 current=subprocess.check_output(['git','show','ad80c9fe1cfaaa250ea0eac9e05de6d780f984c2:'+file])
 assert old==current
 output='out/'+file[4:-3]+'.js'
 core.append({'sourcePath':file,'source09f6Sha256':sha(old),'sourceAd80Sha256':sha(current),'sameSourceBytes':True,'outputPath':output,'nativeOutputBeforeSha256':sha(pathlib.Path(output).read_bytes())})
native=json.loads(pathlib.Path('dev/progress/default-editor-contract-audit-2026-10-26-evidence/main-180fc-compile.json').read_text())
native_before=[{'path':x['outputPath'],'sha256':sha(pathlib.Path(x['outputPath']).read_bytes())} for x in native['outputs']]
assert all(a['sha256']==b['afterOutputSha256'] for a,b in zip(native_before,native['outputs']))
manifest={'phase':'native-ad80-old-production-with-900f-business-tests-only','sourceHead':head,'sourceTree':git('rev-parse','HEAD:src'),'producerRef':'ad80c9fe1cfaaa250ea0eac9e05de6d780f984c2','exactOldSourceRef':'09f6da72d3056c0c28d4bfaa8b0ceb6dc809b62a','testRef':ref,'startedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'globalProcessScan':processes,'ast':ast,'usesNewBeginApi':False,'runtimeImportsNewResponseState':False,'expectedBusinessTests':6,'expandedBusinessTitles':[f'response recovery business {kind} unary {outcome} restores the actual seat and retries once' for kind in ['permission','question','clientTool'] for outcome in ['false','reject']],'nativeOldCoreIdentity':core,'nativeIdentityScopeBefore':native_before,'outFrozen':False,'entireOutClaimedSameBuild':False}
node="import {transform} from 'esbuild'; let text=''; for await(const chunk of process.stdin){text+=chunk;} const result=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:false,sourcefile:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}}); process.stdout.write(result.code.replaceAll('.ts?esm','.js?esm'));"
output=pathlib.Path('out')/pathlib.Path(test).relative_to('src').with_suffix('.js')
before=output.read_bytes()
backup=pathlib.Path(str(base)+'-native-test-backup.js')
backup.write_bytes(before)
try:
 code=subprocess.check_output(['node','--input-type=module','-e',node,test],input=source)
 manifest['testModule']={'sourcePath':test,'sourceRef':ref,'sourceSha256':sha(source),'outputPath':str(output),'nativeOutputBeforeSha256':sha(before),'installedOutputSha256':sha(code),'nativeBackupPath':str(backup)}
 output.write_bytes(code)
 command=['timeout','--foreground','-k','15s','180s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000','--run',test,'--grep','response recovery business']
 manifest['command']=command
 log=pathlib.Path(str(base)+'.log')
 print(json.dumps({'starting':'response recovery business','expectedBusinessTests':6,'astErrors':0,'corePathsUnchanged09f6Ad80':len(core)}),flush=True)
 with log.open('wb') as f:
  result=subprocess.run(command,env={**os.environ,'VSCODE_SKIP_PRELAUNCH':'1'},stdout=f,stderr=subprocess.STDOUT)
 manifest.update({'exitCode':result.returncode,'logPath':str(log),'logSha256':sha(log.read_bytes()),'logBytes':log.stat().st_size})
 text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',log.read_text(errors='replace'))
 manifest['mochaCounts']={k:[int(x) for x in re.findall(r'(\d+) '+k,text)] for k in ['passing','failing','pending']}
 manifest['assertionErrorCount']=text.count('AssertionError')
 manifest['businessRedNotYetAccepted']=True
 print(json.dumps({'exitCode':result.returncode,'mochaCounts':manifest['mochaCounts'],'assertionErrorCount':manifest['assertionErrorCount']}),flush=True)
finally:
 output.write_bytes(before)
 manifest.setdefault('testModule',{})['restoredOutputSha256']=sha(output.read_bytes())
 assert sha(output.read_bytes())==sha(before)
 for item in core:
  item['nativeOutputAfterSha256']=sha(pathlib.Path(item['outputPath']).read_bytes())
  assert item['nativeOutputAfterSha256']==item['nativeOutputBeforeSha256']
 manifest['nativeIdentityScopeAfter']=[{'path':x['outputPath'],'sha256':sha(pathlib.Path(x['outputPath']).read_bytes())} for x in native['outputs']]
 manifest['all34NativeOutputHashesRestored']=manifest['nativeIdentityScopeBefore']==manifest['nativeIdentityScopeAfter']
 manifest['sourceHeadUnchanged']=git('rev-parse','HEAD')==head
 manifest['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==manifest['sourceTree']
 manifest['worktreeCleanAfterRun']=git('status','--porcelain')==''
 manifest['finishedAtUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 pathlib.Path(str(base)+'-identity.json').write_text(json.dumps(manifest,indent=2)+'\n')
 assert manifest['all34NativeOutputHashesRestored']
print(json.dumps({'sourceHeadUnchanged':manifest['sourceHeadUnchanged'],'sourceTreeUnchanged':manifest['sourceTreeUnchanged'],'clean':manifest['worktreeCleanAfterRun'],'all34NativeOutputHashesRestored':manifest['all34NativeOutputHashesRestored'],'coreOldJsUnchanged':len(core)}),flush=True)

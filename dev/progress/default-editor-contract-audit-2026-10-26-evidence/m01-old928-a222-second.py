import pathlib,subprocess,json,hashlib,datetime,os,re,fcntl
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(repo)
prefix=pathlib.Path('/tmp/vscode-m01-old928-a222-second');candidate='a22237822e4a9feff58a89a0d78fd12669a65ca4';oldSrc='92801b513611ed3ae1ba36862a58131c609f6aa2';test='src/vs/workbench/contrib/sources/test/browser/sourcesDiffMoveSource.test.ts';out=pathlib.Path('out/'+test[4:-3]+'.js');sha=lambda b:hashlib.sha256(b).hexdigest();now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();git=lambda *args:subprocess.check_output(['git',*args],text=True).strip()
head=git('rev-parse','HEAD');assert head=='2df7ff7eda332de5aa8d5edf94e715a5fab78148' and git('rev-parse','HEAD:src')==oldSrc;assert not git('status','--porcelain');freeze=json.loads(pathlib.Path('dev/progress/default-editor-contract-audit-2026-10-26-evidence/je-final-source-native-freeze.json').read_text());assert len(freeze['outputs'])==154
anc=set();pid=os.getpid()
while pid>0:
 anc.add(pid)
 try:pid=int(pathlib.Path('/proc/'+str(pid)+'/stat').read_text().split()[3])
 except (FileNotFoundError,ValueError):break
patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit']
def scan():
 raw=subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True);matches=[]
 for line in raw.splitlines()[1:]:
  f=line.strip().split(None,3)
  if len(f)==4 and int(f[0])not in anc and any(p in f[3]for p in patterns):matches.append(line)
 return raw,matches
raw,matches=scan();prefix.with_suffix('.processes-before.log').write_text(raw);assert not matches,matches
lock=open('/tmp/vscode-compile.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);raw,matches=scan();prefix.with_suffix('.processes-under-lock.log').write_text(raw);assert not matches,matches
for r in freeze['outputs']:
 assert sha(pathlib.Path(r['path']).read_bytes())==r['sha256'],r['path'];assert sha(pathlib.Path(r['sourcePath']).read_bytes())==r['sourceSha256'],r['sourcePath']
prod=['src/vs/workbench/contrib/sources/browser/'+name+'.ts'for name in ['conversationDiffReviewPane','sourcesDiffActions','sourcesDiffRefHelpers']];production=[]
for p in prod:
 source=subprocess.check_output(['git','show',head+':'+p]);assert pathlib.Path(p).read_bytes()==source;assert subprocess.check_output(['git','show',freeze['sourceHead']+':'+p])==source
 native=pathlib.Path('out/'+p[4:-3]+'.js');production.append({'sourcePath':p,'sourceSha256':sha(source),'outputPath':str(native),'outputSha256':sha(native.read_bytes()),'inOriginal154Manifest':any(r['path']==str(native)for r in freeze['outputs'])})
source=subprocess.check_output(['git','show',candidate+':'+test]);assert sha(source)=='3e559440a02345efa67593097b98f2ee5b1e8b9ef76d553209f8f1cb82786c88';assert not pathlib.Path(test).exists();before=out.read_bytes()if out.exists()else None
record={'phase':'M01-new-real-pane-test-on-exact-frozen-old928-production','candidate':candidate,'sourceHead':head,'sourceTree':oldSrc,'nativeProducer':freeze['nativeCompileSourceHead'],'nativeCompileExit':freeze['nativeCompileExitCode'],'startedAtUtc':now(),'globalLaneMatches':matches,'sharedLockHeldAcrossTestOnlyTranspileRuntimeFinallyRestore':True,'testSourcePath':test,'testSourceSha256':sha(source),'temporaryOutputPath':str(out),'temporaryOutputBeforeExists':before is not None,'temporaryOutputBeforeSha256':sha(before)if before is not None else None,'frozenNativeIdentityCount':154,'production':production,'productionOutNotWritten':True,'sourceNotWritten':True,'rootFilesystemWipNotConsumed':True,'EAfterNeverStarted':True}
def save():prefix.with_suffix('.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
transform="import {transform}from'esbuild';let text='';for await(const c of process.stdin){text+=c;}const r=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:false,sourcefile:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}});process.stdout.write(r.code.replaceAll('.ts?esm','.js?esm'));"
try:
 code=subprocess.check_output(['node','--input-type=module','-e',transform,test],input=source);body=code.split(b'//# sourceMappingURL=')[0];assert b'ISourcesConversationDiffMoveSource'not in body and b'SourcesDiffMoveResult'not in body
 out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(code);record['temporaryOutputInstalledSha256']=sha(code);record['newTypeAliasesErasedNoNewRuntimeExportDependency']=True
 command=['rtk','proxy','timeout','--foreground','-k','15s','240s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000','--run',test,'--grep','real Pane registered command'];record['command']=command;record['env']={'VSCODE_SKIP_PRELAUNCH':'1'};save();print(json.dumps({'running':'M01-old928-real-pane-4','oldSourceTree':oldSrc,'temporaryTestOnly':True,'globalLaneMatches':0,'lockAcquired':True}),flush=True)
 with prefix.with_suffix('.log').open('wb')as log:result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'VSCODE_SKIP_PRELAUNCH':'1'})
 record['exitCode']=result.returncode;raw=prefix.with_suffix('.log').read_text(errors='replace');plain=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',raw);record['mochaSummaries']=[s.strip()for s in re.findall(r'^\s*\d+ (?:passing|failing|pending)\b.*$',plain,re.M)];record['pureBusinessAssertionCount']=plain.count('AssertionError [ERR_ASSERTION]: registered Move must open B in Preview');record['hasTimeoutOrLoadApiFailure']=bool(re.search(r'Timeout of|ERR_MODULE_NOT_FOUND|SyntaxError:|TypeError:|ReferenceError:',plain));record['validExactOldBusinessRed']=result.returncode==1 and record['mochaSummaries']==['0 passing (1s)','4 failing']if False else result.returncode==1 and any(s.startswith('0 passing')for s in record['mochaSummaries'])and any(s=='4 failing'for s in record['mochaSummaries'])and record['pureBusinessAssertionCount']==4 and not record['hasTimeoutOrLoadApiFailure'];print(plain[-7500:],flush=True)
finally:
 if before is None:
  if out.exists():out.unlink()
 else:out.write_bytes(before)
 record['temporaryOutputRestoredExistence']=out.exists()==(before is not None);record['temporaryOutputRestoredSha256']=sha(out.read_bytes())if out.exists()else None;assert record['temporaryOutputRestoredExistence'];assert record['temporaryOutputRestoredSha256']==record['temporaryOutputBeforeSha256']
 record['all154FrozenSourceNativeHashesRestored']=all(sha(pathlib.Path(r['path']).read_bytes())==r['sha256']and sha(pathlib.Path(r['sourcePath']).read_bytes())==r['sourceSha256']for r in freeze['outputs']);record['allThreeOldProductionSourceNativeHashesUnchanged']=all(sha(pathlib.Path(r['sourcePath']).read_bytes())==r['sourceSha256']and sha(pathlib.Path(r['outputPath']).read_bytes())==r['outputSha256']for r in production);record['sourceHeadUnchanged']=git('rev-parse','HEAD')==head;record['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==oldSrc;record['worktreeCleanAfterRestore']=not git('status','--porcelain');record['newTestSourceStillAbsent']=not pathlib.Path(test).exists();record['finishedAtUtc']=now();save();assert record['all154FrozenSourceNativeHashesRestored']and record['allThreeOldProductionSourceNativeHashesUnchanged']and record['worktreeCleanAfterRestore'];fcntl.flock(lock,fcntl.LOCK_UN);print(json.dumps({k:record.get(k)for k in ['exitCode','mochaSummaries','pureBusinessAssertionCount','hasTimeoutOrLoadApiFailure','validExactOldBusinessRed','all154FrozenSourceNativeHashesRestored','allThreeOldProductionSourceNativeHashesUnchanged','temporaryOutputRestoredExistence','worktreeCleanAfterRestore']}),flush=True)

import pathlib, subprocess, json, hashlib, datetime, os, re, fcntl, tempfile, stat
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(repo)
prefix=pathlib.Path('/tmp/vscode-m01-old928-0da-third');candidate='0da326c052fdaac3d6ff9e2118ba95b001868f1f';test='src/vs/workbench/contrib/sources/test/browser/sourcesDiffMoveSource.test.ts';sha=lambda b:hashlib.sha256(b).hexdigest();now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();git=lambda *args:subprocess.check_output(['git',*args],text=True).strip()
assert not prefix.with_suffix('.json').exists()
head=git('rev-parse','HEAD');assert head=='a57b22f1d375d527f086879259f461b482341891';sourceTree=git('rev-parse','HEAD:src');assert sourceTree=='8e6e9bb4b63ae2b65cf6e023fa99ad48fae9ed88' and not git('status','--porcelain')
failed=json.loads(pathlib.Path('/tmp/vscode-m01-fifth-native-build.json').read_text());assert failed['exitCode']==1 and len(failed['outputs'])==156 and failed['sourceTree']==sourceTree
old=json.loads(pathlib.Path('dev/progress/default-editor-contract-audit-2026-10-26-evidence/m01-old928-a222-second.json').read_text());freeze=json.loads(pathlib.Path('dev/progress/default-editor-contract-audit-2026-10-26-evidence/je-final-source-native-freeze.json').read_text());oldHead=freeze['sourceHead'];oldTree=git('rev-parse',oldHead+':src');assert oldTree=='92801b513611ed3ae1ba36862a58131c609f6aa2'
assert git('rev-parse',candidate+'^')=='a22237822e4a9feff58a89a0d78fd12669a65ca4'
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
backupRoot=pathlib.Path(tempfile.mkdtemp(prefix='vscode-m01-old928-0da-third-backup-'));backups={};sourceBefore={}
for item in failed['outputs']:
 path=pathlib.Path(item['outputPath']);data=path.read_bytes()if path.exists()else None;assert (sha(data)if data is not None else None)==item['afterOutputSha256'],str(path)
 b={'path':str(path),'exists':data is not None,'mode':stat.S_IMODE(path.stat().st_mode)if data is not None else None,'sha256':sha(data)if data is not None else None,'backupPath':str(backupRoot/path)if data is not None else None}
 if data is not None:
  dest=backupRoot/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);os.chmod(dest,b['mode']);assert sha(dest.read_bytes())==b['sha256']
 backups[str(path)]=b;source=pathlib.Path(item['sourcePath']);sourceBefore[str(source)]=sha(source.read_bytes());assert sourceBefore[str(source)]==item['sourceSha256']
assert len(backups)==156
unchangedSupporting=[]
for item in freeze['outputs']:
 if any(item['path']==x['outputPath']for x in old['production'])or item['path'].endswith(('sourcesDiffPanel.test.js','sourcesWiringScan.test.js')):continue
 assert sha(pathlib.Path(item['path']).read_bytes())==item['sha256'],item['path'];unchangedSupporting.append(item['path'])
source=subprocess.check_output(['git','show',candidate+':'+test]);assert sha(source)=='86e90709a2ac0453c4b464f404e8cb41cd961963d2578a86b6313367d98a39ca'
record={'phase':'new-0da-real-CommandService-harness-on-byte-exact-old928-three-production-modules','candidate':candidate,'actualCheckoutHead':head,'actualCheckoutSourceTree':sourceTree,'oldSourceHead':oldHead,'oldSourceTree':oldTree,'oldNativeProducer':freeze['nativeCompileSourceHead'],'oldNativeCompileExit':freeze['nativeCompileExitCode'],'startedAtUtc':now(),'sharedLockHeldAcrossBackupReconstructionRuntimeFinallyRestore':True,'globalLaneMatches':matches,'currentFailedCompile5':{'exitCode':failed['exitCode'],'sourceHead':failed['sourceHead'],'sourceTree':failed['sourceTree'],'scope':156},'all156CurrentOutputBackups':list(backups.values()),'backupRoot':str(backupRoot),'unchangedOldSupporting154Exclusions':['three production overlay','unselected Panel test','unselected WiringScan test'],'unchangedOldSupportingNativeCount':len(unchangedSupporting),'testSourcePath':test,'testSourceSha256':sha(source),'sourceFilesNeverWritten':True,'production':[],'rootFilesystemWipNotConsumed':True,'EAfterNeverStarted':True}
def save():prefix.with_suffix('.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
save()
transform="import {transform}from'esbuild';let text='';for await(const c of process.stdin){text+=c;}const mode=process.argv[2];const r=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:mode==='production',sourcefile:mode==='production'?process.cwd()+'/'+process.argv[1]:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}},...(mode==='production'?{supported:{'class-static-blocks':false,'dynamic-import':true,'class-field':true}}:{})});process.stdout.write(r.code.replaceAll('.ts?esm','.js?esm'));"
installed=[]
try:
 # No old production is installed until all three reconstructions match immutable historical native hashes.
 prepared=[]
 for item in old['production']:
  sourceBytes=subprocess.check_output(['git','show',oldHead+':'+item['sourcePath']]);assert sha(sourceBytes)==item['sourceSha256']
  code=subprocess.check_output(['node','--input-type=module','-e',transform,item['sourcePath'],'production'],input=sourceBytes)
  identity={'sourcePath':item['sourcePath'],'sourceSha256':sha(sourceBytes),'outputPath':item['outputPath'],'expectedHistoricalNativeSha256':item['outputSha256'],'reconstructedNativeSha256':sha(code),'byteExactOldNative':sha(code)==item['outputSha256']};record['production'].append(identity);save();assert identity['byteExactOldNative'],identity
  prepared.append((pathlib.Path(item['outputPath']),code))
 code=subprocess.check_output(['node','--input-type=module','-e',transform,test,'test'],input=source);body=code.split(b'//# sourceMappingURL=')[0];assert b'ISourcesConversationDiffMoveSource'not in body and b'SourcesDiffMoveResult'not in body and b'CommandService' in body;testOut=pathlib.Path('out/'+test[4:-3]+'.js');assert str(testOut)in backups;prepared.append((testOut,code));record['newHarnessRealCommandServicePresent']=True;record['newHarnessOutputSha256']=sha(code)
 for path,code in prepared:path.write_bytes(code);installed.append(str(path))
 assert all(sha(pathlib.Path(i['outputPath']).read_bytes())==i['expectedHistoricalNativeSha256']for i in record['production'])
 record['installedOnlyThreeOldProductionPlusNewTest']=installed
 command=['rtk','proxy','timeout','--foreground','-k','15s','240s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000','--run',test,'--grep','real Pane registered command'];record['command']=command;record['env']={'VSCODE_SKIP_PRELAUNCH':'1'};save();print(json.dumps({'running':'0da-real-CommandService-on-byte-exact-old928','oldProductionNativeHashesAllExact':True,'current156BackedUp':True,'supportingOldNativeUnchanged':len(unchangedSupporting),'globalLaneMatches':0,'lockAcquired':True}),flush=True)
 with prefix.with_suffix('.log').open('wb')as log:result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'VSCODE_SKIP_PRELAUNCH':'1'})
 record['exitCode']=result.returncode;plain=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',prefix.with_suffix('.log').read_text(errors='replace'));record['mochaSummaries']=[s.strip()for s in re.findall(r'^\s*\d+ (?:passing|failing|pending)\b.*$',plain,re.M)];record['pureBusinessAssertionCount']=plain.count('AssertionError [ERR_ASSERTION]: registered Move must open B in Preview');record['hasTimeoutOrLoadApiFailure']=bool(re.search(r'Timeout of|ERR_MODULE_NOT_FOUND|SyntaxError:|TypeError:|ReferenceError:',plain));record['validExactOldBusinessRed']=result.returncode==1 and any(s.startswith('0 passing')for s in record['mochaSummaries'])and any(s=='4 failing'for s in record['mochaSummaries'])and record['pureBusinessAssertionCount']==4 and not record['hasTimeoutOrLoadApiFailure'];print(plain[-7500:],flush=True)
finally:
 for path,b in backups.items():
  dest=pathlib.Path(path)
  if b['exists']:
   data=pathlib.Path(b['backupPath']).read_bytes();assert sha(data)==b['sha256'];dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);os.chmod(dest,b['mode'])
  elif dest.exists():dest.unlink()
 record['all156FailedCompile5OutputsExistenceModeShaRestored']=all(pathlib.Path(p).exists()==b['exists']and (not b['exists']or (sha(pathlib.Path(p).read_bytes())==b['sha256']and stat.S_IMODE(pathlib.Path(p).stat().st_mode)==b['mode']))for p,b in backups.items());record['all156SourceHashesUnchanged']=all(sha(pathlib.Path(p).read_bytes())==value for p,value in sourceBefore.items());record['sourceHeadUnchanged']=git('rev-parse','HEAD')==head;record['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==sourceTree;record['worktreeCleanAfterRestore']=not git('status','--porcelain');record['finishedAtUtc']=now();save();assert record['all156FailedCompile5OutputsExistenceModeShaRestored']and record['all156SourceHashesUnchanged']and record['sourceHeadUnchanged']and record['sourceTreeUnchanged']and record['worktreeCleanAfterRestore'];fcntl.flock(lock,fcntl.LOCK_UN);print(json.dumps({k:record.get(k)for k in ['exitCode','mochaSummaries','pureBusinessAssertionCount','hasTimeoutOrLoadApiFailure','validExactOldBusinessRed','all156FailedCompile5OutputsExistenceModeShaRestored','all156SourceHashesUnchanged','worktreeCleanAfterRestore']}),flush=True)

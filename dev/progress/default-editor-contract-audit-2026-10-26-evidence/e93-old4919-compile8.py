import datetime,fcntl,hashlib,json,os,pathlib,re,stat,subprocess,tempfile
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge'); os.chdir(repo)
prefix=pathlib.Path('/tmp/vscode-e93-old4919-compile8'); candidate='93e36abc7ad915608d546f0bcd17b8b2e221dacf'; old='4919bcc6d8ba726f7d6c91d0fa4106ff73da54ff'
test='src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts'; e=pathlib.Path('dev/progress/default-editor-contract-audit-2026-10-26-evidence')
sha=lambda b:hashlib.sha256(b).hexdigest(); now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat(); git=lambda *a:subprocess.check_output(['git',*a],text=True).strip(); gb=lambda r,p:subprocess.check_output(['git','show',r+':'+p])
assert not prefix.with_suffix('.json').exists(); head=git('rev-parse','HEAD'); tree=git('rev-parse','HEAD:src'); assert tree==git('rev-parse',old+':src')=='2b5df2b37ca926e38888443e371cf65e2883dba2' and not git('status','--porcelain')
source=gb(candidate,test); assert sha(source)=='7e8d392b17f21e99c0dab44e34a05c530e60611f25a6549f779274fffdf17a0a'; prefix.with_suffix('.test-source.ts').write_bytes(source)
freeze=json.loads((e/'m01-r2-final-freeze.json').read_text()); build=json.loads((e/'m01-eighth-native-build.json').read_text()); assert build['exitCode']==0 and build['compileOrdinal']==8 and len(freeze['outputs'])==163
anc=set(); pid=os.getpid()
while pid>0:
 anc.add(pid)
 try:pid=int(pathlib.Path('/proc',str(pid),'stat').read_text().split()[3])
 except (FileNotFoundError,ValueError):break
patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit']
def scan():
 raw=subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True); matches=[]
 for line in raw.splitlines()[1:]:
  fields=line.strip().split(None,3)
  if len(fields)==4 and int(fields[0]) not in anc and any(p in fields[3] for p in patterns):matches.append(line)
 return raw,matches
raw,matches=scan(); prefix.with_suffix('.processes-before.log').write_text(raw); assert not matches,matches
lock=open('/tmp/vscode-compile.lock','a+'); fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB); raw,matches=scan(); prefix.with_suffix('.processes-under-lock.log').write_text(raw); assert not matches,matches
rel=json.loads((e/'m01-fifth-cache-relocation.json').read_text()); cache=[]
for d in rel['directories']:
 p=pathlib.Path(d['sourceDirectory']); assert p.is_symlink() and str(p.resolve())==d['destinationDirectory']; cache.append({'path':str(p),'target':os.readlink(p),'resolved':str(p.resolve()),'stableSymlink':True})
backup=pathlib.Path(tempfile.mkdtemp(prefix='vscode-e93-old4919-native163-backup-')); snapshots=[]
for item in freeze['outputs']:
 p=pathlib.Path(item['path']); sp=pathlib.Path(item['sourcePath']); b=p.read_bytes(); sb=sp.read_bytes(); assert sha(b)==item['sha256'] and sha(sb)==item['sourceSha256'] and sb==gb(head,str(sp))==gb(old,str(sp)),str(sp)
 dest=backup/p; dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(b); mode=stat.S_IMODE(p.stat().st_mode); os.chmod(dest,mode)
 snapshots.append({'path':str(p),'exists':True,'bytes':len(b),'sha256':sha(b),'mode':mode,'sourcePath':str(sp),'sourceExists':True,'sourceBytes':len(sb),'sourceSha256':sha(sb),'sourceMode':stat.S_IMODE(sp.stat().st_mode),'sourceGitBlob':git('rev-parse',head+':'+str(sp)),'backupPath':str(dest)})
assert len(snapshots)==163
r={'phase':'93-immutable-testJS-on-exact-old4919-compile8-production','candidate':candidate,'oldProductionCommit':old,'sourceHead':head,'sourceTree':tree,'nativeCompileProducer':build['sourceHead'],'nativeCompileOrdinal':8,'startedAtUtc':now(),'sharedLockHeld':True,'globalLaneMatches':[],'testPath':test,'testSourceSha256':sha(source),'sourceFilesWritten':False,'onlyTemporaryNativeWrite':'out/'+test[4:-3]+'.js','backupScope':163,'snapshots':snapshots,'cacheStatusBefore':cache,'homeAvailableBytes':os.statvfs(repo).f_bavail*os.statvfs(repo).f_frsize,'all163OldGitSourcesAndFrozenNativeExactBefore':True,'fourProductionSourcesExactOld4919':True}
def save():prefix.with_suffix('.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
save()
try:
 transform="import{transform}from'esbuild';let text='';for await(const c of process.stdin){text+=c;}const r=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:false,sourcefile:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}});process.stdout.write(r.code.replaceAll('.ts?esm','.js?esm'));"
 code=subprocess.check_output(['node','--input-type=module','-e',transform,test],input=source); prefix.with_suffix('.temporary-test.js').write_bytes(code); r['temporaryTestJSSha256']=sha(code); pathlib.Path(r['onlyTemporaryNativeWrite']).write_bytes(code)
 command=['rtk','proxy','timeout','--foreground','-k','15s','240s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000','--run',test,'--grep','response recovery disconnected seat']; r['command']=command; r['env']={'VSCODE_SKIP_PRELAUNCH':'1'}; save(); print(json.dumps({'running':'93-new10-on-exact-old4919-compile8','snapshotScope':163,'globalLaneMatches':0,'lockAcquired':True}),flush=True)
 with prefix.with_suffix('.log').open('wb') as log: result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'VSCODE_SKIP_PRELAUNCH':'1'})
 r['exitCode']=result.returncode; raw=prefix.with_suffix('.log').read_bytes(); r['rawLogSha256']=sha(raw); plain=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',raw.decode(errors='replace')); r['mochaSummaries']=[s.strip()for s in re.findall(r'^\s*\d+ (?:passing|failing|pending)\b.*$',plain,re.M)]; r['hasLoadApiFixtureCleanupTimeoutFailure']=bool(re.search(r'Timeout of|ERR_MODULE_NOT_FOUND|SyntaxError:|TypeError:|ReferenceError:|disposables were leaked|leaked disposables|after each.*hook',plain,re.I)); r['representativeModelMutationAssertionReached']='AssertionError [ERR_ASSERTION]: a disconnected click must not authorize the cached model' in plain; r['failuresRaw']=plain[plain.find('  1) '):] if '  1) ' in plain else ''; save(); print(plain[-16000:],flush=True)
finally:
 for b in snapshots:
  p=pathlib.Path(b['path']); data=pathlib.Path(b['backupPath']).read_bytes(); assert sha(data)==b['sha256']
  if not p.exists() or sha(p.read_bytes())!=b['sha256']:p.write_bytes(data)
  if stat.S_IMODE(p.stat().st_mode)!=b['mode']:os.chmod(p,b['mode'])
 r['all163NativeExistenceModeBytesShaRestored']=all(pathlib.Path(b['path']).exists()==b['exists'] and len(pathlib.Path(b['path']).read_bytes())==b['bytes'] and sha(pathlib.Path(b['path']).read_bytes())==b['sha256'] and stat.S_IMODE(pathlib.Path(b['path']).stat().st_mode)==b['mode'] for b in snapshots)
 r['all163SourceExistenceModeBytesShaUnchanged']=all(pathlib.Path(b['sourcePath']).exists()==b['sourceExists'] and len(pathlib.Path(b['sourcePath']).read_bytes())==b['sourceBytes'] and sha(pathlib.Path(b['sourcePath']).read_bytes())==b['sourceSha256'] and stat.S_IMODE(pathlib.Path(b['sourcePath']).stat().st_mode)==b['sourceMode'] and git('rev-parse',head+':'+b['sourcePath'])==b['sourceGitBlob'] for b in snapshots)
 r['sourceHeadUnchanged']=git('rev-parse','HEAD')==head; r['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==tree; r['worktreeCleanAfterRestore']=not git('status','--porcelain'); r['threeCacheSymlinksUnchanged']=all(pathlib.Path(c['path']).is_symlink() and os.readlink(c['path'])==c['target'] and str(pathlib.Path(c['path']).resolve())==c['resolved'] for c in cache); r['finishedAtUtc']=now(); save(); fcntl.flock(lock,fcntl.LOCK_UN)
 assert all(r[k]for k in ['all163NativeExistenceModeBytesShaRestored','all163SourceExistenceModeBytesShaUnchanged','sourceHeadUnchanged','sourceTreeUnchanged','worktreeCleanAfterRestore','threeCacheSymlinksUnchanged'])
 print(json.dumps({k:r.get(k)for k in ['exitCode','mochaSummaries','representativeModelMutationAssertionReached','hasLoadApiFixtureCleanupTimeoutFailure','all163NativeExistenceModeBytesShaRestored','all163SourceExistenceModeBytesShaUnchanged','worktreeCleanAfterRestore','threeCacheSymlinksUnchanged']}),flush=True)

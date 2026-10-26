import pathlib,subprocess,json,hashlib,datetime,os,re,fcntl,stat,sys
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge'); os.chdir(repo); label=sys.argv[1]; mode=sys.argv[2]; prefix=pathlib.Path('/tmp/vscode-'+label); assert not prefix.with_suffix('.json').exists(); sha=lambda b:hashlib.sha256(b).hexdigest(); now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat(); git=lambda *a:subprocess.check_output(['git',*a],text=True).strip()
bp=pathlib.Path('/tmp/vscode-e-c3-tenth-native-build.json'); build=json.loads(bp.read_text()); assert build['compileOrdinal']==10 and build['exitCode']==0 and not build['diagnosticLines'] and build['allTrackedOutputsExist'] and build['allTrackedJSWrittenAfterCompileStart']; assert len(build['outputs'])==253
head=git('rev-parse','HEAD'); tree=git('rev-parse','HEAD:src'); assert head==build['sourceHead'] and tree==build['sourceTree']=='58b3f3e8d69e2177eefe0a7dd7c0a74b0a7a1c4c' and not git('status','--porcelain')
anc=set(); pid=os.getpid()
while pid>0:
 anc.add(pid)
 try:pid=int(pathlib.Path('/proc',str(pid),'stat').read_text().split()[3])
 except(FileNotFoundError,ValueError):break
patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit']
def scan():
 raw=subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True); matches=[]
 for line in raw.splitlines()[1:]:
  f=line.strip().split(None,3)
  if len(f)==4 and int(f[0])not in anc and any(p in f[3]for p in patterns):matches.append(line)
 return raw,matches
raw,matches=scan(); prefix.with_suffix('.processes-before.log').write_text(raw); assert not matches,matches; lock=open('/tmp/vscode-compile.lock','a+'); fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB); raw,matches=scan(); prefix.with_suffix('.processes-under-lock.log').write_text(raw); assert not matches,matches
def guard():
 return all(pathlib.Path(a['outputPath']).exists() and sha(pathlib.Path(a['outputPath']).read_bytes())==a['afterOutputSha256'] and stat.S_IMODE(pathlib.Path(a['outputPath']).stat().st_mode)==a['afterOutputMode'] and sha(pathlib.Path(a['sourcePath']).read_bytes())==a['sourceSha256'] for a in build['outputs'])
assert guard(); tests=[build['testsPlannedByDirectAffectedPostOrBindingGateImports'][0]]if mode=='new10'else build['testsPlannedByDirectAffectedPostOrBindingGateImports']; command=['rtk','proxy','timeout','--foreground','-k','15s','240s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000']
for p in tests:command+=['--run',p]
if mode=='new10':command+=['--grep','response recovery disconnected seat']
r={'label':label,'phase':'actual-compile10-native-business-test','startedAtUtc':now(),'sourceHead':head,'sourceTree':tree,'nativeCompileProducer':build['sourceHead'],'nativeCompileOrdinal':10,'nativeCompileExit':0,'nativeBuildRecordSha256':sha(bp.read_bytes()),'identityScope':253,'all253SourceNativeModeExactBefore':True,'sharedLockHeld':True,'globalLaneMatches':[],'command':command,'env':{'VSCODE_SKIP_PRELAUNCH':'1'},'testFiles':tests,'mode':mode,'freezeIssued':False,'sourceOrNativeWritten':False}
def save():prefix.with_suffix('.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
save(); print(json.dumps({'running':label,'testFiles':len(tests),'selector':mode,'nativeOrdinal':10,'identityScope':253}),flush=True)
try:
 with prefix.with_suffix('.log').open('wb')as log:result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'VSCODE_SKIP_PRELAUNCH':'1'})
 raw=prefix.with_suffix('.log').read_bytes(); plain=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',raw.decode(errors='replace')); r['exitCode']=result.returncode; r['rawLogSha256']=sha(raw); r['mochaSummaries']=[s.strip()for s in re.findall(r'^\s*\d+ (?:passing|failing|pending)\b.*$',plain,re.M)]; r['hasLoadApiFixtureCleanupTimeoutFailure']=bool(re.search(r'Timeout of|ERR_MODULE_NOT_FOUND|SyntaxError:|TypeError:|ReferenceError:|disposables were leaked|leaked disposables|after each.*hook',plain,re.I)); r['perSuiteHeaders']=[s.strip()for s in re.findall(r'^  [^\s].*$',plain,re.M)]; print(json.dumps({k:r[k]for k in ['exitCode','mochaSummaries','hasLoadApiFixtureCleanupTimeoutFailure']}),flush=True)
 if result.returncode:print(plain[-12000:],flush=True)
finally:
 r['all253SourceNativeModeExactAfter']=guard(); r['headUnchanged']=git('rev-parse','HEAD')==head; r['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==tree; r['worktreeCleanAfter']=not git('status','--porcelain'); r['finishedAtUtc']=now(); save(); fcntl.flock(lock,fcntl.LOCK_UN); assert r['all253SourceNativeModeExactAfter']and r['headUnchanged']and r['sourceTreeUnchanged']and r['worktreeCleanAfter']; print('all253/source/head/clean unchanged',flush=True)
raise SystemExit(r.get('exitCode',1))

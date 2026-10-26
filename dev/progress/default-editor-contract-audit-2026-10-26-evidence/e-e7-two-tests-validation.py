from pathlib import Path
import os,sys,json,hashlib,stat,subprocess,datetime,fcntl,re,shutil,time
repo=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(repo)
prefix=Path('/tmp/vscode-e-e7-two-tests');assert not prefix.with_suffix('.json').exists()
e=Path('dev/progress/default-editor-contract-audit-2026-10-26-evidence')
sha=lambda b:hashlib.sha256(b).hexdigest();now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
git=lambda *a:subprocess.check_output(['rtk','proxy','git',*a],text=True).strip()
head=git('rev-parse','HEAD');tree=git('rev-parse','HEAD:src');candidate='e7c246315db77aa8277775338522bb9a1cb8ff84';assert head=='8ad5164da61fbfea94023d42c7be5c72071ec299'and tree=='a2c34649ee88df907c03b70c9ec3235cb1b4a9d9'and not git('status','--porcelain')
tests=['src/vs/workbench/contrib/conversation/test/browser/conversationLensDisposeGate.test.ts','src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts'];outputs=['out/'+p[4:-3]+'.js'for p in tests]
buildPath=e/'e-c3-tenth-native-build.json';build=json.loads(buildPath.read_text());assert build['exitCode']==0 and build['compileOrdinal']==10 and not build['diagnosticLines']and len(build['outputs'])==253
changed=git('diff','--name-only',build['sourceHead'],head,'--','src').splitlines();assert set(changed)==set(tests)
assert git('rev-parse',candidate+':src')==tree and git('rev-parse',head+':src/vs/workbench/contrib/conversation/browser')==git('rev-parse',build['sourceHead']+':src/vs/workbench/contrib/conversation/browser')
anc=set();pid=os.getpid()
while pid>0:
 anc.add(pid)
 try:pid=int(Path('/proc',str(pid),'stat').read_text().split()[3])
 except(FileNotFoundError,ValueError):break
patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit']
def scan():
 raw=subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True);matches=[]
 for line in raw.splitlines()[1:]:
  f=line.strip().split(None,3)
  if len(f)==4 and int(f[0])not in anc and any(p in f[3]for p in patterns):matches.append(line)
 return raw,matches
raw,matches=scan();Path(str(prefix)+'.processes-before.log').write_text(raw);assert not matches,matches
lock=open('/tmp/vscode-compile.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);raw,matches=scan();Path(str(prefix)+'.processes-under-lock.log').write_text(raw);assert not matches,matches
rel=json.loads((e/'m01-fifth-cache-relocation.json').read_text());cache=[{'path':d['sourceDirectory'],'target':os.readlink(d['sourceDirectory']),'resolved':str(Path(d['sourceDirectory']).resolve())}for d in rel['directories']]
assert all(Path(c['path']).is_symlink()and c['resolved']==d['destinationDirectory']for c,d in zip(cache,rel['directories']))
sourcePaths={r['sourcePath']for r in build['outputs']}|set(tests);assert len(sourcePaths)==254
baseRows={}
for source in sorted(sourcePaths):
 p=Path(source);b=p.read_bytes();op=Path('out/'+source[4:]);op=op.with_suffix('.js')if op.suffix=='.ts'else op
 assert b==subprocess.check_output(['rtk','proxy','git','show',head+':'+source])and op.is_file()and not op.is_symlink()
 baseRows[str(op)]={'path':str(op),'sourcePath':source,'sourceSha256':sha(b),'sourceBlob':git('rev-parse',head+':'+source),'sourceMode':stat.S_IMODE(p.stat().st_mode),'sha256':sha(op.read_bytes()),'nativeMode':stat.S_IMODE(op.stat().st_mode)}
priorPairs=json.loads(Path('/tmp/vscode-e-final-two-tests-r2-mixed-pairs.json').read_text());priorByPath={row['path']:row for row in priorPairs['outputs']}
for old in build['outputs']:
 r=baseRows[old['outputPath']]
 if old['sourcePath']not in tests:assert r['sha256']==old['afterOutputSha256']and r['nativeMode']==old['afterOutputMode']and r['sourceSha256']==old['sourceSha256']and r['sourceBlob']==old['sourceGitBlob']and r['sourceMode']==old['sourceMode']
for op in outputs:assert baseRows[op]['sha256']==priorByPath[op]['sha256']and baseRows[op]['nativeMode']==priorByPath[op]['nativeMode']
def outstat():
 rows={}
 for root,dirs,files in os.walk('out'):
  for name in files:
   p=Path(root)/name;s=p.lstat();rows[str(p)]={'mode':stat.S_IMODE(s.st_mode),'size':s.st_size,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns,'isSymlink':p.is_symlink()}
 return rows
beforeOut=outstat();beforeOutPath=Path(str(prefix)+'.out-metadata-before.json');beforeOutPath.write_text(json.dumps(beforeOut,sort_keys=True,indent=2)+'\n')
stateRows=baseRows.copy()
def guard(label,expectedOut=None):
 assert git('rev-parse','HEAD')==head and git('rev-parse','HEAD:src')==tree and not git('status','--porcelain')
 for row in stateRows.values():
  source=Path(row['sourcePath']);native=Path(row['path']);assert source.is_file()and native.is_file()and not source.is_symlink()and not native.is_symlink()
  assert sha(source.read_bytes())==row['sourceSha256']and stat.S_IMODE(source.stat().st_mode)==row['sourceMode']and sha(native.read_bytes())==row['sha256']and stat.S_IMODE(native.stat().st_mode)==row['nativeMode'],(label,row['path'])
 if expectedOut is not None:assert outstat()==expectedOut,'Unexpected output metadata write: '+label
 assert all(Path(c['path']).is_symlink()and os.readlink(c['path'])==c['target']and str(Path(c['path']).resolve())==c['resolved']for c in cache)
 return {'label':label,'atUtc':now(),'all254SourceNativeModeExact':True,'headSourceCleanUnchanged':True,'threeCacheSymlinksUnchanged':True,'allOutFileMetadataExact':expectedOut is not None}
r={'phase':'authorized-targeted-two-test-validation-started-no-freeze','startedAtUtc':now(),'sourceHead':head,'sourceTree':tree,'candidate':candidate,'peer':'8f45ece14a319557ab61406dcd7deb36db717657','fullCompileOfFinalSourceTree':False,'latestFullCompileOrdinal':10,'latestFullCompileSourceHead':build['sourceHead'],'latestFullCompileSourceTree':build['sourceTree'],'latestFullCompileRecordPath':str(buildPath),'latestFullCompileRecordSha256':sha(buildPath.read_bytes()),'testFiles':tests,'outputPaths':outputs,'identityScopeCount':254,'unchangedCompile10MemberCount':252,'globalLaneMatches':[],'sharedLockHeld':True,'cacheSymlinks':cache,'outMetadataBeforePath':str(beforeOutPath),'outMetadataBeforeSha256':sha(beforeOutPath.read_bytes()),'outFileCount':len(beforeOut),'guards':[guard('before-semantic',beforeOut)],'stages':[],'freezeIssued':False,'uiLaunched':False,'rootWipConsumed':False,'rootOutWritten':False}
def save():prefix.with_suffix('.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
def run(label,command,env=None,limit=240):
 path=Path(str(prefix)+'.'+label+'.log');assert not path.exists();command=['rtk','proxy','timeout','--foreground','-k','15s',str(limit)+'s',*command];print(json.dumps({'stage':label,'running':command,'atUtc':now()}),flush=True);start=now()
 with path.open('wb')as log:p=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,**(env or{})})
 entry={'stage':label,'command':command,'startedAtUtc':start,'finishedAtUtc':now(),'exitCode':p.returncode,'rawLogPath':str(path),'rawLogSha256':sha(path.read_bytes())};r['stages'].append(entry);save();print(json.dumps(entry),flush=True);return entry
save();print(json.dumps({'locked':True,'head':head,'src':tree,'scope':254,'allOutFiles':len(beforeOut),'onlyTwoTestSourceChanges':True}),flush=True)
try:
 sem=run('semantic',['node','--max-old-space-size=8192','/tmp/vscode-e-e7-two-tests-semantic.mjs',json.dumps(tests)])
 r['guards'].append(guard('after-semantic',beforeOut));save()
 if sem['exitCode']:raise RuntimeError('Actual targeted semantic/noEmit failed; no emitter or business tests executed')
 parsed=json.loads(Path(sem['rawLogPath']).read_text());assert parsed['noEmit']and not parsed['errorCount'];r['semanticRootCount']=parsed['rootCount']
 lint=run('eslint',['node','node_modules/eslint/bin/eslint.js','--format','json',*tests]);r['guards'].append(guard('after-eslint',beforeOut));lintRows=json.loads(Path(lint['rawLogPath']).read_text());r['eslintCounts']={k:sum(x[k]for x in lintRows)for k in ['errorCount','warningCount','fatalErrorCount']};save()
 if lint['exitCode']or r['eslintCounts']['errorCount']:raise RuntimeError('Actual two-file ESLint failed; no emitter or business tests executed')
 driver=Path('/tmp/vscode-e-e7-two-tests-emitter.mjs');options=Path('/tmp/vscode-e-e7-two-tests-emitter-options.json');optionsRun=run('emitter-options',['node',str(driver),'options',json.dumps(tests),str(options)]);r['guards'].append(guard('after-options-no-transform',beforeOut));save()
 if optionsRun['exitCode']:raise RuntimeError('Emitter options qualification failed; no emit executed')
 tools={}
 for name in ['typescript','esbuild','gulp']:
  p=Path('node_modules')/name/'package.json';d=json.loads(p.read_text());tools[name]={'packageVersion':d['version'],'packagePath':str(p),'packageSha256':sha(p.read_bytes())};actual=json.loads(subprocess.check_output(['node','-p',"JSON.stringify({modulePath:require.resolve("+json.dumps(name)+"),runtimeVersion:require("+json.dumps(name)+").version??null})"],text=True));tools[name].update(actual);tools[name]['moduleSha256']=sha(Path(actual['modulePath']).read_bytes())
 node=Path(shutil.which('node')).resolve();toolversion=Path('/tmp/vscode-e-e7-two-tests-emitter-toolversion.json');toolversion.write_text(json.dumps({'nodeVersion':subprocess.check_output(['node','--version'],text=True).strip(),'nodeExecutable':str(node),'nodeExecutableSha256':sha(node.read_bytes()),'packages':tools,'repositoryBuildInputs':[{'path':p,'sha256':sha(Path(p).read_bytes())}for p in ['build/lib/compilation.ts','build/lib/tsb/index.ts','build/lib/tsb/transpiler.ts','build/lib/tsconfigUtils.ts','src/tsconfig.json','src/tsconfig.base.json']]},indent=2)+'\n')
 emitStartedNs=time.time_ns();emit=run('emitter',['node',str(driver),'emit',json.dumps(tests),str(options)]);afterOut=outstat();mutated=sorted(p for p in set(beforeOut)|set(afterOut)if beforeOut.get(p)!=afterOut.get(p));r['onlyExpectedTwoOutPathsMetadataChanged']=mutated==sorted(outputs);r['outMetadataChangedPaths']=mutated;save()
 if emit['exitCode']:raise RuntimeError('Actual targeted emitter failed; no business tests executed')
 assert mutated==sorted(outputs),mutated
 emitterId='test-refresh-'+candidate[:12];fresh=[]
 for op in outputs:
  row={**baseRows[op],'sha256':sha(Path(op).read_bytes()),'nativeMode':stat.S_IMODE(Path(op).stat().st_mode),'provenanceRef':emitterId};assert Path(op).stat().st_mtime_ns>=emitStartedNs and row['sourceBlob']==git('rev-parse',candidate+':'+row['sourcePath']);stateRows[op]=row;fresh.append(row)
 emitter={'id':emitterId,'sourceHead':head,'sourceTree':tree,'candidate':candidate,'emittedAtUtc':now(),'exitCode':emit['exitCode'],'outputPaths':outputs,'outputs':sorted(fresh,key=lambda x:x['path']),'driverPath':str(driver),'driverSha256':sha(driver.read_bytes()),'optionsPath':str(options),'optionsSha256':sha(options.read_bytes()),'toolversionPath':str(toolversion),'toolversionSha256':sha(toolversion.read_bytes()),'rawLogPath':emit['rawLogPath'],'rawLogSha256':emit['rawLogSha256'],'fullCompileOfFinalSourceTree':False,'onlyExpectedTwoOutPathsMetadataChanged':True,'compile10SourceOrNativeOther252Unchanged':True,'emitterStartedNs':emitStartedNs,'emitterFinishedAtUtc':emit['finishedAtUtc']}
 emitterPath=Path('/tmp/vscode-e-e7-two-tests-emitter.json');emitterPath.write_text(json.dumps(emitter,ensure_ascii=False,indent=2)+'\n');r['targetedEmitterRecordPath']=str(emitterPath);r['targetedEmitterRecordSha256']=sha(emitterPath.read_bytes())
 normalized=[]
 for op,row in sorted(stateRows.items()):normalized.append({**row,'provenanceRef':emitterId if op in outputs else'compile10'})
 pairPath=Path('/tmp/vscode-e-e7-two-tests-mixed-pairs.json');pairPath.write_text(json.dumps({'sourceHead':head,'sourceTree':tree,'fullCompileOfFinalSourceTree':False,'identityScopeCount':254,'compile10ContinuousCount':252,'freshTestsCount':2,'outputs':normalized},ensure_ascii=False,indent=2)+'\n');r['mixedPairManifestPath']=str(pairPath);r['mixedPairManifestSha256']=sha(pairPath.read_bytes());r['guards'].append(guard('after-two-test-emit',afterOut));save()
 command=['xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000']
 for source in tests:command+=['--run',source]
 suites=run('full-lens-suites',command,{'VSCODE_SKIP_PRELAUNCH':'1'},360);raw=Path(suites['rawLogPath']).read_text(errors='replace');plain=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',raw);r['suiteMochaSummaries']=[m.strip()for m in re.findall(r'^\s*\d+ (?:passing|failing|pending)\b.*$',plain,re.M)];r['suiteHasLoadApiFixtureCleanupTimeoutFailure']=bool(re.search(r'Timeout of|ERR_MODULE_NOT_FOUND|SyntaxError:|TypeError:|ReferenceError:|disposables were leaked|leaked disposables|after each.*hook',plain,re.I));r['guards'].append(guard('after-complete-lens-suites',afterOut));r['suiteExitCode']=suites['exitCode'];r['phase']='authorized-targeted-two-test-validation-finished-no-freeze';r['exitCode']=suites['exitCode'];save();print(json.dumps({'suiteExitCode':suites['exitCode'],'summaries':r['suiteMochaSummaries'],'loadApiFixtureCleanupTimeoutFailure':r['suiteHasLoadApiFixtureCleanupTimeoutFailure'],'all254Guarded':True}),flush=True)
except BaseException as exc:
 r['failure']=repr(exc);r['phase']='authorized-targeted-two-test-validation-stopped-on-actual-failure-no-freeze';r['exitCode']=1;print('STOP:',repr(exc),flush=True);raise
finally:
 r['finishedAtUtc']=now();r['headUnchanged']=git('rev-parse','HEAD')==head;r['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==tree;r['worktreeClean']=not git('status','--porcelain');save();fcntl.flock(lock,fcntl.LOCK_UN)
sys.exit(r.get('exitCode',1))

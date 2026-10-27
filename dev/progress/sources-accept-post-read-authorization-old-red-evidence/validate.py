from pathlib import Path
import os,sys,json,hashlib,stat,subprocess,datetime,fcntl,runpy,time,re,signal,traceback
ROOT=Path(__file__).parent;REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(REPO)
manifest=json.loads((ROOT/'input-manifest.json').read_text());allowed=sorted(r['outputPath']for r in manifest['sourceFiles'])
sha=lambda b:hashlib.sha256(b).hexdigest();now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
api=runpy.run_path('dev/progress/sources-accept-post-read-authorization-integration-audit.py',run_name='audit')
def git(*a):return subprocess.check_output(['rtk','proxy','git',*a])
def gs(*a):return git(*a).decode().strip()
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
r={'runId':ROOT.name,'startedAtUtc':now(),'scope':'ab43 new tests + exact c7 old production; old-red-only temporary scoped release','repositoryHead':manifest['expectedHead'],'repositorySourceTree':manifest['sourceTree'],'sourceInputs':manifest['sourceFiles'],'allowedOutPaths':allowed,'stages':[],'guards':[],'runtimeProcesses':[],'runtimeSystemPaths':[],'formalCandidateMerged':False,'newGreenAuthorized':False,'fullCompileOfFinalSourceTree':False,'historicalFourFreezeFilesRewritten':False,'cacheRelocated':False,'runtimeBusinessRun':False,'restorationComplete':False}
def report():save(ROOT/'validation-report.json',r)
def identity():assert gs('rev-parse','HEAD')==manifest['expectedHead'] and gs('rev-parse','HEAD:src')==manifest['sourceTree'] and not gs('status','--porcelain=v1')
def fixedguard(before):
 identity()
 for p,row in before['freezeFiles'].items():assert sha(Path(p).read_bytes())==row['sha256'] and api['meta'](Path(p))==row['metadata']
 for p,row in before['cacheSymlinks'].items():assert Path(p).is_symlink() and os.readlink(p)==row['target'] and str(Path(p).resolve())==row['resolved'] and api['meta'](Path(p))==row['metadata']
 for row in before['pairs254']:
  p=Path(row['sourcePath']);assert sha(p.read_bytes())==row['sourceSha256'] and stat.S_IMODE(p.stat().st_mode)==row['sourceMode']
 for row in before['extra2PairsWithoutProducerCredit']:
  p=Path(row['sourcePath']);assert sha(p.read_bytes())==row['sourceSha256'] and stat.S_IMODE(p.stat().st_mode)==row['sourceMode']
def guard(label,before,expectedOut):
 fixedguard(before);actual=api['outmeta']();assert actual==expectedOut,(label,[p for p in set(actual)|set(expectedOut)if actual.get(p)!=expectedOut.get(p)])
 r['guards'].append({'label':label,'atUtc':now(),'allOutFilesAndDirectoriesMetadataExactToStageBaseline':True,'allRepositorySourcesHeadCleanFreezeCacheExact':True});report()
def processes():
 result={}
 for p in Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   s=(p/'stat').read_text().split(') ',1)[1].split();cmd=(p/'cmdline').read_bytes().split(b'\0');result[int(p.name)]={'ppid':int(s[1]),'startTime':s[19],'argv':[x.decode(errors='replace')for x in cmd if x]}
  except (FileNotFoundError,ProcessLookupError,PermissionError,IndexError):pass
 return result
def run(label,args,env=None,limit=180):
 stdout=ROOT/(label+'.stdout.log');stderr=ROOT/(label+'.stderr.log');assert not stdout.exists() and not stderr.exists()
 command=['rtk','proxy','timeout','--foreground','-k','10s',str(limit)+'s',*args];entry={'stage':label,'command':command,'environmentOverrides':env or{},'startedAtUtc':now(),'stdoutPath':str(stdout),'stderrPath':str(stderr)}
 r['stages'].append(entry);report();print(json.dumps({'running':label,'atUtc':now(),'command':command}),flush=True)
 seen=set()
 with stdout.open('wb')as out,stderr.open('wb')as err:
  proc=subprocess.Popen(command,stdout=out,stderr=err,env={**os.environ,**(env or{})},start_new_session=True)
  while True:
   ps=processes();desc={proc.pid};changed=True
   while changed:
    more={pid for pid,row in ps.items()if row['ppid']in desc};changed=not more.issubset(desc);desc|=more
   for pid in sorted(desc):
    if pid not in ps:continue
    row=ps[pid];key=(pid,tuple(row['argv']))
    if key not in seen:r['runtimeProcesses'].append({'stage':label,'pid':pid,**row,'firstObservedAtUtc':now()});seen.add(key)
    if row['argv'] and Path(row['argv'][0]).name=='Xvfb':
     for a in row['argv'][1:]:
      if re.fullmatch(r':\d+',a):
       n=a[1:]
       for sp in ['/tmp/.X11-unix/X'+n,'/tmp/.X'+n+'-lock']:
        p=Path(sp)
        if p.exists() and not any(x['path']==sp and x['stage']==label for x in r['runtimeSystemPaths']):r['runtimeSystemPaths'].append({'stage':label,'path':sp,'metadata':api['meta'](p),'observedAtUtc':now()})
   if proc.poll()is not None:break
   time.sleep(.04)
  rc=proc.wait()
 entry.update({'finishedAtUtc':now(),'exitCode':rc,'stdoutSha256':sha(stdout.read_bytes()),'stdoutBytes':stdout.stat().st_size,'stderrSha256':sha(stderr.read_bytes()),'stderrBytes':stderr.stat().st_size});report();print(json.dumps({'finished':label,'exitCode':rc,'stdoutBytes':entry['stdoutBytes'],'stderrBytes':entry['stderrBytes']}),flush=True);return entry
def parse_mocha(entry):
 raw=Path(entry['stdoutPath']).read_text(errors='replace');decoder=json.JSONDecoder();found=[]
 for i,c in enumerate(raw):
  if c!='{':continue
  try:v,end=decoder.raw_decode(raw[i:])
  except json.JSONDecodeError:continue
  if isinstance(v,dict)and isinstance(v.get('stats'),dict)and 'failures'in v:found.append(v)
 if not found:return {'parsed':False,'classification':'runner-load-api-fixture-or-timeout-to-be-read-from-raw'}
 data=found[-1];save(ROOT/(entry['stage']+'.mocha.json'),data)
 failures=[]
 for f in data.get('failures',[]):
  err=f.get('err',{});msg=err.get('message','');name=err.get('name','');kind='unclassified'
  if 'Accept post-read authorization'in f.get('fullTitle','') and (name=='AssertionError' or err.get('code')=='ERR_ASSERTION') and 'applies'in str(err.get('actual',{})):kind='business-projection-assertion-needs-exact-trace-review'
  elif re.search(r'Timeout|timeout',msg):kind='timeout'
  elif re.search(r'TypeError|ReferenceError|SyntaxError|ERR_MODULE_NOT_FOUND|not a function',name+' '+msg):kind='fixture-api-load'
  elif re.search(r'disposable|leak|unexpected',msg,re.I):kind='cleanup-or-meta'
  failures.append({'fullTitle':f.get('fullTitle'),'errorName':name,'code':err.get('code'),'message':msg,'classification':kind,'actual':err.get('actual'),'expected':err.get('expected')})
 return {'parsed':True,'stats':data['stats'],'tests':[{'fullTitle':t.get('fullTitle'),'duration':t.get('duration'),'hasError':bool(t.get('err'))}for t in data.get('tests',[])],'failures':failures,'passes':[t.get('fullTitle')for t in data.get('passes',[])],'pending':[t.get('fullTitle')for t in data.get('pending',[])]}
def runtimetree():
 rows=[]
 for root,dirs,files in os.walk(ROOT):
  if not Path(root).relative_to(ROOT).parts or not Path(root).relative_to(ROOT).parts[0].startswith('runtime-'):continue
  for name in dirs+files:
   p=Path(root)/name
   try:rows.append({'path':str(p),'metadata':api['meta'](p),'symlinkTarget':os.readlink(p)if p.is_symlink()else None})
   except FileNotFoundError:pass
 return rows
lock=None;before=None;seals=[]
try:
 identity();r['processScanBeforeLock']=api['scan']();lock=open('/tmp/vscode-compile.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);r['processScanUnderLock']=api['scan']();r['sharedLockHeld']=True
 before=api['snapshot']();save(ROOT/'guard-before.json',before)
 for out in allowed:
  p=Path(out);s=p.stat();b=p.read_bytes();seal=ROOT/'sealed-originals'/out;seal.parent.mkdir(parents=True,exist_ok=True);seal.write_bytes(b);seals.append({'path':out,'sha256':sha(b),'bytes':len(b),'mode':stat.S_IMODE(s.st_mode),'mtimeNs':s.st_mtime_ns,'atimeNs':s.st_atime_ns,'ctimeNs':s.st_ctime_ns,'sealedBytesPath':str(seal)})
 save(ROOT/'sealed-originals.json',seals);r['sealedOriginals']=seals;report();guard('before-dry',before,before['outMetadata'])
 dry=run('dry-enumeration',['node',str(ROOT/'emitter.mjs'),'dry']);guard('after-dry-no-out-write',before,before['outMetadata']);assert dry['exitCode']==0,'Actual dry emitter failed; no out writes or business tests allowed'
 drydata=json.loads((ROOT/'dry-emitter-report.json').read_text());assert sorted(x['outputPath']for x in drydata['outputs'])==allowed and drydata['standaloneMapCount']==0 and not drydata['outWriteFileCalls']
 emit=run('temporary-five-file-emit',['node',str(ROOT/'emitter.mjs'),'emit']);assert emit['exitCode']==0,'Actual temporary emitter failed; no business tests allowed'
 emitted=json.loads((ROOT/'emit-emitter-report.json').read_text());assert sorted(x['path']for x in emitted['outWriteFileCalls'])==allowed and len(emitted['outWriteFileCalls'])==5
 for row in emitted['outputs']:assert sha(Path(row['outputPath']).read_bytes())==row['sha256']
 mixed=api['outmeta']();changed=sorted(p for p in set(mixed)|set(before['outMetadata'])if mixed.get(p)!=before['outMetadata'].get(p));assert changed==allowed,changed
 save(ROOT/'guard-after-emit-out-metadata.json',mixed);r['actualTemporaryOutMetadataChangedPaths']=changed;r['actualEmittedMixedIdentity']=emitted['outputs'];r['actualOutWriteFileCalls']=emitted['outWriteFileCalls'];guard('after-exact-five-emit',before,mixed)
 product=json.loads(Path('product.json').read_text());electron=Path('.build/electron')/product['applicationName'];assert electron.is_file()
 r['officialRunner']={'electronPath':str(electron),'resolvedElectronPath':str(electron.resolve()),'entryPoint':'test/unit/electron/index.js','directInvocationReason':'Official Electron unit entry point directly, retaining scripts/test.sh arguments while assigning a run-owned crash path instead of its fixed repository .build/crashes path; no preLaunch fetch.'}
 tests={'primary-a1':('src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts',r'Accept post-read authorization (Pane|Panel) A1 active session changes to s2 before write$'),'positive-a2-a3':('src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts',r'Accept post-read authorization (Pane|Panel) A[23] '),'independent-input-dispose-a4':('src/vs/workbench/contrib/sources/test/browser/conversationDiffReviewPane.test.ts',r'Accept post-read authorization input\.dispose with live Pane and identical input sends no ApplyHunks$')}
 for label,(source,selector)in tests.items():
  runtime=ROOT/('runtime-'+label);runtime.mkdir();crashes=runtime/'crashes';crashes.mkdir()
  env={'TMPDIR':str(runtime),'XDG_CONFIG_HOME':str(runtime/'config'),'XDG_CACHE_HOME':str(runtime/'cache'),'XDG_DATA_HOME':str(runtime/'data'),'ELECTRON_ENABLE_LOGGING':'1','VSCODE_SKIP_PRELAUNCH':'1'}
  args=['xvfb-run','-a','-e',str(runtime/'xvfb.stderr.log'),str(electron),'test/unit/electron/index.js','--crash-reporter-directory='+str(crashes),'--no-sandbox','--disable-gpu','--timeout','15000','--reporter','json','--run',source,'--grep',selector]
  stage=run(label,args,env);r['runtimeBusinessRun']=True;stage['mocha']=parse_mocha(stage);report();guard('after-'+label,before,mixed)
 r['phase']='actual-old-red-and-controls-finished-awaiting-exact-review';r['exitCode']=0
except BaseException as error:
 r['failure']=repr(error);r['traceback']=traceback.format_exc();r['phase']='stopped-on-actual-failure';r['exitCode']=1;print(r['traceback'],flush=True)
finally:
 r['restoreStartedAtUtc']=now();restored=[]
 if before is not None:
  try:
   for seal in seals:
    p=Path(seal['path']);b=Path(seal['sealedBytesPath']).read_bytes();assert sha(b)==seal['sha256'];s=p.stat()
    if sha(p.read_bytes())!=seal['sha256']or stat.S_IMODE(s.st_mode)!=seal['mode']or s.st_mtime_ns!=seal['mtimeNs']:
     p.write_bytes(b)
     if stat.S_IMODE(p.stat().st_mode)!=seal['mode']:p.chmod(seal['mode'])
     os.utime(p,ns=(seal['atimeNs'],seal['mtimeNs']));restored.append(seal['path'])
   after=api['snapshot']();save(ROOT/'guard-after-restore.json',after)
   assert {k:v for k,v in after.items()if k!='outMetadata'}=={k:v for k,v in before.items()if k!='outMetadata'}
   differences=[]
   assert set(after['outMetadata'])==set(before['outMetadata'])
   for p,oldrow in before['outMetadata'].items():
    new=after['outMetadata'][p]
    if oldrow!=new:
     keys=[k for k in oldrow if oldrow[k]!=new[k]];assert p in allowed and keys==['ctimeNs'],(p,keys);differences.append({'path':p,'changedMetadataKeys':keys,'beforeCtimeNs':oldrow['ctimeNs'],'afterCtimeNs':new['ctimeNs']})
   assert sorted(restored)==allowed if r.get('actualOutWriteFileCalls') else set(restored).issubset(set(allowed))
   r['restorationComplete']=True;r['restoreGuard']={'finishedAtUtc':now(),'restoredPaths':restored,'allFiveOriginalBytesModeMtimeExact':True,'all254AndExtraTwoPairsExact':True,'other12549FilesFullMetadataExact':True,'all2946DirectoryMetadataExact':True,'allFourOriginalFreezeFilesExact':True,'allThreeOriginalCacheSymlinksExact':True,'authorizedCtimeDifferences':differences,'noOtherOutChanges':True,'headSourceCleanUnchanged':True}
  except BaseException as error:r['restoreFailure']=repr(error);r['restoreTraceback']=traceback.format_exc();r['exitCode']=1;print(r['restoreTraceback'],flush=True)
 r['runtimeFilesystemManifest']=runtimetree();r['finishedAtUtc']=now();report()
 if lock is not None:fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
 print(json.dumps({'finishedAtUtc':r['finishedAtUtc'],'phase':r.get('phase'),'exitCode':r.get('exitCode'),'restorationComplete':r['restorationComplete'],'testStages':[{'stage':s['stage'],'exitCode':s.get('exitCode'),'mocha':s.get('mocha',{}).get('stats')}for s in r['stages']if'mocha'in s],'ctimeDifferences':r.get('restoreGuard',{}).get('authorizedCtimeDifferences',[])}),flush=True)
sys.exit(r.get('exitCode',1))

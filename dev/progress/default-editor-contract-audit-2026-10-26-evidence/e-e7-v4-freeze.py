from pathlib import Path
import os,json,hashlib,subprocess,datetime,stat,fcntl,importlib.util,re
repo=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(repo)
e=repo/'dev/progress/default-editor-contract-audit-2026-10-26-evidence';static=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/sources-e-gate-after-20261027-r3');root=repo/'.build/sources-e-gate-after-20261027-r3-baseline-freeze-v4';assert not root.exists();root.mkdir();common=root/'common';common.mkdir()
sha=lambda b:hashlib.sha256(b).hexdigest();dump=lambda p,d:p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');git=lambda *a:subprocess.check_output(['rtk','proxy','git',*a],text=True).strip();now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
head=git('rev-parse','HEAD');tree=git('rev-parse','HEAD:src');assert head=='7ffe4d9869a0caea76bab537d8d49f08e0776ecd'and tree=='a2c34649ee88df907c03b70c9ec3235cb1b4a9d9'and not git('status','--porcelain')
gatePath=static/'common/gates.py';assert sha(gatePath.read_bytes())=='8bf14be1d91c41893bed7a8c1d81af75f8182e11a1365607dd0bcac0bb523f88';spec=importlib.util.spec_from_file_location('v4gate',gatePath);gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
contract=json.loads((static/'contract.json').read_text());runId=contract['runId'];pairs=json.loads((e/'e-e7-two-tests-mixed-pairs.json').read_text());outputs=gate.identities(pairs['outputs']);frozen={r['path']:r for r in outputs};assert len(outputs)==254 and len(contract['requiredCommonPaths'])==138 and set(contract['requiredFullPaths'])<=set(frozen)
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
raw,matches=scan();(root/'processes-before.log').write_text(raw);assert not matches,matches
lock=open('/tmp/vscode-compile.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);raw,matches=scan();(root/'processes-under-lock.log').write_text(raw);assert not matches,matches
metaBefore=json.loads((e/'e-e7-two-tests-out-metadata-after.json').read_text())
def guard():
 assert git('rev-parse','HEAD')==head and git('rev-parse','HEAD:src')==tree and not git('status','--porcelain')
 for row in outputs:
  p=Path(row['sourcePath']);q=Path(row['path']);assert not p.is_symlink()and not q.is_symlink();assert sha(p.read_bytes())==row['sourceSha256']and stat.S_IMODE(p.stat().st_mode)==row['sourceMode']and sha(q.read_bytes())==row['sha256']and stat.S_IMODE(q.stat().st_mode)==row['nativeMode'];assert git('rev-parse',head+':'+row['sourcePath'])==row['sourceBlob']
 current={}
 for folder,dirs,files in os.walk('out'):
  for name in files:
   p=Path(folder)/name;s=p.lstat();current[str(p)]={'mode':stat.S_IMODE(s.st_mode),'size':s.st_size,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns,'isSymlink':p.is_symlink()}
 assert current==metaBefore
 return {'atUtc':now(),'all254SourceNativeModeFinalGitExact':True,'all12554OutMetadataUnchangedSince317Run':True,'headSourceCleanUnchanged':True}
try:
 before=guard();bp=e/'e-c3-tenth-native-build.json';build=json.loads(bp.read_text());ep=e/'e-e7-two-tests-emitter.json';em=json.loads(ep.read_text());lineage={'fullCompileOfFinalSourceTree':False,'latestFullCompile':{'ordinal':10,'producerHead':build['producer'],'sourceHead':build['sourceHead'],'sourceTree':build['sourceTree'],'exitCode':0,'tsErrors':0,'recordPath':str(bp),'recordSha256':sha(bp.read_bytes()),'pairManifestPath':str(bp),'pairManifestSha256':sha(bp.read_bytes()),'rawLogPath':str(e/'e-c3-tenth-native-build.log'),'rawLogSha256':build['rawLogSha256']},'targetedTestsEmitter':{'id':em['id'],'candidate':em['candidate'],'sourceHead':em['sourceHead'],'sourceTree':em['sourceTree'],'exitCode':0,'emittedAt':em['emittedAtUtc'],'recordPath':str(ep),'recordSha256':sha(ep.read_bytes()),'pairManifestPath':str(ep),'pairManifestSha256':sha(ep.read_bytes()),'rawLogPath':str(e/'e-e7-two-tests.emitter.log'),'rawLogSha256':em['rawLogSha256'],'outputPaths':em['outputPaths']}}
 for name,filename in [('driver','e-e7-two-tests-emitter.mjs'),('options','e-e7-two-tests-emitter-options.json'),('toolversion','e-e7-two-tests-emitter-toolversion.json')]:
  lineage['targetedTestsEmitter'][name+'Path']=str(e/filename);lineage['targetedTestsEmitter'][name+'Sha256']=em[name+'Sha256']
 origins=gate.lineage_records(lineage,contract)
 for row in outputs:assert gate.identities([row])==gate.identities([origins[row['provenanceRef']][row['path']]])
 assert sum(r['provenanceRef']=='compile10'for r in outputs)==252
 for row in em['outputs']:assert git('rev-parse',em['candidate']+':'+row['sourcePath'])==row['sourceBlob']
 changed=set(git('diff','--name-only',build['sourceHead'],head,'--','src').splitlines());assert changed=={frozen[p]['sourcePath']for p in contract['allowedTargetedTestPaths']}
 lineageSha=gate.digest(lineage);commonRows=[frozen[p]for p in sorted(contract['requiredCommonPaths'])];assert all(r['provenanceRef']=='compile10'for r in commonRows)
 issued=now()
 for phase,filename,rows in [('J','freeze-J.json',commonRows),('E','freeze-E.json',commonRows),('full','full-freeze.json',outputs)]:
  template=json.loads((static/'common'/('full-freeze.template.json'if phase=='full'else'freeze-'+phase+'.template.json')).read_text());template.update({'state':'ACTUAL_SOURCE_NATIVE_FROZEN_NOT_LAUNCH_AUTHORIZATION','outFrozen':True,'sourceHead':head,'sourceTree':tree,'finalSourceHead':head,'finalSourceTree':tree,'fullCompileOfFinalSourceTree':False,'lineage':lineage,'outputs':rows,'issuedAtUtc':issued,'actualCommonAssets':138,'actualFullAssets':254,'manifestOnlyNoRuntimeLoadedClaim':True,'outMutationSuspendedUntilRootExplicitlyReleases':True,'sharedLockHeldDuringIssue':True,'noUiOrFakeStarted':True});dump(common/filename,template)
 fullPath=common/'full-freeze.json';fullSha=sha(fullPath.read_bytes());notice=json.loads((common/'freeze-J.json').read_text());canonical=gate.canonical(notice);assert canonical==gate.canonical(json.loads((common/'freeze-E.json').read_text()))
 lane=json.loads((static/'common/lane-provenance.template.json').read_text());lane.update({'state':'ACTUAL_DECLARED_INPUT_PROVENANCE_VERIFIED_NOT_UI_COMPLETION','finalSourceHead':head,'finalSourceTree':tree,'lineageSha256':lineageSha,'fullFreezeRawSha256':fullSha})
 hist=json.loads((e/'m01-eighth-J-complete-11.json').read_text());cont=json.loads((e/'e-c3-historical-pair-continuity.json').read_text());jSources=cont['J39And425ExistingAssertionScope']['paths'];jPaths=['out/'+p[4:-3]+'.js'if p.endswith('.ts')else'out/'+p[4:]for p in jSources];assert len(jPaths)==28
 def proof(name,testhead,testtree,rawpath,pairpath,kind,paths,ref,historical=False,extra=None):
  rows=[frozen[p]for p in sorted(paths)];prior=gate.members(json.loads(pairpath.read_text()),kind)if kind=='compile10'else{r['path']:r for r in json.loads(pairpath.read_text())['outputs']}
  for row in rows:
   old=prior[row['path']];assert old['sha256']==row['sha256']and old['sourceSha256']==row['sourceSha256']and old['sourcePath']==row['sourcePath'];assert sha(subprocess.check_output(['rtk','proxy','git','show',testhead+':'+row['sourcePath']]))==row['sourceSha256']and git('rev-parse',testhead+':'+row['sourcePath'])==row['sourceBlob']
  assert git('rev-parse',testhead+':src')==testtree
  value={'executed':True,'exitCode':0,'provenanceRef':ref,'testedSourceHead':testhead,'testedSourceTree':testtree,'scope':'exact-declared-inputs-only','historicalScopeOnly':historical,'rawLogPath':str(rawpath),'rawLogSha256':sha(rawpath.read_bytes()),'pairManifestPath':str(pairpath),'pairManifestSha256':sha(pairpath.read_bytes()),'pairManifestKind':kind,'testedInputs':rows,'testedInputsSha256':gate.digest(gate.identities(rows)),'declaredInputMeaning':'guarded source/native input pairs, not loaded-module observations'}
  if extra:value.update(extra)
  lane[name]=value
 proof('JHelperStaleAndPublicFinder',hist['sourceHead'],hist['sourceTree'],e/'m01-eighth-J-complete-11.log',e/'m01-r2-final-freeze.json','normalized',jPaths,'historical-j-exact-inputs',True,{'originalRawPassing':425,'wholeOldSuiteClaimedRerun':False,'continuityBoundary':'Only 28 declared exact source/native-continuous J/Sources input pairs inherit the historical assertion scope; no whole E11 or new UI claim.'})
 core=json.loads((e/'e-c3-new10.json').read_text());rawCore=e/'e-c3-new10.log';plain=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',rawCore.read_text());assert core['exitCode']==0 and all(n in plain for n in contract['requiredNewCoreCaseNames']);assert re.search(r'\b10 passing\b',plain)and not re.search(r'\b[1-9]\d* failing\b',plain)
 proof('newDisconnectedResponseCore10',core['sourceHead'],core['sourceTree'],rawCore,bp,'compile10',contract['requiredNewCoreProofInputs'],'compile10',False,{'actualPassing':10,'actualCaseNames':contract['requiredNewCoreCaseNames'],'actualCommand':core['command'],'actualRunFiles':core['testFiles'],'readingColumnTestClaimedRunInThisProcess':False})
 actual=json.loads((e/'e-e7-two-tests.json').read_text());assert actual['suiteExitCode']==0
 proof('targetedFullLensSuites',em['sourceHead'],em['sourceTree'],e/'e-e7-two-tests.full-lens-suites.log',e/'e-e7-two-tests-mixed-pairs.json','normalized',list(frozen),em['id'],False,{'actualPassing':317,'actualFailing':0,'actualBusinessPassing':316,'actualCommand':actual['stages'][-1]['command'],'requiredSuites':contract['allowedTargetedTestPaths'],'fullSuiteRuns':True,'grepUsed':False,'skipUsed':False})
 assert set(contract['requiredJHelperProofInputs'])<=set(jPaths);dump(common/'lane-provenance.json',lane)
 after=guard();manifest={'runId':runId,'issuedAtUtc':issued,'finalSourceHead':head,'finalSourceTree':tree,'fullCompileOfFinalSourceTree':False,'commonAssets':138,'fullAssets':254,'compile10ContinuousMembers':252,'targetedFreshTests':2,'sharedCanonicalCommonSha256':canonical,'fullCanonicalSha256':gate.canonical(json.loads(fullPath.read_text())),'lineageSha256':lineageSha,'outMutationSuspended':True,'oldFreezeCompletionFilesUnmodified':True,'executionAuthorizationCreated':False,'phaseCompletionCreated':False,'uiOrFakeStarted':False,'beforeGuard':before,'afterGuard':after,'DGateModuleSha256':sha(gatePath.read_bytes()),'DLineageRecordsCompatibilityPassed':True,'paths':{p.name:{'path':str(p),'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size}for p in sorted(common.glob('*.json'))}}
 dump(root/'freeze-issuance.json',manifest);print(json.dumps(manifest,ensure_ascii=False),flush=True)
finally:fcntl.flock(lock,fcntl.LOCK_UN)

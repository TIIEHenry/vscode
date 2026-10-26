import pathlib,subprocess,json,hashlib,datetime,os,re,fcntl,sys
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(repo)
base=pathlib.Path('/tmp/vscode-m01-eighth-native-build')
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
assert os.statvfs(repo).f_bavail*os.statvfs(repo).f_frsize>1024**3
contractPath=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/e-response-after-m01-20261027-r2/final-freeze-contract.json');assert sha(contractPath.read_bytes())=='5a3d7eb82cce25f0f5b9bbe1325c71817b14e2481eab14d9c5f1bfe45149c138';contract=json.loads(contractPath.read_text());assert contract['m01CandidateCommit']=='468d805ef929298de9113f72665a3de0bdf4742a' and contract['expectedNativeCompileOrdinal']==8 and contract['m01ExpectedFocusedTestCount']==39
cacheRelocation=None
if (repo/'.build/extensions').is_symlink():
 cacheRelocation=json.loads(pathlib.Path('/tmp/vscode-m01-fifth-cache-relocation.json').read_text());assert cacheRelocation['phase']=='owned-ignored-caches-relocated' and cacheRelocation['native155Unchanged']
 for item in cacheRelocation['directories']:
  p=pathlib.Path(item['sourceDirectory']);assert p.is_symlink() and str(p.resolve())==item['destinationDirectory'] and item['copyInventoryExact']
head=git('rev-parse','HEAD');sourceTree=git('rev-parse','HEAD:src');assert head==sys.argv[1];peer=json.loads(pathlib.Path('/tmp/vscode-m01-eighth-code-peer-approved.json').read_text());assert peer['mergedSourceTree']==sourceTree and peer['critical']==0 and peer['important']==0;assert git('status','--porcelain')==''
ancestors=set();pid=os.getpid()
while pid>0:
 ancestors.add(pid)
 try:pid=int(pathlib.Path('/proc/'+str(pid)+'/stat').read_text().split()[3])
 except (FileNotFoundError,ValueError):break
patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit']
def scan():
 raw=subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True);matches=[]
 for line in raw.splitlines()[1:]:
  fields=line.strip().split(None,3)
  if len(fields)==4 and int(fields[0]) not in ancestors and any(p in fields[3] for p in patterns):matches.append(line)
 return raw,matches
raw,matches=scan();base.with_suffix('.processes-before.log').write_text(raw)
record={'phase':'before-native-full-compile','sourceHead':head,'sourceTree':sourceTree,'startedAtUtc':now(),'globalProcessScanBeforeLock':matches,'command':['rtk','proxy','npm','run','compile-client'],'lockPath':'/tmp/vscode-compile.lock','outFrozen':False,'homeAvailableBefore':os.statvfs(repo).f_bavail*os.statvfs(repo).f_frsize,'generatedCacheRestored':cacheRelocation is None,'generatedCacheRelocationRecord':'/tmp/vscode-m01-fifth-cache-relocation.json' if cacheRelocation else None,'rootFilesystemWipNotConsumed':True,'rootOutNotWritten':True,'outputs':[]}
def save():base.with_suffix('.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
if matches:record['phase']='waiting-for-existing-global-lane';save();print(json.dumps({'waitingOn':matches}),flush=True);raise SystemExit(2)
lock=open('/tmp/vscode-compile.lock','a+')
try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
except BlockingIOError:record['phase']='waiting-for-shared-lock';save();print(record['phase'],flush=True);raise SystemExit(2)
raw,matches=scan();record['globalProcessScanUnderLock']=matches;base.with_suffix('.processes-under-lock.log').write_text(raw)
if matches:record['phase']='waiting-for-existing-global-lane';save();print(json.dumps({'waitingOn':matches}),flush=True);raise SystemExit(2)
paths={x['outputPath']for x in json.loads(pathlib.Path('dev/progress/default-editor-contract-audit-2026-10-26-evidence/main-180fc-compile.json').read_text())['outputs']}
for p in git('diff','--name-only','ad80c9fe1cfaaa250ea0eac9e05de6d780f984c2',head,'--','src').splitlines():
 if (p.endswith('.ts') and not p.endswith('.d.ts')) or p.endswith('.css'):paths.add('out/'+p[4:-3]+'.js' if p.endswith('.ts') else 'out/'+p[4:])
eTemplate=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/e-response-after-m01-20261027-r2/e-final-freeze.template.json');assert sha(eTemplate.read_bytes())=='30bd9ba9251876e72894c8b4085bf2732507ede0503e34a4c923599d11170823';freeze=json.loads(eTemplate.read_text());paths.update(x['path']for x in freeze['outputs'])
jTemplate=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1387-m01-after-20261027-r2/fresh-notice.template.json');assert sha(jTemplate.read_bytes())=='f6e5132351ae58608437614377b1819c6d3582bfd475f84b8718914e8c066a24';jfreeze=json.loads(jTemplate.read_text());paths.update(x['path']for x in jfreeze['outputs'])
record['newR2Templates']={'J':str(jTemplate),'E':str(eTemplate),'sameSuperset53':len(jfreeze['outputs'])==len(freeze['outputs'])==53}
required=json.loads(pathlib.Path('/tmp/vscode-main-d91-required-tests.json').read_text())
for p in required['nodeChangedTests']+required['additionalTests']:paths.add('out/'+p[4:-3]+'.js')
extraSources=['src/vs/workbench/contrib/conversation/browser/'+x for x in ['conversationEngineQueueReader.ts','conversationMessageQueueModel.ts','conversationInboxOverlay.ts','conversationTimelineRenderer.ts','conversationConfirmationSeat.ts','conversationQuestionSeat.ts','conversationLensProjection.ts','conversationLensReadingColumn.ts','engineSkillsSection.ts','media/conversationLens.css']]+['src/vs/platform/universeAgent/common/'+x for x in ['conversationResponseState.ts','universeAgentCapabilities.ts','universeAgentRendererSync.ts','universeAgentConnectionIpcChannel.ts']]+['src/vs/platform/universeAgent/node/grpcCapabilityProbe.ts']+['src/vs/platform/universeAgent/node/grpc/'+x for x in ['grpcClient.ts','grpcProtoCodec.ts','grpcQueueSkillWire.ts','grpcTransport.ts']]
for p in extraSources:paths.add('out/'+p[4:-3]+'.js' if p.endswith('.ts') else 'out/'+p[4:])
record['peerApproval']=peer;record['fixedExternalBaseline']=required['ref'];record['nodeChangedTestCount']=len(required['nodeChangedTests'])
assert git('rev-parse',peer['candidate']+':src')==sourceTree and peer['codePeerActuallyRead'] and peer['oldLifecycleBusinessRed'] and peer['all163Compile7FinallyRestored'] and peer['selectedFourHarnessContinuityVerified']
record['latestDContract']={'path':str(contractPath),'sha256':sha(contractPath.read_bytes()),'expectedOrdinal':8};record['compileOrdinal']=8;record['priorNativeCompileRecord']='/tmp/vscode-m01-seventh-native-build.json'
for p in ['src/vs/workbench/contrib/sources/browser/sourcesDiffRefHelpers.ts','src/vs/workbench/contrib/sources/test/browser/sourcesDiffMoveSource.test.ts','src/vs/workbench/contrib/sources/test/node/sourcesWiringScan.test.ts']:paths.add('out/'+p[4:-3]+'.js')
e11Extra=json.loads(pathlib.Path('/tmp/vscode-m01-sixth-E-related-full.json').read_text())['additionalTestOutputsOutside156Scope'];assert len(e11Extra)==7;paths.update(x['outputPath']for x in e11Extra);assert len(paths)==163;record['previous156PlusE11Extra7Scope']=True
for output in sorted(paths):
 source='src/'+output[4:];source=source[:-3]+'.ts' if source.endswith('.js') else source;sourceBytes=subprocess.check_output(['git','show',head+':'+source]);assert pathlib.Path(source).read_bytes()==sourceBytes;dest=pathlib.Path(output);record['outputs'].append({'sourcePath':source,'sourceSha256':sha(sourceBytes),'outputPath':output,'beforeOutputSha256':sha(dest.read_bytes())if dest.exists()else None})
save();print(json.dumps({'sourceHead':head,'sourceTree':sourceTree,'globalLaneMatches':0,'lockAcquired':True,'outputIdentityScope':len(paths),'command':record['command']}),flush=True)
with base.with_suffix('.log').open('wb')as log:result=subprocess.run(record['command'],stdout=log,stderr=subprocess.STDOUT)
record['exitCode']=result.returncode;record['finishedAtUtc']=now();log=base.with_suffix('.log').read_text(errors='replace');plain=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',log);record['diagnosticLines']=[l for l in plain.splitlines()if re.search(r'error TS[0-9]+|\([0-9]+,[0-9]+\):|ERROR in',l)]
for item in record['outputs']:
 dest=pathlib.Path(item['outputPath']);item['afterOutputSha256']=sha(dest.read_bytes())if dest.exists()else None;item['outputChanged']=item['beforeOutputSha256']!=item['afterOutputSha256']
record['sourceHeadUnchanged']=git('rev-parse','HEAD')==head;record['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==sourceTree;record['worktreeCleanAfterCompile']=git('status','--porcelain')=='';record['phase']='native-full-compile-finished';save();print(json.dumps({k:record[k]for k in ['exitCode','sourceHeadUnchanged','sourceTreeUnchanged','worktreeCleanAfterCompile','diagnosticLines']}),flush=True)
print(plain[-7000:],flush=True)
fcntl.flock(lock,fcntl.LOCK_UN)
raise SystemExit(result.returncode)

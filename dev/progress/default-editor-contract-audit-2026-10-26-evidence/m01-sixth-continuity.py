import pathlib,json,hashlib,subprocess,fcntl,os,datetime
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(repo);e=repo/'dev/progress/default-editor-contract-audit-2026-10-26-evidence';prefix=pathlib.Path('/tmp/vscode-m01-sixth-continuity');sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest();git=lambda *a:subprocess.check_output(['git',*a],text=True).strip()
new=json.loads(pathlib.Path('/tmp/vscode-m01-sixth-native-build.json').read_text());old=json.loads((e/'je-formal-fourth-native-build.json').read_text());assert new['exitCode']==0 and new['diagnosticLines']==[] and old['exitCode']==0
anc=set();pid=os.getpid()
while pid>0:
 anc.add(pid)
 try:pid=int(pathlib.Path('/proc',str(pid),'stat').read_text().split()[3])
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
for x in new['outputs']:assert sha(x['sourcePath'])==x['sourceSha256']and sha(x['outputPath'])==x['afterOutputSha256'],x['sourcePath']
oldBySource={x['sourcePath']:x for x in old['outputs']};newBySource={x['sourcePath']:x for x in new['outputs']}
changed=git('diff','--name-only',old['sourceHead'],new['sourceHead'],'--','src').splitlines();assert len(changed)==6 and all(p.startswith('src/vs/workbench/contrib/sources/')for p in changed),changed
def rows(paths):
 result=[]
 for p in paths:
  o=oldBySource[p];n=newBySource[p];assert o['sourceSha256']==n['sourceSha256']and o['afterOutputSha256']==n['afterOutputSha256'],p
  result.append({'sourcePath':p,'sourceSha256':n['sourceSha256'],'outputPath':n['outputPath'],'outputSha256':n['afterOutputSha256'],'actualCurrentSourceAndNativeMatchBothCompileRecords':True})
 return result
nodeRun=json.loads((e/'je-fourth-d91-node-full.json').read_text());assert nodeRun['exitCode']==0 and any('880 passing'in s for s in nodeRun['mochaSummaries']);nodeTests=nodeRun['testFiles'];assert len(nodeTests)==61
nodeRows=rows(nodeTests);productionPaths=[p for p in oldBySource if '/test/'not in p and (p.startswith('src/vs/platform/universeAgent/')or p.startswith('src/vs/workbench/contrib/conversation/'))];productionRows=rows(productionPaths)
subtrees=[]
for p in ['src/vs/platform/universeAgent','src/vs/workbench/contrib/conversation']:
 a=git('rev-parse',old['sourceHead']+':'+p);b=git('rev-parse',new['sourceHead']+':'+p);assert a==b;subtrees.append({'path':p,'oldAndNewGitTree':a})
eRun=json.loads((e/'je-fourth-E-related-full.json').read_text());assert eRun['exitCode']==1 and any('255 passing'in s for s in eRun['mochaSummaries'])and any('1 failing'in s for s in eRun['mochaSummaries']);eMissing=[p for p in eRun['testFiles']if p not in oldBySource];eRows=rows([p for p in eRun['testFiles']if p in oldBySource]);assert eMissing, 'expected explicit old-manifest scope gap; full E11 is separately rerun'
externalRun=json.loads((e/'je-fourth-d91-browser-full.json').read_text());assert externalRun['exitCode']==0 and any('133 passing'in s for s in externalRun['mochaSummaries']);externalRows=rows(externalRun['testFiles'])
allOld=[{'sourcePath':p,'sourceUnchanged':o['sourceSha256']==newBySource[p]['sourceSha256'],'nativeUnchanged':o['afterOutputSha256']==newBySource[p]['afterOutputSha256']}for p,o in oldBySource.items()];unchanged=[x for x in allOld if x['sourceUnchanged']and x['nativeUnchanged']];assert len(unchanged)==150
record={'phase':'compile6-exact-unchanged-Node880-and-external-browser-continuity-not-reruns','checkedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHead':new['sourceHead'],'sourceTree':new['sourceTree'],'nativeCompileOrdinal':6,'nativeCompileExit':0,'globalLaneMatches':matches,'sharedLockHeld':True,'all156ActualSourceNativeMatchCompile6':True,'onlyChangedSourcesSinceFourth':changed,'unchangedSubtreeIdentities':subtrees,'actualPriorNodeRun':{'repositoryRecord':str((e/'je-fourth-d91-node-full.json').relative_to(repo)),'sha256':sha(e/'je-fourth-d91-node-full.json'),'exitCode':0,'mochaSummaries':nodeRun['mochaSummaries'],'rerunInSixth':False},'nodeTestCount':61,'nodeRows':nodeRows,'unchangedProductionCount':len(productionRows),'unchangedProductionRows':productionRows,'actualPriorE11Related':{'repositoryRecord':str((e/'je-fourth-E-related-full.json').relative_to(repo)),'sha256':sha(e/'je-fourth-E-related-full.json'),'exitCode':1,'mochaSummaries':eRun['mochaSummaries'],'full11NativeContinuityClaimed':False,'reason':'initial helper refused missing old manifest identity; actual E-related11 sixth rerun is recorded separately','existingRedPreserved':'reasoning actual THINKING vs expected hmm\nthen this'},'e11InOldManifestRowsOnly':eRows,'e11MissingOldNativeIdentity':eMissing,'actualPriorExternalBrowser':{'repositoryRecord':str((e/'je-fourth-d91-browser-full.json').relative_to(repo)),'sha256':sha(e/'je-fourth-d91-browser-full.json'),'exitCode':0,'mochaSummaries':externalRun['mochaSummaries'],'rerunInSixth':False},'externalBrowserRows':externalRows,'old154Comparison':allOld,'old154ExactUnchangedCount':150,'scopeLimit':'Only exact source/native continuity reuses Node880 and external-browser133 recorded prior runs. New M01 focus24/2 and complete11 J410/2 remain actual sixth-run failures. E11 is not reused as full native continuity because its old manifest omits test outputs: it is separately rerun. E44 and Roster190 were actually rerun separately in sixth.'}
prefix.with_suffix('.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:record[k]for k in ['all156ActualSourceNativeMatchCompile6','nodeTestCount','unchangedProductionCount','old154ExactUnchangedCount','scopeLimit']},ensure_ascii=False));fcntl.flock(lock,fcntl.LOCK_UN)

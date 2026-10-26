import pathlib,subprocess,json,hashlib,datetime,os,re,fcntl,sys
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(repo)
mode=sys.argv[1];prefix='/tmp/vscode-je-formal-'+mode
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
native=json.loads(pathlib.Path('/tmp/vscode-je-formal-second-native-build.json').read_text());assert git('rev-parse','HEAD:src')==native['sourceTree']
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
  if len(fields)==4 and int(fields[0])not in ancestors and any(p in fields[3]for p in patterns):matches.append(line)
 return raw,matches
raw,matches=scan();pathlib.Path(prefix+'-processes.log').write_text(raw);assert not matches,matches
lock=open('/tmp/vscode-compile.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);raw,matches=scan();assert not matches,matches
for item in native['outputs']:
 assert pathlib.Path(item['outputPath']).exists(),item['outputPath'];assert sha(item['outputPath'])==item['afterOutputSha256'],item['outputPath'];assert sha(item['sourcePath'])==item['sourceSha256'],item['sourcePath'];assert (pathlib.Path(item['outputPath']).stat().st_mtime>=datetime.datetime.fromisoformat(native['startedAtUtc']).timestamp() if item['outputPath'].endswith('.js') else sha(item['outputPath'])==sha(item['sourcePath'])),item['outputPath']
sourcePrefix='src/vs/workbench/'
j=[sourcePrefix+x for x in ['contrib/sources/test/browser/sourcesChangesList.test.ts','contrib/sources/test/browser/sourcesReviewList.test.ts','contrib/sources/test/browser/sourcesDiffRefHelpers.test.ts','contrib/sources/test/browser/sourcesDiffPanel.test.ts','contrib/sources/test/browser/sourcesGitDiffContent.test.ts','contrib/sources/test/browser/sourcesReviewCommands.test.ts','contrib/sources/test/browser/sourcesReviewShowForPaths.test.ts','contrib/conversation/test/browser/conversationEditorFence.test.ts','services/editor/test/common/editorOpenSlot.test.ts','services/editor/test/browser/editorService.test.ts']]
ebase=sourcePrefix+'contrib/conversation/test/browser/'
related=[ebase+x+'.test.ts'for x in ['conversationEngineFrameSource','conversationResponseState','conversationSessionView','conversationTimelineProjection','conversationTimelineRenderer','conversationTimelineHost','conversationQuestionSeat','conversationProcessFold','conversationProcessFoldToolDetails','conversationStreamToDom','conversationStreamScripts']]
roster=ebase+'conversationEngineRosterService.test.ts'
groups=[('J-focused',[j[0]],'delegated host|Sources overlap'),('E-focused',[roster],'response recovery')]if mode=='focused'else [('J-full',j,None),('E-roster-full',[roster],None),('E-related-full',related,None)]
if mode=='remaining':groups=[('E-'+pathlib.Path(file).stem,[file],None)for file in related[1:]]
for label,files,grep in groups:
 command=['rtk','proxy','timeout','--foreground','-k','15s','240s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000']
 for file in files:command+=['--run',file]
 if grep:command+=['--grep',grep]
 out=pathlib.Path('/tmp/vscode-je-formal-'+label);record={'label':label,'sourceHead':git('rev-parse','HEAD'),'sourceTree':git('rev-parse','HEAD:src'),'nativeCompileHead':native['sourceHead'],'nativeCompileExit':native['exitCode'],'nativeSourceOutputIdentityScope':len(native['outputs']),'nativeOutputsAllExistAndUnchanged':True,'nativeJavaScriptAllWrittenAfterCompileStart':True,'nativeCopiedCssExactSourceBytes':True,'sourceHashesAllMatchCompiledRecord':True,'startedAtUtc':now(),'command':command,'env':{'VSCODE_SKIP_PRELAUNCH':'1'},'sharedLockHeld':True,'globalLaneMatches':matches,'outFrozen':False}
 print(json.dumps({'running':label,'nativeCompileExit':native['exitCode'],'sourceTree':record['sourceTree']}),flush=True)
 with out.with_suffix('.log').open('wb')as log:result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'VSCODE_SKIP_PRELAUNCH':'1'})
 record['exitCode']=result.returncode;record['finishedAtUtc']=now();plain=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',out.with_suffix('.log').read_text(errors='replace'));record['mochaSummaries']=re.findall(r'^.*\b[0-9]+ (?:passing|failing|pending).*$',plain,re.M);record['outputsUnchangedAfterRun']=all(sha(x['outputPath'])==x['afterOutputSha256']for x in native['outputs']);record['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==native['sourceTree'];out.with_suffix('.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:record[k]for k in ['label','exitCode','mochaSummaries','outputsUnchangedAfterRun','sourceTreeUnchanged']}),flush=True);print(plain[-6500:],flush=True)
fcntl.flock(lock,fcntl.LOCK_UN)

import pathlib,subprocess,json,hashlib,datetime,os,re,fcntl,sys
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(repo);mode=sys.argv[1];base=pathlib.Path('/tmp/vscode-je-formal-old5df-'+mode);old='5df17cb7273f490ccd59818dccba479fa80848dc';native=json.loads(pathlib.Path('/tmp/vscode-je-formal-second-native-build.json').read_text());head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();src=subprocess.check_output(['git','rev-parse','HEAD:src'],text=True).strip();sha=lambda b:hashlib.sha256(b).hexdigest();now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
anc=set();pid=os.getpid()
while pid>0:
 anc.add(pid)
 try:pid=int(pathlib.Path('/proc/'+str(pid)+'/stat').read_text().split()[3])
 except (FileNotFoundError,ValueError):break
patterns=['compile-client','typecheck-client','transpile-client','gulp.js','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit']
def scan():
 matches=[]
 for line in subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True).splitlines()[1:]:
  f=line.strip().split(None,3)
  if len(f)==4 and int(f[0])not in anc and any(x in f[3]for x in patterns):matches.append(line)
 return matches
assert not scan(),scan();lock=open('/tmp/vscode-compile.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);assert not scan(),scan()
for x in native['outputs']:assert sha(pathlib.Path(x['outputPath']).read_bytes())==x['afterOutputSha256'],x['outputPath']
f='src/vs/workbench/contrib/conversation/test/browser/';prod='src/vs/workbench/contrib/conversation/browser/'
if mode=='frame':
 paths=[prod+'conversationEngineFrameSource.ts',f+'conversationEngineFrameSource.test.ts','src/vs/platform/universeAgent/common/conversationViewFrame.ts'];groups=[('resync',f+'conversationEngineFrameSource.test.ts','requestResync reject does not leave'),('ack',f+'conversationEngineFrameSource.test.ts','acknowledge reject.*onUnexpectedError warn-then-rethrows')]
else:
 paths=[x for x in subprocess.check_output(['git','diff','--name-only',old,head,'--','src/vs/workbench/contrib/conversation','src/vs/platform/universeAgent/common/conversationViewFrame.ts','src/vs/platform/universeAgent/common/conversationResponseState.ts'],text=True).splitlines()if x.endswith('.ts')and '/test/'not in x]
 tests=['conversationTimelineProjection','conversationTimelineRenderer','conversationStreamScripts'];paths +=[f+x+'.test.ts'for x in tests];groups=[(x,f+x+'.test.ts',None)for x in tests]
record={'phase':'exact-old5df-isolated-'+mode,'sourceHead':head,'sourceTree':src,'producerRef':old,'producerSourceTree':subprocess.check_output(['git','rev-parse',old+':src'],text=True).strip(),'startedAtUtc':now(),'sharedLockHeldAcrossTranspileTestRestore':True,'globalLaneMatches':[],'nativeCompileExit':native['exitCode'],'nativeCompileSourceHead':native['sourceHead'],'nativeCompileSourceTree':native['sourceTree'],'currentHeadNativelyCompiled':src==native['sourceTree'],'currentFilesystemSourceNotConsumed':True,'nativeIdentityScope':len(native['outputs']),'outFrozen':False,'modules':[],'runs':[]}
transform="import {transform}from'esbuild';let text='';for await(const c of process.stdin){text+=c;}const r=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:false,sourcefile:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}}});process.stdout.write(r.code.replaceAll('.ts?esm','.js?esm'));"
backups=[]
try:
 for sourcePath in paths:
  result=subprocess.run(['git','show',old+':'+sourcePath],stdout=subprocess.PIPE,stderr=subprocess.PIPE);source=result.stdout if result.returncode==0 else None;output=pathlib.Path('out/'+sourcePath[4:-3]+'.js');before=output.read_bytes()if output.exists()else None;backups.append((output,before));item={'sourcePath':sourcePath,'sourceRef':old,'sourceSha256':sha(source)if source is not None else None,'outputPath':str(output),'beforeSha256':sha(before)if before is not None else None,'sourceAbsentAtOldRef':source is None};record['modules'].append(item)
  if source is None:
   if output.exists():output.unlink()
   item['installedSha256']=None
  else:
   code=subprocess.check_output(['node','--input-type=module','-e',transform,sourcePath],input=source);output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(code);item['installedSha256']=sha(code)
 for label,test,grep in groups:
  command=['rtk','proxy','timeout','--foreground','-k','15s','240s','xvfb-run','-a','./scripts/test.sh','--no-sandbox','--disable-gpu','--timeout','15000','--run',test]
  if grep:command+=['--grep',grep]
  log=pathlib.Path(str(base)+'-'+label+'.log');print(json.dumps({'runningOld5df':label,'modules':len(paths)}),flush=True)
  with log.open('wb')as out:result=subprocess.run(command,stdout=out,stderr=subprocess.STDOUT,env={**os.environ,'VSCODE_SKIP_PRELAUNCH':'1'})
  text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',log.read_text(errors='replace'));run={'label':label,'command':command,'exitCode':result.returncode,'mochaSummaries':re.findall(r'^.*\b[0-9]+ (?:passing|failing|pending).*$',text,re.M),'logPath':str(log),'logSha256':sha(log.read_bytes())};record['runs'].append(run);print(json.dumps(run),flush=True);print(text[-4500:],flush=True)
finally:
 for (output,before),item in zip(backups,record['modules']):
  if before is None:
   if output.exists():output.unlink()
  else:output.write_bytes(before)
  item['restoredSha256']=sha(output.read_bytes())if output.exists()else None;assert item['restoredSha256']==item['beforeSha256']
 record['allTouchedOutputsRestored']=True;record['all86NativeOutputHashesRestored']=all(sha(pathlib.Path(x['outputPath']).read_bytes())==x['afterOutputSha256']for x in native['outputs']);record['sourceHeadUnchanged']=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==head;record['sourceTreeUnchanged']=subprocess.check_output(['git','rev-parse','HEAD:src'],text=True).strip()==src;record['finishedAtUtc']=now();base.with_suffix('.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');assert record['all86NativeOutputHashesRestored'];fcntl.flock(lock,fcntl.LOCK_UN)

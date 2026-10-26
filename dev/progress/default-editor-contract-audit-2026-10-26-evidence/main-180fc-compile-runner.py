import pathlib,subprocess,json,hashlib,datetime,os,re
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
os.chdir(repo)
def git(*a):return subprocess.check_output(['git',*a],text=True).strip()
assert git('status','--porcelain')==''
head=git('rev-parse','HEAD');sourceTree=git('rev-parse','HEAD:src')
assert head=='ad80c9fe1cfaaa250ea0eac9e05de6d780f984c2'
assert sourceTree=='030defda3cc7cfac7148e84fac470a3bf5098d06'
patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit']
processes=[]
for line in subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True).splitlines():
 if any(p in line for p in patterns) and 'python3 -' not in line and '/bin/bash -c' not in line:
  processes.append(line)
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
logBase=pathlib.Path('/tmp/vscode-main-180fc-compile')
record={'phase':'native-compile-client-current-main-baseline','sourceHead':head,'sourceTree':sourceTree,'startedAtUtc':started,'globalProcessScan':processes,'oldVirtualPackRef':'65d2288036fdad74ab607e231d3db758fa397aa8','oldVirtualPackEligibleAsLive':False,'outFrozen':False,'rootFilesystemWipNotConsumed':True,'rootOutNotWritten':True,'command':['rtk','proxy','npm','run','compile-client'],'outputs':[]}
if processes:
 record['phase']='waiting-for-existing-global-lane'
 logBase.with_suffix('.json').write_text(json.dumps(record,indent=2)+'\n')
 print(json.dumps({'waitingOn':processes}),flush=True)
 raise SystemExit(2)
old=json.loads(pathlib.Path('dev/progress/default-editor-contract-audit-2026-10-26-evidence/d1387-65d-preintegration-state.json').read_text())
paths={m['path'] for m in old['outputs']}
paths.update('out/'+p[4:] for p in git('diff','--name-only','3d522e76b9985181fa4bdfc654d52c9951f87aed','180fcdbb4ec9fda12a15c3daa6fa48a5e4e742c1','--','src').splitlines())
sha=lambda b:hashlib.sha256(b).hexdigest()
for output in sorted(paths):
 source='src/'+output[4:]
 if source.endswith('.js'):source=source[:-3]+'.ts'
 sourceBytes=subprocess.check_output(['git','show',head+':'+source])
 dest=pathlib.Path(output)
 record['outputs'].append({'sourcePath':source,'sourceSha256':sha(sourceBytes),'outputPath':output,'beforeOutputSha256':sha(dest.read_bytes()) if dest.exists() else None})
logBase.with_suffix('.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'sourceHead':head,'sourceTree':sourceTree,'globalLaneMatches':0,'command':record['command'],'outputIdentityScope':len(paths),'old65dPackNowIneligible':True}),flush=True)
with logBase.with_suffix('.log').open('w') as log:
 result=subprocess.run(record['command'],stdout=log,stderr=subprocess.STDOUT)
record['exitCode']=result.returncode
record['finishedAtUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for module in record['outputs']:
 p=pathlib.Path(module['outputPath']);module['afterOutputSha256']=sha(p.read_bytes()) if p.exists() else None
 module['outputChanged']=module['beforeOutputSha256']!=module['afterOutputSha256']
record['sourceHeadUnchanged']=git('rev-parse','HEAD')==head
record['sourceTreeUnchanged']=git('rev-parse','HEAD:src')==sourceTree
record['worktreeCleanAfterCompile']=git('status','--porcelain')==''
record['phase']='native-compile-client-finished'
logBase.with_suffix('.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'exitCode':result.returncode,'outputsChanged':sum(x['outputChanged'] for x in record['outputs']),'sourceHeadUnchanged':record['sourceHeadUnchanged'],'sourceTreeUnchanged':record['sourceTreeUnchanged'],'worktreeCleanAfterCompile':record['worktreeCleanAfterCompile']}),flush=True)

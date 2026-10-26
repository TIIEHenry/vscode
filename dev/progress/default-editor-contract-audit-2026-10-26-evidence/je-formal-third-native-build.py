import pathlib,subprocess,json,hashlib,datetime,os,re,fcntl
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(repo)
base=pathlib.Path('/tmp/vscode-je-formal-third-native-build')
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
assert os.statvfs(repo).f_bavail*os.statvfs(repo).f_frsize>1024**3
assert not (repo/'.build/extensions').is_symlink()
head=git('rev-parse','HEAD');sourceTree=git('rev-parse','HEAD:src');assert head=='08b1272fc3cb7ad2fdc256be60262818b92f4a20' and sourceTree=='f19df7bd512b99d0485355c84708498781e37e56';assert git('status','--porcelain')==''
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
record={'phase':'before-native-full-compile','sourceHead':head,'sourceTree':sourceTree,'startedAtUtc':now(),'globalProcessScanBeforeLock':matches,'command':['rtk','proxy','npm','run','compile-client'],'lockPath':'/tmp/vscode-compile.lock','outFrozen':False,'homeAvailableBefore':os.statvfs(repo).f_bavail*os.statvfs(repo).f_frsize,'generatedCacheRestored':True,'rootFilesystemWipNotConsumed':True,'rootOutNotWritten':True,'outputs':[]}
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
freeze=json.loads(pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/e-response-after-preparation-20261027/e-final-freeze.template.json').read_text());paths.update(x['path']for x in freeze['outputs'])
jfreeze=json.loads(pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1387-after-sources-audit-20261026/fresh-notice.template.json').read_text());paths.update(x['path']for x in jfreeze['outputs'])
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

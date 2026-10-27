from pathlib import Path
import os, sys, json, hashlib, stat, subprocess, datetime, fcntl
REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge'); os.chdir(REPO)
BASE='c7fefd780bd9720f3889e310d4706210189a3fc7'
INCOMING='5c0916b71070c5f75742fcbd831cd8c31be0bd34'
DRAFT='4b0d3d62e65e54e71d3b1748f100fac7ca5f6ce3'
SRC='a2c34649ee88df907c03b70c9ec3235cb1b4a9d9'
PFX=Path('/tmp/vscode-sources-accept-plan-integration')
FREEZE=Path('.build/sources-e-gate-after-20261027-r3-baseline-freeze-v4/common')
sha=lambda b:hashlib.sha256(b).hexdigest()
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def git(*args):return subprocess.check_output(['rtk','proxy','git',*args])
def gs(*args):return git(*args).decode().strip()
def meta(p):
 s=p.lstat(); return {'type':stat.S_IFMT(s.st_mode),'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'size':s.st_size,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}
def outmeta():
 rows={'out':meta(Path('out'))}
 for root,dirs,files in os.walk('out'):
  for name in sorted(dirs+files):
   p=Path(root)/name; rows[str(p)]=meta(p)
 return dict(sorted(rows.items()))
def snapshot():
 f=json.loads((FREEZE/'full-freeze.json').read_text()); pairs=[]
 for r in f['outputs']:
  p=Path(r['sourcePath']); o=Path(r['path']); b=p.read_bytes()
  assert sha(b)==r['sourceSha256'] and stat.S_IMODE(p.stat().st_mode)==r['sourceMode']
  assert gs('rev-parse','HEAD:'+str(p))==r['sourceBlob'] and b==git('show',BASE+':'+str(p))
  assert sha(o.read_bytes())==r['sha256'] and stat.S_IMODE(o.stat().st_mode)==r['nativeMode']
  pairs.append(r)
 assert len(pairs)==254
 extras=[]
 for source in ['src/vs/workbench/contrib/sources/common/sourcesDiffWriteController.ts','src/vs/workbench/contrib/sources/test/browser/conversationDiffReviewPane.test.ts']:
  p=Path(source); o=Path('out/'+source[4:-3]+'.js'); b=p.read_bytes(); assert b==git('show',BASE+':'+source)
  extras.append({'sourcePath':source,'sourceBlob':gs('rev-parse',BASE+':'+source),'sourceSha256':sha(b),'sourceMode':stat.S_IMODE(p.stat().st_mode),'path':str(o),'nativeSha256':sha(o.read_bytes()),'nativeMode':stat.S_IMODE(o.stat().st_mode),'producerQualificationClaim':False})
 expected={'freeze-J.json':'be2d4813c8c66480e51684eb0ff4a3f701848408b21c4abe0e8399d02bd5f3ea','freeze-E.json':'729780e2a9bef0968f9f5cb001624cbc0d25e4a2bd23e6abd2096265ff70ac6a','full-freeze.json':'425cbea3d505fecd61574e207e5374b7a5552ccf6cc9c208c505feb19afb17d0','lane-provenance.json':'0593fd9e6a665757be755d9a9d8c71ed5e8a3cde7104b5c89951f9a76dd730f1'}
 freezes={}
 for name,h in expected.items():
  p=FREEZE/name; b=p.read_bytes(); assert sha(b)==h; freezes[str(p)]={'sha256':h,'metadata':meta(p)}
 caches={}
 for name,target in {'.build/extensions':'/tmp/vscode-m01-fifth-extensions-m61of5_0/extensions','.build/electron':'/tmp/vscode-m01-fifth-electron-xrzlalwx/electron','node_modules/foundry-local-sdk':'/tmp/vscode-m01-fifth-foundry-local-sdk-d4_hburf/foundry-local-sdk'}.items():
  p=Path(name); assert p.is_symlink() and os.readlink(p)==target; caches[name]={'target':target,'resolved':str(p.resolve()),'metadata':meta(p)}
 return {'sourceTree':gs('rev-parse','HEAD:src'),'pairs254':pairs,'extra2PairsWithoutProducerCredit':extras,'outMetadata':outmeta(),'freezeFiles':freezes,'cacheSymlinks':caches}
def tree(ref):
 out={}
 for item in git('ls-tree','-rz','--full-tree',ref).split(b'\0'):
  if not item:continue
  info,path=item.split(b'\t',1); mode,kind,oid=info.decode().split();out[path.decode()]={'mode':mode,'type':kind,'oid':oid}
 return out
def scan():
 ancestors=set(); pid=os.getpid()
 while pid>0:
  ancestors.add(pid)
  try:pid=int(Path('/proc',str(pid),'stat').read_text().split()[3])
  except (FileNotFoundError,ValueError):break
 patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit']
 matches=[]
 for line in subprocess.check_output(['ps','-eo','pid,ppid,etime,args'],text=True).splitlines()[1:]:
  fields=line.strip().split(None,3)
  if len(fields)==4 and int(fields[0])not in ancestors and any(p in fields[3] for p in patterns):matches.append(line)
 assert not matches,matches
 return {'atUtc':now(),'patterns':patterns,'matches':matches}
def save(path,value):
 assert not path.exists();path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='merge':
  assert gs('rev-parse','HEAD')==BASE and not gs('status','--porcelain=v1')
  assert gs('merge-base',BASE,INCOMING)==BASE and gs('rev-parse',INCOMING+'^')==DRAFT
  assert gs('rev-parse',BASE+':src')==gs('rev-parse',INCOMING+':src')==SRC
  assert sha(git('show',INCOMING+':dev/plans/sources-accept-post-read-authorization.md'))=='5d5c2a72fcb9d555b15d0442d0c7d47ae9238998cea2eb25b4b7917af8362e61'
  bt=tree(BASE);it=tree(INCOMING);changed=sorted(p for p in set(bt)|set(it)if bt.get(p)!=it.get(p));assert len(changed)==8 and all(p.startswith('dev/')for p in changed)
  assert len(git('show',INCOMING+':dev/progress/status.md').splitlines())==200
  assert sha(git('show',INCOMING+':dev/progress/sources-accept-post-read-authorization-dispatch-checkpoint.json'))=='fbf75cdbb5d197a2863dd654afe71a7ce71d78fb62668787514d3c98fa0ce028'
  s0=scan();lock=open('/tmp/vscode-compile.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);s1=scan();before=snapshot()
  assert before['sourceTree']==SRC
  save(Path(str(PFX)+'-pre.json'),before)
  merge=subprocess.run(['rtk','proxy','git','merge','--no-ff','--no-edit','-m','docs: merge accepted Sources Accept authorization plan',INCOMING],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
  Path(str(PFX)+'-merge.log').write_bytes(merge.stdout)
  assert merge.returncode==0,merge.stdout.decode()
  head=gs('rev-parse','HEAD');parents=gs('show','-s','--format=%P','HEAD').split();assert parents==[BASE,INCOMING]
  mt=tree(head);assert mt==it
  after=snapshot();assert after==before and not gs('status','--porcelain=v1')
  diff=git('diff','--binary',BASE,INCOMING);actual=git('diff','--binary',BASE,head);assert diff==actual
  report={'scope':'accepted-plan-only integration; output remains frozen','capturedAtUtc':now(),'base':BASE,'draft':DRAFT,'incoming':INCOMING,'mergeCommit':head,'parents':parents,'mergeBase':BASE,'sourceTree':SRC,'changedUnionPaths':changed,'rows':[{'path':p,'classification':'incoming-only','base':bt.get(p),'ours':bt.get(p),'incoming':it.get(p),'merged':mt.get(p),'pass':mt.get(p)==it.get(p)}for p in changed],'allTrackedRows':len(mt),'unchangedOutsideUnionCount':len(set(bt)-set(changed)),'mergedTreeExactlyIncoming':True,'wholeTreeModeTypeBlobExact':True,'binaryHunkDeltaExactlyIncoming':True,'binaryHunkDeltaBytes':len(diff),'binaryHunkDeltaSha256':sha(diff),'hunkResolutions':[],'mergeCommandExitCode':merge.returncode,'mergeRawOutput':merge.stdout.decode(),'processScans':[s0,s1],'preGuard':before,'postMergeGuardExact':after==before,'outFileMetadataCount':sum(not stat.S_ISDIR(r['type'])for r in before['outMetadata'].values()),'outDirectoryMetadataCount':sum(stat.S_ISDIR(r['type'])for r in before['outMetadata'].values()),'fullCompileOfFinalSourceTree':False,'compilerOrTestsRun':False,'outputReleased':False,'scopeCompletionClaim':False}
  save(Path(str(PFX)+'-proof.json'),report);fcntl.flock(lock,fcntl.LOCK_UN)
  print(json.dumps({k:v for k,v in report.items()if k not in ['preGuard','rows','mergeRawOutput']},ensure_ascii=False))
 elif mode=='guard':
  baseline=Path(sys.argv[2]) if len(sys.argv)>2 else Path(str(PFX)+'-pre.json');old=json.loads(baseline.read_text());old=old.get('preGuard',old);new=snapshot();assert new==old
  print(json.dumps({'atUtc':now(),'head':gs('rev-parse','HEAD'),'sourceTree':new['sourceTree'],'all254AndExtra2PairsExact':True,'allOutFileAndDirectoryMetadataExact':True,'allFourFreezeFilesExact':True,'allThreeCacheSymlinksExact':True}))
 else:raise ValueError(mode)

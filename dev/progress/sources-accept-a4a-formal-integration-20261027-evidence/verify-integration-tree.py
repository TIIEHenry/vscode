from pathlib import Path
import os,sys,json,hashlib,stat,subprocess,datetime,re
REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(REPO)
ARTIFACTS=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def artifact(path):
 p=ARTIFACTS/path
 return p if p.exists()else Path(str(p)+'.raw')
def git(*a):return subprocess.check_output(['rtk','proxy','git',*a])
def gs(*a):return git(*a).decode().strip()
def tree(ref):
 rows={}
 for v in git('ls-tree','-rz','--full-tree',ref).split(b'\0'):
  if v:
   info,path=v.split(b'\t',1);mode,kind,oid=info.decode().split();rows[path.decode()]={'mode':mode,'type':kind,'oid':oid}
 return rows
def verify(ref,check_worktree_docs=False):
 m=json.loads((ARTIFACTS/'premerge-path-matrix.json').read_text());h=json.loads((ARTIFACTS/'hunk-resolutions.json').read_text());t=tree(ref);ot=tree(m['ours']);it=tree(m['incoming']);bt=tree(m['base']);union=set(m['unionPaths'])
 assert gs('merge-base',m['ours'],m['incoming'])==m['base']
 assert len(union)==226 and union=={p for p in set(bt)|set(ot)|set(it)if bt.get(p)!=ot.get(p)or bt.get(p)!=it.get(p)}
 assert not git('ls-files','-u')
 assert {p:v for p,v in t.items()if p not in union}=={p:v for p,v in ot.items()if p not in union}
 outside=len(set(ot)-union);assert outside==m['outsideUnionCount']==22236
 resolved={r['path']:r for r in h['resolutions']};rows=[]
 for r in m['rows']:
  p=r['path'];assert r['ours']==ot.get(p)and r['incoming']==it.get(p)and r['base']==bt.get(p)
  if p not in resolved:assert t.get(p)==r['expectedUncontested']
  rows.append({**r,'merged':t.get(p),'retention':'recorded-doc-conflict-resolution'if p in resolved else'exact-uncontested-mode-type-blob','pass':True})
 checks=[];block_count=0
 pattern=re.compile(br'^<<<<<<< ours\n(.*?)^\|\|\|\|\|\|\| base\n(.*?)^=======\n(.*?)^>>>>>>> incoming\n',re.M|re.S)
 for p,r in resolved.items():
  raw=artifact(Path('canonical-three-way')/p).read_bytes();assert sha(raw)==r['canonicalDiff3Sha256'];out=b'';pos=0;matches=list(pattern.finditer(raw));assert len(matches)==len(r['blocks'])
  for match,b in zip(matches,r['blocks']):
   outside_block=raw[pos:match.start()];assert len(outside_block)==b['precedingUncontestedBytes']and sha(outside_block)==b['precedingUncontestedSha256']
   for field,value in zip(['ours','base','incoming'],match.groups()):assert value==b[field].encode()
   replacement=b['resolution'].encode();assert sha(replacement)==b['resolutionSha256'];out+=outside_block+replacement;pos=match.end();block_count+=1
  tail=raw[pos:];assert len(tail)==r['trailingUncontestedBytes']and sha(tail)==r['trailingUncontestedSha256'];out+=tail
  assert sha(out)==r['resolvedSha256']and out==git('show',ref+':'+p)
  if check_worktree_docs:assert out==Path(p).read_bytes()
  checks.append({'path':p,'blocks':len(matches),'canonicalDiff3Sha256':sha(raw),'resolvedSha256':sha(out),'allOutsideFragmentsExact':True,'resolutionExactlyRecorded':True})
 assert block_count==4
 for r in m['threeWayInputArtifacts']:
  if 'label'not in r:continue
  b=artifact(Path('three-way-inputs')/r['label']/r['repositoryPath']).read_bytes();assert len(b)==r['bytes']and sha(b)==r['sha256']and b==git('show',r['sourceRef']+':'+r['repositoryPath'])
 status=git('show',ref+':dev/progress/status.md');assert len(status.splitlines())==200
 checkpoint=git('show',ref+':dev/progress/sources-accept-post-read-authorization-checkpoint.md')
 parents=json.loads((ARTIFACTS/'parent-status-first-entries.json').read_text())
 for r in parents:
  b=r['entryIncludingFinalNewline'].encode();assert b.endswith(b'\n')and sha(b)==r['utf8Sha256']and git('show',r['ref']+':'+r['path']).splitlines(keepends=True)[r['lineNumber']-1]==b and b in checkpoint
 source_paths=sorted(p for p in set(t)|set(ot)if p.startswith('src/')and t.get(p)!=ot.get(p));assert len(source_paths)==4
 for p in source_paths:assert t[p]==it[p]and Path(p).read_bytes()==git('show',m['incoming']+':'+p)
 assert gs('rev-parse',ref+':src')=='d78a48e5feee57fcaf5811c8425859d0a2400af0'
 for p in ['dev/plans/sources-accept-post-read-authorization.md','dev/progress/sources-accept-post-read-authorization-dispatch-checkpoint.json','dev/plans/sources-panel-diff-view-model-lifetime.md','dev/plans/sources-panel-fixture-preinjection-amendment.md']:
  assert t[p]==it[p]and Path(p).read_bytes()==git('show',m['incoming']+':'+p)
 delta=sorted(p for p in set(t)|set(ot)if t.get(p)!=ot.get(p));assert len(delta)==13
 return {'capturedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'qualifiedRef':ref,'qualifiedTree':gs('rev-parse',ref+'^{tree}'),'ours':m['ours'],'incoming':m['incoming'],'base':m['base'],'newSourceTree':gs('rev-parse',ref+':src'),'unionPathCount':226,'uncontestedPathCount':223,'outsideUnionUnchangedCount':outside,'allOutsideUnionModeTypeBlobExact':True,'deltaFromOurs':delta,'sourceDeltaFromOurs':source_paths,'conflictDocumentCount':3,'conflictBlockCount':4,'conflictChecks':checks,'worktreeResolvedDocsChecked':check_worktree_docs,'parentFirstStatusEntriesExactlyPreserved':True,'statusLineCount':200,'protectedPlansAndDispatchExact':True,'rows':rows,'sourceCheckerCompileEmitTestsOrOutWritesInvoked':False}
if __name__=='__main__':
 ref=sys.argv[1]if len(sys.argv)>1 else'HEAD';r=verify(ref,'--worktree-docs'in sys.argv)
 if len(sys.argv)>2:Path(sys.argv[2]).write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in r.items()if k!='rows'},ensure_ascii=False))

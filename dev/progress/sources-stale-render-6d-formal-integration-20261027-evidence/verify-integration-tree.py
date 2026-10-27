from pathlib import Path
import os,sys,json,hashlib,subprocess,datetime,re,difflib
REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(REPO);ARTIFACTS=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*a):return subprocess.check_output(['rtk','proxy','git',*a])
def gs(*a):return git(*a).decode().strip()
def tree(ref):
 rows={}
 for v in git('ls-tree','-rz','--full-tree',ref).split(b'\0'):
  if v:
   info,path=v.split(b'\t',1);mode,kind,oid=info.decode().split();rows[path.decode()]={'mode':mode,'type':kind,'oid':oid}
 return rows
def verify(ref,worktree_docs=False):
 m=json.loads((ARTIFACTS/'premerge-path-matrix.json').read_text());h=json.loads((ARTIFACTS/'hunk-resolutions.json').read_text());T={k:tree(m[k]) for k in ['ours','incoming','base']};t=tree(ref);union=set(m['unionPaths']);assert gs('merge-base',m['ours'],m['incoming'])==m['base'];assert len(union)==m['unionPathCount']==175
 assert union=={p for p in set().union(*(set(x) for x in T.values())) if T['base'].get(p)!=T['ours'].get(p) or T['base'].get(p)!=T['incoming'].get(p)}
 assert not git('ls-files','-u');assert {p:v for p,v in t.items() if p not in union}=={p:v for p,v in T['ours'].items() if p not in union};outside=len(set(T['ours'])-union);assert outside==m['outsideUnionCount']==22522
 resolved={r['path']:r for r in h['resolutions']};rows=[]
 for row in m['rows']:
  p=row['path'];assert all(row[k]==T[k].get(p) for k in ['ours','incoming','base'])
  if p not in resolved:assert t.get(p)==row['expectedUncontested'],p
  rows.append({**row,'merged':t.get(p),'retention':'recorded-doc-conflict-resolution' if p in resolved else 'exact-uncontested-mode-type-blob','pass':True})
 pat=re.compile(br'^<<<<<<< ours\n(.*?)^\|\|\|\|\|\|\| base\n(.*?)^=======\n(.*?)^>>>>>>> incoming\n',re.M|re.S);checks=[];count=0
 for p,row in resolved.items():
  raw=(ARTIFACTS/'canonical-three-way'/(p+'.raw')).read_bytes();assert sha(raw)==row['canonicalDiff3Sha256'];matches=list(pat.finditer(raw));assert len(matches)==len(row['blocks']);out=b'';pos=0
  for match,block in zip(matches,row['blocks']):
   fragment=raw[pos:match.start()];assert len(fragment)==block['precedingUncontestedBytes'] and sha(fragment)==block['precedingUncontestedSha256'];assert all(v==block[k].encode() for k,v in zip(['ours','base','incoming'],match.groups()));replacement=block['resolution'].encode();assert sha(replacement)==block['resolutionSha256'];out+=fragment+replacement;pos=match.end();count+=1
  tail=raw[pos:];assert len(tail)==row['trailingUncontestedBytes'] and sha(tail)==row['trailingUncontestedSha256'];out+=tail;assert sha(out)==row['resolvedSha256'] and out==git('show',ref+':'+p)
  if worktree_docs:assert out==Path(p).read_bytes()
  checks.append({'path':p,'blocks':len(matches),'canonicalSha256':sha(raw),'resolvedSha256':sha(out),'allOutsideFragmentsExact':True,'resolutionExactlyRecorded':True})
 assert len(checks)==4 and count==7
 for row in m['threeWayInputArtifacts']:
  data=(ARTIFACTS/row['artifactPath']).read_bytes();assert len(data)==row['bytes'] and sha(data)==row['sha256'] and data==git('show',row['sourceRef']+':'+row['repositoryPath'])
 parents=json.loads((ARTIFACTS/'parent-status-first-entries.json').read_text());checkpoint=git('show',ref+':dev/progress/sources-accept-post-read-authorization-checkpoint.md')
 for row in parents:
  data=row['entryIncludingFinalNewline'].encode();assert data.endswith(b'\n') and sha(data)==row['utf8Sha256'] and git('show',row['ref']+':'+row['path']).splitlines(keepends=True)[row['lineNumber']-1]==data and data in checkpoint
 for label in ['ours','incoming']:
  original=git('show',m[label]+':dev/progress/sources-accept-post-read-authorization-checkpoint.md');base=git('show',m['base']+':dev/progress/sources-accept-post-read-authorization-checkpoint.md');suffix=original[len(base):] if original.startswith(base) else None
  # Exact append fragments are preserved in recorded second conflict block, independent of frontmatter edits.
  block=next(r for r in h['resolutions'] if r['path'].endswith('checkpoint.md'))['blocks'][1][label].encode();assert block in checkpoint
 status=git('show',ref+':dev/progress/status.md');assert len(status.splitlines())==200
 srcdelta=sorted(p for p in set(t)|set(T['ours']) if p.startswith('src/') and t.get(p)!=T['ours'].get(p));assert srcdelta==['src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts'];assert gs('rev-parse',ref+':src')==gs('rev-parse',m['incoming']+':src')=='4243970658ddd668d1f89e0a97d7f41ba94d3300'
 insertion=json.loads((ARTIFACTS/'single-test-insertion-proof.json').read_text());p=insertion['path'];old=git('show',m['ours']+':'+p);new=git('show',ref+':'+p);offset=insertion['insertByteOffset'];assert len(insertion['insertExact'].encode())==52 and new==old[:offset]+insertion['insertExact'].encode()+old[offset:] and t[p]==T['incoming'][p] and new==Path(p).read_bytes()
 life='dev/plans/sources-panel-diff-view-model-lifetime.md';a=git('show',m['ours']+':'+life);z=git('show',m['incoming']+':'+life);changes=[op for op in difflib.SequenceMatcher(a=a.splitlines(keepends=True),b=z.splitlines(keepends=True),autojunk=False).get_opcodes() if op[0]!='equal'];assert len(changes)==1 and changes[0][0]=='insert';op=changes[0];insert=b''.join(z.splitlines(keepends=True)[op[3]:op[4]]);assert len(insert)==len(z)-len(a)==633
 protected=[life,'dev/plans/sources-panel-stale-render-stub-amendment.md','dev/plans/sources-accept-post-read-authorization.md','dev/plans/sources-panel-fixture-preinjection-amendment.md','dev/progress/sources-accept-post-read-authorization-dispatch-checkpoint.json']
 for p in protected:assert t[p]==T['incoming'][p] and git('show',ref+':'+p)==Path(p).read_bytes()
 for p in protected[:4]:assert re.search(br'^status: accepted$',git('show',ref+':'+p),re.M)
 delta=sorted(p for p in set(t)|set(T['ours']) if t.get(p)!=T['ours'].get(p));assert len(delta)==9
 return {'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'qualifiedRef':ref,'qualifiedTree':gs('rev-parse',ref+'^{tree}'),'ours':m['ours'],'incoming':m['incoming'],'base':m['base'],'newSourceTree':gs('rev-parse',ref+':src'),'unionPathCount':175,'uncontestedPathCount':171,'outsideUnionUnchangedCount':outside,'allOutsideUnionModeTypeBlobExact':True,'deltaFromOurs':delta,'sourceDeltaFromOurs':srcdelta,'singleSourceInsertionBytes':52,'lifecycleSoleInsertionBytes':633,'lifecycleSoleInsertionSha256':sha(insert),'conflictDocumentCount':4,'conflictBlockCount':count,'conflictChecks':checks,'worktreeResolvedDocsChecked':worktree_docs,'bothCheckpointAppendBlocksExact':True,'parentFirstStatusEntriesWithLFExactlyPreserved':True,'statusLineCount':200,'protectedPlansAndDispatchExactIncoming':True,'fourNarrowPlanStatusesAccepted':True,'rows':rows,'sourceCheckerCompileEmitTestsOrOutWritesInvoked':False}
if __name__=='__main__':
 r=verify(sys.argv[1],'--worktree-docs' in sys.argv);Path(sys.argv[2]).write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k!='rows'},ensure_ascii=False))

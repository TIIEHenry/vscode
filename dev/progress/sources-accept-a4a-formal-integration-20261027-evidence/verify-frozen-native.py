from pathlib import Path
import os,sys,json,hashlib,stat,subprocess,datetime,runpy
REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(REPO)
BASELINE=REPO/'dev/progress/sources-accept-qualified-old-red-run3-20261027-evidence/guard-after-restore.json'
BASELINE_SHA='90f8cd36c22c0503061c8c6df9c1fe6654053043fad1b7857e80a62875955aa1'
INCOMING='a4a70322795c509e8e9b8274cf295a1b65db663a';SRC='d78a48e5feee57fcaf5811c8425859d0a2400af0'
SOURCES={
 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts':(34365,'712520e3971b4b6058e13ffae9127efd03df5e52e0e952ac5032ab9beebbecf5'),
 'src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts':(34142,'094f73d77d49a12e6453ba89529ce4d27b6f8a12123d6d2f5f7b26338285eea9'),
 'src/vs/workbench/contrib/sources/test/browser/conversationDiffReviewPane.test.ts':(13078,'93d4b2f612e21212558c890f5a0cdb3c16b5fc657c47635f6e6a942dbac372fc'),
 'src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts':(189054,'ef28732018c703848be327f384aa3edaeabd2e3d8b4fb1e890f168c443596967'),
}
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*a):return subprocess.check_output(['rtk','proxy','git',*a])
def gs(*a):return git(*a).decode().strip()
def verify(source_ref='HEAD'):
 assert sha(BASELINE.read_bytes())==BASELINE_SHA
 before=json.loads(BASELINE.read_text());api=runpy.run_path(str(REPO/'dev/progress/sources-accept-post-read-authorization-integration-audit.py'),run_name='audit')
 assert gs('rev-parse',source_ref+':src')==SRC
 current=api['outmeta']();assert current==before['outMetadata'],'Complete frozen native metadata differs from actual run3 baseline'
 for name,row in before['freezeFiles'].items():assert sha(Path(name).read_bytes())==row['sha256']and api['meta'](Path(name))==row['metadata']
 for name,row in before['cacheSymlinks'].items():
  p=Path(name);assert p.is_symlink()and os.readlink(p)==row['target']and str(p.resolve())==row['resolved']and api['meta'](p)==row['metadata']
 pair_rows=[];authorized=[]
 for row in before['pairs254']+before['extra2PairsWithoutProducerCredit']:
  source=Path(row['sourcePath']);native=Path(row['path']);old_native=row.get('sha256',row.get('nativeSha256'));source_bytes=source.read_bytes();current_source_blob=gs('rev-parse',source_ref+':'+str(source))
  assert sha(native.read_bytes())==old_native and stat.S_IMODE(native.stat().st_mode)==row['nativeMode']
  if str(source)in SOURCES:
   size,digest=SOURCES[str(source)];assert len(source_bytes)==size and sha(source_bytes)==digest and source_bytes==git('show',INCOMING+':'+str(source))
   assert current_source_blob==gs('rev-parse',INCOMING+':'+str(source))and stat.S_IMODE(source.stat().st_mode)==row['sourceMode']
   authorized.append(str(source));kind='authorized-new-source-with-unchanged-old-native'
  else:
   assert sha(source_bytes)==row['sourceSha256']and stat.S_IMODE(source.stat().st_mode)==row['sourceMode']and current_source_blob==row['sourceBlob']
   kind='unchanged-baseline-source-and-native-pair'
  pair_rows.append({'sourcePath':str(source),'currentSourceBlob':current_source_blob,'currentSourceSha256':sha(source_bytes),'originalBaselineSourceBlob':row['sourceBlob'],'originalBaselineSourceSha256':row['sourceSha256'],'nativePath':str(native),'nativeSha256':old_native,'nativeMode':row['nativeMode'],'classification':kind,'newSourceEmittedToThisNative':False})
 assert sorted(authorized)==sorted(SOURCES)and len(pair_rows)==256
 for p,size,digest in [('dev/plans/sources-accept-post-read-authorization.md',17436,'5d5c2a72fcb9d555b15d0442d0c7d47ae9238998cea2eb25b4b7917af8362e61'),('dev/progress/sources-accept-post-read-authorization-dispatch-checkpoint.json',2859,'fbf75cdbb5d197a2863dd654afe71a7ce71d78fb62668787514d3c98fa0ce028')]:
  b=Path(p).read_bytes();assert len(b)==size and sha(b)==digest
 return {'capturedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':gs('rev-parse','HEAD'),'qualifiedSourceRef':source_ref,'newSourceTree':SRC,'baselineFile':str(BASELINE),'baselineFileSha256':BASELINE_SHA,'completeOutMetadataExactToActualRun3':True,'outMetadata':current,'outFileCount':sum(not stat.S_ISDIR(r['type'])for r in current.values()),'outDirectoryCount':sum(stat.S_ISDIR(r['type'])for r in current.values()),'allFourFreezeFilesExact':True,'freezeFiles':before['freezeFiles'],'allThreeCacheSymlinksExact':True,'cacheSymlinks':before['cacheSymlinks'],'sourceNativePairs':pair_rows,'authorizedSourceChangesCount':4,'unchangedSourceNativePairCount':252,'all256NativeBytesAndModesUnchanged':True,'sourceOutsideAuthorizedFourUnchanged':True,'nativeIdentity':'All native outputs remain exactly the old frozen actual run3 baseline; no claim that new source produced them','sourceCheckerCompileEmitTestsOrOutWritesInvoked':False,'fullCompileOfFinalSourceTree':False}
if __name__=='__main__':
 ref=sys.argv[1]if len(sys.argv)>1 else'HEAD';result=verify(ref)
 if len(sys.argv)>2:Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in result.items()if k not in ['outMetadata','freezeFiles','cacheSymlinks','sourceNativePairs']}))

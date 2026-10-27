"""Prepared read-only guard; driver loads only after separate root execution release."""
from pathlib import Path
import os,json,hashlib,stat,datetime
REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def metadata(p):
 s=Path(p).lstat();return {'type':stat.S_IFMT(s.st_mode),'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'size':s.st_size,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}
def outmeta():
 rows={'out':metadata(REPO/'out')}
 for directory,dirs,files in os.walk(REPO/'out'):
  for name in sorted(dirs+files):
   p=Path(directory)/name;rows[str(p.relative_to(REPO))]=metadata(p)
 return dict(sorted(rows.items()))
def preserved_history(manifest):
 original=json.loads(Path(manifest['oldD8ePreservationInventory']).read_text());actual=set()
 for row in original['files']:
  p=Path(row['sourcePath']);b=p.read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'] and stat.S_IMODE(p.stat().st_mode)==row['filesystemMode'];actual.add(str(p))
  if row['mirrored']:
   m=REPO/row['mirrorPath'];assert m.read_bytes()==b and stat.S_IMODE(m.stat().st_mode)==row['filesystemMode']
 old_root=Path(manifest['baselineFile']).parent;assert {str(p) for p in old_root.rglob('*') if p.is_file()}==actual
 f33=json.loads(Path(manifest['oldF33PreservationInventory']).read_text());fset=set()
 for row in f33['files']:
  p=Path(row['path']);b=p.read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'] and stat.S_IMODE(p.stat().st_mode)==row['mode'];fset.add(str(p))
 assert fset=={str(p) for base in ['prep1','prep2'] for p in Path('/tmp/vscode-conversation-visible-lease-f33-validation-20261027-'+base).rglob('*') if p.is_file()}
 owned={(p['pid'],p['startTime']) for s in json.loads(Path(manifest['oldOwnedReport']).read_text())['stages'] for p in s['ownedProcesses']};alive=[]
 for pid,start in owned:
  p=Path('/proc')/str(pid)/'stat'
  try:raw=p.read_text();fields=raw[raw.rfind(')')+2:].split()
  except FileNotFoundError:continue
  if fields[19]==start:alive.append((pid,start))
 assert len(original['files'])==257 and sum(r['mirrored'] for r in original['files'])==125 and f33['fileCount']==174 and f33['totalBytes']==28784500 and len(owned)==28 and not alive
 assert all(not Path(x).exists() for x in ['/tmp/.X11-unix/X117','/tmp/.X117-lock'])
 return {'d8eScratchFiles':257,'exactMirrors':125,'f33Files':174,'f33Bytes':28784500,'oldOwnedPidStartCount':28,'oldOwnedAlive':[],'x117PathsAbsent':True}
def verify(expected_metadata=None,native_overrides=None,allow_ctime_paths=(),restoration_scope=None):
 manifest=json.loads((ROOT/'input-manifest.json').read_text());policy=json.loads((ROOT/'policy.json').read_text());source=manifest['sourceFiles'][0];reveal=source['outputPath'];overrides=native_overrides or {}
 assert len(manifest['sourceFiles'])==1 and policy['writableOutputPaths']==[reveal] and policy['temporaryProductionJs']==0
 baseline=Path(manifest['baselineFile']);raw=baseline.read_bytes();assert len(raw)==manifest['baselineFileBytes'] and sha(raw)==manifest['baselineFileSha256']=='46fc959b355c9e922a7cb7e9a74919956c5647a595ad88347a083449d8cfb51e'
 old=json.loads(raw);overlay=json.loads(Path(manifest['sourceIdentityOverlayFile']).read_text());assert overlay['immutable46fcSnapshot']['sha256']==sha(raw) and overlay['currentReveal']==source
 current=outmeta();expected=expected_metadata if expected_metadata is not None else old['outMetadata'];assert set(overrides).issubset({reveal}) and set(allow_ctime_paths).issubset({reveal})
 if restoration_scope is None:assert not allow_ctime_paths
 else:
  rows=restoration_scope['actualCompletedWrites']+restoration_scope['partialOrUncertainAttempts'];adjudicated={row['path'] for row in rows}
  assert set(allow_ctime_paths)==set(restoration_scope['restorablePaths'])==adjudicated
  assert all(row['path']==reveal and row['mode']=='emit-reveal' and row['parentSinglePathAuthority'] is True and row['qualifiedParentSpawn'] is True and row['journalOwnedWriter'] is True and row['trustedIntent']['path']==reveal and row['trustedIntent']['phase']=='intent' for row in rows)
 assert set(current)==set(expected)==set(old['outMetadata']) and len(current)==15500
 assert sum(row['type']==stat.S_IFREG for row in current.values())==12554 and sum(row['type']==stat.S_IFDIR for row in current.values())==2946
 for p,v in expected.items():assert p==reveal or v==old['outMetadata'][p]
 changes=[]
 for p,wanted in expected.items():
  actual=current[p]
  if actual!=wanted:
   keys=[k for k in wanted if wanted[k]!=actual[k]];assert p in allow_ctime_paths and keys==['ctimeNs'],(p,keys)
   changes.append({'path':p,'keys':keys,'beforeCtimeNs':wanted['ctimeNs'],'afterCtimeNs':actual['ctimeNs']})
 for p,row in old['freezeFiles'].items():assert sha((REPO/p).read_bytes())==row['sha256'] and metadata(REPO/p)==row['metadata']
 for p,row in old['cacheSymlinks'].items():
  q=REPO/p;assert q.is_symlink() and os.readlink(q)==row['target'] and str(q.resolve())==row['resolved'] and metadata(q)==row['metadata']
 pairs=manifest['boundSourceNativePairs'];assert len(pairs)==256 and pairs==old['sourceNativePairs']==overlay['sourceNativePairs']
 for row in pairs:
  p=REPO/row['sourcePath'];b=p.read_bytes();blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
  assert blob==row['currentSourceBlob'] and sha(b)==row['currentSourceSha256'] and len(b)==row['currentSourceBytes'] and stat.S_IMODE(p.stat().st_mode)==row['sourceMode']
  native=REPO/row['nativePath'];assert sha(native.read_bytes())==row['nativeSha256'] and stat.S_IMODE(native.stat().st_mode)==row['nativeMode']
 p=REPO/source['sourcePath'];b=p.read_bytes();assert sha(b)==source['sourceSha256'] and len(b)==source['sourceBytes'] and stat.S_IMODE(p.stat().st_mode)==source['sourceMode']
 native=REPO/reveal;historical=old['additionalRevealSourceOldNativeIdentity'];assert sha(native.read_bytes())==overrides.get(reveal,historical['existingOldNativeSha256']) and stat.S_IMODE(native.stat().st_mode)==overlay['existingRevealNativeSeal']['mode']
 history=preserved_history(manifest)
 return {'capturedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'expectedHead':manifest['expectedHead'],'sourceTree':manifest['sourceTree'],'outMetadata':current,'sourceNativePairs':pairs,'currentRevealSource':source,'historicalAdditionalRevealIdentity':historical,'immutable46fcSnapshotSha256':sha(raw),'historicalNativeMetadataExact54feIsNotCurrentCtimeClaim':True,'freezeFiles':old['freezeFiles'],'cacheSymlinks':old['cacheSymlinks'],'nativeOverrides':overrides,'authorizedCtimeDifferences':changes,'historical46fcPriorCtimeDifference':old['authorizedCtimeDifferences'],'historyPreservation':history,'fullCompileOfFinalSourceTree':False}

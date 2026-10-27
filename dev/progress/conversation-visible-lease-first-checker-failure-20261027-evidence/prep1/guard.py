"""Prepared read-only identity guard. Loaded only after independent release and input gates."""
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
def verify(expected_metadata=None,native_overrides=None,allow_ctime_paths=()):
 manifest=json.loads((ROOT/'input-manifest.json').read_text());overrides=native_overrides or {}
 baseline=Path(manifest['baselineFile']);identity=Path(manifest['sourceIdentityBaselineFile'])
 assert sha(baseline.read_bytes())==manifest['baselineFileSha256']=='54fe37b2f942aa1afc5587d630199809ff4dc8e54bad610f577ffa6db8f60f1e'
 assert sha(identity.read_bytes())==manifest['sourceIdentityBaselineFileSha256']=='5795e91a5c9be7d333501bf384563747028b38555abb06dcca22039eff44d453'
 old=json.loads(baseline.read_text());mapping=json.loads(identity.read_text());current=outmeta();expected=expected_metadata if expected_metadata is not None else old['outMetadata']
 allowed={r['outputPath'] for r in manifest['sourceFiles']};assert set(overrides).issubset(allowed) and set(allow_ctime_paths).issubset(allowed)
 assert set(current)==set(expected)==set(old['outMetadata']) and len(current)==15500
 changes=[]
 for path,wanted in expected.items():
  actual=current[path]
  if actual!=wanted:
   keys=[k for k in wanted if wanted[k]!=actual[k]];assert path in allow_ctime_paths and keys==['ctimeNs'],(path,keys)
   changes.append({'path':path,'keys':keys,'beforeCtimeNs':wanted['ctimeNs'],'afterCtimeNs':actual['ctimeNs']})
 for path,row in old['freezeFiles'].items():assert sha((REPO/path).read_bytes())==row['sha256'] and metadata(REPO/path)==row['metadata']
 for path,row in old['cacheSymlinks'].items():
  p=REPO/path;assert p.is_symlink() and os.readlink(p)==row['target'] and str(p.resolve())==row['resolved'] and metadata(p)==row['metadata']
 pairs=manifest['boundSourceNativePairs'];assert len(pairs)==256 and pairs==mapping['sourceNativePairs']
 for row in pairs:
  p=REPO/row['sourcePath'];b=p.read_bytes();blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
  assert blob==row['currentSourceBlob'] and sha(b)==row['currentSourceSha256'] and len(b)==row['currentSourceBytes'] and stat.S_IMODE(p.stat().st_mode)==row['sourceMode']
  native=REPO/row['nativePath'];assert sha(native.read_bytes())==overrides.get(row['nativePath'],row['nativeSha256']) and stat.S_IMODE(native.stat().st_mode)==row['nativeMode']
 reveal=manifest['additionalRevealSourceOldNativeIdentity'];assert reveal==mapping['additionalRevealSourceOldNativeIdentity']
 assert sha((REPO/reveal['sourcePath']).read_bytes())==reveal['currentSourceSha256']
 assert sha((REPO/reveal['nativePath']).read_bytes())==overrides.get(reveal['nativePath'],reveal['existingOldNativeSha256'])
 assert sum(r['currentSourceBlob']!=r['originalOldSourceBlob'] for r in pairs)==5
 return {'capturedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceTree':manifest['sourceTree'],'outMetadata':current,'sourceNativePairs':pairs,'additionalRevealSourceOldNativeIdentity':reveal,'freezeFiles':old['freezeFiles'],'cacheSymlinks':old['cacheSymlinks'],'nativeOverrides':overrides,'authorizedCtimeDifferences':changes,'fullCompileOfFinalSourceTree':False}

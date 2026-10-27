"""Prepared source-aware identity guard; imported only after explicit root release and fixed-input gate.
Actual restored8b5f metadata and old native256 are separate from fixed6d current source bindings.
"""
from pathlib import Path
import os,json,hashlib,stat,subprocess,datetime
REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def metadata(p):
 s=Path(p).lstat();return {'type':stat.S_IFMT(s.st_mode),'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'size':s.st_size,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}
def outmeta():
 rows={'out':metadata('out')}
 for root,dirs,files in os.walk('out'):
  for name in sorted(dirs+files):
   p=Path(root)/name;rows[str(p)]=metadata(p)
 return dict(sorted(rows.items()))
def verify(allow_ctime_paths=()):
 os.chdir(REPO)
 manifest=json.loads((ROOT/'input-manifest.json').read_text())
 baseline_path=Path(manifest['baselineFile']);assert sha(baseline_path.read_bytes())==manifest['baselineFileSha256']=='8b5f45b3207be166685bc342025d899c3d237c955847681a41c4f1b9e48c4a04'
 identity_path=Path(manifest['sourceIdentityBaselineFile']);assert sha(identity_path.read_bytes())==manifest['sourceIdentityBaselineFileSha256']=='0a99707f0153413b352f91d2ae7d6d0295f709db3bf1d2faf27998dd3c4a5006'
 before=json.loads(baseline_path.read_text());current=outmeta();assert set(current)==set(before['outMetadata']);changes=[]
 assert manifest['guardSchemaVersion']==2 and len(manifest['boundSourceNativePairs'])==256
 assert set(allow_ctime_paths).issubset({r['outputPath'] for r in manifest['sourceFiles']})
 for p,old in before['outMetadata'].items():
  new=current[p]
  if new!=old:
   keys=[k for k in old if old[k]!=new[k]];assert p in allow_ctime_paths and keys==['ctimeNs'],(p,keys);changes.append({'path':p,'keys':keys,'beforeCtimeNs':old['ctimeNs'],'afterCtimeNs':new['ctimeNs']})
 for p,row in before['freezeFiles'].items():assert sha(Path(p).read_bytes())==row['sha256'] and metadata(p)==row['metadata']
 for p,row in before['cacheSymlinks'].items():assert Path(p).is_symlink() and os.readlink(p)==row['target'] and str(Path(p).resolve())==row['resolved'] and metadata(p)==row['metadata']
 pairs=[];new_count=0
 for row in manifest['boundSourceNativePairs']:
  p=Path(row['sourcePath']);content=p.read_bytes();blob=subprocess.check_output(['rtk','proxy','git','rev-parse',manifest['sourceRef']+':'+str(p)]).decode().strip()
  assert row['sourceRef']==manifest['sourceRef'] and blob==row['sourceBlob'] and len(content)==row['sourceBytes'] and sha(content)==row['sourceSha256'] and stat.S_IMODE(p.stat().st_mode)==row['sourceMode']
  changed=blob!=row['originalOldSourceBlob'];new_count+=changed
  native=Path(row['nativePath']);assert sha(native.read_bytes())==row['nativeSha256'] and stat.S_IMODE(native.stat().st_mode)==row['nativeMode']
  pairs.append({'sourcePath':str(p),'currentSourceBlob':blob,'currentSourceSha256':sha(content),'currentSourceMode':row['sourceMode'],'oldSourceBlob':row['originalOldSourceBlob'],'oldSourceSha256':row['originalOldSourceSha256'],'nativePath':str(native),'nativeSha256':row['nativeSha256'],'nativeMode':row['nativeMode'],'classification':'authorized-fixed6d-source-with-old-native' if changed else 'unchanged-source-native-pair','newSourceEmittedToThisNative':False})
 assert len(pairs)==256 and new_count==4
 return {'capturedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'guardSchemaVersion':2,'sourceRef':manifest['sourceRef'],'sourceTree':manifest['sourceTree'],'baselineFile':str(baseline_path),'baselineFileSha256':manifest['baselineFileSha256'],'sourceIdentityBaselineFile':str(identity_path),'sourceIdentityBaselineFileSha256':manifest['sourceIdentityBaselineFileSha256'],'outMetadata':current,'sourceNativePairs':pairs,'authorizedNewSourceOldNativePairs':4,'unchangedSourceNativePairs':252,'all256NativeBytesModesExactOldBaseline':True,'freezeFiles':before['freezeFiles'],'cacheSymlinks':before['cacheSymlinks'],'priorAuthorizedCtimeDifferencesFromRun3':before['authorizedCtimeDifferences'],'authorizedCtimeDifferences':changes,'fullCompileOfFinalSourceTree':False}

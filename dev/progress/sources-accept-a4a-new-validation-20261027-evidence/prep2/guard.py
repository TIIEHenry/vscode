"""Prepared identity guard. Imported only after the driver's explicit release gate.
New four source identities are a4a; all native outputs remain old run3 bytes.
"""
from pathlib import Path
import os,json,hashlib,stat,subprocess,datetime,runpy
REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def verify(allow_ctime_paths=()):
 os.chdir(REPO)
 manifest=json.loads((ROOT/'input-manifest.json').read_text())
 baseline_path=Path(manifest['baselineFile']);assert sha(baseline_path.read_bytes())==manifest['baselineFileSha256']=='90f8cd36c22c0503061c8c6df9c1fe6654053043fad1b7857e80a62875955aa1'
 before=json.loads(baseline_path.read_text());api=runpy.run_path(str(REPO/'dev/progress/sources-accept-post-read-authorization-integration-audit.py'),run_name='audit');current=api['outmeta']();assert set(current)==set(before['outMetadata']);changes=[]
 assert set(allow_ctime_paths).issubset({r['outputPath']for r in manifest['sourceFiles']})
 for p,old in before['outMetadata'].items():
  new=current[p]
  if new!=old:
   keys=[k for k in old if old[k]!=new[k]];assert p in allow_ctime_paths and keys==['ctimeNs'],(p,keys);changes.append({'path':p,'keys':keys,'beforeCtimeNs':old['ctimeNs'],'afterCtimeNs':new['ctimeNs']})
 for p,row in before['freezeFiles'].items():assert sha(Path(p).read_bytes())==row['sha256']and api['meta'](Path(p))==row['metadata']
 for p,row in before['cacheSymlinks'].items():assert Path(p).is_symlink()and os.readlink(p)==row['target']and str(Path(p).resolve())==row['resolved']and api['meta'](Path(p))==row['metadata']
 qualified={r['sourcePath']:r for r in manifest['sourceFiles']};pairs=[];new_count=0
 for row in before['pairs254']+before['extra2PairsWithoutProducerCredit']:
  p=Path(row['sourcePath']);b=p.read_bytes();bound=qualified.get(str(p));digest=sha(b);blob=subprocess.check_output(['rtk','proxy','git','rev-parse',manifest['sourceRef']+':'+str(p)]).decode().strip()
  if digest!=row['sourceSha256']:
   assert bound and digest==bound['sourceSha256']and blob==bound['sourceBlob'];new_count+=1;kind='authorized-a4a-source-with-old-native'
  else:assert blob==row['sourceBlob'];kind='unchanged-source-native-pair'
  assert stat.S_IMODE(p.stat().st_mode)==row['sourceMode']
  native=Path(row['path']);expected=row.get('sha256',row.get('nativeSha256'));assert sha(native.read_bytes())==expected and stat.S_IMODE(native.stat().st_mode)==row['nativeMode']
  pairs.append({'sourcePath':str(p),'currentSourceBlob':blob,'currentSourceSha256':digest,'oldSourceBlob':row['sourceBlob'],'oldSourceSha256':row['sourceSha256'],'nativePath':str(native),'nativeSha256':expected,'nativeMode':row['nativeMode'],'classification':kind,'newSourceEmittedToThisNative':False})
 assert len(pairs)==256 and new_count==4
 return {'capturedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRef':manifest['sourceRef'],'sourceTree':manifest['sourceTree'],'baselineFile':str(baseline_path),'baselineFileSha256':manifest['baselineFileSha256'],'outMetadata':current,'sourceNativePairs':pairs,'authorizedNewSourceOldNativePairs':4,'unchangedSourceNativePairs':252,'all256NativeBytesModesExactOldBaseline':True,'freezeFiles':before['freezeFiles'],'cacheSymlinks':before['cacheSymlinks'],'authorizedCtimeDifferences':changes,'fullCompileOfFinalSourceTree':False}

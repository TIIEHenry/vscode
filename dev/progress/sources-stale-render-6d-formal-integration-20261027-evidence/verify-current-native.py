from pathlib import Path
import os,stat,hashlib,json,datetime,subprocess,sys
REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge');os.chdir(REPO)
BASELINE=REPO/'dev/progress/sources-accept-a4a-new-validation-20261027-evidence/prep2/guard-after-restore.json'
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*a):return subprocess.check_output(['rtk','proxy','git',*a])
def meta(p):
 s=Path(p).lstat();return {'type':stat.S_IFMT(s.st_mode),'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'size':s.st_size,'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}
def verify(ref):
 assert sha(BASELINE.read_bytes())=='8b5f45b3207be166685bc342025d899c3d237c955847681a41c4f1b9e48c4a04'
 d=json.loads(BASELINE.read_text());rows={'out':meta('out')}
 for root,dirs,files in os.walk('out'):
  for name in sorted(dirs+files):
   p=Path(root)/name;rows[str(p)]=meta(p)
 rows=dict(sorted(rows.items()));assert rows==d['outMetadata']
 tree={}
 for x in git('ls-tree','-rz','--full-tree',ref,'src').split(b'\0'):
  if x:
   h,p=x.split(b'\t',1);mode,kind,oid=h.decode().split();tree[p.decode()]={'mode':mode,'type':kind,'oid':oid}
 changes=[];pairs=[]
 for old in d['sourceNativePairs']:
  row=dict(old);p=row['sourcePath'];blob=tree[p]['oid'];content=Path(p).read_bytes()
  if blob==row['currentSourceBlob']:assert sha(content)==row['currentSourceSha256']
  else:
   assert p=='src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts'
   assert content==git('show',ref+':'+p)
   changes.append({'sourcePath':p,'priorA4aBlob':row['currentSourceBlob'],'priorA4aSha256':row['currentSourceSha256'],'currentSourceBlob':blob,'currentSourceSha256':sha(content),'nativeStillOld':True})
  row['currentSourceBlob']=blob;row['currentSourceSha256']=sha(content);native=Path(row['nativePath']);assert sha(native.read_bytes())==row['nativeSha256'] and stat.S_IMODE(native.stat().st_mode)==row['nativeMode'];pairs.append(row)
 for p,row in d['freezeFiles'].items():assert sha(Path(p).read_bytes())==row['sha256'] and meta(p)==row['metadata']
 for p,row in d['cacheSymlinks'].items():assert Path(p).is_symlink() and os.readlink(p)==row['target'] and str(Path(p).resolve())==row['resolved'] and meta(p)==row['metadata']
 return {'capturedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'qualifiedSourceRef':ref,'sourceTree':git('rev-parse',ref+':src').decode().strip(),'actualRestoredBaselineFile':str(BASELINE),'actualRestoredBaselineSha256':sha(BASELINE.read_bytes()),'outMetadata':rows,'all15500MetadataExactActualRestoredBaseline':True,'sourceNativePairs':pairs,'authorizedA4aTo6dTestSourceChange':changes,'newSourceOldNativePairCount':4,'unchangedSourceNativePairCount':252,'nativePairCount':len(pairs),'all256NativeBytesModesExactOldBaseline':True,'freezeFiles':d['freezeFiles'],'cacheSymlinks':d['cacheSymlinks'],'fiveAlreadyAuthorizedCtimesComparedToOriginalRun3':d['authorizedCtimeDifferences'],'fullCompileOfFinalSourceTree':False,'preparedOrHistoricalGuardCodeInvoked':False}
if __name__=='__main__':
 d=verify(sys.argv[1]);Path(sys.argv[2]).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in d.items() if k not in ['outMetadata','sourceNativePairs','freezeFiles','cacheSymlinks']},ensure_ascii=False))

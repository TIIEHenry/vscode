from pathlib import Path
import json,runpy,subprocess,datetime,hashlib
root=Path(__file__).resolve().parent
baseline=root/'guard-after-restore.json'
assert hashlib.sha256(baseline.read_bytes()).hexdigest()=='90f8cd36c22c0503061c8c6df9c1fe6654053043fad1b7857e80a62875955aa1'
api=runpy.run_path('dev/progress/sources-accept-post-read-authorization-integration-audit.py',run_name='audit')
expected=json.loads(baseline.read_text());actual=api['snapshot']()
assert actual==expected,'Source/native/freeze/cache or complete actual run3 post-restore metadata differs'
print(json.dumps({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':subprocess.check_output(['rtk','proxy','git','rev-parse','HEAD'],text=True).strip(),'sourceTree':actual['sourceTree'],'all254AndExtra2PairsExact':True,'all12554FilesAnd2946DirectoriesExactToActualRun3RestoredBaseline':True,'allFourHistoricalFreezeFilesExact':True,'allThreeOriginalCacheSymlinksExact':True,'noCompileEmitOrTestsInvoked':True}))

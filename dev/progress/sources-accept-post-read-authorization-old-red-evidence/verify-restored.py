from pathlib import Path
import json,runpy,subprocess,datetime
root=Path(__file__).resolve().parent
api=runpy.run_path('dev/progress/sources-accept-post-read-authorization-integration-audit.py',run_name='audit')
expected=json.loads((root/'guard-after-restore.json').read_text())
actual=api['snapshot']()
assert actual==expected,'Source/native/freeze/cache or complete post-restore output metadata differs'
print(json.dumps({'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':subprocess.check_output(['rtk','proxy','git','rev-parse','HEAD'],text=True).strip(),'sourceTree':actual['sourceTree'],'all254AndExtra2PairsExact':True,'all12554FilesAnd2946DirectoriesExactToActualRestoredBaseline':True,'allFourHistoricalFreezeFilesExact':True,'allThreeOriginalCacheSymlinksExact':True,'noCompileEmitOrTestsInvoked':True}))

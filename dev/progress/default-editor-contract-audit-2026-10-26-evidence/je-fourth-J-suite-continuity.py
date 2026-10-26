import pathlib,hashlib,datetime,json,subprocess
repo=pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
old=json.loads((repo/'dev/progress/default-editor-contract-audit-2026-10-26-evidence/je-final-J-suite-continuity.json').read_text())
native=json.loads(pathlib.Path('/tmp/vscode-je-formal-fourth-native-build.json').read_text())
assert native['exitCode']==0
sha=lambda p:hashlib.sha256((repo/p).read_bytes()).hexdigest()
for row in old['rows']:
 assert sha(row['sourcePath'])==row['sourceSha256'],row['sourcePath']
 assert sha(row['outputPath'])==row['outputSha256'],row['outputPath']
old.update(phase='J-complete10-suite-reuse-after-fixed-d91-fourth-native',checkedAtUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),finalNativeCompileHead=native['sourceHead'],finalNativeSourceTree=native['sourceTree'],allPass=True,claim='Actual prior 386 passing reused only through exact 29 source/native identities; not rerun in fourth round.')
pathlib.Path('/tmp/vscode-je-fourth-J-suite-continuity.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:old[k]for k in ['actualSuiteResult','identityScopeCount','allPass','claim']}))

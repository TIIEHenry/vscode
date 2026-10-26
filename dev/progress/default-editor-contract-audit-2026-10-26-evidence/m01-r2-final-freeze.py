import datetime, fcntl, hashlib, json, os, pathlib, stat, subprocess

repo = pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
os.chdir(repo)
base = pathlib.Path('/tmp/vscode-m01-r2-final-freeze')
sha = lambda data: hashlib.sha256(data).hexdigest()
file_sha = lambda p: sha(pathlib.Path(p).read_bytes())
git = lambda *args: subprocess.check_output(['git', *args], text=True).strip()
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
head = git('rev-parse', 'HEAD')
assert head == '800d383ba65fdefb36da324b380941c7574c4bf3' and git('status', '--porcelain') == ''
build = json.loads(pathlib.Path('/tmp/vscode-m01-eighth-native-build.json').read_text())
verdict = json.loads(pathlib.Path('/tmp/vscode-m01-eighth-runtime-verdict.json').read_text())
continuity = json.loads(pathlib.Path('/tmp/vscode-m01-eighth-static-identity.json').read_text())
source_tree = git('rev-parse', 'HEAD:src')
assert source_tree == build['sourceTree'] == verdict['sourceTree'] == '2b5df2b37ca926e38888443e371cf65e2883dba2'
assert build['exitCode'] == 0 and build['diagnosticLines'] == [] and build['compileOrdinal'] == 8 and len(build['outputs']) == 163
assert verdict['allNewM01AndRelatedBrowserScopePass'] and verdict['notBlanketIgnoringNewFailures']
assert continuity['all163ActualSourceNativeMatchCompile8'] and len(continuity['e11Rows']) == 11
for label, count in [('M01-focused', 39), ('J-focused', 29), ('J-complete-11', 425), ('E-response-focused', 44), ('E-roster-full', 190)]:
    run = verdict['runs'][label]
    assert run['exitCode'] == 0 and any(str(count) + ' passing' in s for s in run['mochaSummaries'])
    assert file_sha('/tmp/vscode-m01-eighth-' + label + '.json') == run['recordSha256']
    assert file_sha('/tmp/vscode-m01-eighth-' + label + '.log') == run['rawSha256']
assert verdict['runs']['J-wiring-scan']['exitCode'] == 1
fixed = 'd91a7a8d361cff7c12e7717dfc7c5ab2e3d41f42'
subprocess.check_call(['git', 'merge-base', '--is-ancestor', fixed, head])
subprocess.check_call(['git', 'merge-base', '--is-ancestor', build['sourceHead'], head])
contract_path = pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/e-response-after-m01-20261027-r2/final-freeze-contract.json')
contract_sha = '5a3d7eb82cce25f0f5b9bbe1325c71817b14e2481eab14d9c5f1bfe45149c138'
assert file_sha(contract_path) == contract_sha
contract = json.loads(contract_path.read_text())
assert contract['m01CandidateCommit'] == '468d805ef929298de9113f72665a3de0bdf4742a'
assert contract['expectedNativeCompileOrdinal'] == 8 and contract['m01ExpectedFocusedTestCount'] == 39
assert contract['runId'] == 'sources-m01-after-20261027-r2' and contract['minimumUnionAssets'] == 53
ancestors = set()
pid = os.getpid()
while pid > 0:
    ancestors.add(pid)
    try:
        pid = int(pathlib.Path('/proc', str(pid), 'stat').read_text().split()[3])
    except (FileNotFoundError, ValueError):
        break
patterns = ['compile-client', 'typecheck-client', 'transpile-client', 'gulp.js', 'build/next/index.ts transpile', 'build/next/index.ts watch', 'watch-client', 'tsc --project', 'tsgo --project', 'virtual-noemit', 'virtual-noEmit']
def scan():
    raw = subprocess.check_output(['ps', '-eo', 'pid,ppid,etime,args'], text=True)
    matches = []
    for line in raw.splitlines()[1:]:
        fields = line.strip().split(None, 3)
        if len(fields) == 4 and int(fields[0]) not in ancestors and any(p in fields[3] for p in patterns):
            matches.append(line)
    return raw, matches
raw, matches = scan()
base.with_suffix('.processes-before.log').write_text(raw)
assert not matches, matches
lock = open('/tmp/vscode-compile.lock', 'a+')
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
raw, matches = scan()
base.with_suffix('.processes-under-lock.log').write_text(raw)
assert not matches, matches
outputs = []
details = []
for item in build['outputs']:
    source = pathlib.Path(item['sourcePath'])
    output = pathlib.Path(item['outputPath'])
    assert source.is_file() and output.is_file()
    assert file_sha(source) == item['sourceSha256'] and file_sha(output) == item['afterOutputSha256']
    assert sha(subprocess.check_output(['git', 'show', head + ':' + item['sourcePath']])) == item['sourceSha256']
    outputs.append({'path': item['outputPath'], 'sha256': item['afterOutputSha256'], 'sourcePath': item['sourcePath'], 'sourceSha256': item['sourceSha256']})
    info = output.stat()
    details.append({'path': item['outputPath'], 'exists': True, 'mode': stat.S_IMODE(info.st_mode), 'bytes': info.st_size, 'mtimeNs': info.st_mtime_ns})
outputs.sort(key=lambda item: item['path'])
assert len({item['path'] for item in outputs}) == 163
by_path = {item['path']: item for item in outputs}
inventory_path = repo / 'dev/progress/default-editor-contract-audit-2026-10-26-evidence/je-formal-artifact-inventory.json'
inventory = json.loads(inventory_path.read_text())
assert len(inventory['artifacts']) == 391
for row in inventory['artifacts']:
    path = repo / row['repositoryPath']
    assert path.stat().st_size == row['bytes'] and file_sha(path) == row['sha256']
templates = [
    ('J', pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/d1387-m01-after-20261027-r2/fresh-notice.template.json'), 'f6e5132351ae58608437614377b1819c6d3582bfd475f84b8718914e8c066a24', 'fresh-notice.json'),
    ('E', pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/D/.build/e-response-after-m01-20261027-r2/e-final-freeze.template.json'), '30bd9ba9251876e72894c8b4085bf2732507ede0503e34a4c923599d11170823', 'e-final-freeze.json')
]
prepared = []
common_paths = None
canonical = lambda rows: sha(json.dumps(sorted(rows, key=lambda item: item['path']), sort_keys=True, separators=(',', ':')).encode())
issued = now()
for label, template_path, template_sha, target_name in templates:
    assert file_sha(template_path) == template_sha
    notice = json.loads(template_path.read_text())
    paths = {item['path'] for item in notice['outputs']}
    assert len(paths) == len(notice['outputs']) == 53
    assert paths == common_paths if common_paths is not None else True
    common_paths = paths
    rows = []
    for item in notice['outputs']:
        actual = by_path[item['path']]
        assert actual['sourcePath'] == item['sourcePath']
        rows.append(actual.copy())
    rows.sort(key=lambda item: item['path'])
    assert {item['path'] for item in contract['mandatoryM01Production']}.issubset(paths)
    notice.update(sourceHead=head, sourceTree=source_tree, outFrozen=True, issuedAtUtc=issued, outputs=rows, nativeCompileSourceHead=build['sourceHead'], nativeCompileSourceTree=build['sourceTree'], nativeCompileExitCode=0, nativeCompileOrdinal=8, nativeCompileIdentityCount=163, templateSha256=template_sha, freezeContractSha256=contract_sha, frozenOutputsSha256=canonical(rows), afterExecutionAuthorization='root schedules J only first; E requires actual completed same-identity J zeroEngineRpc and a separate root E-after authorization', knownUnchangedRelatedFailures=['Node Wiring existing Accept patch builder parseSourcesGitUnifiedDiff exclusion: 23 passing / 1 failing, exit1, unchanged production hash; new Move scans passed', 'E-related11 sixth actual 255 passing / 1 reasoning failure THINKING vs hmm\\nthen this; all11 source/native pairs exact to eighth, no mechanical rerun'], runtimeEvidenceScope='source/native manifest only; no actual renderer loaded or UI-after claim')
    temporary = pathlib.Path('/tmp/vscode-m01-r2-' + label + '-production-frozen.json')
    consumer = template_path.parent / target_name
    assert not temporary.exists() and not consumer.exists()
    data = (json.dumps(notice, ensure_ascii=False, indent=2) + '\n').encode()
    prepared.append((label, temporary, consumer, data, canonical(rows)))
assert not base.with_suffix('.json').exists()
notices = []
for label, temporary, consumer, data, output_sha in prepared:
    with temporary.open('xb') as file:
        file.write(data)
    with consumer.open('xb') as file:
        file.write(data)
    assert temporary.read_bytes() == consumer.read_bytes() == data
    notices.append({'label': label, 'temporaryPath': str(temporary), 'consumerPath': str(consumer), 'rawNoticeSha256': sha(data), 'outputCount': 53, 'canonicalOutputsSha256': output_sha})
record = {'phase': 'M01-r2-final-source-native-frozen-for-separate-root-J-then-E-authorization', 'runId': contract['runId'], 'sourceHead': head, 'sourceTree': source_tree, 'nativeCompileSourceHead': build['sourceHead'], 'nativeCompileSourceTree': build['sourceTree'], 'nativeCompileOrdinal': 8, 'nativeCompileExitCode': 0, 'nativeCompileIdentityCount': 163, 'issuedAtUtc': issued, 'fixedExternalBaselineCommit': fixed, 'outFrozen': True, 'all163SourceAndNativeHashesMatch': True, 'outputs': outputs, 'canonicalFull163OutputsSha256': canonical(outputs), 'identityDetails': details, 'notices': notices, 'freezeContractPath': str(contract_path), 'freezeContractSha256': contract_sha, 'all391HistoricalArtifactHashesPreserved': True, 'sharedLockHeld': True, 'globalLaneMatches': [], 'rootWipNotConsumed': True, 'rootOutNotWritten': True, 'laterMainNotFollowed': True, 'afterNotRunByProducer': True, 'manifestOnlyNoRuntimeLoadedClaim': True, 'ePhaseRequiresActualSameIdentityJCompletionAndSeparateRootAuthorization': True, 'outMutationSuspendedUntilDPhasesComplete': True, 'verifiedCacheStatusRecord': '/tmp/vscode-m01-eighth-cache-status.json', 'verifiedCacheStatusRecordSha256': file_sha('/tmp/vscode-m01-eighth-cache-status.json')}
base.with_suffix('.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
assert git('rev-parse', 'HEAD') == head and git('rev-parse', 'HEAD:src') == source_tree and git('status', '--porcelain') == ''
fcntl.flock(lock, fcntl.LOCK_UN)
print(json.dumps({'sourceHead': head, 'sourceTree': source_tree, 'nativeCompileSourceHead': build['sourceHead'], 'nativeCompileOrdinal': 8, 'full163FreezeRecord': str(base.with_suffix('.json')), 'full163FreezeRawSha256': file_sha(base.with_suffix('.json')), 'canonicalFull163OutputsSha256': record['canonicalFull163OutputsSha256'], 'notices': notices, 'outFrozen': True}, ensure_ascii=False), flush=True)

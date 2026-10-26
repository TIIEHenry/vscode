import datetime, fcntl, hashlib, json, os, pathlib, re, stat, subprocess, tempfile

repo = pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
os.chdir(repo)
prefix = pathlib.Path('/tmp/vscode-m01-old0da-468d805ef929-lifecycle')
candidate = '468d805ef929298de9113f72665a3de0bdf4742a'
old_candidate = '0da326c052fdaac3d6ff9e2118ba95b001868f1f'
prior_candidate = '64a4e46b5fa27d48920789aa4b66e7340dfa833b'
test = 'src/vs/workbench/contrib/sources/test/browser/sourcesDiffMoveSource.test.ts'
pane = 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts'
sha = lambda data: hashlib.sha256(data).hexdigest()
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
git = lambda *args: subprocess.check_output(['git', *args], text=True).strip()
git_bytes = lambda ref, path: subprocess.check_output(['git', 'show', ref + ':' + path])
assert not prefix.with_suffix('.json').exists()
head = git('rev-parse', 'HEAD')
build = json.loads(pathlib.Path('/tmp/vscode-m01-seventh-native-build.json').read_text())
scope6 = json.loads(pathlib.Path('/tmp/vscode-m01-sixth-source-native-scope163.json').read_text())
assert head == build['sourceHead'] == '0930c43e7d2f2cc91d7d3355deaf5db270bc31fe'
assert build['exitCode'] == 0 and build['compileOrdinal'] == 7 and not build['diagnosticLines'] and len(build['outputs']) == 163
assert git('rev-parse', 'HEAD:src') == build['sourceTree'] and not git('status', '--porcelain')
assert git('rev-parse', candidate + '^') == prior_candidate
source = git_bytes(candidate, test)
assert sha(source) == 'eb81299cb0e6b170b888aa2e57ee5655d23613236b7a41c2d908c9132524577d'
prior = git_bytes(prior_candidate, test)
start = b'\tasync function feedbackPane('
end = b"\ttest('Pane move failure then current success restores only its local move notice'"
new_import = b"import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';\n"
def strip_fixture(data):
    return data[:data.index(start)] + data[data.index(end):]
assert strip_fixture(source).replace(new_import, b'') == strip_fixture(prior)
changed_src = git('diff', '--name-only', prior_candidate, candidate, '--', 'src').splitlines()
assert changed_src == [test]
continuity = {'phase': '468d-selected-original38-and-real4-continuity-with-lifecycle-fixture-change', 'candidate': candidate, 'priorCandidate': prior_candidate, 'oldFourHarnessCandidate': old_candidate, 'testSha256': sha(source), 'original38BodiesAssertionsAndFourRealCommandServiceHarnessExactToPrior': True, 'allSuiteCodeOutsideFeedbackFixtureAndLifecycleCaseExactExceptNewResolverImport': True, 'productionAllExactTo64a4AndA166': True, 'selectedOldFourEvidence': 'm01-old928-0da-third.json', 'fourOldRedsNotMechanicallyRerun': True, 'newLifecycleCaseNotClaimedUnchanged': True, 'newLifecyclePreconditionsRequireActualOldRun': True, 'completeTestDiff': subprocess.check_output(['git', 'diff', prior_candidate, candidate, '--', test], text=True)}
continuity_path = pathlib.Path('/tmp/vscode-m01-468d-harness-continuity.json')
continuity_path.write_text(json.dumps(continuity, ensure_ascii=False, indent=2) + '\n')
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
prefix.with_suffix('.processes-before.log').write_text(raw)
assert not matches, matches
lock = open('/tmp/vscode-compile.lock', 'a+')
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
raw, matches = scan()
prefix.with_suffix('.processes-under-lock.log').write_text(raw)
assert not matches, matches
backup_root = pathlib.Path(tempfile.mkdtemp(prefix='vscode-m01-old0da-468d-backup-'))
backups = []
old_by_source = {x['sourcePath']: x for x in scope6['outputs']}
assert len(old_by_source) == 163
for item in build['outputs']:
    path = pathlib.Path(item['outputPath'])
    data = path.read_bytes() if path.exists() else None
    assert (sha(data) if data is not None else None) == item['afterOutputSha256']
    assert sha(pathlib.Path(item['sourcePath']).read_bytes()) == item['sourceSha256']
    old = old_by_source[item['sourcePath']]
    if item['sourcePath'] not in [pane, test]:
        assert item['sourceSha256'] == old['sourceSha256'] and item['afterOutputSha256'] == old['outputSha256']
    b = {'path': str(path), 'exists': data is not None, 'sha256': sha(data) if data is not None else None, 'mode': stat.S_IMODE(path.stat().st_mode) if data is not None else None, 'sourcePath': item['sourcePath'], 'sourceSha256': item['sourceSha256'], 'backupPath': str(backup_root / path) if data is not None else None}
    if data is not None:
        dest = pathlib.Path(b['backupPath'])
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        os.chmod(dest, b['mode'])
        assert sha(dest.read_bytes()) == b['sha256']
    backups.append(b)
old_pane = old_by_source[pane]
old_source = git_bytes(old_candidate, pane)
assert sha(old_source) == old_pane['sourceSha256']
record = {'phase': '468d-new-lifecycle-fixture-on-reconstructed-byte-exact-compile6-old0da-Pane-with-compile7-finally-restore', 'candidate': candidate, 'sourceHead': head, 'sourceTree': build['sourceTree'], 'currentNativeCompileOrdinal': 7, 'currentNativeCompileExit': 0, 'oldPaneNativeCompileOrdinal': 6, 'oldPaneSourceCommit': old_candidate, 'startedAtUtc': now(), 'globalLaneMatches': [], 'sharedLockHeldAcrossBackupReconstructionRuntimeFinallyRestore': True, 'backupScope': 163, 'all163Backups': backups, 'oldPane': old_pane, 'all161SupportingSourceNativeExactToCompile6And7': True, 'sourceFilesNeverWritten': True, 'testSourceSha256': sha(source), 'selectedFourHarnessContinuity': str(continuity_path), 'selectedFourHarnessContinuitySha256': sha(continuity_path.read_bytes()), 'rootFilesystemWipNotConsumed': True, 'EAfterNeverStarted': True, 'outFrozen': False}
def save():
    prefix.with_suffix('.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
save()
transform = "import{transform}from'esbuild';let text='';for await(const c of process.stdin){text+=c;}const mode=process.argv[2];const r=await transform(text,{loader:'ts',format:'esm',target:'es2024',sourcemap:'inline',sourcesContent:mode==='production',sourcefile:mode==='production'?process.cwd()+'/'+process.argv[1]:process.argv[1],tsconfigRaw:{compilerOptions:{experimentalDecorators:true,useDefineForClassFields:false}},...(mode==='production'?{supported:{'class-static-blocks':false,'dynamic-import':true,'class-field':true}}:{})});process.stdout.write(r.code.replaceAll('.ts?esm','.js?esm'));"
try:
    old_code = subprocess.check_output(['node', '--input-type=module', '-e', transform, pane, 'production'], input=old_source)
    record['reconstructedOldPaneNativeSha256'] = sha(old_code)
    record['reconstructedOldPaneMatchesHistoricalCompile6Native'] = sha(old_code) == old_pane['outputSha256']
    save()
    assert record['reconstructedOldPaneMatchesHistoricalCompile6Native']
    test_code = subprocess.check_output(['node', '--input-type=module', '-e', transform, test, 'test'], input=source)
    record['temporaryTestOutputSha256'] = sha(test_code)
    pathlib.Path(old_pane['outputPath']).write_bytes(old_code)
    test_out = pathlib.Path('out/' + test[4:-3] + '.js')
    test_out.write_bytes(test_code)
    assert sha(pathlib.Path(old_pane['outputPath']).read_bytes()) == old_pane['outputSha256']
    record['onlyTemporarilyWrittenOutputs'] = [old_pane['outputPath'], str(test_out)]
    command = ['rtk', 'proxy', 'timeout', '--foreground', '-k', '15s', '240s', 'xvfb-run', '-a', './scripts/test.sh', '--no-sandbox', '--disable-gpu', '--timeout', '15000', '--run', test, '--grep', 'real Pane comparison view models release']
    record['command'] = command
    record['env'] = {'VSCODE_SKIP_PRELAUNCH': '1'}
    save()
    print(json.dumps({'running': '468d-new-lifecycle-test-on-byte-exact-old0da-Pane', 'backupScope': 163, 'oldPaneNativeSha256': old_pane['outputSha256'], 'reconstructionMatchesHistoricalNative': True, 'sourceFilesWritten': False, 'globalLaneMatches': 0, 'lockAcquired': True}), flush=True)
    with prefix.with_suffix('.log').open('wb') as log:
        result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, env={**os.environ, 'VSCODE_SKIP_PRELAUNCH': '1'})
    record['exitCode'] = result.returncode
    plain = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', prefix.with_suffix('.log').read_text(errors='replace'))
    record['mochaSummaries'] = [s.strip() for s in re.findall(r'^\s*\d+ (?:passing|failing|pending)\b.*$', plain, re.M)]
    reached = 'AssertionError [ERR_ASSERTION]: replacing input must release its comparison view model' in plain
    record['replacementDisposalBusinessAssertionReached'] = reached
    record['newInitialKeepaliveReferencesLoadOkModelsLiveAndVmCount1PreconditionsPassed'] = reached
    record['hasTimeoutOrLoadApiFailure'] = bool(re.search(r'Timeout of|ERR_MODULE_NOT_FOUND|SyntaxError:|TypeError:|ReferenceError:', plain))
    record['lifecycleOldBusinessRed'] = result.returncode == 1 and reached and any(s.startswith('0 passing') for s in record['mochaSummaries']) and '1 failing' in record['mochaSummaries'] and not record['hasTimeoutOrLoadApiFailure']
    record['laterSecondLoadStateCount2ClearAndDisposeAssertionsReached'] = False if reached else None
    print(plain[-7000:], flush=True)
finally:
    for b in backups:
        path = pathlib.Path(b['path'])
        if b['exists']:
            data = pathlib.Path(b['backupPath']).read_bytes()
            assert sha(data) == b['sha256']
            path.write_bytes(data)
            os.chmod(path, b['mode'])
        elif path.exists():
            path.unlink()
    record['all163OutputExistenceModeShaRestoredToCompile7'] = all(pathlib.Path(b['path']).exists() == b['exists'] and (not b['exists'] or (sha(pathlib.Path(b['path']).read_bytes()) == b['sha256'] and stat.S_IMODE(pathlib.Path(b['path']).stat().st_mode) == b['mode'])) for b in backups)
    record['all163SourceHashesUnchanged'] = all(sha(pathlib.Path(b['sourcePath']).read_bytes()) == b['sourceSha256'] for b in backups)
    record['currentPaneSourceNativeRestoredToCompile7'] = all(sha(pathlib.Path(b['path']).read_bytes()) == b['sha256'] for b in backups if b['sourcePath'] == pane)
    record['sourceHeadUnchanged'] = git('rev-parse', 'HEAD') == head
    record['sourceTreeUnchanged'] = git('rev-parse', 'HEAD:src') == build['sourceTree']
    record['worktreeCleanAfterRestore'] = not git('status', '--porcelain')
    record['finishedAtUtc'] = now()
    save()
    assert record['all163OutputExistenceModeShaRestoredToCompile7'] and record['all163SourceHashesUnchanged'] and record['currentPaneSourceNativeRestoredToCompile7'] and record['sourceHeadUnchanged'] and record['sourceTreeUnchanged'] and record['worktreeCleanAfterRestore']
    fcntl.flock(lock, fcntl.LOCK_UN)
    print(json.dumps({k: record.get(k) for k in ['exitCode', 'mochaSummaries', 'lifecycleOldBusinessRed', 'newInitialKeepaliveReferencesLoadOkModelsLiveAndVmCount1PreconditionsPassed', 'all163OutputExistenceModeShaRestoredToCompile7', 'all163SourceHashesUnchanged', 'worktreeCleanAfterRestore']}), flush=True)

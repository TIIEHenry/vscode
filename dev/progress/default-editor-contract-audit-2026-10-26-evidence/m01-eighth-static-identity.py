import datetime, fcntl, hashlib, json, os, pathlib, stat, subprocess

repo = pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
os.chdir(repo)
base = pathlib.Path('/tmp/vscode-m01-eighth-static-identity')
evidence = repo / 'dev/progress/default-editor-contract-audit-2026-10-26-evidence'
sha = lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
git = lambda *args: subprocess.check_output(['git', *args], text=True).strip()
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
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
build_path = pathlib.Path('/tmp/vscode-m01-eighth-native-build.json')
build = json.loads(build_path.read_text())
sixth_path = pathlib.Path('/tmp/vscode-m01-sixth-source-native-scope163.json')
sixth = json.loads(sixth_path.read_text())
assert build['compileOrdinal'] == 8 and build['exitCode'] == 0 and not build['diagnosticLines']
assert git('rev-parse', 'HEAD') == build['sourceHead']
assert git('rev-parse', 'HEAD:src') == build['sourceTree']
assert git('status', '--porcelain') == ''
new = {x['sourcePath']: x for x in build['outputs']}
old = {x['sourcePath']: x for x in sixth['outputs']}
assert len(new) == len(old) == 163 and new.keys() == old.keys()
for p, item in new.items():
    assert sha(p) == item['sourceSha256'] and sha(item['outputPath']) == item['afterOutputSha256'], p
changed = git('diff', '--name-only', sixth['sourceHead'], build['sourceHead'], '--', 'src').splitlines()
assert changed == ['src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts', 'src/vs/workbench/contrib/sources/test/browser/sourcesDiffMoveSource.test.ts'], changed
def same_rows(paths):
    rows = []
    for p in paths:
        a, b = old[p], new[p]
        assert a['sourceSha256'] == b['sourceSha256'] and a['outputSha256'] == b['afterOutputSha256'], p
        rows.append({'sourcePath': p, 'sourceSha256': b['sourceSha256'], 'outputPath': b['outputPath'], 'outputSha256': b['afterOutputSha256'], 'actualCurrentSourceAndNativeMatchSixthAndEighth': True})
    return rows
e_run_path = pathlib.Path('/tmp/vscode-m01-sixth-E-related-full.json')
e_run = json.loads(e_run_path.read_text())
assert e_run['exitCode'] == 1 and any('255 passing' in s for s in e_run['mochaSummaries']) and len(e_run['testFiles']) == 11
e_rows = same_rows(e_run['testFiles'])
node_prior = json.loads((evidence / 'm01-sixth-continuity.json').read_text())
node_paths = [x['sourcePath'] for x in node_prior['nodeRows']]
external_paths = [x['sourcePath'] for x in node_prior['externalBrowserRows']]
production_paths = [x['sourcePath'] for x in node_prior['unchangedProductionRows']]
node_rows = same_rows(node_paths)
external_rows = same_rows(external_paths)
production_rows = same_rows(production_paths)
for prior_group, rows in [('nodeRows', node_rows), ('externalBrowserRows', external_rows), ('unchangedProductionRows', production_rows)]:
    prior = {x['sourcePath']: x for x in node_prior[prior_group]}
    assert all(prior[x['sourcePath']]['sourceSha256'] == x['sourceSha256'] and prior[x['sourcePath']]['outputSha256'] == x['outputSha256'] for x in rows)
subtrees = []
for p in ['src/vs/platform/universeAgent', 'src/vs/workbench/contrib/conversation']:
    a = git('rev-parse', sixth['sourceHead'] + ':' + p)
    b = git('rev-parse', build['sourceHead'] + ':' + p)
    assert a == b
    subtrees.append({'path': p, 'sixthAndEighthGitTree': a})
unchanged = [p for p in new if new[p]['sourceSha256'] == old[p]['sourceSha256'] and new[p]['afterOutputSha256'] == old[p]['outputSha256']]
assert len(unchanged) == 161
record = {'phase': 'compile8-read-only-continuity-not-business-reruns', 'checkedAtUtc': now(), 'sourceHead': build['sourceHead'], 'sourceTree': build['sourceTree'], 'nativeCompileOrdinal': 8, 'nativeCompileExit': 0, 'nativeCompileRecordSha256': sha(build_path), 'sixthScope163RecordSha256': sha(sixth_path), 'sharedLockHeld': True, 'globalLaneMatches': [], 'all163ActualSourceNativeMatchCompile8': True, 'exactUnchangedFromSixthCount': 161, 'onlyChangedSourcesFromSixth': changed, 'unchangedSubtreeIdentities': subtrees, 'nodeTestCount': len(node_rows), 'nodeRows': node_rows, 'unchangedProductionCount': len(production_rows), 'unchangedProductionRows': production_rows, 'actualPriorNodeRun': node_prior['actualPriorNodeRun'], 'externalBrowserRows': external_rows, 'actualPriorExternalBrowser': node_prior['actualPriorExternalBrowser'], 'actualPriorE11': {'record': str(e_run_path), 'recordSha256': sha(e_run_path), 'exitCode': 1, 'mochaSummaries': e_run['mochaSummaries'], 'testCount': 11, 'rerunInEighth': False, 'allElevenActualSourceNativePairsUnchanged': True, 'existingRedPreserved': 'reasoning actual THINKING vs expected hmm\nthen this'}, 'e11Rows': e_rows, 'scopeLimit': 'Read-only exact source/native continuity reuses actual Node880, external-browser133 and sixth E11 255/1. Eighth new M0139 and complete J results are recorded separately as actual runtimes. No green/freeze/UI claim.', 'outFrozen': False}
base.with_suffix('.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
cache_path = pathlib.Path('/tmp/vscode-m01-fifth-cache-relocation.json')
cache = json.loads(cache_path.read_text())
assert cache['phase'] == 'owned-ignored-caches-relocated'
def inventory(root):
    rows = []
    for path in [root, *sorted(root.rglob('*'))]:
        info = path.lstat()
        item = {'path': '.' if path == root else str(path.relative_to(root)), 'mode': stat.S_IMODE(info.st_mode), 'uid': info.st_uid, 'gid': info.st_gid}
        if stat.S_ISLNK(info.st_mode):
            item.update(type='symlink', target=os.readlink(path))
        elif stat.S_ISDIR(info.st_mode):
            item.update(type='directory')
        elif stat.S_ISREG(info.st_mode):
            item.update(type='file', bytes=info.st_size, sha256=sha(path))
        else:
            raise AssertionError(str(path))
        rows.append(item)
    return rows
cache_rows = []
for item in cache['directories']:
    source = pathlib.Path(item['sourceDirectory'])
    dest = pathlib.Path(item['destinationDirectory'])
    assert source.is_symlink() and source.resolve() == dest
    actual = inventory(dest)
    assert actual == item['entries'], str(source)
    cache_rows.append({'sourceDirectory': str(source), 'destinationDirectory': str(dest), 'originalPathIsSymlink': True, 'fullModeTypePathUidGidByteShaInventoryMatches': True, 'entryCount': len(actual), 'fileBytes': item['fileBytes'], 'inventorySha256': hashlib.sha256(json.dumps(actual, sort_keys=True, separators=(',', ':')).encode()).hexdigest()})
available = lambda p: os.statvfs(p).f_bavail * os.statvfs(p).f_frsize
required = sum(x['fileBytes'] for x in cache_rows)
cache_record = {'phase': 'after-compile8-verified-stable-owned-cache-symlinks-retained', 'checkedAtUtc': now(), 'sourceHead': build['sourceHead'], 'sharedLockHeld': True, 'globalLaneMatches': [], 'originalRelocationRecord': str(cache_path), 'originalRelocationRecordSha256': sha(cache_path), 'directories': cache_rows, 'homeAvailableBytes': available(repo), 'tmpAvailableBytes': available('/tmp'), 'restoreFileBytes': required, 'restoreMarginBytes': 512 * 1024**2, 'restored': False, 'reason': 'Parent explicitly permits verified stable symlinks when full restore space plus margin is insufficient; no partial restore or unrelated deletion.', 'futureRestore': cache['restoreInstructions'], 'sourceOutEvidenceOtherWorktreesNotMovedOrDeleted': True, 'outFrozen': False}
assert cache_record['homeAvailableBytes'] < required + cache_record['restoreMarginBytes']
pathlib.Path('/tmp/vscode-m01-eighth-cache-status.json').write_text(json.dumps(cache_record, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'all163ActualSourceNativeMatchCompile8': True, 'unchangedFromSixth': len(unchanged), 'nodeTestsUnchanged': len(node_rows), 'productionPairsUnchanged': len(production_rows), 'e11TestsUnchanged': len(e_rows), 'cacheDirectoriesVerified': len(cache_rows), 'homeAvailableBytes': cache_record['homeAvailableBytes'], 'tmpAvailableBytes': cache_record['tmpAvailableBytes'], 'restoreFileBytes': required, 'restored': False}, ensure_ascii=False))
fcntl.flock(lock, fcntl.LOCK_UN)

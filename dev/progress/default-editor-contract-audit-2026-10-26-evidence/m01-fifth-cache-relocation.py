import pathlib, os, stat, hashlib, json, datetime, subprocess, fcntl, tempfile, shutil, sys
repo = pathlib.Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
os.chdir(repo)
base = pathlib.Path('/tmp/vscode-m01-fifth-cache-relocation')
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
available = lambda p: os.statvfs(p).f_bavail * os.statvfs(p).f_frsize
ancestors = set(); pid = os.getpid()
while pid > 0:
    ancestors.add(pid)
    try: pid = int(pathlib.Path('/proc', str(pid), 'stat').read_text().split()[3])
    except (FileNotFoundError, ValueError): break
patterns = ['compile-client', 'typecheck-client', 'transpile-client', 'gulp.js', 'build/next/index.ts transpile', 'build/next/index.ts watch', 'watch-client', 'tsc --project', 'tsgo --project', 'virtual-noemit', 'virtual-noEmit']
def scan():
    raw = subprocess.check_output(['ps', '-eo', 'pid,ppid,etime,args'], text=True)
    matches = []
    for line in raw.splitlines()[1:]:
        fields = line.strip().split(None, 3)
        if len(fields) == 4 and int(fields[0]) not in ancestors and any(p in fields[3] for p in patterns): matches.append(line)
    return raw, matches
def inventory(root):
    result = []
    for path in [root, *sorted(root.rglob('*'))]:
        info = path.lstat(); item = {'path': '.' if path == root else str(path.relative_to(root)), 'mode': stat.S_IMODE(info.st_mode), 'uid': info.st_uid, 'gid': info.st_gid}
        if stat.S_ISLNK(info.st_mode): item.update(type='symlink', target=os.readlink(path))
        elif stat.S_ISDIR(info.st_mode): item.update(type='directory')
        elif stat.S_ISREG(info.st_mode): item.update(type='file', bytes=info.st_size, sha256=sha(path))
        else: raise AssertionError(('unsupported cache entry', str(path)))
        result.append(item)
    return result
def no_handles(paths):
    matches = []
    prefixes = [str(p) for p in paths]
    for proc in pathlib.Path('/proc').iterdir():
        if not proc.name.isdigit() or int(proc.name) in ancestors: continue
        try:
            targets = [os.readlink(proc / 'cwd')]
            targets += [os.readlink(fd) for fd in (proc / 'fd').iterdir()]
            cmd = (proc / 'cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
            if any(any(t == p or t.startswith(p + '/') for p in prefixes) for t in targets) or any(p in cmd for p in prefixes): matches.append({'pid': int(proc.name), 'command': cmd})
        except (FileNotFoundError, PermissionError, ProcessLookupError): pass
    return matches
raw, matches = scan(); pathlib.Path(str(base) + '.' + sys.argv[1] + '.processes-before.log').write_text(raw); assert not matches, matches
lock = open('/tmp/vscode-compile.lock', 'a+'); fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
raw, matches = scan(); pathlib.Path(str(base) + '.' + sys.argv[1] + '.processes-under-lock.log').write_text(raw); assert not matches, matches
def save(): base.with_suffix('.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
if sys.argv[1] in ['relocate', 'extend']:
    extending = sys.argv[1] == 'extend'
    if extending:
        record = json.loads(base.with_suffix('.json').read_text()); assert record['phase'] == 'owned-ignored-caches-relocated'
        record['firstTwoCachesStillBelowOneGiB'] = record['homeAvailableAfter'] < 1024**3
        record['extensionStartedAtUtc'] = now()
        sources = [repo / 'node_modules/foundry-local-sdk']
    else:
        assert not base.with_suffix('.json').exists()
        sources = [repo / '.build/extensions', repo / '.build/electron']
    assert all(p.is_dir() and not p.is_symlink() and p.stat().st_uid == os.getuid() for p in sources)
    assert subprocess.check_output(['git', 'ls-files', *[str(p.relative_to(repo)) for p in sources]], text=True) == ''
    ignored = subprocess.check_output(['git', 'check-ignore', *[str(p.relative_to(repo)) for p in sources]], text=True).splitlines(); assert len(ignored) == len(sources)
    handles = no_handles(sources); assert not handles, handles
    native = json.loads(pathlib.Path('/tmp/vscode-je-formal-fourth-native-build.json').read_text())['outputs']
    outputs = {item['outputPath']: sha(pathlib.Path(item['outputPath'])) for item in native}
    helper = 'out/vs/workbench/contrib/sources/browser/sourcesDiffRefHelpers.js'; outputs[helper] = sha(pathlib.Path(helper))
    if not extending: record = {'phase': 'copying-owned-ignored-caches', 'startedAtUtc': now(), 'sharedLockHeld': True, 'globalLaneMatches': [], 'liveCacheHandles': [], 'homeAvailableBefore': available(repo), 'tmpAvailableBefore': available('/tmp'), 'sourceHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(), 'native155Before': outputs, 'directories': [], 'notSourceOutOrEvidence': True}
    save()
    for source in sources:
        entries = inventory(source); total = sum(x.get('bytes', 0) for x in entries); assert available('/tmp') > total + 512 * 1024**2
        parent = pathlib.Path(tempfile.mkdtemp(prefix='vscode-m01-fifth-' + source.name + '-')); destination = parent / source.name
        item = {'sourceDirectory': str(source), 'destinationDirectory': str(destination), 'gitIgnored': True, 'entries': entries, 'fileBytes': total, 'phase': 'copying'}; record['directories'].append(item); save()
        shutil.copytree(source, destination, symlinks=True, copy_function=shutil.copy2)
        assert inventory(destination) == entries and inventory(source) == entries
        item['copyInventoryExact'] = True; item['phase'] = 'verified-copy'; save()
        shutil.rmtree(source); source.symlink_to(destination, target_is_directory=True)
        assert source.is_symlink() and source.resolve() == destination and inventory(destination) == entries
        item['phase'] = 'relocated-with-original-path-symlink'; save()
    assert all(sha(pathlib.Path(p)) == v for p, v in outputs.items())
    record.update(phase='owned-ignored-caches-relocated', finishedAtUtc=now(), native155Unchanged=True, homeAvailableAfter=available(repo), tmpAvailableAfter=available('/tmp'), restoreInstructions='Under the same shared lock and empty global lane, copy each verified /tmp mirror into a temporary sibling, verify full mode/type/SHA/path inventory, replace only its declared original symlink with the verified directory, verify again, then remove only the verified temporary mirror. No source/out/evidence or other worktree paths are touched.')
    save(); assert available(repo) > 1024**3
elif sys.argv[1] == 'verify':
    record = json.loads(base.with_suffix('.json').read_text()); assert record['phase'] == 'owned-ignored-caches-relocated'
    for item in record['directories']:
        source = pathlib.Path(item['sourceDirectory']); destination = pathlib.Path(item['destinationDirectory'])
        assert source.is_symlink() and source.resolve() == destination and inventory(destination) == item['entries']
    record.update(postCompileMirrorInventoryExact=True, postCompileVerifiedAtUtc=now()); save()
elif sys.argv[1] == 'restore':
    record = json.loads(base.with_suffix('.json').read_text()); assert record['phase'] == 'owned-ignored-caches-relocated'
    sources = [pathlib.Path(x['sourceDirectory']) for x in record['directories']]
    handles = no_handles(sources); assert not handles, handles
    record['restoreStartedAtUtc'] = now(); record['restoreGlobalLaneMatches'] = []; record['restoreLiveCacheHandles'] = []; save()
    for item in record['directories']:
        source = pathlib.Path(item['sourceDirectory']); destination = pathlib.Path(item['destinationDirectory']); entries = item['entries']
        assert source.is_symlink() and source.resolve() == destination and inventory(destination) == entries
        assert available(repo) > item['fileBytes'] + 32 * 1024**2
        temporary = pathlib.Path(tempfile.mkdtemp(prefix='m01-restore-' + source.name + '-', dir=source.parent)); restored = temporary / source.name
        shutil.copytree(destination, restored, symlinks=True, copy_function=shutil.copy2); assert inventory(restored) == entries
        source.unlink(); restored.rename(source); temporary.rmdir(); assert not source.is_symlink() and inventory(source) == entries
        shutil.rmtree(destination); destination.parent.rmdir(); item.update(phase='restored-original-directory', restoredInventoryExact=True, temporaryMirrorRemovedAfterVerifiedRestore=True); save()
    record.update(phase='owned-ignored-caches-fully-restored', restoredAtUtc=now(), homeAvailableAfterRestore=available(repo), tmpAvailableAfterRestore=available('/tmp')); save()
else: raise AssertionError('relocate or restore required')
print(json.dumps({k: v for k, v in record.items() if k not in ['directories', 'native155Before']}, ensure_ascii=False))
fcntl.flock(lock, fcntl.LOCK_UN)

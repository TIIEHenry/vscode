"""Prepared run2 driver. Entry is fail closed until a separate explicit root release.
No execution, import of build APIs, lock, guard scan, emitter, test, or out write
is performed by the preparation operation that created this file.
"""
from pathlib import Path
import ctypes
import datetime
import fcntl
import hashlib
import json
import os
import re
import runpy
import secrets
import signal
import stat
import subprocess
import sys
import time
import traceback

ROOT = Path(__file__).resolve().parent
REPO = Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
PLAN = 'sources-accept-qualified-old-red-20261027-run2'
SOURCE_PATHS = [
    'src/vs/workbench/contrib/sources/test/browser/conversationDiffReviewPane.test.ts',
    'src/vs/workbench/contrib/sources/test/browser/sourcesDiffPanel.test.ts',
]
OUT_PATHS = [p.replace('src/', 'out/', 1)[:-3] + '.js' for p in SOURCE_PATHS]
GROUPS = [
    ('independent-input-dispose-a4', SOURCE_PATHS[0], r'Accept post-read authorization input\.dispose with live Pane and identical input sends no ApplyHunks$'),
    ('panel-a3-positive', SOURCE_PATHS[1], r'Accept post-read authorization Panel A3 s1 to s2 to s1 uses current authorization$'),
    ('original-default-false', SOURCE_PATHS[0], r'in-flight Accept does not ApplyHunks after clearInput bumps write generation$'),
]
TOKEN_KEY = 'VSCODE_SOURCES_OLD_RED_RUN2_STAGE_TOKEN'
DRIVER_NONCE_KEY = 'VSCODE_SOURCES_OLD_RED_RUN2_DRIVER_NONCE'
EXPECTED_SRC = 'a2c34649ee88df907c03b70c9ec3235cb1b4a9d9'
OLD_PROD = 'c7fefd780bd9720f3889e310d4706210189a3fc7'


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha(value):
    return hashlib.sha256(value).hexdigest()


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def load_json(path):
    return json.loads(path.read_text())


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def git(*args):
    return subprocess.check_output(['rtk', 'proxy', 'git', *args], cwd=REPO)


def gs(*args):
    return git(*args).decode().strip()


def load_binding():
    # No report, lock, process spawn or snapshot occurs before this gate.
    policy = load_json(ROOT / 'policy.json')
    manifest = load_json(ROOT / 'input-manifest.json')
    release = load_json(ROOT / 'execution-release.json')
    require(release.get('executionAuthorized') is True and
            release.get('state') == 'AUTHORIZED_OLD_RED_RUN2' and
            release.get('authorizedBy') == '/root' and
            isinstance(release.get('authorizationMessage'), str) and
            bool(release['authorizationMessage'].strip()),
            'FAIL CLOSED: no explicit root execution release; preparation/input binding grants no run permission')
    require(ROOT == Path('/tmp/vscode-sources-accept-qualified-old-red-20261027-run2'), 'Wrong scratch')
    require(policy['planId'] == manifest['planId'] == release['planId'] == PLAN, 'Wrong plan')
    require(policy['repo'] == manifest['repo'] == str(REPO), 'Wrong repo')
    require(policy['scratch'] == str(ROOT), 'Wrong policy scratch')
    for name in ['validate.py', 'emitter.mjs', 'policy.json', 'input-manifest.json']:
        require(sha((ROOT / name).read_bytes()) == release['pinnedFilesSha256'].get(name), 'Unpinned preparation/input file: ' + name)
    require(policy['sourcePaths'] == SOURCE_PATHS and policy['outputPaths'] == OUT_PATHS, 'Whitelist expansion')
    require((policy['sourceInputCount'], policy['temporaryTestJsWriteCount'], policy['productionWriteCount'], policy['standaloneMapCount']) == (2, 2, 0, 0), 'Wrong write counts')
    require((policy['watchdogSeconds'], policy['termGraceSeconds'], policy['killGraceSeconds']) == (45, 5, 5), 'Wrong watchdog bounds')
    require([(g['label'], g['sourcePath'], g['selector']) for g in policy['groups']] == GROUPS, 'Wrong groups/selectors')
    require(manifest['sourceTree'] == policy['sourceTree'] == EXPECTED_SRC, 'Wrong old source tree')
    require(manifest['oldProduction'] == policy['oldProduction'] == OLD_PROD, 'Wrong old production')
    require(manifest['expectedHead'] == policy['expectedHead'] == release['expectedHead'], 'Wrong baseline HEAD')
    candidate = manifest.get('candidateTests')
    require(isinstance(candidate, str) and re.fullmatch('[0-9a-f]{40}', candidate) is not None, 'Unbound immutable candidate')
    require(candidate == release['candidateTests'], 'Release/candidate mismatch')
    require(release['scope'] == 'old-production-two-testJs-three-isolated-groups-only', 'Wrong release scope')
    peer = manifest.get('peerReview', {})
    require(peer.get('Critical') == peer.get('Important') == peer.get('Minor') == 0 and bool(peer.get('source')), 'Missing final peer binding')
    require(len(manifest['sourceFiles']) == 2 and [x['sourcePath'] for x in manifest['sourceFiles']] == SOURCE_PATHS, 'Wrong input whitelist')
    require([x['outputPath'] for x in manifest['sourceFiles']] == OUT_PATHS, 'Wrong output whitelist')
    for row in manifest['sourceFiles']:
        require(row['sourceRef'] == candidate, 'Moving or mixed input ref')
        require(Path(row['inputCopyPath']) == ROOT / 'inputs' / row['sourcePath'], 'Input copy escaped scratch')
        require(re.fullmatch('[0-9a-f]{64}', row.get('sourceSha256', '')) is not None and re.fullmatch('[0-9a-f]{40}', row.get('sourceBlob', '')) is not None, 'Unbound input hash')
    require(sha(Path(policy['baselineFile']).read_bytes()) == policy['baselineFileSha256'], 'Post-probe baseline file changed')
    pins = {name: sha((ROOT / name).read_bytes()) for name in ['validate.py', 'emitter.mjs', 'policy.json', 'input-manifest.json', 'execution-release.json']}
    return policy, manifest, release, pins


def read_process(pid):
    try:
        base = Path('/proc') / str(pid)
        text = (base / 'stat').read_text()
        fields = text[text.rfind(')') + 2:].split()
        return {'pid': pid, 'state': fields[0], 'ppid': int(fields[1]),
                'pgrp': int(fields[2]), 'session': int(fields[3]),
                'startTime': fields[19],
                'argv': [x.decode(errors='replace') for x in (base / 'cmdline').read_bytes().split(b'\0') if x]}
    except (FileNotFoundError, ProcessLookupError, PermissionError, IndexError, ValueError):
        return None


def metadata(path):
    value = path.lstat()
    return {'type': stat.S_IFMT(value.st_mode), 'mode': stat.S_IMODE(value.st_mode), 'uid': value.st_uid, 'gid': value.st_gid, 'size': value.st_size, 'mtimeNs': value.st_mtime_ns, 'ctimeNs': value.st_ctime_ns}


def processes():
    rows = {}
    for path in Path('/proc').iterdir():
        if path.name.isdigit():
            row = read_process(int(path.name))
            if row is not None:
                rows[row['pid']] = row
    return rows


def has_token(pid, token):
    # Inspect only for the exact owned marker; do not retain or print environments.
    try:
        values = (Path('/proc') / str(pid) / 'environ').read_bytes().split(b'\0')
        return (TOKEN_KEY + '=' + token).encode() in values
    except (FileNotFoundError, ProcessLookupError, PermissionError):
        return False


def become_subreaper():
    require(sys.platform.startswith('linux') and hasattr(os, 'pidfd_open') and hasattr(signal, 'pidfd_send_signal'), 'Linux pidfd ownership support required before any child spawn')
    libc = ctypes.CDLL(None, use_errno=True)
    require(libc.prctl(36, 1, 0, 0, 0) == 0, 'Cannot enable PR_SET_CHILD_SUBREAPER')
    value = ctypes.c_int()
    require(libc.prctl(37, ctypes.byref(value), 0, 0, 0) == 0 and value.value == 1, 'Subreaper verification failed')


class OwnedStage:
    """One child session; validation parent remains outside its kill domain."""
    def __init__(self, label, token, entry, report):
        self.label, self.token, self.entry, self.report = label, token, entry, report
        self.proc = None
        self.root_pair = None
        self.ledger = {}
        self.start_mono = None
        self.deadline = None
        self.cleanup_done = False
        self.cleanup_started_mono = None
        self.sent_signals = {signal.SIGTERM: set(), signal.SIGKILL: set()}
        self.preexisting_direct_children = {pid for pid, row in processes().items() if row['ppid'] == os.getpid()}
        self.entry['ownedProcesses'] = []
        self.entry['signals'] = []
        self.entry['reapedAdoptedChildren'] = []
        self.entry['ownedXvfbSystemPaths'] = []

    def attach(self, proc):
        self.proc = proc
        self.start_mono = time.monotonic()
        self.deadline = self.start_mono + 45.0
        row = read_process(proc.pid)
        require(row is not None, 'Cannot qualify owned session leader')
        self.root_pair = (proc.pid, row['startTime'])
        self.remember(row, {'popen-root'})
        require(row['session'] == proc.pid and row['pgrp'] == proc.pid and row['session'] != os.getsid(0), 'Child was not isolated in a new session')
        self.entry.update({'rootPid': proc.pid, 'rootStartTime': row['startTime'], 'sessionId': row['session'], 'driverPid': os.getpid(), 'driverSessionId': os.getsid(0), 'stageTokenSha256': sha(self.token.encode()), 'watchdogSeconds': 45, 'termGraceSeconds': 5, 'killGraceSeconds': 5})

    def remember(self, row, reasons):
        key = (row['pid'], row['startTime'])
        if key not in self.ledger:
            record = {**row, 'ownershipReasons': sorted(reasons), 'firstObservedAtUtc': now()}
            self.ledger[key] = record
            self.entry['ownedProcesses'].append(record)
        else:
            record = self.ledger[key]
            record['ownershipReasons'] = sorted(set(record['ownershipReasons']) | reasons)
        record['lastObservedAtUtc'] = now()
        record['lastState'] = row['state']
        record['lastPpid'] = row['ppid']
        # Observe standard Xvfb socket/lock paths only for already-owned processes.
        # Process names never authorize a signal or a global kill.
        if row['argv'] and Path(row['argv'][0]).name == 'Xvfb':
            for arg in row['argv'][1:]:
                if re.fullmatch(r':\d+', arg):
                    number = arg[1:]
                    for text in ['/tmp/.X11-unix/X' + number, '/tmp/.X' + number + '-lock']:
                        path = Path(text)
                        try:
                            value = metadata(path)
                        except FileNotFoundError:
                            continue
                        if not any(item['path'] == text for item in self.entry['ownedXvfbSystemPaths']):
                            self.entry['ownedXvfbSystemPaths'].append({'path': text, 'metadata': value, 'owningPid': row['pid'], 'owningStartTime': row['startTime'], 'observedAtUtc': now()})

    def scan(self):
        ps = processes()
        owned = {}
        for pid, row in ps.items():
            key = (pid, row['startTime'])
            reasons = set()
            if key in self.ledger:
                reasons.add('previously-verified-pid-startTime')
            if key == self.root_pair:
                reasons.add('verified-session-root')
            if has_token(pid, self.token):
                reasons.add('exact-inherited-stage-token')
            if self.root_pair is not None and row['ppid'] == os.getpid() and pid not in self.preexisting_direct_children and int(row['startTime']) >= int(self.root_pair[1]):
                # No unrelated child is spawned while this synchronous stage runs.
                # Linux subreaper adoption catches descendants which cleared env/setsid.
                reasons.add('run-driver-direct-or-adopted-child')
            if reasons:
                owned[pid] = row
                self.remember(row, reasons)
        changed = True
        while changed:
            changed = False
            anchored_sessions = {row['session'] for row in owned.values()}
            for pid, row in ps.items():
                if pid in owned:
                    continue
                reasons = set()
                if row['ppid'] in owned:
                    reasons.add('verified-owned-parent-chain')
                if row['session'] in anchored_sessions:
                    reasons.add('verified-owned-session-member')
                if reasons:
                    owned[pid] = row
                    self.remember(row, reasons)
                    changed = True
        require(os.getpid() not in owned, 'Ownership must never include validation parent')
        return owned

    def reap(self):
        # Popen owns its root wait status; reap only verified adopted/direct descendants.
        if self.proc is not None:
            self.proc.poll()
        for (pid, start), record in list(self.ledger.items()):
            if self.proc is not None and pid == self.proc.pid:
                continue
            row = read_process(pid)
            if row is None or row['startTime'] != start or row['ppid'] != os.getpid():
                continue
            try:
                waited, status = os.waitpid(pid, os.WNOHANG)
                if waited:
                    self.entry['reapedAdoptedChildren'].append({'pid': pid, 'startTime': start, 'waitStatus': status, 'atUtc': now()})
            except ChildProcessError:
                pass

    def signal_verified(self, row, signum):
        key = (row['pid'], row['startTime'])
        require(key in self.ledger and row['pid'] != os.getpid(), 'Refuse unowned signal target')
        fd = None
        try:
            fd = os.pidfd_open(row['pid'], 0)
            current = read_process(row['pid'])
            if current is None or current['startTime'] != row['startTime']:
                return
            # pidfd pins the process; PID reuse between verification and signal is harmless.
            signal.pidfd_send_signal(fd, signum, None, 0)
            self.entry['signals'].append({'pid': row['pid'], 'startTime': row['startTime'], 'signal': signal.Signals(signum).name, 'via': 'verified-pidfd', 'atUtc': now()})
        except ProcessLookupError:
            pass
        finally:
            if fd is not None:
                os.close(fd)

    def quiesce(self, reason):
        if self.cleanup_done:
            require(not self.scan(), 'Owned process appeared after completed cleanup')
            return
        self.entry.setdefault('cleanupReasons', []).append(reason)
        if self.cleanup_started_mono is None:
            self.cleanup_started_mono = time.monotonic()
            self.entry['cleanupStartedAtUtc'] = now()
            self.reap()
            first = self.scan()
            self.entry['residualOwnedAtTopExitOrDeadline'] = list(first.values())
        # One nonrenewable 5s TERM + 5s KILL budget, including outer-finally retries.
        quiet = 0
        for signum, end_offset in [(signal.SIGTERM, 5.0), (signal.SIGKILL, 10.0)]:
            deadline = self.cleanup_started_mono + end_offset
            sent = self.sent_signals[signum]
            if time.monotonic() >= deadline:
                continue
            while True:
                self.reap()
                owned = self.scan()
                if not owned:
                    quiet += 1
                    if quiet >= 2:
                        self.cleanup_done = True
                        break
                else:
                    quiet = 0
                for row in owned.values():
                    key = (row['pid'], row['startTime'])
                    if row['state'] != 'Z' and key not in sent:
                        self.signal_verified(row, signum)
                        sent.add(key)
                if time.monotonic() >= deadline:
                    break
                time.sleep(0.04)
            if self.cleanup_done:
                break
        self.reap()
        residual = self.scan()
        self.entry['cleanupFinishedAtUtc'] = now()
        self.entry['remainingOwnedProcesses'] = list(residual.values())
        self.entry['allOwnedDescendantsStoppedAndReaped'] = not residual
        self.entry['ownedXvfbSystemPathsAfterCleanup'] = []
        for item in self.entry['ownedXvfbSystemPaths']:
            try:
                value = metadata(Path(item['path']))
            except FileNotFoundError:
                value = None
            self.entry['ownedXvfbSystemPathsAfterCleanup'].append({'path': item['path'], 'exists': value is not None, 'metadata': value})
        self.cleanup_done = not residual
        self.report()
        require(self.cleanup_done, 'Owned descendants remain after TERM5s/KILL5s; OUT RESTORATION FORBIDDEN')
        if self.proc is not None:
            require(self.proc.returncode is not None, 'Top process not reaped')


def parse_mocha(entry):
    raw = Path(entry['stdoutPath']).read_text(errors='replace')
    decoder, found = json.JSONDecoder(), []
    for pos, char in enumerate(raw):
        if char != '{':
            continue
        try:
            value, _ = decoder.raw_decode(raw[pos:])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and isinstance(value.get('stats'), dict) and 'failures' in value:
            found.append(value)
    if not found:
        return {'parsed': False, 'classification': 'external-watchdog-or-runner-output-requires-raw-review', 'businessRedCount': 0}
    data = found[-1]
    save(ROOT / (entry['stage'] + '.mocha.json'), data)
    failures = []
    for failure in data.get('failures', []):
        err = failure.get('err', {})
        text = '\n'.join(str(err.get(k, '')) for k in ['name', 'code', 'message', 'stack'])
        # Reporter often omits name/code; stack and actualJSON/expectedJSON are retained.
        kind = 'unclassified-requires-exact-trace-review'
        if re.search(r'TypeError|ReferenceError|SyntaxError|ERR_MODULE_NOT_FOUND|not a function', text):
            kind = 'fixture-api-load-before-business-boundary-review-required'
        elif re.search(r'disposable|leak|unexpected', text, re.I):
            kind = 'cleanup-or-meta-review-required-known-old-panel-vm-leak-must-be-separated'
        elif re.search(r'AssertionError|ERR_ASSERTION', text):
            kind = 'assertion-requires-exact-projection-review-not-auto-business-red'
        elif re.search(r'Timeout|timeout', text):
            kind = 'mocha-timeout'
        failures.append({'fullTitle': failure.get('fullTitle'), 'classification': kind, 'err': err})
    return {'parsed': True, 'stats': data['stats'], 'tests': data.get('tests', []), 'passes': data.get('passes', []), 'failures': failures, 'pending': data.get('pending', []), 'businessRedCount': 'requires-root-exact-raw-review'}


def main():
    # Deliberately outside try/finally which writes evidence: denied entry has zero run artifacts.
    policy, manifest, release, pins = load_binding()
    os.chdir(REPO)
    require(gs('rev-parse', manifest['candidateTests'] + '^{commit}') == manifest['candidateTests'], 'Candidate not an exact commit')
    require(gs('rev-parse', manifest['candidateTests'] + ':src') == manifest['candidateSourceTree'], 'Candidate source tree mismatch')
    for row in manifest['sourceFiles']:
        exact = git('show', row['sourceRef'] + ':' + row['sourcePath'])
        require(sha(exact) == row['sourceSha256'] and len(exact) == row['sourceBytes'] and exact == Path(row['inputCopyPath']).read_bytes(), 'Immutable input bytes mismatch')
        require(gs('rev-parse', row['sourceRef'] + ':' + row['sourcePath']) == row['sourceBlob'], 'Immutable blob mismatch')
    api = runpy.run_path(str(REPO / 'dev/progress/sources-accept-post-read-authorization-integration-audit.py'), run_name='audit')
    baseline = load_json(Path(policy['baselineFile']))
    r = {'runId': ROOT.name, 'startedAtUtc': now(), 'scope': release['scope'], 'repositoryHead': manifest['expectedHead'], 'repositorySourceTree': EXPECTED_SRC, 'candidateTests': manifest['candidateTests'], 'sourceInputs': manifest['sourceFiles'], 'peerReview': manifest['peerReview'], 'executionRelease': release, 'pinnedFilesSha256': pins, 'externalMainObservation': policy['externalMainObservation'], 'allowedOutPaths': OUT_PATHS, 'productionWriteCountAllowed': 0, 'testJsWriteCountAllowed': 2, 'standaloneMapsAllowed': 0, 'stages': [], 'guards': [], 'formalCandidateMerged': False, 'newGreenAuthorized': False, 'fullCompileOfFinalSourceTree': False, 'historicalFourFreezeFilesRewritten': False, 'cacheRelocated': False, 'restorationComplete': False}
    report_path = ROOT / 'validation-report.json'
    require(not report_path.exists(), 'Refuse evidence overwrite/reuse of this run directory')
    def report():
        save(report_path, r)
    def unchanged_preparation():
        for name, digest in pins.items():
            require(sha((ROOT / name).read_bytes()) == digest, 'Pinned run file changed: ' + name)
        require(sha(Path(policy['baselineFile']).read_bytes()) == policy['baselineFileSha256'], 'Baseline file changed')
    def identity():
        unchanged_preparation()
        require(gs('rev-parse', 'HEAD') == manifest['expectedHead'] and gs('rev-parse', 'HEAD:src') == EXPECTED_SRC and not gs('status', '--porcelain=v1'), 'Repository HEAD/src/clean identity changed')
    def fixedguard(before):
        identity()
        for path, row in before['freezeFiles'].items():
            require(sha(Path(path).read_bytes()) == row['sha256'] and api['meta'](Path(path)) == row['metadata'], 'Freeze changed: ' + path)
        for path, row in before['cacheSymlinks'].items():
            p = Path(path)
            require(p.is_symlink() and os.readlink(p) == row['target'] and str(p.resolve()) == row['resolved'] and api['meta'](p) == row['metadata'], 'Cache changed: ' + path)
        for row in before['pairs254'] + before['extra2PairsWithoutProducerCredit']:
            p = Path(row['sourcePath'])
            require(sha(p.read_bytes()) == row['sourceSha256'] and stat.S_IMODE(p.stat().st_mode) == row['sourceMode'], 'Source changed: ' + str(p))
    def guard(label, before, expected_out):
        fixedguard(before)
        actual = api['outmeta']()
        differences = sorted(p for p in set(actual) | set(expected_out) if actual.get(p) != expected_out.get(p))
        require(not differences, 'Out metadata changed at ' + label + ': ' + repr(differences))
        r['guards'].append({'label': label, 'atUtc': now(), 'exactStageMetadata': True, 'headSourceFreezeCacheExact': True})
        report()
    scopes = []
    nonce = secrets.token_hex(32)
    run_token = secrets.token_hex(32)
    def run_owned(label, args, overrides=None, emitter_mode=None):
        unchanged_preparation()
        stdout, stderr = ROOT / (label + '.stdout.log'), ROOT / (label + '.stderr.log')
        require(not stdout.exists() and not stderr.exists(), 'Refuse log overwrite')
        overrides = dict(overrides or {})
        token = run_token + ':' + label + ':' + secrets.token_hex(24)
        child_env = {**os.environ, **overrides, TOKEN_KEY: token, DRIVER_NONCE_KEY: nonce}
        if emitter_mode:
            child_env['VSCODE_SOURCES_OLD_RED_RUN2_EMITTER_MODE'] = emitter_mode
        command = ['rtk', 'proxy', *args]
        entry = {'stage': label, 'command': command, 'environmentOverrides': overrides, 'startedAtUtc': now(), 'stdoutPath': str(stdout), 'stderrPath': str(stderr), 'externalWatchdog': 'validation parent monotonic deadline; no GNU timeout wrapper'}
        r['stages'].append(entry)
        scope = OwnedStage(label, token, entry, report)
        scopes.append(scope)
        report()
        print(json.dumps({'running': label, 'atUtc': now(), 'command': command}), flush=True)
        timed_out = False
        try:
            with stdout.open('xb') as out, stderr.open('xb') as err:
                proc = subprocess.Popen(command, cwd=REPO, stdout=out, stderr=err, env=child_env, start_new_session=True)
                scope.proc = proc
                scope.attach(proc)
                while True:
                    scope.scan()
                    if proc.poll() is not None:
                        break
                    if time.monotonic() >= scope.deadline:
                        timed_out = True
                        break
                    time.sleep(0.04)
        finally:
            if scope.proc is not None:
                scope.quiesce('monotonic-45s-deadline' if timed_out else 'top-exit-or-driver-exception-always-check-descendants')
            else:
                scope.cleanup_done = True
            entry.update({'finishedAtUtc': now(), 'exitCode': scope.proc.returncode if scope.proc is not None else None, 'externalWatchdogExpired': timed_out, 'elapsedMonotonicSeconds': time.monotonic() - scope.start_mono if scope.start_mono is not None else None})
            for name, path in [('stdout', stdout), ('stderr', stderr)]:
                if path.exists():
                    entry[name + 'Sha256'], entry[name + 'Bytes'] = sha(path.read_bytes()), path.stat().st_size
            report()
        return entry
    lock, before, seals = None, None, []
    previous_handlers = {}
    def interrupted(signum, frame):
        raise RuntimeError('Validation parent interrupted by ' + signal.Signals(signum).name)
    try:
        identity()
        r['processScanBeforeLock'] = api['scan']()
        lock = open('/tmp/vscode-compile.lock', 'a+')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        r['sharedLockHeld'] = True
        r['processScanUnderLock'] = api['scan']()
        before = api['snapshot']()
        require(before == baseline, 'Current complete snapshot differs from pinned latest post-probe baseline; no rebaseline allowed')
        require(sum(not stat.S_ISDIR(x['type']) for x in before['outMetadata'].values()) == 12554 and sum(stat.S_ISDIR(x['type']) for x in before['outMetadata'].values()) == 2946, 'Unexpected out counts')
        save(ROOT / 'guard-before.json', before)
        old = REPO / 'dev/progress/sources-accept-post-read-authorization-old-red-evidence'
        old_emit = load_json(old / 'emit-emitter-report.json')
        old_seals = {x['path']: x for x in load_json(old / 'sealed-originals.json')}
        continuity = []
        expected_prod = {
            'out/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.js': '79b5c7f0bededd758837b2cd138ae8065b82148ce76dcd3cad8911b09832d528',
            'out/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.js': '437050db9832f549a4db2d738c1763f976afac8b45438bffac885887543100e0',
            'out/vs/workbench/contrib/sources/common/sourcesDiffWriteController.js': '98b705105bf94df14c87d9c8a9cd7d0ab8e3c2ba1436085db6f287a9105671f8',
        }
        for row in old_emit['outputs']:
            if row['role'] != 'exact-c7-old-production':
                continue
            path = row['outputPath']
            archived, sealed = old / 'emit-generated' / path[4:], old / 'sealed-originals' / path
            require(path in expected_prod and row['sourceRef'] == OLD_PROD, 'Wrong run1 production qualification')
            require(sha(Path(path).read_bytes()) == row['sha256'] == old_seals[path]['sha256'] == sha(archived.read_bytes()) == sha(sealed.read_bytes()) == expected_prod[path], 'Old production byte continuity lost')
            for committed in [old / 'emit-emitter-report.json', archived, sealed]:
                require(committed.read_bytes() == git('show', manifest['expectedHead'] + ':' + str(committed.relative_to(REPO))), 'Old qualification artifact differs from Git')
            continuity.append({'outputPath': path, 'freshRun1C7Producer': row, 'currentSha256': expected_prod[path], 'committedEmitAndSealSha256': expected_prod[path], 'productionWrittenInRun2': False})
        require(len(continuity) == 3, 'Need exact three production producer continuities')
        save(ROOT / 'production-continuity.json', {'source': 'actual run1 fresh c7 emitter -> sealed original -> committed emit/seal copies -> current bytes; no producer credit inferred from historical254', 'rows': continuity, 'productionOutWritesAllowed': False})
        r['productionQualification'] = continuity
        for path in OUT_PATHS:
            p, copy = Path(path), ROOT / 'sealed-originals' / path
            require(p.is_file() and not p.is_symlink(), 'Out target must be existing regular non-symlink')
            s, b = p.stat(), p.read_bytes()
            copy.parent.mkdir(parents=True, exist_ok=True)
            copy.write_bytes(b)
            seals.append({'path': path, 'sha256': sha(b), 'bytes': len(b), 'mode': stat.S_IMODE(s.st_mode), 'mtimeNs': s.st_mtime_ns, 'atimeNs': s.st_atime_ns, 'ctimeNs': s.st_ctime_ns, 'mtimeNsString': str(s.st_mtime_ns), 'ctimeNsString': str(s.st_ctime_ns), 'sealedBytesPath': str(copy)})
        save(ROOT / 'sealed-originals.json', seals)
        guard('before-dry', before, before['outMetadata'])
        become_subreaper()
        for signum in [signal.SIGTERM, signal.SIGINT]:
            previous_handlers[signum] = signal.signal(signum, interrupted)
        dry = run_owned('dry-enumeration', ['node', str(ROOT / 'emitter.mjs'), 'dry'], emitter_mode='dry')
        guard('after-dry-zero-out-writes', before, before['outMetadata'])
        require(dry['exitCode'] == 0 and not dry['externalWatchdogExpired'], 'Dry emitter failed; no emit/test allowed')
        dry_data = load_json(ROOT / 'dry-emitter-report.json')
        require([x['outputPath'] for x in dry_data['outputs']] == OUT_PATHS and dry_data['standaloneMapCount'] == 0 and dry_data['outWriteFileCalls'] == [] and dry_data['actualInputCount'] == 2, 'Dry exact2 JS/zero map/no write enumeration failed')
        emit = run_owned('temporary-two-test-emit', ['node', str(ROOT / 'emitter.mjs'), 'emit'], emitter_mode='emit')
        require(emit['exitCode'] == 0 and not emit['externalWatchdogExpired'], 'Emitter failed; no business tests allowed')
        emitted = load_json(ROOT / 'emit-emitter-report.json')
        require([x['path'] for x in emitted['outWriteFileCalls']] == OUT_PATHS and len(emitted['outWriteFileCalls']) == 2 and emitted['standaloneMapCount'] == 0, 'Actual output write calls not exact2 test JS')
        for row in emitted['outputs']:
            require(sha(Path(row['outputPath']).read_bytes()) == row['sha256'], 'Written output hash mismatch')
        mixed = api['outmeta']()
        changed = sorted(p for p in set(mixed) | set(before['outMetadata']) if mixed.get(p) != before['outMetadata'].get(p))
        require(changed == OUT_PATHS, 'Only two allowed out metadata rows may change')
        save(ROOT / 'guard-after-emit-out-metadata.json', mixed)
        r['actualOutWriteFileCalls'] = emitted['outWriteFileCalls']
        r['actualEmittedIdentity'] = emitted['outputs']
        guard('after-exact-two-test-emit', before, mixed)
        product = load_json(REPO / 'product.json')
        electron = REPO / '.build/electron' / product['applicationName']
        require(electron.is_file(), 'Missing existing Electron')
        r['officialRunner'] = {'electronPath': str(electron), 'resolvedElectronPath': str(electron.resolve()), 'entryPoint': 'test/unit/electron/index.js', 'reason': 'direct official entry; own crash/Xvfb/TMPDIR/XDG/initial user-data paths; official non-dev runner then sets userData below this TMPDIR; no preLaunch/profile/engine'}
        for label, source, selector in GROUPS:
            runtime = ROOT / ('runtime-' + label)
            runtime.mkdir()
            for subdir in ['tmp', 'config', 'cache', 'data', 'user-data', 'crashes']:
                (runtime / subdir).mkdir()
            env = {'TMPDIR': str(runtime / 'tmp'), 'XDG_CONFIG_HOME': str(runtime / 'config'), 'XDG_CACHE_HOME': str(runtime / 'cache'), 'XDG_DATA_HOME': str(runtime / 'data'), 'ELECTRON_ENABLE_LOGGING': '1', 'VSCODE_SKIP_PRELAUNCH': '1'}
            args = ['xvfb-run', '-a', '-e', str(runtime / 'xvfb.stderr.log'), str(electron), '--user-data-dir=' + str(runtime / 'user-data'), 'test/unit/electron/index.js', '--crash-reporter-directory=' + str(runtime / 'crashes'), '--no-sandbox', '--disable-gpu', '--timeout', '15000', '--reporter', 'json', '--run', source, '--grep', selector]
            entry = run_owned(label, args, env)
            entry['mocha'] = parse_mocha(entry)
            report()
            guard('after-' + label, before, mixed)
        r['phase'], r['exitCode'] = 'three-qualified-old-production-groups-finished-awaiting-exact-root-review', 0
    except BaseException as error:
        r['failure'], r['traceback'] = repr(error), traceback.format_exc()
        r['phase'], r['exitCode'] = 'stopped-on-actual-failure', 1
        print(r['traceback'], flush=True)
    finally:
        # Every child session is terminated/reaped BEFORE either test output is restored.
        r['restoreStartedAtUtc'] = now()
        restored = []
        try:
            for scope in scopes:
                if scope.proc is not None and not scope.cleanup_done:
                    scope.quiesce('outer-finally-before-any-out-restoration')
                if scope.proc is not None:
                    require(not scope.scan() and scope.cleanup_done, 'OUT RESTORATION FORBIDDEN: owned descendants remain')
            r['allOwnedProcessesStoppedBeforeOutRestoration'] = True
            if before is not None:
                fixedguard(before)
                for seal in seals:
                    p, copy = Path(seal['path']), Path(seal['sealedBytesPath'])
                    b = copy.read_bytes()
                    require(sha(b) == seal['sha256'], 'Sealed bytes corrupt')
                    require(p.is_file() and not p.is_symlink(), 'Refuse restoring replaced/symlink output')
                    s = p.stat()
                    if sha(p.read_bytes()) != seal['sha256'] or stat.S_IMODE(s.st_mode) != seal['mode'] or s.st_mtime_ns != seal['mtimeNs']:
                        p.write_bytes(b)
                        if stat.S_IMODE(p.stat().st_mode) != seal['mode']:
                            p.chmod(seal['mode'])
                        os.utime(p, ns=(seal['atimeNs'], seal['mtimeNs']))
                        restored.append(seal['path'])
                after = api['snapshot']()
                save(ROOT / 'guard-after-restore.json', after)
                require({k: v for k, v in after.items() if k != 'outMetadata'} == {k: v for k, v in before.items() if k != 'outMetadata'}, 'Source/native/freeze/cache restoration mismatch')
                require(set(after['outMetadata']) == set(before['outMetadata']), 'Out paths added/removed')
                differences = []
                for path, old_row in before['outMetadata'].items():
                    new_row = after['outMetadata'][path]
                    if old_row != new_row:
                        keys = [k for k in old_row if old_row[k] != new_row[k]]
                        require(path in OUT_PATHS and keys == ['ctimeNs'], 'Unexpected restoration metadata change: ' + repr((path, keys)))
                        differences.append({'path': path, 'changedMetadataKeys': keys, 'beforeCtimeNs': old_row['ctimeNs'], 'afterCtimeNs': new_row['ctimeNs']})
                require(set(restored).issubset(set(OUT_PATHS)), 'Restored outside authorized pair')
                r['restorationComplete'] = True
                r['restoreGuard'] = {'finishedAtUtc': now(), 'restoredPaths': restored, 'allTwoOriginalBytesModeMtimeExact': True, 'other12552FilesFullMetadataExact': True, 'all2946DirectoriesMetadataExact': True, 'all254AndExtra2PairsExact': True, 'allFourOriginalFreezeFilesExact': True, 'allThreeOriginalCacheSymlinksExact': True, 'authorizedCtimeDifferences': differences, 'noOtherOutChanges': True, 'headSourceCleanUnchanged': True, 'baselineFileNotRewritten': True}
        except BaseException as error:
            r['restoreFailure'], r['restoreTraceback'], r['exitCode'] = repr(error), traceback.format_exc(), 1
            print(r['restoreTraceback'], flush=True)
        runtime_files = []
        for runtime in sorted(ROOT.glob('runtime-*')):
            for directory, dirs, files in os.walk(runtime):
                for name in ['.'] + dirs + files:
                    path = Path(directory) if name == '.' else Path(directory) / name
                    try:
                        runtime_files.append({'path': str(path), 'metadata': metadata(path), 'symlinkTarget': os.readlink(path) if path.is_symlink() else None})
                    except FileNotFoundError:
                        pass
        r['runtimeFilesystemManifest'] = runtime_files
        r['finishedAtUtc'] = now()
        report()
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)
        if lock is not None:
            fcntl.flock(lock, fcntl.LOCK_UN)
            lock.close()
        print(json.dumps({'phase': r.get('phase'), 'exitCode': r.get('exitCode'), 'restorationComplete': r['restorationComplete'], 'allOwnedProcessesStoppedBeforeOutRestoration': r.get('allOwnedProcessesStoppedBeforeOutRestoration', False), 'testStages': [{'stage': x['stage'], 'exitCode': x.get('exitCode'), 'externalWatchdogExpired': x.get('externalWatchdogExpired'), 'stats': x.get('mocha', {}).get('stats')} for x in r['stages'] if 'mocha' in x]}), flush=True)
    return r.get('exitCode', 1)


if __name__ == '__main__':
    try:
        result = main()
    except BaseException as error:
        # Includes denied/unbound release: stderr only, no run artifacts created.
        print(str(error), file=sys.stderr, flush=True)
        result = 2
    sys.exit(result)

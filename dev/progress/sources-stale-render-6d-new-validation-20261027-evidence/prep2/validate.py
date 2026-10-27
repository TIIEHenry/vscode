"""Prepared new-source validation driver. Entry is fail closed until a separate explicit root release.
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
PLAN = 'vscode-sources-stale-render-6d-validation-20261027-prep2'
EXPECTED_HEAD = '01c0addecff0b3ddd98afc1259c00a9f0ceaa3ba'
EXPECTED_SRC = '4243970658ddd668d1f89e0a97d7f41ba94d3300'
SOURCE_REF = '6d848eacc578dea0c5c6f39721b00047f9c12469'
TOKEN_KEY = 'VSCODE_SOURCES_OLD_RED_RUN2_STAGE_TOKEN'
DRIVER_NONCE_KEY = 'VSCODE_SOURCES_OLD_RED_RUN2_DRIVER_NONCE'
PIN_NAMES = ['validate.py', 'emitter.mjs', 'source-checker.mjs', 'linter.mjs', 'binding.mjs', 'reporter.cjs', 'guard.py', 'policy.json', 'input-manifest.json', 'expected-fullTitles.json', 'expected-accept-fullTitles.txt', 'expected-lifetime-fullTitles.txt', 'expected-new72-fullTitles.txt', 'source-inputs.json']


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
    policy, manifest, release = [load_json(ROOT / p) for p in ['policy.json', 'input-manifest.json', 'execution-release.json']]
    require(release.get('executionAuthorized') is True and release.get('state') == 'AUTHORIZED_NEW_VALIDATION_ONCE' and release.get('authorizedBy') == '/root' and isinstance(release.get('authorizationMessage'), str) and release['authorizationMessage'].strip(), 'FAIL CLOSED: separate explicit root execution release required; preparation grants no execution')
    require(ROOT == Path('/tmp/vscode-sources-stale-render-6d-validation-20261027-prep2'), 'Wrong scratch')
    require(policy['planId'] == manifest['planId'] == release['planId'] == PLAN and policy['repo'] == manifest['repo'] == str(REPO), 'Wrong plan/repo')
    require(policy['expectedHead'] == manifest['expectedHead'] == release['expectedHead'] == EXPECTED_HEAD and policy['sourceTree'] == manifest['sourceTree'] == EXPECTED_SRC and policy['sourceRef'] == manifest['sourceRef'] == release['sourceRef'] == SOURCE_REF, 'Fixed identity mismatch')
    require(release['scope'] == 'fixed-five-file-check-lint-dry-emit-two-full-official-modules', 'Expanded release scope')
    require(set(release['pinnedFilesSha256']) == set(PIN_NAMES), 'Incomplete/expanded pinned preparation surface')
    for name in PIN_NAMES:
        require(sha((ROOT / name).read_bytes()) == release['pinnedFilesSha256'][name], 'Unpinned preparation file: ' + name)
    require((policy['sourceInputCount'], policy['temporaryJsWriteCount'], policy['productionWriteCount'], policy['testJsWriteCount'], policy['standaloneMapCount']) == (5, 5, 3, 2, 0), 'Wrong write whitelist/counts')
    require([r['sourcePath'] for r in manifest['sourceFiles']] == policy['sourcePaths'] and [r['outputPath'] for r in manifest['sourceFiles']] == policy['outputPaths'], 'Source/output whitelist mismatch')
    require((policy['watchdogSeconds'], policy['termGraceSeconds'], policy['killGraceSeconds']) == (45, 5, 5), 'Watchdog bounds changed')
    require(len(policy['groups']) == 2 and all(g['selector'] is None and g['grepAllowed'] is False and g['runWholeModule'] is True for g in policy['groups']), 'Only two complete modules, no grep')
    require(len(manifest['sourceFiles']) == 5 and manifest['peerReview']['Critical'] == manifest['peerReview']['Important'] == manifest['peerReview']['Minor'] == 0, 'Wrong inputs/peer binding')
    pins = {name: sha((ROOT / name).read_bytes()) for name in PIN_NAMES + ['execution-release.json']}
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


def parse_mocha(entry, expected):
    raw = Path(entry['stdoutPath']).read_text(errors='replace')
    decoder, events, official = json.JSONDecoder(), [], []
    pos = 0
    known = {'start', 'end', 'testStart', 'pass', 'fail', 'pendingObserved', 'testEndObserved', 'hookStartObserved', 'hookEndObserved', 'observerEnd'}
    while pos < len(raw):
        candidates = [p for p in [raw.find('{', pos), raw.find('[', pos)] if p >= 0]
        if not candidates:
            break
        begin = min(candidates)
        try:
            value, length = decoder.raw_decode(raw[begin:])
        except json.JSONDecodeError:
            pos = begin + 1
            continue
        pos = begin + length
        if isinstance(value, list) and len(value) == 2 and value[0] in known and isinstance(value[1], dict):
            events.append({'event': value[0], 'data': value[1]})
        elif isinstance(value, dict) and isinstance(value.get('stats'), dict) and isinstance(value.get('tests'), list) and isinstance(value.get('failures'), list):
            official.append(value)
    save(ROOT / (entry['stage'] + '.observed-events.json'), events)
    data = official[-1] if official else None
    if data is not None:
        save(ROOT / (entry['stage'] + '.mocha.json'), data)
    def observed(kind, title):
        return [r['data'] for r in events if r['event'] == kind and r['data'].get('fullTitle') == title]
    qualifications = []
    for title in expected['declaredFullTitles']:
        starts, ends, passes, fails, pending = [observed(kind, title) for kind in ['testStart', 'testEndObserved', 'pass', 'fail', 'pendingObserved']]
        state = 'pending-or-skipped' if pending else 'reported-body-failure' if fails else 'body-pass' if passes else 'started-not-completed' if starts else 'not-reported'
        qualifications.append({'fullTitle': title, 'expectedGroup': 'new-Accept' if title in expected['newAcceptFullTitles'] else 'new-lifetime' if title in expected['newLifetimeFullTitles'] else 'legacy-module-test', 'testStartCount': len(starts), 'testEndCount': len(ends), 'bodyPassCount': len(passes), 'bodyFailureCount': len(fails), 'pendingCount': len(pending), 'classification': state, 'arrivedFromActualReporter': bool(starts), 'completedFromActualReporter': bool(ends), 'bodyPassDoesNotProveHookOrSuiteClean': True})
    failures = []
    for item in [r['data'] for r in events if r['event'] == 'fail']:
        title = item.get('fullTitle', '')
        text = '\n'.join(str(item.get(k, '')) for k in ['err', 'stack'])
        is_hook = bool(re.search(r'"(?:before|after)(?: each| all)?" hook|hook for', title)) or bool(observed('hookStartObserved', title))
        kind = 'hook-failure' if is_hook else 'fixture-api-load-boundary-review' if re.search(r'TypeError|ReferenceError|SyntaxError|ERR_MODULE_NOT_FOUND|not a function', text) else 'body-failure-boundary-review'
        failures.append({'fullTitle': title, 'classification': kind, 'rawOfficialStreamFailure': item})
    end_stats = [r['data'] for r in events if r['event'] == 'end']
    stats = data['stats'] if data is not None else end_stats[-1] if end_stats else None
    end_observed = bool(end_stats) and any(r['event'] == 'observerEnd' for r in events)
    rows_clean = all(r['testStartCount'] == r['testEndCount'] == r['bodyPassCount'] == 1 and r['bodyFailureCount'] == r['pendingCount'] == 0 for r in qualifications)
    required_titles = expected['declaredFullTitles'] + expected['officialMetaFullTitles']
    actual_test_titles = [item.get('fullTitle') for item in data.get('tests', [])] if data else []
    actual_pass_titles = [item.get('fullTitle') for item in data.get('passes', [])] if data else []
    required_count = expected['expectedOfficialTestCount']
    official_exact = bool(data is not None and len(required_titles) == required_count and sorted(actual_test_titles) == sorted(required_titles) and sorted(actual_pass_titles) == sorted(required_titles) and stats and stats.get('tests') == stats.get('passes') == required_count and stats.get('pending') == stats.get('failures') == 0 and not data.get('pending') and not data.get('failures'))
    meta_rows = [{'fullTitle': title, **{key: len(observed(kind, title)) for key, kind in [('testStartCount', 'testStart'), ('testEndCount', 'testEndObserved'), ('bodyPassCount', 'pass'), ('bodyFailureCount', 'fail'), ('pendingCount', 'pendingObserved')]}} for title in expected['officialMetaFullTitles']]
    meta_clean = all(row['testStartCount'] == row['testEndCount'] == row['bodyPassCount'] == 1 and row['bodyFailureCount'] == row['pendingCount'] == 0 for row in meta_rows)
    hook_titles = sorted({row['data'].get('fullTitle', '') for row in events if row['event'] in ['hookStartObserved', 'hookEndObserved']})
    hook_rows = [{'fullTitle': title, 'startCount': len(observed('hookStartObserved', title)), 'endCount': len(observed('hookEndObserved', title))} for title in hook_titles]
    hook_start_count = sum(row['startCount'] for row in hook_rows)
    hook_end_count = sum(row['endCount'] for row in hook_rows)
    hooks_clean = hook_start_count == hook_end_count == expected['expectedObservedHookStartEndCount'] and all(row['startCount'] == row['endCount'] for row in hook_rows)
    raw_test_start_titles = {row['data'].get('fullTitle') for row in events if row['event'] == 'testStart'}
    missing_titles = sorted(set(required_titles) - raw_test_start_titles)
    unknown_titles = sorted(raw_test_start_titles - set(required_titles))
    legacy_identity = expected.get('legacyStaleCase')
    legacy_row = next((row for row in qualifications if legacy_identity and row['fullTitle'] == legacy_identity['fullTitle']), None)
    legacy_clean = legacy_identity is None or bool(legacy_row and legacy_row['testStartCount'] == legacy_row['testEndCount'] == legacy_row['bodyPassCount'] == 1 and legacy_row['bodyFailureCount'] == legacy_row['pendingCount'] == 0)
    clean = bool(data is not None and end_observed and stats and stats.get('failures') == 0 and stats.get('pending') == 0 and entry.get('exitCode') == 0 and not entry.get('externalWatchdogExpired') and rows_clean and not failures and official_exact and meta_clean and hooks_clean and legacy_clean and not missing_titles and not unknown_titles)
    result = {'officialJSONParsed': data is not None, 'officialStreamEventCount': len(events), 'actualRuntimeStats': stats, 'officialRunEndObserved': end_observed, 'officialRuntimeTests': data.get('tests', []) if data else None, 'officialRuntimePasses': data.get('passes', []) if data else None, 'officialRuntimeFailures': data.get('failures', []) if data else None, 'officialRuntimePending': data.get('pending', []) if data else None, 'partialReporterOnly': not (data is not None and end_observed), 'perExpectedFullTitle': qualifications, 'separateObservedFailuresIncludingHooks': failures, 'observedHookStartCount': sum(r['event'] == 'hookStartObserved' for r in events), 'observedHookEndCount': sum(r['event'] == 'hookEndObserved' for r in events), 'cleanCompleteModule': clean, 'countsSource': 'Only actual official reporter events/JSON. Static expected lists never serve as runtime counts; missing is not-reported, not fabricated failure/pass.', 'extraObservedFullTitles': sorted({r['data']['fullTitle'] for r in events if r['data'].get('fullTitle') and r['data']['fullTitle'] not in expected['declaredFullTitles']})}
    result.update({'requiredOfficialTestCount': required_count, 'requiredOfficialFullTitles': required_titles, 'officialCountsAndTitlesExact': official_exact, 'officialMetaQualification': meta_rows, 'officialMetaClean': meta_clean, 'hookStartEndPerTitle': hook_rows, 'expectedHookStartEndCount': expected['expectedObservedHookStartEndCount'], 'hooksBalancedAndExact': hooks_clean, 'missingRequiredTestStarts': missing_titles, 'unknownTestStarts': unknown_titles, 'legacyStaleCaseIdentity': legacy_identity, 'legacyStaleCaseActualQualification': legacy_row, 'legacyOriginalFourAssertionSourcePlusWholeBodyQualification': 'qualified-from-fixed-source-and-actual-whole-case-body-pass' if legacy_identity and legacy_clean else 'not-established' if legacy_identity else 'not-applicable', 'individualAssertionRuntimeHooksUsed': False, 'legacyAssertionEvidenceKind': 'Fixed source byte/control-flow identity plus actual whole-case body outcome; no individual assertion observations'})
    save(ROOT / (entry['stage'] + '.qualification.json'), result)
    return result


def main():
    policy, manifest, release, pins = load_binding()
    os.chdir(REPO)
    def unchanged_preparation():
        for name, digest in pins.items():
            require(sha((ROOT / name).read_bytes()) == digest, 'Pinned file changed: ' + name)
        require(sha(Path(policy['baselineFile']).read_bytes()) == policy['baselineFileSha256'], 'Actual restored metadata baseline changed')
        require(sha(Path(manifest['sourceIdentityBaselineFile']).read_bytes()) == manifest['sourceIdentityBaselineFileSha256'], 'Current source/native identity baseline changed')
        for row in manifest['boundToolAndConfigFiles']:
            b = Path(row['path']).read_bytes()
            require(len(b) == row['bytes'] and sha(b) == row['sha256'], 'Tool/config changed: ' + row['path'])
    def identity():
        unchanged_preparation()
        require(gs('rev-parse', 'HEAD') == EXPECTED_HEAD and gs('rev-parse', 'HEAD:src') == EXPECTED_SRC and not gs('status', '--porcelain=v1'), 'Expected HEAD/src/clean changed')
        for row in manifest['sourceFiles']:
            b = Path(row['sourcePath']).read_bytes()
            require(row['sourceRef'] == SOURCE_REF and b == git('show', SOURCE_REF + ':' + row['sourcePath']) == Path(row['inputCopyPath']).read_bytes() and len(b) == row['sourceBytes'] and sha(b) == row['sourceSha256'] and gs('rev-parse', SOURCE_REF + ':' + row['sourcePath']) == row['sourceBlob'], 'Input/blob/source changed')
    identity()
    OUT_PATHS = policy['outputPaths']
    api = runpy.run_path(str(REPO / 'dev/progress/sources-accept-post-read-authorization-integration-audit.py'), run_name='audit')
    guard_api = runpy.run_path(str(ROOT / 'guard.py'), run_name='guard')
    baseline = load_json(Path(policy['baselineFile']))
    expectations = load_json(ROOT / 'expected-fullTitles.json')
    r = {'runId': ROOT.name, 'startedAtUtc': now(), 'scope': release['scope'], 'repositoryHead': EXPECTED_HEAD, 'sourceRef': SOURCE_REF, 'sourceTree': EXPECTED_SRC, 'sourceInputs': manifest['sourceFiles'], 'pinnedFilesSha256': pins, 'executionRelease': release, 'allowedOutPaths': OUT_PATHS, 'productionWriteCountAllowed': 3, 'testJsWriteCountAllowed': 2, 'standaloneMapsAllowed': 0, 'stages': [], 'guards': [], 'fullCompileOfFinalSourceTree': False, 'restorationComplete': False, 'sourceMergedButNativeInitiallyOld': True}
    report_path = ROOT / 'validation-report.json'
    require(not report_path.exists() and not (ROOT / 'execution-consumed.json').exists(), 'One-shot run already consumed')
    def report():
        save(report_path, r)
    def fixedguard(before):
        identity()
        for path, row in baseline['freezeFiles'].items():
            require(sha(Path(path).read_bytes()) == row['sha256'] and api['meta'](Path(path)) == row['metadata'], 'Freeze changed: ' + path)
        for path, row in baseline['cacheSymlinks'].items():
            p = Path(path)
            require(p.is_symlink() and os.readlink(p) == row['target'] and str(p.resolve()) == row['resolved'] and api['meta'](p) == row['metadata'], 'Cache changed: ' + path)
        for row in manifest['boundSourceNativePairs']:
            p = Path(row['sourcePath'])
            require(sha(p.read_bytes()) == row['sourceSha256'] and stat.S_IMODE(p.stat().st_mode) == row['sourceMode'], 'Source changed: ' + str(p))
    def guard(label, before, expected_out):
        fixedguard(before)
        actual = api['outmeta']()
        differences = sorted(p for p in set(actual) | set(expected_out) if actual.get(p) != expected_out.get(p))
        require(not differences, 'Out metadata drift at ' + label + ': ' + repr(differences))
        r['guards'].append({'label': label, 'atUtc': now(), 'allExpectedOutMetadataExact': True, 'sourceFreezeCacheExact': True})
        report()
    def global_idle(label):
        # Read-only scans never signal unrelated processes. The held shared lock spans every stage.
        standard = api['scan']()
        ancestors = set(); pid = os.getpid()
        while pid > 0:
            ancestors.add(pid); row = read_process(pid)
            if row is None: break
            pid = row['ppid']
        patterns = ['test/unit/electron/index.js', 'test/unit/node/index.js', 'source-checker.mjs', 'linter.mjs', 'emitter.mjs', 'node_modules/eslint/bin/eslint.js', 'build/eslint.ts']
        matches = [row for pid, row in processes().items() if pid not in ancestors and any(p in ' '.join(row['argv']) for p in patterns)]
        require(not matches, 'Competing compiler/test stage: ' + repr(matches))
        r.setdefault('globalIdleScans', []).append({'stage': label, 'atUtc': now(), 'standardCompileScan': standard, 'extraPatterns': patterns, 'matches': matches})
    def prestage(label, before, expected_out):
        require(all(scope.cleanup_done and not scope.scan() for scope in scopes), 'Previous owned stage not fully quiescent')
        global_idle(label); guard('before-' + label, before, expected_out)
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
        global_idle('before-lock')
        lock = open('/tmp/vscode-compile.lock', 'a+')
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        r['sharedLockHeld'] = True
        global_idle('under-lock')
        before = guard_api['verify']()
        require(before['outMetadata'] == baseline['outMetadata'], 'Initial frozen metadata must exactly equal actual restored8b5f baseline')
        require(sum(not stat.S_ISDIR(v['type']) for v in before['outMetadata'].values()) == 12554 and sum(stat.S_ISDIR(v['type']) for v in before['outMetadata'].values()) == 2946, 'Wrong native counts')
        save(ROOT / 'execution-consumed.json', {'atUtc': now(), 'releaseSha256': pins['execution-release.json'], 'expectedHead': EXPECTED_HEAD, 'oneShot': True})
        save(ROOT / 'guard-before.json', before)
        for path in OUT_PATHS:
            p, copy = Path(path), ROOT / 'sealed-originals' / path
            require(p.is_file() and not p.is_symlink(), 'Target must be existing regular output')
            value, b = p.stat(), p.read_bytes(); copy.parent.mkdir(parents=True, exist_ok=True); copy.write_bytes(b)
            seals.append({'path': path, 'sha256': sha(b), 'bytes': len(b), 'mode': stat.S_IMODE(value.st_mode), 'mtimeNs': value.st_mtime_ns, 'atimeNs': value.st_atime_ns, 'ctimeNs': value.st_ctime_ns, 'mtimeNsString': str(value.st_mtime_ns), 'ctimeNsString': str(value.st_ctime_ns), 'sealedBytesPath': str(copy)})
        save(ROOT / 'sealed-originals.json', seals)
        become_subreaper()
        for signum in [signal.SIGTERM, signal.SIGINT]: previous_handlers[signum] = signal.signal(signum, interrupted)
        for label, file in [('checker', 'source-checker.mjs'), ('lint', 'linter.mjs')]:
            prestage(label, before, before['outMetadata'])
            entry = run_owned(label, ['node', '--max-old-space-size=8192', str(ROOT / file)], {'VSCODE_SOURCES_NEW_VALIDATION_STAGE': label})
            guard('after-' + label, before, before['outMetadata'])
            require(entry['exitCode'] == 0 and not entry['externalWatchdogExpired'], label + ' failed; no emitter/test allowed')
        prestage('dry', before, before['outMetadata'])
        dry = run_owned('dry-enumeration', ['node', str(ROOT / 'emitter.mjs'), 'dry'], {'VSCODE_SOURCES_NEW_VALIDATION_STAGE': 'dry'}, emitter_mode='dry')
        guard('after-dry-zero-out-writes', before, before['outMetadata'])
        require(dry['exitCode'] == 0 and not dry['externalWatchdogExpired'], 'Dry failed; no emit/test allowed')
        dry_data = load_json(ROOT / 'dry-emitter-report.json')
        require([x['outputPath'] for x in dry_data['outputs']] == OUT_PATHS and dry_data['actualInputCount'] == 5 and dry_data['standaloneMapCount'] == 0 and dry_data['outWriteFileCalls'] == [], 'Dry must be exact5 JS/0map/zero out writes')
        prestage('emit', before, before['outMetadata'])
        emit = run_owned('temporary-five-file-emit', ['node', str(ROOT / 'emitter.mjs'), 'emit'], {'VSCODE_SOURCES_NEW_VALIDATION_STAGE': 'emit'}, emitter_mode='emit')
        require(emit['exitCode'] == 0 and not emit['externalWatchdogExpired'], 'Emit failed; no modules allowed')
        emitted = load_json(ROOT / 'emit-emitter-report.json')
        require([x['path'] for x in emitted['outWriteFileCalls']] == OUT_PATHS and len(emitted['outWriteFileCalls']) == 5 and emitted['standaloneMapCount'] == 0 and emitted['productionOutWriteFileCalls'] == 3, 'Actual writes not exact3 production+2 test JS')
        for row in emitted['outputs']: require(sha(Path(row['outputPath']).read_bytes()) == row['sha256'], 'Written output hash mismatch')
        mixed = api['outmeta'](); changed = sorted(p for p in set(mixed) | set(before['outMetadata']) if mixed.get(p) != before['outMetadata'].get(p))
        require(changed == OUT_PATHS, 'Only exact five metadata rows may change')
        save(ROOT / 'guard-after-emit-out-metadata.json', mixed)
        r['actualOutWriteFileCalls'], r['temporaryEmittedIdentities'] = emitted['outWriteFileCalls'], emitted['outputs']
        guard('after-exact-five-file-emit', before, mixed)
        electron = REPO / '.build/electron' / load_json(REPO / 'product.json')['applicationName']
        require(electron.is_file(), 'Existing Electron missing')
        r['officialRunner'] = {'electronPath': str(electron), 'resolvedElectronPath': str(electron.resolve()), 'entry': 'test/unit/electron/index.js', 'reporterAdapter': str(ROOT / 'reporter.cjs'), 'officialReporters': ['test/unit/fullJsonStreamReporter.js', 'node_modules/mocha/lib/reporters/json.js'], 'grep': None, 'wholeModule': True}
        for group in policy['groups']:
            label, source = group['label'], group['sourcePath']
            prestage(label, before, mixed)
            runtime = ROOT / ('runtime-' + label); runtime.mkdir()
            for subdir in ['tmp', 'config', 'cache', 'data', 'user-data', 'crashes']: (runtime / subdir).mkdir()
            env = {'TMPDIR': str(runtime / 'tmp'), 'XDG_CONFIG_HOME': str(runtime / 'config'), 'XDG_CACHE_HOME': str(runtime / 'cache'), 'XDG_DATA_HOME': str(runtime / 'data'), 'ELECTRON_ENABLE_LOGGING': '1', 'VSCODE_SKIP_PRELAUNCH': '1', 'VSCODE_SOURCES_NEW_VALIDATION_STAGE': 'test:' + label}
            args = ['xvfb-run', '-a', '-e', str(runtime / 'xvfb.stderr.log'), str(electron), 'test/unit/electron/index.js', '--crash-reporter-directory=' + str(runtime / 'crashes'), '--no-sandbox', '--disable-gpu', '--timeout', '15000', '--reporter', str(ROOT / 'reporter.cjs'), '--run', source]
            entry = run_owned(label, args, env)
            # parse failure is evidence failure, not permission to suppress the other safe-cleaned module.
            try:
                expected = next(m for m in expectations['modules'] if m['label'] == label)
                entry['mocha'] = parse_mocha(entry, expected)
            except BaseException as error:
                entry['reporterProjectionFailure'], entry['reporterProjectionTraceback'] = repr(error), traceback.format_exc()
            report()
            guard('after-' + label, before, mixed)
        actual_by_title = {row['fullTitle']: row for stage in r['stages'] for row in stage.get('mocha', {}).get('perExpectedFullTitle', [])}
        r['new72ExpectedFullTitleQualification'] = [actual_by_title.get(title, {'fullTitle': title, 'classification': 'module-reporter-projection-unavailable', 'arrivedFromActualReporter': None, 'completedFromActualReporter': None, 'bodyPassCount': None, 'bodyFailureCount': None, 'pendingCount': None}) for title in expectations['acceptFullTitles'] + expectations['lifetimeFullTitles']]
        r['newExpectedCountIsStaticOnly'] = {'Accept': 54, 'lifetime': 18}
        r['actualNewCaseCountsFromReporter'] = {key: sum(row[key] for row in r['new72ExpectedFullTitleQualification'] if isinstance(row.get(key), int)) for key in ['testStartCount', 'testEndCount', 'bodyPassCount', 'bodyFailureCount', 'pendingCount']}
        r['unknownNewCaseQualificationCount'] = sum(row.get('arrivedFromActualReporter') is None for row in r['new72ExpectedFullTitleQualification'])
        r['phase'] = 'two-full-modules-finished-with-actual-results-awaiting-root-review'
        r['allCompleteModulesClean'] = len([x for x in r['stages'] if 'mocha' in x]) == 2 and all(x.get('mocha', {}).get('cleanCompleteModule') for x in r['stages'] if x['stage'] in [g['label'] for g in policy['groups']])
        r['exitCode'] = 0 if r['allCompleteModulesClean'] else 1
    except BaseException as error:
        r['failure'], r['traceback'] = repr(error), traceback.format_exc()
        r['phase'], r['exitCode'] = 'stopped-on-actual-protocol-or-stage-failure', 1
        print(r['traceback'], flush=True)
    finally:
        r['restoreStartedAtUtc'] = now(); restored = []
        try:
            for scope in scopes:
                if scope.proc is not None and not scope.cleanup_done: scope.quiesce('outer-finally-before-any-out-restoration')
                if scope.proc is not None: require(not scope.scan() and scope.cleanup_done, 'OUT RESTORATION FORBIDDEN: owned descendants remain')
            r['allOwnedProcessesStoppedBeforeOutRestoration'] = True
            if before is not None:
                try:
                    fixedguard(before)
                    r['preRestoreIdentityIntegrityExact'] = True
                except BaseException as error:
                    r['preRestoreIdentityIntegrityExact'] = False
                    r['preRestoreIntegrityFailure'], r['exitCode'] = repr(error), 1
                    # Integrity failure never suppresses restoration of already-sealed, safe owned outputs.
                for seal in seals:
                    p, copy = Path(seal['path']), Path(seal['sealedBytesPath']); b = copy.read_bytes()
                    require(sha(b) == seal['sha256'], 'Sealed bytes corrupt')
                    require(p.is_file() and not p.is_symlink(), 'Refuse replaced/symlink output')
                    value = p.stat()
                    if sha(p.read_bytes()) != seal['sha256'] or stat.S_IMODE(value.st_mode) != seal['mode'] or value.st_mtime_ns != seal['mtimeNs']:
                        p.write_bytes(b)
                        if stat.S_IMODE(p.stat().st_mode) != seal['mode']: p.chmod(seal['mode'])
                        os.utime(p, ns=(seal['atimeNs'], seal['mtimeNs'])); restored.append(seal['path'])
                after = guard_api['verify'](OUT_PATHS)
                save(ROOT / 'guard-after-restore.json', after)
                require({k: v for k, v in after.items() if k not in ['outMetadata', 'capturedAtUtc', 'authorizedCtimeDifferences']} == {k: v for k, v in before.items() if k not in ['outMetadata', 'capturedAtUtc', 'authorizedCtimeDifferences']}, 'Source/native/freeze/cache restoration differs')
                r['restorationComplete'] = True
                r['restoreGuard'] = {'finishedAtUtc': now(), 'restoredPaths': restored, 'allFiveOriginalBytesModeMtimeExact': True, 'other12549FilesFullMetadataExact': True, 'all2946DirectoriesMetadataExact': True, 'all256NativeBytesAndModesExactOldRun3': True, 'fourNewSourceOldNativePairs': True, 'allFourFreezeFilesExact': True, 'allThreeCacheSymlinksExact': True, 'authorizedCtimeDifferences': after['authorizedCtimeDifferences'], 'originalRun3BaselineNotRewritten': True, 'actualRestoredBaselineNotRewritten': True, 'fullCompileOfFinalSourceTree': False}
        except BaseException as error:
            r['restoreFailure'], r['restoreTraceback'], r['exitCode'] = repr(error), traceback.format_exc(), 1
            print(r['restoreTraceback'], flush=True)
        runtime_files = []
        for runtime in sorted(ROOT.glob('runtime-*')):
            for directory, dirs, files in os.walk(runtime):
                for name in ['.'] + dirs + files:
                    path = Path(directory) if name == '.' else Path(directory) / name
                    try: runtime_files.append({'path': str(path), 'metadata': metadata(path), 'symlinkTarget': os.readlink(path) if path.is_symlink() else None})
                    except FileNotFoundError: pass
        r['runtimeFilesystemManifest'], r['finishedAtUtc'] = runtime_files, now(); report()
        for signum, handler in previous_handlers.items(): signal.signal(signum, handler)
        if lock is not None: fcntl.flock(lock, fcntl.LOCK_UN); lock.close()
        print(json.dumps({'phase': r.get('phase'), 'exitCode': r.get('exitCode'), 'restorationComplete': r['restorationComplete'], 'allOwnedProcessesStoppedBeforeOutRestoration': r.get('allOwnedProcessesStoppedBeforeOutRestoration', False), 'fullCompileOfFinalSourceTree': False}), flush=True)
    return r.get('exitCode', 1)


if __name__ == '__main__':
    try:
        result = main()
    except BaseException as error:
        print(str(error), file=sys.stderr, flush=True)
        result = 2
    sys.exit(result)

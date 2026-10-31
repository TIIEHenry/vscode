"""Prepared-only one-shot lease protocol; no runtime authority until separate root release.
Old L1 must be exactly qualified before new Pane emission. No automatic retry or after scope.
"""
from pathlib import Path
import ctypes,datetime,fcntl,hashlib,json,os,re,runpy,secrets,signal,stat,subprocess,sys,time,traceback,base64
ROOT=Path(__file__).resolve().parent
REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
PLAN='vscode-conversation-visible-lease-f33-validation-20261027-prep2'
EXPECTED_HEAD='736171b1abc34e36e4991709240625827b566396'
EXPECTED_SRC='90d6092dbbca80114db7f55a75e137bb1d7bef76'
SOURCE_REF='f33d16fbc5841119f5baa7ff2788060d39b8bb4f'
TOKEN_KEY='VSCODE_SOURCES_OLD_RED_RUN2_STAGE_TOKEN'
DRIVER_NONCE_KEY='VSCODE_SOURCES_OLD_RED_RUN2_DRIVER_NONCE'
PIN_NAMES=['validate.py', 'binding.mjs', 'source-checker.mjs', 'linter.mjs', 'emitter.mjs', 'guard.py', 'reporter.cjs', 'observing-reporter.cjs', 'policy.json', 'input-manifest.json', 'expected-fullTitles.json', 'expected-new13-fullTitles.txt', 'expected-original26-fullTitles.txt', 'expected-old-L1-plus-meta-fullTitles.txt', 'expected-full40-fullTitles.txt', 'source-inputs.json', 'sealed-originals.json', 'ownership-contract.json', 'producer-pins.json', 'native-asset-manifest.json', 'old-L1-source-boundary.json']

def require(ok,message):
 if not ok:raise RuntimeError(message)
def sha(b):return hashlib.sha256(b).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def load_json(path):return json.loads(Path(path).read_text())
def save(path,value):Path(path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def git(*args):return subprocess.check_output(['rtk','proxy','git',*args],cwd=REPO)
def gs(*args):return git(*args).decode().strip()
def load_binding():
 policy,manifest,release=[load_json(ROOT/p) for p in ['policy.json','input-manifest.json','execution-release.json']]
 require(release.get('executionAuthorized') is True and release.get('state')=='AUTHORIZED_NEW_VALIDATION_ONCE' and release.get('authorizedBy')=='/root' and isinstance(release.get('authorizationMessage'),str) and release['authorizationMessage'].strip(),'FAIL CLOSED: preparation grants no execution')
 require(ROOT==Path('/tmp')/PLAN and Path.cwd()==REPO,'Wrong scratch or cwd')
 require(policy['planId']==manifest['planId']==release['planId']==PLAN and manifest['repo']==policy['repo']==str(REPO),'Wrong binding')
 require(policy['expectedHead']==manifest['expectedHead']==release['expectedHead']==EXPECTED_HEAD and policy['sourceTree']==manifest['sourceTree']==EXPECTED_SRC and manifest['sourceRef']==release['sourceRef']==SOURCE_REF,'Wrong fixed identities')
 require(release['scope']=='two-target-check-lint-dry-two-staged-js-old-L1-then-full-Reveal' and set(release['pinnedFilesSha256'])==set(PIN_NAMES),'Expanded/incomplete release')
 for name,digest in release['pinnedFilesSha256'].items():require(sha((ROOT/name).read_bytes())==digest,'Unpinned preparation '+name)
 return policy,manifest,release,{**release['pinnedFilesSha256'],'execution-release.json':sha((ROOT/'execution-release.json').read_bytes())}

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



def parse_reporter(entry):
 raw=Path(entry['stdoutPath']).read_text(errors='replace');decoder=json.JSONDecoder();events=[];official=[];pos=0
 known={'start','end','testStart','pass','fail','pendingObserved','testEndObserved','hookStartObserved','hookEndObserved','observerEnd'}
 while pos<len(raw):
  candidates=[p for p in [raw.find('{',pos),raw.find('[',pos)] if p>=0]
  if not candidates:break
  begin=min(candidates)
  try:value,length=decoder.raw_decode(raw[begin:])
  except json.JSONDecodeError:pos=begin+1;continue
  pos=begin+length
  if isinstance(value,list) and len(value)==2 and value[0] in known and isinstance(value[1],dict):events.append({'event':value[0],'data':value[1]})
  elif isinstance(value,dict) and isinstance(value.get('stats'),dict) and isinstance(value.get('tests'),list) and isinstance(value.get('failures'),list):official.append(value)
 save(ROOT/(entry['stage']+'.observed-events.json'),events)
 data=official[-1] if official else None
 if data is not None:save(ROOT/(entry['stage']+'.mocha.json'),data)
 return data,events,len(official)

def qualify(entry,wanted,old):
 data,events,official_count=parse_reporter(entry)
 def observed(kind,title):return [x['data'] for x in events if x['event']==kind and x['data'].get('fullTitle')==title]
 titles=wanted['requiredFullTitles'];rows=[]
 for title in titles:
  starts,ends,passes,fails,pending=[observed(k,title) for k in ['testStart','testEndObserved','pass','fail','pendingObserved']]
  is_old_failure=old and title==wanted['exactExpectedFailureTitle']
  rows.append(dict(fullTitle=title,startCount=len(starts),endCount=len(ends),passCount=len(passes),failCount=len(fails),pendingCount=len(pending),exactExpectedOutcome=(len(starts)==len(ends)==1 and len(passes)==(0 if is_old_failure else 1) and len(fails)==(1 if is_old_failure else 0) and len(pending)==0)))
 starts=[x['data'].get('fullTitle') for x in events if x['event']=='testStart'];missing=sorted(set(titles)-set(starts));unknown=sorted(set(starts)-set(titles))
 hooktitles={x['data'].get('fullTitle','') for x in events if x['event'] in ['hookStartObserved','hookEndObserved']}
 hooks=[dict(fullTitle=t,startCount=len(observed('hookStartObserved',t)),endCount=len(observed('hookEndObserved',t))) for t in sorted(hooktitles)]
 hookstart=sum(x['startCount'] for x in hooks);hookend=sum(x['endCount'] for x in hooks)
 stats=data.get('stats',{}) if data else {};stats_expected={'tests':wanted['expectedTests'],'passes':wanted['expectedPasses'],'failures':wanted['expectedFailures'],'pending':0}
 official_tests=[x.get('fullTitle') for x in data.get('tests',[])] if data else []
 official_passes=[x.get('fullTitle') for x in data.get('passes',[])] if data else []
 official_failures=[x.get('fullTitle') for x in data.get('failures',[])] if data else []
 expected_fails=[wanted['exactExpectedFailureTitle']] if old else [];expected_passes=[t for t in titles if t not in expected_fails]
 stream_fails=[x['data'] for x in events if x['event']=='fail']
 ended=sum(x['event']=='end' for x in events)==1 and sum(x['event']=='observerEnd' for x in events)==1
 exact=bool(data and official_count==1 and sorted(official_tests)==sorted(titles) and sorted(official_passes)==sorted(expected_passes) and sorted(official_failures)==sorted(expected_fails) and not data.get('pending') and all(stats.get(k)==v for k,v in stats_expected.items()) and sorted(x.get('fullTitle') for x in stream_fails)==sorted(expected_fails))
 hooks_ok=hookstart==hookend==wanted['expectedHookPairs'] and all(x['startCount']==x['endCount'] for x in hooks)
 result=dict(officialJSONCount=official_count,actualStats=stats,staticExpectedStats=stats_expected,perTitleActual=rows,missing=missing,unknown=unknown,officialCountsAndTitlesExact=exact,officialRunEndAndObserverEnd=ended,hookStartCount=hookstart,hookEndCount=hookend,expectedHookPairs=wanted['expectedHookPairs'],hookStartEndPerTitle=hooks,hooksBalancedAndExact=hooks_ok,rawStreamFailures=stream_fails,rawOfficialFailures=data.get('failures') if data else None,ownedCleanupComplete=entry.get('allOwnedDescendantsStoppedAndReaped') is True,watchdogExpired=entry.get('externalWatchdogExpired'),actualExitCode=entry.get('exitCode'),oldFailedBodyLeakCheckClaim=False,countsSource='Independent projection of actual official runner JSON and raw stream events; static expected lists are never observed counts')
 result['reporterQualified']=bool(exact and ended and hooks_ok and all(x['exactExpectedOutcome'] for x in rows) and not missing and not unknown and entry.get('exitCode')==(1 if old else 0) and entry.get('allOwnedDescendantsStoppedAndReaped') is True and not entry.get('externalWatchdogExpired'))
 return result

def inline_map(path,source_row):
 b=path.read_bytes();m=re.search(rb'//# sourceMappingURL=data:application/json[^,]*;base64,([^\r\n]+)',b)
 require(m is not None,'Fresh Reveal requires inline source map')
 raw=base64.b64decode(m[1],validate=True);d=json.loads(raw)
 require(d.get('version')==3 and len(d.get('sources',[]))==len(d.get('sourcesContent',[])),'Invalid complete source map')
 matches=[i for i,s in enumerate(d['sources']) if s.endswith(source_row['sourcePath'])]
 require(len(matches)==1 and d['sourcesContent'][matches[0]].encode()==Path(source_row['inputCopyPath']).read_bytes(),'Inline map does not bind exact fresh Reveal source')
 save(ROOT/'fresh-Reveal.inline-source-map.json',d)
 return d,dict(rawMapBytes=len(raw),rawMapSha256=sha(raw),generatedJsBytes=len(b),generatedJsSha256=sha(b),sources=d['sources'],exactSourceContent=True)

def map_frame(source_map,line,column):
 alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
 source_index=original_line=original_column=0
 for generated_line,segments in enumerate(source_map['mappings'].split(';'),1):
  generated_column=0;best=None
  for segment in segments.split(','):
   if not segment:continue
   values=[];value=shift=0
   for char in segment:
    digit=alphabet.index(char);value+=(digit&31)<<shift
    if digit&32:shift+=5
    else:values.append(-(value>>1) if value&1 else value>>1);value=shift=0
   generated_column+=values[0]
   if len(values)>=4:
    source_index+=values[1];original_line+=values[2];original_column+=values[3]
    if generated_line==line and generated_column<=column-1:best=dict(source=source_map['sources'][source_index],line=original_line+1,column=original_column+1,generatedLine=line,generatedColumn=generated_column+1)
  if generated_line==line:return best
 return None

def old_failure_boundary(result,wanted,source_map,map_report):
 failures=result['rawOfficialFailures'] or [];streams=result['rawStreamFailures'];err=failures[0].get('err',{}) if len(failures)==1 else {};stack=err.get('stack','');message=err.get('message','')
 mapped=[]
 for line,column in re.findall(r'conversationSessionWindowReveal\.test\.js:(\d+):(\d+)',stack):
  value=map_frame(source_map,int(line),int(column))
  if value:mapped.append(value)
 ts_direct=bool(re.search(r'conversationSessionWindowReveal\.test\.ts:647(?::\d+)?',stack))
 source647=ts_direct or any(x['source'].endswith('src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts') and x['line']==647 for x in mapped)
 boundary=bool(len(failures)==len(streams)==1 and message==wanted['exactExpectedFailureMessage'] and streams[0].get('err')==wanted['exactExpectedFailureMessage'] and 'AssertionError' in stack and source647 and not re.search(r'TypeError|ReferenceError|ERR_MODULE_NOT_FOUND|Timeout of|timed out|watchdog',stack))
 result.update(dict(exactAssertionMessage=message,completeRawStack=stack,mappedFrames=mapped,exactSource647=source647,inlineSourceMap=map_report,exactExpectedBusinessAssertion=boundary,prerequisiteEvidence='Exact source control flow reaching fixed assertion647; preceding natural-missing/catalog-ready/same input-lens-bound-alive/visible-unsuspended/live-nonpairing/activeChanges0 assertions and awaited helpers completed. No individual-assert runtime instrumentation claim.',oldFailedBodyLeakCheckClaim=False,failedBodyLeakBoundary='utils.ts:65 skips computeLeakingDisposables for a failed body; only actual teardown/hooks/owned cleanup are established'))
 return boundary

def assets_qualification(label,manifest_assets,native_overrides):
 report=load_json(ROOT/(label+'.loaded-assets.json'));by_path={x['path']:x for x in manifest_assets['files']};observed=[];seen=set();problems=[]
 for actual in report['observed']:
  path=actual['path'];pinned=by_path.get(path)
  if pinned is None:problems.append('unmanifested '+path);continue
  wanted=native_overrides.get(path,pinned['sha256'])
  if actual['diskSha256']!=wanted or sha((REPO/path).read_bytes())!=wanted:problems.append('native drift '+path)
  row={**pinned,**actual,'observationStatus':'actually-loaded-parsed-script' if actual['kind']=='parsed-script' else 'actually-registered-stylesheet','currentSourceEmittedToNative':pinned['currentSourceEmittedToNative']}
  if path in native_overrides:
   row.update(bytes=actual['diskBytes'],sha256=wanted,producerRef='this-one-shot-lease-emission',producerSourceBlob=pinned['currentSourceBlob'],producerSourceSha256=pinned['currentSourceSha256'],producerQualification='exact-fresh-target-emitter-report-plus-runtime-source',currentSourceEmittedToNative=True)
  if path in [x['outputPath'] for x in load_json(ROOT/'source-inputs.json')]:
   if actual.get('targetRuntimeSourceEqualsDiskBytes') is not True or actual.get('targetRuntimeSourceSha256')!=wanted:problems.append('target runtime bytes not exact '+path)
  observed.append(row);seen.add(path)
 targets={x['outputPath'] for x in load_json(ROOT/'source-inputs.json')}
 if not targets.issubset(seen):problems.append('missing target observations '+repr(sorted(targets-seen)))
 result=dict(label=label,observedAssets=observed,manifestOnlyUnobservedPaths=sorted(set(by_path)-seen),loadedUniquePathCount=len(seen),manifestOnlyCount=len(set(by_path)-seen),observerErrors=report['observerErrors'],problems=problems,unmappedRegisteredStylesheets=report['unmappedRegisteredStylesheets'],unmappedStylesheetsGrantedNativeProducerCredit=False,qualification=not problems and not report['observerErrors'],loadedDoesNotMeanFunctionCoverageOrUiAfter=True,fullCompileOfFinalSourceTree=False)
 save(ROOT/(label+'.native-provenance.json'),result);return result


def restoration_scope_audit(phases,seals):
    """Only parent-qualified spawn plus this phase's trusted journal prefix grants restoration."""
    fixed={'emit-reveal':seals[1]['path'],'emit-pane':seals[0]['path']}
    completed=[];uncertain=[];not_admitted=[];failures=[];journals=[];restorable=set()
    def problem(mode,code,detail):failures.append(dict(mode=mode,code=code,detail=detail))
    for journal in ROOT.glob('*-out-write-journal.jsonl'):
        if journal.name not in {mode+'-out-write-journal.jsonl' for mode in fixed}:
            problem(None,'unscoped-journal',str(journal))
    for mode,path in fixed.items():
        rows=[phase for phase in phases if phase.get('mode')==mode]
        journal=ROOT/(mode+'-out-write-journal.jsonl')
        if len(rows)!=1:
            if rows:problem(mode,'duplicate-parent-phase',len(rows))
            if journal.exists() or journal.is_symlink():problem(mode,'journal-without-unique-parent-phase',str(journal))
            continue
        phase=rows[0]
        parent_ok=(phase.get('eligiblePath')==path and phase.get('journalPath')==str(journal) and phase.get('journalAbsentImmediatelyBeforeSpawn') is True and phase.get('actualSpawned') is True and phase.get('spawnEntryMatchesPhase') is True and isinstance(phase.get('rootPid'),int) and isinstance(phase.get('rootStartTime'),str) and phase['rootStartTime'].isdigit() and isinstance(phase.get('expectedFreshBytes'),int) and phase['expectedFreshBytes']>0 and isinstance(phase.get('expectedFreshSha256'),str) and re.fullmatch('[0-9a-f]{64}',phase['expectedFreshSha256']) is not None)
        if not parent_ok:
            if phase.get('actualSpawned') or journal.exists() or journal.is_symlink():problem(mode,'unqualified-parent-spawn-or-scope',phase)
            not_admitted.append(dict(mode=mode,path=path,actualSpawned=phase.get('actualSpawned'),reason='No qualified unique parent PID/start spawn and single-path authority',restorationAuthorized=False))
            continue
        if not journal.is_file() or journal.is_symlink():
            problem(mode,'missing-or-nonregular-journal',str(journal));not_admitted.append(dict(mode=mode,path=path,actualSpawned=True,reason='No readable regular same-phase journal',restorationAuthorized=False));continue
        try:raw=journal.read_bytes()
        except OSError as error:
            problem(mode,'unreadable-journal',repr(error));not_admitted.append(dict(mode=mode,path=path,actualSpawned=True,reason='Journal unreadable; no drift-based authority',restorationAuthorized=False));continue
        valid=[];local_errors=[]
        for index,line in enumerate(raw.splitlines(keepends=True)):
            if not line.endswith(b'\n'):
                local_errors.append(dict(line=index+1,reason='incomplete-journal-record'));break
            try:event=json.loads(line)
            except (json.JSONDecodeError,UnicodeDecodeError) as error:
                local_errors.append(dict(line=index+1,reason='invalid-journal-json',detail=repr(error)));break
            expected_phase='intent' if index==0 else 'completed' if index==1 else None
            canonical=(isinstance(event,dict) and expected_phase is not None and event.get('phase')==expected_phase and event.get('path')==path and event.get('bytes')==phase['expectedFreshBytes'] and event.get('sha256')==phase['expectedFreshSha256'])
            if expected_phase=='completed':canonical=canonical and event.get('absolutePath')==str(REPO/path)
            if not canonical:
                local_errors.append(dict(line=index+1,reason='out-of-scope-or-invalid-journal-sequence',rawDecodedEvent=event));break
            valid.append(event)
        if not valid:
            local_errors.append(dict(reason='no-trusted-intent-record'));not_admitted.append(dict(mode=mode,path=path,actualSpawned=True,reason='No trusted intent prefix; current drift cannot grant permission',restorationAuthorized=False))
        if local_errors:problem(mode,'journal-protocol-failure',local_errors)
        journals.append(dict(mode=mode,path=str(journal),bytes=len(raw),sha256=sha(raw),trustedPrefixRecords=valid,protocolErrors=local_errors))
        # No current output drift is consulted to grant write or ctime authority.
        if valid and valid[0]['phase']=='intent':
            row=dict(mode=mode,path=path,rootPid=phase['rootPid'],rootStartTime=phase['rootStartTime'],parentSinglePathAuthority=True,qualifiedParentSpawn=True,journalSha256=sha(raw),trustedIntent=valid[0],expectedFreshBytes=phase['expectedFreshBytes'],expectedFreshSha256=phase['expectedFreshSha256'])
            if len(valid)==2 and not local_errors:
                row.update(classification='completed-write',trustedCompleted=valid[1]);completed.append(row)
            else:
                row.update(classification='partial-or-uncertain-attempt',reason='Trusted intent permits possible write; no complete qualified journal completion is claimed');uncertain.append(row)
            restorable.add(path)
    for phase in phases:
        if phase.get('mode') not in fixed:problem(phase.get('mode'),'unscoped-parent-phase',phase)
    return dict(capturedAtUtc=now(),restorablePaths=sorted(restorable),actualCompletedWrites=completed,partialOrUncertainAttempts=uncertain,notAdmittedForRestoration=not_admitted,protocolFailures=failures,journals=journals,eligibilityBasis='Unique parent single-path phase, absent journal before actual PID/start-qualified spawn, plus trusted same-phase journal intent/completed; never inferred from drift or successful report')


def main():
    policy,manifest,release,pins=load_binding();os.chdir(REPO)
    def identity():
        for name,digest in pins.items():require(sha((ROOT/name).read_bytes())==digest,'Prepared file changed '+name)
        require(gs('rev-parse','HEAD')==EXPECTED_HEAD and gs('rev-parse','HEAD:src')==EXPECTED_SRC and not gs('status','--porcelain=v1'),'HEAD/src/clean changed')
        for row in manifest['sourceFiles']:
            b=Path(row['sourcePath']).read_bytes();require(b==git('show',SOURCE_REF+':'+row['sourcePath'])==Path(row['inputCopyPath']).read_bytes() and sha(b)==row['sourceSha256'] and len(b)==row['sourceBytes'],'Source/input changed')
        for row in manifest['boundToolAndConfigFiles']:
            b=Path(row['path']).read_bytes();require(sha(b)==row['sha256'] and len(b)==row['bytes'],'Tool/config changed '+row['path'])
    identity()
    guard_api=runpy.run_path(str(ROOT/'guard.py'),run_name='guard')
    expected=load_json(ROOT/'expected-fullTitles.json');assets=load_json(ROOT/'native-asset-manifest.json');seals=load_json(ROOT/'sealed-originals.json')
    out_paths=policy['outputPaths'];pane,reveal=out_paths;native_overrides={};before=None;expected_metadata=None
    r={'runId':PLAN,'head':EXPECTED_HEAD,'src':EXPECTED_SRC,'sourceRef':SOURCE_REF,'startedAtUtc':now(),'stages':[],'guards':[],'restorationComplete':False,'fullCompileOfFinalSourceTree':False,'oldFailedBodyLeakCheckClaim':False,'noAutomaticRetry':True}
    report_path=ROOT/'validation-report.json'
    require(not report_path.exists() and not (ROOT/'execution-consumed.json').exists(),'One-shot consumed or report exists')
    def report():save(report_path,r)
    def unchanged_preparation():identity()
    def global_idle(label):
        ancestors=set();pid=os.getpid()
        while pid>0:
            ancestors.add(pid);row=read_process(pid)
            if row is None:break
            pid=row['ppid']
        patterns=['compile-client','typecheck-client','transpile-client','gulp.js','build/next/index.ts transpile','build/next/index.ts watch','watch-client','tsc --project','tsgo --project','virtual-noemit','virtual-noEmit','test/unit/electron/index.js','test/unit/node/index.js','source-checker.mjs','linter.mjs','emitter.mjs','node_modules/eslint/bin/eslint.js','build/eslint.ts']
        matches=[row for pid,row in processes().items() if pid not in ancestors and any(x in ' '.join(row['argv']) for x in patterns)]
        require(not matches,'Competing compile/test process '+repr(matches));r.setdefault('globalIdleScans',[]).append(dict(label=label,atUtc=now(),patterns=patterns,matches=matches))
    def guard(label):
        identity();value=guard_api['verify'](expected_metadata,native_overrides);r['guards'].append(dict(label=label,atUtc=now(),all15500ExpectedMetadataExact=True,native256AndSeparateRevealExact=True,freeze4Cache3Exact=True));report();return value
    def prestage(label):
        require(all(s.cleanup_done and not s.scan() for s in scopes),'Prior owned stage not quiescent');global_idle(label);guard('before-'+label)
    scopes=[];nonce=secrets.token_hex(32);run_token=secrets.token_hex(32)
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

    lock=None;previous_handlers={}
    def interrupted(signum,frame):raise RuntimeError('Validation interrupted '+signal.Signals(signum).name)
    def emit(mode,target):
        nonlocal expected_metadata
        prestage(mode)
        require({'emit-reveal':reveal,'emit-pane':pane}.get(mode)==target,'Wrong parent single-path emit phase')
        phases=r.setdefault('emissionPhaseEligibility',[])
        require(not any(p['mode']==mode for p in phases),'No repeated emit phase')
        journal=ROOT/(mode+'-out-write-journal.jsonl');require(not journal.exists() and not journal.is_symlink(),'Journal must not predate this phase')
        fresh=next(row for row in load_json(ROOT/'dry-emitter-report.json')['outputs'] if row['outputPath']==target)
        phase=dict(mode=mode,eligiblePath=target,journalPath=str(journal),journalAbsentImmediatelyBeforeSpawn=True,authorizedAtUtc=now(),expectedFreshBytes=fresh['bytes'],expectedFreshSha256=fresh['sha256'],actualSpawned=False)
        phases.append(phase);report()
        try:
            entry=run_owned(mode,[node,str(ROOT/'emitter.mjs'),mode],{'VSCODE_SOURCES_NEW_VALIDATION_STAGE':mode},emitter_mode=mode)
        finally:
            matching=[scope for scope in scopes if scope.label==mode]
            if len(matching)==1:
                owned=matching[0];stage=owned.entry
                phase.update(actualSpawned=owned.proc is not None,rootPid=owned.proc.pid if owned.proc is not None else None,rootStartTime=owned.root_pair[1] if owned.root_pair is not None else None,spawnEntryMatchesPhase=stage.get('stage')==mode and stage.get('command')==['rtk','proxy',node,str(ROOT/'emitter.mjs'),mode],stageExitCode=stage.get('exitCode'),ownedCleanupComplete=owned.cleanup_done,spawnEvidenceCapturedAtUtc=now())
            report()
        require(entry['exitCode']==0 and not entry['externalWatchdogExpired'],mode+' failed; stop')
        write_audit=restoration_scope_audit(phases,seals);save(ROOT/(mode+'.parent-write-qualification.json'),write_audit)
        require(not write_audit['protocolFailures'] and any(row['mode']==mode and row['path']==target for row in write_audit['actualCompletedWrites']),'Missing/corrupt/out-of-scope write journal; stop')
        data=load_json(ROOT/(mode+'-emitter-report.json'));writes=data['outWriteFileCalls']
        require(data['actualInputCount']==1 and data['standaloneMapCount']==0 and [x['path'] for x in writes]==[target] and len(data['outputs'])==1 and data['outputs'][0]['outputPath']==target,'Wrong staged emission writes')
        native_overrides[target]=data['outputs'][0]['sha256']
        live=guard_api['outmeta']();changed={p for p in set(live)|set(expected_metadata) if live.get(p)!=expected_metadata.get(p)}
        require(changed=={target},'Emission changed other metadata '+repr(changed));expected_metadata=live;guard('after-'+mode)
        r.setdefault('actualEmissions',[]).append(data);report();return data
    def test_group(label,wanted,old):
        prestage(label);runtime=ROOT/('runtime-'+label);runtime.mkdir()
        for subdir in ['tmp','config','cache','data','user-data','crashes']:(runtime/subdir).mkdir()
        env={'TMPDIR':str(runtime/'tmp'),'XDG_CONFIG_HOME':str(runtime/'config'),'XDG_CACHE_HOME':str(runtime/'cache'),'XDG_DATA_HOME':str(runtime/'data'),'ELECTRON_ENABLE_LOGGING':'1','VSCODE_SKIP_PRELAUNCH':'1','VSCODE_SOURCES_NEW_VALIDATION_STAGE':'test:'+label}
        electron=REPO/'.build/electron'/load_json(REPO/'product.json')['applicationName'];require(electron.is_file(),'Missing fixed Electron')
        args=['xvfb-run','-a','-e',str(runtime/'xvfb.stderr.log'),str(electron),'test/unit/electron/index.js','--crash-reporter-directory='+str(runtime/'crashes'),'--no-sandbox','--disable-gpu','--timeout','15000','--reporter',str(ROOT/'observing-reporter.cjs'),'--run',manifest['sourceFiles'][1]['sourcePath']]
        if old:args+=['--grep',wanted['grep']]
        entry=run_owned(label,args,env);guard('after-'+label)
        result=qualify(entry,wanted,old);provenance=assets_qualification(label,assets,native_overrides);result['nativeProvenanceQualified']=provenance['qualification']
        if old:
            boundary=old_failure_boundary(result,wanted,source_map,map_report);result['qualifiedExpectedOldRed']=result['reporterQualified'] and boundary and provenance['qualification']
        else:result['qualifiedFullReveal']=result['reporterQualified'] and provenance['qualification']
        save(ROOT/(label+'.qualification.json'),result);entry['qualification']=result;report();return result
    node=next(x['path'] for x in manifest['boundToolAndConfigFiles'] if x['path'].endswith('/bin/node'))
    try:
        identity();global_idle('before-lock');lock=open('/tmp/vscode-compile.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);r['sharedLockHeld']=True;global_idle('under-lock')
        before=guard_api['verify']();expected_metadata=before['outMetadata'];require(len(expected_metadata)==15500,'Wrong out metadata count')
        require(len(seals)==2 and [s['path'] for s in seals]==out_paths,'Wrong original seals')
        for s in seals:
            b=Path(s['sealedBytesPath']).read_bytes();require(sha(b)==s['sha256'] and b==Path(s['path']).read_bytes() and len(b)==s['bytes'] and metadata(Path(s['path']))==expected_metadata[s['path']],'Original seal/live changed')
        with (ROOT/'execution-consumed.json').open('x') as f:json.dump(dict(atUtc=now(),releaseSha256=pins['execution-release.json'],oneShot=True,expectedHead=EXPECTED_HEAD),f)
        save(ROOT/'guard-before.json',before);become_subreaper()
        for sig in [signal.SIGTERM,signal.SIGINT]:previous_handlers[sig]=signal.signal(sig,interrupted)
        removed=[k for k in list(os.environ) if k.startswith('NODE_')]
        for k in removed:os.environ.pop(k)
        os.environ['NODE_DISABLE_COMPILE_CACHE']='1';os.environ['VSCODE_NO_SOURCEMAP']='';r['removedInheritedNodeVariableNames']=removed
        for label,file in [('checker','source-checker.mjs'),('lint','linter.mjs')]:
            prestage(label);entry=run_owned(label,[node,'--max-old-space-size=8192',str(ROOT/file)],{'VSCODE_SOURCES_NEW_VALIDATION_STAGE':label});guard('after-'+label);require(entry['exitCode']==0 and not entry['externalWatchdogExpired'],label+' failed; stop')
        prestage('dry');entry=run_owned('dry',[node,str(ROOT/'emitter.mjs'),'dry'],{'VSCODE_SOURCES_NEW_VALIDATION_STAGE':'dry'},emitter_mode='dry');guard('after-dry');require(entry['exitCode']==0 and not entry['externalWatchdogExpired'],'Dry failed; stop')
        dry=load_json(ROOT/'dry-emitter-report.json');require(dry['actualInputCount']==2 and dry['standaloneMapCount']==0 and dry['outWriteFileCalls']==[] and [x['outputPath'] for x in dry['outputs']]==out_paths,'Dry not exactly2 JS/0maps/0outwrites')
        emit('emit-reveal',reveal);source_map,map_report=inline_map(REPO/reveal,manifest['sourceFiles'][1]);save(ROOT/'fresh-Reveal-source-map-report.json',map_report)
        require(sha(Path(pane).read_bytes())==seals[0]['sha256'],'Old Pane changed before red')
        old_result=test_group('old-L1',expected['old'],True)
        require(old_result['qualifiedExpectedOldRed'],'Old L1 not exact qualified business red; no new Pane emission or new run allowed')
        require(all(s.cleanup_done and not s.scan() for s in scopes),'Old process not fully quiescent')
        emit('emit-pane',pane);require(sha(Path(reveal).read_bytes())==map_report['generatedJsSha256'],'Fresh Reveal bytes changed/re-emitted')
        new_result=test_group('new-full-Reveal',expected['new'],False)
        r['qualifiedOldL1']=True;r['qualifiedNewFullReveal']=new_result['qualifiedFullReveal'];r['phase']='old-and-new-finished-awaiting-independent-review';r['exitCode']=0 if new_result['qualifiedFullReveal'] else 1
    except BaseException as error:
        r['failure']=repr(error);r['traceback']=traceback.format_exc();r['phase']='stopped-no-retry';r['exitCode']=1;print(r['traceback'],flush=True)
    finally:
        r['restoreStartedAtUtc']=now();restored=[]
        try:
            for scope in scopes:
                if scope.proc is not None and not scope.cleanup_done:scope.quiesce('outer-finally-before-restore')
                if scope.proc is not None:require(scope.cleanup_done and not scope.scan(),'OUT RESTORATION FORBIDDEN: owned process remains')
            r['allOwnedProcessesStoppedBeforeOutRestoration']=True
            if before is not None:
                try:identity();r['preRestoreIdentityIntegrityExact']=True
                except BaseException as error:r['preRestoreIdentityIntegrityExact']=False;r['preRestoreIntegrityFailure']=repr(error);r['exitCode']=1
                write_audit=restoration_scope_audit(r.get('emissionPhaseEligibility',[]),seals)
                allowed_restore=set(write_audit['restorablePaths'])
                r['restorationScopeAudit']=write_audit;r['actualCompletedWrites']=write_audit['actualCompletedWrites'];r['partialOrUncertainWriteAttempts']=write_audit['partialOrUncertainAttempts'];r['actualRestorePaths']=restored
                save(ROOT/'restoration-scope-audit.json',write_audit)
                if write_audit['protocolFailures']:r['exitCode']=1
                untouched=[]
                for s in seals:
                    if s['path'] in allowed_restore:continue
                    target=Path(s['path']);problems=[]
                    try:
                        require(target.is_file() and not target.is_symlink(),'Unwritten output replaced/missing')
                        value=target.stat()
                        if sha(target.read_bytes())!=s['sha256']:problems.append('bytes')
                        for key,actual in [('mode',stat.S_IMODE(value.st_mode)),('mtimeNs',value.st_mtime_ns),('ctimeNs',value.st_ctime_ns)]:
                            if actual!=s[key]:problems.append(key)
                    except BaseException as error:problems.append(repr(error))
                    untouched.append(dict(path=s['path'],requiredOriginalBytesModeMtimeCtimeExact=True,problems=problems,exact=not problems,restorationWriteAuthorized=False))
                r['unwrittenOutputIntegrity']=untouched
                if any(not row['exact'] for row in untouched):r['unwrittenOutputIntegrityFailure']=True;r['exitCode']=1
                # Only trusted current-run write/possible-write evidence admits a restoration path.
                for s in seals:
                    if s['path'] not in allowed_restore:continue
                    target=Path(s['path']);b=Path(s['sealedBytesPath']).read_bytes();require(sha(b)==s['sha256'],'Sealed original corrupt');require(target.is_file() and not target.is_symlink(),'Refuse replaced target')
                    value=target.stat()
                    if sha(target.read_bytes())!=s['sha256'] or stat.S_IMODE(value.st_mode)!=s['mode'] or value.st_mtime_ns!=s['mtimeNs']:
                        target.write_bytes(b)
                        if stat.S_IMODE(target.stat().st_mode)!=s['mode']:target.chmod(s['mode'])
                        os.utime(target,ns=(s['atimeNs'],s['mtimeNs']));restored.append(s['path'])
                report()
                after=guard_api['verify'](allow_ctime_paths=sorted(allowed_restore),restoration_scope=write_audit);save(ROOT/'guard-after-restore.json',after)
                require({k:v for k,v in before.items() if k not in ['outMetadata','capturedAtUtc','authorizedCtimeDifferences']}=={k:v for k,v in after.items() if k not in ['outMetadata','capturedAtUtc','authorizedCtimeDifferences']},'Restored native/source/freeze/cache changed')
                r['restorationComplete']=True;r['restoreGuard']=dict(restoredPaths=restored,adjudicatedRestorablePaths=sorted(allowed_restore),actualCompletedWrites=write_audit['actualCompletedWrites'],partialOrUncertainAttempts=write_audit['partialOrUncertainAttempts'],originalTwoJsBytesModesMtimesExact=True,ctimeExceptionsOnlyForEvidenceQualifiedSubset=True,unwrittenPathsBytesModeMtimeCtimeExact=all(row['exact'] for row in untouched),allOtherMetadataExact=True,native256Exact=True,separateRevealOriginalExact=True,freeze4Cache3Exact=True,authorizedCtimeDifferences=after['authorizedCtimeDifferences'])
        except BaseException as error:r['restoreFailure']=repr(error);r['restoreTraceback']=traceback.format_exc();r['exitCode']=1;print(r['restoreTraceback'],flush=True)
        r['runtimeFilesystemManifest']=[dict(path=str(p),metadata=metadata(p),symlinkTarget=os.readlink(p) if p.is_symlink() else None) for runtime in ROOT.glob('runtime-*') for p in [runtime,*runtime.rglob('*')] if p.exists() or p.is_symlink()]
        r['finishedAtUtc']=now();report()
        for sig,handler in previous_handlers.items():signal.signal(sig,handler)
        if lock is not None:fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
        print(json.dumps(dict(phase=r.get('phase'),exitCode=r.get('exitCode'),restorationComplete=r['restorationComplete'],fullCompileOfFinalSourceTree=False)),flush=True)
    return r.get('exitCode',1)

if __name__=='__main__':sys.exit(main())

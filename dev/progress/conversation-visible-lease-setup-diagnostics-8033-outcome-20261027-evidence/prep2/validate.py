"""Prepared-only diagnostic: one Reveal, old Pane read-only, one L1+meta run, every outcome stop/restore."""
from pathlib import Path
import ctypes,datetime,fcntl,hashlib,json,os,re,runpy,secrets,signal,stat,subprocess,sys,time,traceback,base64
ROOT=Path(__file__).resolve().parent
REPO=Path('/home/clarence/Projects/Agents/vscode-WorkTrees/merge')
PLAN='vscode-conversation-visible-lease-setup-diagnostics-8033-20261027-prep2'
EXPECTED_HEAD=SOURCE_REF='3497bdc01caa188e5ff37e8877168d50b0a398d0'
EXPECTED_SRC='fa6f7fe9f339963dd9f4190f44aa17e45f6ad731'
TOKEN_KEY='VSCODE_LEASE_DIAGNOSTIC_STAGE_TOKEN'
DRIVER_NONCE_KEY='VSCODE_LEASE_DIAGNOSTIC_DRIVER_NONCE'
STAGES=['checker','lint','dry','emit-reveal','diagnostic-L1']
def require(ok,message):
 if not ok:raise RuntimeError(message)
def sha(b):return hashlib.sha256(b).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def load_json(p):return json.loads(Path(p).read_text())
def save(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def git(*a):return subprocess.check_output(['rtk','proxy','git',*a],cwd=REPO)
def gs(*a):return git(*a).decode().strip()
def load_binding():
 policy,manifest,release=[load_json(ROOT/p) for p in ['policy.json','input-manifest.json','execution-release.json']]
 require(release.get('executionAuthorized') is True and release.get('state')=='AUTHORIZED_DIAGNOSTIC_ONCE' and release.get('authorizedBy')=='/root' and isinstance(release.get('authorizationMessage'),str) and release['authorizationMessage'].strip(),'FAIL CLOSED: preparation is not execution authorization')
 require(ROOT==Path('/tmp')/PLAN and Path.cwd()==REPO,'Wrong scratch/cwd')
 require(policy['planId']==manifest['planId']==release['planId']==PLAN and manifest['repo']==policy['repo']==str(REPO),'Wrong binding')
 require(policy['expectedHead']==manifest['expectedHead']==release['expectedHead']==EXPECTED_HEAD==SOURCE_REF and policy['sourceTree']==manifest['sourceTree']==release['sourceTree']==EXPECTED_SRC and manifest['sourceRef']==release['sourceRef']==SOURCE_REF,'Wrong fixed source')
 require(release['scope']=='single-Reveal-diagnostic-only-L1-plus-official-meta-any-outcome-stop-restore' and policy['stageOrder']==release['executionStages']==STAGES and policy['sourceInputCount']==policy['totalAllowedOutPaths']==1 and policy['temporaryProductionJs']==0 and len(manifest['sourceFiles'])==1,'Expanded stage/input/write scope')
 require(manifest['sourceFiles'][0]['sourcePath']=='src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts' and policy['writableOutputPaths']==['out/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.js'],'Wrong single Reveal path')
 names=load_json(ROOT/'pin-names.json');require(set(release['pinnedFilesSha256'])==set(names),'Expanded/incomplete pins')
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

def qualify_actual(entry,wanted):
 data,events,count=parse_reporter(entry)
 def observed(kind,title):return [x['data'] for x in events if x['event']==kind and x['data'].get('fullTitle')==title]
 titles=wanted['requiredFullTitles'];rows=[]
 for title in titles:
  starts,ends,passes,fails,pending=[observed(k,title) for k in ['testStart','testEndObserved','pass','fail','pendingObserved']]
  complete=len(starts)==len(ends)==1 and len(passes)+len(fails)==1 and len(pending)==0
  outcome='pass' if len(passes)==1 and not fails else 'fail' if len(fails)==1 and not passes else 'unknown'
  rows.append(dict(fullTitle=title,startCount=len(starts),endCount=len(ends),passCount=len(passes),failCount=len(fails),pendingCount=len(pending),completionExact=complete,actualOutcome=outcome))
 starts=[x['data'].get('fullTitle') for x in events if x['event']=='testStart'];missing=sorted(set(titles)-set(starts));unknown=sorted(set(starts)-set(titles))
 hooktitles={x['data'].get('fullTitle','') for x in events if x['event'] in ['hookStartObserved','hookEndObserved']};hooks=[dict(fullTitle=t,startCount=len(observed('hookStartObserved',t)),endCount=len(observed('hookEndObserved',t))) for t in sorted(hooktitles)]
 hs=sum(x['startCount'] for x in hooks);he=sum(x['endCount'] for x in hooks);stats=data.get('stats',{}) if data else {};passes=data.get('passes',[]) if data else [];failures=data.get('failures',[]) if data else [];tests=data.get('tests',[]) if data else []
 stream_fails=[x['data'] for x in events if x['event']=='fail'];stream_passes=[x['data'].get('fullTitle') for x in events if x['event']=='pass'];stream_pending=[x['data'].get('fullTitle') for x in events if x['event']=='pendingObserved']
 expected_exit=1 if failures else 0
 stats_consistent=bool(data and stats.get('tests')==len(tests) and stats.get('passes')==len(passes) and stats.get('failures')==len(failures) and stats.get('pending')==len(data.get('pending',[])))
 actual_consistent=bool(data and sorted(x.get('fullTitle') for x in tests)==sorted(titles) and sorted(x.get('fullTitle') for x in passes)==sorted(stream_passes) and sorted(x.get('fullTitle') for x in failures)==sorted(x.get('fullTitle') for x in stream_fails) and sorted(x.get('fullTitle') for x in data.get('pending',[]))==sorted(stream_pending))
 ended=sum(x['event']=='end' for x in events)==1 and sum(x['event']=='observerEnd' for x in events)==1
 selection_exact=all(x['completionExact'] for x in rows) and not missing and not unknown
 hooks_exact=hs==he==wanted['expectedHookPairs'] and all(x['startCount']==x['endCount'] for x in hooks)
 exit_consistent=bool(data and entry.get('exitCode')==expected_exit)
 integrity=bool(count==1 and stats_consistent and actual_consistent and ended and selection_exact and hooks_exact and exit_consistent and entry.get('allOwnedDescendantsStoppedAndReaped') is True and not entry.get('externalWatchdogExpired'))
 return dict(officialJSONCount=count,actualStats=stats,perTitleActual=rows,missing=missing,unknown=unknown,selectionAndActualCompletionExact=selection_exact,officialStatsMatchActualRows=stats_consistent,officialEventsAndRowsConsistent=actual_consistent,officialRunEndAndObserverEnd=ended,hookStartCount=hs,hookEndCount=he,expectedHookPairs=wanted['expectedHookPairs'],hookStartEndPerTitle=hooks,hooksBalancedAndExact=hooks_exact,rawStreamFailures=stream_fails,rawOfficialFailures=failures,officialRunnerActualExitCode=entry.get('exitCode'),officialRunnerExitExpectedFromActualFailures=expected_exit,officialRunnerExitMatchesActualOutcome=exit_consistent,reporterIntegrityQualified=integrity,ownedCleanupComplete=entry.get('allOwnedDescendantsStoppedAndReaped') is True,watchdogExpired=entry.get('externalWatchdogExpired'),oldFailedBodyLeakCheckClaim=False,noBusinessRedOrGreenCredit=True,actualOutcomesNeverRewrittenToExpectedFailure=True)


def inline_map(path,source_row):
 b=path.read_bytes();m=re.search(rb'//# sourceMappingURL=data:application/json[^,]*;base64,([^\r\n]+)',b)
 require(m is not None,'Fresh Reveal requires inline source map')
 raw=base64.b64decode(m[1],validate=True);d=json.loads(raw)
 require(d.get('version')==3 and len(d.get('sources',[]))==len(d.get('sourcesContent',[])),'Invalid complete source map')
 matches=[i for i,s in enumerate(d['sources']) if s.endswith(source_row['sourcePath'])]
 require(len(matches)==1 and d['sourcesContent'][matches[0]].encode()==Path(source_row['inputCopyPath']).read_bytes(),'Inline map does not bind exact fresh Reveal source')
 save(ROOT/'fresh-Reveal.inline-source-map.json',d)
 return d,dict(sourceRef=source_row['sourceRef'],sourceBlob=source_row['sourceBlob'],sourceSha256=source_row['sourceSha256'],rawMapBytes=len(raw),rawMapSha256=sha(raw),generatedJsBytes=len(b),generatedJsSha256=sha(b),sources=d['sources'],exactSourceContent=True)

def map_frame(source_map,line,column):
 require(isinstance(line,int) and line>=1 and isinstance(column,int) and column>=1,'Invalid generated frame position')
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
   require(shift==0 and len(values) in (1,4,5) and values[0]>=0,'Invalid source-map VLQ segment')
   generated_column+=values[0]
   mapped=None
   if len(values)>=4:
    source_index+=values[1];original_line+=values[2];original_column+=values[3]
    require(0<=source_index<len(source_map['sources']) and original_line>=0 and original_column>=0,'Invalid source-map source position')
    mapped=dict(source=source_map['sources'][source_index],line=original_line+1,column=original_column+1,generatedLine=line,generatedColumn=generated_column+1)
   # GLB must honor the nearest single-field unmapped segment, which clears a preceding mapping.
   if generated_line==line and generated_column<=column-1:best=mapped
  if generated_line==line:return best
 return None

def diagnostic_boundary(result,wanted,source_map,map_report):
 boundary=load_json(ROOT/'source-boundary.json');source_row=load_json(ROOT/'source-inputs.json')[0];source_text=Path(source_row['inputCopyPath']).read_text();assertion=boundary['assertionTextIncludingLF']
 require(source_text.count(assertion)==1 and sha(assertion.encode())==boundary['assertionTextSha256'],'Frozen assertion text is not unique')
 assertion_line=source_text[:source_text.index(assertion)].count('\n')+1
 l1row=next(x for x in result['perTitleActual'] if x['fullTitle']==wanted['L1Title']);failures=[x for x in result['rawOfficialFailures'] if x.get('fullTitle')==wanted['L1Title']];streams=[x for x in result['rawStreamFailures'] if x.get('fullTitle')==wanted['L1Title']]
 err=failures[0].get('err',{}) if len(failures)==1 else {};stack=err.get('stack','');message=err.get('message','');delimiter=boundary['diagnosticSuffixDelimiter'];delimiter_count=stack.count(delimiter);primary=stack;diagnostic_raw=None;diagnostic=None;parse_error=None
 if delimiter_count:
  primary,diagnostic_raw=stack.split(delimiter,1)
  if delimiter_count==1:
   try:diagnostic=json.loads(diagnostic_raw)
   except (json.JSONDecodeError,TypeError) as error:parse_error=repr(error)
  else:parse_error='Ambiguous diagnostics suffix delimiters: '+str(delimiter_count)
 mapped=[]
 for line,column in re.findall(r'conversationSessionWindowReveal\.test\.js:(\d+):(\d+)',primary):
  value=map_frame(source_map,int(line),int(column))
  if value:mapped.append(value)
 direct=[dict(source=source_row['sourcePath'],line=int(line),column=int(col or 1),origin='actual-primary-direct-TS-frame') for line,col in re.findall(r'conversationSessionWindowReveal\.test\.ts:(\d+)(?::(\d+))?',primary)]
 frames=mapped+direct;assertion_frame=any(x['source'].endswith(source_row['sourcePath']) and x['line']==assertion_line for x in frames)
 observed=bool(len(failures)==len(streams)==1 and message==boundary['expectedAssertionMessage'] and streams[0].get('err')==message and 'AssertionError' in primary and assertion_frame and delimiter_count<=1 and not parse_error and not re.search(r'TypeError|ReferenceError|ERR_MODULE_NOT_FOUND|Timeout of|timed out|watchdog',primary))
 setup_text="await bounded(ready, '"+boundary['setupFailureMessage']+"');";require(source_text.count(setup_text)==1,'Setup wait text not unique');setup_line=source_text[:source_text.index(setup_text)].count('\n')+1
 setup_located=bool(l1row['actualOutcome']=='fail' and message==boundary['setupFailureMessage'] and any(x['source'].endswith(source_row['sourcePath']) and x['line']==setup_line for x in frames) and source_text.index('const harness = await createEngineRevealHarness();',source_text.index("test('L1 same visible"))<source_text.index(assertion) and 'const pane = await waitForEnginePane(' in source_text)
 if observed:evidence='Actual primary AssertionError maps to unique assertion text in exact frozen inline-map source; preceding fixed control flow reached. No individual-assert instrumentation or business credit.';reach='expected assertion failure observed'
 elif setup_located:evidence='Actual primary failure at frozen engine Pane setup wait, which fixed L1 awaits before the assertion; this run did not reach that assertion.';reach='not reached: actual prerequisite stack and fixed control flow'
 elif l1row['actualOutcome']=='pass':evidence='Actual L1 pass remains pass; no expected old-red assertion failure or business credit granted.';reach='actual pass; no failure-boundary adjudication'
 else:evidence='Actual primary stack/control flow does not establish assertion reachability; preserve actual outcome and frames.';reach='unknown'
 result.update(expectedOldRedFailureBoundaryObserved=observed,boundaryStatement='actual primary failure supports frozen expected assertion boundary' if observed else 'expected old-red boundary not established',actualL1Outcome=l1row['actualOutcome'],actualAssertionMessage=message,completeRawStack=stack,primaryStack=primary,diagnosticSuffixCount=delimiter_count,diagnosticRawJSON=diagnostic_raw,diagnosticJSON=diagnostic,diagnosticParseError=parse_error,diagnosticParseStatus='absent-allowed' if not delimiter_count else 'parsed' if not parse_error else 'error-preserved',mappedPrimaryFrames=frames,diagnosticNestedStacksNeverMapped=True,frozenAssertionLineResolvedFromExactSource=assertion_line,frozenAssertionTextIncludingLF=assertion,inlineSourceMap=map_report,prerequisiteEvidence=evidence,reachability=reach,actualSetupPrerequisiteLocated=setup_located,noBusinessRedOrGreenCredit=True,oldFailedBodyLeakCheckClaim=False,failedBodyLeakBoundary='utils.ts skips computeLeakingDisposables for failed body; hooks/owned cleanup are recorded separately')
 return observed


def assets_qualification(label,manifest_assets,native_overrides):
 report=load_json(ROOT/(label+'.loaded-assets.json'));by_path={x['path']:x for x in manifest_assets['files']};observed=[];seen=set();problems=[]
 for actual in report['observed']:
  path=actual['path'];pinned=by_path.get(path)
  if pinned is None:problems.append('unmanifested '+path);continue
  wanted=native_overrides.get(path,pinned['sha256'])
  if actual['diskSha256']!=wanted or sha((REPO/path).read_bytes())!=wanted:problems.append('native drift '+path)
  row={**pinned,**actual,'observationStatus':'actually-loaded-parsed-script' if actual['kind']=='parsed-script' else 'actually-registered-stylesheet','currentSourceEmittedToNative':pinned['currentSourceEmittedToNative']}
  if path in native_overrides:
   row.update(bytes=actual['diskBytes'],sha256=wanted,producerRef='this-single-Reveal-diagnostic-emission',producerSourceBlob=pinned['currentSourceBlob'],producerSourceSha256=pinned['currentSourceSha256'],producerQualification='exact-fresh-target-emitter-report-plus-runtime-source',currentSourceEmittedToNative=True)
  if path in [x['path'] for x in load_json(ROOT/'observation-targets.json')]:
   if actual.get('targetRuntimeSourceEqualsDiskBytes') is not True or actual.get('targetRuntimeSourceSha256')!=wanted:problems.append('target runtime bytes not exact '+path)
  observed.append(row);seen.add(path)
 targets={x['path'] for x in load_json(ROOT/'observation-targets.json')}
 if not targets.issubset(seen):problems.append('missing target observations '+repr(sorted(targets-seen)))
 result=dict(label=label,observedAssets=observed,manifestOnlyUnobservedPaths=sorted(set(by_path)-seen),loadedUniquePathCount=len(seen),manifestOnlyCount=len(set(by_path)-seen),observerErrors=report['observerErrors'],problems=problems,unmappedRegisteredStylesheets=report['unmappedRegisteredStylesheets'],unmappedStylesheetsGrantedNativeProducerCredit=False,qualification=not problems and not report['observerErrors'],loadedDoesNotMeanFunctionCoverageOrUiAfter=True,fullCompileOfFinalSourceTree=False)
 save(ROOT/(label+'.native-provenance.json'),result);return result

def restoration_scope_audit(phases,seals):
    """Only parent-qualified spawn plus this phase's trusted journal prefix grants restoration."""
    fixed={'emit-reveal':next(s['path'] for s in seals if s['potentialWriteEligibility'])}
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
            if not isinstance(event,dict):
                local_errors.append(dict(line=index+1,reason='nonobject-journal-record',rawDecodedEvent=event));break
            writer_pid=event.get('writerPid');writer_start=event.get('writerStartTime');writer_token=event.get('stageTokenSha256');expected_token=phase.get('stageTokenSha256')
            if not (type(writer_pid) is int and writer_pid>0 and isinstance(writer_start,str) and re.fullmatch('[0-9]+',writer_start) is not None and isinstance(writer_token,str) and re.fullmatch('[0-9a-f]{64}',writer_token) is not None and isinstance(expected_token,str) and re.fullmatch('[0-9a-f]{64}',expected_token) is not None and writer_token==expected_token):
                local_errors.append(dict(line=index+1,reason='invalid-writer-fields-or-stage-token',rawDecodedEvent=event));break
            expected_phase='intent' if index==0 else 'completed' if index==1 else None
            canonical=(isinstance(event,dict) and expected_phase is not None and event.get('phase')==expected_phase and event.get('path')==path and event.get('bytes')==phase['expectedFreshBytes'] and event.get('sha256')==phase['expectedFreshSha256'])
            writer_owned=(event.get('writerPid'),event.get('writerStartTime')) in {(r['pid'],r['startTime']) for r in phase.get('ownedProcesses',[])} and event.get('stageTokenSha256')==phase.get('stageTokenSha256')
            canonical=canonical and writer_owned
            if expected_phase=='completed':canonical=canonical and event.get('absolutePath')==str(REPO/path) and (event.get('writerPid'),event.get('writerStartTime'))==(valid[0].get('writerPid'),valid[0].get('writerStartTime'))
            if not canonical:
                local_errors.append(dict(line=index+1,reason='out-of-scope-or-invalid-journal-sequence',rawDecodedEvent=event));break
            valid.append(event)
        if not valid:
            local_errors.append(dict(reason='no-trusted-intent-record'));not_admitted.append(dict(mode=mode,path=path,actualSpawned=True,reason='No trusted intent prefix; current drift cannot grant permission',restorationAuthorized=False))
        if local_errors:problem(mode,'journal-protocol-failure',local_errors)
        journals.append(dict(mode=mode,path=str(journal),bytes=len(raw),sha256=sha(raw),trustedPrefixRecords=valid,protocolErrors=local_errors))
        # No current output drift is consulted to grant write or ctime authority.
        if valid and valid[0]['phase']=='intent':
            row=dict(mode=mode,path=path,rootPid=phase['rootPid'],rootStartTime=phase['rootStartTime'],parentSinglePathAuthority=True,qualifiedParentSpawn=True,journalOwnedWriter=True,journalSha256=sha(raw),trustedIntent=valid[0],expectedFreshBytes=phase['expectedFreshBytes'],expectedFreshSha256=phase['expectedFreshSha256'])
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
    source=manifest['sourceFiles'][0];reveal=source['outputPath'];seals=load_json(ROOT/'sealed-originals.json');pane=next(s['path'] for s in seals if not s['potentialWriteEligibility'])
    require(policy['writableOutputPaths']==[reveal] and policy['observationTargetPaths']==[pane,reveal] and len(seals)==2 and [s['path'] for s in seals if s['potentialWriteEligibility']]==[reveal] and all(s['restoreAuthority'] is False for s in seals),'Expanded write/seal authority')
    def identity():
        for name,digest in pins.items():require(sha((ROOT/name).read_bytes())==digest,'Prepared file changed '+name)
        require(gs('rev-parse','HEAD')==EXPECTED_HEAD and gs('rev-parse','HEAD:src')==EXPECTED_SRC and not gs('status','--porcelain=v1'),'HEAD/src/clean changed')
        b=(REPO/source['sourcePath']).read_bytes();require(b==git('show',SOURCE_REF+':'+source['sourcePath'])==Path(source['inputCopyPath']).read_bytes() and sha(b)==source['sourceSha256'] and len(b)==source['sourceBytes'],'Frozen Reveal changed')
        for row in manifest['boundToolAndConfigFiles']:
            p=Path(row['path']);b=p.read_bytes();require(sha(b)==row['sha256'] and len(b)==row['bytes'] and stat.S_IMODE(p.stat().st_mode)==row['mode'],'Tool/config changed '+row['path'])
    identity();guard_api=runpy.run_path(str(ROOT/'guard.py'),run_name='guard');selection=load_json(ROOT/'selection.json');assets=load_json(ROOT/'native-asset-manifest.json')
    require(selection['grep']=='^(?:'+'|'.join(re.escape(t) for t in selection['requiredFullTitles'])+')$' and len(selection['requiredFullTitles'])==2,'Expanded/unescaped selection')
    native_overrides={};before=None;expected_metadata=None;scopes=[];nonce=secrets.token_hex(32);run_token=secrets.token_hex(32)
    r={'runId':PLAN,'head':EXPECTED_HEAD,'src':EXPECTED_SRC,'sourceRef':SOURCE_REF,'startedAtUtc':now(),'stages':[],'guards':[],'restorationComplete':False,'fullCompileOfFinalSourceTree':False,'noBusinessRedOrGreenCredit':True,'officialRunnerActualExitCode':None,'diagnosticProtocolStatus':'not-started','noAutomaticRetry':True,'exitCode':1}
    report_path=ROOT/'diagnostic-report.json';require(not report_path.exists() and not (ROOT/'execution-consumed.json').exists(),'One shot consumed/report exists')
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
        identity();value=guard_api['verify'](expected_metadata,native_overrides);r['guards'].append(dict(label=label,atUtc=now(),all15500ExpectedMetadataExact=True,native256AndCurrentRevealExact=True,freeze4Cache3Exact=True,history257125174And28QuietExact=True));report();return value
    def prestage(label):
        require(label in STAGES and all(s.cleanup_done and not s.scan() for s in scopes),'Expanded stage or prior owned processes not quiet');global_idle(label);guard('before-'+label)
    def run_owned(label, args, overrides=None, emitter_mode=None):
        unchanged_preparation()
        stdout, stderr = ROOT / (label + '.stdout.log'), ROOT / (label + '.stderr.log')
        require(not stdout.exists() and not stderr.exists(), 'Refuse log overwrite')
        overrides = dict(overrides or {})
        token = run_token + ':' + label + ':' + secrets.token_hex(24)
        child_env = {**os.environ, **overrides, TOKEN_KEY: token, DRIVER_NONCE_KEY: nonce}
        if emitter_mode:
            child_env['VSCODE_LEASE_DIAGNOSTIC_EMITTER_MODE'] = emitter_mode
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
    def interrupted(signum,frame):raise RuntimeError('Diagnostic interrupted '+signal.Signals(signum).name)
    node=next(x['path'] for x in manifest['boundToolAndConfigFiles'] if x['path'].endswith('/bin/node'))
    def emit_reveal():
        nonlocal expected_metadata
        mode='emit-reveal';target=reveal;prestage(mode);phases=r.setdefault('emissionPhaseEligibility',[]);require(not phases,'Only one possible emit phase')
        journal=ROOT/(mode+'-out-write-journal.jsonl');require(not journal.exists() and not journal.is_symlink(),'Journal predates phase')
        fresh=load_json(ROOT/'dry-emitter-report.json')['outputs'][0];require(fresh['outputPath']==reveal,'Wrong dry output')
        phase=dict(mode=mode,eligiblePath=target,journalPath=str(journal),journalAbsentImmediatelyBeforeSpawn=True,authorizedAtUtc=now(),expectedFreshBytes=fresh['bytes'],expectedFreshSha256=fresh['sha256'],actualSpawned=False);phases.append(phase);report()
        try:entry=run_owned(mode,[node,str(ROOT/'emitter.mjs'),mode],{'VSCODE_LEASE_DIAGNOSTIC_STAGE':mode},emitter_mode=mode)
        finally:
            matching=[s for s in scopes if s.label==mode]
            if len(matching)==1:
                owned=matching[0];stage=owned.entry;phase.update(actualSpawned=owned.proc is not None,rootPid=owned.proc.pid if owned.proc is not None else None,rootStartTime=owned.root_pair[1] if owned.root_pair else None,spawnEntryMatchesPhase=stage.get('stage')==mode and stage.get('command')==['rtk','proxy',node,str(ROOT/'emitter.mjs'),mode],stageExitCode=stage.get('exitCode'),ownedCleanupComplete=owned.cleanup_done,stageTokenSha256=stage.get('stageTokenSha256'),ownedProcesses=stage.get('ownedProcesses',[]),spawnEvidenceCapturedAtUtc=now())
            report()
        require(entry['exitCode']==0 and not entry['externalWatchdogExpired'],'Reveal emitter failed; stop')
        scope=restoration_scope_audit(phases,seals);save(ROOT/'emit-reveal.parent-write-qualification.json',scope);require(not scope['protocolFailures'] and [x['path'] for x in scope['actualCompletedWrites']]==[reveal],'Unqualified emitter write journal; stop')
        data=load_json(ROOT/'emit-reveal-emitter-report.json');require(data['actualInputCount']==1 and data['standaloneMapCount']==0 and data['productionOutWriteFileCalls']==0 and [x['path'] for x in data['outWriteFileCalls']]==[reveal] and len(data['outputs'])==1,'Expanded emission')
        native_overrides[reveal]=data['outputs'][0]['sha256'];live=guard_api['outmeta']();changed={p for p in set(live)|set(expected_metadata) if live.get(p)!=expected_metadata.get(p)};require(changed=={reveal},'Emission changed other metadata '+repr(changed));expected_metadata=live;guard('after-emit-reveal');r['actualEmission']=data;report()
    def diagnostic_run(source_map,map_report):
        label='diagnostic-L1';prestage(label);runtime=ROOT/('runtime-'+label);runtime.mkdir()
        for subdir in ['tmp','config','cache','data','user-data','crashes']:(runtime/subdir).mkdir()
        env={'TMPDIR':str(runtime/'tmp'),'XDG_CONFIG_HOME':str(runtime/'config'),'XDG_CACHE_HOME':str(runtime/'cache'),'XDG_DATA_HOME':str(runtime/'data'),'ELECTRON_ENABLE_LOGGING':'1','VSCODE_SKIP_PRELAUNCH':'1','VSCODE_LEASE_DIAGNOSTIC_STAGE':'test:'+label}
        electron=REPO/'.build/electron'/load_json(REPO/'product.json')['applicationName'];require(electron.is_file(),'Missing pinned Electron')
        args=['xvfb-run','-a','-e',str(runtime/'xvfb.stderr.log'),str(electron),'test/unit/electron/index.js','--crash-reporter-directory='+str(runtime/'crashes'),'--no-sandbox','--disable-gpu','--timeout','15000','--reporter',str(ROOT/'observing-reporter.cjs'),'--run',source['sourcePath'],'--grep',selection['grep']]
        entry=run_owned(label,args,env);r['officialRunnerActualExitCode']=entry['exitCode'];r['officialRunnerWatchdogExpired']=entry['externalWatchdogExpired'];report()
        result=qualify_actual(entry,selection);r['diagnosticResult']=result;save(ROOT/'diagnostic-L1.qualification.json',result);report();guard('after-diagnostic-L1')
        provenance=assets_qualification(label,assets,native_overrides);result['nativeProvenanceQualified']=provenance['qualification'];diagnostic_boundary(result,selection,source_map,map_report)
        result['diagnosticObservationComplete']=result['reporterIntegrityQualified'] and provenance['qualification'];save(ROOT/'diagnostic-L1.qualification.json',result);entry['qualification']=result;r['diagnosticProtocolStatus']='accounted-official-outcome' if result['diagnosticObservationComplete'] else 'incomplete-observation';r['phase']='diagnostic-outcome-stop-restore';r['exitCode']=0 if result['diagnosticObservationComplete'] else 1;report()
        # This function returns to final restoration for EVERY actual result. There is no next test/emission dispatch.
    try:
        identity();global_idle('before-lock');lock=open('/tmp/vscode-compile.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);r['sharedLockHeld']=True;global_idle('under-lock')
        before=guard_api['verify']();expected_metadata=before['outMetadata'];require(len(expected_metadata)==15500,'Wrong metadata count')
        for s in seals:
            b=Path(s['sealedBytesPath']).read_bytes();require(sha(b)==s['sha256'] and len(b)==s['bytes'] and b==(REPO/s['path']).read_bytes() and metadata(REPO/s['path'])==expected_metadata[s['path']],'Seal/live changed')
        with (ROOT/'execution-consumed.json').open('x') as f:json.dump(dict(atUtc=now(),releaseSha256=pins['execution-release.json'],oneShot=True,expectedHead=EXPECTED_HEAD),f)
        save(ROOT/'guard-before.json',before);become_subreaper()
        for sig in [signal.SIGTERM,signal.SIGINT]:previous_handlers[sig]=signal.signal(sig,interrupted)
        removed=[k for k in list(os.environ) if k.startswith('NODE_') or k.startswith('VSCODE_LEASE_DIAGNOSTIC_') or k=='ELECTRON_RUN_AS_NODE']
        for k in removed:os.environ.pop(k)
        os.environ['NODE_DISABLE_COMPILE_CACHE']='1';os.environ['VSCODE_NO_SOURCEMAP']='';r['removedInheritedVariableNames']=removed
        for label,file in [('checker','source-checker.mjs'),('lint','linter.mjs')]:
            prestage(label);entry=run_owned(label,[node,'--max-old-space-size=8192',str(ROOT/file)],{'VSCODE_LEASE_DIAGNOSTIC_STAGE':label});guard('after-'+label);require(entry['exitCode']==0 and not entry['externalWatchdogExpired'],label+' failed; stop')
        prestage('dry');entry=run_owned('dry',[node,str(ROOT/'emitter.mjs'),'dry'],{'VSCODE_LEASE_DIAGNOSTIC_STAGE':'dry'},emitter_mode='dry');guard('after-dry');require(entry['exitCode']==0 and not entry['externalWatchdogExpired'],'Dry failed; stop')
        dry=load_json(ROOT/'dry-emitter-report.json');require(dry['actualInputCount']==1 and dry['standaloneMapCount']==0 and dry['outWriteFileCalls']==[] and dry['productionOutWriteFileCalls']==0 and [x['outputPath'] for x in dry['outputs']]==[reveal],'Dry not exactly1JS/0maps/0outwrites')
        emit_reveal();source_map,map_report=inline_map(REPO/reveal,source);save(ROOT/'fresh-Reveal-source-map-report.json',map_report);require(sha((REPO/pane).read_bytes())==next(s['sha256'] for s in seals if s['path']==pane),'Old Pane drift')
        diagnostic_run(source_map,map_report)
    except BaseException as error:
        r['failure']=repr(error);r['traceback']=traceback.format_exc();r['phase']='stopped-protocol-exception-no-retry';r['diagnosticProtocolStatus']='exception-preserved';r['exitCode']=1;print(r['traceback'],flush=True)
    finally:
        r['restoreStartedAtUtc']=now();restored=[]
        try:
            for scope in scopes:
                if scope.proc is not None and not scope.cleanup_done:scope.quiesce('outer-finally-before-restore')
                if scope.proc is not None:require(scope.cleanup_done and not scope.scan(),'RESTORATION FORBIDDEN: owned processes remain')
            r['allOwnedProcessesStoppedBeforeOutRestoration']=True
            if before is not None:
                try:identity();r['preRestoreIdentityIntegrityExact']=True
                except BaseException as error:r['preRestoreIdentityIntegrityExact']=False;r['preRestoreIntegrityFailure']=repr(error);r['exitCode']=1
                scope=restoration_scope_audit(r.get('emissionPhaseEligibility',[]),seals);allowed=set(scope['restorablePaths']);require(allowed.issubset({reveal}),'Pane/other restoration forbidden');r['restorationScopeAudit']=scope;r['actualCompletedWrites']=scope['actualCompletedWrites'];r['partialOrUncertainWriteAttempts']=scope['partialOrUncertainAttempts'];r['actualRestorePaths']=restored;save(ROOT/'restoration-scope-audit.json',scope)
                if scope['protocolFailures']:r['exitCode']=1
                untouched=[]
                for s in seals:
                    if s['path'] in allowed:continue
                    target=REPO/s['path'];problems=[]
                    try:
                        require(target.is_file() and not target.is_symlink(),'Unwritten output replaced/missing');v=target.stat()
                        if sha(target.read_bytes())!=s['sha256']:problems.append('bytes')
                        for k,a in [('mode',stat.S_IMODE(v.st_mode)),('mtimeNs',v.st_mtime_ns),('ctimeNs',v.st_ctime_ns)]:
                            if a!=s[k]:problems.append(k)
                    except BaseException as error:problems.append(repr(error))
                    untouched.append(dict(path=s['path'],problems=problems,exact=not problems,restorationWriteAuthorized=False))
                r['unwrittenOutputIntegrity']=untouched
                if any(not x['exact'] for x in untouched):r['unwrittenOutputIntegrityFailure']=True;r['exitCode']=1
                for s in seals:
                    if s['path'] not in allowed:continue
                    target=REPO/s['path'];b=Path(s['sealedBytesPath']).read_bytes();require(sha(b)==s['sha256'] and target.is_file() and not target.is_symlink(),'Corrupt seal or replaced target');v=target.stat()
                    if sha(target.read_bytes())!=s['sha256'] or stat.S_IMODE(v.st_mode)!=s['mode'] or v.st_mtime_ns!=s['mtimeNs']:
                        target.write_bytes(b)
                        if stat.S_IMODE(target.stat().st_mode)!=s['mode']:target.chmod(s['mode'])
                        os.utime(target,ns=(s['atimeNs'],s['mtimeNs']));restored.append(s['path'])
                report();after=guard_api['verify'](allow_ctime_paths=sorted(allowed),restoration_scope=scope);save(ROOT/'guard-after-restore.json',after)
                compare=lambda x:{k:v for k,v in x.items() if k not in ['capturedAtUtc','outMetadata','authorizedCtimeDifferences']};require(compare(before)==compare(after),'Restored identities changed')
                r['restorationComplete']=True;r['restorationStatus']='complete';r['restoreGuard']=dict(restoredPaths=restored,adjudicatedRestorablePaths=sorted(allowed),unwrittenPathsExact=all(x['exact'] for x in untouched),allOtherMetadataExact=True,native256AndOldRevealExact=True,authorizedCtimeDifferences=after['authorizedCtimeDifferences'])
        except BaseException as error:r['restoreFailure']=repr(error);r['restoreTraceback']=traceback.format_exc();r['restorationStatus']='failed-preserved-stop-for-root';r['exitCode']=1;print(r['restoreTraceback'],flush=True)
        r['runtimeFilesystemManifest']=[dict(path=str(p),metadata=metadata(p),symlinkTarget=os.readlink(p) if p.is_symlink() else None) for runtime in ROOT.glob('runtime-*') for p in [runtime,*runtime.rglob('*')] if p.exists() or p.is_symlink()];r['finishedAtUtc']=now();report()
        for sig,handler in previous_handlers.items():signal.signal(sig,handler)
        if lock is not None:fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
        print(json.dumps(dict(phase=r.get('phase'),diagnosticProtocolStatus=r['diagnosticProtocolStatus'],officialRunnerActualExitCode=r['officialRunnerActualExitCode'],driverExitCode=r['exitCode'],restorationComplete=r['restorationComplete'],noBusinessRedOrGreenCredit=True)),flush=True)
    return r['exitCode']
if __name__=='__main__':sys.exit(main())

// Observer adapter only. Official full-json-stream and Mocha JSON reporters unchanged.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const scratch = __dirname, repo = '/home/clarence/Projects/Agents/vscode-WorkTrees/merge';
const release = JSON.parse(fs.readFileSync(path.join(scratch, 'execution-release.json')));
if (release.planId !== 'vscode-conversation-visible-lease-setup-diagnostics-8033-20261027-prep1' || release.scope !== 'single-Reveal-diagnostic-only-L1-plus-official-meta-any-outcome-stop-restore' || release.expectedHead !== '3497bdc01caa188e5ff37e8877168d50b0a398d0' || process.env.VSCODE_LEASE_DIAGNOSTIC_STAGE !== 'test:diagnostic-L1') throw Error('Wrong diagnostic-only reporter scope');
const fail = message => { throw Error(message); };
if (!(release.executionAuthorized === true && release.state === 'AUTHORIZED_DIAGNOSTIC_ONCE' && release.authorizedBy === '/root' && release.authorizationMessage && process.env.VSCODE_LEASE_DIAGNOSTIC_STAGE?.startsWith('test:') && process.env.VSCODE_LEASE_DIAGNOSTIC_STAGE_TOKEN?.includes(':'))) fail('FAIL CLOSED: reporter requires owned explicit execution release');
for (const [name, digest] of Object.entries(release.pinnedFilesSha256)) if (crypto.createHash('sha256').update(fs.readFileSync(path.join(scratch, name))).digest('hex') !== digest) fail('Unpinned reporter preparation ' + name);
const FullJsonStreamReporter = require(path.join(repo, 'test/unit/fullJsonStreamReporter.js'));
const JSONReporter = require(path.join(repo, 'node_modules/mocha/lib/reporters/json.js'));
module.exports = class OfficialReporterObserver {
 constructor(runner, options) {
  if (Object.keys(options?.reporterOptions ?? {}).length || options?.reporterOption?.output) fail('Reporter output-file/options expansion forbidden; stdout only');
  this.stream = new FullJsonStreamReporter(runner, options);
  this.json = new JSONReporter(runner, options);
  const clean = runnable => ({ title: runnable.title, fullTitle: runnable.fullTitle(), duration: runnable.duration, currentRetry: runnable.currentRetry() });
  const emit = (event, value) => { this.last = new Promise(resolve => process.stdout.write(JSON.stringify([event, value]) + '\n', resolve)); };
  for (const [event, label] of [['pending', 'pendingObserved'], ['test end', 'testEndObserved'], ['hook', 'hookStartObserved'], ['hook end', 'hookEndObserved']]) runner.on(event, runnable => emit(label, clean(runnable)));
  runner.once('end', () => { process.stdout.write('\n'); emit('observerEnd', { officialJSONAvailable: !!runner.testResults, stats: runner.stats }); });
 }
 async drain() { await this.stream.drain(); await this.last; }
};

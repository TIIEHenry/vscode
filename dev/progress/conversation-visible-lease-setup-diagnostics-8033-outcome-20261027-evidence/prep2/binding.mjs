// Preparation only. No compiler/linter/Electron dependency loads before explicit root release.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
export const scratch = path.dirname(import.meta.filename);
export const repo = '/home/clarence/Projects/Agents/vscode-WorkTrees/merge';
export const plan = 'vscode-conversation-visible-lease-setup-diagnostics-8033-20261027-prep2';
export const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export const check = (ok, message) => { if (!ok) throw Error(message); };
export const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export const git = (...args) => execFileSync('rtk', ['proxy', 'git', ...args], { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
export function authorize(stage) {
 const release = json(path.join(scratch, 'execution-release.json'));
 check(release.executionAuthorized === true && release.state === 'AUTHORIZED_DIAGNOSTIC_ONCE' && release.authorizedBy === '/root' && typeof release.authorizationMessage === 'string' && release.authorizationMessage.trim(), 'FAIL CLOSED: separate explicit root execution release required');
 check(scratch === '/tmp/' + plan && process.cwd() === repo && release.planId === plan && release.scope === 'single-Reveal-diagnostic-only-L1-plus-official-meta-any-outcome-stop-restore', 'Wrong scratch/plan/scope');
 const policy = json(path.join(scratch, 'policy.json')), manifest = json(path.join(scratch, 'input-manifest.json'));
 check(policy.stageOrder.includes(stage) && process.env.VSCODE_LEASE_DIAGNOSTIC_STAGE === stage && /^[0-9a-f]{64}$/.test(process.env.VSCODE_LEASE_DIAGNOSTIC_DRIVER_NONCE ?? '') && (process.env.VSCODE_LEASE_DIAGNOSTIC_STAGE_TOKEN ?? '').includes(':'), 'Requires owned driver stage invocation');
 const names = json(path.join(scratch, 'pin-names.json'));
 check(JSON.stringify(Object.keys(release.pinnedFilesSha256).sort()) === JSON.stringify([...names].sort()), 'Expanded/incomplete pins');
 for (const [name, digest] of Object.entries(release.pinnedFilesSha256)) check(sha(fs.readFileSync(path.join(scratch, name))) === digest, 'Unpinned preparation file ' + name);
 check(manifest.planId === plan && policy.planId === plan && manifest.repo === repo && policy.repo === repo && manifest.expectedHead === release.expectedHead && manifest.expectedHead === '3497bdc01caa188e5ff37e8877168d50b0a398d0', 'Wrong fixed HEAD');
 check(manifest.sourceRef === manifest.expectedHead && release.sourceRef === manifest.sourceRef && manifest.sourceTree === 'fa6f7fe9f339963dd9f4190f44aa17e45f6ad731' && release.sourceTree === manifest.sourceTree, 'Wrong immutable source');
 check(git('rev-parse', 'HEAD').toString().trim() === manifest.expectedHead && git('rev-parse', 'HEAD:src').toString().trim() === manifest.sourceTree && git('status', '--porcelain=v1').length === 0, 'HEAD/src/clean changed');
 check(manifest.sourceFiles.length === 1 && policy.sourceInputCount === 1 && policy.totalAllowedOutPaths === 1 && policy.temporaryProductionJs === 0 && policy.temporaryTestJs === 1 && policy.standaloneMapCount === 0, 'Expanded input/write authority');
 check(JSON.stringify(manifest.sourceFiles.map(r => r.sourcePath)) === JSON.stringify(policy.sourcePaths) && JSON.stringify(manifest.sourceFiles.map(r => r.outputPath)) === JSON.stringify(policy.writableOutputPaths), 'Mismatched single whitelist');
 for (const row of manifest.sourceFiles) {
  const bytes = git('show', manifest.sourceRef + ':' + row.sourcePath);
  check(row.sourcePath === 'src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts' && row.outputPath === 'out/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.js' && row.sourceRef === manifest.sourceRef && row.sourceBlob === 'c7710eb939872d378394c7084ccf95bb50f4b4c2' && row.sourceBytes === 81494 && row.sourceSha256 === '404034f9dd15c2cf6143c44b624b0dbb398da25b27f16d962a2f01bef982388d' && row.inputCopyPath === path.join(scratch, 'inputs', row.sourcePath) && bytes.length === row.sourceBytes && sha(bytes) === row.sourceSha256 && bytes.equals(fs.readFileSync(row.inputCopyPath)) && bytes.equals(fs.readFileSync(path.join(repo, row.sourcePath))) && git('rev-parse', manifest.sourceRef + ':' + row.sourcePath).toString().trim() === row.sourceBlob, 'Frozen source/copy changed');
 }
 for (const row of manifest.boundToolAndConfigFiles) { const b = fs.readFileSync(row.path); check(b.length === row.bytes && sha(b) === row.sha256, 'Tool/config changed ' + row.path); }
 check(sha(fs.readFileSync(manifest.baselineFile)) === manifest.baselineFileSha256 && manifest.baselineFileSha256 === '46fc959b355c9e922a7cb7e9a74919956c5647a595ad88347a083449d8cfb51e' && manifest.guardSchemaVersion === 4 && manifest.boundSourceNativePairs.length === 256, 'Immutable current output baseline changed');
 return { release, manifest, policy };
}

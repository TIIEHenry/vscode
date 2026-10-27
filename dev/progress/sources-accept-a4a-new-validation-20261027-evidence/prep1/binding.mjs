// Preparation only: importing this file performs no compiler/test work.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
export const scratch = path.dirname(import.meta.filename);
export const repo = '/home/clarence/Projects/Agents/vscode-WorkTrees/merge';
export const plan = 'vscode-sources-accept-a4a-new-validation-20261027-prep1';
export const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export const check = (ok, message) => { if (!ok) throw Error(message); };
export const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export const git = (...args) => execFileSync('rtk', ['proxy', 'git', ...args], { cwd: repo, maxBuffer: 32 * 1024 * 1024 });
export function authorize(stage) {
 const release = json(path.join(scratch, 'execution-release.json'));
 check(release.executionAuthorized === true && release.state === 'AUTHORIZED_NEW_VALIDATION_ONCE' && release.authorizedBy === '/root' && typeof release.authorizationMessage === 'string' && release.authorizationMessage.trim(), 'FAIL CLOSED: separate explicit root execution release required');
 check(scratch === '/tmp/vscode-sources-accept-a4a-new-validation-20261027-prep1' && process.cwd() === repo && release.planId === plan && release.scope === 'fixed-five-file-check-lint-dry-emit-two-full-official-modules', 'Wrong scratch/plan/scope');
 check(process.env.VSCODE_SOURCES_NEW_VALIDATION_STAGE === stage && /^[0-9a-f]{64}$/.test(process.env.VSCODE_SOURCES_OLD_RED_RUN2_DRIVER_NONCE ?? '') && (process.env.VSCODE_SOURCES_OLD_RED_RUN2_STAGE_TOKEN ?? '').includes(':'), 'Requires owned driver stage invocation');
 for (const [name, digest] of Object.entries(release.pinnedFilesSha256)) check(sha(fs.readFileSync(path.join(scratch, name))) === digest, 'Unpinned preparation file ' + name);
 const manifest = json(path.join(scratch, 'input-manifest.json')), policy = json(path.join(scratch, 'policy.json'));
 check(manifest.planId === plan && policy.planId === plan && manifest.repo === repo && policy.repo === repo && manifest.expectedHead === release.expectedHead && manifest.expectedHead === 'eefce63e1541625baa39a4abd1608fc3cdbb8c5b', 'Wrong fixed expectedHead');
 check(manifest.sourceRef === 'a4a70322795c509e8e9b8274cf295a1b65db663a' && release.sourceRef === manifest.sourceRef && manifest.sourceTree === 'd78a48e5feee57fcaf5811c8425859d0a2400af0', 'Wrong immutable source');
 check(git('rev-parse', 'HEAD').toString().trim() === manifest.expectedHead && git('rev-parse', 'HEAD:src').toString().trim() === manifest.sourceTree && git('status', '--porcelain=v1').length === 0, 'HEAD/src/clean changed');
 check(manifest.sourceFiles.length === 5 && policy.sourceInputCount === 5 && policy.temporaryJsWriteCount === 5 && policy.productionWriteCount === 3 && policy.testJsWriteCount === 2 && policy.standaloneMapCount === 0, 'Expanded whitelist/counts');
 check(JSON.stringify(manifest.sourceFiles.map(r => r.sourcePath)) === JSON.stringify(policy.sourcePaths) && JSON.stringify(manifest.sourceFiles.map(r => r.outputPath)) === JSON.stringify(policy.outputPaths), 'Mismatched source/output whitelist');
 for (const row of manifest.sourceFiles) {
  const bytes = git('show', manifest.sourceRef + ':' + row.sourcePath);
  check(row.sourceRef === manifest.sourceRef && row.inputCopyPath === path.join(scratch, 'inputs', row.sourcePath) && bytes.length === row.sourceBytes && sha(bytes) === row.sourceSha256 && bytes.equals(fs.readFileSync(row.inputCopyPath)) && bytes.equals(fs.readFileSync(path.join(repo, row.sourcePath))) && git('rev-parse', manifest.sourceRef + ':' + row.sourcePath).toString().trim() === row.sourceBlob, 'Source/blob/copy changed ' + row.sourcePath);
 }
 for (const row of manifest.boundToolAndConfigFiles) { const b = fs.readFileSync(row.path); check(b.length === row.bytes && sha(b) === row.sha256, 'Tool/config changed ' + row.path); }
 check(sha(fs.readFileSync(manifest.baselineFile)) === manifest.baselineFileSha256 && manifest.baselineFileSha256 === '90f8cd36c22c0503061c8c6df9c1fe6654053043fad1b7857e80a62875955aa1', 'Original run3 baseline changed');
 return { release, manifest, policy };
}

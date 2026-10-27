// Prepared only; API cache=false and fix=false, no repository wrapper cache.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { authorize, repo, scratch, check } from './binding.mjs';
const { manifest, policy } = authorize('lint');
const require = createRequire(path.join(repo, 'package.json'));
const { ESLint } = require('eslint');
const options = { cwd: repo, cache: false, fix: false, concurrency: 'off', errorOnUnmatchedPattern: true, overrideConfigFile: path.join(repo, 'eslint.config.js') };
const lint = new ESLint(options);
const results = await lint.lintFiles(policy.sourcePaths);
check(results.length === 5 && JSON.stringify(results.map(r => path.relative(repo, r.filePath)).sort()) === JSON.stringify([...policy.sourcePaths].sort()), 'ESLint did not check exactly five targets');
check(results.every(r => r.output === undefined), 'Unexpected fixed output from no-fix ESLint');
const report = { atUtc: new Date().toISOString(), sourceRef: manifest.sourceRef, expectedHead: manifest.expectedHead, options, sourcePaths: policy.sourcePaths, results, errorCount: results.reduce((n, r) => n + r.errorCount, 0), fatalErrorCount: results.reduce((n, r) => n + r.fatalErrorCount, 0), warningCount: results.reduce((n, r) => n + r.warningCount, 0), outputFixesApplied: false, cacheWritten: false, fullCompileOfFinalSourceTree: false };
report.passed = report.errorCount === 0 && report.fatalErrorCount === 0;
fs.writeFileSync(path.join(scratch, 'eslint-report.json'), JSON.stringify(report, null, 2) + '
', { flag: 'wx' });
console.log(JSON.stringify({ stage: 'lint', passed: report.passed, errorCount: report.errorCount, fatalErrorCount: report.fatalErrorCount, warningCount: report.warningCount, files: results.length, cache: false, fix: false }));
process.exitCode = report.passed ? 0 : 1;

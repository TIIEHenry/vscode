import fs from 'fs';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
const repo = '/home/clarence/Projects/Agents/vscode-WorkTrees/merge';
process.chdir(repo);
const require = createRequire(repo + '/package.json');
const { ESLint } = require('eslint');
const ref = '34a4a48fa60796c5c46831e5686cbb7410e5f11c';
const paths = execFileSync('git', ['diff', '--name-only', '37fb714dba6cfaa798fe50b1b462842004e96b47', ref, '--', 'src'], { encoding: 'utf8' }).trim().split('\n').filter(p => p.endsWith('.ts'));
const eslint = new ESLint({ cwd: repo });
const results = [];
for (const path of paths) {
 results.push(...await eslint.lintText(execFileSync('git', ['show', ref + ':' + path], { encoding: 'utf8' }), { filePath: repo + '/' + path }));
}
const formatter = await eslint.loadFormatter('stylish');
console.log(formatter.format(results));
const counts = results.reduce((a, r) => ({ errors: a.errors + r.errorCount, warnings: a.warnings + r.warningCount }), { errors: 0, warnings: 0 });
fs.writeFileSync('/tmp/vscode-m01-fifth-lint.json', JSON.stringify({ phase: 'immutable-m01-six-source-lint', sourceHead: ref, paths, ...counts, results }, null, 2) + '\n');
console.log(JSON.stringify({ files: paths.length, ...counts }));
process.exitCode = counts.errors ? 1 : 0;

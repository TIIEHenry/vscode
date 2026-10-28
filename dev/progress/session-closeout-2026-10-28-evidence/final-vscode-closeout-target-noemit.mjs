import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript');
const directory = fs.readFileSync('/tmp/vscode-closeout-final-integration-current.txt', 'utf8').trim();
const selection = JSON.parse(fs.readFileSync(path.join(directory, 'validation-selection.json'), 'utf8'));
const configPath = path.resolve('src/tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
const options = { ...parsed.options, noEmit: true, incremental: false, composite: false, skipLibCheck: true };
const program = ts.createProgram(parsed.fileNames, options);
const diagnostics = [...parsed.errors, ...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()];
const targets = [];
for (const target of selection.finalFreshTypescript) {
 const file = program.getSourceFile(path.resolve(target));
 if (!file) throw new Error('Target not in program: ' + target);
 const fileDiagnostics = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)];
 diagnostics.push(...fileDiagnostics);
 targets.push({ path: target, diagnostics: fileDiagnostics.length });
 console.log(JSON.stringify(targets.at(-1)));
}
const unique = ts.sortAndDeduplicateDiagnostics(diagnostics);
console.log(ts.formatDiagnosticsWithColorAndContext(unique, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: x => x, getNewLine: () => '\n' }));
const result = { compilerVersion: ts.version, config: 'src/tsconfig.json', noEmit: true, rootFileCount: parsed.fileNames.length, targetCount: targets.length, targets, diagnosticCount: unique.length, diagnostics: unique.map(d => ({ code: d.code, category: d.category, file: d.file && path.relative(process.cwd(), d.file.fileName), start: d.start, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') })) };
fs.writeFileSync(path.join(directory, 'target-noemit.results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ targetCount: targets.length, diagnosticCount: unique.length, noEmit: true }));
process.exitCode = unique.some(d => d.category === ts.DiagnosticCategory.Error) ? 1 : 0;

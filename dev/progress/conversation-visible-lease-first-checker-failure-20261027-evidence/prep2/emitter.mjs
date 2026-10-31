// Prepared only. Gate precedes compiler imports and all output access.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { authorize, repo, scratch, sha, check, json } from './binding.mjs';
const mode = process.argv[2];
const { manifest, policy } = authorize(mode);
check(['dry', 'emit-reveal', 'emit-pane'].includes(mode) && process.argv.length === 3, 'Expected exact dry/emit-reveal/emit-pane mode');
check(process.env.VSCODE_SOURCES_OLD_RED_RUN2_EMITTER_MODE === mode, 'Wrong owned emitter mode');
const sourceRows = mode === 'dry' ? manifest.sourceFiles : [manifest.sourceFiles[mode === 'emit-reveal' ? 1 : 0]];
const sourcePaths = sourceRows.map(r => r.sourcePath), outputPaths = sourceRows.map(r => r.outputPath);
if (mode === 'emit-pane') {
 const q = json(path.join(scratch, 'old-L1.qualification.json'));
 check(q.qualifiedExpectedOldRed === true && q.oldFailedBodyLeakCheckClaim === false, 'Qualified exact old L1 business red required before any new Pane emission');
}
const require = createRequire(path.join(repo, 'package.json'));
const ts = require('typescript'), gulp = require('gulp'), es = require('event-stream');
const compilationPath = path.join(repo, 'build/lib/compilation.ts');
const { createCompile } = await import(pathToFileURL(compilationPath).href);
const util = await import(pathToFileURL(path.join(repo, 'build/lib/util.ts')).href);
const { ESBuildTranspiler } = await import(pathToFileURL(path.join(repo, 'build/lib/tsb/transpiler.ts')).href);
const rootDir = path.join(repo, 'src'), projectPath = path.join(rootDir, 'tsconfig.json');
const read = ts.readConfigFile(projectPath, ts.sys.readFile);
if (read.error) throw Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
const override = { verbose: false, sourceMap: !process.env.VSCODE_NO_SOURCEMAP, rootDir, baseUrl: rootDir, sourceRoot: util.toFileUri(rootDir), newLine: /\r\n/.test(fs.readFileSync(compilationPath, 'utf8')) ? 0 : 1, inlineSources: false, inlineSourceMap: true };
const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, rootDir, override);
check(parsed.errors.length === 0, 'Invalid actual src configuration');
const transpiler = new ESBuildTranspiler(() => {}, error => { throw Error(String(error)); }, projectPath, parsed);
const toolPackages = {};
for (const name of ['typescript', 'esbuild', 'gulp', 'vinyl']) {
 const file = require.resolve(name + '/package.json'), bytes = fs.readFileSync(file);
 toolPackages[name] = { packagePath: file, packageSha256: sha(bytes), packageVersion: JSON.parse(bytes).version, modulePath: require.resolve(name), runtimeVersion: require(name).version ?? null };
}
const options = { repositoryAPI: 'build/lib/compilation.ts:createCompile', call: { src: 'src', build: false, emitError: true, transpileOnly: { esbuild: true }, preserveEnglish: false }, effectiveCompilerOptions: parsed.options, actualESBuildTranspilerOptions: transpiler._transformOpts, projectPath, overrides: override, sourceRule: 'Canonical repository Vinyl path/base; exact root-bound immutable Git blobs replace input contents before createCompile; no source writes', sourceInputs: sourceRows, expectedOutputPaths: outputPaths, actualInputCount: sourceRows.length, productionWriteCountAllowed: mode === 'emit-reveal' ? 0 : 1, inlineSourceMap: true, standaloneMapAllowed: false, nodeVersion: process.version, nodeExecutable: process.execPath, toolPackages, repositoryBuildInputs: ['build/lib/compilation.ts', 'build/lib/util.ts', 'build/lib/tsb/index.ts', 'build/lib/tsb/transpiler.ts', 'build/lib/tsconfigUtils.ts', 'src/tsconfig.json', 'src/tsconfig.base.json'].map(p => ({ path: p, sha256: sha(fs.readFileSync(path.join(repo, p))) })) };
const optionsPath = path.join(scratch, mode + '-emitter-options.json');
check(!fs.existsSync(optionsPath), 'Refuse options overwrite');
fs.writeFileSync(optionsPath, JSON.stringify(options, null, 2) + '\n', { flag: 'wx' });
const expected = new Map(sourceRows.map(row => [path.resolve(repo, row.sourcePath), row]));
const generated = [], seen = new Set(), destination = path.join(scratch, mode + '-generated');
check(!fs.existsSync(destination), 'Refuse generated artifact overwrite');
const inputs = sourceRows.map(row => row.sourcePath);
const replace = es.mapSync(file => {
 const row = expected.get(file.path);
 check(row !== undefined, 'Unexpected source input ' + file.path);
 file.contents = fs.readFileSync(row.inputCopyPath);
 check(sha(file.contents) === row.sourceSha256, 'Input content changed');
 return file;
});
const enumerate = es.mapSync(file => {
 const output = path.relative(repo, path.resolve(repo, 'out', file.relative)).split(path.sep).join('/');
 check(outputPaths.includes(output) && !seen.has(output) && output.endsWith('.js'), 'Extra/duplicate/non-JS output ' + output);
 seen.add(output);
 const source = sourceRows.find(row => row.outputPath === output);
 generated.push({ outputPath: output, vinylPath: file.path, vinylBase: file.base, relativePath: file.relative, bytes: file.contents.length, sha256: sha(file.contents), sourceRef: source.sourceRef, sourceBlob: source.sourceBlob, sourceSha256: source.sourceSha256, role: source.role });
 return file;
});
const compile = createCompile('src', { build: false, emitError: true, transpileOnly: { esbuild: true }, preserveEnglish: false });
await util.streamToPromise(gulp.src(inputs, { base: 'src' }).pipe(replace).pipe(compile()).pipe(enumerate).pipe(gulp.dest(destination)));
generated.sort((a, b) => a.outputPath.localeCompare(b.outputPath));
check(JSON.stringify([...seen].sort()) === JSON.stringify(outputPaths), 'Pipeline did not emit exactly the selected authorized JS outputs');
const actualFiles = [];
function walk(dir) {
 for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) walk(file);
  else { check(entry.isFile() && !entry.isSymbolicLink(), 'Non-regular generated artifact'); actualFiles.push(path.relative(destination, file).split(path.sep).join('/')); }
 }
}
walk(destination);
actualFiles.sort();
check(JSON.stringify(actualFiles) === JSON.stringify(outputPaths.map(p => p.slice(4))), 'Unexpected generated artifact; no out writes allowed');
const report = { mode, atUtc: new Date().toISOString(), actualInputCount: sourceRows.length, repositoryCreateCompilePipeline: true, actualESBuildTranspiler: true, repositoryStreamToPromise: true, standaloneMapCount: actualFiles.filter(p => p.endsWith('.map')).length, generatedArtifactPaths: actualFiles.map(p => path.join(destination, p)), outputs: generated, outWriteFileCalls: [], noRepositorySourceWritten: true, productionOutWriteFileCalls: 0, fullCompileOfFinalSourceTree: false };
const reportPath = path.join(scratch, mode + '-emitter-report.json');
check(!fs.existsSync(reportPath), 'Refuse report overwrite');
if (mode !== 'dry') {
 const dry = json(path.join(scratch, 'dry-emitter-report.json'));
 check(dry.actualInputCount === 2 && dry.standaloneMapCount === 0 && dry.outWriteFileCalls.length === 0 && JSON.stringify(generated) === JSON.stringify(dry.outputs.filter(r => outputPaths.includes(r.outputPath))), 'Dry/emit exact output/byte enumeration differs; no out write performed');
 const seals = json(path.join(scratch, 'sealed-originals.json'));
 check(seals.length === 2 && JSON.stringify(seals.map(row => row.path)) === JSON.stringify(policy.outputPaths), 'Not exact two original seals');
 // Validate ALL originals and generated bytes before the FIRST out write.
 const preparedWrites = generated.map(row => {
  const target = path.resolve(repo, row.outputPath), seal = seals.find(item => item.path === row.outputPath);
  const metadata = fs.lstatSync(target, { bigint: true });
  check(seal && metadata.isFile() && !metadata.isSymbolicLink() && sha(fs.readFileSync(target)) === seal.sha256 && Number(metadata.mode & 0o7777n) === seal.mode && metadata.mtimeNs.toString() === seal.mtimeNsString && metadata.ctimeNs.toString() === seal.ctimeNsString, 'Out original changed before write');
  const bytes = fs.readFileSync(path.join(destination, row.outputPath.slice(4)));
  check(bytes.length === row.bytes && sha(bytes) === row.sha256, 'Generated bytes changed');
  return { row, target, bytes };
 });
 const journal = fs.openSync(path.join(scratch, mode + '-out-write-journal.jsonl'), 'wx');
 const event = value => { fs.writeSync(journal, JSON.stringify(value) + '\n'); fs.fsyncSync(journal); };
 try {
  for (const { row, target, bytes } of preparedWrites) {
   event({ phase: 'intent', path: row.outputPath, bytes: bytes.length, sha256: row.sha256, atUtc: new Date().toISOString() });
   fs.writeFileSync(target, bytes);
   const call = { path: row.outputPath, absolutePath: target, bytes: bytes.length, sha256: sha(bytes), completedAtUtc: new Date().toISOString() };
   report.outWriteFileCalls.push(call);
   report.productionOutWriteFileCalls = report.outWriteFileCalls.filter(item => item.path === policy.outputPaths[0]).length;
   event({ phase: 'completed', ...call });
   fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
 } finally {
  fs.closeSync(journal);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
 }
} else fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ mode, actualInputs: sourceRows.length, exactEnumeratedOutputs: generated.map(row => row.outputPath), standaloneMapCount: report.standaloneMapCount, outWriteFileCallCount: report.outWriteFileCalls.length, productionOutWriteFileCalls: report.productionOutWriteFileCalls, repositoryCreateCompilePipeline: true }));

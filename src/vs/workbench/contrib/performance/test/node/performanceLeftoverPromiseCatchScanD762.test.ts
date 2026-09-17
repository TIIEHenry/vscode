/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const PROFILER_REL = 'src/vs/workbench/contrib/performance/electron-browser/startupProfiler.ts';
const RENDERER_REL = 'src/vs/workbench/contrib/performance/electron-browser/rendererAutoProfiler.ts';
const NATIVE_TIMINGS_REL = 'src/vs/workbench/contrib/performance/electron-browser/startupTimings.ts';
const BROWSER_TIMINGS_REL = 'src/vs/workbench/contrib/performance/browser/startupTimings.ts';
const PERFVIEW_REL = 'src/vs/workbench/contrib/performance/browser/perfviewEditor.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/performance/browser/performance.contribution.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const DIALOGS_REL = 'src/vs/platform/dialogs/common/dialogs.ts';
const NATIVE_REL = 'src/vs/platform/native/common/native.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const TIMER_REL = 'src/vs/workbench/services/timer/browser/timerService.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const TERMINAL_REL = 'src/vs/workbench/contrib/terminal/browser/terminal.ts';
const EDITOR_REL = 'src/vs/workbench/services/editor/common/editorService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async ') || signature.includes('CancelablePromise'));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const existsThen = `this._fileService.exists(profileFilenamePrefix).then(exists => {
						if (exists) {
							resolve();
						} else {
							setTimeout(check, 500);
						}
					})`;

const markerFileThen = `				} else {
					// simply restart
					this._nativeHostService.relaunch({ removeArgs }).catch(onUnexpectedError).catch(onUnexpectedError);
				}
			});
		})`;

const createIssueThen = `					]).then(() => {
						// keep window stable until restart is selected
						return this._dialogService.confirm({
							type: 'info',
							message: localize('prof.thanks', "Thanks for helping us."),
							detail: localize('prof.detail.restart', "A final restart is required to continue to use '{0}'. Again, thank you for your contribution.", this._productService.nameLong),
							primaryButton: localize({ key: 'prof.restart.button', comment: ['&& denotes a mnemonic'] }, "&&Restart")
						}).then(res => {
							// now we are ready to restart
							if (res.confirmed) {
								this._nativeHostService.relaunch({ removeArgs }).catch(onUnexpectedError).catch(onUnexpectedError);
							}
						});
					})`;

const perfviewThen = `				this._addResourceTimingStats(md);

				this._model.setValue(md.value);
			}
		})`;

const d762Calls: Array<[string, string, number]> = [
	[PROFILER_REL, existsThen, 1],
	[PROFILER_REL, markerFileThen, 1],
	[PROFILER_REL, createIssueThen, 1],
	[PROFILER_REL, 'this._nativeHostService.relaunch({ removeArgs })', 2],
	[PERFVIEW_REL, perfviewThen, 1],
	[BROWSER_TIMINGS_REL, 'this.logPerfMarks()', 1],
	[RENDERER_REL, 'this._store(profile, sessionId)', 1],
	[RENDERER_REL, 'timeout(15000)', 1],
	[NATIVE_TIMINGS_REL, 'this._nativeHostService.exit(exitCode)', 1],
];

suite('Performance leftover remaining Promise fire-and-forget catch scan (D762)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers ten leftover Promise double-chain sites after D661', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d762Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 10);
		assert.ok(sites >= 4);
	});

	test('leftover exists then / markerFile then / create-issue then / relaunch are Promise double-chain', () => {
		const profiler = fs.readFileSync(resolveSource(PROFILER_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		assertPromiseSignature(files, 'exists(resource: URI): Promise<boolean>;');
		assertPromiseSignature(dialogs, 'confirm(confirmation: IConfirmation): Promise<IConfirmationResult>;');
		assertPromiseSignature(native, 'relaunch(options?: { addArgs?: string[]; removeArgs?: string[] }): Promise<void>;');
		assert.ok(profiler.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(profiler, existsThen);
		assertWrapped(profiler, markerFileThen);
		assertWrapped(profiler, createIssueThen);
		assert.strictEqual((profiler.match(/this\._nativeHostService\.relaunch\(\{ removeArgs \}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(!profiler.includes('this._fileService.exists(profileFilenamePrefix).then(exists => {\n\t\t\t\t\t\tif (exists) {\n\t\t\t\t\t\t\tresolve();\n\t\t\t\t\t\t} else {\n\t\t\t\t\t\t\tsetTimeout(check, 500);\n\t\t\t\t\t\t}\n\t\t\t\t\t});'));
		assert.ok(!profiler.includes('this._nativeHostService.relaunch({ removeArgs });'));
	});

	test('leftover perfview Promise.all then / logPerfMarks / timeout / _store / exit are Promise double-chain', () => {
		const perfview = fs.readFileSync(resolveSource(PERFVIEW_REL), 'utf8');
		const browserTimings = fs.readFileSync(resolveSource(BROWSER_TIMINGS_REL), 'utf8');
		const renderer = fs.readFileSync(resolveSource(RENDERER_REL), 'utf8');
		const nativeTimings = fs.readFileSync(resolveSource(NATIVE_TIMINGS_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const timer = fs.readFileSync(resolveSource(TIMER_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		assertPromiseSignature(timer, 'whenReady(): Promise<boolean>;');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(terminal, 'readonly whenConnected: Promise<void>;');
		assertPromiseSignature(asyncSource, 'export function timeout(millis: number): CancelablePromise<void>;');
		assertPromiseSignature(asyncSource, 'export interface CancelablePromise<T> extends Promise<T> {');
		assertPromiseSignature(renderer, 'private async _store(profile: IV8Profile, sessionId: string): Promise<void> {');
		assertPromiseSignature(browserTimings, 'private async logPerfMarks(): Promise<void> {');
		assertPromiseSignature(native, 'exit(code: number): Promise<void>;');
		assert.ok(perfview.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(browserTimings.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(renderer.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(nativeTimings.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(perfview, perfviewThen);
		assertWrapped(browserTimings, 'this.logPerfMarks()');
		assertWrapped(renderer, 'this._store(profile, sessionId)');
		assertWrapped(renderer, 'timeout(15000)');
		assertWrapped(nativeTimings, 'this._nativeHostService.exit(exitCode)');
		assert.ok(!browserTimings.includes('this.logPerfMarks();'));
		assert.ok(!renderer.includes('this._store(profile, sessionId);'));
		assert.ok(!renderer.includes('timeout(15000);'));
		assert.ok(!nativeTimings.includes('this._nativeHostService.exit(exitCode);'));
	});

	test('opener / Action2.run / assigned then / two-arg / returned Promise / already-double stay skipped', () => {
		const profiler = fs.readFileSync(resolveSource(PROFILER_REL), 'utf8');
		const renderer = fs.readFileSync(resolveSource(RENDERER_REL), 'utf8');
		const nativeTimings = fs.readFileSync(resolveSource(NATIVE_TIMINGS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assertPromiseSignature(editor, 'openEditor(editor: EditorInput, options?: IEditorOptions, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assert.ok(profiler.includes('this._openerService.open(URI.parse(`${baseUrl}${queryStringPrefix}body=${encodeURIComponent(body)}`));'));
		assert.ok(!profiler.includes('this._openerService.open(URI.parse(`${baseUrl}${queryStringPrefix}body=${encodeURIComponent(body)}`)).catch'));
		assert.ok(contrib.includes('return editorService.openEditor(contrib.getEditorInput(), { pinned: true });'));
		assert.ok(!contrib.includes('return editorService.openEditor(contrib.getEditorInput(), { pinned: true }).catch'));
		assert.ok(profiler.includes('const markerFile = this._fileService.readFile(profileFilenamePrefix).then(value => removeArgs.push(...value.toString().split(\'|\')))'));
		assert.ok(profiler.includes('\t\t\t.then(() => this._fileService.del(profileFilenamePrefix, { recursive: true })); // (3) finally delete the file again'));
		assert.ok(!profiler.includes('\t\t\t.then(() => this._fileService.del(profileFilenamePrefix, { recursive: true })).catch(onUnexpectedError).catch(onUnexpectedError); // (3) finally delete the file again'));
		assert.ok(profiler.includes('return this._fileService.resolve(dir).then(stat => {'));
		assert.ok(!profiler.includes(`return this._fileService.resolve(dir).then(stat => {${doubleCatch}`));
		assert.ok(profiler.includes('return this._dialogService.confirm({\n\t\t\t\ttype: \'info\',\n\t\t\t\tmessage: localize(\'prof.message\''));
		assert.ok(!profiler.includes(`return this._dialogService.confirm({\n\t\t\t\ttype: 'info',\n\t\t\t\tmessage: localize('prof.message'${doubleCatch}`));
		assert.ok(nativeTimings.includes('timeout(5000).then(() => { throw new Error(\'Timed out flushing profiled startup state.\'); })'));
		assert.ok(!nativeTimings.includes(`timeout(5000).then(() => { throw new Error('Timed out flushing profiled startup state.'); })${doubleCatch}`));
		assert.ok(profiler.includes(`		]).then(() => {\n\t\t\tthis._stopProfiling();\n\t\t})${doubleCatch};`));
		assert.ok(renderer.includes(`		}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(nativeTimings.includes(`this._report()${doubleCatch};`));
		assert.ok(nativeTimings.includes(`this._appendStartupTimes(standardStartupError)${doubleCatch};`));
		for (const source of [profiler, renderer, nativeTimings, contrib]) {
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});

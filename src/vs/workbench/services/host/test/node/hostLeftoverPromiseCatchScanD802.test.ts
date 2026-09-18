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
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const NATIVE_REL = 'src/vs/platform/native/common/native.ts';
const INSTANTIATION_REL = 'src/vs/platform/instantiation/common/instantiation.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const EDITOR_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const WEB_API_REL = 'src/vs/workbench/browser/web.api.ts';
const EDITOR_UTIL_REL = 'src/vs/workbench/browser/editor.ts';
const BROWSER_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const NATIVE_HOST_REL = 'src/vs/workbench/services/host/electron-browser/nativeHostService.ts';
const HOST_IFACE_REL = 'src/vs/workbench/services/host/browser/host.ts';
const TOASTS_REL = 'src/vs/workbench/services/host/browser/toasts.ts';
const WORKING_COPY_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts';
const TEXTFILE_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const UNTITLED_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorService.ts';
const VIEWS_REL = 'src/vs/workbench/services/views/common/viewsService.ts';

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

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const browserClearToastsCall = 'this.clearToasts()';
const folderDoOpenCall = 'this.doOpen({ folderUri: openable.folderUri }, { reuse: this.shouldReuse(options, false /* no file */), payload })';
const workspaceDoOpenCall = 'this.doOpen({ workspaceUri: openable.workspaceUri }, { reuse: this.shouldReuse(options, false /* no file */), payload })';
const openEditorsCall = 'editorService.openEditors(coalesce(await pathsToEditors(openables, this.fileService, this.logService)), undefined, { validateTrust: true })';
const waitIifeCall = `await this.fileService.del(waitMarkerFileURI);
					})()`;
const withServicesCall = 'void Promise.resolve(this.instantiationService.invokeFunction(accessor => fn(accessor)))';
const nativeClearToastsCall = 'this.clearToasts()';
const nativeClearToastCall = 'this.nativeHostService.clearToast(id)';

const d802Calls: Array<[string, string, number]> = [
	[BROWSER_REL, browserClearToastsCall, 1],
	[BROWSER_REL, folderDoOpenCall, 1],
	[BROWSER_REL, workspaceDoOpenCall, 1],
	[BROWSER_REL, openEditorsCall, 1],
	[BROWSER_REL, waitIifeCall, 1],
	[BROWSER_REL, withServicesCall, 1],
	[NATIVE_HOST_REL, nativeClearToastsCall, 1],
	[NATIVE_HOST_REL, nativeClearToastCall, 1],
];

suite('host leftover Promise fire-and-forget catch scan (D802)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites in services/host and did not overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d802Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		const browser = seen.get(BROWSER_REL) ?? fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const native = seen.get(NATIVE_HOST_REL) ?? fs.readFileSync(resolveSource(NATIVE_HOST_REL), 'utf8');
		assert.strictEqual(countDoubleChains(browser), 6);
		assert.strictEqual(countDoubleChains(native), 2);
		assert.ok(!fs.readFileSync(resolveSource(WORKING_COPY_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(TEXTFILE_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(UNTITLED_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(VIEWS_REL), 'utf8').includes(doubleCatch));
	});

	test('browser leftover clearToasts / doOpen folder+workspace / openEditors / wait IIFE / withServices PromiseLike are Promise double-chain', () => {
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const editorUtil = fs.readFileSync(resolveSource(EDITOR_UTIL_REL), 'utf8');
		const instantiation = fs.readFileSync(resolveSource(INSTANTIATION_REL), 'utf8');
		assertPromiseSignature(browser, 'private async clearToasts(): Promise<void> {');
		assertPromiseSignature(browser, 'private async doOpen(workspace: IWorkspace, options?: { reuse?: boolean; payload?: object }): Promise<void> {');
		assertPromiseSignature(editor, 'openEditors(editors: IUntypedEditorInput[], group?: PreferredGroup, options?: IOpenEditorsOptions): Promise<readonly IEditorPane[]>;');
		assertPromiseSignature(files, 'del(resource: URI, options?: Partial<IFileDeleteOptions>): Promise<void>;');
		assertPromiseSignature(editorUtil, 'export function whenEditorClosed(accessor: ServicesAccessor, resources: URI[]): Promise<void> {');
		assert.ok(instantiation.includes('invokeFunction<R, TS extends any[] = []>(fn: (accessor: ServicesAccessor, ...args: TS) => R, ...args: TS): R;'));
		assert.ok(browser.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(browser, browserClearToastsCall);
		assertWrapped(browser, folderDoOpenCall);
		assertWrapped(browser, workspaceDoOpenCall);
		assertWrapped(browser, openEditorsCall);
		assertWrapped(browser, waitIifeCall);
		assertWrapped(browser, withServicesCall);
		assert.ok(!browser.includes('\t\t\t\tthis.clearToasts();\n'));
		assert.ok(!browser.includes(`${folderDoOpenCall};`));
		assert.ok(!browser.includes(`${workspaceDoOpenCall};`));
		assert.ok(!browser.includes(`${openEditorsCall};`));
		assert.ok(!browser.includes('await this.fileService.del(waitMarkerFileURI);\n\t\t\t\t\t})();\n'));
		assert.ok(!browser.includes('this.instantiationService.invokeFunction(accessor => fn(accessor));'));
	});

	test('native leftover clearToasts / clearToast are Promise double-chain', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_HOST_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		assertPromiseSignature(native, 'private async clearToasts(): Promise<void> {');
		assertPromiseSignature(iface, 'clearToast(id: string): Promise<void>;');
		assertPromiseSignature(iface, 'clearToasts(): Promise<void>;');
		assert.ok(native.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(native, nativeClearToastsCall);
		assertWrapped(native, nativeClearToastCall);
		assert.ok(!native.includes('\t\t\t\tthis.clearToasts();\n'));
		assert.ok(!native.includes('() => this.nativeHostService.clearToast(id));'));
	});

	test('host leftover remaining doOpen(undefined) / openEditor / video.play / restart reload stay unwrapped', () => {
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		assert.strictEqual(countIncludes(browser, 'this.doOpen(undefined, { payload: Array.from(environment.entries()) });'), 3);
		assert.ok(!browser.includes(`this.doOpen(undefined, { payload: Array.from(environment.entries()) })${doubleCatch}`));
		assert.ok(browser.includes('editorService.openEditor({\n\t\t\t\t\t\t\tinput1: { resource: editors[0].resource },'));
		assert.ok(browser.includes('editorService.openEditor({\n\t\t\t\t\t\t\toriginal: { resource: editors[0].resource },'));
		assert.ok(!browser.includes(`options: { pinned: true }\n\t\t\t\t\t\t})${doubleCatch}`));
		assert.ok(browser.includes('\t\t\tvideo.play();\n'));
		assert.ok(!browser.includes(`video.play()${doubleCatch}`));
		assert.ok(browser.includes('\t\tthis.reload();\n'));
		assert.ok(!browser.includes(`this.reload()${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_HOST_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_IFACE_REL), 'utf8');
		const toasts = fs.readFileSync(resolveSource(TOASTS_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const webApi = fs.readFileSync(resolveSource(WEB_API_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(webApi, 'open(workspace: IWorkspace, options?: { reuse?: boolean; payload?: object }): Promise<boolean>;');
		assertPromiseSignature(host, 'openWindow(options?: IOpenEmptyWindowOptions): Promise<void>;');
		assertPromiseSignature(browser, 'async restart(): Promise<void> {');
		assertPromiseSignature(native, 'restart(): Promise<void> {');
		assertPromiseSignature(toasts, 'export async function showBrowserToast(controller: IShowToastController, options: IToastOptions, token: CancellationToken): Promise<IToastResult> {');

		assert.ok(!browser.includes('IOpenerService'));
		assert.ok(!native.includes('IOpenerService'));
		assert.ok(!browser.includes('openerService.open'));
		assert.ok(!native.includes('openerService.open'));

		assert.ok(browser.includes('run: () => this.workspaceProvider.open(workspace, options)'));
		assert.ok(!browser.includes(`this.workspaceProvider.open(workspace, options)${doubleCatch}`));
		assert.ok(browser.includes('const opened = await this.workspaceProvider.open(workspace, options);'));
		assert.ok(!browser.includes(`await this.workspaceProvider.open(workspace, options)${doubleCatch}`));

		assert.ok(browser.includes('return this.doOpenWindow(arg1, arg2);'));
		assert.ok(!browser.includes(`return this.doOpenWindow(arg1, arg2)${doubleCatch}`));
		assert.ok(browser.includes('return this.doOpenEmptyWindow(arg1);'));
		assert.ok(browser.includes('return this.doOpen(undefined, {'));
		assert.ok(!browser.includes(`return this.doOpen(undefined, {${doubleCatch}`));
		assert.ok(native.includes('return this.nativeHostService.openWindow(toOpen, options);'));
		assert.ok(!native.includes(`return this.nativeHostService.openWindow(toOpen, options)${doubleCatch}`));
		assert.ok(native.includes('return this.nativeHostService.relaunch();'));
		assert.ok(!native.includes(`return this.nativeHostService.relaunch()${doubleCatch}`));
		assert.ok(browser.includes('return showBrowserToast({'));
		assert.ok(!toasts.includes(doubleCatch));

		assert.ok(!browser.includes('extends Action2'));
		assert.ok(!native.includes('extends Action2'));
		assert.ok(!browser.includes('.then('));
		assert.ok(!native.includes('.then('));
		assert.ok(!browser.includes(' = this.doOpen'));
		assert.ok(!browser.includes(', error => {'));
		assert.ok(!native.includes(', error => {'));

		for (const source of [browser, native, host, toasts]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});

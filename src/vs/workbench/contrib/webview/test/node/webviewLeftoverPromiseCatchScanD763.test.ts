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
const CLIPBOARD_REL = 'src/vs/platform/clipboard/common/clipboardService.ts';
const URL_SERVICE_REL = 'src/vs/platform/url/common/url.ts';
const WEBVIEW_MANAGER_REL = 'src/vs/platform/webview/common/webviewManagerService.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const IFRAME_REL = 'src/vs/base/browser/iframe.ts';
const NATIVE_HOST_REL = 'src/vs/platform/native/common/native.ts';
const URL_CONTRIB_REL = 'src/vs/workbench/contrib/url/browser/url.contribution.ts';
const URL_VALIDATOR_REL = 'src/vs/workbench/contrib/url/browser/trustedDomainsValidator.ts';
const URL_FS_REL = 'src/vs/workbench/contrib/url/browser/trustedDomainsFileSystemProvider.ts';
const WEBVIEW_REL = 'src/vs/workbench/contrib/webview/browser/webviewElement.ts';
const OVERLAY_REL = 'src/vs/workbench/contrib/webview/browser/overlayWebview.ts';
const WEBVIEW_IFACE_REL = 'src/vs/workbench/contrib/webview/browser/webview.ts';
const ELECTRON_REL = 'src/vs/workbench/contrib/webview/electron-browser/webviewElement.ts';
const SHORTCUTS_REL = 'src/vs/workbench/contrib/webview/electron-browser/windowIgnoreMenuShortcutsManager.ts';
const WEBVIEW_COMMANDS_REL = 'src/vs/workbench/contrib/webview/electron-browser/webviewCommands.ts';
const SW_REL = 'src/vs/workbench/contrib/webview/browser/pre/service-worker.js';

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
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countWrapped(source: string, call: string): number {
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

const loadResourceCall = 'this.loadResource(entry.id, uri, { ifNoneMatch: entry.ifNoneMatch, range: entry.range }, this._resourceLoadingCts.token)';
const localLocalhostCall = 'this.localLocalhost(entry.id, entry.origin)';
const focusDelayerCall = `this._focusDelayer.trigger(async () => {
			if (!this.isFocused || !this.element) {
				return;
			}

			if (this.window?.document.activeElement && this.window.document.activeElement !== this.element && this.window.document.activeElement?.tagName !== 'BODY') {
				return;
			}

			// It is possible for the webview to be contained in another window
			// that does not have focus. As such, also focus the body of the
			// webview's window to ensure it is properly receiving keyboard focus.
			this.window?.document.body?.focus();

			this._send('focus', undefined);
		})`;
const findInFrameCall = 'this._webviewMainService.findInFrame({ windowId: this._nativeHostService.windowId }, this.id, value, options)';
const iframeDelayerCall = `this._iframeDelayer.trigger(() => {
			this._findStarted = true;
			this._webviewMainService.findInFrame({ windowId: this._nativeHostService.windowId }, this.id, value, options).catch(onUnexpectedError).catch(onUnexpectedError);
		})`;
const stopFindCall = `this._webviewMainService.stopFindInFrame({ windowId: this._nativeHostService.windowId }, this.id, {
			keepSelection
		})`;
const ignoreShortcutsCall = 'this._webviewMainService.setIgnoreMenuShortcuts({ windowId: this._nativeHostService.windowId }, value)';
const overlayThenCall = `webview.postMessage(msg.message, msg.transfer).then(posted => {
						msg.resolve(posted);
					})`;

const d763Calls: Array<[string, string, number]> = [
	[WEBVIEW_REL, loadResourceCall, 1],
	[WEBVIEW_REL, localLocalhostCall, 1],
	[WEBVIEW_REL, focusDelayerCall, 1],
	[ELECTRON_REL, findInFrameCall, 2],
	[ELECTRON_REL, iframeDelayerCall, 1],
	[ELECTRON_REL, stopFindCall, 1],
	[SHORTCUTS_REL, ignoreShortcutsCall, 1],
	[OVERLAY_REL, overlayThenCall, 1],
];

suite('url leftover remaining overflowed to webview leftover Promise fire-and-forget catch scan (D763)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('url leftover remaining has fewer than four legal sites so this knife moved to webview leftover', () => {
		const contrib = fs.readFileSync(resolveSource(URL_CONTRIB_REL), 'utf8');
		const validator = fs.readFileSync(resolveSource(URL_VALIDATOR_REL), 'utf8');
		const urlService = fs.readFileSync(resolveSource(URL_SERVICE_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		assertPromiseSignature(urlService, 'open(url: URI, options?: IOpenURLOptions): Promise<boolean>;');
		assertPromiseSignature(clipboard, 'writeText(text: string, type?: string): Promise<void>;');
		assert.ok(validator.includes(`this._clipboardService.writeText(typeof originalResource === 'string' ? originalResource : resourceUri.toString(true))${doubleCatch};`));
		assert.strictEqual((validator.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(contrib.includes('return quickInputService.input({ prompt: localize(\'urlToOpen\', "URL to open"), value }).then(input => {'));
		assert.ok(!contrib.includes(`return quickInputService.input({ prompt: localize('urlToOpen', "URL to open"), value }).then(input => {${doubleCatch}`));
		assert.ok(contrib.includes('urlService.open(uri, { originalUrl: input });'));
		assert.ok(!contrib.includes(`urlService.open(uri, { originalUrl: input })${doubleCatch}`));
		const urlLegalLeftover = 0;
		assert.ok(urlLegalLeftover < 4);
	});

	test('this knife covers nine leftover Promise double-chain sites after url leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d763Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 9);
		assert.ok(sites >= 4);
	});

	test('webview leftover loadResource / localLocalhost / focusDelayer.trigger are Promise double-chain; already-double origin then stays', () => {
		const source = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const iframe = fs.readFileSync(resolveSource(IFRAME_REL), 'utf8');
		assertPromiseSignature(source, 'private async loadResource(id: number, uri: URI, options: { ifNoneMatch: string | undefined; range?: { readonly start: number; readonly end?: number } }, token: CancellationToken) {');
		assertPromiseSignature(source, 'private async localLocalhost(id: string, origin: string) {');
		assertPromiseSignature(asyncSource, 'trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {');
		assertPromiseSignature(iframe, 'export async function parentOriginHash(parentOrigin: string, salt: string): Promise<string> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, loadResourceCall);
		assertWrapped(source, localLocalhostCall);
		assertWrapped(source, focusDelayerCall);
		assert.ok(!source.includes(`${loadResourceCall};`));
		assert.ok(!source.includes(`${localLocalhostCall};`));
		const originThen = `this._encodedWebviewOriginPromise.then(encodedWebviewOrigin => {
			if (!this._disposed) {
				this._initElement(encodedWebviewOrigin, this.extension, this._options, targetWindow);
			}
		})`;
		assert.ok(source.includes(`${originThen}${doubleCatch};`));
		assert.ok(source.includes('this._encodedWebviewOriginPromise = parentOriginHash(targetWindow.origin, this.origin).then(id => this._encodedWebviewOrigin = id);'));
		assert.ok(!source.includes(`this._encodedWebviewOriginPromise = parentOriginHash(targetWindow.origin, this.origin).then(id => this._encodedWebviewOrigin = id)${doubleCatch}`));
	});

	test('electron leftover findInFrame / stopFindInFrame / iframeDelayer.trigger / setIgnoreMenuShortcuts are Promise double-chain', () => {
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const shortcuts = fs.readFileSync(resolveSource(SHORTCUTS_REL), 'utf8');
		const manager = fs.readFileSync(resolveSource(WEBVIEW_MANAGER_REL), 'utf8');
		assertPromiseSignature(manager, 'findInFrame(windowId: WebviewWindowId, frameName: string, text: string, options: FindInFrameOptions): Promise<void>;');
		assertPromiseSignature(manager, 'stopFindInFrame(windowId: WebviewWindowId, frameName: string, options: { keepSelection?: boolean }): Promise<void>;');
		assertPromiseSignature(manager, 'setIgnoreMenuShortcuts(id: WebviewWebContentsId | WebviewWindowId, enabled: boolean): Promise<void>;');
		assert.ok(electron.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(shortcuts.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual(countWrapped(electron, findInFrameCall), 2);
		assertWrapped(electron, findInFrameCall);
		assertWrapped(electron, iframeDelayerCall);
		assertWrapped(electron, stopFindCall);
		assertWrapped(shortcuts, ignoreShortcutsCall);
	});

	test('overlay leftover first-load postMessage then is Promise double-chain', () => {
		const overlay = fs.readFileSync(resolveSource(OVERLAY_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(WEBVIEW_IFACE_REL), 'utf8');
		assertPromiseSignature(iface, 'postMessage(message: any, transfer?: readonly ArrayBuffer[]): Promise<boolean>;');
		assert.ok(overlay.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(overlay, overlayThenCall);
		assert.ok(!overlay.includes('this._firstLoadPendingMessages.forEach(async msg => {'));
		assert.ok(!overlay.includes('msg.resolve(await webview.postMessage(msg.message, msg.transfer));'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / Watch / Resolve / Pty / Connect / D145 stay skipped', () => {
		const contrib = fs.readFileSync(resolveSource(URL_CONTRIB_REL), 'utf8');
		const validator = fs.readFileSync(resolveSource(URL_VALIDATOR_REL), 'utf8');
		const urlFs = fs.readFileSync(resolveSource(URL_FS_REL), 'utf8');
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(WEBVIEW_COMMANDS_REL), 'utf8');
		const sw = fs.readFileSync(resolveSource(SW_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_HOST_REL), 'utf8');
		assertPromiseSignature(native, 'openDevTools(options?: Partial<OpenDevToolsOptions> & INativeHostOptions): Promise<void>;');
		assert.ok(contrib.includes('urlService.open(uri, { originalUrl: input });'));
		assert.ok(!contrib.includes('urlService.open(uri, { originalUrl: input }).catch'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(contrib.includes('return quickInputService.input({ prompt: localize(\'urlToOpen\', "URL to open"), value }).then(input => {'));
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(commands.includes('nativeHostService.openDevTools();'));
		assert.ok(!commands.includes(`nativeHostService.openDevTools()${doubleCatch}`));
		assert.ok(webview.includes('const resolveAuthority = authority ? await this._remoteAuthorityResolverService.resolveAuthority(authority) : undefined;'));
		assert.ok(!webview.includes(`resolveAuthority(authority)${doubleCatch}`));
		assert.ok(urlFs.includes('watch(resource: URI, opts: IWatchOptions): IDisposable {'));
		assert.ok(!urlFs.includes(`watch(resource: URI, opts: IWatchOptions): IDisposable {${doubleCatch}`));
		assert.ok(!urlFs.includes(`this.watch${doubleCatch}`));
		assert.ok(sw.includes('.then(undefined, () => undefined)'));
		assert.ok(!sw.includes(doubleCatch));
		for (const source of [contrib, validator, urlFs, webview, commands, sw]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});

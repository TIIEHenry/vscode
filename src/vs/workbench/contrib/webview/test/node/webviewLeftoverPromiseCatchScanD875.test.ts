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
const WEBVIEW_REL = 'src/vs/workbench/contrib/webview/browser/webviewElement.ts';
const OVERLAY_REL = 'src/vs/workbench/contrib/webview/browser/overlayWebview.ts';
const WEBVIEW_IFACE_REL = 'src/vs/workbench/contrib/webview/browser/webview.ts';
const ELECTRON_REL = 'src/vs/workbench/contrib/webview/electron-browser/webviewElement.ts';
const SHORTCUTS_REL = 'src/vs/workbench/contrib/webview/electron-browser/windowIgnoreMenuShortcutsManager.ts';
const WEBVIEW_COMMANDS_REL = 'src/vs/workbench/contrib/webview/electron-browser/webviewCommands.ts';
const WEBVIEW_CONTRIB_REL = 'src/vs/workbench/contrib/webview/browser/webview.contribution.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const IFRAME_REL = 'src/vs/base/browser/iframe.ts';
const WEBVIEW_MANAGER_REL = 'src/vs/platform/webview/common/webviewManagerService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const singleCatch = '.catch(onUnexpectedError)';
const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${singleCatch}`), `missing single-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${singleCatch};`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(doubleCatch));
}

const contextMenuVisibleTrueCall = 'this._send(\'set-context-menu-visible\', { visible: true })';
const contextMenuVisibleFalseCall = 'this._send(\'set-context-menu-visible\', { visible: false })';
const confirmBeforeCloseCall = 'this._send(\'set-confirm-before-close\', this._confirmBeforeClose)';
const setTitleCall = 'this._send(\'set-title\', title)';
const initialScrollCall = 'this._send(\'initial-scroll-position\', value)';
const execCommandCall = 'this._send(\'execCommand\', command)';
const findPreviousCall = 'this._send(\'find\', { value, previous })';
const findValueCall = 'this._send(\'find\', { value })';
const leftoverFindStopCall = 'this._send(\'find-stop\', { clearSelection: !keepSelection });';
const leftoverFocusCall = '\t\t\tthis._send(\'focus\', undefined);\n';
const leftoverStylesCall = 'this._send(\'styles\', { styles, activeTheme, themeId, themeLabel, reduceMotion, screenReader });';
const leftoverChunkCall = 'this._send(\'did-load-resource-chunk\', { id, data }, [data.buffer]);';
const leftoverEndErrorCall = 'this._send(\'did-load-resource-end\', { id, error: true });';
const leftoverEndCall = 'this._send(\'did-load-resource-end\', { id });';
const leftoverReturnedMessageCall = 'return this._send(\'message\', { message, transfer });';
const leftoverReturnedLocalhostCall = 'return this._send(\'did-load-localhost\', {';
const assignedOriginThenCall = 'const originPromise = parentOriginHash(targetWindow.origin, this.origin).then(id => {';
const originThenCall = `this._encodedWebviewOriginPromise.then(encodedWebviewOrigin => {
			if (this.isDisposed || this._store.isDisposed || this._disposed) {
				return;
			}
			this._initElement(encodedWebviewOrigin, this.extension, this._options, targetWindow);
		})`;
const loadResourceCall = 'this.loadResource(entry.id, uri, { ifNoneMatch: entry.ifNoneMatch, range: entry.range }, this._resourceLoadingCts.token)';
const localLocalhostCall = 'this.localLocalhost(entry.id, entry.origin)';
const focusDelayerCall = `this._focusDelayer.trigger(async () => {
			if (this.isDisposed || this._store.isDisposed || this._disposed || !this.isFocused || !this.element) {
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
const overlayThenCall = `webview.postMessage(msg.message, msg.transfer).then(posted => {
						if (this.isDisposed || this._store.isDisposed) {
							return;
						}
						msg.resolve(posted);
					})`;
const leftoverOpenDevToolsCall = 'nativeHostService.openDevTools();';

const d875Calls: Array<[string, string, number]> = [
	[WEBVIEW_REL, contextMenuVisibleTrueCall, 1],
	[WEBVIEW_REL, contextMenuVisibleFalseCall, 1],
	[WEBVIEW_REL, confirmBeforeCloseCall, 1],
	[WEBVIEW_REL, setTitleCall, 1],
	[WEBVIEW_REL, initialScrollCall, 1],
	[WEBVIEW_REL, execCommandCall, 1],
	[WEBVIEW_REL, findPreviousCall, 1],
	[WEBVIEW_REL, findValueCall, 1],
];

suite('leftover remaining unused after D763 leftover remaining unused webview leftover remaining unused Promise fire-and-forget catch scan (D875)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D763 already-double after discarding collision overflow still had four or more legal unused leftover sites so this knife stayed on webview leftover remaining unused', () => {
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const shortcuts = fs.readFileSync(resolveSource(SHORTCUTS_REL), 'utf8');
		const overlay = fs.readFileSync(resolveSource(OVERLAY_REL), 'utf8');
		assert.ok(webview.includes(`${loadResourceCall}${singleCatch}`));
		assert.ok(webview.includes(`${localLocalhostCall}${singleCatch}`));
		assert.ok(webview.includes(`${focusDelayerCall}${singleCatch}`));
		assert.ok(webview.includes(leftoverFocusCall));
		assert.ok(!webview.includes(`${leftoverFocusCall.trimEnd()}${doubleCatch}`));
		assert.ok(webview.includes(leftoverFindStopCall));
		assert.ok(!webview.includes(`this._send('find-stop', { clearSelection: !keepSelection })${doubleCatch}`));
		assert.ok(webview.includes(leftoverReturnedMessageCall));
		assert.ok(!webview.includes(`return this._send('message', { message, transfer })${doubleCatch}`));
		assert.ok(!electron.includes(doubleCatch));
		assert.ok(!shortcuts.includes(doubleCatch));
		assert.ok(!overlay.includes(doubleCatch));
		assert.ok(!webview.includes(doubleCatch));
		let leftoverRemainingUnusedLegal = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d875Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${singleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			leftoverRemainingUnusedLegal += count;
		}
		assert.ok(leftoverRemainingUnusedLegal >= 4, `expected leftover remaining unused webview legal leftover >=4 after discarding collision overflow, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(leftoverRemainingUnusedLegal <= 8);
		assert.ok(!webview.includes('D875'));
		assert.ok(!electron.includes('D875'));
		assert.ok(!shortcuts.includes('D875'));
		assert.ok(!overlay.includes('D875'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on webview leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d875Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${singleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.ok(!seen.get(WEBVIEW_REL)?.includes(doubleCatch));
	});

	test('leftover remaining unused async this._send() FOF leftover void promises are Promise/async + double-chain', () => {
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		assertPromiseSignature(webview, 'private async _send<K extends keyof ToWebviewMessage>(channel: K, data: ToWebviewMessage[K], _createElement: Transferable[] = []): Promise<boolean> {');
		assert.ok(webview.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(webview, contextMenuVisibleTrueCall);
		assertWrapped(webview, contextMenuVisibleFalseCall);
		assertWrapped(webview, confirmBeforeCloseCall);
		assertWrapped(webview, setTitleCall);
		assertWrapped(webview, initialScrollCall);
		assertWrapped(webview, execCommandCall);
		assertWrapped(webview, findPreviousCall);
		assertWrapped(webview, findValueCall);
		assert.strictEqual(countIncludes(webview, `${contextMenuVisibleTrueCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${contextMenuVisibleFalseCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${confirmBeforeCloseCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${setTitleCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${initialScrollCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${execCommandCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${findPreviousCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${findValueCall}${singleCatch}`), 1);
		assert.ok(!webview.includes('\t\t\tthis._send(\'set-context-menu-visible\', { visible: true });\n'));
		assert.ok(!webview.includes('() => this._send(\'set-context-menu-visible\', { visible: false })));'));
		assert.ok(!webview.includes('\t\t\t\tthis._send(\'set-confirm-before-close\', this._confirmBeforeClose);\n'));
		assert.ok(!webview.includes('\t\tthis._send(\'set-title\', title);\n'));
		assert.ok(!webview.includes('\t\tthis._send(\'initial-scroll-position\', value);\n'));
		assert.ok(!webview.includes('\t\t\tthis._send(\'execCommand\', command);\n'));
		assert.ok(!webview.includes('\t\tthis._send(\'find\', { value, previous });\n'));
		assert.ok(!webview.includes('\t\tthis._send(\'find\', { value });\n'));
		assert.ok(webview.includes(leftoverFindStopCall));
		assert.ok(!webview.includes(`this._send('find-stop', { clearSelection: !keepSelection })${doubleCatch}`));
		assert.ok(webview.includes(leftoverFocusCall));
		assert.ok(!webview.includes(`this._send('focus', undefined)${doubleCatch}`));
		assert.ok(webview.includes(leftoverStylesCall));
		assert.ok(!webview.includes(`this._send('styles', { styles, activeTheme, themeId, themeLabel, reduceMotion, screenReader })${doubleCatch}`));
		assert.ok(webview.includes(leftoverChunkCall));
		assert.ok(!webview.includes(`this._send('did-load-resource-chunk', { id, data }, [data.buffer])${doubleCatch}`));
		assert.ok(webview.includes(leftoverEndErrorCall));
		assert.ok(!webview.includes(`this._send('did-load-resource-end', { id, error: true })${doubleCatch}`));
		assert.ok(webview.includes(leftoverEndCall));
		assert.ok(!webview.includes(`this._send('did-load-resource-end', { id })${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const overlay = fs.readFileSync(resolveSource(OVERLAY_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(WEBVIEW_IFACE_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(WEBVIEW_COMMANDS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(WEBVIEW_CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const iframe = fs.readFileSync(resolveSource(IFRAME_REL), 'utf8');
		const manager = fs.readFileSync(resolveSource(WEBVIEW_MANAGER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(webview, 'private async _send<K extends keyof ToWebviewMessage>(channel: K, data: ToWebviewMessage[K], _createElement: Transferable[] = []): Promise<boolean> {');
		assertPromiseSignature(iface, 'postMessage(message: any, transfer?: readonly ArrayBuffer[]): Promise<boolean>;');
		assertPromiseSignature(asyncSource, 'trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {');
		assertPromiseSignature(iframe, 'export async function parentOriginHash(parentOrigin: string, salt: string): Promise<string> {');
		assertPromiseSignature(manager, 'findInFrame(windowId: WebviewWindowId, frameName: string, text: string, options: FindInFrameOptions): Promise<void>;');

		assert.ok(!webview.includes('openerService.open'));
		assert.ok(!webview.includes('IOpenerService'));
		assert.ok(!webview.includes('extends Action2'));
		assert.ok(commands.includes('export class OpenWebviewDeveloperToolsAction extends Action2 {'));
		assert.ok(commands.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(commands.includes(leftoverOpenDevToolsCall));
		assert.ok(!commands.includes(`nativeHostService.openDevTools()${doubleCatch}`));
		assert.ok(!commands.includes(doubleCatch));
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(webview.includes(assignedOriginThenCall));
		assert.ok(!webview.includes(`${assignedOriginThenCall}${doubleCatch}`));
		assert.ok(webview.includes(`${originThenCall}${singleCatch};`));
		assert.ok(!webview.includes('.then(undefined,'));
		assert.ok(webview.includes(leftoverReturnedMessageCall));
		assert.ok(!webview.includes(`return this._send('message', { message, transfer })${doubleCatch}`));
		assert.ok(webview.includes(leftoverReturnedLocalhostCall));
		assert.ok(!webview.includes(`return this._send('did-load-localhost', {${doubleCatch}`));
		assert.ok(webview.includes('return this._send(\'did-load-resource\', {'));
		assert.ok(overlay.includes(`${overlayThenCall}${singleCatch}`));

		for (const source of [webview, overlay, commands, contrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D875'));
		}
	});

});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const MAIN_REL = 'src/vs/platform/browserView/electron-main/browserViewMainService.ts';
const EMU_REL = 'src/vs/platform/browserView/electron-main/browserViewEmulator.ts';
const TAB_REL = 'src/vs/platform/browserView/node/playwrightTab.ts';
const INSPECT_REL = 'src/vs/platform/browserView/electron-main/browserViewInspector.ts';
const NATIVE_REL = 'src/vs/platform/native/electron-main/nativeHostMainService.ts';
const NATIVE_IFACE_REL = 'src/vs/platform/native/common/native.ts';
const PLAYWRIGHT_REL = 'node_modules/playwright-core/types/types.d.ts';
const HOVER_REL = 'src/vs/platform/hover/browser/hoverService.ts';
const SCANNER_REL = 'src/vs/platform/extensionManagement/common/extensionsScannerService.ts';
const FILE_MANAGED_REL = 'src/vs/platform/policy/common/fileManagedSettingsIpc.ts';
const TELEMETRY_REL = 'src/vs/platform/telemetry/common/telemetryIpc.ts';
const WATCHER_REL = 'src/vs/platform/extensionManagement/node/extensionsWatcher.ts';
const LANGUAGE_REL = 'src/vs/platform/languagePacks/node/languagePacks.ts';
const WINDOW_IMPL_REL = 'src/vs/platform/windows/electron-main/windowImpl.ts';
const WINDOWS_MAIN_REL = 'src/vs/platform/windows/electron-main/windowsMainService.ts';
const SHELL_REL = 'src/vs/platform/terminal/node/windowsShellHelper.ts';
const PERMS_REL = 'src/vs/platform/browserView/electron-main/browserSessionPermissions.ts';
const GROUP_REL = 'src/vs/platform/browserView/electron-main/browserViewGroup.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
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

function assertDoubleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch};`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('platform browserView leftover Promise fire-and-forget catch scan (D727)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers seven leftover Promise double-chain sites', () => {
		const files = [MAIN_REL, EMU_REL, TAB_REL, INSPECT_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.strictEqual(files.length, 4);
		assert.strictEqual(sites, 7);
	});

	test('mainService leftover openNew / openExternal are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const nativeIface = fs.readFileSync(resolveSource(NATIVE_IFACE_REL), 'utf8');
		assertPromiseSignature(source, 'private async openNew(');
		assertPromiseSignature(source, '): Promise<BrowserView> {');
		assertPromiseSignature(native, 'async openExternal(windowId: number | undefined, url: string, defaultApplication?: string): Promise<boolean> {');
		assertPromiseSignature(nativeIface, 'openExternal(url: string, defaultApplication?: string): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const openLink = `void this.openNew(params.linkURL, {
						hostWindowId: view.hostWindowId,
						owner: view.owner,
						session: view.session.id,
					}, { preserveFocus: true, background: true }, 'browserLinkBackground')`;
		const openImage = `void this.openNew(params.srcURL!, {
						hostWindowId: view.hostWindowId,
						owner: view.owner,
						session: view.session.id,
					}, { preserveFocus: true, background: true }, 'browserLinkBackground')`;
		assert.ok(source.includes(`${openLink}${doubleCatch};`));
		assert.ok(source.includes(`${openImage}${doubleCatch};`));
		assert.ok(!source.includes(`${openLink};`));
		assert.ok(!source.includes(`${openImage};`));
		assertDoubleThen(source, 'void this.nativeHostMainService.openExternal(undefined, params.linkURL)');
	});

	test('emulator leftover _applyTouchAndMedia is Promise double-chain; sync _reapply stays skipped', () => {
		const source = fs.readFileSync(resolveSource(EMU_REL), 'utf8');
		assertPromiseSignature(source, 'private async _applyTouchAndMedia(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(source.includes('private _reapply(): void {'));
		assertDoubleThen(source, 'void this._applyTouchAndMedia()');
		assert.strictEqual((source.match(/void this\._applyTouchAndMedia\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(!source.includes('void this._applyTouchAndMedia();'));
		assert.ok(source.includes('void this._reapply();'));
		assert.ok(!source.includes('this._reapply().catch'));
	});

	test('playwrightTab leftover waitForFunction then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TAB_REL), 'utf8');
		const playwright = fs.readFileSync(resolveSource(PLAYWRIGHT_REL), 'utf8');
		assertPromiseSignature(playwright, 'waitForFunction<R>(pageFunction: PageFunction<void, R>, arg?: any, options?: PageWaitForFunctionOptions): Promise<SmartHandle<R>>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `this.page.waitForFunction(() => true, undefined, { timeout: 0 }).then(() => {
			if (this._dialog === dialog) {
				this._dialog = undefined;
				this._onDialogStateChanged.fire();
			}
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
	});

	test('inspector leftover addComment queue is Promise double-chain; empty-catch queues stay skipped', () => {
		const source = fs.readFileSync(resolveSource(INSPECT_REL), 'utf8');
		assertPromiseSignature(source, 'private _queueInspectionOperation(operation: () => Promise<void>): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const addComment = `void this._queueInspectionOperation(async () => {
						if (!this.browser.webContents.isDestroyed()) {
							this.browser.webContents.focus();
							handle.addComment();
						}
					})`;
		assert.ok(source.includes(`${addComment}${doubleCatch};`));
		assert.ok(!source.includes(`${addComment};`));
		assert.ok(!source.includes(`${addComment}.catch(onUnexpectedError);`));
		assert.ok(source.includes('void this._queueInspectionOperation(async () => {\n\t\t\t\tconst activeSelection = this._activeSelection.value;'));
		assert.ok(source.includes('}).catch(() => { });'));
		assert.strictEqual((source.match(/void this\._queueInspectionOperation\(async \(\) => \{/g) ?? []).length, 3);
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / two-arg then / assigned then / already-done / windows electron-main / terminal stay skipped', () => {
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const emu = fs.readFileSync(resolveSource(EMU_REL), 'utf8');
		const tab = fs.readFileSync(resolveSource(TAB_REL), 'utf8');
		const inspect = fs.readFileSync(resolveSource(INSPECT_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const fileManaged = fs.readFileSync(resolveSource(FILE_MANAGED_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const watcher = fs.readFileSync(resolveSource(WATCHER_REL), 'utf8');
		const language = fs.readFileSync(resolveSource(LANGUAGE_REL), 'utf8');
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const windowsMain = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const shell = fs.readFileSync(resolveSource(SHELL_REL), 'utf8');
		const perms = fs.readFileSync(resolveSource(PERMS_REL), 'utf8');
		const group = fs.readFileSync(resolveSource(GROUP_REL), 'utf8');
		assert.ok(hover.includes(`timeout(delay).then(() => {
			if (hover.hover && !hover.hover.isDisposed) {
				this._currentDelayedHoverWasShown = true;
				this._showHover(hover, options);
			}
		});`));
		assert.ok(!hover.includes(doubleCatch));
		assert.ok(scanner.includes('this.fileService.exists(toCheck).then(exists => {'));
		assert.ok(!scanner.includes(doubleCatch));
		assert.ok(fileManaged.includes('const rawSnapshot = channel.call<RawManagedSettingsData>(\'getRawManagedSettings\').then(managedSettings => {'));
		assert.ok(!fileManaged.includes(doubleCatch));
		assert.ok(telemetry.includes('.then(undefined, err => `Failed to log telemetry: ${console.warn(err)}`);'));
		assert.ok(!telemetry.includes(doubleCatch));
		assert.ok(watcher.includes('this.initialize().then(null, error => logService.error(\'Error while initializing Extensions Watcher\', getErrorMessage(error)));'));
		assert.ok(!watcher.includes(doubleCatch));
		assert.ok(language.includes('.then(() => this.languagePacks);'));
		assert.ok(!language.includes(doubleCatch));
		assert.ok(windowImpl.includes(`this.ready().then(() => {
				if (!token.isCancellationRequested) {
					this.send(channel, ...args);
				}
			})${doubleCatch};`));
		assert.ok(windowsMain.includes(`this.workspacesHistoryMainService.addRecentlyOpened(recents)${doubleCatch};`));
		assert.ok(shell.includes(`this._startMonitoringShell()${doubleCatch};`));
		assert.ok(inspect.includes('this.browser.debugger.attach().then(conn => this._watchSession(conn)).catch(() => { });'));
		assert.ok(!inspect.includes(`this.browser.debugger.attach().then(conn => this._watchSession(conn))${doubleCatch}`));
		assert.ok(perms.includes('this._resolveRequest(webContents, permission, details).then(callback, () => callback(false));'));
		assert.ok(!perms.includes(doubleCatch));
		assert.ok(group.includes('this._watchView(view);'));
		assert.ok(!group.includes(doubleCatch));
		assert.ok(emu.includes('private _reapply(): void {'));
		assert.ok(!emu.includes('this._reapply().catch'));
		for (const source of [main, emu, tab, inspect]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('openerService.open'));
			assert.ok(!source.includes('IOpenerService'));
			assert.ok(!source.includes('then(clear,clear)'));
			assert.ok(!source.includes('githubTransport'));
		}
	});
});

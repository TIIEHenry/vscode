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
const WINDOW_IMPL_REL = 'src/vs/platform/windows/electron-main/windowImpl.ts';
const WINDOWS_MAIN_REL = 'src/vs/platform/windows/electron-main/windowsMainService.ts';
const LAUNCH_REL = 'src/vs/platform/launch/electron-main/launchMainService.ts';
const WINDOW_IFACE_REL = 'src/vs/platform/window/electron-main/window.ts';
const LIFECYCLE_REL = 'src/vs/platform/lifecycle/electron-main/lifecycleMainService.ts';
const HISTORY_REL = 'src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts';
const DIALOG_REL = 'src/vs/platform/dialogs/electron-main/dialogMainService.ts';
const URL_REL = 'src/vs/platform/url/common/url.ts';
const UPDATE_ABS_REL = 'src/vs/platform/update/electron-main/abstractUpdateService.ts';

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

suite('platform windows / electron-main leftover Promise fire-and-forget catch scan (D704)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const files = [WINDOW_IMPL_REL, WINDOWS_MAIN_REL, LAUNCH_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.strictEqual(files.length, 3);
		assert.strictEqual(sites, 8);
	});

	test('windowImpl leftover ready then is Promise double-chain; sendWhenReady stays void; race timeout then stays skipped', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(WINDOW_IFACE_REL), 'utf8');
		assertPromiseSignature(source, 'ready(): Promise<ICodeWindow> {');
		assert.ok(iface.includes('sendWhenReady(channel: string, token: CancellationToken, ...args: unknown[]): void;'));
		assert.ok(source.includes("import { errorHandler, onUnexpectedError } from '../../../base/common/errors.js';"));
		const readyThen = `this.ready().then(() => {
				if (!token.isCancellationRequested) {
					this.send(channel, ...args);
				}
			})`;
		assert.ok(source.includes(`${readyThen}${doubleCatch};`));
		assert.ok(!source.includes(`${readyThen};`));
		assert.ok(!source.includes(`${readyThen}.catch(onUnexpectedError);`));
		assert.ok(source.includes('sendWhenReady(channel: string, token: CancellationToken, ...args: unknown[]): void {'));
		assert.ok(source.includes("this.sendWhenReady('vscode:enterFullScreen', CancellationToken.None);"));
		assert.ok(!source.includes("this.sendWhenReady('vscode:enterFullScreen', CancellationToken.None).catch"));
		assert.ok(source.includes('timeout(10000).then(() => false)'));
		assert.ok(!source.includes('timeout(10000).then(() => false).catch'));
	});

	test('windowsMain leftover unload LOAD then is Promise double-chain; returned doOpen stays skipped', () => {
		const source = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'unload(window: ICodeWindow, reason: UnloadReason): Promise<boolean /* veto */>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const unloadThen = `this.lifecycleMainService.unload(window, UnloadReason.LOAD).then(async veto => {
				if (!veto) {
					await this.doOpenInBrowserWindow(window, configuration, options, defaultProfile);
				}
			})`;
		assert.ok(source.includes(`${unloadThen}${doubleCatch};`));
		assert.ok(!source.includes(`${unloadThen};`));
		assert.ok(!source.includes(`${unloadThen}.catch(onUnexpectedError);`));
		assert.ok(source.includes('await this.doOpenInBrowserWindow(window, configuration, options, defaultProfile);'));
		assert.ok(!source.includes('this.when(LifecycleMainPhase.Ready)'));
	});

	test('windowsMain leftover addRecentlyOpened / wait-marker IIFE / showMessageBox are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const dialog = fs.readFileSync(resolveSource(DIALOG_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(WINDOW_IFACE_REL), 'utf8');
		assertPromiseSignature(history, 'addRecentlyOpened(recents: IRecent[]): Promise<void>;');
		assertPromiseSignature(dialog, 'showMessageBox(options: electron.MessageBoxOptions, window?: electron.BrowserWindow): Promise<electron.MessageBoxReturnValue>;');
		assertPromiseSignature(iface, 'readonly whenClosedOrLoaded: Promise<void>;');
		assertDoubleThen(source, 'this.workspacesHistoryMainService.addRecentlyOpened(recents)');
		assert.ok(source.includes(`})()${doubleCatch};`));
		assert.ok(!source.includes('})();'));
		const boxCall = `this.dialogMainService.showMessageBox({
				type: 'info',
				buttons: [localize({ key: 'ok', comment: ['&& denotes a mnemonic'] }, "&&OK")],
				message: uri.scheme === Schemas.file ? localize('pathNotExistTitle', "Path does not exist") : localize('uriInvalidTitle', "URI can not be opened"),
				detail: uri.scheme === Schemas.file ?
					localize('pathNotExistDetail', "The path '{0}' does not exist on this computer.", getPathLabel(uri, { os: OS, tildify: this.environmentMainService })) :
					localize('uriInvalidDetail', "The URI '{0}' is not valid and can not be opened.", uri.toString(true))
			}, BrowserWindow.getFocusedWindow() ?? undefined)`;
		assert.ok(source.includes(`${boxCall}${doubleCatch};`));
		assert.ok(!source.includes(`${boxCall};`));
		assert.ok(!source.includes(`${boxCall}.catch(onUnexpectedError);`));
	});

	test('windowsMain leftover reload voids are Promise double-chain; ICodeWindow.reload stays skipped', () => {
		const source = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(WINDOW_IFACE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'reload(window: ICodeWindow, cli?: NativeParsedArgs): Promise<void>;');
		assert.ok(iface.includes('reload(cli?: NativeParsedArgs): void;'));
		assertDoubleThen(source, 'this.lifecycleMainService.reload(existingWindow, openConfig.cli)');
		assert.ok(source.includes(`() => this.lifecycleMainService.reload(createdWindow)${doubleCatch})`));
		assert.ok(!source.includes('() => this.lifecycleMainService.reload(createdWindow));'));
		assert.ok(!source.includes('() => this.lifecycleMainService.reload(createdWindow).catch(onUnexpectedError));'));
		assert.ok(!source.includes('window.reload('));
	});

	test('launch leftover whenWindowReady then is Promise double-chain; two-arg then and url open stay skipped', () => {
		const source = fs.readFileSync(resolveSource(LAUNCH_REL), 'utf8');
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const url = fs.readFileSync(resolveSource(URL_REL), 'utf8');
		assertPromiseSignature(windowImpl, 'ready(): Promise<ICodeWindow> {');
		assertPromiseSignature(url, 'open(url: URI, options?: IOpenURLOptions): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(source.includes('whenWindowReady = window.ready();'));
		const readyThen = `whenWindowReady.then(() => {
				for (const { uri, originalUrl } of urlsToOpen) {
					this.urlService.open(uri, { originalUrl });
				}
			})`;
		assert.ok(source.includes(`${readyThen}${doubleCatch};`));
		assert.ok(!source.includes(`${readyThen};`));
		assert.ok(!source.includes(`${readyThen}.catch(onUnexpectedError);`));
		assert.ok(source.includes('this.urlService.open(uri, { originalUrl });'));
		assert.ok(!source.includes('this.urlService.open(uri, { originalUrl }).catch'));
		assert.ok(source.includes(']).then(() => undefined, () => undefined);'));
		assert.ok(!source.includes('].then(() => undefined, () => undefined).catch'));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / already-done stay skipped', () => {
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const windowsMain = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const launch = fs.readFileSync(resolveSource(LAUNCH_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const updateAbs = fs.readFileSync(resolveSource(UPDATE_ABS_REL), 'utf8');
		assert.ok(lifecycle.includes('this.when(LifecycleMainPhase.Ready).then(() => this.registerListeners()).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(updateAbs.includes('void this.checkForOverwriteUpdates().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(windowsMain.includes('private registerListeners(): void {'));
		assert.ok(!windowsMain.includes('this.registerListeners().catch'));
		assert.ok(windowImpl.includes('() => this.onWindowError(WindowError.UNRESPONSIVE)));'));
		assert.ok(!windowImpl.includes('this.onWindowError(WindowError.UNRESPONSIVE).catch'));
		assert.ok(windowImpl.includes('this.lifecycleMainService.kill(1);'));
		assert.ok(!windowImpl.includes('this.lifecycleMainService.kill(1).catch'));
		assert.ok(windowImpl.includes('this.lifecycleMainService.quit();'));
		assert.ok(!windowImpl.includes('this.lifecycleMainService.quit().catch'));
		for (const source of [windowImpl, windowsMain, launch]) {
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

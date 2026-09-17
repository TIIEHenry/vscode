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
const LOADER_REL = 'src/vs/platform/webContentExtractor/electron-main/webPageLoader.ts';
const LOADER_TEST_REL = 'src/vs/platform/webContentExtractor/test/electron-main/webPageLoader.test.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const HOVER_REL = 'src/vs/platform/hover/browser/hoverService.ts';
const SCANNER_REL = 'src/vs/platform/extensionManagement/common/extensionsScannerService.ts';
const FILE_MANAGED_REL = 'src/vs/platform/policy/common/fileManagedSettingsIpc.ts';
const TELEMETRY_REL = 'src/vs/platform/telemetry/common/telemetryIpc.ts';
const WATCHER_REL = 'src/vs/platform/extensionManagement/node/extensionsWatcher.ts';
const LANGUAGE_REL = 'src/vs/platform/languagePacks/node/languagePacks.ts';
const WINDOW_IMPL_REL = 'src/vs/platform/windows/electron-main/windowImpl.ts';
const WINDOWS_MAIN_REL = 'src/vs/platform/windows/electron-main/windowsMainService.ts';
const SHELL_REL = 'src/vs/platform/terminal/node/windowsShellHelper.ts';
const INSPECT_REL = 'src/vs/platform/browserView/electron-main/browserViewInspector.ts';
const TRANSPORT_REL = 'src/vs/platform/github/common/githubTransport.ts';

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

suite('platform webContentExtractor leftover Promise fire-and-forget catch scan (D733)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const source = fs.readFileSync(resolveSource(LOADER_REL), 'utf8');
		const sites = (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		assert.strictEqual(sites, 8);
	});

	test('loader leftover loadURL is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(LOADER_REL), 'utf8');
		const loaderTest = fs.readFileSync(resolveSource(LOADER_TEST_REL), 'utf8');
		assertPromiseSignature(source, 'public async load() {');
		assert.ok(loaderTest.includes('public loadURL = sinon.stub().resolves();'));
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'void this._window.loadURL(this._uri.toString(true))');
	});

	test('loader leftover queue extractContent fire-and-forgets are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(LOADER_REL), 'utf8');
		const asyncSrc = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(asyncSrc, 'queue(factory: ITask<Promise<T>>): Promise<T>;');
		assert.ok(asyncSrc.includes('export class Queue<T> extends Limiter<T> {'));
		assertPromiseSignature(source, 'private async extractContent(errorResult?: WebContentExtractResult & { status: \'error\' }) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'void this._queue.queue(() => this.extractContent())');
		assert.strictEqual((source.match(/void this\._queue\.queue\(\(\) => this\.extractContent\(\)\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 4);
		assert.ok(!source.includes('this._queue.queue(() => this.extractContent());'));
	});

	test('loader leftover queue extractContent error fire-and-forgets are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(LOADER_REL), 'utf8');
		assertDoubleThen(source, 'void this._queue.queue(() => this.extractContent({ status: \'error\', error: `Download not allowed: ${filename}` }))');
		assertDoubleThen(source, 'void this._queue.queue(() => this.extractContent({ status: \'error\', statusCode, error }))');
		assert.strictEqual((source.match(/void this\._queue\.queue\(\(\) => this\.extractContent\(\{ status: 'error', statusCode, error \}\)\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / two-arg then / assigned then / empty-catch / windows electron-main / terminal / browserView stay skipped', () => {
		const source = fs.readFileSync(resolveSource(LOADER_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const fileManaged = fs.readFileSync(resolveSource(FILE_MANAGED_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const watcher = fs.readFileSync(resolveSource(WATCHER_REL), 'utf8');
		const language = fs.readFileSync(resolveSource(LANGUAGE_REL), 'utf8');
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const windowsMain = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const shell = fs.readFileSync(resolveSource(SHELL_REL), 'utf8');
		const inspect = fs.readFileSync(resolveSource(INSPECT_REL), 'utf8');
		const transport = fs.readFileSync(resolveSource(TRANSPORT_REL), 'utf8');
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
		assert.ok(source.includes('void this._debugger.sendCommand(\'Network.enable\').catch(() => {'));
		assert.ok(!source.includes(`void this._debugger.sendCommand('Network.enable')${doubleCatch}`));
		assert.ok(transport.includes('void promise.then('));
		assert.ok(!transport.includes(doubleCatch));
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
	});
});

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
const LIFECYCLE_REL = 'src/vs/platform/lifecycle/electron-main/lifecycleMainService.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const APP_REL = 'src/vs/code/electron-main/app.ts';
const IPC_REL = 'src/vs/base/parts/ipc/common/ipc.ts';
const UPDATE_ABS_REL = 'src/vs/platform/update/electron-main/abstractUpdateService.ts';
const LOG_IPC_REL = 'src/vs/platform/log/common/logIpc.ts';
const SPDLOG_REL = 'src/vs/platform/log/node/spdlogLog.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const singleCatch = '.catch(onUnexpectedError)';
const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertSingleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${singleCatch}`), `missing single-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}${doubleCatch}`));
}

suite('platform windows / electron-main remaining leftover Promise fire-and-forget catch scan (D713)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise single-chain sites', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const triggerCall = `this.jsCallStackCollector.trigger(() => this.startCollectingJScallStacks())${singleCatch}`;
		const sites = [
			source.includes(`this.onWindowError(WindowError.UNRESPONSIVE)${singleCatch}`),
			source.includes(`this.onWindowError(WindowError.RESPONSIVE)${singleCatch}`),
			source.includes(`this.onWindowError(WindowError.PROCESS_GONE, { ...details })${singleCatch}`),
			source.includes(`this.onWindowError(WindowError.LOAD, { reason, exitCode })${singleCatch}`),
			source.includes(`this.lifecycleMainService.kill(1)${singleCatch}`),
			source.includes(`this.lifecycleMainService.quit()${singleCatch}`),
		].filter(Boolean).length
			+ (source.split(triggerCall).length - 1);
		assert.strictEqual(sites, 8);
		assert.ok(!source.includes(doubleCatch));
	});

	test('windowImpl leftover onWindowError fire-and-forgets are Promise single-chain', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		assertPromiseSignature(source, 'private async onWindowError(type: WindowError, details?: { reason?: string; exitCode?: number }): Promise<void> {');
		assert.ok(source.includes("import { errorHandler, onUnexpectedError } from '../../../base/common/errors.js';"));
		assertSingleThen(source, 'this.onWindowError(WindowError.UNRESPONSIVE)');
		assertSingleThen(source, 'this.onWindowError(WindowError.RESPONSIVE)');
		assertSingleThen(source, 'this.onWindowError(WindowError.PROCESS_GONE, { ...details })');
		assertSingleThen(source, 'this.onWindowError(WindowError.LOAD, { reason, exitCode })');
		assert.ok(!source.includes('this.onWindowError(WindowError.UNRESPONSIVE));'));
		assert.ok(!source.includes('this.onWindowError(WindowError.RESPONSIVE));'));
		assert.ok(!source.includes('this.onWindowError(WindowError.PROCESS_GONE, { ...details })));'));
		assert.ok(!source.includes('this.onWindowError(WindowError.LOAD, { reason, exitCode })));'));
	});

	test('windowImpl leftover kill(1) / quit() are Promise single-chain', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'kill(code?: number): Promise<void>;');
		assertPromiseSignature(lifecycle, 'quit(willRestart?: boolean): Promise<boolean /* veto */>;');
		assertSingleThen(source, 'this.lifecycleMainService.kill(1)');
		assertSingleThen(source, 'this.lifecycleMainService.quit()');
	});

	test('windowImpl leftover startCollectingJScallStacks trigger Promises are single-chain', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(source, 'private async startCollectingJScallStacks(): Promise<void> {');
		assertPromiseSignature(asyncSource, 'trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {');
		const triggerCall = 'this.jsCallStackCollector.trigger(() => this.startCollectingJScallStacks())';
		assert.strictEqual(source.split(`${triggerCall}${singleCatch}`).length - 1, 2);
		assert.ok(!source.includes(`${triggerCall};`));
		assert.ok(!source.includes(`${triggerCall}${doubleCatch}`));
	});

	test('D704 eight / opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / two-arg then / race timeout then / app.ts leftover / D700 / D705 stay skipped', () => {
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const windowsMain = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const launch = fs.readFileSync(resolveSource(LAUNCH_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const updateAbs = fs.readFileSync(resolveSource(UPDATE_ABS_REL), 'utf8');
		const app = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		const logIpc = fs.readFileSync(resolveSource(LOG_IPC_REL), 'utf8');
		const spdlog = fs.readFileSync(resolveSource(SPDLOG_REL), 'utf8');
		assert.ok(windowImpl.includes(`this.ready().then(() => {
				if (this._store.isDisposed) {
					return;
				}
				if (!token.isCancellationRequested) {
					this.send(channel, ...args);
				}
			})${singleCatch};`));
		assert.ok(!windowImpl.includes(doubleCatch));
		assert.ok(windowsMain.includes(`this.workspacesHistoryMainService.addRecentlyOpened(recents)${singleCatch};`));
		assert.ok(windowsMain.includes(`this.lifecycleMainService.reload(existingWindow, openConfig.cli)${singleCatch};`));
		assert.ok(!windowsMain.includes(doubleCatch));
		assert.ok(launch.includes(`whenWindowReady.then(() => {
				for (const { uri, originalUrl } of urlsToOpen) {
					this.urlService.open(uri, { originalUrl });
				}
			})${singleCatch};`));
		assert.ok(!launch.includes(doubleCatch));
		assert.ok(windowImpl.includes('timeout(10000).then(() => false)'));
		assert.ok(!windowImpl.includes('timeout(10000).then(() => false).catch'));
		assert.ok(windowImpl.includes('sendWhenReady(channel: string, token: CancellationToken, ...args: unknown[]): void {'));
		assert.ok(!windowImpl.includes("this.sendWhenReady('vscode:enterFullScreen', CancellationToken.None).catch"));
		assert.ok(lifecycle.includes(`this.when(LifecycleMainPhase.Ready).then(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.registerListeners();
		})${singleCatch};`));
		assert.ok(!lifecycle.includes(doubleCatch));
		assert.ok(updateAbs.includes(`void this.checkForOverwriteUpdates()${doubleCatch};`));
		assert.ok(logIpc.includes(`channel.call('setLogLevel', [loggerService.getLogLevel()])${doubleCatch};`));
		assert.ok(spdlog.includes(`this._loggerCreationPromise.then(() => this.flushLogger())${doubleCatch};`));
		assert.ok(ipc.includes('registerChannel(channelName: string, channel: IServerChannel<TContext>): void;'));
		assert.ok(app.includes(`sharedProcessClient.then(client => client.registerChannel('profileStorageListener', profileStorageListener))${singleCatch};`));
		assert.ok(app.includes(`void this.logOSProxyConfigTelemetry(nativeHostMainService, telemetryService)${singleCatch};`));
		assert.ok(app.includes('remoteResourceChannel.value.call<NodeRemoteResourceResponse>(NODE_REMOTE_RESOURCE_IPC_METHOD_NAME, [url]).then('));
		assert.ok(!app.includes(`remoteResourceChannel.value.call<NodeRemoteResourceResponse>(NODE_REMOTE_RESOURCE_IPC_METHOD_NAME, [url]).then(${doubleCatch}`));
		assert.ok(launch.includes(']).then(() => undefined, () => undefined);'));
		assert.ok(!launch.includes('].then(() => undefined, () => undefined).catch'));
		for (const source of [windowImpl, windowsMain, launch, app]) {
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

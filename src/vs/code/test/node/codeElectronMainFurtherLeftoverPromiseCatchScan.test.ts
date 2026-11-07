/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const APP_REL = 'src/vs/code/electron-main/app.ts';
const MAIN_REL = 'src/vs/code/electron-main/main.ts';
const WINDOWS_REL = 'src/vs/platform/windows/electron-main/windows.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const IPC_REL = 'src/vs/base/parts/ipc/common/ipc.ts';
const LIFECYCLE_REL = 'src/vs/platform/lifecycle/electron-main/lifecycleMainService.ts';
const TELEMETRY_REL = 'src/vs/platform/telemetry/electron-main/telemetryUtils.ts';
const WINDOW_IMPL_REL = 'src/vs/platform/windows/electron-main/windowImpl.ts';
const WINDOWS_MAIN_REL = 'src/vs/platform/windows/electron-main/windowsMainService.ts';
const LAUNCH_REL = 'src/vs/platform/launch/electron-main/launchMainService.ts';
const NATIVE_REL = 'src/vs/platform/native/electron-main/nativeHostMainService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const singleCatch = '.catch(onUnexpectedError)';
const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
const iifeTail = `})()${singleCatch};`;

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertSingleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${singleCatch};`), `missing single-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}${doubleCatch};`));
}

function sliceBetween(source: string, startNeedle: string, endNeedle: string): string {
	const start = source.indexOf(startNeedle);
	const end = source.indexOf(endNeedle, start + startNeedle.length);
	assert.ok(start >= 0 && end > start, `missing slice ${startNeedle} .. ${endNeedle}`);
	return source.slice(start, end);
}

suite('code electron-main further leftover Promise fire-and-forget catch scan (D730)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('activate / open-file timeout / new-window-for-tab leftover async listeners are Promise IIFE single-chain', () => {
		const app = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		const windows = fs.readFileSync(resolveSource(WINDOWS_REL), 'utf8');
		assertPromiseSignature(windows, 'open(openConfig: IOpenConfiguration): Promise<ICodeWindow[]>;');
		assertPromiseSignature(windows, 'openEmptyWindow(openConfig: IOpenEmptyConfiguration, options?: IOpenEmptyWindowOptions): Promise<ICodeWindow[]>;');
		assert.ok(app.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assert.ok(!app.includes("app.on('activate', async"));
		assert.ok(!app.includes('setTimeout(async () =>'));
		assert.ok(!app.includes("app.on('new-window-for-tab', async"));
		const activate = sliceBetween(app, "app.on('activate'", "app.on('web-contents-created'");
		const openFile = sliceBetween(app, "app.on('open-file'", "app.on('new-window-for-tab'");
		const newTab = sliceBetween(app, "app.on('new-window-for-tab'", '//#region Bootstrap IPC Handlers');
		for (const slice of [activate, openFile, newTab]) {
			assert.ok(slice.includes('void (async () => {'));
			assert.ok(slice.includes(iifeTail));
			assert.ok(!slice.includes(`})()${doubleCatch};`));
		}
	});

	test('D704 / D713 / D719 / D726 single-chained; opener / D145 / Connect / Watch / Resolve / Pty / two-arg / assigned / sync void / this.startup stay skipped', () => {
		const app = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const windowsMain = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const launch = fs.readFileSync(resolveSource(LAUNCH_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		assert.ok(ipc.includes('registerChannel(channelName: string, channel: IServerChannel<TContext>): void;'));
		assertSingleThen(app, "sharedProcessClient.then(client => client.registerChannel('policy', policyChannel))");
		assertSingleThen(app, "sharedProcessClient.then(client => client.registerChannel('profileStorageListener', profileStorageListener))");
		assertSingleThen(app, "sharedProcessClient.then(client => client.registerChannel('logger', loggerChannel))");
		assertPromiseSignature(app, 'private async installMutex(): Promise<void> {');
		assertPromiseSignature(app, 'private async resolveShellEnvironment(args: NativeParsedArgs, env: IProcessEnvironment, notifyOnError: boolean): Promise<typeof process.env> {');
		assertPromiseSignature(app, 'private async updateCrashReporterEnablement(): Promise<void> {');
		assertPromiseSignature(app, 'private async logOSProxyConfigTelemetry(nativeHostMainService: INativeHostMainService, telemetryService: ITelemetryService): Promise<void> {');
		assertPromiseSignature(telemetry, 'export async function validateDevDeviceId(stateService: IStateService, logService: ILogService): Promise<void> {');
		assertSingleThen(app, 'this.installMutex()');
		assertSingleThen(app, 'this.resolveShellEnvironment(this.environmentMainService.args, process.env, true)');
		assertSingleThen(app, 'this.updateCrashReporterEnablement()');
		assertSingleThen(app, 'validateDevDeviceId(this.stateService, this.logService)');
		assertSingleThen(app, 'void this.logOSProxyConfigTelemetry(nativeHostMainService, telemetryService)');
		assertPromiseSignature(lifecycle, 'kill(code?: number): Promise<void>;');
		assertSingleThen(main, 'lifecycleMainService.kill(exitCode)');
		assert.ok(windowImpl.includes(`this.onWindowError(WindowError.UNRESPONSIVE)${doubleCatch}`));
		assert.ok(windowsMain.includes(`this.workspacesHistoryMainService.addRecentlyOpened(recents)${doubleCatch};`));
		assert.ok(launch.includes(`whenWindowReady.then(() => {
				for (const { uri, originalUrl } of urlsToOpen) {
					this.urlService.open(uri, { originalUrl });
				}
			})${doubleCatch};`));
		assert.ok(main.includes('this.startup();'));
		assert.ok(!main.includes(`this.startup()${doubleCatch}`));
		assert.ok(app.includes('const activeWindowRouter = new StaticRouter(ctx => activeWindowManager.getActiveClientId().then(id => ctx === id));'));
		assert.ok(!app.includes('getActiveClientId().then(id => ctx === id).catch'));
		assert.ok(app.includes("getDelayedChannel(sharedProcessReady.then(client => client.getChannel('diagnostics')))"));
		assert.ok(!app.includes("sharedProcessReady.then(client => client.getChannel('diagnostics')).catch"));
		assert.ok(app.includes("getDelayedChannel(sharedProcessReady.then(client => client.getChannel('telemetryAppender')))"));
		assert.ok(!app.includes("sharedProcessReady.then(client => client.getChannel('telemetryAppender')).catch"));
		assert.ok(app.includes('remoteResourceChannel.value.call<NodeRemoteResourceResponse>(NODE_REMOTE_RESOURCE_IPC_METHOD_NAME, [url]).then('));
		assert.ok(!app.includes(`remoteResourceChannel.value.call<NodeRemoteResourceResponse>(NODE_REMOTE_RESOURCE_IPC_METHOD_NAME, [url]).then(${doubleCatch}`));
		assert.ok(app.includes("mainProcessElectronServer.registerChannel('policy', policyChannel);"));
		assert.ok(!app.includes("mainProcessElectronServer.registerChannel('policy', policyChannel).catch"));
		assert.ok(app.includes('mainProcessElectronServer.registerChannel(TerminalIpcChannels.LocalPty, ptyHostChannel);'));
		assert.ok(!app.includes('mainProcessElectronServer.registerChannel(TerminalIpcChannels.LocalPty, ptyHostChannel).catch'));
		assert.ok(app.includes('universeAgentSessionViewService.releaseLeasesOwnedBy(String(c.ctx));'));
		assert.ok(!app.includes('releaseLeasesOwnedBy(String(c.ctx)).catch'));
		assertPromiseSignature(native, 'async openExternal(windowId: number | undefined, url: string, defaultApplication?: string): Promise<boolean> {');
		assert.ok(app.includes('this.nativeHostMainService?.openExternal(undefined, details.url);'));
		assert.ok(!app.includes(`this.nativeHostMainService?.openExternal(undefined, details.url)${doubleCatch}`));
		assert.ok(windowImpl.includes('timeout(10000).then(() => false)'));
		assert.ok(!windowImpl.includes('timeout(10000).then(() => false).catch'));
		assert.ok(launch.includes(']).then(() => undefined, () => undefined);'));
		assert.ok(!launch.includes('].then(() => undefined, () => undefined).catch'));
		assert.ok(app.includes("validatedIpcMain.handle('vscode:fetchShellEnv', event => {"));
		assert.ok(app.includes('return this.resolveShellEnvironment(args, env, false);'));
		assert.ok(!app.includes(`return this.resolveShellEnvironment(args, env, false)${doubleCatch}`));
		assert.ok(app.includes("session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {"));
		assert.ok(!app.includes('setDisplayMediaRequestHandler(() => {'));
		assert.ok(main.includes("evt.join('instanceLockfile', promises.unlink(environmentMainService.mainLockfile).catch(() => { /* ignored */ }));"));
		assert.ok(!main.includes('promises.unlink(environmentMainService.mainLockfile).catch(onUnexpectedError)'));
		assert.ok(!app.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(!main.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
		for (const source of [app, main, windowImpl, windowsMain, launch]) {
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

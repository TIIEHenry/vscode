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

suite('code electron-main remaining leftover Promise fire-and-forget catch scan (D726)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const app = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const sites = [
			app.includes(`sharedProcessClient.then(client => client.registerChannel('profileStorageListener', profileStorageListener))${doubleCatch};`),
			app.includes(`sharedProcessClient.then(client => client.registerChannel('logger', loggerChannel))${doubleCatch};`),
			app.includes(`void this.logOSProxyConfigTelemetry(nativeHostMainService, telemetryService)${doubleCatch};`),
			app.includes(`this.installMutex()${doubleCatch};`),
			app.includes(`this.resolveShellEnvironment(this.environmentMainService.args, process.env, true)${doubleCatch};`),
			app.includes(`this.updateCrashReporterEnablement()${doubleCatch};`),
			app.includes(`validateDevDeviceId(this.stateService, this.logService)${doubleCatch};`),
			main.includes(`lifecycleMainService.kill(exitCode)${doubleCatch};`),
		].filter(Boolean).length;
		assert.strictEqual(sites, 8);
	});

	test('D719 leftover profileStorageListener / logger then and void logOSProxyConfigTelemetry are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		assertPromiseSignature(source, 'sharedProcessClient: Promise<MessagePortClient>');
		assert.ok(ipc.includes('registerChannel(channelName: string, channel: IServerChannel<TContext>): void;'));
		assert.ok(source.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assertDoubleThen(source, "sharedProcessClient.then(client => client.registerChannel('profileStorageListener', profileStorageListener))");
		assertDoubleThen(source, "sharedProcessClient.then(client => client.registerChannel('logger', loggerChannel))");
		assertPromiseSignature(source, 'private async logOSProxyConfigTelemetry(nativeHostMainService: INativeHostMainService, telemetryService: ITelemetryService): Promise<void> {');
		assertDoubleThen(source, 'void this.logOSProxyConfigTelemetry(nativeHostMainService, telemetryService)');
	});

	test('afterWindowOpen / eventually leftover async fire-and-forgets are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		assertPromiseSignature(source, 'private async installMutex(): Promise<void> {');
		assertPromiseSignature(source, 'private async resolveShellEnvironment(args: NativeParsedArgs, env: IProcessEnvironment, notifyOnError: boolean): Promise<typeof process.env> {');
		assertPromiseSignature(source, 'private async updateCrashReporterEnablement(): Promise<void> {');
		assertPromiseSignature(telemetry, 'export async function validateDevDeviceId(stateService: IStateService, logService: ILogService): Promise<void> {');
		assertDoubleThen(source, 'this.installMutex()');
		assertDoubleThen(source, 'this.resolveShellEnvironment(this.environmentMainService.args, process.env, true)');
		assertDoubleThen(source, 'this.updateCrashReporterEnablement()');
		assertDoubleThen(source, 'validateDevDeviceId(this.stateService, this.logService)');
		assert.ok(source.includes('return this.resolveShellEnvironment(args, env, false);'));
		assert.ok(!source.includes(`return this.resolveShellEnvironment(args, env, false)${doubleCatch}`));
	});

	test('main.ts leftover lifecycle kill is Promise double-chain', () => {
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'kill(code?: number): Promise<void>;');
		assert.ok(main.includes('import { ExpectedError, onUnexpectedError, setUnexpectedErrorHandler } from \'../../base/common/errors.js\';'));
		assertDoubleThen(main, 'lifecycleMainService.kill(exitCode)');
	});

	test('D704 / D713 / D719 already dual-chained stay skipped; opener / D145 / Connect / Watch / Resolve / Pty / two-arg / assigned / sync void / this.startup stay skipped', () => {
		const app = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const windowsMain = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const launch = fs.readFileSync(resolveSource(LAUNCH_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		assert.ok(app.includes(`sharedProcessClient.then(client => client.registerChannel('policy', policyChannel))${doubleCatch};`));
		assert.ok(!app.includes(`sharedProcessClient.then(client => client.registerChannel('policy', policyChannel))${doubleCatch}${doubleCatch}`));
		assert.ok(windowImpl.includes(`this.onWindowError(WindowError.UNRESPONSIVE)${doubleCatch}`));
		assert.ok(windowImpl.includes(`this.lifecycleMainService.kill(1)${doubleCatch}`));
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
		assert.ok(app.includes('universeAgentSessionViewService.releaseLeasesOwnedBy(String(c.ctx));'));
		assert.ok(!app.includes('releaseLeasesOwnedBy(String(c.ctx)).catch'));
		assertPromiseSignature(native, 'async openExternal(windowId: number | undefined, url: string, defaultApplication?: string): Promise<boolean> {');
		assert.ok(app.includes('this.nativeHostMainService?.openExternal(undefined, details.url);'));
		assert.ok(!app.includes(`this.nativeHostMainService?.openExternal(undefined, details.url)${doubleCatch}`));
		assert.ok(windowImpl.includes('timeout(10000).then(() => false)'));
		assert.ok(!windowImpl.includes('timeout(10000).then(() => false).catch'));
		assert.ok(launch.includes(']).then(() => undefined, () => undefined);'));
		assert.ok(!launch.includes('].then(() => undefined, () => undefined).catch'));
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

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
const IPC_REL = 'src/vs/base/parts/ipc/common/ipc.ts';
const WINDOW_IMPL_REL = 'src/vs/platform/windows/electron-main/windowImpl.ts';
const WINDOWS_MAIN_REL = 'src/vs/platform/windows/electron-main/windowsMainService.ts';
const LAUNCH_REL = 'src/vs/platform/launch/electron-main/launchMainService.ts';
const LIFECYCLE_REL = 'src/vs/platform/lifecycle/electron-main/lifecycleMainService.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertSingleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${singleCatch};`), `missing single-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}${doubleCatch};`));
}

suite('code electron-main leftover Promise fire-and-forget catch scan (D719)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise single-chain sites', () => {
		const source = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		const sites = [
			source.includes(`sharedProcessClient.then(client => client.registerChannel('policy', policyChannel))${singleCatch};`),
			source.includes(`sharedProcessClient.then(client => client.registerChannel(LOCAL_FILE_SYSTEM_CHANNEL_NAME, fileSystemProviderChannel))${singleCatch};`),
			source.includes(`sharedProcessClient.then(client => client.registerChannel('userDataProfiles', userDataProfilesService))${singleCatch};`),
			source.includes(`sharedProcessClient.then(client => client.registerChannel(METERED_CONNECTION_CHANNEL, meteredConnectionChannel))${singleCatch};`),
			source.includes(`sharedProcessClient.then(client => client.registerChannel(ipcBrowserViewChannelName, browserViewChannel))${singleCatch};`),
			source.includes(`sharedProcessClient.then(client => client.registerChannel(ipcBrowserViewGroupChannelName, browserViewGroupChannel))${singleCatch};`),
			source.includes(`sharedProcessClient.then(client => client.registerChannel('nativeHost', nativeHostChannel))${singleCatch};`),
			source.includes(`sharedProcessClient.then(client => client.registerChannel('storage', storageChannel))${singleCatch};`),
		].filter(Boolean).length;
		assert.strictEqual(sites, 8);
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 0);
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});

	test('app.ts leftover sharedProcessClient then registerChannels are Promise single-chain', () => {
		const source = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		assertPromiseSignature(source, 'sharedProcessClient: Promise<MessagePortClient>');
		assert.ok(ipc.includes('registerChannel(channelName: string, channel: IServerChannel<TContext>): void;'));
		assert.ok(source.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assertSingleThen(source, "sharedProcessClient.then(client => client.registerChannel('policy', policyChannel))");
		assertSingleThen(source, 'sharedProcessClient.then(client => client.registerChannel(LOCAL_FILE_SYSTEM_CHANNEL_NAME, fileSystemProviderChannel))');
		assertSingleThen(source, "sharedProcessClient.then(client => client.registerChannel('userDataProfiles', userDataProfilesService))");
		assertSingleThen(source, 'sharedProcessClient.then(client => client.registerChannel(METERED_CONNECTION_CHANNEL, meteredConnectionChannel))');
		assertSingleThen(source, 'sharedProcessClient.then(client => client.registerChannel(ipcBrowserViewChannelName, browserViewChannel))');
		assertSingleThen(source, 'sharedProcessClient.then(client => client.registerChannel(ipcBrowserViewGroupChannelName, browserViewGroupChannel))');
		assertSingleThen(source, "sharedProcessClient.then(client => client.registerChannel('nativeHost', nativeHostChannel))");
		assertSingleThen(source, "sharedProcessClient.then(client => client.registerChannel('storage', storageChannel))");
	});

	test('D726 profileStorageListener / logger then / void logOSProxyConfigTelemetry single-chained; zero double-chain; assigned / two-arg / sync void stay skipped', () => {
		const source = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		assertSingleThen(source, "sharedProcessClient.then(client => client.registerChannel('profileStorageListener', profileStorageListener))");
		assertSingleThen(source, "sharedProcessClient.then(client => client.registerChannel('logger', loggerChannel))");
		assertPromiseSignature(source, 'private async logOSProxyConfigTelemetry(nativeHostMainService: INativeHostMainService, telemetryService: ITelemetryService): Promise<void> {');
		assertSingleThen(source, 'void this.logOSProxyConfigTelemetry(nativeHostMainService, telemetryService)');
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(source.includes('const activeWindowRouter = new StaticRouter(ctx => activeWindowManager.getActiveClientId().then(id => ctx === id));'));
		assert.ok(!source.includes('getActiveClientId().then(id => ctx === id).catch'));
		assert.ok(source.includes("getDelayedChannel(sharedProcessReady.then(client => client.getChannel('diagnostics')))"));
		assert.ok(!source.includes("sharedProcessReady.then(client => client.getChannel('diagnostics')).catch"));
		assert.ok(source.includes("getDelayedChannel(sharedProcessReady.then(client => client.getChannel('telemetryAppender')))"));
		assert.ok(!source.includes("sharedProcessReady.then(client => client.getChannel('telemetryAppender')).catch"));
		assert.ok(source.includes('remoteResourceChannel.value.call<NodeRemoteResourceResponse>(NODE_REMOTE_RESOURCE_IPC_METHOD_NAME, [url]).then('));
		assert.ok(!source.includes(`remoteResourceChannel.value.call<NodeRemoteResourceResponse>(NODE_REMOTE_RESOURCE_IPC_METHOD_NAME, [url]).then(${doubleCatch}`));
		assert.ok(source.includes("mainProcessElectronServer.registerChannel('policy', policyChannel);"));
		assert.ok(!source.includes("mainProcessElectronServer.registerChannel('policy', policyChannel).catch"));
		assert.ok(source.includes('mainProcessElectronServer.registerChannel(TerminalIpcChannels.LocalPty, ptyHostChannel);'));
		assert.ok(!source.includes('mainProcessElectronServer.registerChannel(TerminalIpcChannels.LocalPty, ptyHostChannel).catch'));
		assert.ok(source.includes('universeAgentSessionViewService.releaseLeasesOwnedBy(String(c.ctx));'));
		assert.ok(!source.includes('releaseLeasesOwnedBy(String(c.ctx)).catch'));
	});

	test('windowImpl onWindowError/kill/quit/jsCallStack and windowsMain/launch already dual-chained stay skipped; opener / D145 / Connect / Watch / Resolve / Pty stay skipped', () => {
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const windowsMain = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const launch = fs.readFileSync(resolveSource(LAUNCH_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const app = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		assert.ok(windowImpl.includes(`this.onWindowError(WindowError.UNRESPONSIVE)${doubleCatch}`));
		assert.ok(windowImpl.includes(`this.lifecycleMainService.kill(1)${doubleCatch}`));
		assert.ok(windowImpl.includes(`this.lifecycleMainService.quit()${doubleCatch}`));
		assert.ok(windowImpl.includes(`this.jsCallStackCollector.trigger(() => this.startCollectingJScallStacks())${doubleCatch}`));
		assert.ok(windowsMain.includes(`this.workspacesHistoryMainService.addRecentlyOpened(recents)${doubleCatch};`));
		assert.ok(windowsMain.includes(`this.lifecycleMainService.reload(existingWindow, openConfig.cli)${doubleCatch};`));
		assert.ok(launch.includes(`whenWindowReady.then(() => {
				for (const { uri, originalUrl } of urlsToOpen) {
					this.urlService.open(uri, { originalUrl });
				}
			})${doubleCatch};`));
		assert.ok(lifecycle.includes(`this.when(LifecycleMainPhase.Ready).then(() => this.registerListeners())${doubleCatch};`));
		assert.ok(windowImpl.includes('timeout(10000).then(() => false)'));
		assert.ok(!windowImpl.includes('timeout(10000).then(() => false).catch'));
		assert.ok(launch.includes(']).then(() => undefined, () => undefined);'));
		assert.ok(!launch.includes('].then(() => undefined, () => undefined).catch'));
		for (const source of [app, windowImpl, windowsMain, launch]) {
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

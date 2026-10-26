/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { errorHandler, isCancellationError, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore, IDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { OperatingSystem } from '../../../../../base/common/platform.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationScope, Extensions, IConfigurationNode, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { IWatchOptions } from '../../../../../platform/files/common/files.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IRemoteAgentEnvironment } from '../../../../../platform/remote/common/remoteAgentEnvironment.js';
import { UriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentityService.js';
import { TestRemoteAgentService } from '../../../../test/browser/workbenchTestServices.js';
import { IConfigurationCache } from '../../common/configuration.js';
import { RemoteUserConfiguration } from '../../browser/configuration.js';

suite('RemoteUserConfiguration', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	const settingsPath = URI.from({ scheme: 'vscode-remote', authority: 'test-remote', path: '/settings.json' });
	const setting = 'remoteUserConfiguration.contract';
	const localSetting = 'remoteUserConfiguration.local';
	const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	const configurationNode: IConfigurationNode = {
		id: 'remoteUserConfigurationContracts',
		properties: {
			[setting]: { type: 'string', scope: ConfigurationScope.MACHINE },
			[localSetting]: { type: 'string', scope: ConfigurationScope.APPLICATION },
		}
	};

	suiteSetup(() => registry.registerConfiguration(configurationNode));
	suiteTeardown(() => registry.deregisterConfigurations([configurationNode]));

	async function createFixture(cachedValue?: string) {
		const store = disposables.add(new DisposableStore());
		const logService = new NullLogService();
		const provider = store.add(new ConfigurationFileSystemProvider());
		const fileService = store.add(new ConfigurationFileService(logService));
		store.add(fileService.registerProvider(settingsPath.scheme, provider));
		const uriIdentityService = store.add(new UriIdentityService(fileService));
		await fileService.writeFile(settingsPath, VSBuffer.fromString(JSON.stringify({ [setting]: 'remote', [localSetting]: 'local' })));
		const cache: IConfigurationCache = {
			needsCaching: () => false,
			read: async () => cachedValue === undefined ? '' : JSON.stringify({ content: JSON.stringify({ [setting]: cachedValue }) }),
			write: async () => { },
			remove: async () => { },
		};
		const remoteAgentService = new ConfigurationRemoteAgentService();
		return {
			provider, fileService, remoteAgentService,
			createConfiguration: (readEnvironment: () => Promise<IRemoteAgentEnvironment | null>) => {
				remoteAgentService.readEnvironment = readEnvironment;
				return store.add(new RemoteUserConfiguration('test-remote', cache, fileService, uriIdentityService, remoteAgentService, logService));
			}
		};
	}

	for (const cachedValue of [undefined, 'cached']) {
		test(`first environment read permits startup with ${cachedValue === undefined ? 'empty' : 'populated'} cache`, async () => {
			const fixture = await createFixture(cachedValue);
			const environment = new DeferredPromise<IRemoteAgentEnvironment | null>();
			const configuration = fixture.createConfiguration(() => environment.p);
			const models = await Promise.all([configuration.initialize(), configuration.initialize(), configuration.reload()]);
			assert.deepStrictEqual([models.map(model => model.getValue(setting)), fixture.remoteAgentService.calls], [[cachedValue, cachedValue, cachedValue], 1]);
			const initialized = Event.toPromise(configuration.onDidInitialize);
			await environment.complete(createEnvironment(settingsPath));
			const model = await initialized;
			assert.deepStrictEqual([model.getValue(setting), model.getValue(localSetting)], ['remote', undefined]);
		});
	}

	test('initialize and reload wait once remote file initialization has started', async () => {
		const fixture = await createFixture('cached');
		const exists = new DeferredPromise<boolean>();
		const checkingExists = new DeferredPromise<void>();
		fixture.fileService.checkExists = () => {
			void checkingExists.complete();
			return exists.p;
		};
		const configuration = fixture.createConfiguration(async () => createEnvironment(settingsPath));
		await checkingExists.p;
		let settled = 0;
		let events = 0;
		disposables.add(configuration.onDidInitialize(() => events++));
		disposables.add(configuration.onDidChangeConfiguration(() => events++));
		const first = configuration.initialize().then(model => { settled++; return model; });
		const second = configuration.reload().then(model => { settled++; return model; });
		await Promise.resolve();
		assert.deepStrictEqual([settled, events], [0, 0]);
		await exists.complete(true);
		assert.deepStrictEqual([(await first).getValue(setting), (await second).getValue(setting), settled], ['remote', 'remote', 2]);
	});

	test('first background rejection is reported once and observed before the next attempt', async () => withReportedRemoteErrors(async (reports, reported) => {
		const fixture = await createFixture();
		const error = new Error('remote environment unavailable');
		const configuration = fixture.createConfiguration(async () => { throw error; });
		await reported.p;
		assert.deepStrictEqual(await rejected(configuration.initialize()), { error });
		assert.strictEqual(fixture.remoteAgentService.calls, 1);
		assert.deepStrictEqual(await rejected(configuration.initialize()), { error });
		assert.deepStrictEqual([fixture.remoteAgentService.calls, reports], [2, [error]]);
	}));

	test('a synchronous environment throw is observed once and reload can recover', async () => withReportedRemoteErrors(async (reports, reported) => {
		const fixture = await createFixture();
		const error = new Error('synchronous environment failure');
		const configuration = fixture.createConfiguration(() => {
			if (fixture.remoteAgentService.calls === 1) {
				throw error;
			}
			return Promise.resolve(createEnvironment(settingsPath));
		});
		await reported.p;
		assert.deepStrictEqual(await rejected(configuration.initialize()), { error });
		assert.deepStrictEqual([(await configuration.reload()).getValue(setting), fixture.remoteAgentService.calls, reports], ['remote', 2, [error]]);
	}));

	for (const methods of [['initialize', 'initialize'], ['initialize', 'reload'], ['reload', 'reload']] as const) {
		test(`${methods.join(' + ')} share a successful explicit retry`, async () => withReportedRemoteErrors(async (_reports, reported) => {
			const fixture = await createFixture('cached');
			const error = new Error('initial connection unavailable');
			const retry = new DeferredPromise<IRemoteAgentEnvironment | null>();
			const configuration = fixture.createConfiguration(() => fixture.remoteAgentService.calls === 1 ? Promise.reject(error) : retry.p);
			await reported.p;
			await rejected(configuration.initialize());
			let initialized = 0;
			disposables.add(configuration.onDidInitialize(() => initialized++));
			const first = configuration[methods[0]]();
			const second = configuration[methods[1]]();
			await retry.complete(createEnvironment(settingsPath));
			assert.deepStrictEqual([(await first).getValue(setting), (await second).getValue(setting), fixture.remoteAgentService.calls, initialized], ['remote', 'remote', 2, 1]);
			await configuration.initialize();
			await configuration.initialize();
			assert.strictEqual(fixture.remoteAgentService.calls, 2);
		}));

		test(`${methods.join(' + ')} share the original explicit retry rejection`, async () => withReportedRemoteErrors(async (reports, reported) => {
			const fixture = await createFixture('cached');
			const initialError = new Error('initial connection unavailable');
			const retryError = new Error('retry connection unavailable');
			const retry = new DeferredPromise<IRemoteAgentEnvironment | null>();
			const configuration = fixture.createConfiguration(() => fixture.remoteAgentService.calls === 1 ? Promise.reject(initialError) : retry.p);
			await reported.p;
			await rejected(configuration.initialize());
			const first = rejected(configuration[methods[0]]());
			const second = rejected(configuration[methods[1]]());
			await retry.error(retryError);
			assert.deepStrictEqual([await first, await second, fixture.remoteAgentService.calls, reports], [{ error: retryError }, { error: retryError }, 2, [initialError]]);
		}));
	}

	for (const error of [undefined, null]) {
		test(`preserves ${String(error)} as an initial and shared retry rejection`, async () => withReportedRemoteErrors(async (reports, reported) => {
			const fixture = await createFixture('cached');
			const retry = new DeferredPromise<IRemoteAgentEnvironment | null>();
			const configuration = fixture.createConfiguration(() => fixture.remoteAgentService.calls === 1 ? Promise.reject(error) : retry.p);
			await reported.p;
			const observed = rejected(configuration.initialize());
			if (fixture.remoteAgentService.calls !== 1) {
				// Settle an incorrectly started retry so the old implementation fails by behavior, not timeout.
				await retry.error(error);
			}
			assert.deepStrictEqual([await observed, fixture.remoteAgentService.calls], [{ error }, 1]);
			const first = rejected(configuration.initialize());
			const second = rejected(configuration.reload());
			await retry.error(error);
			assert.deepStrictEqual([await first, await second, reports], [{ error }, { error }, [error]]);
		}));
	}

	test('a delayed old waiter cannot clear or consume a newer attempt failure', async () => withReportedRemoteErrors(async (_reports, reported) => {
		const fixture = await createFixture();
		const firstError = new Error('initial failure');
		const oldError = new Error('old retry failure');
		const newError = new Error('new retry failure');
		const oldAttempt = new DeferredPromise<IRemoteAgentEnvironment | null>();
		const newAttempt = new DeferredPromise<IRemoteAgentEnvironment | null>();
		const releaseOldWaiter = new DeferredPromise<void>();
		const configuration = fixture.createConfiguration(() => {
			switch (fixture.remoteAgentService.calls) {
				case 1: return Promise.reject(firstError);
				case 2: return oldAttempt.p;
				case 3: return newAttempt.p;
				default: return Promise.resolve(createEnvironment(settingsPath));
			}
		});
		await reported.p;
		await rejected(configuration.initialize());
		const first = rejected(configuration.initialize());
		const delayed = configuration.initialize().then(() => new Error('old waiter must reject'), async error => {
			await releaseOldWaiter.p;
			return error;
		});
		await oldAttempt.error(oldError);
		assert.deepStrictEqual(await first, { error: oldError });
		const next = rejected(configuration.reload());
		await releaseOldWaiter.complete();
		assert.strictEqual(await delayed, oldError);
		const sharedNext = rejected(configuration.initialize());
		await newAttempt.error(newError);
		assert.deepStrictEqual([await next, await sharedNext, fixture.remoteAgentService.calls], [{ error: newError }, { error: newError }, 3]);
		assert.strictEqual((await configuration.reload()).getValue(setting), 'remote');
	}));

	test('reload recovers file initialization failure and reads subsequent remote content', async () => withReportedRemoteErrors(async (reports, reported) => {
		const fixture = await createFixture('cached');
		const error = new Error('remote file initialization unavailable');
		fixture.fileService.checkExists = async () => { throw error; };
		const configuration = fixture.createConfiguration(async () => createEnvironment(settingsPath));
		await reported.p;
		assert.deepStrictEqual(await rejected(configuration.initialize()), { error });
		fixture.fileService.checkExists = undefined;
		let initialized = 0;
		disposables.add(configuration.onDidInitialize(() => initialized++));
		assert.strictEqual((await configuration.reload()).getValue(setting), 'remote');
		await fixture.provider.firstWatch.p;
		assert.deepStrictEqual([fixture.remoteAgentService.calls, fixture.provider.activeWatches, initialized, reports], [2, 1, 1, [error]]);
		await fixture.fileService.writeFile(settingsPath, VSBuffer.fromString(JSON.stringify({ [setting]: 'updated' })));
		assert.strictEqual((await configuration.reload()).getValue(setting), 'updated');
	}));

	for (const phase of ['environment', 'file'] as const) {
		for (const rejects of [false, true]) {
			test(`dispose while ${phase} is pending handles late ${rejects ? 'rejection' : 'success'} without publishing`, async () => withReportedRemoteErrors(async (reports, reported) => {
				const fixture = await createFixture();
				const initialError = new Error('initial failure');
				const lateError = new Error('late dependency failure');
				const environment = new DeferredPromise<IRemoteAgentEnvironment | null>();
				const exists = new DeferredPromise<boolean>();
				const checkingExists = new DeferredPromise<void>();
				const configuration = fixture.createConfiguration(() => fixture.remoteAgentService.calls === 1 ? Promise.reject(initialError) : environment.p);
				await reported.p;
				await rejected(configuration.initialize());
				let events = 0;
				disposables.add(configuration.onDidInitialize(() => events++));
				disposables.add(configuration.onDidChangeConfiguration(() => events++));
				if (phase === 'file') {
					fixture.fileService.checkExists = () => { void checkingExists.complete(); return exists.p; };
				}
				const waiting = rejected(configuration.reload());
				assert.strictEqual(fixture.remoteAgentService.calls, 2, 'reload must start the explicit retry');
				if (phase === 'file') {
					await environment.complete(createEnvironment(settingsPath));
					await checkingExists.p;
				}
				configuration.dispose();
				if (phase === 'environment') {
					await (rejects ? environment.error(lateError) : environment.complete(createEnvironment(settingsPath)));
				} else {
					await (rejects ? exists.error(lateError) : exists.complete(true));
				}
				const result = await waiting;
				assert.ok(rejects ? result.error === lateError : isCancellationError(result.error));
				assert.ok(isCancellationError((await rejected(configuration.initialize())).error));
				assert.ok(isCancellationError((await rejected(configuration.reload())).error));
				assert.deepStrictEqual([events, fixture.provider.watchCalls, fixture.provider.activeWatches, fixture.remoteAgentService.calls, reports], [0, 0, 0, 2, [initialError]]);
			}));
		}
	}

	test('disposed initial background work neither publishes nor reports its late rejection', async () => withReportedRemoteErrors(async reports => {
		const fixture = await createFixture();
		const environment = new DeferredPromise<IRemoteAgentEnvironment | null>();
		const configuration = fixture.createConfiguration(() => environment.p);
		await configuration.initialize();
		configuration.dispose();
		await environment.error(new Error('late initial failure'));
		await rejected(configuration.reload());
		assert.deepStrictEqual([reports, fixture.provider.watchCalls], [[], 0]);
	}));

	test('a missing environment remains a cached terminal result', async () => {
		const fixture = await createFixture('cached');
		const configuration = fixture.createConfiguration(async () => null);
		const first = await configuration.initialize();
		const second = await configuration.reload();
		const third = await configuration.initialize();
		assert.deepStrictEqual([first.getValue(setting), second.getValue(setting), third.getValue(setting), fixture.remoteAgentService.calls], ['cached', 'cached', 'cached', 1]);
	});
});

class ConfigurationRemoteAgentService extends TestRemoteAgentService {
	calls = 0;
	readEnvironment: () => Promise<IRemoteAgentEnvironment | null> = async () => null;

	override getEnvironment(): Promise<IRemoteAgentEnvironment | null> {
		this.calls++;
		return this.readEnvironment();
	}
}

class ConfigurationFileService extends FileService {
	checkExists: (() => Promise<boolean>) | undefined;

	override exists(resource: URI): Promise<boolean> {
		return this.checkExists ? this.checkExists() : super.exists(resource);
	}
}

class ConfigurationFileSystemProvider extends InMemoryFileSystemProvider {
	readonly firstWatch = new DeferredPromise<void>();
	watchCalls = 0;
	activeWatches = 0;

	override watch(_resource: URI, _options: IWatchOptions): IDisposable {
		this.watchCalls++;
		this.activeWatches++;
		if (!this.firstWatch.isSettled) {
			void this.firstWatch.complete();
		}
		return toDisposable(() => this.activeWatches--);
	}
}

function createEnvironment(settingsPath: URI): IRemoteAgentEnvironment {
	const home = settingsPath.with({ path: '/' });
	return {
		pid: 1, connectionToken: '', appRoot: home, execPath: '', tmpDir: home, settingsPath,
		mcpResource: home, logsPath: home, extensionHostLogsPath: home, globalStorageHome: home,
		workspaceStorageHome: home, localHistoryHome: home, userHome: home, os: OperatingSystem.Linux,
		arch: 'x64', marks: [], useHostProxy: false, profiles: { all: [], home }, isUnsupportedGlibc: false,
	};
}

async function rejected(promise: Promise<object>): Promise<{ readonly error: unknown }> {
	return promise.then(() => ({ error: new Error('expected rejection') }), error => ({ error }));
}

async function withReportedRemoteErrors(run: (reports: unknown[], reported: DeferredPromise<void>) => Promise<void>): Promise<void> {
	const original = errorHandler.getUnexpectedErrorHandler();
	const reports: unknown[] = [];
	const reported = new DeferredPromise<void>();
	setUnexpectedErrorHandler(error => {
		reports.push(error);
		if (!reported.isSettled) {
			void reported.complete();
		}
	});
	try {
		await run(reports, reported);
	} finally {
		setUnexpectedErrorHandler(original);
	}
}

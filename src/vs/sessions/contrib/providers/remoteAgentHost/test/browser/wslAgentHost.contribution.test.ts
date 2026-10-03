/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../../base/common/async.js';
import { CancellationError, errorHandler, setUnexpectedErrorHandler } from '../../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../../base/common/observable.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IAgentConnection } from '../../../../../../platform/agentHost/common/agentService.js';
import { IRemoteAgentHostConnectionInfo, IRemoteAgentHostService, RemoteAgentHostAutoConnectSettingId, RemoteAgentHostConnectionStatus, RemoteAgentHostsEnabledSettingId } from '../../../../../../platform/agentHost/common/remoteAgentHostService.js';
import { IWSLCachedDistro, IWSLRemoteAgentHostService, WSL_ADDRESS_PREFIX } from '../../../../../../platform/agentHost/common/wslRemoteAgentHost.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../../platform/notification/common/notification.js';
import { ISessionsProvidersService } from '../../../../../services/sessions/browser/sessionsProvidersService.js';
import { RemoteAgentHostSessionsProvider } from '../../browser/remoteAgentHostSessionsProvider.js';
import { WSLAgentHostContribution, shouldPauseWSLReconnectAfterFailure } from '../../browser/wslAgentHost.contribution.js';

suite('shouldPauseWSLReconnectAfterFailure', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('pauses reconnect after cancellation but not after regular failures', () => {
		assert.deepStrictEqual({
			cancellation: shouldPauseWSLReconnectAfterFailure(new CancellationError()),
			regularError: shouldPauseWSLReconnectAfterFailure(new Error('boom')),
		}, {
			cancellation: true,
			regularError: false,
		});
	});
});

suite('WSLAgentHostContribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not leak unhandled rejection when scheduled WSL reconnect rejects and log error throws', async () => {
		// `_attemptManagedReconnect` already catches `reconnect`; a lone inner reject
		// does not leak. The scheduleRetry void site still needs `.catch` when `logService.error` throws.
		const distro = 'Ubuntu';
		const name = 'Ubuntu';
		const address = `${WSL_ADDRESS_PREFIX}${distro}`;
		let cached: readonly IWSLCachedDistro[] = [];
		let reconnectCalls = 0;
		let errorCalls = 0;
		let throwOnLogError = false;
		const configurationService = new TestConfigurationService({
			[RemoteAgentHostsEnabledSettingId]: true,
			[RemoteAgentHostAutoConnectSettingId]: true,
		});
		store.add(toDisposable(() => configurationService.onDidChangeConfigurationEmitter.dispose()));
		const logService = new class extends NullLogService {
			override error(message: string | Error): void {
				if (typeof message === 'string' && message.includes('WSL reconnect failed')) {
					errorCalls++;
					if (throwOnLogError) {
						throw new Error('error failed');
					}
				}
			}
		}();
		const contribution = store.add(new WSLAgentHostContribution(
			new class extends mock<IRemoteAgentHostService>() {
				override readonly onDidChangeConnections = Event.None;
				override readonly connections = [];
			}(),
			new class extends mock<IWSLRemoteAgentHostService>() {
				override readonly onDidReportConnectProgress = Event.None;
				override getCachedDistros(): readonly IWSLCachedDistro[] { return cached; }
				override listRunningDistros(): Promise<string[]> { return Promise.resolve([distro]); }
				override reconnect(): Promise<never> {
					reconnectCalls++;
					return Promise.reject(new Error('boom'));
				}
			}(),
			configurationService as IConfigurationService,
			logService,
			store.add(new TestInstantiationService()),
			new class extends mock<ISessionsProvidersService>() { }(),
			new class extends mock<INotificationService>() { }(),
		));
		cached = [{ distro, name }];

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
		try {
			// Seed the production scheduleRetry void site via a real failed attempt.
			// no-as-any: private reconnect entry is the only way off the `isWindows` poll gate.
			await (contribution as unknown as {
				_attemptWSLReconnect(d: string, n: string, a: string): Promise<void>;
			})._attemptWSLReconnect(distro, name, address);
			assert.deepStrictEqual({ reconnectCalls, errorCalls, unhandledRejections }, {
				reconnectCalls: 1,
				errorCalls: 1,
				unhandledRejections: [],
			});
			throwOnLogError = true;
			await timeout(1500);
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, reconnectCalls, errorCalls }, {
				unhandledRejections: [],
				reconnectCalls: 2,
				errorCalls: 2,
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('clears the WSL provider connection only after a connected transport disconnects', () => {
		const distro = 'Ubuntu';
		const name = 'Ubuntu';
		const address = `${WSL_ADDRESS_PREFIX}${distro}`;
		let cached: readonly IWSLCachedDistro[] = [];
		const configurationService = new TestConfigurationService({
			[RemoteAgentHostsEnabledSettingId]: true,
			[RemoteAgentHostAutoConnectSettingId]: true,
		});
		store.add(toDisposable(() => configurationService.onDidChangeConfigurationEmitter.dispose()));
		const remote = store.add(new StubRemoteAgentHostService());
		const contribution = store.add(new TestWSLAgentHostContribution(
			remote as unknown as IRemoteAgentHostService,
			new class extends mock<IWSLRemoteAgentHostService>() {
				override readonly onDidReportConnectProgress = Event.None;
				override getCachedDistros(): readonly IWSLCachedDistro[] { return cached; }
				override listRunningDistros(): Promise<string[]> { return Promise.resolve([]); }
			}(),
			configurationService as IConfigurationService,
			new NullLogService(),
			store.add(new TestInstantiationService()),
			new class extends mock<ISessionsProvidersService>() {
				override registerProvider(): { dispose(): void } {
					return toDisposable(() => { /* registration only */ });
				}
			}(),
			new class extends mock<INotificationService>() { }(),
		));
		cached = [{ distro, name }];
		const connection = {} as IAgentConnection;
		remote.addConnection({
			address,
			name,
			clientId: 'client',
			defaultDirectory: '/home/ubuntu',
			status: RemoteAgentHostConnectionStatus.connected,
		}, connection);
		const provider = contribution.stubProviders.get(address);
		assert.ok(provider, 'provider should be created for the cached distro');

		const whileConnected = provider!.clearConnectionCalls.length;
		const wiredWhileConnected = provider!.setConnectionCalls.length;
		remote.setConnectionStatus(address, RemoteAgentHostConnectionStatus.reconnecting);
		const whileReconnecting = {
			cleared: provider!.clearConnectionCalls.length,
			wired: provider!.setConnectionCalls.length,
		};
		remote.setConnectionStatus(address, RemoteAgentHostConnectionStatus.connected);
		remote.setConnectionStatus(address, RemoteAgentHostConnectionStatus.connecting);
		const whileConnecting = provider!.clearConnectionCalls.length;
		remote.setConnectionStatus(address, RemoteAgentHostConnectionStatus.disconnected);
		const afterDisconnect = provider!.clearConnectionCalls.length;
		remote.fireConnectionChange();
		const afterRepeatDisconnect = provider!.clearConnectionCalls.length;

		// A transport that drops via an intermediate `connecting` state must
		// still clear: the wired-provider bookkeeping has to survive statuses
		// that are neither connected nor disconnected.
		remote.setConnectionStatus(address, RemoteAgentHostConnectionStatus.connected);
		remote.setConnectionStatus(address, RemoteAgentHostConnectionStatus.connecting);
		remote.setConnectionStatus(address, RemoteAgentHostConnectionStatus.disconnected);

		assert.deepStrictEqual(
			{
				firstWire: provider!.setConnectionCalls[0],
				sameConnection: provider!.setConnectionCalls.every(call => call.connection === connection && call.defaultDirectory === '/home/ubuntu'),
				whileConnected,
				wiredWhileConnected,
				whileReconnecting,
				whileConnecting,
				afterDisconnect,
				afterRepeatDisconnect,
				afterConnectingDisconnect: provider!.clearConnectionCalls.length,
			},
			{
				firstWire: { connection, defaultDirectory: '/home/ubuntu' },
				sameConnection: true,
				whileConnected: 0,
				wiredWhileConnected: 1,
				whileReconnecting: { cleared: 0, wired: 1 },
				whileConnecting: 0,
				afterDisconnect: 1,
				afterRepeatDisconnect: 1,
				afterConnectingDisconnect: 2,
			},
		);
	});
});

class StubProvider extends mock<RemoteAgentHostSessionsProvider>() {
	readonly setConnectionCalls: Array<{ connection: IAgentConnection; defaultDirectory: string | undefined }> = [];
	readonly clearConnectionCalls: undefined[] = [];

	override readonly id: string;
	override readonly remoteAddress: string;
	override readonly label: string;

	private readonly _status = observableValue<RemoteAgentHostConnectionStatus>('status', RemoteAgentHostConnectionStatus.disconnected);
	override readonly connectionStatus = this._status;

	constructor(address: string, name: string) {
		super();
		this.id = `agenthost-${address}`;
		this.remoteAddress = address;
		this.label = name;
	}

	override setConnectionStatus(status: RemoteAgentHostConnectionStatus): void {
		this._status.set(status, undefined);
	}

	override setConnection(connection: IAgentConnection, defaultDirectory?: string): void {
		this.setConnectionCalls.push({ connection, defaultDirectory });
	}

	override clearConnection(): void { this.clearConnectionCalls.push(undefined); }
	override dispose(): void { /* noop */ }
}

class StubRemoteAgentHostService extends Disposable implements Partial<IRemoteAgentHostService> {
	private readonly _onDidChangeConnections = this._register(new Emitter<void>());
	readonly onDidChangeConnections = this._onDidChangeConnections.event;

	private readonly _connections: IRemoteAgentHostConnectionInfo[] = [];
	private readonly _agentConnections = new Map<string, IAgentConnection>();

	get connections(): readonly IRemoteAgentHostConnectionInfo[] { return this._connections; }

	getConnection(address: string): IAgentConnection | undefined {
		const info = this._connections.find(connection => connection.address === address);
		return info && RemoteAgentHostConnectionStatus.isConnected(info.status) ? this._agentConnections.get(address) : undefined;
	}

	addConnection(info: IRemoteAgentHostConnectionInfo, connection: IAgentConnection): void {
		this._connections.push(info);
		this._agentConnections.set(info.address, connection);
		this._onDidChangeConnections.fire();
	}

	setConnectionStatus(address: string, status: RemoteAgentHostConnectionStatus): void {
		const index = this._connections.findIndex(connection => connection.address === address);
		if (index >= 0) {
			this._connections[index] = { ...this._connections[index], status };
			this._onDidChangeConnections.fire();
		}
	}

	fireConnectionChange(): void {
		this._onDidChangeConnections.fire();
	}
}

class TestWSLAgentHostContribution extends WSLAgentHostContribution {
	readonly stubProviders = new Map<string, StubProvider>();

	protected override _createProvider(address: string, name: string, _options: { readonly connectOnDemand?: () => Promise<void> }): RemoteAgentHostSessionsProvider {
		const stub = new StubProvider(address, name);
		const provider = stub as unknown as RemoteAgentHostSessionsProvider;
		this.stubProviders.set(address, stub);
		const store = new DisposableStore();
		store.add(toDisposable(() => stub.dispose()));
		store.add(this._sessionsProvidersService.registerProvider(provider));
		this._providerInstances.set(address, provider);
		store.add(toDisposable(() => this._providerInstances.delete(address)));
		this._providerStores.set(address, store);
		return provider;
	}
}

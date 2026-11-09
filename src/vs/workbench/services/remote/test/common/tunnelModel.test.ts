/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { runWithFakedTimers } from '../../../../../base/test/common/virtualScheduling/index.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IAddressProvider } from '../../../../../platform/remote/common/remoteAgentConnection.js';
import { IRemoteAuthorityResolverService } from '../../../../../platform/remote/common/remoteAuthorityResolver.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { AbstractTunnelService, ITunnelProvider, ITunnelService, RemoteTunnel, isTunnelProvider } from '../../../../../platform/tunnel/common/tunnel.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { TestContextService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IWorkbenchEnvironmentService } from '../../../environment/common/environmentService.js';
import { IExtensionService, NullExtensionService } from '../../../extensions/common/extensions.js';
import { TunnelModel } from '../../common/tunnelModel.js';

suite('TunnelModel overlapping forwards', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	class TestTunnelService extends AbstractTunnelService {
		creates = 0;
		starter: () => Promise<RemoteTunnel | string | undefined> = () => Promise.resolve(undefined);

		private readonly _onDidRequestTunnel = this._register(new Emitter<void>());
		readonly onDidRequestTunnel = this._onDidRequestTunnel.event;

		private readonly _onDidCloseForTest = this._register(new Emitter<{ host: string; port: number }>());

		constructor() {
			super(new NullLogService(), new TestConfigurationService());
			this.onTunnelClosed = Event.any(this.onTunnelClosed, this._onDidCloseForTest.event);
		}

		fireTunnelClosed(host: string, port: number): void {
			this._onDidCloseForTest.fire({ host, port });
		}

		isPortPrivileged(): boolean {
			return false;
		}

		protected override retainOrCreateTunnel(addressOrTunnelProvider: IAddressProvider | ITunnelProvider, remoteHost: string, remotePort: number): Promise<RemoteTunnel | string | undefined> | undefined {
			this._onDidRequestTunnel.fire();
			const existing = this.getTunnelFromMap(remoteHost, remotePort);
			if (existing) {
				++existing.refcount;
				return existing.value;
			}
			this.creates++;
			if (isTunnelProvider(addressOrTunnelProvider)) {
				return this.createWithProvider(addressOrTunnelProvider, remoteHost, remotePort, undefined, false);
			}
			const tunnel = this.starter();
			this.addTunnelToMap(remoteHost, remotePort, tunnel);
			return tunnel;
		}
	}

	function fakeTunnel(port: number, host = 'localhost'): RemoteTunnel & { disposals: number } {
		return {
			tunnelRemoteHost: host,
			tunnelRemotePort: port,
			localAddress: `127.0.0.1:${port}`,
			privacy: 'private',
			protocol: 'http',
			disposals: 0,
			async dispose() { this.disposals++; },
		};
	}

	function createModel(tunnelService: TestTunnelService, remoteAuthority?: string): TunnelModel {
		const instantiationService = disposables.add(new TestInstantiationService());
		instantiationService.stub(ITunnelService, tunnelService);
		instantiationService.stub(IStorageService, disposables.add(new TestStorageService()));
		instantiationService.stub(IConfigurationService, new TestConfigurationService({ remote: { restoreForwardedPorts: false } }));
		instantiationService.stub(IWorkbenchEnvironmentService, remoteAuthority ? { remoteAuthority } : {});
		instantiationService.stub(IRemoteAuthorityResolverService, {});
		instantiationService.stub(IWorkspaceContextService, new TestContextService());
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IDialogService, new TestDialogService());
		instantiationService.stub(IExtensionService, new NullExtensionService());
		instantiationService.stub(IContextKeyService, new MockContextKeyService());
		return disposables.add(instantiationService.createInstance(TunnelModel));
	}

	test('two overlapping forwards of one port without a provider keep the shared tunnel', () => runWithFakedTimers({}, async () => {
		const tunnelService = new TestTunnelService();
		try {
			const attempt = new DeferredPromise<RemoteTunnel>();
			const tunnel = fakeTunnel(3000);
			tunnelService.starter = () => attempt.p;
			const model = createModel(tunnelService, 'test-authority');
			await model.restoreForwarded();
			const closedPorts: number[] = [];
			disposables.add(model.onClosePort(address => closedPorts.push(address.port)));

			const firstRequested = Event.toPromise(tunnelService.onDidRequestTunnel);
			const first = model.forward({ remote: { host: 'localhost', port: 3000 } });
			await firstRequested;
			const secondRequested = Event.toPromise(tunnelService.onDidRequestTunnel);
			const second = model.forward({ remote: { host: 'localhost', port: 3000 } });
			await secondRequested;

			await attempt.complete(tunnel);
			const [firstResult, secondResult] = await Promise.all([first, second]);

			assert.ok(firstResult && typeof firstResult !== 'string');
			assert.ok(secondResult && typeof secondResult !== 'string');
			assert.deepStrictEqual({ forwarded: model.forwarded.has('localhost:3000'), disposals: tunnel.disposals, closedPorts, creates: tunnelService.creates }, { forwarded: true, disposals: 0, closedPorts: [], creates: 1 });
		} finally {
			await tunnelService.dispose();
		}
	}));

	test('two overlapping forwards of one port with a provider keep the first forward', () => runWithFakedTimers({}, async () => {
		const tunnelService = new TestTunnelService();
		try {
			const attempt = new DeferredPromise<RemoteTunnel>();
			const tunnel = fakeTunnel(3000);
			let forwardPortCalls = 0;
			const provider = tunnelService.setTunnelProvider({
				forwardPort: () => {
					forwardPortCalls++;
					return attempt.p;
				}
			});
			try {
				const model = createModel(tunnelService);

				const firstRequested = Event.toPromise(tunnelService.onDidRequestTunnel);
				const first = model.forward({ remote: { host: 'localhost', port: 3000 } });
				await firstRequested;
				// While the provider factory is pending the platform answers a second open with `undefined`.
				const secondResult = await model.forward({ remote: { host: 'localhost', port: 3000 } });

				await attempt.complete(tunnel);
				const firstResult = await first;

				assert.ok(firstResult && typeof firstResult !== 'string');
				assert.deepStrictEqual({ secondResult, forwardPortCalls, forwarded: model.forwarded.has('localhost:3000'), disposals: tunnel.disposals }, { secondResult: undefined, forwardPortCalls: 1, forwarded: true, disposals: 0 });
			} finally {
				provider.dispose();
			}
		} finally {
			await tunnelService.dispose();
		}
	}));

	test('a close of the port while a forward waits still drops that forward', () => runWithFakedTimers({}, async () => {
		const tunnelService = new TestTunnelService();
		try {
			const attempt = new DeferredPromise<RemoteTunnel>();
			const tunnel = fakeTunnel(3000);
			tunnelService.starter = () => attempt.p;
			const model = createModel(tunnelService, 'test-authority');
			await model.restoreForwarded();

			const requested = Event.toPromise(tunnelService.onDidRequestTunnel);
			const forward = model.forward({ remote: { host: 'localhost', port: 3000 } });
			await requested;
			tunnelService.fireTunnelClosed('localhost', 3000);
			await attempt.complete(tunnel);

			assert.deepStrictEqual({ result: await forward, forwarded: model.forwarded.has('localhost:3000'), disposals: tunnel.disposals }, { result: undefined, forwarded: false, disposals: 1 });
		} finally {
			await tunnelService.dispose();
		}
	}));

	test('a stale forward releases only its own reference to a tunnel that a later forward shares', () => runWithFakedTimers({}, async () => {
		const tunnelService = new TestTunnelService();
		try {
			const attempt = new DeferredPromise<RemoteTunnel>();
			const tunnel = fakeTunnel(3000);
			tunnelService.starter = () => attempt.p;
			const model = createModel(tunnelService, 'test-authority');
			await model.restoreForwarded();

			const firstRequested = Event.toPromise(tunnelService.onDidRequestTunnel);
			const first = model.forward({ remote: { host: 'localhost', port: 3000 } });
			await firstRequested;
			tunnelService.fireTunnelClosed('localhost', 3000);
			const secondRequested = Event.toPromise(tunnelService.onDidRequestTunnel);
			const second = model.forward({ remote: { host: 'localhost', port: 3000 } });
			await secondRequested;

			await attempt.complete(tunnel);
			const [firstResult, secondResult] = await Promise.all([first, second]);

			assert.strictEqual(firstResult, undefined);
			assert.ok(secondResult && typeof secondResult !== 'string');
			assert.deepStrictEqual({ forwarded: model.forwarded.has('localhost:3000'), disposals: tunnel.disposals, creates: tunnelService.creates }, { forwarded: true, disposals: 0, creates: 1 });
		} finally {
			await tunnelService.dispose();
		}
	}));
});

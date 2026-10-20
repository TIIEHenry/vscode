/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../configuration/common/configuration.js';
import { ILogService } from '../../../log/common/log.js';
import { IAddressProvider } from '../../../remote/common/remoteAgentConnection.js';
import { AbstractTunnelService, ITunnelProvider, RemoteTunnel } from '../../common/tunnel.js';

suite('Tunnel open retry', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const address = {} as IAddressProvider;

	class RetryTunnelService extends AbstractTunnelService {
		creates = 0;
		starter: () => Promise<RemoteTunnel | string | undefined> = () => Promise.resolve(undefined);

		constructor() {
			super({
				onDidChangeLogLevel: Event.None,
				getLevel: () => 0,
				setLevel: () => { },
				trace: () => { },
				debug: () => { },
				info: () => { },
				warn: () => { },
				error: () => { },
				critical: () => { },
				flush: () => { },
				dispose: () => { },
			} as ILogService, { getValue: () => undefined } as IConfigurationService);
		}

		isPortPrivileged(): boolean {
			return false;
		}

		protected override retainOrCreateTunnel(_addressOrTunnelProvider: IAddressProvider | ITunnelProvider, remoteHost: string, remotePort: number): Promise<RemoteTunnel | string | undefined> | undefined {
			const existing = this.getTunnelFromMap(remoteHost, remotePort);
			if (existing) {
				++existing.refcount;
				return existing.value;
			}
			this.creates++;
			const tunnel = this.starter();
			this.addTunnelToMap(remoteHost, remotePort, tunnel);
			return tunnel;
		}

		replace(remoteHost: string, remotePort: number, tunnel: Promise<RemoteTunnel | string | undefined>): void {
			this.addTunnelToMap(remoteHost, remotePort, tunnel);
		}
	}

	function fakeTunnel(port: number): RemoteTunnel {
		return {
			tunnelRemoteHost: 'localhost',
			tunnelRemotePort: port,
			localAddress: `127.0.0.1:${port}`,
			privacy: 'private',
			protocol: 'http',
			dispose: () => Promise.resolve(),
		};
	}

	async function withService(run: (service: RetryTunnelService) => Promise<void>): Promise<void> {
		const service = new RetryTunnelService();
		try {
			await run(service);
		} finally {
			await service.dispose();
		}
	}

	test('opens again after the cached promise rejects', async () => {
		await withService(async service => {
			const error = new Error('tunnel failed');
			let calls = 0;
			service.starter = () => {
				calls++;
				if (calls === 1) {
					return Promise.reject(error);
				}
				return Promise.resolve(fakeTunnel(9));
			};

			const first = service.openTunnel(address, 'localhost', 9);
			assert.ok(first);
			await assert.rejects(first, (reason: unknown) => reason === error);
			assert.strictEqual(service.creates, 1);

			const second = service.openTunnel(address, 'localhost', 9);
			assert.ok(second);
			assert.notStrictEqual(second, first);
			const opened = await second;
			assert.strictEqual(typeof opened === 'string' ? undefined : opened?.tunnelRemotePort, 9);
			assert.strictEqual(service.creates, 2);

			const third = service.openTunnel(address, 'localhost', 9);
			assert.ok(third);
			await third;
			assert.strictEqual(service.creates, 2);
			assert.strictEqual(calls, 2);
		});
	});

	test('shares one open while it is in flight and keeps a fulfilled tunnel', async () => {
		await withService(async service => {
			let resolveTunnel!: (tunnel: RemoteTunnel) => void;
			service.starter = () => new Promise(resolve => { resolveTunnel = resolve; });

			const first = service.openTunnel(address, 'localhost', 9);
			const second = service.openTunnel(address, 'localhost', 9);
			assert.ok(first);
			assert.ok(second);
			assert.strictEqual(service.creates, 1);

			resolveTunnel(fakeTunnel(9));
			const openedFirst = await first;
			const openedSecond = await second;
			assert.strictEqual(typeof openedFirst === 'string' ? undefined : openedFirst?.tunnelRemotePort, 9);
			assert.strictEqual(typeof openedSecond === 'string' ? undefined : openedSecond?.tunnelRemotePort, 9);

			const third = service.openTunnel(address, 'localhost', 9);
			assert.ok(third);
			await third;
			assert.strictEqual(service.creates, 1);
		});
	});

	test('a rejection drops the slot only while it still points at that attempt', async () => {
		await withService(async service => {
			let rejectAttempt!: (error: Error) => void;
			service.starter = () => new Promise((_resolve, reject) => { rejectAttempt = reject; });

			const first = service.openTunnel(address, 'localhost', 9);
			assert.ok(first);
			const replacement = Promise.resolve(fakeTunnel(9));
			service.replace('localhost', 9, replacement);

			const error = new Error('late failure');
			rejectAttempt(error);
			await assert.rejects(first, (reason: unknown) => reason === error);

			const second = service.openTunnel(address, 'localhost', 9);
			assert.ok(second);
			const opened = await second;
			assert.strictEqual(typeof opened === 'string' ? undefined : opened?.tunnelRemotePort, 9);
			assert.strictEqual(service.creates, 1);
		});
	});
});

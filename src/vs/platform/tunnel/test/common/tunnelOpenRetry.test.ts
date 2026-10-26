/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { DeferredPromise } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../configuration/test/common/testConfigurationService.js';
import { NullLogService } from '../../../log/common/log.js';
import { IAddressProvider } from '../../../remote/common/remoteAgentConnection.js';
import { AbstractTunnelService, isTunnelProvider, ITunnelProvider, RemoteTunnel } from '../../common/tunnel.js';

suite('Tunnel open retry', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const address: IAddressProvider = { getAddress: async () => { throw new Error('The test tunnel factory does not resolve addresses'); } };

	class RetryTunnelService extends AbstractTunnelService {
		creates = 0;
		readonly opened: RemoteTunnel[] = [];
		readonly closed: { host: string; port: number }[] = [];
		starter: () => Promise<RemoteTunnel | string | undefined> = () => Promise.resolve(undefined);

		constructor() {
			super(new NullLogService(), new TestConfigurationService());
			this._register(this.onTunnelOpened(tunnel => this.opened.push(tunnel)));
			this._register(this.onTunnelClosed(tunnel => this.closed.push(tunnel)));
		}

		isPortPrivileged(): boolean {
			return false;
		}

		protected override retainOrCreateTunnel(addressOrTunnelProvider: IAddressProvider | ITunnelProvider, remoteHost: string, remotePort: number): Promise<RemoteTunnel | string | undefined> | undefined {
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

	async function open(service: RetryTunnelService, host = 'localhost', port = 9): Promise<RemoteTunnel> {
		const tunnel = await service.openTunnel(address, host, port);
		assert.ok(tunnel && typeof tunnel !== 'string');
		return tunnel;
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
			const attempt = new DeferredPromise<RemoteTunnel>();
			service.starter = () => attempt.p;

			const first = service.openTunnel(address, 'localhost', 9);
			assert.ok(first);
			const error = new Error('late failure');
			const firstRejected = assert.rejects(first, reason => reason === error);
			const closed = service.closeTunnel('localhost', 9);
			const closeRejected = assert.rejects(closed, reason => reason === error);
			const replacement = fakeTunnel(9);
			service.starter = () => Promise.resolve(replacement);
			const second = await open(service);

			await attempt.error(error);
			await Promise.all([firstRejected, closeRejected]);
			assert.deepStrictEqual(await service.tunnels, [replacement]);
			assert.strictEqual(service.creates, 2);
			await second.dispose();
		});
	});

	test('releasing one open handle twice preserves the other owner', async () => {
		await withService(async service => {
			const tunnel = fakeTunnel(9);
			service.starter = () => Promise.resolve(tunnel);
			const first = await open(service);
			const second = await open(service);

			await first.dispose();
			await first.dispose();
			assert.deepStrictEqual({ tunnels: await service.tunnels, disposed: tunnel.disposals, opened: service.opened.length, closed: service.closed }, {
				tunnels: [tunnel], disposed: 0, opened: 2, closed: []
			});

			await second.dispose();
			await second.dispose();
			assert.deepStrictEqual({ tunnels: await service.tunnels, disposed: tunnel.disposals, closed: service.closed }, {
				tunnels: [], disposed: 1, closed: [{ host: 'localhost', port: 9 }]
			});
		});
	});

	for (const acquireExisting of [false, true]) {
		test(`an old ${acquireExisting ? 'existing' : 'open'} handle cannot release a reopened tunnel`, async () => {
			await withService(async service => {
				const oldTunnel = fakeTunnel(9);
				service.starter = () => Promise.resolve(oldTunnel);
				const original = await open(service);
				const oldHandle = acquireExisting ? await service.getExistingTunnel('localhost', 9) : original;
				assert.ok(oldHandle && typeof oldHandle !== 'string');
				await service.closeTunnel('localhost', 9);

				const replacement = fakeTunnel(9);
				service.starter = () => Promise.resolve(replacement);
				const current = await open(service);
				await oldHandle.dispose();
				await original.dispose();
				assert.deepStrictEqual({ tunnels: await service.tunnels, oldDisposed: oldTunnel.disposals, newDisposed: replacement.disposals, closed: service.closed.length }, {
					tunnels: [replacement], oldDisposed: 1, newDisposed: 0, closed: 1
				});

				await current.dispose();
				assert.deepStrictEqual({ tunnels: await service.tunnels, newDisposed: replacement.disposals, closed: service.closed.length, creates: service.creates }, {
					tunnels: [], newDisposed: 1, closed: 2, creates: 2
				});
			});
		});
	}

	test('a pending tunnel closed before completion cannot release its replacement', async () => {
		await withService(async service => {
			const attempt = new DeferredPromise<RemoteTunnel>();
			service.starter = () => attempt.p;
			const first = open(service);
			const closed = service.closeTunnel('localhost', 9);
			const replacement = fakeTunnel(9);
			service.starter = () => Promise.resolve(replacement);
			const second = await open(service);

			const oldTunnel = fakeTunnel(9);
			await attempt.complete(oldTunnel);
			const oldHandle = await first;
			await closed;
			await oldHandle.dispose();
			assert.deepStrictEqual({ tunnels: await service.tunnels, oldDisposed: oldTunnel.disposals, newDisposed: replacement.disposals, closed: service.closed.length }, {
				tunnels: [replacement], oldDisposed: 1, newDisposed: 0, closed: 1
			});
			await second.dispose();
		});
	});

	for (const host of ['localhost', '0.0.0.0']) {
		test(`an existing localhost alias shares and releases the original ${host} tunnel`, async () => {
			await withService(async service => {
				const tunnel = fakeTunnel(9, host);
				service.starter = () => Promise.resolve(tunnel);
				const first = await open(service, host);
				const existing = await service.getExistingTunnel('127.0.0.1', 9);
				assert.ok(existing && typeof existing !== 'string');
				await existing.dispose();
				await existing.dispose();
				assert.deepStrictEqual({ tunnels: await service.tunnels, disposed: tunnel.disposals, opened: service.opened.length, closed: service.closed }, {
					tunnels: [tunnel], disposed: 0, opened: 1, closed: []
				});

				await first.dispose();
				assert.deepStrictEqual({ tunnels: await service.tunnels, disposed: tunnel.disposals, closed: service.closed }, {
					tunnels: [], disposed: 1, closed: [{ host, port: 9 }]
				});
			});
		});
	}

	test('an existing handle acquired while opening owns one independent reference', async () => {
		await withService(async service => {
			const attempt = new DeferredPromise<RemoteTunnel>();
			service.starter = () => attempt.p;
			const first = open(service);
			const existing = service.getExistingTunnel('localhost', 9);
			const tunnel = fakeTunnel(9);
			await attempt.complete(tunnel);
			const original = await first;
			const retained = await existing;
			assert.ok(retained && typeof retained !== 'string');
			await original.dispose();
			assert.deepStrictEqual({ tunnels: await service.tunnels, disposed: tunnel.disposals }, { tunnels: [tunnel], disposed: 0 });
			await retained.dispose();
			assert.deepStrictEqual({ tunnels: await service.tunnels, disposed: tunnel.disposals, opened: service.opened.length, closed: service.closed.length }, {
				tunnels: [], disposed: 1, opened: 1, closed: 1
			});
		});
	});

	test('a rejected existing acquisition retains the original error and permits retry', async () => {
		await withService(async service => {
			const attempt = new DeferredPromise<RemoteTunnel>();
			service.starter = () => attempt.p;
			const error = new Error('shared failure');
			const firstRejected = assert.rejects(open(service), reason => reason === error);
			const existingRejected = assert.rejects(service.getExistingTunnel('localhost', 9), reason => reason === error);
			await attempt.error(error);
			await Promise.all([firstRejected, existingRejected]);
			const tunnel = fakeTunnel(9);
			service.starter = () => Promise.resolve(tunnel);
			const retry = await open(service);
			await retry.dispose();
			assert.deepStrictEqual({ tunnels: await service.tunnels, disposed: tunnel.disposals, creates: service.creates }, { tunnels: [], disposed: 1, creates: 2 });
		});
	});

	test('a synchronous provider failure releases the factory guard for retry', async () => {
		await withService(async service => {
			const error = new Error('provider threw');
			const tunnel = fakeTunnel(9);
			let attempts = 0;
			const provider = service.setTunnelProvider({
				forwardPort: () => {
					if (++attempts === 1) {
						throw error;
					}
					return Promise.resolve(tunnel);
				}
			});
			try {
				assert.throws(() => service.openTunnel(undefined, 'localhost', 9), reason => reason === error);
				const retried = await open(service);
				assert.deepStrictEqual({ attempts, tunnels: await service.tunnels, opened: service.opened.length }, { attempts: 2, tunnels: [tunnel], opened: 1 });
				await retried.dispose();
			} finally {
				provider.dispose();
			}
		});
	});

	test('a rejected provider promise has one rejection path and permits retry', async () => {
		await withService(async service => {
			const attempt = new DeferredPromise<RemoteTunnel>();
			const error = new Error('provider rejected');
			const tunnel = fakeTunnel(9);
			let attempts = 0;
			const provider = service.setTunnelProvider({ forwardPort: () => ++attempts === 1 ? attempt.p : Promise.resolve(tunnel) });
			try {
				const rejected = assert.rejects(open(service), reason => reason === error);
				await attempt.error(error);
				await rejected;
				const retried = await open(service);
				assert.deepStrictEqual({ attempts, tunnels: await service.tunnels }, { attempts: 2, tunnels: [tunnel] });
				await retried.dispose();
				// The complete suite's unhandled rejection hook also checks the discarded cleanup branch.
			} finally {
				provider.dispose();
			}
		});
	});

	test('provider recursion remains blocked only for the pending port and clears after success', async () => {
		await withService(async service => {
			const attempt = new DeferredPromise<RemoteTunnel>();
			const tunnel = fakeTunnel(9);
			const otherTunnel = fakeTunnel(10);
			const requested: number[] = [];
			const provider = service.setTunnelProvider({
				forwardPort: options => {
					requested.push(options.remoteAddress.port);
					assert.strictEqual(service.openTunnel(undefined, 'localhost', options.remoteAddress.port), undefined);
					return options.remoteAddress.port === 9 ? attempt.p : Promise.resolve(otherTunnel);
				}
			});
			try {
				const first = open(service);
				assert.strictEqual(service.openTunnel(undefined, 'localhost', 9), undefined);
				const other = await open(service, 'localhost', 10);
				await attempt.complete(tunnel);
				const opened = await first;
				const retained = await open(service);
				assert.deepStrictEqual(requested, [9, 10]);
				await opened.dispose();
				await retained.dispose();
				await other.dispose();
			} finally {
				provider.dispose();
			}
		});
	});

	for (const result of [undefined, 'provider declined']) {
		test(`a provider ${String(result)} result leaves no retained acquisition`, async () => {
			await withService(async service => {
				const attempt = new DeferredPromise<RemoteTunnel | string | undefined>();
				const tunnel = fakeTunnel(9);
				let attempts = 0;
				const provider = service.setTunnelProvider({ forwardPort: () => ++attempts === 1 ? attempt.p : Promise.resolve(tunnel) });
				try {
					const first = service.openTunnel(undefined, 'localhost', 9);
					const existing = service.getExistingTunnel('localhost', 9);
					await attempt.complete(result);
					assert.deepStrictEqual(await Promise.all([first, existing]), [result, result]);
					const retried = await open(service);
					await retried.dispose();
					assert.deepStrictEqual({ attempts, tunnels: await service.tunnels, disposed: tunnel.disposals, opened: service.opened.length, closed: service.closed.length }, {
						attempts: 2, tunnels: [], disposed: 1, opened: 1, closed: 1
					});
				} finally {
					provider.dispose();
				}
			});
		});
	}

	test('a synchronous undefined provider result releases the factory guard', async () => {
		await withService(async service => {
			const tunnel = fakeTunnel(9);
			let attempts = 0;
			const provider = service.setTunnelProvider({ forwardPort: () => ++attempts === 1 ? undefined : Promise.resolve(tunnel) });
			try {
				assert.strictEqual(service.openTunnel(undefined, 'localhost', 9), undefined);
				const retried = await open(service);
				assert.strictEqual(attempts, 2);
				await retried.dispose();
			} finally {
				provider.dispose();
			}
		});
	});
});

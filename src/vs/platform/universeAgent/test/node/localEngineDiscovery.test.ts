/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentConnectResult } from '../../common/universeAgentTypes.js';
import type { IClientIdentityStore } from '../../node/clientIdentityTypes.js';
import type { ConnectionProfile, IConnectionProfileStore } from '../../node/connectionProfileStore.js';
import type { ConnectionResolver } from '../../node/connectionResolver.js';
import type { GrpcUniverseAgentClient } from '../../node/grpc/grpcClient.js';
import { GrpcStatusCode } from '../../node/grpc/grpcTransport.js';
import { findLocalEnginePort } from '../../node/localEngineDiscovery.js';
import { UniverseAgentConnectionService } from '../../node/universeAgentConnectionService.js';

suite('local engine discovery', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('findLocalEnginePort returns the first port that answers', async () => {
		const probed: number[] = [];
		const port = await findLocalEnginePort(async candidate => {
			probed.push(candidate);
			return candidate === 50051;
		}, [50061, 50051]);
		assert.deepStrictEqual(probed, [50061, 50051]);
		assert.strictEqual(port, 50051);
	});

	test('desktop auto-connect uses skip-auth loopback when a port answers', async () => {
		const timers: Array<() => void> = [];
		const transport = fakeLoopbackTransport({
			workDir: '/engine',
			methods: [],
			events: [],
		});
		const service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEnginePort: async () => 50061,
			openLocalEngineTransport: () => transport,
			setTimeoutFn: callback => {
				timers.push(callback);
				return timers.length as unknown as ReturnType<typeof setTimeout>;
			},
			clearTimeoutFn: () => { /* test drains timers */ },
			reconnectJitterRatio: 0,
		}));

		await flushDiscovery();
		timers.shift()?.();
		await settleIo();

		const phase = service.getConnectionPhase();
		assert.strictEqual(phase.kind, 'connected');
		if (phase.kind === 'connected') {
			assert.strictEqual(phase.path, 'loopback');
		}
		assert.strictEqual(service.isEngineConnected(), true);
		assert.strictEqual(service.getConnectionSnapshot().authenticated, false);
		assert.strictEqual(Object.hasOwn(service.getConnectionSnapshot(), 'sessionToken'), false);
		assert.strictEqual(service.getConnectionSnapshot().workDir, '/engine');
		assert.strictEqual(service.getConnectionSnapshot().pairingPending, false);
	});

	test('missed probe retries, then connects', async () => {
		const timers: Array<() => void> = [];
		let probes = 0;
		const transport = fakeLoopbackTransport({ methods: [], events: [] });
		const service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEnginePort: async () => {
				probes += 1;
				return probes === 1 ? undefined : 50061;
			},
			openLocalEngineTransport: () => transport,
			setTimeoutFn: callback => {
				timers.push(callback);
				return timers.length as unknown as ReturnType<typeof setTimeout>;
			},
			clearTimeoutFn: () => { /* test drains timers */ },
			reconnectJitterRatio: 0,
		}));

		await flushDiscovery();
		assert.strictEqual(timers.length, 1);
		timers.shift()!();
		await flushDiscovery();
		assert.strictEqual(probes, 1);
		assert.strictEqual(service.getConnectionPhase().kind, 'disconnected');

		assert.strictEqual(timers.length, 1);
		timers.shift()!();
		await flushDiscovery();
		assert.strictEqual(service.isEngineConnected(), true);
		assert.strictEqual(service.getConnectionPhase().kind, 'connected');
	});

	test('disconnect stops further local discovery', async () => {
		const timers: Array<() => void> = [];
		let probes = 0;
		const service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEnginePort: async () => {
				probes += 1;
				return undefined;
			},
			setTimeoutFn: callback => {
				timers.push(callback);
				return timers.length as unknown as ReturnType<typeof setTimeout>;
			},
			clearTimeoutFn: () => { /* test drains timers */ },
			reconnectJitterRatio: 0,
		}));

		await flushDiscovery();
		timers.shift()!();
		await flushDiscovery();
		assert.strictEqual(probes, 1);
		await service.disconnect();
		const pending = timers.splice(0);
		for (const callback of pending) {
			callback();
		}
		await flushDiscovery();
		assert.strictEqual(probes, 1);
		assert.strictEqual(service.getConnectionPhase().kind, 'closed');
	});

	test('capability probe publishes nothing until the connected commit', async () => {
		const timers = manualTimers();
		let sawProbe = false;
		let service!: UniverseAgentConnectionService;
		const transport = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => ({
				workDir: '/engine',
				methods: ['ToolService.ListSkills'],
				events: [],
			}),
			probeRpc: async () => {
				sawProbe = true;
				assert.strictEqual(service.getConnectionSnapshot().channelAlive, false);
				assert.deepStrictEqual(service.getConnectionPhase(), { kind: 'connecting', reason: 'initial' });
				assert.strictEqual(dialState(service)._transport, undefined);
				assert.strictEqual(dialState(service)._loopbackSkipAuth, false);
				return GrpcStatusCode.OK;
			},
		});
		service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEnginePort: async () => 50061,
			openLocalEngineTransport: () => transport,
			...timers.fns,
			reconnectJitterRatio: 0,
		}));

		await flushDiscovery();
		timers.fireNext();
		await settleIo();

		assert.strictEqual(sawProbe, true);
		assert.strictEqual(service.isEngineConnected(), true);
		assert.strictEqual(dialState(service)._liveConnectedPublished(), true);
		assert.strictEqual(dialState(service)._loopbackSkipAuth, true);
		assert.deepStrictEqual(service.getConnectionPhase(), { kind: 'connected', path: 'loopback' });
		assert.strictEqual(service.getConnectionSnapshot().authenticated, false);
	});

	test('user connectProfile cancels a pending local discovery timer', async () => {
		const timers = manualTimers();
		let probes = 0;
		const service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEnginePort: async () => {
				probes += 1;
				return undefined;
			},
			...timers.fns,
			reconnectJitterRatio: 0,
		}));

		await flushDiscovery();
		assert.strictEqual(timers.pending.size, 1);
		assert.strictEqual(probes, 0);
		await service.connectProfile('p1');
		assert.strictEqual(timers.pending.size, 0);
		timers.fireNext();
		await flushDiscovery();
		assert.strictEqual(probes, 0);
		assert.strictEqual(service.getConnectionPhase().kind, 'disconnected');
	});

	test('probe UNAVAILABLE does not commit and schedules another discovery', async () => {
		const timers = manualTimers();
		let service!: UniverseAgentConnectionService;
		const transport = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => ({
				methods: ['ToolService.ListSkills'],
				events: [],
			}),
			probeRpc: async current => {
				assert.strictEqual(dialState(service)._transport, undefined);
				assert.strictEqual(service.getConnectionSnapshot().channelAlive, false);
				current.fireUnavailable();
				return GrpcStatusCode.UNAVAILABLE;
			},
		});
		service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEnginePort: async () => 50061,
			openLocalEngineTransport: () => transport,
			...timers.fns,
			reconnectJitterRatio: 0,
		}));

		await flushDiscovery();
		timers.fireNext();
		await settleIo();

		assert.strictEqual(transport.closed, true);
		assert.strictEqual(service.isEngineConnected(), false);
		assert.strictEqual(dialState(service)._liveConnectedPublished(), false);
		assert.strictEqual(dialState(service)._loopbackSkipAuth, false);
		assert.strictEqual(dialState(service)._transport, undefined);
		assert.strictEqual(service.getConnectionPhase().kind, 'disconnected');
		assert.strictEqual(timers.pending.size, 1);
	});

	test('disconnect during connectWithoutDeviceAuth does not publish', async () => {
		const timers = manualTimers();
		let releaseConnect: (() => void) | undefined;
		let markHung: (() => void) | undefined;
		const untilHung = new Promise<void>(resolve => { markHung = resolve; });
		const transport = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => {
				markHung?.();
				await new Promise<void>(resolve => { releaseConnect = resolve; });
				return { workDir: '/engine', methods: [], events: [] };
			},
		});
		const service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEnginePort: async () => 50061,
			openLocalEngineTransport: () => transport,
			...timers.fns,
			reconnectJitterRatio: 0,
		}));

		await flushDiscovery();
		timers.fireNext();
		await untilHung;
		await service.disconnect();
		releaseConnect?.();
		await settleIo();

		assert.strictEqual(transport.closed, true);
		assert.strictEqual(service.getConnectionPhase().kind, 'closed');
		assert.strictEqual(dialState(service)._transport, undefined);
		assert.strictEqual(dialState(service)._sessionToken, undefined);
		assert.strictEqual(dialState(service)._loopbackSkipAuth, false);
		assert.strictEqual(service.isEngineConnected(), false);
		assert.strictEqual(timers.pending.size, 0);
	});

	test('connectWithoutDeviceAuth in flight yields to connectProfile', async () => {
		const timers = manualTimers();
		let releaseLocal: (() => void) | undefined;
		let markHung: (() => void) | undefined;
		const untilHung = new Promise<void>(resolve => { markHung = resolve; });
		const local = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => {
				markHung?.();
				await new Promise<void>(resolve => { releaseLocal = resolve; });
				return { workDir: '/engine', methods: [], events: [] };
			},
		});
		let service!: UniverseAgentConnectionService;
		const user = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => ({ methods: [], events: [] }),
		});
		(user as unknown as { connect: () => Promise<UniverseAgentConnectResult> }).connect = async () => {
			releaseLocal?.();
			await flushDiscovery();
			await settleIo();
			assert.strictEqual(dialState(service)._transport, undefined);
			assert.strictEqual(dialState(service)._loopbackSkipAuth, false);
			assert.strictEqual(service.getConnectionSnapshot().channelAlive, false);
			return { sessionToken: 'token-user', workDir: '/user', methods: [], events: [] };
		};
		service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEnginePort: async () => 50061,
			openLocalEngineTransport: () => local,
			createTransport: () => user,
			connectionResolver: plainResolver(),
			connectionProfileStore: plainProfileStore(),
			clientIdentityStore: readyIdentity(),
			...timers.fns,
			reconnectJitterRatio: 0,
		}));

		await flushDiscovery();
		timers.fireNext();
		await untilHung;
		const result = await service.connectProfile('p1');
		assert.strictEqual(result.ok, true);
		if (result.ok) {
			assert.strictEqual(result.path, 'direct');
		}
		await settleIo();
		assert.strictEqual(local.closed, true);
		assert.strictEqual(dialState(service)._transport, user);
		assert.strictEqual(dialState(service)._loopbackSkipAuth, false);
		assert.strictEqual(dialState(service)._sessionToken, 'token-user');
		assert.deepStrictEqual(service.getConnectionPhase(), { kind: 'connected', path: 'direct' });
		assert.strictEqual(service.isEngineConnected(), true);
	});

	test('a committed skip-auth link is live until profile dial replaces it', async () => {
		const timers = manualTimers();
		const local = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => ({ workDir: '/engine', methods: [], events: [] }),
		});
		const user = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => ({ methods: [], events: [] }),
		});
		(user as unknown as { connect: () => Promise<UniverseAgentConnectResult> }).connect = async () => ({
			sessionToken: 'token-user',
			workDir: '/user',
			methods: [],
			events: [],
		});
		const service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEnginePort: async () => 50061,
			openLocalEngineTransport: () => local,
			createTransport: () => user,
			connectionResolver: plainResolver(),
			connectionProfileStore: plainProfileStore(),
			clientIdentityStore: readyIdentity(),
			...timers.fns,
			reconnectJitterRatio: 0,
		}));

		await flushDiscovery();
		timers.fireNext();
		await settleIo();
		assert.strictEqual(service.isEngineConnected(), true);
		assert.strictEqual(dialState(service)._liveConnectedPublished(), true);
		assert.strictEqual(dialState(service)._loopbackSkipAuth, true);

		const result = await service.connectProfile('p1');
		assert.strictEqual(result.ok, true);
		assert.strictEqual(local.closed, true);
		assert.strictEqual(dialState(service)._transport, user);
		assert.strictEqual(dialState(service)._loopbackSkipAuth, false);
		assert.strictEqual(dialState(service)._sessionToken, 'token-user');
		assert.strictEqual(service.isEngineConnected(), true);
		assert.strictEqual(dialState(service)._liveConnectedPublished(), true);
		assert.deepStrictEqual(service.getConnectionPhase(), { kind: 'connected', path: 'direct' });
	});
});

function fakeLoopbackTransport(result: UniverseAgentConnectResult): GrpcUniverseAgentClient {
	return {
		isChannelAlive: true,
		connectWithoutDeviceAuth: async () => result,
		installSessionToken: () => { /* skip-auth installs nothing */ },
		onDidRejectSessionToken: Event.None,
		onDidObserveUnavailable: Event.None,
		close: () => { /* unused on the success path */ },
	} as unknown as GrpcUniverseAgentClient;
}

async function flushDiscovery(): Promise<void> {
	for (let i = 0; i < 12; i++) {
		await Promise.resolve();
	}
}

async function settleIo(): Promise<void> {
	for (let i = 0; i < 30; i++) {
		await new Promise(resolve => setImmediate(resolve));
	}
}

function dialState(service: UniverseAgentConnectionService) {
	return service as unknown as {
		_transport?: unknown;
		_sessionToken?: string;
		_loopbackSkipAuth?: boolean;
		_liveConnectedPublished(): boolean;
	};
}

function manualTimers() {
	let nextId = 1;
	const pending = new Map<number, () => void>();
	return {
		pending,
		fns: {
			setTimeoutFn: (callback: () => void) => {
				const id = nextId++;
				pending.set(id, callback);
				return id as unknown as ReturnType<typeof setTimeout>;
			},
			clearTimeoutFn: (handle: ReturnType<typeof setTimeout>) => {
				pending.delete(handle as unknown as number);
			},
		},
		fireNext(): void {
			const id = pending.keys().next().value as number | undefined;
			if (id === undefined) {
				return;
			}
			const callback = pending.get(id);
			pending.delete(id);
			callback?.();
		},
	};
}

function scriptedLoopbackTransport(hooks: {
	connectWithoutDeviceAuth: () => Promise<UniverseAgentConnectResult>;
	probeRpc?: (transport: { fireUnavailable(): void }) => Promise<number>;
}): GrpcUniverseAgentClient & { readonly closed: boolean; fireUnavailable(): void } {
	const rejected = new Emitter<void>();
	const unavailable = new Emitter<void>();
	const transport = {
		closed: false,
		isChannelAlive: true,
		connectWithoutDeviceAuth: hooks.connectWithoutDeviceAuth,
		probeRpc: async () => hooks.probeRpc ? hooks.probeRpc(transport) : GrpcStatusCode.OK,
		installSessionToken: () => { /* skip-auth installs nothing */ },
		onDidRejectSessionToken: rejected.event,
		onDidObserveUnavailable: unavailable.event,
		fireUnavailable: () => unavailable.fire(),
		close: () => {
			if (transport.closed) {
				return;
			}
			transport.closed = true;
			rejected.dispose();
			unavailable.dispose();
		},
	};
	return transport as unknown as GrpcUniverseAgentClient & { readonly closed: boolean; fireUnavailable(): void };
}

function readyIdentity(): IClientIdentityStore {
	const identity = {
		clientIdentityId: 'a'.repeat(64),
		clientPublicKey: new Uint8Array(32),
		privateKeyPkcs8: new Uint8Array(32),
	};
	return {
		getState: async () => ({ kind: 'ready', identity }),
		getOrCreateIdentity: async () => ({ kind: 'ready', identity }),
		createSigner: async () => () => new Uint8Array(64),
	};
}

function plainProfile(): ConnectionProfile {
	return {
		profileId: 'p1',
		displayName: 'Direct',
		target: { kind: 'directAddress', host: '127.0.0.1', port: 50051 },
		trust: null,
		state: 'active',
		allowPrivateNetwork: true,
	};
}

function plainProfileStore(): IConnectionProfileStore {
	const profile = plainProfile();
	return {
		list: () => [profile],
		get: profileId => profileId === profile.profileId ? profile : undefined,
		put: () => { /* dial does not rewrite this fixture */ },
		remove: () => { /* unused */ },
		createDraft: () => profile,
	};
}

function plainResolver(): ConnectionResolver {
	return {
		resolve: async () => ({
			ok: true as const,
			allowRelayFallback: false as const,
			endpoint: {
				attemptId: 'a1',
				authority: '127.0.0.1',
				port: 50051,
				resolvedIp: '127.0.0.1',
				servername: '127.0.0.1',
				relayTicketId: null,
				tls: null,
				expiresAtMs: 1,
				path: 'direct' as const,
			},
		}),
		consumeRelayTicket: () => { /* plain dial has no ticket */ },
	} as unknown as ConnectionResolver;
}

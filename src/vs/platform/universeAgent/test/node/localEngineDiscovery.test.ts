/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as grpc from '@grpc/grpc-js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentConnectResult } from '../../common/universeAgentTypes.js';
import type { IClientIdentityStore } from '../../node/clientIdentityTypes.js';
import type { ConnectionProfile, IConnectionProfileStore } from '../../node/connectionProfileStore.js';
import type { ConnectionResolver } from '../../node/connectionResolver.js';
import { deriveEngineLeafFingerprintHex } from '../../node/deviceGrant/tls-pin.js';
import { createLocalPinnedGrpcClient, type GrpcUniverseAgentClient } from '../../node/grpc/grpcClient.js';
import { GrpcStatusCode, UniverseAgentGrpcServices } from '../../node/grpc/grpcTransport.js';
import { checkOwnerOnly, findLocalEngine, localEngineCertificateDer, localEngineOwnerOk, localEnginePidAlive, resolveLocalEngineHome, type LocalEngineTarget } from '../../node/localEngineDiscovery.js';
import { loadGrpcModule } from '../../node/universeAgentChannel.js';
import { UniverseAgentConnectionService } from '../../node/universeAgentConnectionService.js';

const loopbackUdsTarget: LocalEngineTarget = { kind: 'uds', path: '/tmp/universe-agent-local.sock' };

const loopbackTcpTarget: LocalEngineTarget = {
	kind: 'tcp',
	address: '127.0.0.1:50061',
	tls: {
		trustAnchorLeafDer: Uint8Array.of(1),
		expectedLeafSha256Hex: 'ab'.repeat(32),
		hostnameVerification: 'replaced-by-pin',
	},
};

suite('local engine discovery', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('desktop auto-connect uses skip-auth loopback when a UDS target answers', async () => {
		const timers: Array<() => void> = [];
		const transport = fakeLoopbackTransport({
			workDir: '/engine',
			methods: [],
			events: [],
		});
		let opened: LocalEngineTarget | undefined;
		const service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEngine: async () => loopbackUdsTarget,
			openLocalEngineTransport: target => {
				opened = target;
				return transport;
			},
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
		assert.deepStrictEqual(opened, loopbackUdsTarget);
		assert.strictEqual(service.isEngineConnected(), true);
		assert.strictEqual(service.getConnectionSnapshot().authenticated, false);
		assert.strictEqual(Object.hasOwn(service.getConnectionSnapshot(), 'sessionToken'), false);
		assert.strictEqual(service.getConnectionSnapshot().workDir, '/engine');
		assert.strictEqual(service.getConnectionSnapshot().pairingPending, false);
	});

	test('desktop auto-connect commits a TCP anchor as loopback too', async () => {
		const timers: Array<() => void> = [];
		const transport = fakeLoopbackTransport({
			workDir: '/engine',
			methods: [],
			events: [],
		});
		let opened: LocalEngineTarget | undefined;
		const service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEngine: async () => loopbackTcpTarget,
			openLocalEngineTransport: target => {
				opened = target;
				return transport;
			},
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
		assert.deepStrictEqual(opened, loopbackTcpTarget);
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
			findLocalEngine: async () => {
				probes += 1;
				return probes === 1 ? undefined : loopbackUdsTarget;
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
			findLocalEngine: async () => {
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
			findLocalEngine: async () => loopbackUdsTarget,
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
			findLocalEngine: async () => {
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
			probeRpc: async (_service, _method, current) => {
				assert.strictEqual(dialState(service)._transport, undefined);
				assert.strictEqual(service.getConnectionSnapshot().channelAlive, false);
				current.fireUnavailable();
				return GrpcStatusCode.UNAVAILABLE;
			},
		});
		service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEngine: async () => loopbackUdsTarget,
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
			findLocalEngine: async () => loopbackUdsTarget,
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
			findLocalEngine: async () => loopbackUdsTarget,
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
			findLocalEngine: async () => loopbackUdsTarget,
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

	test('Session/List UNAUTHENTICATED does not commit and suppresses discovery', async () => {
		const timers = manualTimers();
		const phases: string[] = [];
		let probes = 0;
		const transport = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => ({ methods: ['ToolService.ListSkills'], events: [] }),
			probeRpc: async (serviceName, method) => {
				assert.strictEqual(serviceName, UniverseAgentGrpcServices.Session.service);
				assert.strictEqual(method, UniverseAgentGrpcServices.Session.List);
				return GrpcStatusCode.UNAUTHENTICATED;
			},
		});
		const service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEngine: async () => {
				probes += 1;
				return loopbackUdsTarget;
			},
			openLocalEngineTransport: () => transport,
			...timers.fns,
			reconnectJitterRatio: 0,
		}));
		disposables.add(service.onDidChangeConnection(snapshot => {
			if (snapshot.phase) {
				phases.push(snapshot.phase.kind);
			}
		}));

		await flushDiscovery();
		timers.fireNext();
		await settleIo();

		assert.strictEqual(transport.closed, true);
		assert.strictEqual(service.isEngineConnected(), false);
		assert.deepStrictEqual(service.getConnectionPhase(), { kind: 'disconnected' });
		assert.strictEqual(dialState(service)._suppressLocalEngineDiscovery, true);
		assert.strictEqual(dialState(service)._transport, undefined);
		assert.strictEqual(timers.pending.size, 0);
		assert.ok(phases.includes('disconnected'));
		timers.fireNext();
		await flushDiscovery();
		assert.strictEqual(probes, 1);
	});

	test('Session/List OK or UNIMPLEMENTED still commits', async () => {
		for (const status of [GrpcStatusCode.OK, GrpcStatusCode.UNIMPLEMENTED]) {
			const timers = manualTimers();
			const calls: string[] = [];
			const transport = scriptedLoopbackTransport({
				connectWithoutDeviceAuth: async () => ({ methods: ['ToolService.ListSkills'], events: [] }),
				probeRpc: async (serviceName, method) => {
					calls.push(`${serviceName}/${method}`);
					return status;
				},
			});
			const service: UniverseAgentConnectionService = disposables.add(new UniverseAgentConnectionService({
				autoConnectLocalEngine: true,
				storageReady: Promise.resolve(),
				findLocalEngine: async (): Promise<LocalEngineTarget | undefined> => loopbackUdsTarget,
				openLocalEngineTransport: () => transport,
				...timers.fns,
				reconnectJitterRatio: 0,
			}));

			await flushDiscovery();
			timers.fireNext();
			await settleIo();

			assert.ok(calls.includes(`${UniverseAgentGrpcServices.Session.service}/${UniverseAgentGrpcServices.Session.List}`), `status ${status}`);
			assert.ok(calls.includes(`${UniverseAgentGrpcServices.Tool.service}/${UniverseAgentGrpcServices.Tool.ListSkills}`), `status ${status}`);
			assert.strictEqual(service.isEngineConnected(), true, `status ${status}`);
			assert.deepStrictEqual(service.getConnectionPhase(), { kind: 'connected', path: 'loopback' });
			assert.strictEqual(dialState(service)._loopbackSkipAuth, true);
		}
	});

	test('a local link that already has a token does not probe Session/List', async () => {
		const timers = manualTimers();
		const calls: string[] = [];
		const transport = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => ({
				sessionToken: 'token-local',
				workDir: '/engine',
				methods: ['ToolService.ListSkills'],
				events: [],
			}),
			probeRpc: async (serviceName, method) => {
				calls.push(`${serviceName}/${method}`);
				return GrpcStatusCode.OK;
			},
		});
		const service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEngine: async () => loopbackUdsTarget,
			openLocalEngineTransport: () => transport,
			...timers.fns,
			reconnectJitterRatio: 0,
		}));

		await flushDiscovery();
		timers.fireNext();
		await settleIo();

		assert.ok(!calls.includes(`${UniverseAgentGrpcServices.Session.service}/${UniverseAgentGrpcServices.Session.List}`));
		assert.ok(calls.includes(`${UniverseAgentGrpcServices.Tool.service}/${UniverseAgentGrpcServices.Tool.ListSkills}`));
		assert.strictEqual(dialState(service)._sessionToken, 'token-local');
		assert.strictEqual(dialState(service)._loopbackSkipAuth, false);
		assert.strictEqual(service.isEngineConnected(), true);
		assert.deepStrictEqual(service.getConnectionPhase(), { kind: 'connected', path: 'loopback' });
	});

	test('user dial during the auth probe closes the capture and does not suppress discovery', async () => {
		const timers = manualTimers();
		let releaseProbe: (() => void) | undefined;
		let markHung: (() => void) | undefined;
		const untilHung = new Promise<void>(resolve => { markHung = resolve; });
		const local = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => ({ methods: [], events: [] }),
			probeRpc: async (serviceName, method) => {
				assert.strictEqual(serviceName, UniverseAgentGrpcServices.Session.service);
				assert.strictEqual(method, UniverseAgentGrpcServices.Session.List);
				markHung?.();
				await new Promise<void>(resolve => { releaseProbe = resolve; });
				return GrpcStatusCode.UNAUTHENTICATED;
			},
		});
		let service!: UniverseAgentConnectionService;
		const user = scriptedLoopbackTransport({
			connectWithoutDeviceAuth: async () => ({ methods: [], events: [] }),
		});
		(user as unknown as { connect: () => Promise<UniverseAgentConnectResult> }).connect = async () => {
			releaseProbe?.();
			await flushDiscovery();
			await settleIo();
			assert.strictEqual(local.closed, true);
			assert.strictEqual(dialState(service)._suppressLocalEngineDiscovery, false);
			assert.strictEqual(dialState(service)._transport, undefined);
			return { sessionToken: 'token-user', workDir: '/user', methods: [], events: [] };
		};
		service = disposables.add(new UniverseAgentConnectionService({
			autoConnectLocalEngine: true,
			storageReady: Promise.resolve(),
			findLocalEngine: async () => loopbackUdsTarget,
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
		assert.strictEqual(local.closed, true);
		assert.strictEqual(dialState(service)._suppressLocalEngineDiscovery, false);
		assert.strictEqual(dialState(service)._transport, user);
		assert.deepStrictEqual(service.getConnectionPhase(), { kind: 'connected', path: 'direct' });
	});
});

function fakeLoopbackTransport(result: UniverseAgentConnectResult): GrpcUniverseAgentClient {
	return {
		isChannelAlive: true,
		connectWithoutDeviceAuth: async () => result,
		probeRpc: async () => GrpcStatusCode.OK,
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
		_suppressLocalEngineDiscovery?: boolean;
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
	probeRpc?: (service: string, method: string, transport: { fireUnavailable(): void }) => Promise<number>;
}): GrpcUniverseAgentClient & { readonly closed: boolean; fireUnavailable(): void } {
	const rejected = new Emitter<void>();
	const unavailable = new Emitter<void>();
	const transport = {
		closed: false,
		isChannelAlive: true,
		connectWithoutDeviceAuth: hooks.connectWithoutDeviceAuth,
		probeRpc: async (service: string, method: string) => hooks.probeRpc ? hooks.probeRpc(service, method, transport) : GrpcStatusCode.OK,
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

suite('local engine trust anchor', function () {
	this.timeout(20_000);

	const uid = typeof process.getuid === 'function' ? process.getuid() : 0;

	test('home resolution prefers a non-empty UNIVERSE_AGENT_HOME', () => {
		assert.strictEqual(resolveLocalEngineHome({ UNIVERSE_AGENT_HOME: '/var/engine' }, '/home/me'), '/var/engine');
		assert.strictEqual(resolveLocalEngineHome({ UNIVERSE_AGENT_HOME: 'rel-home' }, '/home/me'), resolve('rel-home'));
		assert.strictEqual(resolveLocalEngineHome({ UNIVERSE_AGENT_HOME: '' }, '/home/me'), resolve('/home/me/.universe-agent'));
		assert.strictEqual(resolveLocalEngineHome({}, '/home/me'), resolve('/home/me/.universe-agent'));
	});

	test('owner check rejects a different uid and any group or other bit', () => {
		assert.strictEqual(checkOwnerOnly({ uid, mode: 0o100600 }, uid), true);
		assert.strictEqual(checkOwnerOnly({ uid, mode: 0o40700 }, uid), true);
		assert.strictEqual(checkOwnerOnly({ uid: uid + 1, mode: 0o100600 }, uid), false);
		for (const mode of [0o100640, 0o100620, 0o100610, 0o100604, 0o100602, 0o100601, 0o100644]) {
			assert.strictEqual(checkOwnerOnly({ uid, mode }, uid), false, mode.toString(8));
		}
		assert.strictEqual(localEngineOwnerOk({ uid, mode: 0o100666 }, uid, 'win32'), true);
		assert.strictEqual(localEngineOwnerOk({ uid: uid + 1, mode: 0o100600 }, uid, 'win32'), false);
		assert.strictEqual(localEngineOwnerOk({ uid, mode: 0o100666 }, uid, 'linux'), false);
	});

	test('pid liveness treats only ESRCH as dead', () => {
		assert.strictEqual(localEnginePidAlive(process.pid), true);
		assert.strictEqual(localEnginePidAlive(2_147_483_647), false);
		const denied = (): boolean => {
			throw Object.assign(new Error('denied'), { code: 'EPERM' });
		};
		const gone = (): boolean => {
			throw Object.assign(new Error('gone'), { code: 'ESRCH' });
		};
		assert.strictEqual(localEnginePidAlive(1, denied), true);
		assert.strictEqual(localEnginePidAlive(1, gone), false);
	});

	test('0700 directory with a live socket returns uds ahead of TCP', async () => {
		const home = await tempHome(0o700);
		const cert = await selfSigned(home, 'leaf');
		const tcp = await bindHealthServer('127.0.0.1:0', tlsCredentials(cert));
		const uds = await bindHealthServer(`unix:${join(home, 'server.sock')}`, grpc.ServerCredentials.createInsecure());
		try {
			await writeLock(home, { pid: process.pid, port: tcp.port, bind: '127.0.0.1', token: 'secret' });
			await writeCert(home, cert.certPem);
			const target = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: home },
				homedir: '/unused',
				uid,
				platform: 'linux',
			});
			assert.strictEqual(target?.kind, 'uds');
			if (target?.kind === 'uds') {
				assert.strictEqual(target.path, join(home, 'server.sock'));
			}
		} finally {
			await uds.close();
			await tcp.close();
			await removeHome(home);
		}
	});

	test('0755 directory skips UDS and falls through to TCP', async () => {
		const home = await tempHome(0o755);
		const cert = await selfSigned(home, 'leaf');
		const tcp = await bindHealthServer('127.0.0.1:0', tlsCredentials(cert));
		const uds = await bindHealthServer(`unix:${join(home, 'server.sock')}`, grpc.ServerCredentials.createInsecure());
		try {
			await writeLock(home, { port: tcp.port, bind: '127.0.0.1' });
			await writeCert(home, cert.certPem);
			const target = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: home },
				uid,
				platform: 'linux',
			});
			assert.strictEqual(target?.kind, 'tcp');
			if (target?.kind === 'tcp') {
				assert.strictEqual(target.address, `127.0.0.1:${tcp.port}`);
			}
		} finally {
			await uds.close();
			await tcp.close();
			await removeHome(home);
		}
	});

	test('a missing socket falls through to TCP', async () => {
		const home = await tempHome(0o700);
		const cert = await selfSigned(home, 'leaf');
		const tcp = await bindHealthServer('127.0.0.1:0', tlsCredentials(cert));
		try {
			await writeLock(home, { port: tcp.port, bind: '127.0.0.1' });
			await writeCert(home, cert.certPem);
			const target = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: home },
				uid,
				platform: 'linux',
			});
			assert.strictEqual(target?.kind, 'tcp');
			if (target?.kind === 'tcp') {
				assert.strictEqual(target.address, `127.0.0.1:${tcp.port}`);
				assert.strictEqual(target.tls.expectedLeafSha256Hex, cert.fingerprint);
			}
		} finally {
			await tcp.close();
			await removeHome(home);
		}
	});

	test('a socket that refuses the health check falls through to TCP', async () => {
		const home = await tempHome(0o700);
		const cert = await selfSigned(home, 'leaf');
		const tcp = await bindHealthServer('127.0.0.1:0', tlsCredentials(cert));
		const dead = await listenDeadSocket(join(home, 'server.sock'));
		try {
			await writeLock(home, { port: tcp.port, bind: '127.0.0.1' });
			await writeCert(home, cert.certPem);
			const target = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: home },
				uid,
				platform: 'linux',
			});
			assert.strictEqual(target?.kind, 'tcp');
		} finally {
			await new Promise<void>(resolveClose => dead.close(() => resolveClose()));
			await tcp.close();
			await removeHome(home);
		}
	});

	test('the first certificate pins the loopback server', async () => {
		const home = await tempHome(0o700);
		const first = await selfSigned(home, 'first');
		const second = await selfSigned(home, 'second');
		const tcp = await bindHealthServer('127.0.0.1:0', tlsCredentials(first));
		try {
			await writeLock(home, { pid: -1, port: tcp.port, bind: '127.0.0.1', token: 'do-not-use' });
			await writeCert(home, `${first.certPem}\n${second.certPem}`);
			const target = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: home },
				uid,
				platform: 'linux',
			});
			assert.strictEqual(target?.kind, 'tcp');
			if (target?.kind !== 'tcp') {
				return;
			}
			assert.strictEqual(target.tls.expectedLeafSha256Hex, first.fingerprint);
			assert.notStrictEqual(target.tls.expectedLeafSha256Hex, second.fingerprint);
			assert.deepStrictEqual(localEngineCertificateDer(new TextEncoder().encode(`${first.certPem}\n${second.certPem}`)), first.der);
			assert.strictEqual(Object.hasOwn(target, 'token'), false);
			await loadGrpcModule();
			const client = createLocalPinnedGrpcClient(target.address, target.tls, 2_000);
			try {
				const health = await client.healthCheck();
				assert.strictEqual(health.status, '');
			} finally {
				client.close();
			}
		} finally {
			await tcp.close();
			await removeHome(home);
		}
	});

	test('a different leaf fails the pin and is not a target', async () => {
		const home = await tempHome(0o700);
		const pinned = await selfSigned(home, 'pinned');
		const other = await selfSigned(home, 'other');
		const tcp = await bindHealthServer('127.0.0.1:0', tlsCredentials(other));
		try {
			await writeLock(home, { port: tcp.port, bind: '127.0.0.1' });
			await writeCert(home, pinned.certPem);
			const target = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: home },
				uid,
				platform: 'linux',
			});
			assert.strictEqual(target, undefined);
			await loadGrpcModule();
			const client = createLocalPinnedGrpcClient(`127.0.0.1:${tcp.port}`, {
				trustAnchorLeafDer: pinned.der,
				expectedLeafSha256Hex: pinned.fingerprint,
				hostnameVerification: 'replaced-by-pin',
			}, 2_000);
			try {
				await assert.rejects(() => client.healthCheck());
			} finally {
				client.close();
			}
		} finally {
			await tcp.close();
			await removeHome(home);
		}
	});

	test('non-loopback binds and bad ports are not anchors', async () => {
		const home = await tempHome(0o700);
		try {
			const cert = await selfSigned(home, 'leaf');
			await writeCert(home, cert.certPem);
			for (const bind of ['0.0.0.0', '::', 'localhost', 'engine.local', '127.0.0.256', '127.0.0.01', '[::1]', '127.0.0.1 ']) {
				await writeLock(home, { port: 9, bind });
				const probed = await discoverProbed(home);
				assert.strictEqual(probed.target, undefined, bind);
				assert.strictEqual(probed.probed, false, bind);
			}
			for (const port of [0, 65536, 1.5, '80']) {
				await writeLock(home, { port, bind: '127.0.0.1' });
				const probed = await discoverProbed(home);
				assert.strictEqual(probed.target, undefined, String(port));
				assert.strictEqual(probed.probed, false, String(port));
			}
			await writeLock(home, { bind: '127.0.0.1' });
			const missingPort = await discoverProbed(home);
			assert.strictEqual(missingPort.target, undefined);
			await writeRaw(home, 'server.lock', '{');
			const broken = await discoverProbed(home);
			assert.strictEqual(broken.target, undefined);
		} finally {
			await removeHome(home);
		}
	});

	test('loopback binds dial 127.0.0.1 unless the literal is ::1', async () => {
		const home = await tempHome(0o700);
		try {
			const cert = await selfSigned(home, 'leaf');
			await writeCert(home, cert.certPem);
			await writeLock(home, { port: 9, bind: '127.0.0.2' });
			const v4 = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: home },
				uid,
				platform: 'linux',
				probeHealth: async () => true,
			});
			assert.strictEqual(v4?.kind, 'tcp');
			if (v4?.kind === 'tcp') {
				assert.strictEqual(v4.address, '127.0.0.1:9');
				assert.strictEqual(v4.tls.expectedLeafSha256Hex, cert.fingerprint);
			}
			await writeLock(home, { port: 1, bind: '::1' });
			const v6 = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: home },
				uid,
				platform: 'linux',
				probeHealth: async () => true,
			});
			assert.strictEqual(v6?.kind, 'tcp');
			if (v6?.kind === 'tcp') {
				assert.strictEqual(v6.address, '[::1]:1');
			}
			await writeLock(home, { port: 65535, bind: '127.255.255.255' });
			const edge = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: home },
				uid,
				platform: 'linux',
				probeHealth: async () => true,
			});
			assert.strictEqual(edge?.kind, 'tcp');
			if (edge?.kind === 'tcp') {
				assert.strictEqual(edge.address, '127.0.0.1:65535');
			}
		} finally {
			await removeHome(home);
		}
	});

	test('mode 0644 on the lock or the certificate is not an anchor', async () => {
		const home = await tempHome(0o700);
		try {
			const cert = await selfSigned(home, 'leaf');
			await writeLock(home, { port: 9, bind: '127.0.0.1' }, 0o644);
			await writeCert(home, cert.certPem, 0o600);
			const looseLock = await discoverProbed(home);
			assert.strictEqual(looseLock.target, undefined);
			assert.strictEqual(looseLock.probed, false);
			await writeLock(home, { port: 9, bind: '127.0.0.1' }, 0o600);
			await writeCert(home, cert.certPem, 0o644);
			const looseCert = await discoverProbed(home);
			assert.strictEqual(looseCert.target, undefined);
			assert.strictEqual(looseCert.probed, false);
		} finally {
			await removeHome(home);
		}
	});

	test('a different uid and a stale pid are not anchors', async () => {
		const home = await tempHome(0o700);
		try {
			const cert = await selfSigned(home, 'leaf');
			await writeLock(home, { pid: process.pid, port: 9, bind: '127.0.0.1' });
			await writeCert(home, cert.certPem);
			const otherUid = uid === 1 ? 2 : 1;
			const foreign = await discoverProbed(home, { uid: otherUid });
			assert.strictEqual(foreign.target, undefined);
			assert.strictEqual(foreign.probed, false);
			await writeLock(home, { pid: 2_147_483_647, port: 9, bind: '127.0.0.1' });
			const stale = await discoverProbed(home);
			assert.strictEqual(stale.target, undefined);
			assert.strictEqual(stale.probed, false);
			await writeLock(home, { pid: process.pid, port: 9, bind: '127.0.0.1' });
			const live = await discoverProbed(home);
			assert.strictEqual(live.target?.kind, 'tcp');
			assert.strictEqual(live.probed, true);
		} finally {
			await removeHome(home);
		}
	});

	test('symlinks are not anchors', async () => {
		const home = await tempHome(0o700);
		const elsewhere = await tempHome(0o700);
		const linkHome = `${home}-link`;
		try {
			const cert = await selfSigned(elsewhere, 'leaf');
			await writeLock(elsewhere, { port: 9, bind: '127.0.0.1' });
			await writeCert(elsewhere, cert.certPem);
			await symlink(join(elsewhere, 'server.lock'), join(home, 'server.lock'));
			await writeCert(home, cert.certPem);
			const lockLink = await discoverProbed(home);
			assert.strictEqual(lockLink.target, undefined);
			assert.strictEqual(lockLink.probed, false);

			await rm(join(home, 'server.lock'));
			await writeLock(home, { port: 9, bind: '127.0.0.1' });
			await rm(join(home, 'engine-tls.crt'));
			await symlink(join(elsewhere, 'engine-tls.crt'), join(home, 'engine-tls.crt'));
			const certLink = await discoverProbed(home);
			assert.strictEqual(certLink.target, undefined);

			await rm(join(home, 'engine-tls.crt'));
			await writeCert(home, cert.certPem);
			await symlink(join(home, 'engine-tls.crt'), join(home, 'server.sock'));
			const sockLink = await discoverProbed(home);
			assert.strictEqual(sockLink.target?.kind, 'tcp');

			await symlink(home, linkHome);
			const homeLink = await discoverProbed(linkHome);
			assert.strictEqual(homeLink.target, undefined);
		} finally {
			await rm(linkHome, { force: true });
			await removeHome(home);
			await removeHome(elsewhere);
		}
	});

	test('an empty home env falls back, and Windows skips the mode check and UDS', async () => {
		const parent = await mkdtemp(join(tmpdir(), 'ua-elr11-parent-'));
		const home = join(parent, '.universe-agent');
		const other = await tempHome(0o700);
		try {
			await mkdir(home);
			await chmod(home, 0o700);
			const cert = await selfSigned(home, 'leaf');
			await writeLock(home, { port: 11, bind: '127.0.0.1' });
			await writeCert(home, cert.certPem);
			const fallback = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: '' },
				homedir: parent,
				uid,
				platform: 'linux',
				probeHealth: async () => true,
			});
			assert.strictEqual(fallback?.kind, 'tcp');
			if (fallback?.kind === 'tcp') {
				assert.strictEqual(fallback.address, '127.0.0.1:11');
			}

			await writeLock(other, { port: 22, bind: '127.0.0.1' }, 0o666);
			await writeCert(other, cert.certPem, 0o666);
			const windows = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: other },
				uid,
				platform: 'win32',
				probeHealth: async () => true,
			});
			assert.strictEqual(windows?.kind, 'tcp');
			const posix = await findLocalEngine({
				env: { UNIVERSE_AGENT_HOME: other },
				uid,
				platform: 'linux',
				probeHealth: async () => true,
			});
			assert.strictEqual(posix, undefined);

			const sockHome = await tempHome(0o700);
			try {
				await bindHealthServer(`unix:${join(sockHome, 'server.sock')}`, grpc.ServerCredentials.createInsecure()).then(async server => {
					try {
						const skipped = await findLocalEngine({
							env: { UNIVERSE_AGENT_HOME: sockHome },
							uid,
							platform: 'win32',
							probeHealth: async () => true,
						});
						assert.strictEqual(skipped, undefined);
					} finally {
						await server.close();
					}
				});
			} finally {
				await removeHome(sockHome);
			}
		} finally {
			await removeHome(parent);
			await removeHome(other);
		}
	});

	test('production sources no longer probe fixed ports or skip the TLS pin', () => {
		const needles = ['createLoopback' + 'Tls', 'findLocalEnginePort', 'probeLocalEnginePort', 'LOCAL_ENGINE_PROBE_PORTS'];
		for (const needle of needles) {
			let stdout = '';
			let status = 0;
			try {
				stdout = execFileSync('rg', ['-n', '--glob', '!**/test/**', needle, 'src/vs'], { encoding: 'utf8' });
			} catch (error) {
				const failed = error as { status?: number; stdout?: string | Buffer };
				status = failed.status ?? 1;
				stdout = typeof failed.stdout === 'string' ? failed.stdout : failed.stdout?.toString('utf8') ?? '';
			}
			assert.strictEqual(stdout, '', needle);
			assert.strictEqual(status, 1, needle);
		}
	});
});

async function discoverProbed(home: string, override: { uid?: number } = {}): Promise<{ target: LocalEngineTarget | undefined; probed: boolean }> {
	let probed = false;
	const target = await findLocalEngine({
		env: { UNIVERSE_AGENT_HOME: home },
		uid: override.uid ?? (typeof process.getuid === 'function' ? process.getuid() : 0),
		platform: 'linux',
		probeHealth: async () => {
			probed = true;
			return true;
		},
	});
	return { target, probed };
}

async function tempHome(mode: number): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'ua-elr11-'));
	await chmod(dir, mode);
	return dir;
}

async function removeHome(dir: string): Promise<void> {
	await rm(dir, { recursive: true, force: true });
}

interface CertMaterial {
	readonly certPem: string;
	readonly keyPem: string;
	readonly der: Uint8Array;
	readonly fingerprint: string;
}

async function selfSigned(dir: string, name: string): Promise<CertMaterial> {
	const keyPath = join(dir, `${name}.key`);
	const certPath = join(dir, `${name}.crt`);
	execFileSync('openssl', [
		'req', '-x509', '-newkey', 'rsa:2048',
		'-keyout', keyPath, '-out', certPath,
		'-days', '1', '-nodes', '-subj', `/CN=${name}`,
	], { stdio: 'ignore' });
	const certPem = await readFile(certPath, 'utf8');
	const keyPem = await readFile(keyPath, 'utf8');
	const der = new Uint8Array(new X509Certificate(certPem).raw);
	return { certPem, keyPem, der, fingerprint: deriveEngineLeafFingerprintHex(der) };
}

async function writeLock(home: string, body: unknown, mode = 0o600): Promise<void> {
	await writeRaw(home, 'server.lock', JSON.stringify(body), mode);
}

async function writeCert(home: string, pem: string, mode = 0o600): Promise<void> {
	await writeRaw(home, 'engine-tls.crt', pem, mode);
}

async function writeRaw(home: string, name: string, contents: string, mode = 0o600): Promise<void> {
	const path = join(home, name);
	await writeFile(path, contents);
	await chmod(path, mode);
}

function tlsCredentials(cert: CertMaterial): grpc.ServerCredentials {
	return grpc.ServerCredentials.createSsl(null, [{
		private_key: Buffer.from(cert.keyPem),
		cert_chain: Buffer.from(cert.certPem),
	}], false);
}

async function bindHealthServer(address: string, credentials: grpc.ServerCredentials): Promise<{ readonly port: number; close(): Promise<void> }> {
	await loadGrpcModule();
	const server = new grpc.Server();
	const healthPath = `/${UniverseAgentGrpcServices.System.service}/${UniverseAgentGrpcServices.System.HealthCheck}`;
	const method: grpc.MethodDefinition<Buffer, Buffer> = {
		path: healthPath,
		requestStream: false,
		responseStream: false,
		requestSerialize: (value: Buffer) => Buffer.from(value),
		requestDeserialize: (value: Buffer) => value,
		responseSerialize: (value: Buffer) => Buffer.from(value),
		responseDeserialize: (value: Buffer) => value,
	};
	server.addService({ HealthCheck: method }, {
		HealthCheck: (_call: grpc.ServerUnaryCall<Buffer, Buffer>, callback: grpc.sendUnaryData<Buffer>) => {
			callback(null, Buffer.alloc(0));
		},
	});
	const port = await new Promise<number>((resolveBind, rejectBind) => {
		server.bindAsync(address, credentials, (error, boundPort) => {
			if (error) {
				rejectBind(error);
				return;
			}
			resolveBind(boundPort);
		});
	});
	return {
		port,
		close: () => new Promise(done => server.tryShutdown(() => done())),
	};
}

function listenDeadSocket(path: string): Promise<Server> {
	const server = createServer(socket => socket.destroy());
	return new Promise((resolveListen, rejectListen) => {
		server.once('error', rejectListen);
		server.listen(path, () => {
			server.off('error', rejectListen);
			resolveListen(server);
		});
	});
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../base/common/event.js';
import { timeout } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { UniverseAgentConnectionChannelClient } from '../../common/universeAgentConnectionChannelClient.js';
import { UniverseAgentHubChannelClient } from '../../common/universeAgentHubChannelClient.js';
import {
	asConnectionProfileList,
	createIdleCapabilitySnapshot,
	createRemoteForwardingProxy,
	ensureCapabilitySnapshot,
	isUniverseAgentPhaseConnected,
	readCapabilityEntry,
	sanitizeDesktopCapabilitySnapshot,
	WEB_UNSUPPORTED_LOCAL_ENGINE_REASON,
	UniverseAgentConnectionSyncCache,
	UniverseAgentHubSyncCache,
} from '../../common/universeAgentRendererSync.js';

suite('universeAgentRendererSync', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('desktop idle snapshot never uses the Web unsupported reason', () => {
		const idle = createIdleCapabilitySnapshot();
		for (const entry of Object.values(idle)) {
			assert.notStrictEqual(entry.reason, WEB_UNSUPPORTED_LOCAL_ENGINE_REASON);
			assert.strictEqual(entry.support, 'UNKNOWN');
		}
	});

	test('sanitizeDesktopCapabilitySnapshot strips Web stub pollution', () => {
		const polluted = {
			...createIdleCapabilitySnapshot(),
			skills: { support: 'UNSUPPORTED' as const, reason: WEB_UNSUPPORTED_LOCAL_ENGINE_REASON },
			models: { support: 'UNSUPPORTED' as const, reason: WEB_UNSUPPORTED_LOCAL_ENGINE_REASON },
		};
		const clean = sanitizeDesktopCapabilitySnapshot(polluted);
		assert.strictEqual(clean.skills.support, 'UNKNOWN');
		assert.strictEqual(clean.skills.reason, undefined);
		assert.strictEqual(clean.models.support, 'UNKNOWN');
		assert.strictEqual(clean.providerConfig.support, 'UNKNOWN');
	});

	test('connection cache drops Web stub capability reasons from IPC snapshots', () => {
		const cache = new UniverseAgentConnectionSyncCache();
		const capabilities = {
			...createIdleCapabilitySnapshot(),
			mcp: { support: 'UNSUPPORTED' as const, reason: WEB_UNSUPPORTED_LOCAL_ENGINE_REASON },
		};
		cache.applySnapshot({
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities,
		});
		assert.strictEqual(cache.capabilities.mcp.support, 'UNKNOWN');
		assert.notStrictEqual(cache.capabilities.mcp.reason, WEB_UNSUPPORTED_LOCAL_ENGINE_REASON);
	});

	test('readCapabilityEntry defaults missing keys to UNKNOWN', () => {
		assert.deepStrictEqual(readCapabilityEntry(undefined, 'providerConfig'), { support: 'UNKNOWN' });
		assert.deepStrictEqual(readCapabilityEntry({} as never, 'models'), { support: 'UNKNOWN' });
		assert.strictEqual(readCapabilityEntry(createIdleCapabilitySnapshot(), 'hooksMetadata').support, 'UNKNOWN');
		assert.strictEqual(ensureCapabilitySnapshot(Promise.resolve({}) as never).providerConfig.support, 'UNKNOWN');
	});

	test('asConnectionProfileList rejects a Promise (ProxyChannel shape)', () => {
		assert.deepStrictEqual(asConnectionProfileList(Promise.resolve([])), []);
		assert.deepStrictEqual(asConnectionProfileList([{
			profileId: 'p1',
			displayName: 'Direct',
			state: 'active',
			hasTrust: false,
			targetKind: 'directAddress',
		}]), [{
			profileId: 'p1',
			displayName: 'Direct',
			state: 'active',
			hasTrust: false,
			targetKind: 'directAddress',
		}]);
	});

	test('phase connected is the only Engine-open signal', () => {
		assert.strictEqual(isUniverseAgentPhaseConnected({ kind: 'disconnected' }), false);
		assert.strictEqual(isUniverseAgentPhaseConnected({ kind: 'connecting', reason: 'initial' }), false);
		assert.strictEqual(isUniverseAgentPhaseConnected({ kind: 'connected', path: 'direct' }), true);
		assert.strictEqual(isUniverseAgentPhaseConnected(undefined), false);
	});

	test('connection cache prefers phase.kind for connected', () => {
		const cache = new UniverseAgentConnectionSyncCache();
		cache.applySnapshot({
			transport: 'ok',
			sessionToken: 'tok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
		});
		assert.strictEqual(cache.connected, false);
		cache.applyPhase({ kind: 'connected', path: 'direct' });
		assert.strictEqual(cache.connected, true);
		assert.strictEqual(cache.capabilities.providerConfig.support, 'UNKNOWN');
	});

	test('connection cache reads sessionListCapability from snapshot dedicated field', () => {
		const cache = new UniverseAgentConnectionSyncCache();
		assert.strictEqual(cache.navigatorCapability('sessionList'), 'UNKNOWN');
		cache.applySnapshot({
			transport: 'ok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
			sessionListCapability: 'SUPPORTED',
		});
		assert.strictEqual(cache.navigatorCapability('sessionList'), 'SUPPORTED');
		assert.strictEqual(cache.snapshot.sessionListCapability, 'SUPPORTED');
		assert.strictEqual(Object.hasOwn(cache.capabilities, 'sessionList'), false);
		cache.applySnapshot({
			transport: 'ok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
			sessionListCapability: 'UNSUPPORTED',
		});
		assert.strictEqual(cache.navigatorCapability('sessionList'), 'UNSUPPORTED');
	});

	test('hub cache maps a Promise list to empty until a real array arrives', () => {
		const cache = new UniverseAgentHubSyncCache();
		cache.applyProfiles(Promise.resolve([{ profileId: 'x' }]));
		assert.strictEqual(cache.profiles.length, 0);
		cache.applyProfiles([{
			profileId: 'p1',
			displayName: 'Direct',
			state: 'active',
			hasTrust: false,
			targetKind: 'directAddress',
		}]);
		assert.strictEqual(cache.profiles[0]?.profileId, 'p1');
	});

	test('connection channel client finalizes connectProfile pairing fields after IPC', async () => {
		const snapshot = {
			transport: 'idle' as const,
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
		};
		const channel: IChannel = {
			call: (command: string): Promise<any> => {
				switch (command) {
					case 'getConnectionSnapshot':
						return Promise.resolve(snapshot);
					case 'getConnectionPhase':
						return Promise.resolve({ kind: 'disconnected' });
					case 'isAgentTreeFetchFailed':
						return Promise.resolve(false);
					case 'connectProfile':
						return Promise.resolve({
							ok: true,
							path: 'direct',
							pairingPending: true,
							sasCode: 'ABCD-EFGH',
							engineIdentityId: 'eng-1',
						});
					default:
						return Promise.resolve(undefined);
				}
			},
			listen: () => Event.None,
		};
		const client = store.add(new UniverseAgentConnectionChannelClient(channel));
		const result = await client.connectProfile('profile-1');
		assert.strictEqual(result.ok, true);
		if (result.ok) {
			assert.strictEqual(result.pairingPending, true);
			assert.strictEqual(result.sasCode, 'ABCD-EFGH');
			assert.strictEqual(result.engineIdentityId, 'eng-1');
		}
	});

	test('connection channel client rejects pairingPending without sas or recoverTrust', async () => {
		const snapshot = {
			transport: 'idle' as const,
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
		};
		const channel: IChannel = {
			call: (command: string): Promise<any> => {
				switch (command) {
					case 'getConnectionSnapshot':
						return Promise.resolve(snapshot);
					case 'getConnectionPhase':
						return Promise.resolve({ kind: 'disconnected' });
					case 'isAgentTreeFetchFailed':
						return Promise.resolve(false);
					case 'connectProfile':
						return Promise.resolve({ ok: true, path: 'direct', pairingPending: true });
					default:
						return Promise.resolve(undefined);
				}
			},
			listen: () => Event.None,
		};
		const client = store.add(new UniverseAgentConnectionChannelClient(channel));
		const result = await client.connectProfile('profile-1');
		assert.strictEqual(result.ok, false);
	});

	test('connection channel client keeps confirmPairing grantPending without sas', async () => {
		const snapshot = {
			transport: 'idle' as const,
			pairingPending: true,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
		};
		const channel: IChannel = {
			call: (command: string): Promise<any> => {
				switch (command) {
					case 'getConnectionSnapshot':
						return Promise.resolve(snapshot);
					case 'getConnectionPhase':
						return Promise.resolve({ kind: 'connecting', reason: 'initial' });
					case 'isAgentTreeFetchFailed':
						return Promise.resolve(false);
					case 'confirmPairing':
						return Promise.resolve({
							ok: true,
							path: 'direct',
							pairingPending: true,
							grantPending: true,
							engineIdentityId: 'eng-1',
						});
					default:
						return Promise.resolve(undefined);
				}
			},
			listen: () => Event.None,
		};
		const client = store.add(new UniverseAgentConnectionChannelClient(channel));
		const result = await client.confirmPairing();
		assert.strictEqual(result.ok, true);
		if (result.ok) {
			assert.strictEqual(result.pairingPending, true);
			assert.strictEqual(result.grantPending, true);
			assert.strictEqual(result.sasCode, undefined);
			assert.strictEqual(result.engineIdentityId, 'eng-1');
		}
	});

	test('forwarding proxy does not let an undefined local resumeSession shadow remote', async () => {
		const resumeCalls: string[] = [];
		const remote = {
			async resumeSession(request: { sessionId: string }) {
				resumeCalls.push(request.sessionId);
				return { ok: true };
			},
		};
		const local = {
			resumeSession: undefined as undefined,
			getCapabilitySnapshot: () => createIdleCapabilitySnapshot(),
		};
		const client = createRemoteForwardingProxy(local, remote);
		assert.strictEqual(typeof client.resumeSession, 'function');
		assert.deepStrictEqual(await (client as unknown as typeof remote).resumeSession({ sessionId: 'session-100' }), { ok: true });
		assert.deepStrictEqual(resumeCalls, ['session-100']);
	});

	test('connection channel client resumeSession is a function and hits IPC', async () => {
		const snapshot = {
			transport: 'idle' as const,
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
		};
		const commands: string[] = [];
		const channel: IChannel = {
			call: (command: string, args?: unknown[]): Promise<any> => {
				commands.push(command);
				switch (command) {
					case 'getConnectionSnapshot':
						return Promise.resolve(snapshot);
					case 'getConnectionPhase':
						return Promise.resolve({ kind: 'disconnected' });
					case 'isAgentTreeFetchFailed':
						return Promise.resolve(false);
					case 'resumeSession':
						return Promise.resolve({ ok: true, message: args?.[0] ? JSON.stringify(args[0]) : '' });
					default:
						return Promise.resolve(undefined);
				}
			},
			listen: () => Event.None,
		};
		const client = store.add(new UniverseAgentConnectionChannelClient(channel));
		assert.strictEqual(typeof client.resumeSession, 'function');
		const result = await client.resumeSession({ sessionId: 'session-100' });
		assert.strictEqual(result.ok, true);
		assert.ok(commands.includes('resumeSession'));
	});

	test('forwarding proxy keeps local sync getters and forwards the rest', async () => {
		const remote = {
			getCapabilitySnapshot: async () => ({ providerConfig: undefined }),
			connectProfile: async () => ({ ok: true, path: 'direct', pairingPending: false }),
		};
		const local = {
			getCapabilitySnapshot: () => createIdleCapabilitySnapshot(),
		};
		const client = createRemoteForwardingProxy(local, remote);
		assert.strictEqual(client.getCapabilitySnapshot().providerConfig.support, 'UNKNOWN');
		assert.deepStrictEqual(await (client as unknown as typeof remote).connectProfile(), { ok: true, path: 'direct', pairingPending: false });
	});

	test('connection channel client connected phase with pairingPending is not engine connected', async () => {
		const snapshot = {
			transport: 'ok' as const,
			pairingPending: true,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
		};
		const channel: IChannel = {
			call: (command: string): Promise<any> => {
				switch (command) {
					case 'getConnectionSnapshot':
						return Promise.resolve(snapshot);
					case 'getConnectionPhase':
						return Promise.resolve({ kind: 'connected', path: 'direct' });
					case 'isAgentTreeFetchFailed':
						return Promise.resolve(false);
					default:
						return Promise.resolve(undefined);
				}
			},
			listen: () => Event.None,
		};
		const client = store.add(new UniverseAgentConnectionChannelClient(channel));
		await timeout(0);
		assert.strictEqual(client.getConnectionPhase().kind, 'connected');
		assert.strictEqual(client.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(client.isEngineConnected(), false);
	});

	test('connection channel client hydrates sync getters from async IPC', async () => {
		const snapshot = {
			transport: 'idle' as const,
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
			sessionListCapability: 'SUPPORTED' as const,
		};
		const channel: IChannel = {
			call: (command: string): Promise<any> => {
				switch (command) {
					case 'getConnectionSnapshot':
						return Promise.resolve(snapshot);
					case 'getConnectionPhase':
						return Promise.resolve({ kind: 'disconnected' });
					case 'isAgentTreeFetchFailed':
						return Promise.resolve(false);
					case 'isEngineConnected':
						return Promise.resolve(true);
					default:
						return Promise.resolve(undefined);
				}
			},
			listen: () => Event.None,
		};
		const client = store.add(new UniverseAgentConnectionChannelClient(channel));
		await timeout(0);
		assert.strictEqual(client.getConnectionPhase().kind, 'disconnected');
		assert.strictEqual(client.isEngineConnected(), false);
		assert.strictEqual(client.getCapabilitySnapshot().providerConfig.support, 'UNKNOWN');
		assert.notStrictEqual(typeof (client.getCapabilitySnapshot() as { then?: unknown }).then, 'function');
		assert.strictEqual(client.getNavigatorCapability('sessionList'), 'SUPPORTED');
		assert.strictEqual(client.getConnectionSnapshot().sessionListCapability, 'SUPPORTED');
	});

	test('connection channel client hydrate IPC reject keeps pre-hydrate defaults without unhandled rejection', async () => {
		const rejectedSnapshot = {
			transport: 'ok' as const,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: true,
			capabilities: createIdleCapabilitySnapshot(),
		};
		const channel: IChannel = {
			call: (command: string): Promise<any> => {
				switch (command) {
					case 'getConnectionSnapshot':
						return Promise.resolve(rejectedSnapshot);
					case 'getConnectionPhase':
						return Promise.reject(new Error('ipc hydrate phase'));
					case 'isAgentTreeFetchFailed':
						return Promise.resolve(true);
					default:
						return Promise.resolve(undefined);
				}
			},
			listen: () => Event.None,
		};
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		process.on('unhandledRejection', onUnhandled);
		try {
			const client = store.add(new UniverseAgentConnectionChannelClient(channel));
			let fires = 0;
			store.add(client.onDidChangeConnection(() => { fires++; }));
			await timeout(0);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(fires, 0);
			assert.strictEqual(client.getConnectionPhase().kind, 'disconnected');
			assert.strictEqual(client.isEngineConnected(), false);
			assert.strictEqual(client.getTransportState(), 'idle');
			assert.strictEqual(client.isAgentTreeFetchFailed(), false);
			assert.strictEqual(client.getConnectionSnapshot().transport, 'idle');
			assert.strictEqual(client.getCapabilitySnapshot().providerConfig.support, 'UNKNOWN');
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('connection channel client refreshPhase IPC reject keeps last-good phase without unhandled rejection', async () => {
		const idleSnapshot = {
			transport: 'idle' as const,
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
		};
		const incomingSnapshot = {
			transport: 'ok' as const,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
		};
		let rejectRefresh = false;
		const connectionChanges = new Emitter<typeof incomingSnapshot>();
		store.add(connectionChanges);
		const channel: IChannel = {
			call: (command: string): Promise<any> => {
				switch (command) {
					case 'getConnectionSnapshot':
						return Promise.resolve(idleSnapshot);
					case 'getConnectionPhase':
						return rejectRefresh
							? Promise.reject(new Error('ipc refresh phase'))
							: Promise.resolve({ kind: 'disconnected' });
					case 'isAgentTreeFetchFailed':
						return Promise.resolve(rejectRefresh);
					default:
						return Promise.resolve(undefined);
				}
			},
			listen: (event: string) => event === 'onDidChangeConnection' ? connectionChanges.event : Event.None,
		};
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		process.on('unhandledRejection', onUnhandled);
		try {
			const client = store.add(new UniverseAgentConnectionChannelClient(channel));
			let fires = 0;
			store.add(client.onDidChangeConnection(() => { fires++; }));
			await timeout(0);
			assert.strictEqual(fires, 1);
			assert.strictEqual(client.getConnectionPhase().kind, 'disconnected');
			assert.strictEqual(client.getConnectionSnapshot().transport, 'idle');
			rejectRefresh = true;
			connectionChanges.fire(incomingSnapshot);
			await timeout(0);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(fires, 1);
			assert.strictEqual(client.getConnectionSnapshot().transport, 'ok');
			assert.strictEqual(client.getConnectionPhase().kind, 'disconnected');
			assert.strictEqual(client.isEngineConnected(), false);
			assert.strictEqual(client.isAgentTreeFetchFailed(), false);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('hub channel client hydrates listConnectionProfiles to a real array', async () => {
		const profiles = [{
			profileId: 'p1',
			displayName: '127.0.0.1:50061',
			state: 'active' as const,
			hasTrust: false,
			targetKind: 'directAddress' as const,
		}];
		const channel: IChannel = {
			call: (command: string): Promise<any> => {
				switch (command) {
					case 'listConnectionProfiles':
						return Promise.resolve(profiles);
					case 'getAuthStatus':
						return Promise.resolve({ kind: 'signedOut' });
					case 'getDirectoryStatus':
						return Promise.resolve({ kind: 'idle' });
					case 'getActiveHubBaseUrl':
						return Promise.resolve(undefined);
					default:
						return Promise.resolve(undefined);
				}
			},
			listen: () => Event.None,
		};
		const client = store.add(new UniverseAgentHubChannelClient(channel));
		await timeout(0);
		assert.strictEqual(client.listConnectionProfiles()[0]?.profileId, 'p1');
		assert.ok(Array.isArray(client.listConnectionProfiles()));
	});

	test('hub channel client hydrate IPC reject keeps pre-hydrate defaults without unhandled rejection', async () => {
		const profiles = [{
			profileId: 'p-rejected',
			displayName: 'hub.example',
			state: 'active' as const,
			hasTrust: true,
			targetKind: 'hubDevice' as const,
		}];
		const channel: IChannel = {
			call: (command: string): Promise<any> => {
				switch (command) {
					case 'listConnectionProfiles':
						return Promise.resolve(profiles);
					case 'getAuthStatus':
						return Promise.reject(new Error('ipc hydrate auth'));
					case 'getDirectoryStatus':
						return Promise.resolve({ kind: 'ok', devices: [] });
					case 'getActiveHubBaseUrl':
						return Promise.resolve('https://hub.example');
					default:
						return Promise.resolve(undefined);
				}
			},
			listen: () => Event.None,
		};
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		process.on('unhandledRejection', onUnhandled);
		try {
			const client = store.add(new UniverseAgentHubChannelClient(channel));
			let authFires = 0;
			let directoryFires = 0;
			let profileFires = 0;
			store.add(client.onDidChangeAuthStatus(() => { authFires++; }));
			store.add(client.onDidChangeDirectory(() => { directoryFires++; }));
			store.add(client.onDidChangeProfiles(() => { profileFires++; }));
			await timeout(0);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(authFires, 0);
			assert.strictEqual(directoryFires, 0);
			assert.strictEqual(profileFires, 0);
			assert.strictEqual(client.getAuthStatus().kind, 'signedOut');
			assert.strictEqual(client.getDirectoryStatus().kind, 'idle');
			assert.deepStrictEqual(client.listConnectionProfiles(), []);
			assert.strictEqual(client.getActiveHubBaseUrl(), undefined);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});
});

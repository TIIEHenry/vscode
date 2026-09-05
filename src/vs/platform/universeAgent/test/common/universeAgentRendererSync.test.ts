/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
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
	UniverseAgentConnectionSyncCache,
	UniverseAgentHubSyncCache,
} from '../../common/universeAgentRendererSync.js';

suite('universeAgentRendererSync', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

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

	test('hub cache maps a Promise list to empty until a real array arrives', () => {
		const cache = new UniverseAgentHubSyncCache();
		cache.applyProfiles(Promise.resolve([{ profileId: 'x' }]));
		assert.deepStrictEqual(cache.profiles, []);
		cache.applyProfiles([{
			profileId: 'p1',
			displayName: 'Direct',
			state: 'active',
			hasTrust: false,
			targetKind: 'directAddress',
		}]);
		assert.strictEqual(cache.profiles[0]?.profileId, 'p1');
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

	test('connection channel client hydrates sync getters from async IPC', async () => {
		const snapshot = {
			transport: 'idle' as const,
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
		};
		const channel: IChannel = {
			call: (command: string) => {
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
		assert.notStrictEqual(typeof client.getCapabilitySnapshot().then, 'function');
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
			call: (command: string) => {
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
});

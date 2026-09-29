/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentConnectResult } from '../../common/universeAgentTypes.js';
import type { GrpcUniverseAgentClient } from '../../node/grpc/grpcClient.js';
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
		assert.strictEqual(service.getConnectionSnapshot().sessionToken, undefined);
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { SessionId } from '../../common/sessionView/types.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

function coreOf(viewHost: SessionViewHost) {
	return (viewHost as unknown as {
		core: {
			leaseCount(id: SessionId): number;
			attemptId(id: SessionId): string | null;
		};
	}).core;
}

function streamsOf(viewHost: SessionViewHost) {
	return (viewHost as unknown as { streams: Map<string, { readonly attemptId: string; readonly sessionId: string }> }).streams;
}

function leasesOf(viewHost: SessionViewHost) {
	return (viewHost as unknown as {
		leases: Map<string, {
			readonly leaseId: unknown;
			readonly sessionId: string;
			orphanTimer?: ReturnType<typeof setTimeout>;
		}>;
	}).leases;
}

function reopenTimersOf(viewHost: SessionViewHost) {
	return (viewHost as unknown as { reopenTimers: Map<string, unknown> }).reopenTimers;
}

function sidecarsOf(viewHost: SessionViewHost) {
	return (viewHost as unknown as {
		sessionSidecars: Map<string, {
			tree?: { isUnsupported(): boolean };
		}>;
	}).sessionSidecars;
}

function createDeferredTimeout() {
	const delays: number[] = [];
	const pending = new Map<number, () => void>();
	let nextId = 1;
	const setTimeoutFn = (fn: () => void, delay?: number) => {
		delays.push(delay ?? 0);
		const id = nextId++;
		pending.set(id, fn);
		return id as unknown as ReturnType<typeof setTimeout>;
	};
	const clearTimeoutFn = (handle: ReturnType<typeof setTimeout>) => {
		pending.delete(handle as unknown as number);
	};
	const fireAll = (): void => {
		const jobs = [...pending.values()];
		pending.clear();
		for (const job of jobs) {
			job();
		}
	};
	return { delays, setTimeoutFn, clearTimeoutFn, fireAll, pending };
}

suite('SessionViewHost disposal', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('dispose cleans up active streams and underlying subscriptions', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-stream');
		await viewHost.whenEngineSessionReady('sess-stream');

		assert.strictEqual(connection.subscribeCalls.length, 1);
		assert.strictEqual(streamsOf(viewHost).size, 1);
		assert.strictEqual((connection as unknown as { streamListeners: Map<string, unknown[]> }).streamListeners.get('sess-stream')?.length, 1);

		viewHost.dispose();

		assert.strictEqual(streamsOf(viewHost).size, 0);
		assert.strictEqual((connection as unknown as { streamListeners: Map<string, unknown[]> }).streamListeners.get('sess-stream')?.length, 0);

		// Multiple dispose calls are idempotent
		viewHost.dispose();
		assert.strictEqual(streamsOf(viewHost).size, 0);
	});

	test('dispose releases leases and clears orphan timers', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 60_000,
		}));
		const leaseId = viewHost.acquireLease('sess-orphan');

		assert.strictEqual(leasesOf(viewHost).size, 1);
		const binding = leasesOf(viewHost).get(leaseId);
		assert.ok(binding);
		assert.ok(binding.orphanTimer !== undefined);

		viewHost.dispose();

		assert.strictEqual(leasesOf(viewHost).size, 0);
		assert.strictEqual(coreOf(viewHost).leaseCount('sess-orphan' as SessionId), 0);
	});

	test('dispose cancels reopen timers and clears fail-closed recovery', async () => {
		const connection = new TestConnection();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-reopen');
		await viewHost.whenEngineSessionReady('sess-reopen');

		connection.fireStreamClosed('sess-reopen', { kind: 'remote' });
		assert.strictEqual(reopenTimersOf(viewHost).size, 1);
		assert.strictEqual(clock.pending.size, 1);

		viewHost.dispose();

		assert.strictEqual(reopenTimersOf(viewHost).size, 0);
		assert.strictEqual(clock.pending.size, 0);

		clock.fireAll();
		assert.strictEqual(connection.subscribeCalls.length, 1);
	});

	test('dispose prevents subsequent post operations', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-post');
		await viewHost.whenEngineSessionReady('sess-post');

		viewHost.dispose();

		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: 'hello' });
		assert.strictEqual(outcome.accepted, false);
		assert.strictEqual(outcome.reason, 'no_such_session');
	});

	test('dispose guards against subsequent stream open and connection events', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));

		viewHost.dispose();

		viewHost.onEngineConnectionChanged();
		assert.strictEqual(connection.subscribeCalls.length, 0);
		assert.strictEqual(streamsOf(viewHost).size, 0);

		// Internal openStream call guarded by _disposed
		(viewHost as unknown as { openStream(id: string, attempt: number): void }).openStream('sess-test', 1);
		assert.strictEqual(connection.subscribeCalls.length, 0);
	});

	test('dispose cleans up sidecars and tree coordinators', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.acquireLease('sess-sidecar');
		assert.strictEqual(sidecarsOf(viewHost).size, 1);

		viewHost.dispose();
		assert.strictEqual(sidecarsOf(viewHost).size, 0);
	});

	test('heartbeat ack returns immediately if disposed', async () => {
		const connection = new TestConnection();
		let chatCalled = false;
		connection.chat = async () => { chatCalled = true; };
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));

		viewHost.dispose();

		await (viewHost as unknown as { sendHeartbeatAck(id: string): Promise<void> }).sendHeartbeatAck('sess-hb');
		assert.strictEqual(chatCalled, false);
	});
});

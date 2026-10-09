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

	test('disposed writeChat does not chat or resident-write', async () => {
		const connection = new class extends TestConnection {
			readonly chatCalls: unknown[] = [];
			readonly residentWrites: unknown[] = [];
			override async chat(request?: { readonly sessionId: string; readonly payload: unknown }): Promise<void> {
				this.chatCalls.push(request);
			}
			openChatStream(): { write(payload: unknown): void; dispose(): void } {
				return {
					write: payload => { this.residentWrites.push(payload); },
					dispose: () => { },
				};
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-write-disposed');
		await viewHost.whenEngineSessionReady('sess-write-disposed');

		const posts = recordPosts(viewHost);
		viewHost.dispose();
		const receiptsBefore = posts.length;
		const host = asWriteHost(viewHost);

		await host.writeChat('sess-write-disposed', 'corr-w', { text: 'hi' }, 'attempt-w', 'write-w');
		assert.deepStrictEqual(connection.chatCalls, [], 'cached engine id must not fall through to connection.chat');
		assert.deepStrictEqual(connection.residentWrites, [], 'dispose clears the live handle; writeChat must not have written it');
		assert.deepStrictEqual(receiptPosts(posts, receiptsBefore), [], 'disposed writeChat must not post a delivery receipt');

		const lateWrites: unknown[] = [];
		host.chatStreams.set('sess-write-disposed', {
			chatAttemptId: 'attempt-w',
			write: payload => { lateWrites.push(payload); },
			dispose: () => { },
		});
		await host.writeChat('sess-write-disposed', 'corr-w2', { text: 'again' }, 'attempt-w', 'write-w2');
		assert.deepStrictEqual(lateWrites, [], 'a resident handle must not be written after dispose');
		assert.deepStrictEqual(connection.chatCalls, []);
		assert.deepStrictEqual(receiptPosts(posts, receiptsBefore), []);

		connection.setEngineConnected(false);
		await host.writeChat('sess-write-disposed', 'corr-w3', { text: 'down' }, 'attempt-w', 'write-w3');
		assert.deepStrictEqual(lateWrites, []);
		assert.deepStrictEqual(connection.chatCalls, []);
		assert.deepStrictEqual(receiptPosts(posts, receiptsBefore), [], 'disconnected writeChat must not mark failed after dispose');
	});

	test('disposed fillHistory does not getHistory', async () => {
		const connection = new class extends TestConnection {
			readonly historyCalls: unknown[] = [];
			override async getHistory(request?: unknown) {
				this.historyCalls.push(request ?? null);
				return { envelopes: [] };
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-hist-disposed');
		await viewHost.whenEngineSessionReady('sess-hist-disposed');

		const posts = recordPosts(viewHost);
		viewHost.dispose();
		const receiptsBefore = posts.length;
		const host = asHistoryHost(viewHost);
		const intent = {
			do: 'fillHistoryGap' as const,
			attemptId: 'attempt-h',
			requestId: 'req-h',
			fromExclusive: 0,
			toInclusive: 2,
		};

		await host.fillHistory('sess-hist-disposed', intent);
		assert.deepStrictEqual(connection.historyCalls, []);
		assert.deepStrictEqual(receiptPosts(posts, receiptsBefore), [], 'disposed fillHistory must not post historyResult');

		connection.setEngineConnected(false);
		await host.fillHistory('sess-hist-disposed', { ...intent, requestId: 'req-h-down' });
		assert.deepStrictEqual(connection.historyCalls, []);
		assert.deepStrictEqual(receiptPosts(posts, receiptsBefore), [], 'disconnected fillHistory must not post a failure after dispose');
	});

	test('dispose during in-flight editMessage posts no commandOutcome', async () => {
		let releaseEdit: (result: { ok: true }) => void = () => { };
		let markEntered: () => void = () => { };
		const entered = new Promise<void>(resolve => { markEntered = resolve; });
		const connection = new class extends TestConnection {
			readonly chatCalls: unknown[] = [];
			readonly editCalls: unknown[] = [];
			override async chat(request?: { readonly sessionId: string; readonly payload: unknown }): Promise<void> {
				this.chatCalls.push(request);
			}
			async editMessage(request: { sessionId: string; turnId: string; newContent: string; agentId?: string; operationId?: string }): Promise<{ ok: true }> {
				this.editCalls.push(request);
				markEntered();
				return new Promise(resolve => { releaseEdit = resolve; });
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-edit-disposed');
		await viewHost.whenEngineSessionReady('sess-edit-disposed');

		const posts = recordPosts(viewHost);
		const outcome = viewHost.post(leaseId, {
			kind: 'regenerateTurn',
			userTurnId: 'user-turn-1',
			preservedContent: 'hello again',
		});
		assert.strictEqual(outcome.accepted, true);
		await entered;
		assert.strictEqual(connection.editCalls.length, 1);

		const chatBefore = connection.chatCalls.length;
		viewHost.dispose();
		const receiptsBefore = posts.length;
		releaseEdit({ ok: true });
		await new Promise<void>(resolve => setImmediate(() => resolve()));

		assert.strictEqual(connection.editCalls.length, 1);
		assert.strictEqual(connection.chatCalls.length, chatBefore, 'commandOutcome after dispose must not chat');
		assert.deepStrictEqual(receiptPosts(posts, receiptsBefore), [], 'in-flight editMessage must not post commandOutcome after dispose');

		await asEditHost(viewHost).dispatchEditMessage('sess-edit-disposed', {
			do: 'unaryCommand',
			sessionId: 'sess-edit-disposed',
			commandId: 'agent.editMessage',
			correlation: 'corr-edit-late',
			input: { turnId: 'user-turn-1', newContent: 'hello again' },
		});
		assert.strictEqual(connection.editCalls.length, 1, 'editMessage after dispose must not be called');
		assert.strictEqual(connection.chatCalls.length, chatBefore);
		assert.deepStrictEqual(receiptPosts(posts, receiptsBefore), [], 'editMessage after dispose must not post a failure outcome');
	});
});

type PostedMessage = {
	readonly t: string;
	readonly fact?: { readonly kind?: string };
};

function recordPosts(viewHost: SessionViewHost): PostedMessage[] {
	const host = viewHost as unknown as {
		postAndDrain(sessionId: string, msg: PostedMessage): { accepted: boolean };
	};
	const posts: PostedMessage[] = [];
	const original = host.postAndDrain.bind(viewHost);
	host.postAndDrain = (sessionId, msg) => {
		posts.push(msg);
		return original(sessionId, msg);
	};
	return posts;
}

function receiptPosts(posts: readonly PostedMessage[], from: number): PostedMessage[] {
	return posts.slice(from).filter(msg =>
		msg.t === 'historyResult'
		|| msg.fact?.kind === 'commandOutcome'
		|| msg.fact?.kind === 'inputDelivery'
	);
}

function asWriteHost(viewHost: SessionViewHost) {
	return viewHost as unknown as {
		chatStreams: Map<string, { chatAttemptId: string; write(payload: unknown): void; dispose(): void }>;
		writeChat(sessionId: string, correlation: string, payload: unknown, chatAttemptId: string, writeId: string): Promise<void>;
	};
}

function asHistoryHost(viewHost: SessionViewHost) {
	return viewHost as unknown as {
		fillHistory(sessionId: string, intent: {
			do: 'fillHistoryGap';
			attemptId: string;
			requestId: string;
			fromExclusive: number;
			toInclusive: number;
		}): Promise<void>;
	};
}

function asEditHost(viewHost: SessionViewHost) {
	return viewHost as unknown as {
		dispatchEditMessage(sessionId: string, intent: {
			do: 'unaryCommand';
			sessionId: string;
			commandId: string;
			correlation: string;
			input: unknown;
		}): Promise<void>;
	};
}

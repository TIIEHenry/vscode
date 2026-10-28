/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { SessionId, SyncChrome, ViewPatch } from '../../common/sessionView/types.js';
import type { DiagnosticMetric, DiagnosticsPort } from '../../node/sessionCore/ports.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

class CountingDiagnostics implements DiagnosticsPort {
	readonly counts = new Map<string, number>();
	readonly labels: Array<{ readonly metric: string; readonly labels?: Readonly<Record<string, string>> }> = [];

	count(metric: DiagnosticMetric, labels?: Readonly<Record<string, string>>): void {
		this.counts.set(metric, (this.counts.get(metric) ?? 0) + 1);
		this.labels.push({ metric, labels });
	}

	warn(): void { }
}

function coreOf(viewHost: SessionViewHost) {
	return (viewHost as unknown as {
		core: {
			leaseCount(id: SessionId): number;
			attemptId(id: SessionId): string | null;
		};
	}).core;
}

function streamsOf(viewHost: SessionViewHost) {
	return (viewHost as unknown as { streams: Map<string, { readonly attemptId: string }> }).streams;
}

function streamKey(sessionId: string, attemptId: string): string {
	return `${sessionId}:${attemptId}`;
}

function failClosedRecoveryOf(viewHost: SessionViewHost): Set<string> {
	return (viewHost as unknown as { failClosedRecovery: Set<string> }).failClosedRecovery;
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

function syncChromeFromFrames(frames: readonly IUniverseAgentSessionViewFrameEvent[]): SyncChrome[] {
	return frames.flatMap(event => {
		const body = event.frame.frame.body;
		if (body.kind !== 'patches') {
			return [];
		}
		return body.patches.filter((patch): patch is Extract<ViewPatch, { op: 'setSyncChrome' }> => patch.op === 'setSyncChrome');
	}).map(patch => patch.sync);
}

suite('SessionViewHost stream reopen (S2)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('remote close reopens the stream after backoff', async () => {
		const connection = new TestConnection();
		const diagnostics = new CountingDiagnostics();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-reopen');
		await viewHost.whenEngineSessionReady('sess-reopen');
		assert.strictEqual(connection.subscribeCalls.length, 1);
		const firstAttempt = coreOf(viewHost).attemptId('sess-reopen' as SessionId);
		assert.ok(firstAttempt);

		connection.fireStreamClosed('sess-reopen', { kind: 'remote' });
		assert.strictEqual(coreOf(viewHost).attemptId('sess-reopen' as SessionId), null);
		assert.strictEqual(diagnostics.counts.get('stream.reopen_scheduled' as DiagnosticMetric), 1);
		assert.ok(!streamsOf(viewHost).has(streamKey('sess-reopen', firstAttempt)));
		clock.fireAll();
		assert.strictEqual(diagnostics.counts.get('stream.reopen_fired' as DiagnosticMetric), 1);
		assert.strictEqual(connection.subscribeCalls.length, 2);
		const secondAttempt = coreOf(viewHost).attemptId('sess-reopen' as SessionId);
		assert.ok(secondAttempt);
		assert.notStrictEqual(secondAttempt, firstAttempt);
		assert.ok(!streamsOf(viewHost).has(streamKey('sess-reopen', firstAttempt)));
		assert.ok(streamsOf(viewHost).has(streamKey('sess-reopen', secondAttempt)));
	});

	test('remote close drops the closed attempt from streams', async () => {
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
		viewHost.acquireLease('sess-drop');
		await viewHost.whenEngineSessionReady('sess-drop');
		const firstAttempt = coreOf(viewHost).attemptId('sess-drop' as SessionId);
		assert.ok(firstAttempt);
		assert.ok(streamsOf(viewHost).has(streamKey('sess-drop', firstAttempt)));

		connection.fireStreamClosed('sess-drop', { kind: 'remote' });
		assert.ok(![...streamsOf(viewHost).keys()].includes(streamKey('sess-drop', firstAttempt)));
		assert.strictEqual(coreOf(viewHost).attemptId('sess-drop' as SessionId), null);
	});

	test('error close drops the closed attempt from streams', async () => {
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
		viewHost.acquireLease('sess-err-drop');
		await viewHost.whenEngineSessionReady('sess-err-drop');
		const firstAttempt = coreOf(viewHost).attemptId('sess-err-drop' as SessionId);
		assert.ok(firstAttempt);

		connection.fireStreamClosed('sess-err-drop', { kind: 'error', message: 'gone' });
		assert.ok(![...streamsOf(viewHost).keys()].includes(streamKey('sess-err-drop', firstAttempt)));
	});

	test('consecutive failed reopens use monotonic delay when jitter is off', async () => {
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
		viewHost.acquireLease('sess-backoff');
		await viewHost.whenEngineSessionReady('sess-backoff');

		for (let i = 0; i < 3; i++) {
			connection.fireStreamClosed('sess-backoff', { kind: 'error', message: 'gone' });
			clock.fireAll();
		}
		assert.deepStrictEqual(clock.delays, [1, 2, 4]);
		const liveAttempt = coreOf(viewHost).attemptId('sess-backoff' as SessionId);
		assert.ok(liveAttempt);
		assert.strictEqual(streamsOf(viewHost).size, 1);
		assert.ok(streamsOf(viewHost).has(streamKey('sess-backoff', liveAttempt)));
	});

	test('first stream event resets reopen n', async () => {
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
		viewHost.acquireLease('sess-reset');
		await viewHost.whenEngineSessionReady('sess-reset');

		connection.fireStreamClosed('sess-reset', { kind: 'remote' });
		clock.fireAll();
		connection.pushStreamEvent('sess-reset', { hello: {} });
		connection.fireStreamClosed('sess-reset', { kind: 'remote' });
		assert.deepStrictEqual(clock.delays, [1, 1]);
	});

	test('releasing the last lease cancels reopen and skips with no_lease', async () => {
		const connection = new TestConnection();
		const diagnostics = new CountingDiagnostics();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-nolease');
		await viewHost.whenEngineSessionReady('sess-nolease');
		connection.fireStreamClosed('sess-nolease', { kind: 'remote' });
		assert.strictEqual(clock.pending.size, 1);
		viewHost.releaseLease(leaseId);
		assert.strictEqual(clock.pending.size, 0);
		(viewHost as unknown as { scheduleStreamReopen(sessionId: string): void }).scheduleStreamReopen('sess-nolease');
		assert.ok(diagnostics.labels.some(item => item.metric === 'stream.reopen_skipped' && item.labels?.why === 'no_lease'));
	});

	test('connectionDown cancels reopen and skips with connection_down', async () => {
		const connection = new TestConnection();
		const diagnostics = new CountingDiagnostics();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-down');
		await viewHost.whenEngineSessionReady('sess-down');
		connection.fireStreamClosed('sess-down', { kind: 'remote' });
		assert.strictEqual(clock.pending.size, 1);
		connection.setEngineConnected(false);
		clock.fireAll();
		assert.ok(diagnostics.labels.some(item => item.metric === 'stream.reopen_skipped' && item.labels?.why === 'connection_down'));
		viewHost.onEngineConnectionChanged();
		assert.strictEqual(clock.pending.size, 0);
	});

	test('failClosedOverflow schedules same-connection recovery', async () => {
		const connection = new TestConnection();
		const diagnostics = new CountingDiagnostics();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
			mailboxCapacity: 1,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-overflow');
		await viewHost.whenEngineSessionReady('sess-overflow');
		let overflowPosted = false;
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(() => {
			if (overflowPosted) {
				return;
			}
			overflowPosted = true;
			viewHost.post(leaseId, { kind: 'submitInput', text: 'a' });
			viewHost.post(leaseId, { kind: 'submitInput', text: 'b' });
		}));
		viewHost.requestResync(leaseId);
		const scheduled = clock.pending.size;
		clock.fireAll();

		assert.deepStrictEqual({
			scheduled,
			ordinaryReopens: diagnostics.counts.get('stream.reopen_scheduled' as DiagnosticMetric),
			recoveryFired: diagnostics.counts.get('stream.recovery_fired' as DiagnosticMetric),
			subscriptions: connection.subscribeCalls.length,
			recovered: coreOf(viewHost).attemptId('sess-overflow' as SessionId) !== null,
		}, {
			scheduled: 1,
			ordinaryReopens: undefined,
			recoveryFired: 1,
			subscriptions: 2,
			recovered: true,
		});
	});

	test('overflow replaces an armed reopen timer with recovery', async () => {
		const connection = new TestConnection();
		const diagnostics = new CountingDiagnostics();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
			mailboxCapacity: 1,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-armed-overflow');
		await viewHost.whenEngineSessionReady('sess-armed-overflow');
		assert.strictEqual(connection.subscribeCalls.length, 1);

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		let overflowArmed = false;
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => {
			frames.push(event);
			if (!overflowArmed) {
				return;
			}
			overflowArmed = false;
			viewHost.post(leaseId, { kind: 'submitInput', text: 'a' });
			viewHost.post(leaseId, { kind: 'submitInput', text: 'b' });
		}));

		connection.fireStreamClosed('sess-armed-overflow', { kind: 'remote' });
		assert.strictEqual(coreOf(viewHost).attemptId('sess-armed-overflow' as SessionId), null);
		assert.strictEqual(clock.pending.size, 1);
		assert.strictEqual(diagnostics.counts.get('stream.reopen_scheduled' as DiagnosticMetric), 1);

		const streams = streamsOf(viewHost);
		assert.ok(![...streams.keys()].some(key => key.startsWith('sess-armed-overflow:')));
		const streamKeysBeforeOverflow = [...streams.keys()];
		overflowArmed = true;
		viewHost.requestResync(leaseId);

		assert.strictEqual(coreOf(viewHost).attemptId('sess-armed-overflow' as SessionId), null);
		assert.deepStrictEqual([...streams.keys()], streamKeysBeforeOverflow);
		assert.strictEqual(diagnostics.counts.get('mailbox.overflow' as DiagnosticMetric), 1);

		const afterOverflow = frames.length;
		clock.fireAll();
		assert.strictEqual(diagnostics.counts.get('stream.reopen_fired' as DiagnosticMetric), undefined);
		assert.strictEqual(diagnostics.counts.get('stream.recovery_fired' as DiagnosticMetric), 1);
		assert.strictEqual(connection.subscribeCalls.length, 2);
		assert.ok(syncChromeFromFrames(frames.slice(afterOverflow)).some(sync => sync.kind === 'live'));
	});

	test('still-connected snapshot preserves the armed recovery timer', async () => {
		const connection = new TestConnection();
		const diagnostics = new CountingDiagnostics();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
			mailboxCapacity: 1,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-snapshot-overflow');
		await viewHost.whenEngineSessionReady('sess-snapshot-overflow');
		assert.strictEqual(connection.subscribeCalls.length, 1);

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		let overflowArmed = false;
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => {
			frames.push(event);
			if (!overflowArmed) {
				return;
			}
			overflowArmed = false;
			viewHost.post(leaseId, { kind: 'submitInput', text: 'a' });
			viewHost.post(leaseId, { kind: 'submitInput', text: 'b' });
		}));

		connection.fireStreamClosed('sess-snapshot-overflow', { kind: 'remote' });
		assert.strictEqual(clock.pending.size, 1);
		overflowArmed = true;
		viewHost.requestResync(leaseId);
		assert.strictEqual(diagnostics.counts.get('mailbox.overflow' as DiagnosticMetric), 1);

		assert.strictEqual(connection.isEngineConnected(), true);
		viewHost.onEngineConnectionChanged();
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await new Promise<void>(resolve => setImmediate(() => resolve()));
		assert.strictEqual(clock.pending.size, 1, 'still-connected snapshot must not cancel the armed reopen timer');

		const afterOverflow = frames.length;
		clock.fireAll();
		assert.strictEqual(diagnostics.counts.get('stream.reopen_fired' as DiagnosticMetric), undefined);
		assert.strictEqual(diagnostics.counts.get('stream.recovery_fired' as DiagnosticMetric), 1);
		assert.strictEqual(connection.subscribeCalls.length, 2);
		assert.ok(syncChromeFromFrames(frames.slice(afterOverflow)).some(sync => sync.kind === 'live'));
	});

	test('overflow recovery re-arms when a session is acquired after its last lease was released', async () => {
		const connection = new TestConnection();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			mailboxCapacity: 1,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-reacquire-recovery');
		await viewHost.whenEngineSessionReady('sess-reacquire-recovery');
		let overflowPosted = false;
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(() => {
			if (overflowPosted) {
				return;
			}
			overflowPosted = true;
			viewHost.post(leaseId, { kind: 'submitInput', text: 'a' });
			viewHost.post(leaseId, { kind: 'submitInput', text: 'b' });
		}));
		viewHost.requestResync(leaseId);
		viewHost.releaseLease(leaseId);
		const afterRelease = clock.pending.size;
		viewHost.acquireLease('sess-reacquire-recovery');
		await viewHost.whenEngineSessionReady('sess-reacquire-recovery');
		const afterAcquire = clock.pending.size;
		clock.fireAll();

		assert.deepStrictEqual({
			afterRelease,
			afterAcquire,
			subscriptions: connection.subscribeCalls.length,
			recovered: coreOf(viewHost).attemptId('sess-reacquire-recovery' as SessionId) !== null,
		}, {
			afterRelease: 0,
			afterAcquire: 1,
			subscriptions: 2,
			recovered: true,
		});
	});

	test('recovery open failure falls back to S2 and a later successful open clears the debt', async () => {
		class ThrowOnceConnection extends TestConnection {
			throwNext = false;

			override subscribeSessionEventStream(...args: Parameters<TestConnection['subscribeSessionEventStream']>): ReturnType<TestConnection['subscribeSessionEventStream']> {
				if (this.throwNext) {
					this.throwNext = false;
					throw new Error('open failed');
				}
				return super.subscribeSessionEventStream(...args);
			}
		}

		const connection = new ThrowOnceConnection();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			mailboxCapacity: 1,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-recovery-throw');
		await viewHost.whenEngineSessionReady('sess-recovery-throw');
		let overflowPosted = false;
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(() => {
			if (overflowPosted) {
				return;
			}
			overflowPosted = true;
			viewHost.post(leaseId, { kind: 'submitInput', text: 'a' });
			viewHost.post(leaseId, { kind: 'submitInput', text: 'b' });
		}));
		viewHost.requestResync(leaseId);
		connection.throwNext = true;
		clock.fireAll();
		const failed = failClosedRecoveryOf(viewHost).has('sess-recovery-throw');
		clock.fireAll();

		assert.deepStrictEqual({
			failed,
			recovered: !failClosedRecoveryOf(viewHost).has('sess-recovery-throw'),
			subscriptions: connection.subscribeCalls.length,
			attemptOpen: coreOf(viewHost).attemptId('sess-recovery-throw' as SessionId) !== null,
		}, {
			failed: true,
			recovered: true,
			subscriptions: 2,
			attemptOpen: true,
		});
	});

	test('recovery opens with one up when the actor failure flag was already cleared', async () => {
		const connection = new TestConnection();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			mailboxCapacity: 1,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = 'sess-recovery-one-up';
		const leaseId = viewHost.acquireLease(sessionId);
		await viewHost.whenEngineSessionReady(sessionId);
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		let overflowPosted = false;
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => {
			frames.push(event);
			if (overflowPosted) {
				return;
			}
			overflowPosted = true;
			viewHost.post(leaseId, { kind: 'submitInput', text: 'a' });
			viewHost.post(leaseId, { kind: 'submitInput', text: 'b' });
		}));
		viewHost.requestResync(leaseId);
		(viewHost as unknown as { postAndDrain(id: SessionId, message: { t: 'connectionUp'; connectionGeneration: number }): unknown }).postAndDrain(sessionId as SessionId, {
			t: 'connectionUp',
			connectionGeneration: 1,
		});
		const afterFlagClear = frames.length;
		clock.fireAll();

		assert.deepStrictEqual({
			subscriptions: connection.subscribeCalls.length,
			liveFrames: syncChromeFromFrames(frames.slice(afterFlagClear)).filter(sync => sync.kind === 'live').length,
			attemptOpen: coreOf(viewHost).attemptId(sessionId as SessionId) !== null,
		}, {
			subscriptions: 2,
			liveFrames: 1,
			attemptOpen: true,
		});
	});

	test('recovery stream lifetime controls whether reopen backoff resets', async () => {
		for (const { lifetime, expectedDelay } of [{ lifetime: 2_000, expectedDelay: 2 }, { lifetime: 30_000, expectedDelay: 1 }]) {
			const connection = new TestConnection();
			const clock = createDeferredTimeout();
			let now = 1_000;
			const sessionId = `sess-recovery-lifetime-${lifetime}`;
			const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
				orphanTimeoutMs: 0,
				mailboxCapacity: 1,
				reopenBaseMs: 1,
				reopenJitterRatio: 0,
				setTimeoutFn: clock.setTimeoutFn,
				clearTimeoutFn: clock.clearTimeoutFn,
				nowFn: () => now,
			}));
			viewHost.onEngineConnectionChanged();
			const leaseId = viewHost.acquireLease(sessionId);
			await viewHost.whenEngineSessionReady(sessionId);
			let overflowPosted = false;
			store.add(viewHost.onDynamicDidApplyFrame(leaseId)(() => {
				if (overflowPosted) {
					return;
				}
				overflowPosted = true;
				viewHost.post(leaseId, { kind: 'submitInput', text: 'a' });
				viewHost.post(leaseId, { kind: 'submitInput', text: 'b' });
			}));
			viewHost.requestResync(leaseId);
			clock.fireAll();
			connection.pushStreamEvent(sessionId, { hello: {} });
			now += lifetime;
			connection.fireStreamClosed(sessionId, { kind: 'remote' });

			assert.strictEqual(clock.delays.at(-1), expectedDelay);
		}
	});

	test('overflow followed by disconnect and reconnect self-heals via supplementary connectionUp', async () => {
		const connection = new TestConnection();
		const diagnostics = new CountingDiagnostics();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
			mailboxCapacity: 1,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-reconnect-recovery');
		await viewHost.whenEngineSessionReady('sess-reconnect-recovery');
		assert.strictEqual(connection.subscribeCalls.length, 1);

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		let overflowArmed = false;
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => {
			frames.push(event);
			if (!overflowArmed) {
				return;
			}
			overflowArmed = false;
			viewHost.post(leaseId, { kind: 'submitInput', text: 'x' });
			viewHost.post(leaseId, { kind: 'submitInput', text: 'y' });
		}));

		connection.fireStreamClosed('sess-reconnect-recovery', { kind: 'remote' });
		overflowArmed = true;
		viewHost.requestResync(leaseId);
		assert.strictEqual(diagnostics.counts.get('mailbox.overflow' as DiagnosticMetric), 1);

		// Disconnect engine
		connection.setEngineConnected(false);
		viewHost.onEngineConnectionChanged();
		assert.strictEqual(clock.pending.size, 0);

		const afterDisconnect = frames.length;
		// Reconnect engine
		connection.setEngineConnected(true);
		viewHost.onEngineConnectionChanged();
		await viewHost.whenEngineSessionReady('sess-reconnect-recovery');

		// Stream should immediately reopen without waiting for any timer
		assert.strictEqual(connection.subscribeCalls.length, 2);
		assert.ok(coreOf(viewHost).attemptId('sess-reconnect-recovery' as SessionId));
		assert.ok(
			syncChromeFromFrames(frames.slice(afterDisconnect)).some(sync => sync.kind === 'live'),
		);
	});

	test('re-overflow during reconnect recovery preserves the debt until same-connection retry', async () => {
		const connection = new TestConnection();
		const diagnostics = new CountingDiagnostics();
		const clock = createDeferredTimeout();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
			mailboxCapacity: 1,
			reopenBaseMs: 1,
			reopenJitterRatio: 0,
			setTimeoutFn: clock.setTimeoutFn,
			clearTimeoutFn: clock.clearTimeoutFn,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = 'sess-reconnect-double-overflow';
		const leaseId = viewHost.acquireLease(sessionId);
		await viewHost.whenEngineSessionReady(sessionId);
		assert.strictEqual(connection.subscribeCalls.length, 1);

		let overflowArmed = false;
		let overflowOnLive = false;
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => {
			if (overflowArmed) {
				overflowArmed = false;
				viewHost.post(leaseId, { kind: 'submitInput', text: 'x' });
				viewHost.post(leaseId, { kind: 'submitInput', text: 'y' });
				return;
			}
			if (overflowOnLive) {
				const isLive = syncChromeFromFrames([event]).some(sync => sync.kind === 'live');
				if (isLive) {
					overflowOnLive = false;
					viewHost.post(leaseId, { kind: 'submitInput', text: 'x' });
					viewHost.post(leaseId, { kind: 'submitInput', text: 'y' });
				}
			}
		}));

		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		// Initial overflow
		connection.fireStreamClosed(sessionId, { kind: 'remote' });
		overflowArmed = true;
		viewHost.requestResync(leaseId);
		assert.strictEqual(diagnostics.counts.get('mailbox.overflow' as DiagnosticMetric), 1);

		// Disconnect engine
		connection.setEngineConnected(false);
		viewHost.onEngineConnectionChanged();
		assert.strictEqual(clock.pending.size, 0);

		// Reconnect engine with overflow armed on supplementary connectionUp live frame
		overflowOnLive = true;
		connection.setEngineConnected(true);
		viewHost.onEngineConnectionChanged();
		await viewHost.whenEngineSessionReady(sessionId);

		assert.strictEqual(diagnostics.counts.get('mailbox.overflow' as DiagnosticMetric), 2);
		assert.strictEqual(connection.subscribeCalls.length, 1);
		assert.strictEqual(coreOf(viewHost).attemptId(sessionId as SessionId), null);
		assert.ok(failClosedRecoveryOf(viewHost).has(sessionId));

		// Ordinary reopen is skipped, but the independently armed recovery still fires.
		(viewHost as unknown as { scheduleStreamReopen(id: string): void }).scheduleStreamReopen(sessionId);
		clock.fireAll();
		assert.ok(diagnostics.labels.some(item => item.metric === 'stream.reopen_skipped' && item.labels?.why === 'fail_closed'));
		assert.strictEqual(diagnostics.counts.get('stream.recovery_fired' as DiagnosticMetric), 1);

		assert.strictEqual(connection.subscribeCalls.length, 2);
		assert.ok(coreOf(viewHost).attemptId(sessionId as SessionId) !== null);
		assert.strictEqual(failClosedRecoveryOf(viewHost).has(sessionId), false);
	});
});

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

	test('failClosedOverflow does not schedule reopen', async () => {
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
		assert.strictEqual(diagnostics.counts.get('stream.reopen_scheduled' as DiagnosticMetric), undefined);
		assert.strictEqual(clock.pending.size, 0);
	});

	test('armed reopen timer skips fail_closed after overflow and does not paint live', async () => {
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
		assert.ok(diagnostics.labels.some(item => item.metric === 'stream.reopen_skipped' && item.labels?.why === 'fail_closed'));
		assert.strictEqual(diagnostics.counts.get('stream.reopen_fired' as DiagnosticMetric), undefined);
		assert.strictEqual(connection.subscribeCalls.length, 1);
		assert.deepStrictEqual(
			syncChromeFromFrames(frames.slice(afterOverflow)).filter(sync => sync.kind === 'live'),
			[],
		);
	});
});

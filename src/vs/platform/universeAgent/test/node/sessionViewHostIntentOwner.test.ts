/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import type { ViewPatch } from '../../common/sessionView/types.js';
import type { DiagnosticMetric, DiagnosticsPort, TimerId } from '../../node/sessionCore/ports.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { NodeSchedulerPort } from '../../node/sessionViewHostPorts.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

const LINGER_MS = 8;

class TrackingConnection extends TestConnection {
	readonly streamSubscriptions: string[] = [];
	private readonly streamHandles: { readonly sessionId: string; disposed: boolean }[] = [];

	override subscribeSessionEventStream(sessionId: string, listener: (event: { payload: unknown }) => void) {
		this.streamSubscriptions.push(sessionId);
		const handle = { sessionId, disposed: false };
		this.streamHandles.push(handle);
		const inner = super.subscribeSessionEventStream(sessionId, listener);
		return {
			dispose: () => {
				handle.disposed = true;
				inner.dispose();
			},
		};
	}

	get activeStreamCount(): number {
		return this.streamHandles.filter(stream => !stream.disposed).length;
	}
}

class CountingDiagnostics implements DiagnosticsPort {
	readonly counts = new Map<string, number>();
	readonly labeledCounts = new Map<string, number>();

	count(metric: DiagnosticMetric, labels?: Readonly<Record<string, string>>): void {
		this.counts.set(metric, (this.counts.get(metric) ?? 0) + 1);
		if (labels) {
			const key = `${metric}:${labels.do ?? ''}`;
			this.labeledCounts.set(key, (this.labeledCounts.get(key) ?? 0) + 1);
		}
	}

	warn(): void { }
}

async function waitFor(predicate: () => boolean, timeoutMs = 250): Promise<void> {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('timed out waiting for condition');
		}
		await timeout(4);
	}
}

suite('SessionViewHost intent ownership (F2)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('alternating sessions open streams under their own sessionId', () => {
		const connection = new TrackingConnection();
		const host = new TestHost(async () => undefined);
		const viewHost = store.add(new SessionViewHost(connection, host, { orphanTimeoutMs: 0 }));

		viewHost.onEngineConnectionChanged();

		const leaseA = viewHost.acquireLease('sess-a');
		viewHost.post(leaseA, { kind: 'submitInput', text: 'hello-a' });

		const leaseB = viewHost.acquireLease('sess-b');
		viewHost.post(leaseB, { kind: 'submitInput', text: 'hello-b' });

		assert.ok(connection.streamSubscriptions.includes('sess-a'), 'sess-a stream must be subscribed');
		assert.ok(connection.streamSubscriptions.includes('sess-b'), 'sess-b stream must be subscribed');
		assert.strictEqual(connection.streamSubscriptions.filter(id => id === 'sess-a').length, 1);
		assert.strictEqual(connection.streamSubscriptions.filter(id => id === 'sess-b').length, 1);
		assert.ok(
			connection.streamSubscriptions.indexOf('sess-a') < connection.streamSubscriptions.indexOf('sess-b'),
			'sess-a stream must open before sess-b when acquired in that order',
		);
	});

	test('submitInput local-send operationId uses IdPort write: correlation', async () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => undefined);
		const viewHost = store.add(new SessionViewHost(connection, host, { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-write-corr');

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => frames.push(e)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: 'corr-check' });
		assert.strictEqual(outcome.accepted, true);

		const sends = frames.flatMap(event => {
			const body = event.frame.frame.body;
			return body.kind === 'patches' ? body.patches : [];
		}).filter((patch): patch is Extract<ViewPatch, { op: 'upsertLocalSend' }> => patch.op === 'upsertLocalSend');
		assert.ok(sends.some(patch => String(patch.send.operationId).startsWith('write:')));
	});

	test('NodeSchedulerPort onFire runs; cancelTimer suppresses fire', async () => {
		const fired: string[] = [];
		const scheduler = new NodeSchedulerPort(id => fired.push(String(id)));
		store.add(scheduler);
		scheduler.startTimer('keep:' as TimerId, 1);
		scheduler.startTimer('drop:' as TimerId, 1);
		scheduler.cancelTimer('drop:' as TimerId);
		await waitFor(() => fired.includes('keep:'));
		assert.deepStrictEqual(fired, ['keep:']);
	});

	test('last lease release closes the gRPC subscription after linger via postAndDrain timerFired', async () => {
		const connection = new TrackingConnection();
		const host = new TestHost(async () => undefined);
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 0,
			lingerMs: LINGER_MS,
			diagnostics,
		}));

		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-linger');
		assert.strictEqual(connection.activeStreamCount, 1);

		viewHost.releaseLease(leaseId);
		assert.strictEqual(connection.activeStreamCount, 1, 'stream must linger until the timer fires');
		assert.strictEqual(diagnostics.counts.get('intent.unhandled'), undefined);

		await waitFor(() => connection.activeStreamCount === 0);
		assert.strictEqual(connection.activeStreamCount, 0);
	});

	test('re-acquire during linger cancels closeStream', async () => {
		const connection = new TrackingConnection();
		const host = new TestHost(async () => undefined);
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 0,
			lingerMs: LINGER_MS,
		}));

		viewHost.onEngineConnectionChanged();
		const first = viewHost.acquireLease('sess-reacquire');
		viewHost.releaseLease(first);
		viewHost.acquireLease('sess-reacquire');
		await timeout(LINGER_MS + 20);
		assert.strictEqual(connection.activeStreamCount, 1);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ViewFrame, ViewLeaseId } from '../../common/sessionView/types.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import type { DiagnosticMetric, DiagnosticsPort } from '../../node/sessionCore/ports.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

class CountingDiagnostics implements DiagnosticsPort {
	readonly counts = new Map<string, number>();

	count(metric: DiagnosticMetric): void {
		this.counts.set(metric, (this.counts.get(metric) ?? 0) + 1);
	}

	warn(): void { }
}

function injectFrame(host: SessionViewHost, leaseId: string, sessionId: string, frame: ViewFrame): void {
	(host as unknown as {
		onFrameEnqueued(leaseId: ViewLeaseId, sessionId: string, frame: ViewFrame): void;
	}).onFrameEnqueued(leaseId as ViewLeaseId, sessionId, frame);
}

function makePatchFrame(leaseId: string, sessionId: string, frameId: number): ViewFrame {
	return {
		leaseId: leaseId as ViewLeaseId,
		generation: 1,
		frameId,
		version: frameId,
		body: {
			kind: 'patches',
			patches: [{ op: 'setSyncChrome', sync: { kind: 'live' } }],
		},
	};
}

suite('SessionViewHost per-lease fanout (F1)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('frames on lease A do not reach lease B subscribers', () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => undefined);
		const viewHost = store.add(new SessionViewHost(connection, host, { orphanTimeoutMs: 0 }));

		viewHost.onEngineConnectionChanged();
		const leaseA = viewHost.acquireLease('sess-a');
		const leaseB = viewHost.acquireLease('sess-a');

		const eventsA: IUniverseAgentSessionViewFrameEvent[] = [];
		const eventsB: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseA)(e => eventsA.push(e)));
		store.add(viewHost.onDynamicDidApplyFrame(leaseB)(e => eventsB.push(e)));

		injectFrame(viewHost, leaseA, 'sess-a', makePatchFrame(leaseA, 'sess-a', 99));

		assert.ok(eventsA.some(e => e.applied.kind === 'patches' && e.frame.frame.frameId === 99));
		assert.ok(!eventsB.some(e => e.frame.frame.frameId === 99));
	});

	test('pre-subscribe burst flushes in order with baseline first', async () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => undefined);
		const viewHost = store.add(new SessionViewHost(connection, host, { orphanTimeoutMs: 0 }));

		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-burst');

		const received: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => received.push(e)));

		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.ok(received.length >= 1);
		assert.strictEqual(received[0]!.applied.kind, 'baseline');
		for (let i = 1; i < received.length; i++) {
			assert.notStrictEqual(received[i]!.applied.kind, 'baseline');
		}
	});

	test('pending overflow triggers resync baseline on first subscribe', async () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => undefined);
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 0,
			pendingFrameLimit: 2,
			diagnostics,
		}));

		const leaseId = viewHost.acquireLease('sess-overflow');
		for (let i = 2; i <= 5; i++) {
			injectFrame(viewHost, leaseId, 'sess-overflow', makePatchFrame(leaseId, 'sess-overflow', i));
		}
		assert.strictEqual(diagnostics.counts.get('view.pending_overflow' as DiagnosticMetric), 1);

		const received: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => received.push(e)));

		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.ok(received.length >= 1);
		assert.strictEqual(received[0]!.applied.kind, 'baseline');
	});

	test('orphan timeout releases lease that never gained a subscriber', async () => {
		const diagnostics = new CountingDiagnostics();
		const connection = new TestConnection();
		const host = new TestHost(async () => undefined);
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 50,
			diagnostics,
		}));

		const leaseId = viewHost.acquireLease('sess-orphan');
		assert.notStrictEqual(viewHost.onDynamicDidApplyFrame(leaseId), Event.None);

		await new Promise<void>(resolve => setTimeout(resolve, 80));

		assert.strictEqual(viewHost.onDynamicDidApplyFrame(leaseId), Event.None);
		assert.strictEqual(diagnostics.counts.get('view.lease_orphaned' as DiagnosticMetric), 1);
	});

	test('unsubscribe after subscribe does not trigger orphan release', async () => {
		const diagnostics = new CountingDiagnostics();
		const connection = new TestConnection();
		const host = new TestHost(async () => undefined);
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 50,
			diagnostics,
		}));

		const leaseId = viewHost.acquireLease('sess-unsub');
		const subscription = viewHost.onDynamicDidApplyFrame(leaseId)(() => { });
		subscription.dispose();

		injectFrame(viewHost, leaseId, 'sess-unsub', makePatchFrame(leaseId, 'sess-unsub', 42));

		await new Promise<void>(resolve => setTimeout(resolve, 80));

		assert.notStrictEqual(viewHost.onDynamicDidApplyFrame(leaseId), Event.None);
		assert.strictEqual(diagnostics.counts.get('view.lease_orphaned' as DiagnosticMetric), undefined);
	});

	test('released lease returns Event.None', () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => undefined);
		const viewHost = store.add(new SessionViewHost(connection, host, { orphanTimeoutMs: 0 }));

		const leaseId = viewHost.acquireLease('sess-release');
		viewHost.releaseLease(leaseId);

		assert.strictEqual(viewHost.onDynamicDidApplyFrame(leaseId), Event.None);
		assert.strictEqual(viewHost.onDynamicDidApplyFrame('forged-lease'), Event.None);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { DiagnosticMetric, DiagnosticsPort } from '../../node/sessionCore/ports.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

class TrackingConnection extends TestConnection {
	readonly streamSubscriptions: string[] = [];

	override subscribeSessionEventStream(sessionId: string, listener: (event: { payload: unknown }) => void) {
		this.streamSubscriptions.push(sessionId);
		return super.subscribeSessionEventStream(sessionId, listener);
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

	test('startTimer from linger emits intent.unhandled instead of silent drop', () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => undefined);
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 0,
			diagnostics,
		}));

		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-linger');
		viewHost.releaseLease(leaseId);

		assert.strictEqual(diagnostics.counts.get('intent.unhandled'), 1);
		assert.strictEqual(diagnostics.labeledCounts.get('intent.unhandled:startTimer'), 1);
	});
});

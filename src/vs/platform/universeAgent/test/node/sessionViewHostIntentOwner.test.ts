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
	readonly warnings: { readonly message: string; readonly fields: Readonly<Record<string, unknown>> }[] = [];

	count(metric: DiagnosticMetric, labels?: Readonly<Record<string, string>>): void {
		this.counts.set(metric, (this.counts.get(metric) ?? 0) + 1);
		if (labels) {
			const key = `${metric}:${labels.do ?? ''}`;
			this.labeledCounts.set(key, (this.labeledCounts.get(key) ?? 0) + 1);
		}
	}

	warn(message: string, fields: Readonly<Record<string, unknown>>): void {
		this.warnings.push({ message, fields });
	}
}

type HostInternals = {
	postAndDrain(sessionId: string, msg: { readonly t: 'localFact'; readonly fact: unknown }): { accepted: boolean };
};

function postLocalFact(viewHost: SessionViewHost, sessionId: string, fact: unknown): void {
	const outcome = (viewHost as unknown as HostInternals).postAndDrain(sessionId, { t: 'localFact', fact });
	assert.strictEqual(outcome.accepted, true, `localFact ${String((fact as { kind?: string }).kind)} must be accepted`);
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

	test('continueGeneration counts intent.unhandled openContinuationStream when transport lacks hook', () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => undefined);
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-cg');

		postLocalFact(viewHost, 'sess-cg', {
			kind: 'continueGeneration',
			agentId: 'agent-root',
			turnId: 'turn-1',
			messageId: 'msg-1',
		});

		assert.strictEqual(diagnostics.labeledCounts.get('intent.unhandled:openContinuationStream'), 1);
		assert.ok(diagnostics.warnings.some(w =>
			w.message.includes('openContinuationStream') && w.fields.do === 'openContinuationStream'
		));
	});

	test('openContinuationStream hook runs without intent.unhandled when connection provides it', () => {
		const calls: { sessionId: string; agentId: string; turnId: string; messageId: string }[] = [];
		const connection = new class extends TestConnection {
			openContinuationStream(
				request: { sessionId: string; agentId: string; turnId: string; messageId: string },
			): { dispose(): void } {
				calls.push({ ...request });
				return { dispose: () => { } };
			}
		}();

		const host = new TestHost(async () => undefined);
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-cg-hook');

		postLocalFact(viewHost, 'sess-cg-hook', {
			kind: 'continueGeneration',
			agentId: 'agent-root',
			turnId: 'turn-2',
			messageId: 'msg-2',
		});

		assert.deepStrictEqual(calls, [{
			sessionId: 'sess-cg-hook',
			agentId: 'agent-root',
			turnId: 'turn-2',
			messageId: 'msg-2',
		}]);
		assert.strictEqual(diagnostics.counts.get('intent.unhandled'), undefined);
	});

	test('regenerateTurn counts intent.unhandled unaryCommand (no unary dispatcher yet)', () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => undefined);
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-rg');

		postLocalFact(viewHost, 'sess-rg', {
			kind: 'regenerateTurn',
			userTurnId: 'user-turn-1',
			preservedContent: 'hello again',
			correlation: 'write:regen-1',
		});

		assert.strictEqual(diagnostics.labeledCounts.get('intent.unhandled:unaryCommand'), 1);
		assert.ok(diagnostics.warnings.some(w =>
			w.message.includes('unaryCommand') && w.fields.commandId === 'agent.editMessage'
		));
	});
});

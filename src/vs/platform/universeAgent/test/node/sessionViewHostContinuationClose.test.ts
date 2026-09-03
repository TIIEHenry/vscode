/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import type { SyncChrome, ViewPatch } from '../../common/sessionView/types.js';
import type {
	UniverseAgentContinueGenerationRequest,
	UniverseAgentSessionStreamCloseCause,
} from '../../common/universeAgentTypes.js';
import type { DiagnosticMetric, DiagnosticsPort } from '../../node/sessionCore/ports.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

class CountingDiagnostics implements DiagnosticsPort {
	readonly counts = new Map<string, number>();
	readonly warnings: { readonly message: string; readonly fields: Readonly<Record<string, unknown>> }[] = [];

	count(metric: DiagnosticMetric, labels?: Readonly<Record<string, string>>): void {
		this.counts.set(metric, (this.counts.get(metric) ?? 0) + 1);
		void labels;
	}

	warn(message: string, fields: Readonly<Record<string, unknown>>): void {
		this.warnings.push({ message, fields });
	}
}

class ContinuationConnection extends TestConnection {
	readonly opens: UniverseAgentContinueGenerationRequest[] = [];
	disposeCount = 0;
	private continuationClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void;

	openContinuationStream(
		request: UniverseAgentContinueGenerationRequest,
		_onResponse: (response: { payload: unknown }) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		this.opens.push(request);
		this.continuationClosed = onClosed;
		return {
			dispose: () => {
				this.disposeCount += 1;
				this.continuationClosed = undefined;
			},
		};
	}

	fireContinuationClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this.continuationClosed?.(cause);
	}
}

type HostInternals = {
	postAndDrain(sessionId: string, msg: { readonly t: 'localFact'; readonly fact: unknown }): { accepted: boolean };
};

function closedChromeFromFrames(frames: readonly IUniverseAgentSessionViewFrameEvent[]): SyncChrome[] {
	return frames.flatMap(event => {
		const body = event.frame.frame.body;
		if (body.kind !== 'patches') {
			return [];
		}
		return body.patches.filter((patch): patch is Extract<ViewPatch, { op: 'setSyncChrome' }> => patch.op === 'setSyncChrome');
	}).map(patch => patch.sync).filter((sync): sync is Extract<SyncChrome, { kind: 'closed' }> => sync.kind === 'closed');
}

function postContinue(viewHost: SessionViewHost, sessionId: string): void {
	const outcome = (viewHost as unknown as HostInternals).postAndDrain(sessionId, {
		t: 'localFact',
		fact: {
			kind: 'continueGeneration',
			agentId: 'agent-root',
			turnId: 'turn-1',
			messageId: 'msg-1',
		},
	});
	assert.strictEqual(outcome.accepted, true, 'continueGeneration must be accepted');
}

suite('SessionViewHost continuation onClosed', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('remote ContinueGeneration close drops the handle and does not fold streamClosed chrome', async () => {
		const connection = new ContinuationConnection();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-cg-remote');

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => frames.push(e)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		postContinue(viewHost, 'sess-cg-remote');
		assert.strictEqual(connection.opens.length, 1);
		assert.strictEqual(diagnostics.counts.get('intent.unhandled'), undefined);

		connection.fireContinuationClosed({ kind: 'remote' });

		assert.ok(diagnostics.warnings.some(w =>
			w.message === 'openContinuationStream closed' && w.fields.kind === 'remote'
		));
		assert.deepStrictEqual(closedChromeFromFrames(frames), []);
		assert.strictEqual(connection.disposeCount, 0, 'remote close must not locally dispose the transport handle');
	});

	test('error ContinueGeneration close warns with the message and stays live', async () => {
		const connection = new ContinuationConnection();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-cg-error');

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => frames.push(e)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		postContinue(viewHost, 'sess-cg-error');
		connection.fireContinuationClosed({ kind: 'error', message: 'rst reset' });

		assert.ok(diagnostics.warnings.some(w =>
			w.message === 'openContinuationStream closed'
			&& w.fields.kind === 'error'
			&& w.fields.message === 'rst reset'
		));
		assert.deepStrictEqual(closedChromeFromFrames(frames), []);
	});

	test('connection-down disposes the continuation handle without a remote onClosed', () => {
		const connection = new ContinuationConnection();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-cg-local');
		postContinue(viewHost, 'sess-cg-local');
		assert.strictEqual(connection.opens.length, 1);

		void connection.disconnect();
		viewHost.onEngineConnectionChanged();

		assert.strictEqual(connection.disposeCount, 1);
		assert.ok(!diagnostics.warnings.some(w => w.message === 'openContinuationStream closed'));
	});

	test('replacing a continuation disposes the previous handle', () => {
		const connection = new ContinuationConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-cg-replace');
		postContinue(viewHost, 'sess-cg-replace');
		postContinue(viewHost, 'sess-cg-replace');
		assert.strictEqual(connection.opens.length, 2);
		assert.strictEqual(connection.disposeCount, 1);
	});
});

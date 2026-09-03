/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import type { SyncChrome, ViewPatch } from '../../common/sessionView/types.js';
import type { UniverseAgentSessionStreamCloseCause } from '../../common/universeAgentTypes.js';
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

class ChatConnection extends TestConnection {
	readonly opens: string[] = [];
	disposeCount = 0;
	private chatClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void;

	openChatStream(
		sessionId: string,
		_onResponse: (response: { payload: unknown }) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { write(): void; dispose(): void } {
		this.opens.push(sessionId);
		this.chatClosed = onClosed;
		return {
			write: () => { },
			dispose: () => {
				this.disposeCount += 1;
				this.chatClosed = undefined;
			},
		};
	}

	fireChatClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this.chatClosed?.(cause);
	}
}

function closedChromeFromFrames(frames: readonly IUniverseAgentSessionViewFrameEvent[]): SyncChrome[] {
	return frames.flatMap(event => {
		const body = event.frame.frame.body;
		if (body.kind !== 'patches') {
			return [];
		}
		return body.patches.filter((patch): patch is Extract<ViewPatch, { op: 'setSyncChrome' }> => patch.op === 'setSyncChrome');
	}).map(patch => patch.sync).filter((sync): sync is Extract<SyncChrome, { kind: 'closed' }> => sync.kind === 'closed');
}

function openResident(viewHost: SessionViewHost, sessionId: string, connection: ChatConnection): void {
	viewHost.onEngineConnectionChanged();
	viewHost.acquireLease(sessionId);
	assert.strictEqual(connection.opens.length, 1, 'lease + connection-up must open resident Chat');
}

suite('SessionViewHost chat onClosed', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('remote Chat close posts chatStreamDown, warns, and does not fold streamClosed chrome', async () => {
		const connection = new ChatConnection();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		const leaseId = (() => {
			viewHost.onEngineConnectionChanged();
			return viewHost.acquireLease('sess-chat-remote');
		})();
		assert.strictEqual(connection.opens.length, 1);

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => frames.push(e)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		connection.fireChatClosed({ kind: 'remote' });

		assert.ok(diagnostics.warnings.some(w =>
			w.message === 'openChatStream closed' && w.fields.kind === 'remote'
		));
		assert.deepStrictEqual(closedChromeFromFrames(frames), []);
		assert.strictEqual(connection.disposeCount, 0, 'remote close must not locally dispose the transport handle');
		assert.strictEqual(connection.opens.length, 2, 'Actor must re-ensure the same chat generation');
	});

	test('error Chat close warns with the message and stays live', async () => {
		const connection = new ChatConnection();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-chat-error');
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => frames.push(e)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		connection.fireChatClosed({ kind: 'error', message: 'rst reset' });

		assert.ok(diagnostics.warnings.some(w =>
			w.message === 'openChatStream closed'
			&& w.fields.kind === 'error'
			&& w.fields.message === 'rst reset'
		));
		assert.deepStrictEqual(closedChromeFromFrames(frames), []);
	});

	test('connection-down disposes the Chat handle without a remote onClosed', () => {
		const connection = new ChatConnection();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		openResident(viewHost, 'sess-chat-local', connection);

		void connection.disconnect();
		viewHost.onEngineConnectionChanged();

		assert.strictEqual(connection.disposeCount, 1);
		assert.ok(!diagnostics.warnings.some(w => w.message === 'openChatStream closed'));
	});
});

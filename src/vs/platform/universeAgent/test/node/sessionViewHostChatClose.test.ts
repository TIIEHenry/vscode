/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
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

async function openResident(viewHost: SessionViewHost, sessionId: string, connection: ChatConnection): Promise<void> {
	viewHost.onEngineConnectionChanged();
	viewHost.acquireLease(sessionId);
	await viewHost.whenEngineSessionReady(sessionId);
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
		await viewHost.whenEngineSessionReady('sess-chat-remote');
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
		await viewHost.whenEngineSessionReady('sess-chat-error');
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

	test('connection-down disposes the Chat handle without a remote onClosed', async () => {
		const connection = new ChatConnection();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		await openResident(viewHost, 'sess-chat-local', connection);

		void connection.disconnect();
		viewHost.onEngineConnectionChanged();

		assert.strictEqual(connection.disposeCount, 1);
		assert.ok(!diagnostics.warnings.some(w => w.message === 'openChatStream closed'));
	});

	test('throw-on-open Chat warns, keeps one-shot echo, and does not reject ready', async () => {
		const connection = new class extends TestConnection {
			readonly chatCalls: string[] = [];
			openChatStream(): { write(): void; dispose(): void } {
				throw new Error('open chat boom');
			}
			override async chat(request: { sessionId: string }): Promise<void> {
				this.chatCalls.push(request.sessionId);
			}
		}();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-chat-throw-open');
		const engineId = await viewHost.whenEngineSessionReady('sess-chat-throw-open');
		assert.strictEqual(engineId, 'sess-chat-throw-open');
		assert.ok(diagnostics.warnings.some(w =>
			w.message === 'openChatStream failed' && w.fields.error === 'open chat boom'
		));
		assert.ok(!diagnostics.warnings.some(w => w.message === 'openChatStream closed'));

		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: 'fallback one-shot' });
		assert.strictEqual(outcome.accepted, true);
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		assert.ok(connection.chatCalls.includes('sess-chat-throw-open'), 'write must fall back to one-shot chat()');
	});

	test('throw-on-open SessionEventStream warns and still opens resident Chat', async () => {
		const connection = new class extends ChatConnection {
			override subscribeSessionEventStream(): { dispose(): void } {
				throw new Error('open stream boom');
			}
		}();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-stream-throw-open');
		await viewHost.whenEngineSessionReady('sess-stream-throw-open');
		assert.ok(diagnostics.warnings.some(w =>
			w.message === 'openStream failed' && w.fields.error === 'open stream boom'
		));
		assert.strictEqual(connection.opens.length, 1, 'ensureChatStream must still run after openStream throw');
	});

	test('throw-on-dispose closeStream warns and still closes resident Chat', async () => {
		const connection = new class extends ChatConnection {
			override subscribeSessionEventStream(): { dispose(): void } {
				return {
					dispose: () => {
						throw new Error('close stream boom');
					},
				};
			}
		}();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			lingerMs: 8,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-stream-throw-dispose');
		await viewHost.whenEngineSessionReady('sess-stream-throw-dispose');
		assert.strictEqual(connection.opens.length, 1, 'lease + connection-up must open resident Chat');
		assert.strictEqual(connection.disposeCount, 0);

		viewHost.releaseLease(leaseId);
		await timeout(28);
		assert.ok(diagnostics.warnings.some(w =>
			w.message === 'closeStream dispose failed' && w.fields.error === 'close stream boom'
		));
		assert.strictEqual(connection.disposeCount, 1, 'closeChatStream must still run after closeStream dispose throw');
	});

	test('throw-on-dispose Chat after linger still closes and deletes the handle', async () => {
		const connection = new class extends ChatConnection {
			override openChatStream(
				sessionId: string,
				_onResponse: (response: { payload: unknown }) => void,
			): { write(): void; dispose(): void } {
				this.opens.push(sessionId);
				return {
					write: () => { },
					dispose: () => {
						this.disposeCount += 1;
						throw new Error('close chat boom');
					},
				};
			}
		}();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			lingerMs: 8,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-chat-throw-dispose');
		await viewHost.whenEngineSessionReady('sess-chat-throw-dispose');
		assert.strictEqual(connection.opens.length, 1, 'lease + connection-up must open resident Chat');
		assert.strictEqual(connection.disposeCount, 0);

		viewHost.releaseLease(leaseId);
		await timeout(28);
		assert.ok(diagnostics.warnings.some(w =>
			w.message === 'closeResidentChat dispose failed' && w.fields.error === 'close chat boom'
		));
		assert.strictEqual(connection.disposeCount, 1, 'closeResidentChat must still invoke dispose');
		assert.strictEqual(
			(viewHost as unknown as { chatStreams: Map<string, unknown> }).chatStreams.size,
			0,
			'throw-on-dispose must still delete the Chat handle',
		);

		void connection.disconnect();
		viewHost.onEngineConnectionChanged();
		assert.strictEqual(connection.disposeCount, 1, 'deleted Chat must not be disposed again on disconnect');
	});

	test('disconnect event-stream dispose throw still unloads Chat and posts connectionDown', async () => {
		const connection = new class extends ChatConnection {
			override subscribeSessionEventStream(): { dispose(): void } {
				return {
					dispose: () => {
						throw new Error('close stream boom');
					},
				};
			}
		}();
		const diagnostics = new CountingDiagnostics();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-disconnect-stream-throw');
		await viewHost.whenEngineSessionReady('sess-disconnect-stream-throw');
		assert.strictEqual(connection.opens.length, 1, 'lease + connection-up must open resident Chat');
		assert.strictEqual(connection.disposeCount, 0);

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => frames.push(e)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		void connection.disconnect();
		viewHost.onEngineConnectionChanged();

		assert.ok(diagnostics.warnings.some(w =>
			w.message === 'closeStream dispose failed' && w.fields.error === 'close stream boom'
		));
		assert.strictEqual(connection.disposeCount, 1, 'Chat must still unload after event-stream dispose throw');
		assert.strictEqual(
			(viewHost as unknown as { chatStreams: Map<string, unknown> }).chatStreams.size,
			0,
			'Chat handle must be deleted after connection-down',
		);
		assert.ok(
			closedChromeFromFrames(frames).some(sync => sync.reason === 'connection_down'),
			'connectionDown must still reach Actor and fold closed chrome',
		);
	});
});

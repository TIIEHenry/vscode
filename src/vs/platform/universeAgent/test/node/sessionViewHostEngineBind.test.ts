/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { GrpcStatusCode, UniverseAgentTransportError } from '../../node/grpc/grpcTransport.js';
import { encodeDetailRef } from '../../common/conversationViewFrame.js';
import type { SyncChrome, ViewPatch } from '../../common/sessionView/types.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import { AgentTreeCoordinator, flushAgentTreeCoordinator } from '../../node/agentTreeCoordinator.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import type { UniverseAgentAgentTreeNode, UniverseAgentCreateSessionRequest, UniverseAgentCreateSessionResult, UniverseAgentListSessionsResult } from '../../common/universeAgentTypes.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

const ROOT_TREE: UniverseAgentAgentTreeNode = {
	agentId: 'root',
	name: 'Root',
	type: 'AGENT_TYPE_ROOT',
	status: 'AGENT_STATUS_IDLE',
	model: 'test-model',
	turnCount: 0,
	createdAt: 0,
	children: [],
};

function closedChromeFromFrames(frames: readonly IUniverseAgentSessionViewFrameEvent[]): Extract<SyncChrome, { kind: 'closed' }>[] {
	return frames.flatMap(event => {
		const body = event.frame.frame.body;
		if (body.kind !== 'patches') {
			return [];
		}
		return body.patches.filter((patch): patch is Extract<ViewPatch, { op: 'setSyncChrome' }> => patch.op === 'setSyncChrome');
	}).map(patch => patch.sync).filter((sync): sync is Extract<SyncChrome, { kind: 'closed' }> => sync.kind === 'closed');
}

function liveTreePatchesFromFrames(frames: readonly IUniverseAgentSessionViewFrameEvent[]): Extract<ViewPatch, { op: 'setLiveAgentTree' }>[] {
	return frames.flatMap(event => {
		const body = event.frame.frame.body;
		if (body.kind !== 'patches') {
			return [];
		}
		return body.patches.filter((patch): patch is Extract<ViewPatch, { op: 'setLiveAgentTree' }> => patch.op === 'setLiveAgentTree');
	});
}

function getTreeCoordinator(viewHost: SessionViewHost, sessionId: string): AgentTreeCoordinator | undefined {
	const sidecars = (viewHost as unknown as { sessionSidecars: Map<string, { tree: AgentTreeCoordinator }> }).sessionSidecars;
	return sidecars.get(sessionId)?.tree;
}

class BindConnection extends TestConnection {
	readonly chatSessionIds: string[] = [];
	readonly streamSessionIds: string[] = [];
	createdEngineId = 'eng-real';

	override async createSession(request: UniverseAgentCreateSessionRequest = {}): Promise<UniverseAgentCreateSessionResult> {
		this.createSessionCalls.push(request);
		this.createdEngineSessionIds.add(this.createdEngineId);
		return { sessionId: this.createdEngineId };
	}

	override subscribeSessionEventStream(sessionId: string, listener: (event: { payload: unknown }) => void) {
		this.streamSessionIds.push(sessionId);
		return super.subscribeSessionEventStream(sessionId, listener);
	}

	openChatStream(sessionId: string) {
		this.chatSessionIds.push(sessionId);
		return {
			write: () => { },
			dispose: () => { },
		};
	}

	override async chat(request: { sessionId: string }) {
		this.chatSessionIds.push(request.sessionId);
	}
}

suite('SessionViewHost engine session bind', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('Create before stream/chat; engine id is used, not local stub', async () => {
		const connection = new BindConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('local-untitled');
		const engineId = await viewHost.whenEngineSessionReady('local-untitled');

		assert.strictEqual(engineId, 'eng-real');
		assert.deepStrictEqual(connection.resumeSessionCalls, [{ sessionId: 'local-untitled' }]);
		assert.strictEqual(connection.createSessionCalls.length, 1);
		assert.strictEqual(connection.createSessionCalls[0]?.clientSessionId, 'local-untitled');
		assert.deepStrictEqual(connection.streamSessionIds, ['eng-real']);
		assert.deepStrictEqual(connection.chatSessionIds, ['eng-real']);
		assert.ok(!connection.streamSessionIds.includes('local-untitled'));
		assert.ok(!connection.chatSessionIds.includes('local-untitled'));

		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: 'hello engine' });
		assert.strictEqual(outcome.accepted, true);
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		assert.ok(connection.chatSessionIds.every(id => id === 'eng-real'));
	});

	test('Chat is not sent until Create returns a session_id', async () => {
		let resolveCreate: (value: { sessionId: string }) => void = () => { };
		const connection = new class extends BindConnection {
			override async createSession(): Promise<UniverseAgentCreateSessionResult> {
				this.createSessionCalls.push({});
				return new Promise<{ sessionId: string }>(resolve => {
					resolveCreate = resolve;
				});
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('local-wait');
		for (let i = 0; i < 50 && connection.createSessionCalls.length === 0; i++) {
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		}
		assert.strictEqual(connection.createSessionCalls.length, 1);
		assert.strictEqual(connection.streamSessionIds.length, 0);
		assert.strictEqual(connection.chatSessionIds.length, 0);

		resolveCreate({ sessionId: 'eng-late' });
		await viewHost.whenEngineSessionReady('local-wait');
		assert.deepStrictEqual(connection.streamSessionIds, ['eng-late']);
		assert.deepStrictEqual(connection.chatSessionIds, ['eng-late']);
	});

	test('reconnect Resumes the bound engine id and does not Create again', async () => {
		const connection = new BindConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('local-resume');
		await viewHost.whenEngineSessionReady('local-resume');
		assert.strictEqual(connection.createSessionCalls.length, 1);

		await connection.disconnect();
		viewHost.onEngineConnectionChanged();
		connection['connected'] = true;
		viewHost.onEngineConnectionChanged();
		await viewHost.whenEngineSessionReady('local-resume');

		assert.strictEqual(connection.createSessionCalls.length, 1);
		assert.deepStrictEqual(connection.resumeSessionCalls, [
			{ sessionId: 'local-resume' },
			{ sessionId: 'eng-real' },
		]);
	});

	test('Resume(localId) success does not Create (roster already created)', async () => {
		const connection = new BindConnection();
		connection.createdEngineSessionIds.add('session-100');
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('session-100');
		const engineId = await viewHost.whenEngineSessionReady('session-100');

		assert.strictEqual(engineId, 'session-100');
		assert.strictEqual(connection.createSessionCalls.length, 0);
		assert.deepStrictEqual(connection.resumeSessionCalls, [{ sessionId: 'session-100' }]);
		assert.deepStrictEqual(connection.streamSessionIds, ['session-100']);
		assert.deepStrictEqual(connection.chatSessionIds, ['session-100']);
	});

	test('Resume of cached engine id failure is not treated as bind success', async () => {
		const connection = new BindConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('local-dead');
		await viewHost.whenEngineSessionReady('local-dead');
		assert.strictEqual(connection.createSessionCalls.length, 1);

		await connection.disconnect();
		viewHost.onEngineConnectionChanged();
		connection['connected'] = true;
		connection.resumeSessionResult = { ok: false, message: 'dead shell' };
		viewHost.onEngineConnectionChanged();
		await assert.rejects(
			() => viewHost.whenEngineSessionReady('local-dead'),
			(error: unknown) => error instanceof Error && /Resume bound session eng-real failed: dead shell/.test(error.message),
		);
		assert.strictEqual(connection.createSessionCalls.length, 1);
	});

	test('Create ALREADY_EXISTS Resumes listed session_id and does not Create again', async () => {
		const connection = new class extends BindConnection {
			override async createSession(): Promise<UniverseAgentCreateSessionResult> {
				this.createSessionCalls.push({});
				throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, '6 ALREADY_EXISTS: Session already exists');
			}
			override async listSessions(): Promise<UniverseAgentListSessionsResult> {
				return { sessions: [{ sessionId: 'eng-listed', title: 'Hello' }] };
			}
			override async resumeSession(request: { sessionId: string }) {
				this.resumeSessionCalls.push(request);
				return { ok: request.sessionId === 'eng-listed' };
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('local-exists');
		const engineId = await viewHost.whenEngineSessionReady('local-exists');

		assert.strictEqual(engineId, 'eng-listed');
		assert.strictEqual(connection.createSessionCalls.length, 1);
		assert.deepStrictEqual(connection.resumeSessionCalls, [
			{ sessionId: 'local-exists' },
			{ sessionId: 'eng-listed' },
		]);
		assert.deepStrictEqual(connection.streamSessionIds, ['eng-listed']);
		assert.deepStrictEqual(connection.chatSessionIds, ['eng-listed']);
	});

	test('Create ALREADY_EXISTS prefers List title match over first row', async () => {
		const connection = new class extends BindConnection {
			override async createSession(): Promise<UniverseAgentCreateSessionResult> {
				this.createSessionCalls.push({});
				throw new UniverseAgentTransportError(6, 'Session already exists');
			}
			override async listSessions(): Promise<UniverseAgentListSessionsResult> {
				return {
					sessions: [
						{ sessionId: 'eng-first', title: 'Other' },
						{ sessionId: 'eng-match', title: 'local-exists' },
					],
				};
			}
			override async resumeSession(request: { sessionId: string }) {
				this.resumeSessionCalls.push(request);
				return { ok: request.sessionId === 'eng-match' };
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('local-exists');
		const engineId = await viewHost.whenEngineSessionReady('local-exists');
		assert.strictEqual(engineId, 'eng-match');
		assert.deepStrictEqual(connection.resumeSessionCalls, [
			{ sessionId: 'local-exists' },
			{ sessionId: 'eng-match' },
		]);
	});

	test('Create ALREADY_EXISTS with List transport/query failure Resumes localId', async () => {
		let resumeCount = 0;
		const connection = new class extends BindConnection {
			override async createSession(request: UniverseAgentCreateSessionRequest = {}): Promise<UniverseAgentCreateSessionResult> {
				this.createSessionCalls.push(request);
				throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
			}
			override async listSessions(): Promise<UniverseAgentListSessionsResult> {
				throw new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, 'Query does not return results');
			}
			override async resumeSession(request: { sessionId: string }) {
				this.resumeSessionCalls.push(request);
				resumeCount += 1;
				return { ok: resumeCount > 1 };
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('session-100');
		const engineId = await viewHost.whenEngineSessionReady('session-100');
		assert.strictEqual(engineId, 'session-100');
		assert.strictEqual(connection.createSessionCalls.length, 1);
		assert.strictEqual(connection.createSessionCalls[0]?.clientSessionId, 'session-100');
		assert.deepStrictEqual(connection.resumeSessionCalls, [
			{ sessionId: 'session-100' },
			{ sessionId: 'session-100' },
		]);
		assert.deepStrictEqual(connection.streamSessionIds, ['session-100']);
		assert.deepStrictEqual(connection.chatSessionIds, ['session-100']);
	});

	test('Create ALREADY_EXISTS with empty List Resumes localId and does not retry Create', async () => {
		let resumeCount = 0;
		const connection = new class extends BindConnection {
			override async createSession(request: UniverseAgentCreateSessionRequest = {}): Promise<UniverseAgentCreateSessionResult> {
				this.createSessionCalls.push(request);
				throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
			}
			override async resumeSession(request: { sessionId: string }) {
				this.resumeSessionCalls.push(request);
				resumeCount += 1;
				return { ok: resumeCount > 1 };
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('session-100');
		const engineId = await viewHost.whenEngineSessionReady('session-100');
		assert.strictEqual(engineId, 'session-100');
		assert.strictEqual(connection.createSessionCalls.length, 1);
		assert.strictEqual(connection.createSessionCalls[0]?.clientSessionId, 'session-100');
		assert.deepStrictEqual(connection.resumeSessionCalls, [
			{ sessionId: 'session-100' },
			{ sessionId: 'session-100' },
		]);
		assert.deepStrictEqual(connection.streamSessionIds, ['session-100']);
		assert.deepStrictEqual(connection.chatSessionIds, ['session-100']);
	});

	test('Create ALREADY_EXISTS with empty List and Resume ok=false is not treated as Create success', async () => {
		const connection = new class extends BindConnection {
			override async createSession(request: UniverseAgentCreateSessionRequest = {}): Promise<UniverseAgentCreateSessionResult> {
				this.createSessionCalls.push(request);
				throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
			}
			override async resumeSession(request: { sessionId: string }) {
				this.resumeSessionCalls.push(request);
				return { ok: false, message: 'dead shell' };
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		await assert.rejects(
			() => viewHost.whenEngineSessionReady('session-100'),
			(error: unknown) => error instanceof Error
				&& /Resume\(session-100\) failed: dead shell/.test(error.message),
		);
		assert.strictEqual(connection.createSessionCalls.length, 1);
	});

	test('connection without resumeSession still Resumes via transport and does not Create', async () => {
		const connection = new BindConnection();
		connection.createdEngineSessionIds.add('session-100');
		const transportResume = connection.resumeSession.bind(connection);
		Object.defineProperty(connection, 'resumeSession', { configurable: true, value: undefined });
		(connection as { transport?: { resumeSession: typeof transportResume } }).transport = {
			resumeSession: transportResume,
		};
		assert.strictEqual(typeof connection.resumeSession, 'undefined');
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('session-100');
		const engineId = await viewHost.whenEngineSessionReady('session-100');

		assert.strictEqual(engineId, 'session-100');
		assert.strictEqual(connection.createSessionCalls.length, 0);
		assert.deepStrictEqual(connection.resumeSessionCalls, [{ sessionId: 'session-100' }]);
	});

	test('connection without resumeSession or transport does not fall through to Create', async () => {
		const connection = new BindConnection();
		Object.defineProperty(connection, 'resumeSession', { configurable: true, value: undefined });
		assert.strictEqual(typeof connection.resumeSession, 'undefined');
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		await assert.rejects(
			() => viewHost.whenEngineSessionReady('session-100'),
			(error: unknown) => error instanceof Error && /SessionService\.Resume is required/.test(error.message),
		);
		assert.strictEqual(connection.createSessionCalls.length, 0);
	});

	test('Create non-ALREADY_EXISTS errors still throw without List recover', async () => {
		const connection = new class extends BindConnection {
			listCalled = false;
			override async createSession(): Promise<UniverseAgentCreateSessionResult> {
				this.createSessionCalls.push({});
				throw new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, 'engine down');
			}
			override async listSessions(): Promise<UniverseAgentListSessionsResult> {
				this.listCalled = true;
				return { sessions: [{ sessionId: 'should-not-use' }] };
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		await assert.rejects(
			() => viewHost.whenEngineSessionReady('local-fail'),
			(error: unknown) => error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNAVAILABLE,
		);
		assert.strictEqual(connection.listCalled, false);
	});

	test('requestDetail bind failure returns failed outcome and does not reject', async () => {
		const connection = new class extends BindConnection {
			override async createSession(): Promise<UniverseAgentCreateSessionResult> {
				this.createSessionCalls.push({});
				throw new Error('CreateSession refused');
			}
			override async resumeSession(request: { sessionId: string }) {
				this.resumeSessionCalls.push(request);
				return { ok: false, message: 'dead shell' };
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		const leaseId = viewHost.acquireLease('local-detail-fail');
		const outcome = await viewHost.requestDetail(leaseId, encodeDetailRef({
			toolCallId: 'tc',
			detailKind: 1,
			refId: 'tc',
		}));
		assert.strictEqual(outcome.ok, false);
		if (!outcome.ok) {
			assert.strictEqual(outcome.reason, 'failed');
			assert.ok(outcome.message && /CreateSession refused|dead shell/.test(outcome.message));
		}
	});

	test('requestDetail fetchToolDetail rejection returns failed and does not leak unhandledRejection', async () => {
		class ThrowingDetailHost extends TestHost {
			override async fetchToolDetail(): Promise<never> {
				throw new Error('fetchToolDetail exploded');
			}
		}
		const connection = new BindConnection();
		const viewHost = store.add(new SessionViewHost(connection, new ThrowingDetailHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		const leaseId = viewHost.acquireLease('local-detail-throw');
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		process.on('unhandledRejection', onUnhandled);
		try {
			const outcome = await viewHost.requestDetail(leaseId, encodeDetailRef({
				toolCallId: 'tc',
				detailKind: 1,
				refId: 'tc',
			}));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.strictEqual(outcome.ok, false);
			if (!outcome.ok) {
				assert.strictEqual(outcome.reason, 'failed');
				assert.ok(outcome.message && /fetchToolDetail exploded/.test(outcome.message));
			}
			assert.deepStrictEqual(rejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('requestDetail passes through host fetchToolDetail ok:false without rewriting', async () => {
		const connection = new BindConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		const leaseId = viewHost.acquireLease('local-detail-unavailable');
		const outcome = await viewHost.requestDetail(leaseId, encodeDetailRef({
			toolCallId: 'tc',
			detailKind: 1,
			refId: 'tc',
		}));
		assert.strictEqual(outcome.ok, false);
		if (!outcome.ok) {
			assert.strictEqual(outcome.reason, 'unavailable');
		}
	});

	test('leftover-looks-live onEngineConnectionChanged does not bring-up as live reconnect', async () => {
		const connection = new BindConnection();
		const host = new TestHost(async () => undefined);
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 0,
		}));
		const leaseId = viewHost.acquireLease('local-looks-live');
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => frames.push(event)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		connection.setPairingPending(true);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);

		viewHost.onEngineConnectionChanged();
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await new Promise<void>(resolve => setImmediate(() => resolve()));

		assert.strictEqual(connection.createSessionCalls.length, 0);
		assert.deepStrictEqual(connection.resumeSessionCalls, []);
		assert.deepStrictEqual(connection.streamSessionIds, []);
		assert.deepStrictEqual(connection.chatSessionIds, []);
		assert.strictEqual(host.treeFetchCount, 0);
		assert.ok(
			!closedChromeFromFrames(frames).some(sync => sync.reason === 'connection_down'),
			'leftover-looks-live must not post connectionDown',
		);
	});

	test('leftover-looks-live scheduleAgentTreeRefresh does not fetch or post live tree', async () => {
		const connection = new BindConnection();
		const host = new TestHost(async () => ROOT_TREE);
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 0,
		}));
		const leaseId = viewHost.acquireLease('local-tree-refresh-hold');
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => frames.push(event)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		connection.setPairingPending(true);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);

		host.requestRefresh('local-tree-refresh-hold');
		connection.pushStreamEvent('eng-real', { sub_agent_completed: {} });
		const coordinator = getTreeCoordinator(viewHost, 'local-tree-refresh-hold');
		if (coordinator) {
			await flushAgentTreeCoordinator(coordinator);
		} else {
			await new Promise<void>(resolve => setTimeout(resolve, 270));
		}

		assert.strictEqual(host.treeFetchCount, 0, 'leftover-looks-live must not fetchAgentTree');
		assert.strictEqual(liveTreePatchesFromFrames(frames).length, 0, 'leftover-looks-live must not postAgentTreeBound');
	});

	test('leftover-looks-live scheduleAgentTreeRefresh is a no-op', async () => {
		const connection = new BindConnection();
		const host = new TestHost(async () => ROOT_TREE);
		const viewHost = store.add(new SessionViewHost(connection, host, {
			orphanTimeoutMs: 0,
		}));
		const leaseId = viewHost.acquireLease('local-tree-looks-live');
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => frames.push(event)));
		viewHost.onEngineConnectionChanged();
		await viewHost.whenEngineSessionReady('local-tree-looks-live');
		const coordinator = getTreeCoordinator(viewHost, 'local-tree-looks-live');
		if (coordinator) {
			await flushAgentTreeCoordinator(coordinator);
		}
		const fetchesAfterBringUp = host.treeFetchCount;
		const liveTreesAfterBringUp = liveTreePatchesFromFrames(frames).length;

		connection.setPairingPending(true);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);

		host.requestRefresh('local-tree-looks-live');
		connection.pushStreamEvent('eng-real', { sub_agent_completed: {} });
		if (coordinator) {
			await flushAgentTreeCoordinator(coordinator);
		} else {
			await new Promise<void>(resolve => setTimeout(resolve, 270));
		}

		assert.strictEqual(host.treeFetchCount, fetchesAfterBringUp, 'leftover-looks-live must not fetchAgentTree');
		assert.strictEqual(liveTreePatchesFromFrames(frames).length, liveTreesAfterBringUp, 'leftover-looks-live must not postAgentTreeBound');
	});
});

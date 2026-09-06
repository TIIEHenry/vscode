/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IUniverseAgentSessionView } from '../../../../../platform/universeAgent/common/universeAgentSessionView.js';
import type {
	UniverseAgentConnectionSnapshot,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { ConversationEngineRosterService, ENGINE_BIND_FAILED_SESSION_ID, isEngineRosterPlaceholderSessionId } from '../../browser/conversationEngineRosterService.js';
import { postBound } from '../../browser/conversationLensComposer.js';
import { CONVERSATION_ROSTER_STORAGE_KEY } from '../../browser/conversationRosterStorage.js';

class MockUniverseAgentConnection extends Disposable implements IUniverseAgentConnection {
	declare readonly _serviceBrand: undefined;
	readonly onDidFileMutation = Event.None;
	readonly onDidTurnSettle = Event.None;
	readonly onDidChangeTeamRuntime = Event.None;
	readonly team = {
		memberStatus: async () => [],
		taskList: async () => [],
		teamInfo: async () => undefined,
	};
	private connected = false;
	private sessions: { sessionId: string; title?: string }[] = [];
	private readonly _onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();
	readonly onDidChangeConnection = this._onDidChangeConnection.event;

	setConnected(value: boolean): void {
		this.connected = value;
		this._onDidChangeConnection.fire(this.getConnectionSnapshot());
	}

	setListSessions(sessions: { sessionId: string; title?: string }[]): void {
		this.sessions = sessions;
	}

	isEngineConnected(): boolean {
		return this.connected;
	}

	getTransportState() { return 'ok' as const; }
	getConnectionPhase() {
		return this.connected
			? { kind: 'connected' as const, path: 'loopback' as const }
			: { kind: 'disconnected' as const };
	}
	getConnectionSnapshot(): UniverseAgentConnectionSnapshot {
		return {
			transport: 'ok',
			sessionToken: this.connected ? 'tok' : undefined,
			pairingPending: false,
			channelAlive: this.connected,
			sharedFsRootSent: false,
			capabilities: {} as UniverseAgentConnectionSnapshot['capabilities'],
		};
	}
	getCapabilitySnapshot() { return this.getConnectionSnapshot().capabilities; }
	requestAgentTreeRefresh(sessionId?: string) {
		this.treeRefreshCalls.push(sessionId ?? '');
	}
	getNavigatorCapability() { return 'UNKNOWN' as const; }
	isAgentTreeFetchFailed() { return false; }
	async connect() { return { methods: [], events: [], sessionToken: 'tok' }; }
	async connectProfile() { return { ok: false as const, code: 'transport_failed' as const, reason: 'stub' }; }
	async confirmPairing() { return { ok: false as const, code: 'transport_failed' as const, reason: 'stub' }; }
	async cancelPairing() { }
	async probeConnectionProfile() { return { ok: false as const, code: 'transport_failed' as const, reason: 'stub' }; }
	async disconnect() { this.setConnected(false); }
	async listSessions() {
		if (this.listSessionsError) {
			throw this.listSessionsError;
		}
		return { sessions: this.sessions.map(s => ({ sessionId: s.sessionId, title: s.title })) };
	}
	readonly renameCalls: { sessionId: string; title: string }[] = [];
	readonly createCalls: { title?: string; clientSessionId?: string }[] = [];
	createSessionResult: { sessionId: string } = { sessionId: 'ua-new' };
	createSessionError: Error | undefined;
	listSessionsError: Error | undefined;
	readonly treeRefreshCalls: string[] = [];
	async createSession(request: { title?: string; clientSessionId?: string }) {
		this.createCalls.push({ title: request.title, clientSessionId: request.clientSessionId });
		if (this.createSessionError) {
			throw this.createSessionError;
		}
		return this.createSessionResult;
	}
	async deleteSession() { }
	async renameSession(request: { sessionId: string; title: string }) {
		this.renameCalls.push({ sessionId: request.sessionId, title: request.title });
		return { ok: true };
	}
	readonly cancelCalls: { sessionId: string; agentId: string }[] = [];
	async cancelGeneration(request: { sessionId: string; agentId: string }) {
		this.cancelCalls.push({ sessionId: request.sessionId, agentId: request.agentId });
		return { ok: true };
	}
	readonly setGoalCalls: { sessionId: string; goal: string }[] = [];
	async setSessionGoal(request: { sessionId: string; goal: string }) {
		this.setGoalCalls.push({ sessionId: request.sessionId, goal: request.goal });
		return { ok: true };
	}
	readonly cancelGoalCalls: { sessionId: string }[] = [];
	async cancelSessionGoal(request: { sessionId: string }) {
		this.cancelGoalCalls.push({ sessionId: request.sessionId });
		return { ok: true };
	}
	readonly forkCalls: { sessionId: string; parentAgentId?: string; name?: string; task?: string }[] = [];
	async forkAgent(request: { sessionId: string; parentAgentId?: string; name?: string; task?: string }) {
		this.forkCalls.push({
			sessionId: request.sessionId,
			parentAgentId: request.parentAgentId,
			name: request.name,
			task: request.task,
		});
		return { ok: true, agentId: 'sub:reviewer' };
	}
	readonly killCalls: { sessionId: string; agentId: string; force?: boolean }[] = [];
	readonly createSnapshotCalls: { sessionId: string; title: string; description?: string }[] = [];
	async createSnapshot(request: { sessionId: string; title: string; description?: string }) {
		this.createSnapshotCalls.push({
			sessionId: request.sessionId,
			title: request.title,
			description: request.description,
		});
		return { ok: true };
	}
	async killAgent(request: { sessionId: string; agentId: string; force?: boolean }) {
		this.killCalls.push({
			sessionId: request.sessionId,
			agentId: request.agentId,
			force: request.force,
		});
		return { ok: true };
	}
	readonly editMessageCalls: { sessionId: string; turnId: string; newContent: string; agentId?: string }[] = [];
	async editMessage(request: { sessionId: string; turnId: string; newContent: string; agentId?: string }) {
		this.editMessageCalls.push({
			sessionId: request.sessionId,
			turnId: request.turnId,
			newContent: request.newContent,
			agentId: request.agentId,
		});
		return { ok: true };
	}
	readonly cancelToolCallCalls: { sessionId: string; agentId?: string; toolCallId: string }[] = [];
	async cancelToolCall(request: { sessionId: string; agentId?: string; toolCallId: string }) {
		this.cancelToolCallCalls.push({
			sessionId: request.sessionId,
			agentId: request.agentId,
			toolCallId: request.toolCallId,
		});
		return { ok: true };
	}
	readonly deleteMessageCalls: { sessionId: string; turnId: string; agentId?: string }[] = [];
	async deleteMessage(request: { sessionId: string; turnId: string; agentId?: string }) {
		this.deleteMessageCalls.push({
			sessionId: request.sessionId,
			turnId: request.turnId,
			agentId: request.agentId,
		});
		return { ok: true };
	}
	readonly respondPermissionCalls: { sessionId: string; requestId: string; granted: boolean }[] = [];
	async respondPermission(request: { sessionId: string; requestId: string; granted: boolean }) {
		this.respondPermissionCalls.push({
			sessionId: request.sessionId,
			requestId: request.requestId,
			granted: request.granted,
		});
		return { ok: true };
	}
	readonly sendClientToolResponseCalls: { sessionId: string; callId: string; content?: string; isError?: boolean; metadataJson?: string }[] = [];
	async sendClientToolResponse(request: { sessionId: string; callId: string; content?: string; isError?: boolean; metadataJson?: string }) {
		this.sendClientToolResponseCalls.push({
			sessionId: request.sessionId,
			callId: request.callId,
			content: request.content,
			isError: request.isError,
			metadataJson: request.metadataJson,
		});
		return { ok: true };
	}
	readonly respondQuestionCalls: { sessionId: string; questionId: string; answers?: Readonly<Record<string, { readonly selectedLabels: readonly string[] }>>; customText?: string }[] = [];
	async respondQuestion(request: { sessionId: string; questionId: string; answers?: Readonly<Record<string, { readonly selectedLabels: readonly string[] }>>; customText?: string }) {
		this.respondQuestionCalls.push({
			sessionId: request.sessionId,
			questionId: request.questionId,
			answers: request.answers,
			customText: request.customText,
		});
		return { ok: true };
	}
	readonly enqueueCalls: { sessionId: string; text: string; priority?: string; opId?: string }[] = [];
	async enqueueQueueItem(request: { sessionId: string; text: string; priority?: string; opId?: string }) {
		this.enqueueCalls.push({
			sessionId: request.sessionId,
			text: request.text,
			priority: request.priority,
			opId: request.opId,
		});
		return { ok: true };
	}
	readonly pauseQueueCalls: { sessionId: string }[] = [];
	async pauseQueue(request: { sessionId: string }) {
		this.pauseQueueCalls.push({ sessionId: request.sessionId });
		return { ok: true };
	}
	readonly resumeQueueCalls: { sessionId: string }[] = [];
	async resumeQueue(request: { sessionId: string }) {
		this.resumeQueueCalls.push({ sessionId: request.sessionId });
		return { ok: true };
	}
	readonly clearQueueCalls: { sessionId: string }[] = [];
	async clearQueue(request: { sessionId: string }) {
		this.clearQueueCalls.push({ sessionId: request.sessionId });
		return { ok: true };
	}
	readonly holdQueueCalls: { sessionId: string; itemId: string; reason: string }[] = [];
	async holdQueueItem(request: { sessionId: string; itemId: string; reason: string }) {
		this.holdQueueCalls.push({ sessionId: request.sessionId, itemId: request.itemId, reason: request.reason });
		return { ok: true };
	}
	readonly releaseQueueCalls: { sessionId: string; itemId: string }[] = [];
	async releaseQueueItemHold(request: { sessionId: string; itemId: string }) {
		this.releaseQueueCalls.push({ sessionId: request.sessionId, itemId: request.itemId });
		return { ok: true };
	}
	readonly editQueueCalls: { sessionId: string; itemId: string; text: string }[] = [];
	async editQueueItem(request: { sessionId: string; itemId: string; text: string }) {
		this.editQueueCalls.push({ sessionId: request.sessionId, itemId: request.itemId, text: request.text });
		return { ok: true };
	}
	async getHistory() { return { envelopes: [] }; }
	subscribeSessionEventStream(
		_sessionId: string,
		_listener: (event: UniverseAgentSessionEvent) => void,
		_onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	) { return { dispose: () => { } }; }
	async chat() { }
	async listSkills() { return { skills: [] }; }
	async setSkillEnabled() { return { ok: true }; }
	async getSkillInfo() { return { name: '', content: '', source: 'unknown' as const, enabled: false }; }
	async listAgentProfiles() { return { profiles: [] }; }
	async saveAgentProfile(request: { profile: { id: string; name: string } }) { return { profile: request.profile }; }
	async deleteAgentProfile() { return { ok: true }; }
	async resetAgentProfile() { return { ok: true }; }
	async listMcpServers() { return { servers: [] }; }
	async getMcpServerStatuses() { return { statuses: [] }; }
	async getMcpServerTools() { return { tools: [] }; }
	async listPlugins() { return { plugins: [] }; }
	async getPluginInfo() { return { summary: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const }, hooks: [] }; }
	async enablePlugin() { return { plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }; }
	async reloadPlugin() { return { plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }; }
	async unloadPlugin() { return { removedHookCount: 0 }; }
	async scanNewPlugins() { return { newPlugins: [], skippedCount: 0 }; }
	async toggleMcpServer() { return { ok: true }; }
	async addMcpServer() { return { ok: true }; }
	async updateMcpServer() { return { ok: true }; }
	async removeMcpServer() { return { ok: true }; }
	async listTools() { return { tools: [] }; }
	async listModels() { return { models: [] }; }
	async probeEngine() { return { ok: false as const, reason: 'stub' }; }
}

class MockUniverseAgentSessionView implements IUniverseAgentSessionView {
	declare readonly _serviceBrand: undefined;
	onDynamicDidApplyFrame(_leaseId: string) { return Event.None; }
	async acquireLease(sessionId: string) { return `lease:${sessionId}`; }
	async releaseLease() { }
	async post() { return { accepted: true as const, correlation: { id: 'mock' } }; }
	async requestResync() { }
	async acknowledge() { }
	async requestDetail() { return { ok: false as const, reason: 'unavailable' as const }; }
}

function createService(connection: MockUniverseAgentConnection, storage?: TestStorageService): ConversationEngineRosterService {
	const workspaceToolsGate = {
		_serviceBrand: undefined,
		shouldAdvertise: () => true,
	};
	return new ConversationEngineRosterService(
		connection as unknown as IUniverseAgentConnection,
		new MockUniverseAgentSessionView() as unknown as IUniverseAgentSessionView,
		workspaceToolsGate,
		storage,
	);
}

async function awaitEngineCatalogRefresh(service: ConversationEngineRosterService): Promise<void> {
	await service.whenEngineCatalogRefreshComplete();
	await new Promise<void>(resolve => setTimeout(resolve, 0));
}

suite('ConversationEngineRosterService (M6-A2)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('appendStubEchoAssistant is rejected while engine connected', () => {
		const connection = store.add(new MockUniverseAgentConnection());
		const service = store.add(createService(connection));
		connection.setConnected(true);
		service.setEngineConnected(true);

		assert.throws(
			() => service.appendStubEchoAssistant('ua-1', 'nope'),
			/appendStubEchoAssistant is forbidden/,
		);
	});

	test('unconnected path still uses stub frame source with stub echo', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		const service = store.add(createService(connection));
		const sessionId = service.getActiveSessionId();
		const lease = store.add(service.acquireSessionView(sessionId));
		assert.strictEqual(service.isEngineConnected(), false);

		const outcome = await lease.post({ kind: 'submitInput', text: 'hello stub' });
		assert.strictEqual(outcome.accepted, true);
		assert.ok(service.getSessions().some(s => s.id === 'untitled'));
	});

	test('connected deleteSession last entry does not refill stub seeds', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.getSessions().length, 1);
		assert.strictEqual(service.getSessions()[0]!.id, 'ua-only');
		assert.strictEqual(service.deleteSession('ua-only'), true);
		assert.strictEqual(service.getSessions().length, 1);
		assert.strictEqual(service.getSessions()[0]!.id, ENGINE_BIND_FAILED_SESSION_ID);
		assert.ok(!service.getSessions().some(s => s.id === 'untitled' || s.id === 'visualize'));
		assert.strictEqual(service.isEngineSessionReady(), false);
	});

	test('disconnected after engine deleteSession still avoids stub seed refill', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([
			{ sessionId: 'ua-a', title: 'A' },
			{ sessionId: 'ua-b', title: 'B' },
		]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		service.switchSession('ua-a');
		assert.strictEqual(service.deleteSession('ua-a'), true);
		assert.strictEqual(service.deleteSession('ua-b'), true);
		assert.strictEqual(service.getSessions().length, 0);
		assert.ok(!service.getSessions().some(s => s.id === 'untitled'));
	});

	test('isEngineConnected follows connected phase when platform isEngineConnected is false', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		const service = store.add(createService(connection));
		connection.setConnected(false);
		(connection as unknown as { getConnectionPhase(): { kind: 'connected'; path: 'direct' } }).getConnectionPhase = () => ({ kind: 'connected', path: 'direct' });
		const snapshot = connection.getConnectionSnapshot();
		(connection as unknown as { getConnectionSnapshot(): typeof snapshot }).getConnectionSnapshot = () => ({
			...snapshot,
			pairingPending: false,
			channelAlive: true,
			sessionToken: 'tok',
		});
		(connection as unknown as { _onDidChangeConnection: Emitter<UniverseAgentConnectionSnapshot> })._onDidChangeConnection.fire(connection.getConnectionSnapshot());
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.isEngineConnected(), true);
	});

	test('list incomplete hides stub seed rows while connected', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		const service = store.add(createService(connection));
		connection.setConnected(true);
		service.setEngineConnected(true);
		// listSessions not seeded → refresh fails → listCompleted false
		assert.strictEqual(service.getSessions().length, 0);
		assert.ok(!service.getSessions().some(s => s.id === 'untitled'));
		assert.strictEqual(service.getActiveSessionId(), '');
		assert.strictEqual(service.isEngineSessionReady(), false);
	});

	test('connected empty list with default mock acquires host lease without roster create', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([]);
		const service = store.add(createService(connection));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(connection.createCalls.length, 0);
		assert.ok(service.getSessions().length > 0);
		assert.strictEqual(service.isEngineSessionReady(), true);
	});

	test('connected empty list defers Create to host lease and adopts clientSessionId on bind', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([]);
		const acquireLeaseCalls: string[] = [];
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async (sessionId: string) => {
				acquireLeaseCalls.push(sessionId);
				return `lease:${sessionId}`;
			},
			releaseLease: async () => { },
			post: async () => ({ accepted: true as const, correlation: { id: 'mock' } }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
		));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(connection.createCalls.length, 0, 'roster must not call SessionService.Create');
		assert.ok(acquireLeaseCalls.length >= 1, 'host lease must be acquired exactly once');
		const boundSessionId = acquireLeaseCalls[acquireLeaseCalls.length - 1]!;
		assert.ok(boundSessionId.startsWith('session-'));
		assert.strictEqual(service.getActiveSessionId(), boundSessionId);
		assert.ok(service.getSessions().some(session => session.id === boundSessionId));
		assert.strictEqual(service.isEngineSessionReady(), true);
		assert.ok(!service.getSessions().some(session => session.id === 'untitled'));
	});

	test('connected listed session switches to engine id without untitled fallback', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-listed', title: 'Listed UA' }]);
		const service = store.add(createService(connection));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.getActiveSessionId(), 'ua-listed');
		assert.strictEqual(connection.createCalls.length, 0);
		assert.strictEqual(service.isEngineSessionReady(), true);
		assert.ok(!service.getSessions().some(session => session.id === 'untitled'));
	});

	test('empty list allocates stable clientSessionId for host lease without roster Create', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		let listCalls = 0;
		connection.listSessions = async () => {
			listCalls++;
			return { sessions: [] };
		};
		const acquireLeaseCalls: string[] = [];
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async (sessionId: string) => {
				acquireLeaseCalls.push(sessionId);
				return `lease:${sessionId}`;
			},
			releaseLease: async () => { },
			post: async () => ({ accepted: true as const, correlation: { id: 'mock' } }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
		));
		service.setEngineConnected(true);
		await awaitEngineCatalogRefresh(service);

		assert.strictEqual(connection.createCalls.length, 0);
		assert.strictEqual(listCalls, 1);
		assert.strictEqual(acquireLeaseCalls.length, 1);
		const clientSessionId = acquireLeaseCalls[0];
		assert.ok(clientSessionId?.startsWith('session-'));
		assert.notStrictEqual(clientSessionId, ENGINE_BIND_FAILED_SESSION_ID);
		assert.strictEqual(service.getActiveSessionId(), clientSessionId);
	});

	test('empty list host lease bind failure shows bind-failed roster row', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([]);
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async () => { throw new Error('session not found'); },
			releaseLease: async () => { },
			post: async () => ({ accepted: false as const, reason: 'no_such_session' as const }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
		));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(connection.createCalls.length, 0);
		assert.strictEqual(service.isEngineSessionReady(), false);
		assert.strictEqual(service.getSessions().length, 1);
		assert.strictEqual(service.getSessions()[0]?.id, ENGINE_BIND_FAILED_SESSION_ID);
		assert.ok(service.getSessions()[0]?.title.includes('bind failed'));
		assert.strictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
		assert.ok(!service.getSessions().some(session => session.title === 'New session'));
		assert.ok(!service.getSessions().some(session => session.id === 'untitled'));
		assert.strictEqual(service.getTurns('untitled').length, 0);
		assert.strictEqual(service.getTurns(ENGINE_BIND_FAILED_SESSION_ID).length, 0);
	});

	test('listed ghost sessions with lease bind failure shows bind-failed roster row', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([
			{ sessionId: 'session-100', title: 'Ghost 100' },
			{ sessionId: 'session-101', title: 'Ghost 101' },
		]);
		const acquireLeaseCalls: string[] = [];
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async (sessionId: string) => {
				acquireLeaseCalls.push(sessionId);
				throw new Error('session not found');
			},
			releaseLease: async () => { },
			post: async () => ({ accepted: false as const, reason: 'no_such_session' as const }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
		));
		service.setEngineConnected(true);
		await awaitEngineCatalogRefresh(service);

		assert.strictEqual(connection.createCalls.length, 0);
		assert.ok(acquireLeaseCalls.includes('session-100'));
		assert.strictEqual(acquireLeaseCalls.filter(id => id === 'session-100').length, acquireLeaseCalls.length);
		assert.strictEqual(service.isEngineSessionReady(), false);
		assert.strictEqual(service.getSessions().length, 1);
		assert.strictEqual(service.getSessions()[0]?.id, ENGINE_BIND_FAILED_SESSION_ID);
		assert.ok(service.getSessions()[0]?.title.includes('bind failed'));
		assert.strictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
		assert.ok(!service.getSessions().some(session => session.title === 'New session'));
		assert.ok(!service.getSessions().some(session => session.id === 'session-100'));
		assert.ok(!service.getSessions().some(session => session.id === 'session-101'));
	});

	test('bind-failed getActiveSession does not fall back to untitled stub title', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([]);
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async () => { throw new Error('session not found'); },
			releaseLease: async () => { },
			post: async () => ({ accepted: false as const, reason: 'no_such_session' as const }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
		));
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.ok(!service.getActiveSession().title.includes('Untitled session'));
		assert.ok(service.getActiveSession().title.includes('bind failed'));
	});

	test('connected listed session on first refresh skips create when catalog is non-empty', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-existing', title: 'New session' }]);
		const service = store.add(createService(connection));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.getActiveSessionId(), 'ua-existing');
		assert.strictEqual(service.isEngineSessionReady(), true);
		assert.strictEqual(connection.createCalls.length, 0);
	});

	test('D13 storage persists engine cache across engine roster restart', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-persist', title: 'Persisted UA' }]);
		const first = store.add(createService(connection, storage));
		connection.setConnected(true);
		first.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(first.getSessions()[0]?.id, 'ua-persist');
		first.switchSession('ua-persist');

		const second = store.add(createService(store.add(new MockUniverseAgentConnection()), storage));
		assert.ok(storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE)?.includes('ua-persist'));
		assert.strictEqual(second.getActiveSessionId(), 'ua-persist');
	});

	test('getTrajectoryRecords on UA session never merges stub fixture extras', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		service.switchSession('ua-only');
		const records = service.getTrajectoryRecords('ua-only');
		assert.ok(!records.some(record => record.text.includes('Stub')));
		assert.ok(!records.some(record => record.kind === 'system'));
	});

	test('disconnected UA session getTrajectoryRecords stays fixture-free', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		const records = service.getTrajectoryRecords('ua-only');
		assert.ok(!records.some(record => record.kind === 'system' && record.text.includes('Stub')));
	});

	test('connected renameSession forwards AgentService.Rename and updates title', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		let fired = '';
		store.add(service.onDidChangeSession(id => { fired = id; }));
		assert.strictEqual(service.renameSession('ua-only', '  Renamed UA  '), true);
		assert.strictEqual(service.getSessions()[0]?.title, 'Renamed UA');
		assert.strictEqual(fired, 'ua-only');
		assert.deepStrictEqual(connection.renameCalls, [{ sessionId: 'ua-only', title: 'Renamed UA' }]);
		assert.strictEqual(service.renameSession('ua-only', 'Renamed UA'), false);
		assert.strictEqual(service.renameSession('ua-only', '   '), false);
		assert.strictEqual(service.renameSession('missing', 'Nope'), false);
		assert.strictEqual(connection.renameCalls.length, 1);
	});

	test('disconnected after engine renameSession stays local and skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.renameSession('ua-only', 'Cached title'), true);
		assert.strictEqual(service.getSessions()[0]?.title, 'Cached title');
		assert.strictEqual(connection.renameCalls.length, 0);
	});

	test('connected cancelGeneration forwards AgentService.Cancel', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.cancelGeneration('ua-only', '  sub:a  '), true);
		assert.deepStrictEqual(connection.cancelCalls, [{ sessionId: 'ua-only', agentId: 'sub:a' }]);
		assert.strictEqual(service.cancelGeneration('ua-only', 'sub:a'), true);
		assert.deepStrictEqual(connection.cancelCalls[1], { sessionId: 'ua-only', agentId: 'sub:a' });
		assert.strictEqual(service.cancelGeneration('ua-only'), true);
		assert.deepStrictEqual(connection.cancelCalls[2], { sessionId: 'ua-only', agentId: 'root' });
		assert.strictEqual(service.cancelGeneration('missing'), false);
		assert.strictEqual(service.cancelGeneration('missing', 'root'), false);
		assert.strictEqual(connection.cancelCalls.length, 3);
	});

	test('connected createSession defers Create to host lease and catalogs clientSessionId on bind', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const acquireLeaseCalls: string[] = [];
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async (sessionId: string) => {
				acquireLeaseCalls.push(sessionId);
				return `lease:${sessionId}`;
			},
			releaseLease: async () => { },
			post: async () => ({ accepted: true as const, correlation: { id: 'mock' } }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
			storage,
		));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await awaitEngineCatalogRefresh(service);

		const previous = service.getActiveSessionId();
		let fired = '';
		store.add(service.onDidChangeActiveSession(id => { fired = id; }));
		assert.strictEqual(service.createSession(), '');
		assert.strictEqual(service.getActiveSessionId(), previous);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(connection.createCalls.length, 0);
		const newSessionCalls = acquireLeaseCalls.filter(id => id.startsWith('session-'));
		assert.strictEqual(newSessionCalls.length, 1);
		const newSessionId = newSessionCalls[0]!;
		assert.ok(newSessionId.startsWith('session-'));
		assert.notStrictEqual(newSessionId, 'ua-only');
		assert.ok(service.getSessions().some(session => session.id === newSessionId));
		assert.strictEqual(service.getActiveSessionId(), newSessionId);
		assert.strictEqual(fired, newSessionId);
		assert.ok(!service.getSessions().some(session => session.id === 'untitled'));
	});

	test('connected createSession bind failure keeps existing catalog session', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async (sessionId: string) => {
				if (sessionId === 'ua-only') {
					return `lease:${sessionId}`;
				}
				throw new Error('session not found');
			},
			releaseLease: async () => { },
			post: async () => ({ accepted: true as const, correlation: { id: 'mock' } }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
			storage,
		));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await awaitEngineCatalogRefresh(service);

		assert.strictEqual(service.createSession(), '');
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.strictEqual(connection.createCalls.length, 0);
		assert.strictEqual(service.getSessions().length, 1);
		assert.strictEqual(service.getSessions()[0]?.id, 'ua-only');
	});

	test('disconnected after engine createSession skips unary and does not seed stub', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.createSession(), '');
		assert.strictEqual(connection.createCalls.length, 0);
		assert.strictEqual(service.getSessions().length, 1);
		assert.strictEqual(service.getSessions()[0]?.id, 'ua-only');
		assert.ok(!service.getSessions().some(session => session.id === 'untitled'));
	});

	test('connected setSessionGoal forwards PermissionService.SetSessionGoal', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		let fired = '';
		store.add(service.onDidChangeSession(id => { fired = id; }));
		assert.strictEqual(service.setSessionGoal('ua-only', '  Ship the slice  '), true);
		assert.strictEqual(service.getSessionGoal('ua-only'), 'Ship the slice');
		assert.strictEqual(fired, 'ua-only');
		assert.deepStrictEqual(connection.setGoalCalls, [{ sessionId: 'ua-only', goal: 'Ship the slice' }]);
		assert.strictEqual(service.setSessionGoal('ua-only', 'Ship the slice'), false);
		assert.strictEqual(service.setSessionGoal('ua-only', '   '), false);
		assert.strictEqual(service.setSessionGoal('missing', 'Nope'), false);
		assert.strictEqual(connection.setGoalCalls.length, 1);
		assert.strictEqual(service.cancelSessionGoal('ua-only'), true);
		assert.strictEqual(service.getSessionGoal('ua-only'), undefined);
		assert.deepStrictEqual(connection.cancelGoalCalls, [{ sessionId: 'ua-only' }]);
		assert.strictEqual(service.cancelSessionGoal('missing'), false);
		assert.strictEqual(connection.cancelGoalCalls.length, 1);
	});

	test('connected forkSubAgent forwards AgentService.Fork', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.forkSubAgent('ua-only', { name: '  reviewer  ', task: '  Review the diff  ' }), true);
		assert.deepStrictEqual(connection.forkCalls, [{
			sessionId: 'ua-only',
			parentAgentId: 'root',
			name: 'reviewer',
			task: 'Review the diff',
		}]);
		assert.strictEqual(service.forkSubAgent('ua-only', { parentAgentId: '  sub:a  ' }), true);
		assert.strictEqual(connection.forkCalls[1]?.parentAgentId, 'sub:a');
		assert.strictEqual(service.forkSubAgent('missing', { name: 'Nope' }), false);
		assert.strictEqual(connection.forkCalls.length, 2);
	});

	test('connected forkSubAgent uses last streaming agent as parent', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		const originalGetTurns = service.getTurns.bind(service);
		service.getTurns = (sessionId: string) => {
			if (sessionId === 'ua-only') {
				return [{ id: 'a1', kind: 'assistant', text: 'live', streaming: true, agentId: 'sub:live' }];
			}
			return originalGetTurns(sessionId);
		};

		assert.strictEqual(service.forkSubAgent('ua-only'), true);
		assert.strictEqual(connection.forkCalls[0]?.parentAgentId, 'sub:live');
	});

	test('disconnected after engine forkSubAgent skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.forkSubAgent('ua-only', { name: 'reviewer' }), false);
		assert.strictEqual(connection.forkCalls.length, 0);
	});

	test('connected killSubAgent forwards AgentService.Kill', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.killSubAgent('ua-only', { agentId: '  sub:reviewer  ', force: true }), true);
		assert.deepStrictEqual(connection.killCalls, [{
			sessionId: 'ua-only',
			agentId: 'sub:reviewer',
			force: true,
		}]);
		assert.strictEqual(service.killSubAgent('ua-only'), true);
		assert.notStrictEqual(connection.killCalls[1]?.agentId, 'root');
		assert.strictEqual(connection.killCalls[1]?.agentId, '');
		assert.strictEqual(connection.killCalls[1]?.force, undefined);
		assert.strictEqual(service.killSubAgent('ua-only', { agentId: '   ' }), true);
		assert.notStrictEqual(connection.killCalls[2]?.agentId, 'root');
		assert.strictEqual(connection.killCalls[2]?.agentId, '');
		assert.strictEqual(service.killSubAgent('missing', { agentId: 'sub:a' }), false);
		assert.strictEqual(connection.killCalls.length, 3);
	});

	test('connected killSubAgent does not default empty agent to root', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.killSubAgent('ua-only'), true);
		assert.notStrictEqual(connection.killCalls[0]?.agentId, 'root');
		assert.strictEqual(connection.killCalls[0]?.agentId, '');
	});

	test('connected killSubAgent uses last streaming agent when omitted and never defaults to root', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.killSubAgent('ua-only'), true);
		assert.notStrictEqual(connection.killCalls[0]?.agentId, 'root');
		assert.strictEqual(connection.killCalls[0]?.agentId, '');

		const originalGetTurns = service.getTurns.bind(service);
		service.getTurns = (sessionId: string) => {
			if (sessionId === 'ua-only') {
				return [{ id: 'a1', kind: 'assistant', text: 'live', streaming: true, agentId: 'sub:live' }];
			}
			return originalGetTurns(sessionId);
		};

		assert.strictEqual(service.killSubAgent('ua-only'), true);
		assert.strictEqual(connection.killCalls[1]?.agentId, 'sub:live');
	});

	test('connected updateUserTurnText forwards AgentService.EditMessage', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.updateUserTurnText('ua-only', '  turn-1  ', '  later  '), true);
		assert.deepStrictEqual(connection.editMessageCalls, [{
			sessionId: 'ua-only',
			turnId: 'turn-1',
			newContent: 'later',
			agentId: 'root',
		}]);
		assert.strictEqual(service.updateUserTurnText('ua-only', '   ', 'Nope'), false);
		assert.strictEqual(service.updateUserTurnText('ua-only', 'turn-2', '   '), false);
		assert.strictEqual(service.updateUserTurnText('missing', 'turn-2', 'Nope'), false);
		assert.strictEqual(connection.editMessageCalls.length, 1);
		(connection as { editMessage?: unknown }).editMessage = undefined;
		assert.strictEqual(service.updateUserTurnText('ua-only', 'turn-3', 'Nope'), false);
		assert.strictEqual(connection.editMessageCalls.length, 1);
	});

	test('connected updateUserTurnText uses last streaming agent when omitted', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		const originalGetTurns = service.getTurns.bind(service);
		service.getTurns = (sessionId: string) => {
			if (sessionId === 'ua-only') {
				return [{ id: 'a1', kind: 'assistant', text: 'live', streaming: true, agentId: 'sub:live' }];
			}
			return originalGetTurns(sessionId);
		};

		assert.strictEqual(service.updateUserTurnText('ua-only', 'turn-live', 'revised'), true);
		assert.strictEqual(connection.editMessageCalls[0]?.agentId, 'sub:live');
		assert.strictEqual(connection.editMessageCalls[0]?.turnId, 'turn-live');
		assert.strictEqual(connection.editMessageCalls[0]?.newContent, 'revised');
	});

	test('disconnected after engine updateUserTurnText skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.updateUserTurnText('ua-only', 'turn-1', 'later'), false);
		assert.strictEqual(connection.editMessageCalls.length, 0);
	});


	test('connected cancelToolCall forwards AgentService.CancelToolCall', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.cancelToolCall('ua-only', { toolCallId: '  tc-1  ', agentId: '  sub:a  ' }), true);
		assert.deepStrictEqual(connection.cancelToolCallCalls, [{
			sessionId: 'ua-only',
			agentId: 'sub:a',
			toolCallId: 'tc-1',
		}]);
		assert.strictEqual(service.cancelToolCall('ua-only', { toolCallId: 'tc-2' }), true);
		assert.deepStrictEqual(connection.cancelToolCallCalls[1], {
			sessionId: 'ua-only',
			agentId: 'root',
			toolCallId: 'tc-2',
		});
		assert.strictEqual(service.cancelToolCall('ua-only', { toolCallId: '   ' }), false);
		assert.strictEqual(service.cancelToolCall('missing', { toolCallId: 'tc-3' }), false);
		assert.strictEqual(connection.cancelToolCallCalls.length, 2);
	});

	test('connected cancelToolCall uses last streaming agent when omitted', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		const originalGetTurns = service.getTurns.bind(service);
		service.getTurns = (sessionId: string) => {
			if (sessionId === 'ua-only') {
				return [{ id: 'a1', kind: 'assistant', text: 'live', streaming: true, agentId: 'sub:live' }];
			}
			return originalGetTurns(sessionId);
		};

		assert.strictEqual(service.cancelToolCall('ua-only', { toolCallId: 'tc-live' }), true);
		assert.strictEqual(connection.cancelToolCallCalls[0]?.agentId, 'sub:live');
		assert.strictEqual(connection.cancelToolCallCalls[0]?.toolCallId, 'tc-live');
	});

	test('connected resolveConfirmation forwards PermissionService.Respond', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.resolveConfirmation('ua-only', '  req-1  ', 'allowed'), true);
		assert.deepStrictEqual(connection.respondPermissionCalls, [{
			sessionId: 'ua-only',
			requestId: 'req-1',
			granted: true,
		}]);
		assert.strictEqual(service.resolveConfirmation('ua-only', 'req-2', 'skipped'), true);
		assert.deepStrictEqual(connection.respondPermissionCalls[1], {
			sessionId: 'ua-only',
			requestId: 'req-2',
			granted: false,
		});
		assert.strictEqual(service.resolveConfirmation('ua-only', '   ', 'allowed'), false);
		assert.strictEqual(service.resolveConfirmation('missing', 'req-3', 'allowed'), false);
		assert.strictEqual(connection.respondPermissionCalls.length, 2);
		(connection as { respondPermission?: unknown }).respondPermission = undefined;
		assert.strictEqual(service.resolveConfirmation('ua-only', 'req-4', 'allowed'), false);
		assert.strictEqual(connection.respondPermissionCalls.length, 2);
	});

	test('connected respondClientTool forwards AgentService.SendClientToolResponse', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.respondClientTool('ua-only', '  call-1  ', { content: '{"ok":true}', isError: false }), true);
		assert.deepStrictEqual(connection.sendClientToolResponseCalls, [{
			sessionId: 'ua-only',
			callId: 'call-1',
			content: '{"ok":true}',
			isError: undefined,
			metadataJson: undefined,
		}]);
		assert.strictEqual(service.respondClientTool('ua-only', 'call-2', { content: 'boom', isError: true, metadataJson: '{"src":"ide"}' }), true);
		assert.deepStrictEqual(connection.sendClientToolResponseCalls[1], {
			sessionId: 'ua-only',
			callId: 'call-2',
			content: 'boom',
			isError: true,
			metadataJson: '{"src":"ide"}',
		});
		assert.strictEqual(service.respondClientTool('ua-only', '   ', { content: 'Nope' }), false);
		assert.strictEqual(service.respondClientTool('missing', 'call-3', { content: 'Nope' }), false);
		assert.strictEqual(connection.sendClientToolResponseCalls.length, 2);
		(connection as { sendClientToolResponse?: unknown }).sendClientToolResponse = undefined;
		assert.strictEqual(service.respondClientTool('ua-only', 'call-4', { content: 'Nope' }), false);
		assert.strictEqual(connection.sendClientToolResponseCalls.length, 2);
	});

	test('disconnected after engine respondClientTool skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.respondClientTool('ua-only', 'call-1', { content: '{}' }), false);
		assert.strictEqual(connection.sendClientToolResponseCalls.length, 0);
	});

	test('connected respondQuestion forwards AgentService.RespondQuestion', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.respondQuestion('ua-only', '  q-1  ', { itemA: { selectedLabels: ['yes'] } }, 'other'), true);
		assert.deepStrictEqual(connection.respondQuestionCalls, [{
			sessionId: 'ua-only',
			questionId: 'q-1',
			answers: { itemA: { selectedLabels: ['yes'] } },
			customText: 'other',
		}]);
		assert.strictEqual(service.respondQuestion('ua-only', 'q-2'), true);
		assert.deepStrictEqual(connection.respondQuestionCalls[1], {
			sessionId: 'ua-only',
			questionId: 'q-2',
			answers: undefined,
			customText: undefined,
		});
		assert.strictEqual(service.respondQuestion('ua-only', '   ', { itemA: { selectedLabels: ['yes'] } }), false);
		assert.strictEqual(service.respondQuestion('missing', 'q-3'), false);
		assert.strictEqual(connection.respondQuestionCalls.length, 2);
		(connection as { respondQuestion?: unknown }).respondQuestion = undefined;
		assert.strictEqual(service.respondQuestion('ua-only', 'q-4'), false);
		assert.strictEqual(connection.respondQuestionCalls.length, 2);
	});

	test('disconnected after engine respondQuestion skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.respondQuestion('ua-only', 'q-1', { itemA: { selectedLabels: ['yes'] } }), false);
		assert.strictEqual(connection.respondQuestionCalls.length, 0);
	});

	test('disconnected after engine resolveConfirmation skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.resolveConfirmation('ua-only', 'req-1', 'allowed'), false);
		assert.strictEqual(connection.respondPermissionCalls.length, 0);
	});

	test('disconnected after engine cancelToolCall skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.cancelToolCall('ua-only', { toolCallId: 'tc-1' }), false);
		assert.strictEqual(connection.cancelToolCallCalls.length, 0);
	});

	test('connected deleteTurn forwards AgentService.DeleteMessage', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.deleteTurn('ua-only', '  turn-1  '), true);
		assert.deepStrictEqual(connection.deleteMessageCalls, [{
			sessionId: 'ua-only',
			turnId: 'turn-1',
			agentId: 'root',
		}]);
		assert.strictEqual(service.deleteTurn('ua-only', '   '), false);
		assert.strictEqual(service.deleteTurn('missing', 'turn-2'), false);
		assert.strictEqual(connection.deleteMessageCalls.length, 1);
		(connection as { deleteMessage?: unknown }).deleteMessage = undefined;
		assert.strictEqual(service.deleteTurn('ua-only', 'turn-3'), false);
		assert.strictEqual(connection.deleteMessageCalls.length, 1);
	});

	test('connected deleteTurn uses last streaming agent when omitted', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		const originalGetTurns = service.getTurns.bind(service);
		service.getTurns = (sessionId: string) => {
			if (sessionId === 'ua-only') {
				return [{ id: 'a1', kind: 'assistant', text: 'live', streaming: true, agentId: 'sub:live' }];
			}
			return originalGetTurns(sessionId);
		};

		assert.strictEqual(service.deleteTurn('ua-only', 'turn-live'), true);
		assert.strictEqual(connection.deleteMessageCalls[0]?.agentId, 'sub:live');
		assert.strictEqual(connection.deleteMessageCalls[0]?.turnId, 'turn-live');
	});

	test('disconnected after engine deleteTurn skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.deleteTurn('ua-only', 'turn-1'), false);
		assert.strictEqual(connection.deleteMessageCalls.length, 0);
	});

	test('disconnected after engine killSubAgent skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.killSubAgent('ua-only', { agentId: 'sub:reviewer' }), false);
		assert.strictEqual(connection.killCalls.length, 0);
	});

	test('connected createSnapshot forwards AgentService.CreateSnapshot', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.createSnapshot('ua-only', { title: 'Before refactor', description: 'checkpoint' }), true);
		assert.deepStrictEqual(connection.createSnapshotCalls, [{
			sessionId: 'ua-only',
			title: 'Before refactor',
			description: 'checkpoint',
		}]);
		assert.strictEqual(service.createSnapshot('ua-only'), true);
		assert.strictEqual(connection.createSnapshotCalls[1]?.title, 'Snapshot');
		assert.strictEqual(connection.createSnapshotCalls[1]?.description, undefined);
		assert.strictEqual(service.createSnapshot('ua-only', { title: '' }), true);
		assert.strictEqual(connection.createSnapshotCalls[2]?.title, '');
		assert.strictEqual(service.createSnapshot('   ', { title: 'Nope' }), false);
		assert.strictEqual(service.createSnapshot('', { title: 'Nope' }), false);
		assert.strictEqual(service.createSnapshot('missing', { title: 'Nope' }), false);
		assert.strictEqual(connection.createSnapshotCalls.length, 3);
		(connection as { createSnapshot?: unknown }).createSnapshot = undefined;
		assert.strictEqual(service.createSnapshot('ua-only', { title: 'Nope' }), false);
		assert.strictEqual(connection.createSnapshotCalls.length, 3);
	});

	test('disconnected after engine createSnapshot skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.createSnapshot('ua-only', { title: 'Before refactor' }), false);
		assert.strictEqual(connection.createSnapshotCalls.length, 0);
	});

	test('disconnected after engine setSessionGoal skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.setSessionGoal('ua-only', 'Cached goal'), false);
		assert.strictEqual(service.cancelSessionGoal('ua-only'), false);
		assert.strictEqual(service.getSessionGoal('ua-only'), undefined);
		assert.strictEqual(connection.setGoalCalls.length, 0);
		assert.strictEqual(connection.cancelGoalCalls.length, 0);
	});

	test('disconnected after engine cancelGeneration skips unary', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.cancelGeneration('ua-only'), false);
		assert.strictEqual(service.cancelGeneration('ua-only', 'root'), false);
		assert.strictEqual(connection.cancelCalls.length, 0);
	});

	test('connected MessageQueue mutations forward AgentService queue unaries', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		service.setMessageQueueFixture('ua-only', {
			items: [{
				id: 'q1',
				content: 'fixture',
				status: 'PENDING',
				hold: undefined,
				uploadProgress: undefined,
				retryCount: 0,
				lastError: undefined,
				locked: false,
				pinned: false,
			}],
			isPaused: false,
			isProcessing: false,
		});
		assert.deepStrictEqual(service.getMessageQueueState('ua-only'), {
			items: [],
			isPaused: false,
			isProcessing: false,
		});

		assert.strictEqual(service.enqueueMessageQueueItem('ua-only', '  later  ', { priority: 'HIGH', opId: '  op-1  ' }), true);
		service.pauseMessageQueue('ua-only');
		service.resumeMessageQueue('ua-only');
		service.clearMessageQueue('ua-only');
		service.holdMessageQueueItem('ua-only', '  q1  ', 'EDITING');
		service.releaseMessageQueueItemHold('ua-only', '  q1  ');
		assert.strictEqual(service.updateMessageQueueItemContent('ua-only', '  q1  ', '  later  '), true);
		assert.deepStrictEqual(connection.enqueueCalls, [{ sessionId: 'ua-only', text: 'later', priority: 'HIGH', opId: 'op-1' }]);
		assert.deepStrictEqual(connection.pauseQueueCalls, [{ sessionId: 'ua-only' }]);
		assert.deepStrictEqual(connection.resumeQueueCalls, [{ sessionId: 'ua-only' }]);
		assert.deepStrictEqual(connection.clearQueueCalls, [{ sessionId: 'ua-only' }]);
		assert.deepStrictEqual(connection.holdQueueCalls, [{ sessionId: 'ua-only', itemId: 'q1', reason: 'EDITING' }]);
		assert.deepStrictEqual(connection.releaseQueueCalls, [{ sessionId: 'ua-only', itemId: 'q1' }]);
		assert.deepStrictEqual(connection.editQueueCalls, [{ sessionId: 'ua-only', itemId: 'q1', text: 'later' }]);

		assert.strictEqual(service.enqueueMessageQueueItem('ua-only', '   '), false);
		assert.strictEqual(service.enqueueMessageQueueItem('missing', 'Nope'), false);
		service.pauseMessageQueue('missing');
		service.holdMessageQueueItem('ua-only', '   ', 'EDITING');
		service.releaseMessageQueueItemHold('missing', 'q1');
		assert.strictEqual(service.updateMessageQueueItemContent('ua-only', 'q1', '   '), false);
		assert.strictEqual(service.updateMessageQueueItemContent('missing', 'q1', 'Nope'), false);
		assert.strictEqual(connection.enqueueCalls.length, 1);
		assert.strictEqual(connection.pauseQueueCalls.length, 1);
		assert.strictEqual(connection.holdQueueCalls.length, 1);
		assert.strictEqual(connection.releaseQueueCalls.length, 1);
		assert.strictEqual(connection.editQueueCalls.length, 1);
	});

	test('disconnected after engine MessageQueue skips unary and stays empty', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		assert.strictEqual(service.enqueueMessageQueueItem('ua-only', 'later'), false);
		service.pauseMessageQueue('ua-only');
		service.resumeMessageQueue('ua-only');
		service.clearMessageQueue('ua-only');
		service.holdMessageQueueItem('ua-only', 'q1', 'EDITING');
		service.releaseMessageQueueItemHold('ua-only', 'q1');
		assert.strictEqual(service.updateMessageQueueItemContent('ua-only', 'q1', 'later'), false);
		assert.deepStrictEqual(service.getMessageQueueState('ua-only').items, []);
		assert.strictEqual(connection.enqueueCalls.length, 0);
		assert.strictEqual(connection.pauseQueueCalls.length, 0);
		assert.strictEqual(connection.resumeQueueCalls.length, 0);
		assert.strictEqual(connection.clearQueueCalls.length, 0);
		assert.strictEqual(connection.holdQueueCalls.length, 0);
		assert.strictEqual(connection.releaseQueueCalls.length, 0);
		assert.strictEqual(connection.editQueueCalls.length, 0);
	});

	test('connected AutoDrive ignores fixture and stays empty', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		service.setAutoDriveTaskFixture('ua-only', ['Fix lint', 'Ship']);
		assert.deepStrictEqual(service.getAutoDriveTasks('ua-only'), []);
		assert.strictEqual(service.getAutoDriveTaskCount('ua-only'), 0);
	});

	test('disconnected after engine AutoDrive stays empty and ignores fixture', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		connection.setConnected(false);
		service.setEngineConnected(false);

		service.setAutoDriveTaskFixture('ua-only', ['Fix lint']);
		assert.deepStrictEqual(service.getAutoDriveTasks('ua-only'), []);
		assert.strictEqual(service.getAutoDriveTaskCount('ua-only'), 0);
	});

	test('bind-failed roster keeps composer post rejected as no_such_session', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([]);
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async () => { throw new Error('session not found'); },
			releaseLease: async () => { },
			post: async () => ({ accepted: false as const, reason: 'no_such_session' as const }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
		));
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		const outcome = await postBound(
			{ stubService: service, sessionViewLease: undefined } as Parameters<typeof postBound>[0],
			{ kind: 'submitInput', text: 'hello' },
		);
		assert.strictEqual(outcome.accepted, false);
		if (!outcome.accepted) {
			assert.strictEqual(outcome.reason, 'no_such_session');
		}
	});

	test('bind-failed never sends placeholder id to engine createSession, acquireLease, or tree refresh', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([]);
		const acquireLeaseCalls: string[] = [];
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async (sessionId: string) => {
				acquireLeaseCalls.push(sessionId);
				throw new Error('session not found');
			},
			releaseLease: async () => { },
			post: async () => ({ accepted: true as const, correlation: { id: 'mock' } }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
		));
		service.setEngineConnected(true);
		await awaitEngineCatalogRefresh(service);

		assert.strictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
		assert.ok(isEngineRosterPlaceholderSessionId(ENGINE_BIND_FAILED_SESSION_ID));
		assert.strictEqual(connection.createCalls.length, 0);
		for (const call of acquireLeaseCalls) {
			assert.notStrictEqual(call, ENGINE_BIND_FAILED_SESSION_ID);
		}
		assert.ok(!connection.treeRefreshCalls.includes(ENGINE_BIND_FAILED_SESSION_ID));
		assert.throws(
			() => service.acquireSessionView(ENGINE_BIND_FAILED_SESSION_ID),
			/not engine-bound/,
		);
		assert.strictEqual(acquireLeaseCalls.length, 1);
		assert.ok(acquireLeaseCalls[0]?.startsWith('session-'));
	});

	test('empty list with pending bind stays incomplete until lease resolves', async () => {
		let resolveLease: ((value: string) => void) | undefined;
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([]);
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async (sessionId: string) => new Promise<string>(resolve => {
				resolveLease = () => resolve(`lease:${sessionId}`);
			}),
			releaseLease: async () => { },
			post: async () => ({ accepted: true as const, correlation: { id: 'mock' } }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
		));
		service.setEngineConnected(true);
		await awaitEngineCatalogRefresh(service);

		assert.strictEqual(service.getSessions().length, 0);
		assert.strictEqual(service.isEngineSessionReady(), false);
		assert.notStrictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
		resolveLease?.();
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.strictEqual(service.isEngineSessionReady(), true);
		assert.ok(service.getSessions().length > 0);
	});

	test('restored engine cache with empty List defers Create to host lease with fresh clientSessionId', async () => {
		const cachedUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
		const storage = store.add(new TestStorageService());
		storage.store(
			CONVERSATION_ROSTER_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				wasEverConnected: true,
				activeSessionId: cachedUuid,
				nextTurnId: 100,
				localSessions: [],
				engineCache: {
					activeSessionId: cachedUuid,
					sessions: [{
						id: cachedUuid,
						title: 'Cached UA',
						turns: [],
						source: 'engine-cache',
					}],
				},
			}),
			StorageScope.WORKSPACE,
			StorageTarget.USER,
		);
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([]);
		const acquireLeaseCalls: string[] = [];
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async (sessionId: string) => {
				acquireLeaseCalls.push(sessionId);
				return `lease:${sessionId}`;
			},
			releaseLease: async () => { },
			post: async () => ({ accepted: true as const, correlation: { id: 'mock' } }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
			storage,
		));

		assert.strictEqual(service.getActiveSessionId(), cachedUuid);
		assert.strictEqual(service.getSessions()[0]?.id, cachedUuid);
		assert.strictEqual(service.isEngineSessionReady(), true);

		connection.setConnected(true);
		service.setEngineConnected(true);
		await awaitEngineCatalogRefresh(service);

		assert.strictEqual(connection.createCalls.length, 0);
		assert.strictEqual(acquireLeaseCalls.length, 1);
		const clientSessionId = acquireLeaseCalls[0];
		assert.ok(clientSessionId?.startsWith('session-'));
		assert.notStrictEqual(clientSessionId, cachedUuid);
		assert.notStrictEqual(clientSessionId, ENGINE_BIND_FAILED_SESSION_ID);
		assert.strictEqual(service.getActiveSessionId(), clientSessionId);
		assert.ok(service.getSessions().some(session => session.id === clientSessionId));
		assert.ok(!service.getSessions().some(session => session.id === cachedUuid));
	});

	test('bind-failed persist omits placeholder activeSessionId from roster storage', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([]);
		const sessionView: IUniverseAgentSessionView = {
			_serviceBrand: undefined,
			onDynamicDidApplyFrame: () => Event.None,
			acquireLease: async () => { throw new Error('session not found'); },
			releaseLease: async () => { },
			post: async () => ({ accepted: false as const, reason: 'no_such_session' as const }),
			requestResync: async () => { },
			acknowledge: async () => { },
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		};
		const workspaceToolsGate = { _serviceBrand: undefined, shouldAdvertise: () => true };
		const service = store.add(new ConversationEngineRosterService(
			connection as unknown as IUniverseAgentConnection,
			sessionView,
			workspaceToolsGate,
			storage,
		));
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
		const raw = storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE) ?? '';
		assert.ok(!raw.includes(ENGINE_BIND_FAILED_SESSION_ID));
	});
});

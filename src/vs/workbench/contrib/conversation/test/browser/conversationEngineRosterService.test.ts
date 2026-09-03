/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { StorageScope } from '../../../../../platform/storage/common/storage.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IUniverseAgentSessionView } from '../../../../../platform/universeAgent/common/universeAgentSessionView.js';
import type {
	UniverseAgentConnectionSnapshot,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { ConversationEngineRosterService } from '../../browser/conversationEngineRosterService.js';
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
	requestAgentTreeRefresh() { }
	getNavigatorCapability() { return 'UNKNOWN' as const; }
	isAgentTreeFetchFailed() { return false; }
	async connect() { return { methods: [], events: [], sessionToken: 'tok' }; }
	async connectProfile() { return { ok: false as const, code: 'transport_failed' as const, reason: 'stub' }; }
	async confirmPairing() { return { ok: false as const, code: 'transport_failed' as const, reason: 'stub' }; }
	async cancelPairing() { }
	async probeConnectionProfile() { return { ok: false as const, code: 'transport_failed' as const, reason: 'stub' }; }
	async disconnect() { this.setConnected(false); }
	async listSessions() { return { sessions: this.sessions.map(s => ({ sessionId: s.sessionId, title: s.title })) }; }
	readonly renameCalls: { sessionId: string; title: string }[] = [];
	readonly createCalls: { title?: string }[] = [];
	createSessionResult: { sessionId: string } = { sessionId: 'ua-new' };
	async createSession(request: { title?: string }) {
		this.createCalls.push({ title: request.title });
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
	async killAgent(request: { sessionId: string; agentId: string; force?: boolean }) {
		this.killCalls.push({
			sessionId: request.sessionId,
			agentId: request.agentId,
			force: request.force,
		});
		return { ok: true };
	}
	readonly cancelToolCallCalls: { sessionId: string; toolCallId: string; agentId?: string }[] = [];
	async cancelToolCall(request: { sessionId: string; toolCallId: string; agentId?: string }) {
		this.cancelToolCallCalls.push({
			sessionId: request.sessionId,
			toolCallId: request.toolCallId,
			agentId: request.agentId,
		});
		return { ok: true };
	}
	async enqueueQueueItem() { return { ok: false, error: 'stub' }; }
	async pauseQueue() { return { ok: false, error: 'stub' }; }
	async resumeQueue() { return { ok: false, error: 'stub' }; }
	async clearQueue() { return { ok: false, error: 'stub' }; }
	async holdQueueItem() { return { ok: false, error: 'stub' }; }
	async releaseQueueItemHold() { return { ok: false, error: 'stub' }; }
	async editQueueItem() { return { ok: false, error: 'stub' }; }
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
		assert.strictEqual(service.getSessions().length, 0);
		assert.ok(!service.getSessions().some(s => s.id === 'untitled' || s.id === 'visualize'));
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

	test('list incomplete hides stub seed rows while connected', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		const service = store.add(createService(connection));
		connection.setConnected(true);
		service.setEngineConnected(true);
		// listSessions not seeded → refresh fails → listCompleted false
		assert.strictEqual(service.getSessions().length, 0);
		assert.ok(!service.getSessions().some(s => s.id === 'untitled'));
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

	test('connected createSession forwards SessionService.Create and catalogs the engine id', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		const previous = service.getActiveSessionId();
		let fired = '';
		store.add(service.onDidChangeActiveSession(id => { fired = id; }));
		assert.strictEqual(service.createSession(), '');
		assert.strictEqual(service.getActiveSessionId(), previous);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.deepStrictEqual(connection.createCalls, [{ title: 'New session' }]);
		assert.ok(service.getSessions().some(session => session.id === 'ua-new'));
		assert.strictEqual(service.getActiveSessionId(), 'ua-new');
		assert.strictEqual(fired, 'ua-new');
		assert.ok(!service.getSessions().some(session => session.id === 'untitled'));
	});

	test('connected createSession ignores an empty engine id', async () => {
		const storage = store.add(new TestStorageService());
		const connection = store.add(new MockUniverseAgentConnection());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only UA' }]);
		connection.createSessionResult = { sessionId: '   ' };
		const service = store.add(createService(connection, storage));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(service.createSession(), '');
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.strictEqual(connection.createCalls.length, 1);
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
		assert.strictEqual(connection.killCalls[1]?.agentId, '');
		assert.strictEqual(connection.killCalls[1]?.force, undefined);
		assert.strictEqual(service.killSubAgent('missing', { agentId: 'sub:a' }), false);
		assert.strictEqual(connection.killCalls.length, 2);
	});

	test('connected killSubAgent does not default empty agent to root', async () => {
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

		assert.strictEqual(service.killSubAgent('ua-only'), true);
		assert.strictEqual(connection.killCalls[0]?.agentId, '');
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
			toolCallId: 'tc-1',
			agentId: 'sub:a',
		}]);
		assert.strictEqual(service.cancelToolCall('ua-only', { toolCallId: 'tc-2' }), true);
		assert.strictEqual(connection.cancelToolCallCalls[1]?.toolCallId, 'tc-2');
		assert.strictEqual(connection.cancelToolCallCalls[1]?.agentId, undefined);
		assert.strictEqual(service.cancelToolCall('ua-only', { toolCallId: '   ' }), false);
		assert.strictEqual(service.cancelToolCall('missing', { toolCallId: 'tc-3' }), false);
		assert.strictEqual(connection.cancelToolCallCalls.length, 2);
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
});

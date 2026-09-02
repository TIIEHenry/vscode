/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IUniverseAgentConnection } from '../../common/universeAgentConnection.js';
import type { IUniverseAgentHostConnection } from '../../common/universeAgentHostConnection.js';
import type {
	IFileMutationRecord,
	ITurnSettleSignal,
	UniverseAgentAgentTreeNode,
	UniverseAgentConnectionSnapshot,
} from '../../common/universeAgentTypes.js';
import { AgentTreeCoordinator, flushAgentTreeCoordinator } from '../../node/agentTreeCoordinator.js';
import { GrpcStatusCode, UniverseAgentTransportError } from '../../node/grpc/grpcTransport.js';
import { createEmptyCapabilitySnapshot } from '../../node/grpcCapabilityProbe.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';

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

class TestConnection implements IUniverseAgentConnection {
	declare readonly _serviceBrand: undefined;
	private connected = true;
	private readonly streamListeners = new Map<string, ((event: { payload: unknown }) => void)[]>();

	readonly onDidFileMutation = Event.None;
	readonly onDidTurnSettle = Event.None;
	readonly onDidChangeTeamRuntime = Event.None;
	readonly team = {
		memberStatus: async () => [],
		taskList: async () => [],
		teamInfo: async () => undefined,
	};

	isEngineConnected(): boolean { return this.connected; }
	getTransportState() { return 'ok' as const; }
	getConnectionPhase() { return { kind: 'connected' as const, path: 'loopback' as const }; }
	getConnectionSnapshot(): UniverseAgentConnectionSnapshot {
		return {
			transport: 'ok',
			sessionToken: 'tok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyCapabilitySnapshot(),
		};
	}
	getCapabilitySnapshot() { return createEmptyCapabilitySnapshot(); }
	readonly onDidChangeConnection = Event.None;
	requestAgentTreeRefresh(): void { }
	getNavigatorCapability() { return 'UNKNOWN' as const; }
	async connect() { return { methods: [], events: [] }; }
	async connectProfile() { return { ok: false as const, code: 'transport_failed' as const, reason: 'test' }; }
	async disconnect() { this.connected = false; }
	async listSessions() { return { sessions: [] }; }
	async createSession() { return { sessionId: 's' }; }
	async deleteSession() { }
	async getHistory() { return { envelopes: [] }; }
	subscribeSessionEventStream(sessionId: string, listener: (event: { payload: unknown }) => void) {
		const list = this.streamListeners.get(sessionId) ?? [];
		list.push(listener);
		this.streamListeners.set(sessionId, list);
		return { dispose: () => { } };
	}
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

	pushStreamEvent(sessionId: string, payload: unknown): void {
		for (const listener of this.streamListeners.get(sessionId) ?? []) {
			listener({ payload });
		}
	}
}

class TestHost implements IUniverseAgentHostConnection {
	private readonly _onRequestAgentTreeRefresh = new Emitter<{ readonly sessionId: string }>();
	readonly onRequestAgentTreeRefresh = this._onRequestAgentTreeRefresh.event;

	treeFetchCount = 0;
	agentTreeUnsupported = false;
	fileMutations: IFileMutationRecord[] = [];
	turnSettleSignals: ITurnSettleSignal[] = [];
	teamRuntimeEvents: string[] = [];

	constructor(private readonly treeProvider: () => Promise<UniverseAgentAgentTreeNode | undefined>) {
	}

	async fetchToolDetail() {
		return { ok: false as const, reason: 'unavailable' as const };
	}

	async fetchAgentTree(_sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined> {
		this.treeFetchCount += 1;
		if (this.agentTreeUnsupported) {
			throw new UniverseAgentTransportError(GrpcStatusCode.UNIMPLEMENTED, 'Tree UNIMPLEMENTED');
		}
		return this.treeProvider();
	}

	isAgentTreeUnsupported(): boolean {
		return this.agentTreeUnsupported;
	}

	notifyFileMutation(record: IFileMutationRecord): void {
		this.fileMutations.push(record);
	}

	notifyTurnSettle(signal: ITurnSettleSignal): void {
		this.turnSettleSignals.push(signal);
	}

	notifyTeamRuntimeChange(sessionId: string): void {
		this.teamRuntimeEvents.push(sessionId);
	}

	requestRefresh(sessionId: string): void {
		this._onRequestAgentTreeRefresh.fire({ sessionId });
	}
}

function getTreeCoordinator(viewHost: SessionViewHost, sessionId: string): AgentTreeCoordinator {
	const sidecars = (viewHost as unknown as { sessionSidecars: Map<string, { tree: AgentTreeCoordinator }> }).sessionSidecars;
	return sidecars.get(sessionId)!.tree;
}

suite('SessionViewHost navigator §11', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('first lease → Tree fetch ≥ 1 without L3', async () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => ROOT_TREE);
		const viewHost = store.add(new SessionViewHost(connection, host));

		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-a');
		await flushAgentTreeCoordinator(getTreeCoordinator(viewHost, 'sess-a'));

		assert.ok(host.treeFetchCount >= 1);
	});

	test('UNIMPLEMENTED → Tree fetch count stops increasing', async () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => ROOT_TREE);
		host.agentTreeUnsupported = true;
		const viewHost = store.add(new SessionViewHost(connection, host));

		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-b');
		const tree = getTreeCoordinator(viewHost, 'sess-b');
		await tree.pullNow(() => { });
		const countAfterFirst = host.treeFetchCount;
		await tree.pullNow(() => { });
		assert.strictEqual(host.treeFetchCount, countAfterFirst);
	});

	test('sub_agent_completed schedules additional tree fetch', async () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => ROOT_TREE);
		const viewHost = store.add(new SessionViewHost(connection, host));

		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-c');
		await flushAgentTreeCoordinator(getTreeCoordinator(viewHost, 'sess-c'));
		const before = host.treeFetchCount;
		connection.pushStreamEvent('sess-c', { sub_agent_completed: {} });
		await flushAgentTreeCoordinator(getTreeCoordinator(viewHost, 'sess-c'));
		assert.ok(host.treeFetchCount > before);
	});

	test('lifecycle + snapshot stream → file mutation via host', () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => ROOT_TREE);
		const viewHost = store.add(new SessionViewHost(connection, host));

		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-d');
		connection.pushStreamEvent('sess-d', {
			tool_call_lifecycle: { tool_call_id: 'tc-x', turn_id: 'turn-x', agent_id: 'agent-x' },
		});
		connection.pushStreamEvent('sess-d', {
			tool_runtime_snapshot: {
				tool_call_id: 'tc-x',
				payload: { file_mutation_payload: { path: 'f.ts', operation: 'edit' } },
			},
		});

		assert.strictEqual(host.fileMutations.length, 1);
		assert.strictEqual(host.fileMutations[0]!.toolCallId, 'tc-x');
	});

	test('multi_agent_status → team runtime notification', () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => ROOT_TREE);
		const viewHost = store.add(new SessionViewHost(connection, host));

		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-e');
		connection.pushStreamEvent('sess-e', { multi_agent_status: { team_aborted: { team_id: 1 } } });

		assert.deepStrictEqual(host.teamRuntimeEvents, ['sess-e']);
	});

	test('turn_completed stream → turn settle via host', () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => ROOT_TREE);
		const viewHost = store.add(new SessionViewHost(connection, host));

		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-f');
		connection.pushStreamEvent('sess-f', {
			tool_call_lifecycle: { tool_call_id: 'tc-y', turn_id: 'runtime-y', agent_id: 'agent-y' },
		});
		connection.pushStreamEvent('sess-f', {
			turn_completed: { turn_id: 'runtime-y', assistant_turn_id: 'assistant-y' },
		});

		assert.strictEqual(host.turnSettleSignals.length, 1);
		assert.deepStrictEqual(host.turnSettleSignals[0], {
			sessionId: 'sess-f',
			runtimeTurnId: 'runtime-y',
			assistantTurnId: 'assistant-y',
		});
	});

	test('lifecycle without turn_completed → no turn settle', () => {
		const connection = new TestConnection();
		const host = new TestHost(async () => ROOT_TREE);
		const viewHost = store.add(new SessionViewHost(connection, host));

		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-g');
		connection.pushStreamEvent('sess-g', {
			tool_call_lifecycle: { tool_call_id: 'tc-z', turn_id: 'runtime-z', agent_id: 'agent-z' },
		});

		assert.strictEqual(host.turnSettleSignals.length, 0);
	});
});

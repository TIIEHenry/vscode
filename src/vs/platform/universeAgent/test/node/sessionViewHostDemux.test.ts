/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IUniverseAgentConnection } from '../../common/universeAgentConnection.js';
import type { IUniverseAgentHostConnection } from '../../common/universeAgentHostConnection.js';
import type {
	IFileMutationRecord,
	ITurnSettleSignal,
	UniverseAgentAgentTreeNode,
	UniverseAgentConnectionSnapshot,
} from '../../common/universeAgentTypes.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import type { ViewPatch } from '../../common/sessionView/types.js';
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
	readonly chatWrites: unknown[] = [];
	residentOpen = false;

	async chat(request?: { payload?: unknown }) {
		if (request?.payload !== undefined) {
			this.chatWrites.push(request.payload);
		}
	}

	openChatStream() {
		this.residentOpen = true;
		return {
			write: (payload: unknown) => {
				this.chatWrites.push(payload);
			},
			dispose: () => {
				this.residentOpen = false;
			},
		};
	}
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
	async probeEngine() { return { ok: false as const, reason: 'test' }; }

	push(sessionId: string, payload: unknown): void {
		for (const listener of this.streamListeners.get(sessionId) ?? []) {
			listener({ payload });
		}
	}
}

class TestHost implements IUniverseAgentHostConnection {
	readonly onRequestAgentTreeRefresh = Event.None;

	async fetchToolDetail() {
		return { ok: false as const, reason: 'unavailable' as const };
	}
	async fetchAgentTree(_sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined> {
		return ROOT_TREE;
	}
	isAgentTreeUnsupported(): boolean { return false; }
	notifyFileMutation(_record: IFileMutationRecord): void { }
	notifyTurnSettle(_signal: ITurnSettleSignal): void { }
	notifyTeamRuntimeChange(_sessionId: string): void { }
}

function patchesOf(frames: readonly IUniverseAgentSessionViewFrameEvent[]): ViewPatch[] {
	const patches: ViewPatch[] = [];
	for (const event of frames) {
		const body = event.frame.frame.body;
		if (body.kind === 'patches') {
			patches.push(...body.patches);
		}
	}
	return patches;
}

suite('SessionViewHost demux fold seats', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createHost(connection: TestConnection): { viewHost: SessionViewHost; frames: IUniverseAgentSessionViewFrameEvent[] } {
		const viewHost = store.add(new SessionViewHost(connection, new TestHost()));
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDidApplyFrame(event => frames.push(event)));
		return { viewHost, frames };
	}

	test('permission_request upserts a pending permission seat', () => {
		const connection = new TestConnection();
		const { viewHost, frames } = createHost(connection);
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-perm');
		connection.push('sess-perm', {
			permission_request: { request_id: 'perm-live', description: 'Run bash', tool_name: 'bash' },
		});
		const pending = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertPendingAction' }> => patch.op === 'upsertPendingAction');
		assert.ok(pending.some(patch => patch.action.requestId === 'perm-live' && patch.action.summary.kind === 'permission'));
	});

	test('ask_user_question posts questionAsked and upserts a question seat', () => {
		const connection = new TestConnection();
		const { viewHost, frames } = createHost(connection);
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-q');
		connection.push('sess-q', {
			ask_user_question: {
				request_id: 'q-live',
				items: [{ id: 'i1', question: 'Continue?' }],
			},
		});
		const pending = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertPendingAction' }> => patch.op === 'upsertPendingAction');
		assert.ok(pending.some(patch => patch.action.requestId === 'q-live' && patch.action.summary.kind === 'question'));
	});

	test('client_tool_call upserts a pending client-tool seat', () => {
		const connection = new TestConnection();
		const { viewHost, frames } = createHost(connection);
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-ctc');
		connection.push('sess-ctc', {
			client_tool_call: { request_id: 'ctc-live', tool_name: 'browser', arguments_json: '{}' },
		});
		const pending = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertPendingAction' }> => patch.op === 'upsertPendingAction');
		assert.ok(pending.some(patch => patch.action.requestId === 'ctc-live' && patch.action.summary.kind === 'tool'));
	});

	test('runtime overlay snapshot upserts an overlay block', () => {
		const connection = new TestConnection();
		const { viewHost, frames } = createHost(connection);
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-ov');
		connection.push('sess-ov', {
			hello: { session_version: 1, head_seq: 0, runtime_epoch: 3, last_mutated_from_seq: 0 },
		});
		connection.push('sess-ov', {
			runtime_overlay_snapshot: {
				runtime_epoch: 3,
				active_turn: { turn_id: 'turn-live', streaming_text: 'streaming…', thinking_text: '' },
				pending: [],
			},
		});
		const overlays = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertOverlayBlock' }> => patch.op === 'upsertOverlayBlock');
		assert.ok(overlays.some(patch => String(patch.block.blockId) === 'turn-live'));
	});

	test('tool envelope upserts a timeline tool row', () => {
		const connection = new TestConnection();
		const { viewHost, frames } = createHost(connection);
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-tool');
		connection.push('sess-tool', {
			envelope_appended: {
				envelope: {
					id: 'env-tool',
					seq: 11,
					blocks: [{ block_type: 3, tool_result_block: { tool_name: 'grep', content: 'hit', is_error: false } }],
				},
			},
		});
		const items = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertTimelineItem' }> => patch.op === 'upsertTimelineItem');
		assert.ok(items.some(patch => patch.item.summary.kind === 'tool' && patch.item.summary.kind === 'tool' && (patch.item.summary as { toolName?: string }).toolName === 'grep'));
	});

	test('streaming_delta without snapshot still upserts overlay', () => {
		const connection = new TestConnection();
		const { viewHost, frames } = createHost(connection);
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-delta');
		connection.push('sess-delta', {
			streaming_delta: { turn_id: 'turn-delta', text_delta: 'partial' },
		});
		const overlays = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertOverlayBlock' }> => patch.op === 'upsertOverlayBlock');
		assert.ok(overlays.some(patch => String(patch.block.blockId) === 'turn-delta'));
	});

	test('ensureChatStream opens a resident bidi and submit writes on it', () => {
		const connection = new TestConnection();
		const { viewHost, frames } = createHost(connection);
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-chat');
		assert.strictEqual(connection.residentOpen, true);
		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: 'hello resident' });
		assert.strictEqual(outcome.accepted, true);
		assert.ok(connection.chatWrites.length >= 1);
		const sends = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertLocalSend' }> => patch.op === 'upsertLocalSend');
		assert.ok(sends.some(patch => String(patch.send.operationId).startsWith('write:')));
	});

	test('acknowledge posts frameAck without throwing', () => {
		const connection = new TestConnection();
		const { viewHost } = createHost(connection);
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-ack');
		viewHost.acknowledge(leaseId, { generation: 1, frameId: 1, appliedVersion: 1 });
	});
});

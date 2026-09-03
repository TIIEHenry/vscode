/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import type { IUniverseAgentConnection } from '../../common/universeAgentConnection.js';
import type { IUniverseAgentHostConnection } from '../../common/universeAgentHostConnection.js';
import type {
	IFileMutationRecord,
	ITurnSettleSignal,
	UniverseAgentAgentTreeNode,
	UniverseAgentConnectionSnapshot,
} from '../../common/universeAgentTypes.js';
import { GrpcStatusCode, UniverseAgentTransportError } from '../../node/grpc/grpcTransport.js';
import { createEmptyCapabilitySnapshot } from '../../node/grpcCapabilityProbe.js';

export class TestConnection implements IUniverseAgentConnection {
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
	async confirmPairing() { return { ok: false as const, code: 'transport_failed' as const, reason: 'test' }; }
	async cancelPairing() { }
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
	async listModels() { return { models: [] }; }

	pushStreamEvent(sessionId: string, payload: unknown): void {
		for (const listener of this.streamListeners.get(sessionId) ?? []) {
			listener({ payload });
		}
	}
}

export class TestHost implements IUniverseAgentHostConnection {
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

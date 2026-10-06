/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IUniverseAgentSessionView, type IUniverseAgentSessionViewFrameEvent } from '../../../../platform/universeAgent/common/universeAgentSessionView.js';
import type { ConversationWriteMessage } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SessionViewSnapshot, ViewLeaseId } from '../../../../platform/universeAgent/common/sessionView/types.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ConversationEngineRosterService } from './conversationEngineRosterService.js';
import { stubTurnsToSnapshot } from './conversationSessionView.js';

const LEFTOVER_CACHE_TURN_TEXT = 'leftover-cached-turn';

class MockUniverseAgentConnection extends Disposable {
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
	private pairingPending = false;
	private sessions: { sessionId: string; title?: string }[] = [];
	private readonly _onDidChangeConnection = this._register(new Emitter<UniverseAgentConnectionSnapshot>());
	readonly onDidChangeConnection = this._onDidChangeConnection.event;

	setConnected(value: boolean): void {
		this.connected = value;
		this._onDidChangeConnection.fire(this.getConnectionSnapshot());
	}

	setListSessions(sessions: { sessionId: string; title?: string }[]): void {
		this.sessions = sessions;
	}

	getConnectionPhase() {
		return this.connected
			? { kind: 'connected' as const, path: 'loopback' as const }
			: { kind: 'disconnected' as const };
	}

	getConnectionSnapshot(): UniverseAgentConnectionSnapshot {
		return {
			transport: 'ok',
			authenticated: this.connected,
			pairingPending: this.pairingPending,
			channelAlive: this.connected,
			sharedFsRootSent: false,
			capabilities: {} as UniverseAgentConnectionSnapshot['capabilities'],
		};
	}

	getCapabilitySnapshot() { return this.getConnectionSnapshot().capabilities; }
	getTransportState() { return 'ok' as const; }
	requestAgentTreeRefresh() { }
	getNavigatorCapability() { return 'UNKNOWN' as const; }
	isAgentTreeFetchFailed() { return false; }
	async connect() { return { methods: [], events: [], sessionToken: 'tok' }; }
	async connectProfile() { return { ok: false as const, code: 'transport_failed' as const, reason: 'stub' }; }
	async confirmPairing() { return { ok: false as const, code: 'transport_failed' as const, reason: 'stub' }; }
	async cancelPairing() { }
	async probeConnectionProfile() { return { ok: false as const, code: 'transport_failed' as const, reason: 'stub' }; }
	async disconnect() { this.setConnected(false); }
	async listSessions() {
		return { sessions: this.sessions.map(s => ({ sessionId: s.sessionId, title: s.title })) };
	}
	async createSession() { return { sessionId: 'ua-new' }; }
	async deleteSession() { }
	async renameSession() { return { ok: true }; }
	async cancelGeneration() { return { ok: true }; }
	async enqueueQueueItem() { return { ok: true }; }
	async pauseQueue() { return { ok: true }; }
	async resumeQueue() { return { ok: true }; }
	async clearQueue() { return { ok: true }; }
	async holdQueueItem() { return { ok: true }; }
	async releaseQueueItemHold() { return { ok: true }; }
	async editQueueItem() { return { ok: true }; }
	async getHistory() { return { envelopes: [] }; }
	subscribeSessionEventStream() { return { dispose: () => { } }; }
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

class LeftoverProjectionSessionView extends Disposable implements IUniverseAgentSessionView {
	declare readonly _serviceBrand: undefined;
	private leaseSeq = 0;
	private readonly leaseSessions = new Map<string, string>();
	private readonly emitters = new Map<string, Emitter<IUniverseAgentSessionViewFrameEvent>>();

	onDynamicDidApplyFrame(leaseId: string) {
		let emitter = this.emitters.get(leaseId);
		if (!emitter) {
			emitter = this._register(new Emitter<IUniverseAgentSessionViewFrameEvent>({
				onDidAddFirstListener: () => {
					queueMicrotask(() => this.emitLeftover(leaseId));
				},
			}));
			this.emitters.set(leaseId, emitter);
		}
		return emitter.event;
	}

	async acquireLease(sessionId: string) {
		const leaseId = `lease:${sessionId}:${++this.leaseSeq}`;
		this.leaseSessions.set(leaseId, sessionId);
		return leaseId;
	}
	async whenEngineSessionReady(sessionId: string) { return sessionId; }
	async releaseLease() { }
	async post(_leaseId: string, _msg: ConversationWriteMessage) {
		return { accepted: true as const, correlation: { id: 'mock' } };
	}
	async requestResync() { }
	async acknowledge() { }
	async requestDetail() { return { ok: false as const, reason: 'unavailable' as const }; }

	private emitLeftover(leaseId: string): void {
		const emitter = this.emitters.get(leaseId);
		if (!emitter) {
			return;
		}
		const sessionId = this.leaseSessions.get(leaseId) ?? leaseId;
		const projection = stubTurnsToSnapshot(sessionId, [
			{ id: 'u-leftover', kind: 'user', text: LEFTOVER_CACHE_TURN_TEXT },
		]);
		emitter.fire({
			leaseId,
			sessionId,
			applied: { kind: 'baseline' },
			frame: {
				frame: {
					leaseId: leaseId as unknown as ViewLeaseId,
					generation: 1,
					frameId: 1,
					version: 1,
					body: { kind: 'baseline', snapshot: projection.snapshot },
				},
			},
		});
	}
}

function createService(
	connection: MockUniverseAgentConnection,
	sessionView: IUniverseAgentSessionView,
): ConversationEngineRosterService {
	const workspaceToolsGate = {
		_serviceBrand: undefined,
		shouldAdvertise: () => true,
	};
	return new ConversationEngineRosterService(
		connection as unknown as IUniverseAgentConnection,
		sessionView as unknown as IUniverseAgentSessionView,
		workspaceToolsGate,
	);
}

async function awaitEngineCatalogRefresh(service: ConversationEngineRosterService): Promise<void> {
	await service.whenEngineCatalogRefreshComplete();
	await new Promise<void>(resolve => setTimeout(resolve, 0));
}

suite('ConversationEngineRosterService (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('catalog refresh keeps inactive session turns copied before reconnect cache', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		const sessionView = store.add(new LeftoverProjectionSessionView());
		connection.setListSessions([
			{ sessionId: 'ua-a', title: 'A' },
			{ sessionId: 'ua-b', title: 'B' },
		]);
		const service = store.add(createService(connection, sessionView));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await awaitEngineCatalogRefresh(service);

		service.switchSession('ua-b');
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.ok(service.getTurns('ua-a').some(turn => turn.text === LEFTOVER_CACHE_TURN_TEXT));

		service.setEngineConnected(true);
		await awaitEngineCatalogRefresh(service);

		connection.setConnected(false);
		service.setEngineConnected(false);

		const offlineTurns = service.getTurns('ua-a');
		assert.ok(
			offlineTurns.some(turn => turn.text === LEFTOVER_CACHE_TURN_TEXT),
			'inactive session turns must survive catalog re-list for disconnect cache',
		);
	});
});

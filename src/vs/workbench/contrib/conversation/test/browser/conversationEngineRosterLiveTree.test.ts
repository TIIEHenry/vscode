/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IConversationSessionViewLease } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import { emptySessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/empty-snapshot.js';
import type { SessionId } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IUniverseAgentSessionView } from '../../../../../platform/universeAgent/common/universeAgentSessionView.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ConversationEngineRosterService } from '../../browser/conversationEngineRosterService.js';
import { ConversationStubService } from '../../browser/conversationStubService.js';

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
	async disconnect() { this.setConnected(false); }
	async listSessions() { return { sessions: this.sessions.map(s => ({ sessionId: s.sessionId, title: s.title })) }; }
	async createSession() { return { sessionId: 'ua-new' }; }
	async deleteSession() { }
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

class MockUniverseAgentSessionView extends Disposable implements IUniverseAgentSessionView {
	declare readonly _serviceBrand: undefined;
	onDynamicDidApplyFrame() { return Event.None; }
	async acquireLease(sessionId: string) { return `lease:${sessionId}`; }
	async releaseLease() { }
	async post() { return { accepted: true as const, correlation: { id: 'mock' } }; }
	async requestResync() { }
	async requestDetail() { return { ok: false as const, reason: 'unavailable' as const }; }
}

class TrackingSessionViewLease extends Disposable implements IConversationSessionViewLease {
	readonly onDidApplyFrame = Event.None;
	disposed = false;

	constructor(readonly sessionId: string) {
		super();
	}

	readonly attribution = new Map();
	readonly details = new Map();

	private _snapshot = emptySessionViewSnapshot('pending' as SessionId);

	get snapshot() {
		return this._snapshot;
	}

	override dispose(): void {
		this.disposed = true;
		super.dispose();
	}

	async post() { return { accepted: true as const, correlation: { id: 'mock' } }; }
	requestResync() { }
}

class ObservableRosterHarness extends ConversationEngineRosterService {
	readonly acquireCalls: string[] = [];
	private readonly leases = new Map<string, TrackingSessionViewLease>();

	override acquireSessionView(sessionId: string): IConversationSessionViewLease {
		if (!this.isEngineConnected()) {
			return super.acquireSessionView(sessionId);
		}
		this.acquireCalls.push(sessionId);
		let lease = this.leases.get(sessionId);
		if (!lease) {
			lease = new TrackingSessionViewLease(sessionId);
			this.leases.set(sessionId, lease);
		}
		return lease;
	}

	getLease(sessionId: string): TrackingSessionViewLease | undefined {
		return this.leases.get(sessionId);
	}
}

function createHarness(connection: MockUniverseAgentConnection, sessionView: MockUniverseAgentSessionView): ObservableRosterHarness {
	const workspaceToolsGate = {
		_serviceBrand: undefined,
		shouldAdvertise: () => true,
	};
	return new ObservableRosterHarness(
		connection as unknown as IUniverseAgentConnection,
		sessionView as unknown as IUniverseAgentSessionView,
		workspaceToolsGate,
	);
}

async function settle(): Promise<void> {
	await new Promise<void>(resolve => setTimeout(resolve, 0));
}

suite('ConversationEngineRosterService live agent tree observation (GC-4)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('stub roster exposes Event.None for onDidChangeLiveAgentTree', () => {
		const roster = store.add(new ConversationStubService());
		assert.strictEqual(roster.onDidChangeLiveAgentTree, Event.None);
	});

	test('active session switch releases old lease and acquires new lease once each', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		const sessionView = store.add(new MockUniverseAgentSessionView());
		connection.setListSessions([
			{ sessionId: 'ua-a', title: 'A' },
			{ sessionId: 'ua-b', title: 'B' },
		]);
		const service = store.add(createHarness(connection, sessionView));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await settle();

		const initialLease = service.getLease('ua-a');
		assert.ok(initialLease);
		service.acquireCalls.length = 0;

		const previousLease = initialLease;
		service.switchSession('ua-b');
		await settle();

		assert.deepStrictEqual(service.acquireCalls, ['ua-b']);
		assert.ok(previousLease.disposed);
		assert.ok(service.getLease('ua-b'));
	});

	test('disconnect releases the active observation lease', async () => {
		const connection = store.add(new MockUniverseAgentConnection());
		const sessionView = store.add(new MockUniverseAgentSessionView());
		connection.setListSessions([{ sessionId: 'ua-only', title: 'Only' }]);
		const service = store.add(createHarness(connection, sessionView));
		connection.setConnected(true);
		service.setEngineConnected(true);
		await settle();

		const lease = service.getLease('ua-only');
		assert.ok(lease);

		service.setEngineConnected(false);
		await settle();

		assert.ok(lease.disposed);
	});
});

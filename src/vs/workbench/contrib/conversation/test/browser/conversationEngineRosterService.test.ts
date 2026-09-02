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
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
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
	async connect() { return { methods: [], events: [], sessionToken: 'tok' }; }
	async connectProfile() { return { ok: false as const, code: 'transport_failed' as const, reason: 'stub' }; }
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
	async listMcpServers() { return { servers: [] }; }
	async toggleMcpServer() { return { ok: true }; }
	async listTools() { return { tools: [] }; }
}

class MockUniverseAgentSessionView implements IUniverseAgentSessionView {
	declare readonly _serviceBrand: undefined;
	private readonly _onDidApplyFrame = new Emitter<never>();
	readonly onDidApplyFrame = this._onDidApplyFrame.event;
	async acquireLease(sessionId: string) { return `lease:${sessionId}`; }
	async releaseLease() { }
	async post() { return { accepted: true as const, correlation: { id: 'mock' } }; }
	async requestResync() { }
}

function createService(connection: MockUniverseAgentConnection, storage?: TestStorageService): ConversationEngineRosterService {
	return new ConversationEngineRosterService(
		connection as unknown as IUniverseAgentConnection,
		new MockUniverseAgentSessionView() as unknown as IUniverseAgentSessionView,
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

	test('unconnected path still uses stub frame source with stub echo', () => {
		const connection = store.add(new MockUniverseAgentConnection());
		const service = store.add(createService(connection));
		const sessionId = service.getActiveSessionId();
		const lease = store.add(service.acquireSessionView(sessionId));
		assert.strictEqual(service.isEngineConnected(), false);

		const outcome = lease.post({ kind: 'submitInput', text: 'hello stub' });
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
});

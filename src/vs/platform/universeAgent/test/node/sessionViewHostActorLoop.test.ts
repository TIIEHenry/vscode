/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IUniverseAgentConnection } from '../../common/universeAgentConnection.js';
import type { IUniverseAgentHostConnection } from '../../common/universeAgentHostConnection.js';
import type { SyncChrome } from '../../common/sessionView/types.js';
import type {
	IFileMutationRecord,
	ITurnSettleSignal,
	UniverseAgentAgentTreeNode,
	UniverseAgentConnectionSnapshot,
	UniverseAgentSessionStreamCloseCause,
} from '../../common/universeAgentTypes.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import { createEmptyCapabilitySnapshot } from '../../node/grpcCapabilityProbe.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { NodeSchedulerPort } from '../../node/sessionViewHostPorts.js';
import type { TimerId } from '../../node/sessionCore/ports.js';

const LINGER_MS = 8;

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

type StreamHandle = {
	readonly sessionId: string;
	disposed: boolean;
	readonly onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void;
};

class TestConnection {
	declare readonly _serviceBrand: undefined;
	private connected = true;
	readonly streams: StreamHandle[] = [];

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
	subscribeSessionEventStream(
		sessionId: string,
		_listener: (event: { payload: unknown }) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	) {
		const handle: StreamHandle = { sessionId, disposed: false, onClosed };
		this.streams.push(handle);
		return {
			dispose: () => {
				handle.disposed = true;
			},
		};
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
	async probeEngine() { return { ok: false as const, reason: 'test' }; }

	get activeStreamCount(): number {
		return this.streams.filter(stream => !stream.disposed).length;
	}

	endStream(sessionId: string, cause: UniverseAgentSessionStreamCloseCause): void {
		for (const stream of this.streams) {
			if (stream.sessionId === sessionId && !stream.disposed) {
				stream.onClosed?.(cause);
			}
		}
	}
}

class TestHost implements IUniverseAgentHostConnection {
	private readonly _onRequestAgentTreeRefresh = new Emitter<{ readonly sessionId: string }>();
	readonly onRequestAgentTreeRefresh = this._onRequestAgentTreeRefresh.event;

	async fetchToolDetail() {
		return { ok: false as const, reason: 'unavailable' as const };
	}

	async fetchAgentTree(_sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined> {
		return ROOT_TREE;
	}

	isAgentTreeUnsupported(): boolean {
		return false;
	}

	notifyFileMutation(_record: IFileMutationRecord): void { }
	notifyTurnSettle(_signal: ITurnSettleSignal): void { }
	notifyTeamRuntimeChange(_sessionId: string): void { }
}

function collectSyncChrome(frames: readonly IUniverseAgentSessionViewFrameEvent[]): SyncChrome[] {
	const chrome: SyncChrome[] = [];
	for (const event of frames) {
		const body = event.frame.frame.body;
		if (body.kind === 'baseline') {
			chrome.push(body.snapshot.sync);
		} else if (body.kind === 'patches') {
			for (const patch of body.patches) {
				if (patch.op === 'setSyncChrome') {
					chrome.push(patch.sync);
				}
			}
		}
	}
	return chrome;
}

async function waitFor(predicate: () => boolean, timeoutMs = 250): Promise<void> {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('timed out waiting for condition');
		}
		await timeout(4);
	}
}

suite('SessionViewHost Actor timer / streamClosed loop', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createHost(connection: TestConnection): SessionViewHost {
		return store.add(new SessionViewHost(connection as unknown as IUniverseAgentConnection, new TestHost(), { lingerMs: LINGER_MS }));
	}

	test('NodeSchedulerPort posts onFire and cancelTimer suppresses it', async () => {
		const fired: string[] = [];
		const scheduler = new NodeSchedulerPort(id => fired.push(String(id)));
		store.add(scheduler);
		scheduler.startTimer('keep:' as TimerId, 1);
		scheduler.startTimer('drop:' as TimerId, 1);
		scheduler.cancelTimer('drop:' as TimerId);
		await waitFor(() => fired.includes('keep:'));
		assert.deepStrictEqual(fired, ['keep:']);
	});

	test('last lease release closes the gRPC subscription after linger', async () => {
		const connection = new TestConnection();
		const viewHost = createHost(connection);
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-linger');
		assert.strictEqual(connection.activeStreamCount, 1);

		viewHost.releaseLease(leaseId);
		assert.strictEqual(connection.activeStreamCount, 1, 'stream must linger until the timer fires');
		await waitFor(() => connection.activeStreamCount === 0);
		assert.strictEqual(connection.activeStreamCount, 0);
		assert.ok(connection.streams.every(stream => stream.disposed));
	});

	test('re-acquire during linger cancels closeStream', async () => {
		const connection = new TestConnection();
		const viewHost = createHost(connection);
		viewHost.onEngineConnectionChanged();
		const first = viewHost.acquireLease('sess-reacquire');
		viewHost.releaseLease(first);
		viewHost.acquireLease('sess-reacquire');
		await timeout(LINGER_MS + 20);
		assert.strictEqual(connection.activeStreamCount, 1);
	});

	test('remote stream end posts streamClosed and sync leaves live', async () => {
		const connection = new TestConnection();
		const viewHost = createHost(connection);
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDidApplyFrame(event => frames.push(event)));

		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-remote');
		const before = collectSyncChrome(frames);
		assert.ok(before.some(sync => sync.kind === 'live'));

		connection.endStream('sess-remote', { kind: 'remote' });
		const after = collectSyncChrome(frames);
		assert.ok(after.some(sync => sync.kind === 'closed' && sync.reason === 'remote'));
		await waitFor(() => connection.activeStreamCount === 0);
	});

	test('stream error posts streamClosed with the error message', async () => {
		const connection = new TestConnection();
		const viewHost = createHost(connection);
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDidApplyFrame(event => frames.push(event)));

		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('sess-error');
		connection.endStream('sess-error', { kind: 'error', message: 'rst' });
		const after = collectSyncChrome(frames);
		assert.ok(after.some(sync => sync.kind === 'closed' && sync.reason === 'rst'));
	});

	test('host-initiated linger dispose does not synthesize streamClosed', async () => {
		const connection = new TestConnection();
		const viewHost = createHost(connection);
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDidApplyFrame(event => frames.push(event)));

		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-local');
		const liveCount = collectSyncChrome(frames).filter(sync => sync.kind === 'live').length;
		viewHost.releaseLease(leaseId);
		await waitFor(() => connection.activeStreamCount === 0);
		const closedAfterDispose = collectSyncChrome(frames).filter(sync => sync.kind === 'closed');
		assert.strictEqual(closedAfterDispose.length, 0, 'linger closeStream must not invent remote/error chrome');
		assert.ok(liveCount >= 1);
	});
});

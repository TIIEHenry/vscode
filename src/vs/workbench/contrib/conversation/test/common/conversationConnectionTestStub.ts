/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import type { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentConnectionSnapshot,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';

const UNKNOWN = { support: 'UNKNOWN' as const };

export function createEmptyTestCapabilitySnapshot(): UniverseAgentCapabilitySnapshot {
	return {
		skills: UNKNOWN,
		mcp: UNKNOWN,
		mcpRuntime: UNKNOWN,
		plugins: UNKNOWN,
		models: UNKNOWN,
		providerConfig: UNKNOWN,
		globalRules: UNKNOWN,
		agentProfiles: UNKNOWN,
		projectRules: UNKNOWN,
		tools: UNKNOWN,
		hooksMetadata: UNKNOWN,
		agentTree: UNKNOWN,
		team: UNKNOWN,
		fireTrigger: UNKNOWN,
		setTriggerEnabled: UNKNOWN,
		deleteTrigger: UNKNOWN,
		upsertTrigger: UNKNOWN,
		writeClipboard: UNKNOWN,
		readClipboard: UNKNOWN,
		clearClipboard: UNKNOWN,
		readContextVariable: UNKNOWN,
		restoreSnapshot: UNKNOWN,
		deleteSnapshot: UNKNOWN,
		readGitChanges: UNKNOWN,
	};
}

export function createTestCapabilitySnapshot(
	overrides: Partial<UniverseAgentCapabilitySnapshot> = {},
): UniverseAgentCapabilitySnapshot {
	return { ...createEmptyTestCapabilitySnapshot(), ...overrides };
}

/** Minimal IUniverseAgentConnection stub for conversation browser tests (IdentityStrip / Lens mount). */
export function createConversationConnectionTestStub(
	overrides: Partial<IUniverseAgentConnection> = {},
): IUniverseAgentConnection {
	const capabilities = createEmptyTestCapabilitySnapshot();
	return {
		_serviceBrand: undefined,
		isEngineConnected: () => false,
		getConnectionPhase: () => ({ kind: 'disconnected' }),
		getTransportState: () => 'idle',
		getConnectionSnapshot: (): UniverseAgentConnectionSnapshot => ({
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities,
			engineIdentityId: 'engine-test',
			linkId: 1,
		}),
		getCapabilitySnapshot: () => capabilities,
		onDidChangeConnection: Event.None,
		onDidFileMutation: Event.None,
		onDidTurnSettle: Event.None,
		onDidChangeTeamRuntime: Event.None,
		requestAgentTreeRefresh: () => { },
		getNavigatorCapability: () => 'UNKNOWN',
		isAgentTreeFetchFailed: () => false,
		team: {
			memberStatus: async () => [],
			taskList: async () => [],
			teamInfo: async () => undefined,
		},
		connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
		confirmPairing: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
		cancelPairing: async () => { },
		probeConnectionProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
		disconnect: async () => { },
		listSessions: async () => ({ sessions: [] }),
		createSession: async () => ({ sessionId: 's' }),
		deleteSession: async () => { },
		renameSession: async () => ({ ok: false, message: 'stub' }),
		cancelGeneration: async () => ({ ok: false, message: 'stub' }),
		enqueueQueueItem: async () => ({ ok: false, error: 'stub' }),
		pauseQueue: async () => ({ ok: false, error: 'stub' }),
		resumeQueue: async () => ({ ok: false, error: 'stub' }),
		clearQueue: async () => ({ ok: false, error: 'stub' }),
		holdQueueItem: async () => ({ ok: false, error: 'stub' }),
		releaseQueueItemHold: async () => ({ ok: false, error: 'stub' }),
		editQueueItem: async () => ({ ok: false, error: 'stub' }),
		getHistory: async () => ({ envelopes: [] }),
		subscribeSessionEventStream: (
			_sessionId: string,
			_listener: (event: UniverseAgentSessionEvent) => void,
			_onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
		) => ({ dispose: () => { } }),
		chat: async () => { },
		listSkills: async () => ({ skills: [] }),
		setSkillEnabled: async () => ({ ok: true }),
		getSkillInfo: async () => ({ name: '', content: '', source: 'unknown', enabled: false }),
		listAgentProfiles: async () => ({ profiles: [] }),
		saveAgentProfile: async (request) => ({ profile: request.profile }),
		deleteAgentProfile: async () => ({ ok: true }),
		resetAgentProfile: async () => ({ ok: true }),
		listMcpServers: async () => ({ servers: [] }),
		getMcpServerStatuses: async () => ({ statuses: [] }),
		getMcpServerTools: async () => ({ tools: [] }),
		listPlugins: async () => ({ plugins: [] }),
		getPluginInfo: async () => ({ summary: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const }, hooks: [] }),
		enablePlugin: async () => ({ plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }),
		reloadPlugin: async () => ({ plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }),
		unloadPlugin: async () => ({ removedHookCount: 0 }),
		scanNewPlugins: async () => ({ newPlugins: [], skippedCount: 0 }),
		toggleMcpServer: async () => ({ ok: true }),
		addMcpServer: async () => ({ ok: true }),
		updateMcpServer: async () => ({ ok: true }),
		removeMcpServer: async () => ({ ok: true }),
		listTools: async () => ({ tools: [] }),
		listModels: async () => ({ models: [] }),
		probeEngine: async () => ({ ok: false as const, reason: 'stub' }),
		...overrides,
	};
}

export interface IMutableConversationConnectionTestStubState {
	connected: boolean;
	pairingPending: boolean;
	looksLive: boolean;
	engineIdentityId: string | undefined;
	linkId: number | undefined;
}

export interface IMutableConversationConnectionTestStubInit {
	readonly connected: boolean;
	readonly pairingPending: boolean;
	readonly looksLive: boolean;
	/** Held by reference: the caller mutates the capability entries it keeps, then calls `notify()`. */
	readonly capabilities: UniverseAgentCapabilitySnapshot;
	readonly engineIdentityId: string | undefined;
	readonly linkId: number | undefined;
	/** Which connection snapshots carry the published engine identity and link serial. */
	readonly publishedLink: 'always' | 'whenConnected' | 'never';
	/** Applied last. Accessors keep working because the property descriptors are copied. */
	readonly overrides?: Partial<IUniverseAgentConnection>;
}

export interface IMutableConversationConnectionTestStub {
	readonly connection: IUniverseAgentConnection;
	/** Not disposed here. The test registers it where it used to create it. */
	readonly onDidChangeConnectionEmitter: Emitter<UniverseAgentConnectionSnapshot>;
	/** Quiet mutation. Call `notify()` to publish. */
	readonly state: IMutableConversationConnectionTestStubState;
	snapshot(): UniverseAgentConnectionSnapshot;
	notify(): void;
}

/**
 * Switchable connection for the engine section tests. Every default (connected,
 * pairing, capability support, published link) comes from the caller so each
 * test file keeps its own. `isEngineConnected` follows the production pairing-hold rule.
 */
export function createMutableConversationConnectionTestStub(init: IMutableConversationConnectionTestStubInit): IMutableConversationConnectionTestStub {
	const state: IMutableConversationConnectionTestStubState = {
		connected: init.connected,
		pairingPending: init.pairingPending,
		looksLive: init.looksLive,
		engineIdentityId: init.engineIdentityId,
		linkId: init.linkId,
	};
	const onDidChangeConnectionEmitter = new Emitter<UniverseAgentConnectionSnapshot>();
	const snapshot = (): UniverseAgentConnectionSnapshot => ({
		transport: state.connected ? 'ok' : 'idle',
		authenticated: state.connected,
		pairingPending: state.pairingPending,
		channelAlive: state.connected,
		sharedFsRootSent: false,
		capabilities: init.capabilities,
		...(init.publishedLink === 'always' ? { engineIdentityId: state.engineIdentityId, linkId: state.linkId }
			: init.publishedLink === 'whenConnected' && state.connected ? { engineIdentityId: state.engineIdentityId, linkId: state.linkId }
				: {}),
	});
	const connection = createConversationConnectionTestStub({
		isEngineConnected: () => state.connected && (state.looksLive || !state.pairingPending),
		getConnectionPhase: () => ({ kind: state.connected ? 'connected' : 'disconnected', path: 'loopback' }),
		getTransportState: () => (state.connected ? 'ok' : 'idle'),
		getConnectionSnapshot: snapshot,
		getCapabilitySnapshot: () => init.capabilities,
		onDidChangeConnection: onDidChangeConnectionEmitter.event,
		disconnect: async () => { state.connected = false; onDidChangeConnectionEmitter.fire(snapshot()); },
	});
	if (init.overrides) {
		Object.defineProperties(connection, Object.getOwnPropertyDescriptors(init.overrides));
	}
	return { connection, onDidChangeConnectionEmitter, state, snapshot, notify: () => onDidChangeConnectionEmitter.fire(snapshot()) };
}

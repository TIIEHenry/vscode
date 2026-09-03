/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import type { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentCapabilitySnapshot, UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';

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
	};
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
		}),
		getCapabilitySnapshot: () => capabilities,
		onDidChangeConnection: Event.None,
		onDidFileMutation: Event.None,
		onDidTurnSettle: Event.None,
		onDidChangeTeamRuntime: Event.None,
		requestAgentTreeRefresh: () => { },
		getNavigatorCapability: () => 'UNKNOWN',
		team: {
			memberStatus: async () => [],
			taskList: async () => [],
			teamInfo: async () => undefined,
		},
		connect: async () => ({ sessionToken: undefined, workDir: undefined, methods: [], events: [] }),
		connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
		confirmPairing: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
		cancelPairing: async () => { },
		disconnect: async () => { },
		listSessions: async () => ({ sessions: [] }),
		createSession: async () => ({ sessionId: 's' }),
		deleteSession: async () => { },
		getHistory: async () => ({ envelopes: [] }),
		subscribeSessionEventStream: () => ({ dispose: () => { } }),
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
		...overrides,
	};
}

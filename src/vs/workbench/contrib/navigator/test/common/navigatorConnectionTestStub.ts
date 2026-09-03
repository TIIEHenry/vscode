/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import type { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';

export function createNavigatorConnectionTestStub(
	overrides: Partial<IUniverseAgentConnection> = {},
): IUniverseAgentConnection {
	return {
		_serviceBrand: undefined,
		isEngineConnected: () => false,
		getTransportState: () => 'idle' as const,
		getConnectionSnapshot: (): UniverseAgentConnectionSnapshot => ({
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: {} as UniverseAgentConnectionSnapshot['capabilities'],
		}),
		getCapabilitySnapshot: () => ({} as UniverseAgentConnectionSnapshot['capabilities']),
		onDidChangeConnection: Event.None,
		onDidFileMutation: Event.None,
		onDidTurnSettle: Event.None,
		onDidChangeTeamRuntime: Event.None,
		requestAgentTreeRefresh: () => { },
		getNavigatorCapability: () => 'UNKNOWN' as const,
		team: {
			memberStatus: async () => [],
			taskList: async () => [],
			teamInfo: async () => undefined,
		},
		connect: async () => ({ methods: [], events: [] }),
		connectProfile: async () => ({ ok: false as const, code: 'transport_failed' as const, reason: 'test' }),
		confirmPairing: async () => ({ ok: false as const, code: 'transport_failed' as const, reason: 'test' }),
		cancelPairing: async () => { },
		probeConnectionProfile: async () => ({ ok: false as const, code: 'transport_failed' as const, reason: 'test' }),
		getConnectionPhase: () => ({ kind: 'disconnected' as const }),
		disconnect: async () => { },
		listSessions: async () => ({ sessions: [] }),
		createSession: async () => ({ sessionId: 's' }),
		deleteSession: async () => { },
		getHistory: async () => ({ envelopes: [] }),
		subscribeSessionEventStream: () => ({ dispose: () => { } }),
		chat: async () => { },
		listSkills: async () => ({ skills: [] }),
		setSkillEnabled: async () => ({ ok: true }),
		getSkillInfo: async () => ({ name: '', content: '', source: 'unknown' as const, enabled: false }),
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

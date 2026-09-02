/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import type { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';

/** Minimal IUniverseAgentConnection stub for conversation browser tests (IdentityStrip / Lens mount). */
export function createConversationConnectionTestStub(
	overrides: Partial<IUniverseAgentConnection> = {},
): IUniverseAgentConnection {
	return {
		_serviceBrand: undefined,
		isEngineConnected: () => false,
		getConnectionPhase: () => ({ kind: 'disconnected' }),
		getTransportState: () => 'idle',
		getConnectionSnapshot: () => ({
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			capabilities: { methods: [], toolFamilies: [] },
		}),
		getCapabilitySnapshot: () => ({ methods: [], toolFamilies: [] }),
		onDidChangeConnection: Event.None,
		onDidFileMutation: Event.None,
		onDidTurnSettle: Event.None,
		connect: async () => ({ sessionToken: undefined, workDir: undefined, methods: [] }),
		connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
		disconnect: async () => { },
		listSessions: async () => ({ sessions: [] }),
		createSession: async () => ({ sessionId: 's' }),
		deleteSession: async () => { },
		getHistory: async () => ({ events: [] }),
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
		toggleMcpServer: async () => ({ ok: true }),
		addMcpServer: async () => ({ ok: true }),
		updateMcpServer: async () => ({ ok: true }),
		removeMcpServer: async () => ({ ok: true }),
		listTools: async () => ({ tools: [] }),
		...overrides,
	};
}

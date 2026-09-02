/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentCapabilityEntry,
	UniverseAgentCapabilityKey,
	UniverseAgentCapabilitySnapshot,
} from '../common/universeAgentTypes.js';
import { GrpcStatusCode, IUniverseAgentGrpcTransport, UniverseAgentGrpcServices } from './grpc/grpcTransport.js';

const UNKNOWN: UniverseAgentCapabilityEntry = { support: 'UNKNOWN', reason: 'not probed' };
const UNSUPPORTED: UniverseAgentCapabilityEntry = { support: 'UNSUPPORTED' };
const SUPPORTED: UniverseAgentCapabilityEntry = { support: 'SUPPORTED' };

function emptySnapshot(): UniverseAgentCapabilitySnapshot {
	return {
		skills: { ...UNKNOWN },
		mcp: { ...UNKNOWN },
		mcpRuntime: { ...UNKNOWN },
		plugins: { ...UNKNOWN },
		globalRules: { ...UNKNOWN },
		agentProfiles: { ...UNKNOWN },
		projectRules: { ...UNKNOWN },
		tools: { ...UNKNOWN },
		hooksMetadata: { ...UNKNOWN },
		agentTree: { ...UNKNOWN },
		team: { ...UNKNOWN },
	};
}

/** Maps Connect-advertised methods to probe targets (Singularity GrpcCapabilityProbe equivalent). */
const PROBE_TARGETS: Partial<Record<UniverseAgentCapabilityKey, { service: string; method: string; methodKey: string }>> = {
	skills: {
		service: UniverseAgentGrpcServices.Tool.service,
		method: UniverseAgentGrpcServices.Tool.ListSkills,
		methodKey: 'ToolService.ListSkills',
	},
	agentProfiles: {
		service: UniverseAgentGrpcServices.Agent.service,
		method: UniverseAgentGrpcServices.Agent.ListAgentProfiles,
		methodKey: 'AgentService.ListAgentProfiles',
	},
	mcp: {
		service: UniverseAgentGrpcServices.Mcp.service,
		method: UniverseAgentGrpcServices.Mcp.ListMcpServers,
		methodKey: 'McpService.ListMcpServers',
	},
	mcpRuntime: {
		service: UniverseAgentGrpcServices.Mcp.service,
		method: UniverseAgentGrpcServices.Mcp.GetMcpServerStatuses,
		methodKey: 'McpService.GetMcpServerStatuses',
	},
	plugins: {
		service: UniverseAgentGrpcServices.Plugin.service,
		method: UniverseAgentGrpcServices.Plugin.List,
		methodKey: 'PluginService.List',
	},
	tools: {
		service: UniverseAgentGrpcServices.Tool.service,
		method: UniverseAgentGrpcServices.Tool.ListTools,
		methodKey: 'ToolService.ListTools',
	},
	agentTree: {
		service: UniverseAgentGrpcServices.Agent.service,
		method: UniverseAgentGrpcServices.Agent.Tree,
		methodKey: 'AgentService.Tree',
	},
	team: {
		service: UniverseAgentGrpcServices.Team.service,
		method: UniverseAgentGrpcServices.Team.MemberStatus,
		methodKey: 'TeamService.MemberStatus',
	},
};

export interface GrpcCapabilityProbeInput {
	readonly methods: readonly string[];
	readonly transport: IUniverseAgentGrpcTransport;
}

/**
 * Derives capability three-state snapshot. Methods advertisement alone is insufficient:
 * a runtime probe must not return UNIMPLEMENTED (m6 §5).
 */
export async function probeEngineCapabilities(input: GrpcCapabilityProbeInput): Promise<UniverseAgentCapabilitySnapshot> {
	const snapshot: Record<UniverseAgentCapabilityKey, UniverseAgentCapabilityEntry> = emptySnapshot();
	const methodSet = new Set(input.methods);

	for (const key of Object.keys(PROBE_TARGETS) as UniverseAgentCapabilityKey[]) {
		const target = PROBE_TARGETS[key];
		if (!target) {
			continue;
		}
		if (!methodSet.has(target.methodKey)) {
			snapshot[key] = { support: 'UNSUPPORTED', reason: 'method not advertised' };
			continue;
		}
		const status = await input.transport.probeRpc(target.service, target.method);
		if (status === GrpcStatusCode.UNIMPLEMENTED) {
			snapshot[key] = { support: 'UNSUPPORTED', reason: 'UNIMPLEMENTED' };
			continue;
		}
		if (status === GrpcStatusCode.OK) {
			snapshot[key] = { ...SUPPORTED };
			continue;
		}
		snapshot[key] = { support: 'UNKNOWN', reason: `probe status ${status}` };
	}

	// Remaining IDE-local derived keys without dedicated probes in this slice.
	for (const key of ['projectRules', 'hooksMetadata', 'globalRules'] as const) {
		if (snapshot[key].support === 'UNKNOWN' && snapshot[key].reason === 'not probed') {
			snapshot[key] = { ...UNSUPPORTED, reason: 'probe not implemented in M6-A1' };
		}
	}

	return snapshot;
}

export { emptySnapshot as createEmptyCapabilitySnapshot };

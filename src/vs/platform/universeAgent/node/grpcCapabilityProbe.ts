/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentCapabilityEntry,
	UniverseAgentCapabilityKey,
	UniverseAgentCapabilitySnapshot,
} from '../common/universeAgentTypes.js';
import {
	PROVIDER_CONFIG_UNSUPPORTED_REASON,
	SUPPORTED_CAPABILITY,
	UNSUPPORTED_CAPABILITY,
	createEmptyCapabilitySnapshot,
} from '../common/universeAgentCapabilities.js';
import { GrpcStatusCode, IUniverseAgentGrpcTransport, UniverseAgentGrpcServices, UniverseAgentSessionListMethodKey } from './grpc/grpcTransport.js';

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
	models: {
		service: UniverseAgentGrpcServices.Config.service,
		method: UniverseAgentGrpcServices.Config.ListModels,
		methodKey: 'ConfigService.ListModels',
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
	const snapshot: Record<UniverseAgentCapabilityKey, UniverseAgentCapabilityEntry> = createEmptyCapabilitySnapshot();
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
			snapshot[key] = { ...SUPPORTED_CAPABILITY };
			continue;
		}
		snapshot[key] = { support: 'UNKNOWN', reason: `probe status ${status}` };
	}

	// Remaining IDE-local derived keys without dedicated probes in this slice.
	for (const key of ['projectRules', 'hooksMetadata', 'globalRules'] as const) {
		if (snapshot[key].support === 'UNKNOWN' && snapshot[key].reason === 'not probed') {
			snapshot[key] = { ...UNSUPPORTED_CAPABILITY, reason: 'probe not implemented in M6-A1' };
		}
	}

	// G-ENG-1: never probe ConfigService.Get/Set as a provider catalog.
	snapshot.providerConfig = { support: 'UNSUPPORTED', reason: PROVIDER_CONFIG_UNSUPPORTED_REASON };

	return snapshot;
}

/**
 * Session.List three-state for Navigator. Not a {@link UniverseAgentCapabilityKey}
 * (Engine Overview must not gain a sessionList row).
 */
export async function probeSessionListCapability(input: GrpcCapabilityProbeInput): Promise<UniverseAgentCapabilityEntry> {
	if (!input.methods.includes(UniverseAgentSessionListMethodKey)) {
		return { support: 'UNSUPPORTED', reason: 'method not advertised' };
	}
	const status = await input.transport.probeRpc(
		UniverseAgentGrpcServices.Session.service,
		UniverseAgentGrpcServices.Session.List,
	);
	if (status === GrpcStatusCode.UNIMPLEMENTED) {
		return { support: 'UNSUPPORTED', reason: 'UNIMPLEMENTED' };
	}
	if (status === GrpcStatusCode.OK) {
		return { ...SUPPORTED_CAPABILITY };
	}
	return { support: 'UNKNOWN', reason: `probe status ${status}` };
}

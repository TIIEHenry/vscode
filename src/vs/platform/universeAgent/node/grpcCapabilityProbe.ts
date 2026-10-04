/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentCapabilityEntry,
	UniverseAgentCapabilityKey,
	UniverseAgentCapabilitySnapshot,
	UniverseAgentCapabilitySupport,
	UniverseAgentConversationEntryCapability,
	UniverseAgentGitWriteCapability,
} from '../common/universeAgentTypes.js';
import {
	PROVIDER_CONFIG_UNSUPPORTED_REASON,
	SUPPORTED_CAPABILITY,
	UNIVERSE_AGENT_CONVERSATION_ENTRY_KEYS,
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
	providerConfig: {
		service: UniverseAgentGrpcServices.Agent.service,
		method: UniverseAgentGrpcServices.Agent.ListProviderStatus,
		methodKey: 'AgentService.ListProviderStatus',
	},
	globalRules: {
		service: UniverseAgentGrpcServices.ProjectRule.service,
		method: UniverseAgentGrpcServices.ProjectRule.List,
		methodKey: 'ProjectRuleService.List',
	},
	projectRules: {
		service: UniverseAgentGrpcServices.ProjectRule.service,
		method: UniverseAgentGrpcServices.ProjectRule.List,
		methodKey: 'ProjectRuleService.List',
	},
	hooksMetadata: {
		service: UniverseAgentGrpcServices.System.service,
		method: UniverseAgentGrpcServices.System.ListHookPoints,
		methodKey: 'SystemService.ListHookPoints',
	},
	fireTrigger: {
		service: UniverseAgentGrpcServices.Trigger.service,
		method: UniverseAgentGrpcServices.Trigger.FireTrigger,
		methodKey: 'TriggerService.FireTrigger',
	},
	setTriggerEnabled: {
		service: UniverseAgentGrpcServices.Trigger.service,
		method: UniverseAgentGrpcServices.Trigger.SetTriggerEnabled,
		methodKey: 'TriggerService.SetTriggerEnabled',
	},
	deleteTrigger: {
		service: UniverseAgentGrpcServices.Trigger.service,
		method: UniverseAgentGrpcServices.Trigger.DeleteTrigger,
		methodKey: 'TriggerService.DeleteTrigger',
	},
	upsertTrigger: {
		service: UniverseAgentGrpcServices.Trigger.service,
		method: UniverseAgentGrpcServices.Trigger.UpsertTrigger,
		methodKey: 'TriggerService.UpsertTrigger',
	},
	writeClipboard: {
		service: UniverseAgentGrpcServices.Clipboard.service,
		method: UniverseAgentGrpcServices.Clipboard.Write,
		methodKey: 'ClipboardService.Write',
	},
	readClipboard: {
		service: UniverseAgentGrpcServices.Clipboard.service,
		method: UniverseAgentGrpcServices.Clipboard.Read,
		methodKey: 'ClipboardService.Read',
	},
	clearClipboard: {
		service: UniverseAgentGrpcServices.Clipboard.service,
		method: UniverseAgentGrpcServices.Clipboard.Clear,
		methodKey: 'ClipboardService.Clear',
	},
	readContextVariable: {
		service: UniverseAgentGrpcServices.ContextVariable.service,
		method: UniverseAgentGrpcServices.ContextVariable.Read,
		methodKey: 'ContextVariableService.Read',
	},
	restoreSnapshot: {
		service: UniverseAgentGrpcServices.Agent.service,
		method: UniverseAgentGrpcServices.Agent.RestoreSnapshot,
		methodKey: 'AgentService.RestoreSnapshot',
	},
	deleteSnapshot: {
		service: UniverseAgentGrpcServices.Agent.service,
		method: UniverseAgentGrpcServices.Agent.DeleteSnapshot,
		methodKey: 'AgentService.DeleteSnapshot',
	},
	readGitChanges: {
		service: UniverseAgentGrpcServices.Git.service,
		method: UniverseAgentGrpcServices.Git.ReadGitChanges,
		methodKey: 'GitService.ReadGitChanges',
	},
};

export interface GrpcCapabilityProbeInput {
	readonly methods: readonly string[];
	readonly transport: IUniverseAgentGrpcTransport;
}

/**
 * Handshake may advertise `FooService.*` as a wildcard for every method on that
 * service. Exact `FooService.Bar` still matches only itself.
 */
export function isAdvertisedMethod(methods: ReadonlySet<string> | readonly string[], methodKey: string): boolean {
	const methodSet = methods instanceof Set ? methods : new Set(methods);
	if (methodSet.has(methodKey)) {
		return true;
	}
	const dot = methodKey.indexOf('.');
	if (dot <= 0) {
		return false;
	}
	return methodSet.has(`${methodKey.slice(0, dot)}.*`);
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
		if (!isAdvertisedMethod(methodSet, target.methodKey)) {
			snapshot[key] = {
				support: 'UNSUPPORTED',
				reason: key === 'providerConfig' ? PROVIDER_CONFIG_UNSUPPORTED_REASON : 'method not advertised',
			};
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

	return snapshot;
}

/**
 * Session.List three-state for Navigator. Not a {@link UniverseAgentCapabilityKey}
 * (Engine Overview must not gain a sessionList row).
 */
export async function probeSessionListCapability(input: GrpcCapabilityProbeInput): Promise<UniverseAgentCapabilityEntry> {
	if (!isAdvertisedMethod(input.methods, UniverseAgentSessionListMethodKey)) {
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

const GIT_WRITE_PROBE_TARGETS: Record<keyof UniverseAgentGitWriteCapability, { service: string; method: string; methodKey: string }> = {
	writeGitStagePaths: {
		service: UniverseAgentGrpcServices.Git.service,
		method: UniverseAgentGrpcServices.Git.WriteGitStagePaths,
		methodKey: 'GitService.WriteGitStagePaths',
	},
	writeGitCommit: {
		service: UniverseAgentGrpcServices.Git.service,
		method: UniverseAgentGrpcServices.Git.WriteGitCommit,
		methodKey: 'GitService.WriteGitCommit',
	},
	writeGitApplyHunks: {
		service: UniverseAgentGrpcServices.Git.service,
		method: UniverseAgentGrpcServices.Git.WriteGitApplyHunks,
		methodKey: 'GitService.WriteGitApplyHunks',
	},
};

async function probeAdvertisedSupport(
	input: GrpcCapabilityProbeInput,
	target: { service: string; method: string; methodKey: string },
): Promise<UniverseAgentCapabilitySupport> {
	if (!isAdvertisedMethod(input.methods, target.methodKey)) {
		return 'UNSUPPORTED';
	}
	const status = await input.transport.probeRpc(target.service, target.method);
	if (status === GrpcStatusCode.UNIMPLEMENTED) {
		return 'UNSUPPORTED';
	}
	if (status === GrpcStatusCode.OK) {
		return 'SUPPORTED';
	}
	return 'UNKNOWN';
}

/**
 * Sources Stage / Commit / Accept. Not a {@link UniverseAgentCapabilityKey}
 * (Engine Overview must not gain git-write rows).
 */
export async function probeGitWriteCapability(input: GrpcCapabilityProbeInput): Promise<UniverseAgentGitWriteCapability> {
	const keys = Object.keys(GIT_WRITE_PROBE_TARGETS) as (keyof UniverseAgentGitWriteCapability)[];
	const support: { -readonly [K in keyof UniverseAgentGitWriteCapability]?: UniverseAgentCapabilitySupport } = {};
	for (const key of keys) {
		support[key] = await probeAdvertisedSupport(input, GIT_WRITE_PROBE_TARGETS[key]);
	}
	return support as UniverseAgentGitWriteCapability;
}

const CONVERSATION_ENTRY_PROBE_TARGETS: Partial<Record<keyof UniverseAgentConversationEntryCapability, { service: string; method: string; methodKey: string }>> = {
	listClipboard: {
		service: UniverseAgentGrpcServices.Clipboard.service,
		method: UniverseAgentGrpcServices.Clipboard.List,
		methodKey: 'ClipboardService.List',
	},
	listTriggers: {
		service: UniverseAgentGrpcServices.Trigger.service,
		method: UniverseAgentGrpcServices.Trigger.ListTriggers,
		methodKey: 'TriggerService.ListTriggers',
	},
	listContextVariable: {
		service: UniverseAgentGrpcServices.ContextVariable.service,
		method: UniverseAgentGrpcServices.ContextVariable.List,
		methodKey: 'ContextVariableService.List',
	},
	listSnapshots: {
		service: UniverseAgentGrpcServices.Agent.service,
		method: UniverseAgentGrpcServices.Agent.ListSnapshots,
		methodKey: 'AgentService.ListSnapshots',
	},
	listDevices: {
		service: UniverseAgentGrpcServices.Device.service,
		method: UniverseAgentGrpcServices.Device.ListDevices,
		methodKey: 'DeviceService.ListDevices',
	},
	listPending: {
		service: UniverseAgentGrpcServices.Device.service,
		method: UniverseAgentGrpcServices.Device.ListPending,
		methodKey: 'DeviceService.ListPending',
	},
	pairApprove: {
		service: UniverseAgentGrpcServices.Device.service,
		method: UniverseAgentGrpcServices.Device.PairApprove,
		methodKey: 'DeviceService.PairApprove',
	},
	pairReject: {
		service: UniverseAgentGrpcServices.Device.service,
		method: UniverseAgentGrpcServices.Device.PairReject,
		methodKey: 'DeviceService.PairReject',
	},
	rotateToken: {
		service: UniverseAgentGrpcServices.Device.service,
		method: UniverseAgentGrpcServices.Device.RotateToken,
		methodKey: 'DeviceService.RotateToken',
	},
	revoke: {
		service: UniverseAgentGrpcServices.Device.service,
		method: UniverseAgentGrpcServices.Device.Revoke,
		methodKey: 'DeviceService.Revoke',
	},
	getPluginInfo: {
		service: UniverseAgentGrpcServices.Plugin.service,
		method: UniverseAgentGrpcServices.Plugin.Info,
		methodKey: 'PluginService.Info',
	},
	getMcpServerTools: {
		service: UniverseAgentGrpcServices.Mcp.service,
		method: UniverseAgentGrpcServices.Mcp.GetMcpServerTools,
		methodKey: 'McpService.GetMcpServerTools',
	},
	setSessionGoal: {
		service: UniverseAgentGrpcServices.Permission.service,
		method: UniverseAgentGrpcServices.Permission.SetSessionGoal,
		methodKey: 'PermissionService.SetSessionGoal',
	},
	setPermissionMode: {
		service: UniverseAgentGrpcServices.Permission.service,
		method: UniverseAgentGrpcServices.Permission.SetPermissionMode,
		methodKey: 'PermissionService.SetPermissionMode',
	},
	switchModel: {
		service: UniverseAgentGrpcServices.Config.service,
		method: UniverseAgentGrpcServices.Config.SwitchModel,
		methodKey: 'ConfigService.SwitchModel',
	},
};

/**
 * Conversation list / button gates. Not a {@link UniverseAgentCapabilityKey}
 * (Engine Overview must not gain these rows). `switchAgent` has no handshake
 * method and is UNSUPPORTED without probeRpc.
 */
export async function probeConversationEntryCapability(input: GrpcCapabilityProbeInput): Promise<UniverseAgentConversationEntryCapability> {
	const support = {} as { -readonly [K in keyof UniverseAgentConversationEntryCapability]: UniverseAgentCapabilitySupport };
	for (const key of UNIVERSE_AGENT_CONVERSATION_ENTRY_KEYS) {
		const target = CONVERSATION_ENTRY_PROBE_TARGETS[key];
		support[key] = target ? await probeAdvertisedSupport(input, target) : 'UNSUPPORTED';
	}
	return support;
}

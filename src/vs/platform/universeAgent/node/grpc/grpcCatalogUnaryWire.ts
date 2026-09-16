/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentAgentProfileDetail,
	UniverseAgentClearProviderCredentialsRequest,
	UniverseAgentDeleteProjectRuleRequest,
	UniverseAgentEditQueueItemRequest,
	UniverseAgentEnqueueQueueItemRequest,
	UniverseAgentGetCommandDefRequest,
	UniverseAgentHoldQueueItemRequest,
	UniverseAgentInsertQueueItemRequest,
	UniverseAgentListProjectRulesRequest,
	UniverseAgentCancelSessionGoalRequest,
	UniverseAgentListSessionsRequest,
	UniverseAgentProjectRule,
	UniverseAgentQueueHoldReason,
	UniverseAgentQueueItemRefRequest,
	UniverseAgentQueueMutationResult,
	UniverseAgentQueuePriority,
	UniverseAgentQueueRefRequest,
	UniverseAgentReorderQueueRequest,
	UniverseAgentPromotePermissionRuleResult,
	UniverseAgentRespondPermissionRequest,
	UniverseAgentSetQueueItemForkAnchorRequest,
	UniverseAgentSetQueueItemLockedRequest,
	UniverseAgentSetSessionGoalRequest,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSwitchModelRequest,
	UniverseAgentSwitchModelResult,
	UniverseAgentSyncPermissionRuleResult,
	UniverseAgentToolInfoRequest,
	UniverseAgentUpsertProjectRuleRequest,
	UniverseAgentUpsertProviderCredentialsRequest,
} from '../../common/universeAgentTypes.js';
import type {
	DeleteAgentProfileResponseWire,
	DeleteProjectRuleResponseWire,
	DeviceInfoWire,
	GetCommandDefResponseWire,
	ListAgentProfilesResponseWire,
	ListCommandsResponseWire,
	ListDevicesResponseWire,
	ListHookPointsResponseWire,
	ListModelsResponseWire,
	ListProjectRulesResponseWire,
	ListProviderStatusResponseWire,
	ListSkillsResponseWire,
	ListToolsResponseWire,
	ProjectRuleWire,
	ProviderStatusWire,
	ResetAgentProfileResponseWire,
	SaveAgentProfileResponseWire,
	SetSkillEnabledResponseWire,
	SkillInfoResponseWire,
	ToolInfoResponseWire,
} from './grpcClientMappersCatalog.js';
import type { AgentInfoWire, AgentTreeResponseWire, GetSessionRulesResponseWire, ListAgentsResponseWire, ListSessionsResponseWire, SessionInfoResponseWire, SessionRuleWire } from './grpcClientMappersSession.js';
import type {
	BlackboardTaskWire,
	ListTeamsResponseWire,
	MemberInfoWire,
	MemberStatusResponseWire,
	TaskListResponseWire,
	TeamInfoResponseWire,
} from './grpcClientMappersTeam.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * proto3 empty message. gRPC still writes a DATA frame (5-byte prefix + 0
 * payload). Callers must pass this to `makeUnaryBytesClient` — never skip
 * `sendMessage` for empty `{}` (that yields "received none").
 */
export const EMPTY_PROTO_MESSAGE = new Uint8Array(0);

const AGENT_STATUS_NAMES = [
	'AGENT_STATUS_UNKNOWN',
	'AGENT_STATUS_PENDING',
	'AGENT_STATUS_WAITING',
	'AGENT_STATUS_GENERATING',
	'AGENT_STATUS_PAUSED',
	'AGENT_STATUS_ERROR',
	'AGENT_STATUS_COMPLETED',
	'AGENT_STATUS_TIMEOUT',
] as const;

const AGENT_TYPE_NAMES = [
	'AGENT_TYPE_ROOT',
	'AGENT_TYPE_SUB',
	'AGENT_TYPE_MEMBER',
	'AGENT_TYPE_ADVISE',
] as const;

export function encodeEmptyProtoMessage(): Uint8Array {
	return EMPTY_PROTO_MESSAGE;
}

/**
 * Connect-time capability probe. Status-only; empty proto3, never JSON `{}`.
 * MemberStatus / ListTools / ListSkills still accept default-empty proto3.
 */
export function encodeProbeRpcRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

/** proto SessionListFilter.SESSION_LIST_FILTER_ALL — default so List is not RECENT-only. */
export const SESSION_LIST_FILTER_ALL = 4;

export function encodeListSessionsRequest(request: UniverseAgentListSessionsRequest): Uint8Array {
	return Buffer.concat([
		encodeInt32Field(1, request.limit),
		encodeInt32Field(2, request.offset),
		encodeInt32Field(4, request.filter ?? SESSION_LIST_FILTER_ALL),
	]);
}

export function decodeListSessionsResponse(bytes: Uint8Array): ListSessionsResponseWire {
	const fields = readProtoFields(bytes);
	const sessions = allLengthDelimited(fields, 1).map(decodeSessionSummary);
	const total = lastVarint(fields, 2);
	return {
		sessions,
		...(total !== undefined ? { total_count: Number(total) } : {}),
	};
}

export function encodeListAgentProfilesRequest(projectPath: string | undefined): Uint8Array {
	return encodeStringField(1, projectPath);
}

export function decodeListAgentProfilesResponse(bytes: Uint8Array): ListAgentProfilesResponseWire {
	return {
		profiles: allLengthDelimited(readProtoFields(bytes), 1).map(decodeAgentProfile),
	};
}

export function encodeListDevicesRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

export function decodeListDevicesResponse(bytes: Uint8Array): ListDevicesResponseWire {
	return {
		devices: allLengthDelimited(readProtoFields(bytes), 1).map(decodeDeviceInfo),
	};
}

export function encodeListModelsRequest(): Uint8Array {
	// ListModelsRequest.include_disabled = 2; proto3 default false, so true must be on the wire.
	return encodeInt32Field(2, 1);
}

export function decodeListModelsResponse(bytes: Uint8Array): ListModelsResponseWire {
	return {
		models: allLengthDelimited(readProtoFields(bytes), 1).map(decodeModelEntry),
	};
}

export function encodeListAgentsRequest(sessionId: string): Uint8Array {
	return encodeStringField(1, sessionId);
}

export function decodeListAgentsResponse(bytes: Uint8Array): ListAgentsResponseWire {
	return {
		agents: allLengthDelimited(readProtoFields(bytes), 1).map(decodeAgentInfo),
	};
}

export function encodeAgentTreeRequest(sessionId: string): Uint8Array {
	return encodeStringField(1, sessionId);
}

export function decodeAgentTreeResponse(bytes: Uint8Array): AgentTreeResponseWire {
	const root = lastBytes(readProtoFields(bytes), 1);
	return { root: root ? decodeAgentInfo(root) : undefined };
}

function decodeSessionSummary(bytes: Uint8Array): NonNullable<ListSessionsResponseWire['sessions']>[number] {
	const fields = readProtoFields(bytes);
	const status = lastVarint(fields, 2);
	const workDir = lastString(fields, 9);
	return {
		session_id: lastString(fields, 1) ?? '',
		status: enumName(AGENT_STATUS_NAMES, status),
		created_at: numberOrUndefined(lastVarint(fields, 3)),
		last_accessed_at: numberOrUndefined(lastVarint(fields, 4)),
		turn_count: numberOrUndefined(lastVarint(fields, 5)),
		model: lastString(fields, 6),
		title: lastString(fields, 7),
		...(workDir ? { work_dir: workDir } : {}),
	};
}

export function encodeSessionInfoRequest(sessionId: string): Uint8Array {
	return encodeStringField(1, sessionId);
}

/** DeleteSessionRequest.session_id = 1 — same encoder as Session.Info / Resume. */
export function encodeDeleteSessionRequest(sessionId: string): Uint8Array {
	return encodeSessionInfoRequest(sessionId);
}

/** SetPermissionModeRequest.session_id = 1, mode = 2 (SessionToolPermissionModeProto varint). */
export function encodeSetPermissionModeRequest(sessionId: string, mode: number): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, sessionId),
		encodeInt32Field(2, mode),
	]);
}

/** Permission.SetSessionGoal — `session_id` = 1, `goal` = 2. Response is success=1 / error=2 (same tags as Resume). */
export function encodeSetSessionGoalRequest(request: UniverseAgentSetSessionGoalRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.goal),
	]);
}

/** Permission.CancelSessionGoal — `session_id` = 1. Response is success=1 / error=2 (same tags as Resume). */
export function encodeCancelSessionGoalRequest(request: UniverseAgentCancelSessionGoalRequest): Uint8Array {
	return encodeSessionInfoRequest(request.sessionId);
}

/**
 * Permission.Respond — `session_id` = 1, `request_id` = 2, `granted` = 3, `metadata_json` = 4.
 * proto3: empty strings omitted; `granted` false (default) omitted.
 */
export function encodeRespondPermissionRequest(request: UniverseAgentRespondPermissionRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.requestId),
		encodeInt32Field(3, request.granted === true ? 1 : 0),
		encodeStringField(4, request.metadataJson),
	]);
}

/**
 * Permission.SyncPermissionRule — `session_id` = 1, `tool_name` = 2, `scope` = 3,
 * `action` = 4 (RuleAction varint via `permissionRuleActionWire`), `reason` = 5.
 * proto3: empty strings / 0 omitted.
 */
export function encodeSyncPermissionRuleRequest(sessionId: string, toolName: string, scope: string, action: number, reason: string): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, sessionId),
		encodeStringField(2, toolName),
		encodeStringField(3, scope),
		encodeInt32Field(4, action),
		encodeStringField(5, reason),
	]);
}

/** SyncRuleResponse — `success` = 1, `rule_id` = 2. Unknown fields unread. */
export function decodeSyncPermissionRuleResponse(bytes: Uint8Array): UniverseAgentSyncPermissionRuleResult {
	const fields = readProtoFields(bytes);
	return {
		ok: lastVarint(fields, 1) === 1n,
		ruleId: lastString(fields, 2) ?? '',
	};
}

/**
 * Permission.PromotePermissionRule — `tool_name` = 1, `scope` = 2, `action` = 3 (RuleAction).
 * proto3: empty strings / 0 omitted.
 */
export function encodePromotePermissionRuleRequest(toolName: string, scope: string, action: number): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, toolName),
		encodeStringField(2, scope),
		encodeInt32Field(3, action),
	]);
}

/** PromoteRuleResponse — `success` = 1. Unknown fields unread. */
export function decodePromotePermissionRuleResponse(bytes: Uint8Array): UniverseAgentPromotePermissionRuleResult {
	return {
		ok: lastVarint(readProtoFields(bytes), 1) === 1n,
	};
}

/** Permission.GetSessionRules — `session_id` = 1. Empty omitted. */
export function encodeGetSessionRulesRequest(sessionId: string): Uint8Array {
	return encodeSessionInfoRequest(sessionId);
}

/**
 * GetSessionRulesResponse — repeated `SessionRule rules` = 1.
 * SessionRule: `id`=1 `tool_name`=2 `scope`=3 `action`=4 `reason`=5
 * `created_at`=6 `expires_at`=7 `source`=8. Unknown fields unread.
 */
export function decodeGetSessionRulesResponse(bytes: Uint8Array): GetSessionRulesResponseWire {
	return {
		rules: allLengthDelimited(readProtoFields(bytes), 1).map(decodeSessionRule),
	};
}

function decodeSessionRule(bytes: Uint8Array): SessionRuleWire {
	const fields = readProtoFields(bytes);
	const expiresAt = numberOrUndefined(lastVarint(fields, 7));
	return {
		id: lastString(fields, 1) ?? '',
		tool_name: lastString(fields, 2) ?? '',
		scope: lastString(fields, 3) ?? '',
		action: numberOrUndefined(lastVarint(fields, 4)),
		reason: lastString(fields, 5) ?? '',
		created_at: numberOrUndefined(lastVarint(fields, 6)),
		...(expiresAt !== undefined ? { expires_at: expiresAt } : {}),
		source: numberOrUndefined(lastVarint(fields, 8)),
	};
}

/**
 * SwitchModelRequest.session_id = 1, agent_id = 2;
 * oneof target.model_type = 10 / model_id = 11 (not sequential 3/4).
 */
export function encodeSwitchModelRequest(request: UniverseAgentSwitchModelRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(10, request.modelType),
		encodeStringField(11, request.modelId),
	]);
}

export function decodeSwitchModelResponse(bytes: Uint8Array): UniverseAgentSwitchModelResult {
	const fields = readProtoFields(bytes);
	return {
		resolvedModelId: lastString(fields, 1) ?? '',
		provider: lastString(fields, 2) ?? '',
		level: numberOrUndefined(lastVarint(fields, 3)) ?? 0,
		cost: lastString(fields, 4) ?? '',
		speed: lastString(fields, 5) ?? '',
	};
}

export function decodeSessionInfoResponse(bytes: Uint8Array): SessionInfoResponseWire {
	const fields = readProtoFields(bytes);
	const root = lastBytes(fields, 2);
	const workDir = lastString(fields, 7);
	return {
		session_id: lastString(fields, 1) ?? '',
		root_agent: root ? decodeAgentInfo(root) : undefined,
		created_at: numberOrUndefined(lastVarint(fields, 3)),
		last_accessed_at: numberOrUndefined(lastVarint(fields, 4)),
		provider: lastString(fields, 5),
		model: lastString(fields, 6),
		...(workDir ? { work_dir: workDir } : {}),
	};
}

function decodeModelEntry(bytes: Uint8Array): NonNullable<ListModelsResponseWire['models']>[number] {
	const fields = readProtoFields(bytes);
	const level = lastVarint(fields, 4);
	return {
		id: lastString(fields, 1) ?? '',
		type: lastString(fields, 2) ?? '',
		enabled: lastVarint(fields, 3) === 1n,
		level: level === undefined ? undefined : Number(level),
		description: lastString(fields, 5),
		cost: lastString(fields, 6),
		speed: lastString(fields, 7),
		provider: lastString(fields, 8),
		model_id: lastString(fields, 9),
	};
}

function decodeAgentInfo(bytes: Uint8Array): AgentInfoWire {
	const fields = readProtoFields(bytes);
	return {
		agent_id: lastString(fields, 1) ?? '',
		name: lastString(fields, 2) ?? '',
		type: enumName(AGENT_TYPE_NAMES, lastVarint(fields, 3)) ?? AGENT_TYPE_NAMES[0],
		status: enumName(AGENT_STATUS_NAMES, lastVarint(fields, 4)) ?? 'AGENT_STATUS_UNKNOWN',
		model: lastString(fields, 5) ?? '',
		turn_count: numberOrUndefined(lastVarint(fields, 6)) ?? 0,
		created_at: numberOrUndefined(lastVarint(fields, 7)) ?? 0,
		children: allLengthDelimited(fields, 8).map(decodeAgentInfo),
	};
}

function decodeAgentProfile(bytes: Uint8Array): NonNullable<ListAgentProfilesResponseWire['profiles']>[number] {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1) ?? '',
		name: lastString(fields, 2) ?? '',
		description: lastString(fields, 3),
		system_prompt: lastString(fields, 4),
		disabled_tools: allLengthDelimited(fields, 5).map(value => Buffer.from(value).toString('utf8')),
		enabled_tools: allLengthDelimited(fields, 6).map(value => Buffer.from(value).toString('utf8')),
		permission_mode: lastString(fields, 7),
		whitelist_mode: lastVarint(fields, 10) === 1n,
		summary: lastString(fields, 11),
		usage: lastString(fields, 12),
		detail_level: lastString(fields, 13),
		source: lastString(fields, 14),
		enabled: lastVarint(fields, 15) === 1n,
		builtin_default: lastVarint(fields, 16) === 1n,
		model: lastString(fields, 17),
		model_type: lastString(fields, 18),
		...omitZeroMaxTurns(numberOrUndefined(lastVarint(fields, 19))),
	};
}

export function encodeSaveAgentProfileRequest(profile: UniverseAgentAgentProfileDetail): Uint8Array {
	return encodeMessageField(1, encodeAgentProfile(profile));
}

export function decodeSaveAgentProfileResponse(bytes: Uint8Array): SaveAgentProfileResponseWire {
	const profile = lastBytes(readProtoFields(bytes), 1);
	return { profile: profile ? decodeAgentProfile(profile) : undefined };
}

export function encodeResetAgentProfileRequest(id: string): Uint8Array {
	return encodeStringField(1, id);
}

export function decodeResetAgentProfileResponse(bytes: Uint8Array): ResetAgentProfileResponseWire {
	const fields = readProtoFields(bytes);
	const profile = lastBytes(fields, 2);
	return {
		success: lastVarint(fields, 1) === 1n,
		profile: profile ? decodeAgentProfile(profile) : undefined,
	};
}

export function encodeListProviderStatusRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

export function decodeListProviderStatusResponse(bytes: Uint8Array): ListProviderStatusResponseWire {
	return {
		providers: allLengthDelimited(readProtoFields(bytes), 1).map(decodeProviderStatus),
	};
}

export function encodeUpsertProviderCredentialsRequest(request: UniverseAgentUpsertProviderCredentialsRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.providerId),
		encodeStringField(2, request.apiKey),
		encodeStringField(3, request.baseUrl),
		encodeStringField(4, request.protocol),
	]);
}

export function encodeClearProviderCredentialsRequest(request: UniverseAgentClearProviderCredentialsRequest): Uint8Array {
	return encodeStringField(1, request.providerId);
}

export function decodeProviderStatus(bytes: Uint8Array): ProviderStatusWire {
	const fields = readProtoFields(bytes);
	return {
		provider_id: lastString(fields, 1) ?? '',
		brand: lastString(fields, 2) ?? '',
		protocol: lastString(fields, 3) ?? '',
		configured: lastVarint(fields, 4) === 1n,
		credential_source: lastString(fields, 5) ?? '',
		has_base_url: lastVarint(fields, 6) === 1n,
		enabled: lastVarint(fields, 7) === 1n,
	};
}

export function encodeListProjectRulesRequest(request: UniverseAgentListProjectRulesRequest): Uint8Array {
	return Buffer.concat([
		encodeInt32Field(1, request.scope),
		encodeStringField(2, request.sessionId),
	]);
}

export function decodeListProjectRulesResponse(bytes: Uint8Array): ListProjectRulesResponseWire {
	return {
		rules: allLengthDelimited(readProtoFields(bytes), 1).map(decodeProjectRule),
	};
}

export function encodeUpsertProjectRuleRequest(request: UniverseAgentUpsertProjectRuleRequest): Uint8Array {
	return Buffer.concat([
		encodeInt32Field(1, request.scope),
		encodeStringField(2, request.sessionId),
		encodeMessageField(3, encodeProjectRule(request.rule)),
	]);
}

export function decodeProjectRuleResponse(bytes: Uint8Array): ProjectRuleWire {
	return decodeProjectRule(bytes);
}

export function encodeDeleteProjectRuleRequest(request: UniverseAgentDeleteProjectRuleRequest): Uint8Array {
	return Buffer.concat([
		encodeInt32Field(1, request.scope),
		encodeStringField(2, request.sessionId),
		encodeStringField(3, request.id),
	]);
}

export function decodeDeleteProjectRuleResponse(bytes: Uint8Array): DeleteProjectRuleResponseWire {
	return { deleted: lastVarint(readProtoFields(bytes), 1) === 1n };
}

export function encodeListHookPointsRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

export function decodeListHookPointsResponse(bytes: Uint8Array): ListHookPointsResponseWire {
	const fields = readProtoFields(bytes);
	return {
		points: allLengthDelimited(fields, 1).map(decodeHookPoint),
		catalog_revision: lastString(fields, 2),
	};
}

export function encodeListTeamsRequest(sessionId: string): Uint8Array {
	return encodeStringField(1, sessionId);
}

/** Team.MemberStatus / TaskList — `session_id` = 1, `agent_id` = 2. */
export function encodeMemberStatusRequest(sessionId: string, agentId: string): Uint8Array {
	return encodeSessionAgentIdRequest(sessionId, agentId);
}

export function encodeTaskListRequest(sessionId: string, agentId: string): Uint8Array {
	return encodeSessionAgentIdRequest(sessionId, agentId);
}

/** Team.TeamInfo — `session_id` = 1, `agent_id` = 2, `team_id` = 3. */
export function encodeTeamInfoRequest(sessionId: string, agentId: string, teamId: number): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, sessionId),
		encodeStringField(2, agentId),
		encodeInt32Field(3, teamId),
	]);
}

export function decodeMemberStatusResponse(bytes: Uint8Array): MemberStatusResponseWire {
	return {
		members: allLengthDelimited(readProtoFields(bytes), 1).map(decodeMemberInfo),
	};
}

export function decodeTaskListResponse(bytes: Uint8Array): TaskListResponseWire {
	return {
		tasks: allLengthDelimited(readProtoFields(bytes), 1).map(decodeBlackboardTask),
	};
}

/** TeamInfoResponse — `team_id` = 1, `status` = 4 (members=2 / tasks=3 unused by this client). */
export function decodeTeamInfoResponse(bytes: Uint8Array): TeamInfoResponseWire {
	const fields = readProtoFields(bytes);
	const teamId = lastVarint(fields, 1);
	return {
		...(teamId !== undefined ? { team_id: Number(teamId) } : {}),
		status: lastString(fields, 4),
	};
}

function encodeSessionAgentIdRequest(sessionId: string, agentId: string): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, sessionId),
		encodeStringField(2, agentId),
	]);
}

function decodeMemberInfo(bytes: Uint8Array): MemberInfoWire {
	const fields = readProtoFields(bytes);
	return {
		member_name: lastString(fields, 1) ?? '',
		member_agent_id: lastString(fields, 2) ?? '',
		status: lastString(fields, 3) ?? '',
		preset: lastString(fields, 4),
		// proto `bool dynamic = 5`; mapper keeps a string.
		dynamic: lastVarint(fields, 5) === 1n ? 'true' : '',
		turn_count: numberOrUndefined(lastVarint(fields, 6)),
	};
}

function decodeBlackboardTask(bytes: Uint8Array): BlackboardTaskWire {
	const fields = readProtoFields(bytes);
	return {
		task_id: lastString(fields, 1) ?? '',
		owner: lastString(fields, 2) ?? '',
		description: lastString(fields, 3) ?? '',
		status: lastString(fields, 4) ?? '',
		blocked_by: lastString(fields, 5),
		last_message: lastString(fields, 6),
		subject: lastString(fields, 7) ?? '',
	};
}

export function decodeListTeamsResponse(bytes: Uint8Array): ListTeamsResponseWire {
	return {
		teams: allLengthDelimited(readProtoFields(bytes), 1).map(decodeTeamListEntry),
	};
}

function decodeDeviceInfo(bytes: Uint8Array): DeviceInfoWire {
	const fields = readProtoFields(bytes);
	return {
		device_id: lastString(fields, 1) ?? '',
		display_name: lastString(fields, 2) ?? '',
		role: lastString(fields, 3) ?? '',
		platform: lastString(fields, 4) ?? '',
		paired_at: numberOrUndefined(lastVarint(fields, 5)),
		last_seen_at: numberOrUndefined(lastVarint(fields, 6)),
		active: lastVarint(fields, 7) === 1n,
	};
}

function enumName(names: readonly string[], value: bigint | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	return names[Number(value)] ?? names[0];
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

function omitZeroMaxTurns(value: number | undefined): { max_turns?: number } {
	if (value === undefined || value <= 0) {
		return {};
	}
	return { max_turns: value };
}

function encodeRepeatedString(field: number, values: readonly string[] | undefined): Buffer {
	if (!values || values.length === 0) {
		return Buffer.alloc(0);
	}
	return Buffer.concat(values.map(value => encodeStringField(field, value)));
}

function encodeAgentProfileSource(source: UniverseAgentAgentProfileDetail['source']): string | undefined {
	switch (source) {
		case 'built_in':
			return 'BUILT_IN';
		case 'user':
			return 'USER';
		case 'project':
			return 'PROJECT';
		default:
			return undefined;
	}
}

function encodeAgentProfile(profile: UniverseAgentAgentProfileDetail): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, profile.id),
		encodeStringField(2, profile.name),
		encodeStringField(3, profile.description),
		encodeStringField(4, profile.systemPrompt),
		encodeRepeatedString(5, profile.disabledTools),
		encodeRepeatedString(6, profile.enabledTools),
		encodeStringField(7, profile.permissionMode),
		encodeInt32Field(10, profile.whitelistMode ? 1 : 0),
		encodeStringField(11, profile.summary),
		encodeStringField(12, profile.usage),
		encodeStringField(13, profile.detailLevel),
		encodeStringField(14, encodeAgentProfileSource(profile.source)),
		encodeInt32Field(15, profile.enabled ? 1 : 0),
		encodeInt32Field(16, profile.builtinDefault ? 1 : 0),
		encodeStringField(17, profile.model),
		encodeStringField(18, profile.modelType),
		encodeInt32Field(19, profile.maxTurns && profile.maxTurns > 0 ? profile.maxTurns : 0),
	]);
}

function encodeProjectRule(rule: UniverseAgentProjectRule): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, rule.id),
		encodeStringField(2, rule.title),
		encodeInt32Field(3, rule.enabled ? 1 : 0),
		encodeInt32Field(4, rule.priority),
		encodeStringField(5, rule.body),
		encodeInt32Field(6, rule.scope),
		encodeRepeatedString(7, rule.globs),
		encodeRepeatedString(8, rule.appliesTo),
	]);
}

function decodeProjectRule(bytes: Uint8Array): ProjectRuleWire {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1) ?? '',
		title: lastString(fields, 2) ?? '',
		enabled: lastVarint(fields, 3) === 1n,
		priority: numberOrUndefined(lastVarint(fields, 4)),
		body: lastString(fields, 5) ?? '',
		scope: numberOrUndefined(lastVarint(fields, 6)),
		globs: allLengthDelimited(fields, 7).map(value => Buffer.from(value).toString('utf8')),
		applies_to: allLengthDelimited(fields, 8).map(value => Buffer.from(value).toString('utf8')),
	};
}

function decodeHookPoint(bytes: Uint8Array): { id?: string; family?: string; method_name?: string; installed_count?: number } {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1) ?? '',
		family: lastString(fields, 2) ?? '',
		method_name: lastString(fields, 3) ?? '',
		installed_count: numberOrUndefined(lastVarint(fields, 4)),
	};
}

function decodeTeamListEntry(bytes: Uint8Array): { team_id?: number; status?: string; manager_agent_id?: string } {
	const fields = readProtoFields(bytes);
	return {
		team_id: numberOrUndefined(lastVarint(fields, 1)),
		status: lastString(fields, 2) ?? '',
		manager_agent_id: lastString(fields, 3) ?? '',
	};
}

/** QueueItemHoldReasonProto: QIH_NONE=0, QIH_EDITING=1. proto3 default 0 omitted. */
export function queueHoldReasonWire(reason: UniverseAgentQueueHoldReason): number {
	return reason === 'EDITING' ? 1 : 0;
}

/** QueuePriorityProto: QP_NORMAL=0, QP_HIGH=1, QP_LOW=2. proto3 default 0 omitted. */
export function queuePriorityWire(priority: UniverseAgentQueuePriority | undefined): number {
	switch (priority) {
		case 'HIGH':
			return 1;
		case 'LOW':
			return 2;
		default:
			return 0;
	}
}

/** QueueRefRequest: session_id=1, op_id=2. Empty strings omitted (proto3). */
export function encodeQueueRefRequest(request: UniverseAgentQueueRefRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.opId),
	]);
}

/**
 * QueueItemRefRequest: session_id=1, item_id=2, op_id=3.
 * JSON helper key order was session_id/op_id/item_id — bytes must not use that as tags.
 */
export function encodeQueueItemRefRequest(request: UniverseAgentQueueItemRefRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.itemId),
		encodeStringField(3, request.opId),
	]);
}

/**
 * EnqueueQueueItemRequest: 1 session_id, 2 op_id, 3 client_message_id, 4 text, 5 QueuePriorityProto.
 * TS has no await_attachment_upload / pending_upload_count — do not invent fields 6/7.
 */
export function encodeEnqueueQueueItemRequest(request: UniverseAgentEnqueueQueueItemRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.opId),
		encodeStringField(3, request.clientMessageId),
		encodeStringField(4, request.text),
		encodeInt32Field(5, queuePriorityWire(request.priority)),
	]);
}

/**
 * InsertQueueItemRequest: 1–5 same as Enqueue, 6 before_item_id.
 * TS has no await_attachment_upload / pending_upload_count — omit 7/8.
 */
export function encodeInsertQueueItemRequest(request: UniverseAgentInsertQueueItemRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.opId),
		encodeStringField(3, request.clientMessageId),
		encodeStringField(4, request.text),
		encodeInt32Field(5, queuePriorityWire(request.priority)),
		encodeStringField(6, request.beforeItemId),
	]);
}

/** ReorderQueueRequest: 1 session_id, 2 op_id, 3 repeated item_ids. Empty strings omitted. */
export function encodeReorderQueueRequest(request: UniverseAgentReorderQueueRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.opId),
		encodeRepeatedString(3, request.itemIds),
	]);
}

/** SetQueueItemLockedRequest: 1–3 same as item ref, 4 locked (false omitted). */
export function encodeSetQueueItemLockedRequest(request: UniverseAgentSetQueueItemLockedRequest): Uint8Array {
	return Buffer.concat([
		encodeQueueItemRefRequest(request),
		encodeInt32Field(4, request.locked === true ? 1 : 0),
	]);
}

/** SetQueueItemForkAnchorRequest: 1–3 same as item ref, 4 fork_from_turn_id, 5 fork_from_preview. */
export function encodeSetQueueItemForkAnchorRequest(request: UniverseAgentSetQueueItemForkAnchorRequest): Uint8Array {
	return Buffer.concat([
		encodeQueueItemRefRequest(request),
		encodeStringField(4, request.forkFromTurnId),
		encodeStringField(5, request.forkFromPreview),
	]);
}

/** HoldQueueItemRequest: 1–3 same as item ref, 4 QueueItemHoldReasonProto. */
export function encodeHoldQueueItemRequest(request: UniverseAgentHoldQueueItemRequest): Uint8Array {
	return Buffer.concat([
		encodeQueueItemRefRequest(request),
		encodeInt32Field(4, queueHoldReasonWire(request.reason)),
	]);
}

/** EditQueueItemRequest: 1–3 same as item ref, 4 text. TS has no expected_version — omit field 5. */
export function encodeEditQueueItemRequest(request: UniverseAgentEditQueueItemRequest): Uint8Array {
	return Buffer.concat([
		encodeQueueItemRefRequest(request),
		encodeStringField(4, request.text),
	]);
}

/**
 * QueueMutationResponse: ok=1, error=2, op_id=3, item_id=4.
 * Field 5 ErrorDetail is unread (same as the old JSON client).
 */
export function decodeQueueMutationResponse(bytes: Uint8Array): UniverseAgentQueueMutationResult {
	const fields = readProtoFields(bytes);
	return {
		ok: lastVarint(fields, 1) === 1n,
		error: lastString(fields, 2),
		opId: lastString(fields, 3),
		itemId: lastString(fields, 4),
	};
}

/**
 * Tool.ListTools — ListToolsRequest `category`=1 `include_hidden`=2.
 * This client's `listTools()` does not pass either; proto3 omits both → empty.
 */
export function encodeListToolsRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

/**
 * ListToolsResponse — repeated `ToolSummary tools`=1, `total`=2.
 * ToolSummary: `name`=1 `description`=2 `category`=3 `destructive`=4 `requires_permission`=5.
 * Unknown fields unread.
 */
export function decodeListToolsResponse(bytes: Uint8Array): ListToolsResponseWire {
	const fields = readProtoFields(bytes);
	const total = lastVarint(fields, 2);
	return {
		tools: allLengthDelimited(fields, 1).map(decodeToolSummary),
		...(total !== undefined ? { total: Number(total) } : {}),
	};
}

function decodeToolSummary(bytes: Uint8Array): NonNullable<ListToolsResponseWire['tools']>[number] {
	const fields = readProtoFields(bytes);
	return {
		name: lastString(fields, 1) ?? '',
		description: lastString(fields, 2),
		category: lastString(fields, 3),
		destructive: lastVarint(fields, 4) === 1n,
		requires_permission: lastVarint(fields, 5) === 1n,
	};
}

/** Tool.ListSkills — ListSkillsRequest is empty. */
export function encodeListSkillsRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

/**
 * ListSkillsResponse — repeated `SkillSummary skills`=1, `total`=2.
 * SkillSummary: `name`=1 `description`=2 `source`=3 `slash_enabled`=4 `enabled`=5.
 * Unknown fields unread.
 */
export function decodeListSkillsResponse(bytes: Uint8Array): ListSkillsResponseWire {
	const fields = readProtoFields(bytes);
	const total = lastVarint(fields, 2);
	return {
		skills: allLengthDelimited(fields, 1).map(decodeSkillSummary),
		...(total !== undefined ? { total: Number(total) } : {}),
	};
}

function decodeSkillSummary(bytes: Uint8Array): NonNullable<ListSkillsResponseWire['skills']>[number] {
	const fields = readProtoFields(bytes);
	return {
		name: lastString(fields, 1) ?? '',
		description: lastString(fields, 2),
		source: lastString(fields, 3),
		slash_enabled: lastVarint(fields, 4) === 1n,
		enabled: lastVarint(fields, 5) === 1n,
	};
}

/** Tool.SkillInfo — SkillInfoRequest `skill_name`=1. Empty omitted. */
export function encodeSkillInfoRequest(request: UniverseAgentSkillInfoRequest): Uint8Array {
	return encodeStringField(1, request.skillName);
}

/**
 * SkillInfoResponse — `name`=1 `description`=2 `source`=3 `content`=4.
 * proto has no `enabled`; mapper keeps `enabled === true` → false when omitted.
 * Unknown fields unread.
 */
export function decodeSkillInfoResponse(bytes: Uint8Array): SkillInfoResponseWire {
	const fields = readProtoFields(bytes);
	return {
		name: lastString(fields, 1) ?? '',
		description: lastString(fields, 2),
		content: lastString(fields, 4) ?? '',
		source: lastString(fields, 3),
	};
}

/**
 * Tool.SetSkillEnabled — `skill_name`=1 `enabled`=2.
 * proto3: empty string / false omitted.
 */
export function encodeSetSkillEnabledRequest(request: UniverseAgentSetSkillEnabledRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.skillName),
		encodeInt32Field(2, request.enabled === true ? 1 : 0),
	]);
}

/**
 * SetSkillEnabledResponse — `skill_name`=1 `enabled`=2 `status`=3
 * (UNSPECIFIED=0 omit, OK=1, NOT_FOUND=2, FAILED=3).
 * Mapper already reads `{ ok, reason }`; OK=1 → `ok: true`, else false. Unknown fields unread.
 */
export function decodeSetSkillEnabledResponse(bytes: Uint8Array): SetSkillEnabledResponseWire {
	return {
		ok: lastVarint(readProtoFields(bytes), 3) === 1n,
	};
}

/** Tool.ToolInfo — ToolInfoRequest `tool_name`=1. Empty omitted. */
export function encodeToolInfoRequest(request: UniverseAgentToolInfoRequest): Uint8Array {
	return encodeStringField(1, request.toolName);
}

/**
 * ToolInfoResponse — `name`=1 `description`=2 `category`=3 `input_schema_json`=4
 * `destructive`=5 `requires_permission`=6 repeated `aliases`=7.
 * Unknown fields unread.
 */
export function decodeToolInfoResponse(bytes: Uint8Array): ToolInfoResponseWire {
	const fields = readProtoFields(bytes);
	return {
		name: lastString(fields, 1) ?? '',
		description: lastString(fields, 2),
		category: lastString(fields, 3),
		input_schema_json: lastString(fields, 4),
		destructive: lastVarint(fields, 5) === 1n,
		requires_permission: lastVarint(fields, 6) === 1n,
		aliases: decodeRepeatedUtf8(fields, 7),
	};
}

/**
 * Tool.ListCommands — ListCommandsRequest is empty.
 * Callers must still pass this to `makeUnaryBytesClient` (never skip sendMessage).
 */
export function encodeListCommandsRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

/**
 * ListCommandsResponse — repeated `CommandSummary commands`=1, `total`=2.
 * CommandSummary: `name`=1 `description`=2 `source`=3 (SlashCommandSource varint)
 * `slash_enabled`=4 `agent`=5 `model`=6 `subtask`=7 `skill_source`=8.
 * Decode `source` as number; mapper already accepts that shape. Unknown fields unread.
 */
export function decodeListCommandsResponse(bytes: Uint8Array): ListCommandsResponseWire {
	const fields = readProtoFields(bytes);
	const total = lastVarint(fields, 2);
	return {
		commands: allLengthDelimited(fields, 1).map(decodeCommandSummary),
		...(total !== undefined ? { total: Number(total) } : {}),
	};
}

function decodeCommandSummary(bytes: Uint8Array): NonNullable<ListCommandsResponseWire['commands']>[number] {
	const fields = readProtoFields(bytes);
	return {
		name: lastString(fields, 1) ?? '',
		description: lastString(fields, 2),
		source: numberOrUndefined(lastVarint(fields, 3)),
		slash_enabled: lastVarint(fields, 4) === 1n,
		agent: lastString(fields, 5),
		model: lastString(fields, 6),
		subtask: lastVarint(fields, 7) === 1n,
		skill_source: lastString(fields, 8),
	};
}

/** Tool.GetCommandDef — GetCommandDefRequest `command_name`=1. Empty omitted. */
export function encodeGetCommandDefRequest(request: UniverseAgentGetCommandDefRequest): Uint8Array {
	return encodeStringField(1, request.commandName);
}

/**
 * GetCommandDefResponse — `name`=1 `description`=2 `source`=3 `template`=4
 * `agent`=5 `model`=6 `subtask`=7 `mcp_server_id`=8 `mcp_prompt_name`=9
 * repeated `mcp_argument_names`=10 `skill_source`=11.
 * Decode `source` as number; mapper already accepts that shape. Unknown fields unread.
 */
export function decodeGetCommandDefResponse(bytes: Uint8Array): GetCommandDefResponseWire {
	const fields = readProtoFields(bytes);
	return {
		name: lastString(fields, 1) ?? '',
		description: lastString(fields, 2),
		source: numberOrUndefined(lastVarint(fields, 3)),
		template: lastString(fields, 4),
		agent: lastString(fields, 5),
		model: lastString(fields, 6),
		subtask: lastVarint(fields, 7) === 1n,
		mcp_server_id: lastString(fields, 8),
		mcp_prompt_name: lastString(fields, 9),
		mcp_argument_names: decodeRepeatedUtf8(fields, 10),
		skill_source: lastString(fields, 11),
	};
}

/** Agent.DeleteAgentProfile — DeleteAgentProfileRequest `id`=1. Empty omitted. */
export function encodeDeleteAgentProfileRequest(id: string): Uint8Array {
	return encodeStringField(1, id);
}

/** DeleteAgentProfileResponse — `success`=1 (false omit). Unknown fields unread. */
export function decodeDeleteAgentProfileResponse(bytes: Uint8Array): DeleteAgentProfileResponseWire {
	return { success: lastVarint(readProtoFields(bytes), 1) === 1n };
}

function decodeRepeatedUtf8(fields: ReturnType<typeof readProtoFields>, field: number): string[] {
	return allLengthDelimited(fields, field).map(value => Buffer.from(value).toString('utf8'));
}

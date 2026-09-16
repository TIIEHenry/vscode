/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentAgentProfileDetail,
	UniverseAgentClearProviderCredentialsRequest,
	UniverseAgentDeleteProjectRuleRequest,
	UniverseAgentListProjectRulesRequest,
	UniverseAgentListSessionsRequest,
	UniverseAgentProjectRule,
	UniverseAgentSwitchModelRequest,
	UniverseAgentSwitchModelResult,
	UniverseAgentUpsertProjectRuleRequest,
	UniverseAgentUpsertProviderCredentialsRequest,
} from '../../common/universeAgentTypes.js';
import type {
	DeleteProjectRuleResponseWire,
	DeviceInfoWire,
	ListAgentProfilesResponseWire,
	ListDevicesResponseWire,
	ListHookPointsResponseWire,
	ListModelsResponseWire,
	ListProjectRulesResponseWire,
	ListProviderStatusResponseWire,
	ProjectRuleWire,
	ProviderStatusWire,
	ResetAgentProfileResponseWire,
	SaveAgentProfileResponseWire,
} from './grpcClientMappersCatalog.js';
import type { AgentInfoWire, AgentTreeResponseWire, ListAgentsResponseWire, ListSessionsResponseWire, SessionInfoResponseWire } from './grpcClientMappersSession.js';
import type { ListTeamsResponseWire } from './grpcClientMappersTeam.js';
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

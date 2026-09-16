/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentAbortTeamRequest,
	UniverseAgentAbortTeamResult,
	UniverseAgentCreateTeamRequest,
	UniverseAgentCreateTeamResult,
	UniverseAgentKillMemberRequest,
	UniverseAgentKillMemberResult,
	UniverseAgentMessageMemberRequest,
	UniverseAgentMessageMemberResult,
	UniverseAgentStartMemberRequest,
	UniverseAgentStartMemberResult,
	UniverseAgentTaskCancelRequest,
	UniverseAgentTaskCancelResult,
	UniverseAgentTaskUpdateRequest,
	UniverseAgentTaskUpdateResult,
} from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
	type ProtoField,
} from './grpcProtoCodec.js';

/**
 * Team.StartMember — `session_id`=1 `agent_id`=2 `member_name`=3 `preset_id`=4
 * `system_prompt`=5 `model_type`=6 `dynamic`=7.
 * proto3: empty strings / false omitted.
 */
export function encodeStartMemberRequest(request: UniverseAgentStartMemberRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.memberName),
		encodeStringField(4, request.presetId),
		encodeStringField(5, request.systemPrompt),
		encodeStringField(6, request.modelType),
		encodeInt32Field(7, request.dynamic === true ? 1 : 0),
	]);
}

/**
 * StartMemberResponse — `member_agent_id`=1 `member_name`=2 `dynamic`=3 (bool, not
 * the MemberInfo mapper's string). Unknown fields unread.
 */
export function decodeStartMemberResponse(bytes: Uint8Array): UniverseAgentStartMemberResult {
	const fields = readProtoFields(bytes);
	return {
		memberAgentId: lastString(fields, 1) ?? '',
		memberName: lastString(fields, 2) ?? '',
		dynamic: lastVarint(fields, 3) === 1n,
	};
}

/**
 * Team.KillMember — `session_id`=1 `agent_id`=2 `member_name`=3.
 * proto3: empty strings omitted.
 */
export function encodeKillMemberRequest(request: UniverseAgentKillMemberRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.memberName),
	]);
}

/** KillMemberResponse — `success`=1 `message`=2. Unknown fields unread. */
export function decodeKillMemberResponse(bytes: Uint8Array): UniverseAgentKillMemberResult {
	return decodeSuccessMessage(bytes);
}

/**
 * Team.CreateTeam — `session_id`=1 `agent_id`=2 repeated `task_descriptions`=3.
 * proto3: empty strings / empty repeated omitted.
 */
export function encodeCreateTeamRequest(request: UniverseAgentCreateTeamRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeRepeatedString(3, request.taskDescriptions),
	]);
}

/**
 * CreateTeamResponse — `team_id`=1 `member_count`=2. Missing / 0 → 0 (JSON `?? 0`).
 * Unknown fields unread.
 */
export function decodeCreateTeamResponse(bytes: Uint8Array): UniverseAgentCreateTeamResult {
	const fields = readProtoFields(bytes);
	return {
		teamId: numberOrZero(lastVarint(fields, 1)),
		memberCount: numberOrZero(lastVarint(fields, 2)),
	};
}

/**
 * Team.Abort — `session_id`=1 `agent_id`=2 `team_id`=3 `reason`=4.
 * proto3: empty strings / 0 omitted.
 */
export function encodeAbortTeamRequest(request: UniverseAgentAbortTeamRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeInt32Field(3, request.teamId),
		encodeStringField(4, request.reason),
	]);
}

/**
 * AbortTeamResponse — `success`=1 `message`=2 repeated `stopped_members`=3.
 * Unknown fields unread.
 */
export function decodeAbortTeamResponse(bytes: Uint8Array): UniverseAgentAbortTeamResult {
	const fields = readProtoFields(bytes);
	return {
		ok: lastVarint(fields, 1) === 1n,
		message: lastString(fields, 2),
		stoppedMembers: decodeRepeatedUtf8(fields, 3),
	};
}

/**
 * Team.TaskUpdate — `session_id`=1 `agent_id`=2 `task_id`=3 `new_status`=4 `message`=5.
 * proto3: empty strings omitted.
 */
export function encodeTaskUpdateRequest(request: UniverseAgentTaskUpdateRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.taskId),
		encodeStringField(4, request.newStatus),
		encodeStringField(5, request.message),
	]);
}

/** TaskUpdateResponse — `success`=1 `message`=2. Unknown fields unread. */
export function decodeTaskUpdateResponse(bytes: Uint8Array): UniverseAgentTaskUpdateResult {
	return decodeSuccessMessage(bytes);
}

/**
 * Team.TaskCancel — `session_id`=1 `agent_id`=2 `task_id`=3.
 * proto3: empty strings omitted.
 */
export function encodeTaskCancelRequest(request: UniverseAgentTaskCancelRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.taskId),
	]);
}

/** TaskCancelResponse — `success`=1 `message`=2. Unknown fields unread. */
export function decodeTaskCancelResponse(bytes: Uint8Array): UniverseAgentTaskCancelResult {
	return decodeSuccessMessage(bytes);
}

/**
 * Team.MessageMember — `session_id`=1 `agent_id`=2 `member_name`=3 `content`=4.
 * proto3: empty strings omitted.
 */
export function encodeMessageMemberRequest(request: UniverseAgentMessageMemberRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.memberName),
		encodeStringField(4, request.content),
	]);
}

/** MessageMemberResponse — `success`=1 `message`=2. Unknown fields unread. */
export function decodeMessageMemberResponse(bytes: Uint8Array): UniverseAgentMessageMemberResult {
	return decodeSuccessMessage(bytes);
}

function decodeSuccessMessage(bytes: Uint8Array): { readonly ok: boolean; readonly message: string | undefined } {
	const fields = readProtoFields(bytes);
	return {
		ok: lastVarint(fields, 1) === 1n,
		message: lastString(fields, 2),
	};
}

function encodeRepeatedString(field: number, values: readonly string[]): Buffer {
	if (values.length === 0) {
		return Buffer.alloc(0);
	}
	return Buffer.concat(values.map(value => encodeStringField(field, value)));
}

function decodeRepeatedUtf8(fields: readonly ProtoField[], field: number): string[] {
	return allLengthDelimited(fields, field).map(value => Buffer.from(value).toString('utf8'));
}

function numberOrZero(value: bigint | undefined): number {
	return value === undefined ? 0 : Number(value);
}

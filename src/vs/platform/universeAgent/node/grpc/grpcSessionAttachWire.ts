/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from '../../../../base/common/uuid.js';
import type {
	UniverseAgentCancelGenerationRequest,
	UniverseAgentCancelToolCallRequest,
	UniverseAgentChatResponse,
	UniverseAgentCreateSessionRequest,
	UniverseAgentDeleteMessageRequest,
	UniverseAgentDeleteMessageResult,
	UniverseAgentEditMessageRequest,
	UniverseAgentForkAgentRequest,
	UniverseAgentForkAgentResult,
	UniverseAgentKillAgentRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentCreateSnapshotRequest,
	UniverseAgentDeleteSnapshotRequest,
	UniverseAgentFetchToolDetailRequest,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentHistoryEnvelope,
	UniverseAgentListSnapshotsRequest,
	UniverseAgentRenameSessionRequest,
	UniverseAgentRestoreSnapshotRequest,
	UniverseAgentResumeSessionRequest,
	UniverseAgentResumeSessionResult,
	UniverseAgentSessionEvent,
} from '../../common/universeAgentTypes.js';
import type {
	AgentInfoWire,
	CreateSnapshotResponseWire,
	DeleteSnapshotResponseWire,
	FetchToolDetailResponseWire,
	ListSnapshotsResponseWire,
	RestoreSnapshotResponseWire,
	ResumeSessionResponseWire,
	SessionSnapshotInfoWire,
} from './grpcClientMappersSession.js';
import { CONNECT_WIRE_PROTOCOL } from './grpcHandshakeWire.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeInt64Field,
	encodePresentMessageField,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/** SessionHistoryRequest.direction FORWARD_AFTER — seq > cursor_seq. */
export const HISTORY_DIRECTION_FORWARD_AFTER = 1;

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

export const GET_HISTORY_WIRE_PAGE_SIZE_MAX = 500;

export function resolveCreateSessionClientId(request: UniverseAgentCreateSessionRequest): string {
	const explicit = request.clientSessionId?.trim();
	if (explicit) {
		return explicit;
	}
	return generateUuid();
}

export function encodeCreateSessionRequest(request: UniverseAgentCreateSessionRequest): Uint8Array {
	// proto CreateSessionRequest has no title; field 3 is model; field 4 is client_session_id.
	return Buffer.concat([
		encodeStringField(3, request.model),
		encodeStringField(4, resolveCreateSessionClientId(request)),
	]);
}

export function decodeCreateSessionResponse(bytes: Uint8Array): UniverseAgentCreateSessionResult {
	const fields = readProtoFields(bytes);
	return { sessionId: lastString(fields, 1) ?? '' };
}

export function encodeResumeSessionRequest(request: UniverseAgentResumeSessionRequest): Uint8Array {
	return encodeStringField(1, request.sessionId);
}

/** Agent.Rename — `session_id` = 1, `title` = 2. Empty title omits field 2 (proto3 clear). */
export function encodeRenameSessionRequest(request: UniverseAgentRenameSessionRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.title),
	]);
}

/** Agent.Cancel — `session_id` = 1, `agent_id` = 2 (same tags as ChatRequest). */
export function encodeCancelGenerationRequest(request: UniverseAgentCancelGenerationRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}

/** Agent.CancelToolCall — `session_id` = 1, `agent_id` = 2, `tool_call_id` = 3. Empty agent wires `root`. */
export function encodeCancelToolCallRequest(request: UniverseAgentCancelToolCallRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId?.trim() || 'root'),
		encodeStringField(3, request.toolCallId),
	]);
}

/**
 * Agent.Fork — `session_id` = 1, `parent_agent_id` = 2, `name` = 3, `task` = 4, `model_type` = 5, `system_prompt` = 6.
 * Empty parent still wires `root` (same as the JSON client).
 */
export function encodeForkAgentRequest(request: UniverseAgentForkAgentRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.parentAgentId?.trim() || 'root'),
		encodeStringField(3, request.name),
		encodeStringField(4, request.task),
		encodeStringField(5, request.modelType),
		encodeStringField(6, request.systemPrompt),
	]);
}

/** ForkResponse — `success` = 1, `agent_id` = 2 (`agent` = 3 unused by this client). */
export function decodeForkAgentResponse(bytes: Uint8Array): UniverseAgentForkAgentResult {
	const fields = readProtoFields(bytes);
	const agentId = lastString(fields, 2)?.trim();
	return {
		ok: lastVarint(fields, 1) === 1n,
		...(agentId ? { agentId } : {}),
	};
}

/**
 * Agent.Kill — `session_id` = 1, `agent_id` = 2, `force` = 3.
 * Empty agent is not defaulted to `root`. proto3: `force` false omitted.
 */
export function encodeKillAgentRequest(request: UniverseAgentKillAgentRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeInt32Field(3, request.force === true ? 1 : 0),
	]);
}

/**
 * Agent.DeleteMessage — `session_id` = 1, `turn_id` = 2, `agent_id` = 3, `operation_id` = 4.
 * Empty agent still wires `root`.
 */
export function encodeDeleteMessageRequest(request: UniverseAgentDeleteMessageRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.turnId),
		encodeStringField(3, request.agentId?.trim() || 'root'),
		encodeStringField(4, request.operationId),
	]);
}

/** DeleteMessageResponse — `success` = 1, `message` = 2, `current_turn_id` = 3, `removed_turn_count` = 4. */
export function decodeDeleteMessageResponse(bytes: Uint8Array): UniverseAgentDeleteMessageResult {
	const fields = readProtoFields(bytes);
	const message = lastString(fields, 2);
	const currentTurnId = lastString(fields, 3)?.trim();
	const removedTurnCount = lastVarint(fields, 4);
	return {
		ok: lastVarint(fields, 1) === 1n,
		...(message ? { message } : {}),
		...(currentTurnId ? { currentTurnId } : {}),
		...(removedTurnCount !== undefined ? { removedTurnCount: Number(removedTurnCount) } : {}),
	};
}

/**
 * Agent.EditMessage — `session_id` = 1, `turn_id` = 2, `new_content` = 3, `agent_id` = 4, `operation_id` = 5.
 * Empty agent still wires `root`. Response mapping stays success=1 / message=2 (ignores `current_turn_id` = 3).
 */
export function encodeEditMessageRequest(request: UniverseAgentEditMessageRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.turnId),
		encodeStringField(3, request.newContent),
		encodeStringField(4, request.agentId?.trim() || 'root'),
		encodeStringField(5, request.operationId),
	]);
}

/**
 * Agent.FetchToolDetail — `session_id` = 1, `tool_call_id` = 2, `detail_kind` = 3, `ref_id` = 4.
 * Host always `subscribe=false` (proto3 default); field 10 omitted.
 */
export function encodeFetchToolDetailRequest(request: UniverseAgentFetchToolDetailRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.toolCallId),
		encodeInt32Field(3, request.detailKind),
		encodeStringField(4, request.refId),
	]);
}

/** FetchToolDetailResponse — `success` = 1, `content` = 2, `truncated` = 4, `total_bytes` = 5, `error_message` = 7. */
export function decodeFetchToolDetailResponse(bytes: Uint8Array): FetchToolDetailResponseWire {
	const fields = readProtoFields(bytes);
	const totalBytes = lastVarint(fields, 5);
	return {
		success: lastVarint(fields, 1) === 1n,
		content: lastString(fields, 2),
		truncated: lastVarint(fields, 4) === 1n,
		...(totalBytes !== undefined ? { total_bytes: Number(totalBytes) } : {}),
		error_message: lastString(fields, 7),
	};
}

/** Agent.ListSnapshots — `session_id` = 1. */
export function encodeListSnapshotsRequest(request: UniverseAgentListSnapshotsRequest): Uint8Array {
	return encodeStringField(1, request.sessionId);
}

export function decodeListSnapshotsResponse(bytes: Uint8Array): ListSnapshotsResponseWire {
	return {
		snapshots: allLengthDelimited(readProtoFields(bytes), 1).map(decodeSessionSnapshotInfo),
	};
}

/** Agent.CreateSnapshot — `session_id` = 1, `title` = 2, `description` = 3. */
export function encodeCreateSnapshotRequest(request: UniverseAgentCreateSnapshotRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.title),
		encodeStringField(3, request.description),
	]);
}

export function decodeCreateSnapshotResponse(bytes: Uint8Array): CreateSnapshotResponseWire {
	const fields = readProtoFields(bytes);
	const snapshot = lastBytes(fields, 2);
	return {
		success: lastVarint(fields, 1) === 1n,
		...(snapshot ? { snapshot: decodeSessionSnapshotInfo(snapshot) } : {}),
		error_message: lastString(fields, 3),
	};
}

/** Agent.RestoreSnapshot / DeleteSnapshot — `session_id` = 1, `snapshot_id` = 2. */
export function encodeRestoreSnapshotRequest(request: UniverseAgentRestoreSnapshotRequest): Uint8Array {
	return encodeSessionSnapshotIdRequest(request.sessionId, request.snapshotId);
}

export function encodeDeleteSnapshotRequest(request: UniverseAgentDeleteSnapshotRequest): Uint8Array {
	return encodeSessionSnapshotIdRequest(request.sessionId, request.snapshotId);
}

export function decodeRestoreSnapshotResponse(bytes: Uint8Array): RestoreSnapshotResponseWire {
	return decodeSnapshotMutationResponse(bytes);
}

export function decodeDeleteSnapshotResponse(bytes: Uint8Array): DeleteSnapshotResponseWire {
	return decodeSnapshotMutationResponse(bytes);
}

function encodeSessionSnapshotIdRequest(sessionId: string, snapshotId: string): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, sessionId),
		encodeStringField(2, snapshotId),
	]);
}

function decodeSnapshotMutationResponse(bytes: Uint8Array): RestoreSnapshotResponseWire {
	const fields = readProtoFields(bytes);
	return {
		success: lastVarint(fields, 1) === 1n,
		error_message: lastString(fields, 2),
	};
}

function decodeSessionSnapshotInfo(bytes: Uint8Array): SessionSnapshotInfoWire {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1) ?? '',
		session_id: lastString(fields, 2) ?? '',
		title: lastString(fields, 3) ?? '',
		description: lastString(fields, 4),
		created_at: numberOrUndefined(lastVarint(fields, 5)),
		turn_count: numberOrUndefined(lastVarint(fields, 6)),
		token_count: numberOrUndefined(lastVarint(fields, 7)),
		model_id: lastString(fields, 8),
		is_auto: lastVarint(fields, 9) === 1n,
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

/**
 * Shared success=1 / message=2 helper (Rename / Cancel / Kill / EditMessage /
 * Permission Respond / goals / SetPermissionMode). Does **not** read field 3:
 * EditMessage `current_turn_id`=3 is a string; Session.Resume `root_agent`=3
 * is nested AgentInfo — use `decodeSessionResumeResponse`.
 */
export function decodeResumeSessionResponse(bytes: Uint8Array): UniverseAgentResumeSessionResult {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	const message = lastString(fields, 2);
	return {
		ok: success === 1n,
		...(message ? { message } : {}),
	};
}

/**
 * SessionService.Resume — `success`=1 `message`=2 nested `root_agent`=3
 * (AgentInfo 1–8; `model_info`=9 unread, no public field). proto3: false /
 * empty / 0 omitted. Unknown fields unread.
 * Shape matches `ResumeSessionResponseWire` / `mapResumeSessionResponse`.
 */
export function decodeSessionResumeResponse(bytes: Uint8Array): ResumeSessionResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	const message = lastString(fields, 2);
	const root = lastBytes(fields, 3);
	return {
		...(success === undefined ? {} : { success: success === 1n }),
		...(message === undefined ? {} : { message }),
		...(root === undefined ? {} : { root_agent: decodeAgentInfo(root) }),
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

function enumName(names: readonly string[], value: bigint | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	return names[Number(value)] ?? names[0];
}

export function encodeGetHistoryRequest(request: UniverseAgentGetHistoryRequest): Uint8Array {
	const pageSize = clampPageSize(request.limit);
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeInt64Field(2, parseCursorSeq(request.cursorSeq)),
		encodeInt32Field(3, HISTORY_DIRECTION_FORWARD_AFTER),
		encodeInt32Field(4, pageSize),
	]);
}

export function decodeGetHistoryResponse(bytes: Uint8Array): UniverseAgentGetHistoryResult {
	const fields = readProtoFields(bytes);
	const envelopes: UniverseAgentHistoryEnvelope[] = allLengthDelimited(fields, 1).map(raw => {
		const envelope = decodeMessageEnvelope(raw);
		const seq = typeof envelope.seq === 'number' ? envelope.seq : 0;
		return {
			cursorSeq: String(seq),
			payload: envelope,
		};
	});
	const hasMore = lastVarint(fields, 4) === 1n;
	const last = envelopes.at(-1);
	return {
		envelopes,
		...(hasMore && last ? { nextCursorSeq: last.cursorSeq } : {}),
	};
}

export function encodeSessionStreamHandshake(sessionId: string): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, sessionId),
		encodeInt32Field(3, CONNECT_WIRE_PROTOCOL.protocolMajor),
		encodeInt32Field(4, CONNECT_WIRE_PROTOCOL.protocolMinor),
	]);
}

/**
 * SessionStreamEvent — `session_id`=1; nested `hello`=10 `heartbeat`=11
 * `subscription_health`=12 `session_closed`=13 `session_purged`=16
 * (empty SessionPurgedEvent; present empty nested → `{}`);
 * `envelope_appended`=20 `envelope_batch_appended`=21
 * `envelope_range_replaced`=22
 * `branch_topology_notified`=23 BranchTopologyNotified (present empty
 * nested → `{}`; nested 1–10 unread). fileMutationJoin
 * `shouldRefreshAgentTree` reads presence only.
 * `streaming_delta`=30 (StreamingDeltaEvent 1–6);
 * `thinking_delta`=31 (SessionStreamThinkingDeltaEvent 1–6, same layout);
 * `tool_call_lifecycle`=32 ToolCallLifecycleEvent (`turn_id`=2
 * `tool_call_id`=3 `agent_id`=4; present empty nested → `{}`).
 * fileMutationJoin `onToolCallLifecycle` / sessionViewHost
 * `captureToolAttributionHint` read those three keys. `runtime_epoch`=1
 * and oneof `change` 10–13 unread.
 * `generating_tool`=34 GeneratingToolEvent (`runtime_epoch`=1 `turn_id`=2
 * `agent_id`=3 optional `tool_name`=4). OverlayDeltaJoin `applyGenerating`
 * reads `turn_id` + `tool_name`; `runtime_epoch` / `agent_id` decoded for
 * shape.
 * `sub_agent_activity`=35 SessionStreamSubAgentActivityEvent (present empty
 * nested → `{}`; nested unread). fileMutationJoin
 * `shouldRefreshAgentTree` reads presence only.
 * `sub_agent_completed`=36 (present empty nested → `{}`; nested unread).
 * fileMutationJoin `shouldRefreshAgentTree` reads presence only.
 * `turn_lifecycle`=37 TurnLifecycleEvent (`runtime_epoch`=1; oneof
 * `turn_started`=10 `turn_completed`=11). OverlayDeltaJoin `applyLifecycle`
 * reads `turn_completed` presence (any value clears) or nested
 * `turn_started.turn_id`. Other nested change fields unread.
 * `detached_child_phase`=38 (present empty nested → `{}`; nested unread).
 * fileMutationJoin `shouldRefreshAgentTree` reads presence only.
 * `multi_agent_status`=39 MultiAgentStatusEvent (present empty nested
 * → `{}`; nested `team_created`=14 TeamCreated `team_id`=1). Other
 * oneof arms / `runtime_epoch` / `member_count` unread.
 * fileMutationJoin `shouldRefreshAgentTree` reads presence;
 * `readTeamCreatedTeamId` reads `team_created.team_id`.
 * `runtime_overlay_snapshot`=44 RuntimeOverlaySnapshotEvent
 * (`runtime_epoch`=1 optional `active_turn`=2 repeated `pending`=6).
 * ActiveTurnSnapshotProto `turn_id`=1 `streaming_text`=3 `thinking_text`=4
 * optional `generating_tool_name`=5; `agent_id`=2 unread.
 * PendingActionSnapshotProto `request_id`=1 `kind`=2 optional
 * `tool_name`=3 `description`=4 optional `agent_id`=5 repeated
 * `questions`=7 `arguments_json`=8; `parent_tool_call_id`=6 unread.
 * Snapshot `active_tool_calls`=3 `sub_agent_panels`=4 `deep_think`=5
 * `tool_runtime_snapshots`=7 `block_delta_high_water`=8
 * `tool_call_delta_high_water`=9 unread (no public demux fields).
 * `tool_runtime_snapshot`=46 ToolRuntimeSnapshotProto (`tool_call_id`=2
 * optional `detail_ref`=12 oneof `file_mutation_payload`=23; present
 * empty nested → `{}`). When 23 is present, also set
 * `payload: { file_mutation_payload }` (fileMutationJoin reads the
 * wrapper; sessionViewHost reads sibling `detail_ref` /
 * `file_mutation_payload`). `runtime_epoch`=1 `tool_name`=3
 * family/owner_scope_id/lifecycle/timing/progress/usage/actions/
 * preview=4–11, other oneof 20–22/24–25, `sequence`=30
 * `updated_at_ms`=31 unread. Top-level `output_ref`/`preview_ref`/
 * `page_ref`/`transcript_ref` are not on this message.
 * `permission_request`=50
 * PermissionRequestEvent (`request_id`=1 `tool_name`=2 `description`=3
 * `agent_id`=6). `metadata`=4 / `requested_by_client`=5 /
 * `parent_tool_call_id`=7 unread (no public demux fields).
 * `ask_user_question`=51 AskUserQuestionEvent (`request_id`=1 repeated
 * items=2 `agent_id`=3). Item `id`=1 `header`=2 `question`=3
 * options=4 `multi_select`=5 `allow_custom`=6; option `label`=2.
 * Event `parent_tool_call_id`=4 and option `id`/`description` unread
 * (no public demux fields).
 * `client_tool_call`=52 SessionStreamClientToolCallEvent (`request_id`=1
 * `tool_name`=3 `arguments_json`=4 `agent_id`=5). `origin`=2 /
 * `parent_tool_call_id`=6 unread (no public demux fields).
 * proto3: empty / 0 / false omitted. Unknown fields unread. Shape
 * matches OverlayDeltaJoin `streaming_delta` / `thinking_delta` /
 * `generating_tool` / `turn_lifecycle` and demuxSessionStreamPayload
 * `session_purged` / `runtime_overlay_snapshot` /
 * `permission_request` / `ask_user_question` / `client_tool_call`,
 * fileMutationJoin / sessionViewHost `tool_call_lifecycle` /
 * `tool_runtime_snapshot`,
 * and `shouldRefreshAgentTree` `branch_topology_notified` /
 * `sub_agent_activity` / `sub_agent_completed` / `detached_child_phase` /
 * `multi_agent_status`.
 */
export function decodeSessionStreamEvent(bytes: Uint8Array): UniverseAgentSessionEvent {
	const fields = readProtoFields(bytes);
	const payload: Record<string, unknown> = {};
	const sessionId = lastString(fields, 1);
	if (sessionId) {
		payload.session_id = sessionId;
	}
	const hello = lastBytes(fields, 10);
	if (hello) {
		payload.hello = decodeStreamHello(hello);
	}
	const heartbeat = lastBytes(fields, 11);
	if (heartbeat) {
		payload.heartbeat = decodeStreamHeartbeat(heartbeat);
	}
	const health = lastBytes(fields, 12);
	if (health) {
		payload.subscription_health = decodeSubscriptionHealth(health);
	}
	const closed = lastBytes(fields, 13);
	if (closed) {
		payload.session_closed = decodeSessionClosed(closed);
	}
	const purged = lastBytes(fields, 16);
	if (purged !== undefined) {
		payload.session_purged = {};
	}
	const appended = lastBytes(fields, 20);
	if (appended) {
		payload.envelope_appended = decodeEnvelopeAppended(appended);
	}
	const batch = lastBytes(fields, 21);
	if (batch) {
		payload.envelope_batch_appended = decodeEnvelopeBatchAppended(batch);
	}
	const replaced = lastBytes(fields, 22);
	if (replaced) {
		payload.envelope_range_replaced = decodeEnvelopeRangeReplaced(replaced);
	}
	const topology = lastBytes(fields, 23);
	if (topology !== undefined) {
		payload.branch_topology_notified = {};
	}
	const streamingDelta = lastBytes(fields, 30);
	if (streamingDelta) {
		payload.streaming_delta = decodeStreamingDelta(streamingDelta);
	}
	const thinkingDelta = lastBytes(fields, 31);
	if (thinkingDelta) {
		payload.thinking_delta = decodeStreamingDelta(thinkingDelta);
	}
	const toolCallLifecycle = lastBytes(fields, 32);
	if (toolCallLifecycle !== undefined) {
		payload.tool_call_lifecycle = decodeToolCallLifecycleEvent(toolCallLifecycle);
	}
	const generatingTool = lastBytes(fields, 34);
	if (generatingTool) {
		payload.generating_tool = decodeGeneratingToolEvent(generatingTool);
	}
	const subAgentActivity = lastBytes(fields, 35);
	if (subAgentActivity !== undefined) {
		payload.sub_agent_activity = {};
	}
	const subAgentCompleted = lastBytes(fields, 36);
	if (subAgentCompleted !== undefined) {
		payload.sub_agent_completed = {};
	}
	const turnLifecycle = lastBytes(fields, 37);
	if (turnLifecycle) {
		payload.turn_lifecycle = decodeTurnLifecycleEvent(turnLifecycle);
	}
	const detachedChildPhase = lastBytes(fields, 38);
	if (detachedChildPhase !== undefined) {
		payload.detached_child_phase = {};
	}
	const multiAgentStatus = lastBytes(fields, 39);
	if (multiAgentStatus !== undefined) {
		payload.multi_agent_status = decodeMultiAgentStatusEvent(multiAgentStatus);
	}
	const overlaySnapshot = lastBytes(fields, 44);
	if (overlaySnapshot) {
		payload.runtime_overlay_snapshot = decodeRuntimeOverlaySnapshotEvent(overlaySnapshot);
	}
	const toolRuntimeSnapshot = lastBytes(fields, 46);
	if (toolRuntimeSnapshot !== undefined) {
		payload.tool_runtime_snapshot = decodeToolRuntimeSnapshot(toolRuntimeSnapshot);
	}
	const permission = lastBytes(fields, 50);
	if (permission) {
		payload.permission_request = decodePermissionRequestEvent(permission);
	}
	const askUserQuestion = lastBytes(fields, 51);
	if (askUserQuestion) {
		payload.ask_user_question = decodeAskUserQuestionEvent(askUserQuestion);
	}
	const clientToolCall = lastBytes(fields, 52);
	if (clientToolCall) {
		payload.client_tool_call = decodeClientToolCallEvent(clientToolCall);
	}
	return { payload };
}

export function encodeChatRequest(sessionId: string, payload: unknown): Uint8Array {
	const record = isRecord(payload) ? payload : {};
	const agentId = readString(record, 'agentId', 'agent_id');
	const parts = [
		encodeStringField(1, sessionId),
		encodeStringField(2, agentId),
	];
	if (Object.hasOwn(record, 'heartbeat_ack') || Object.hasOwn(record, 'heartbeatAck')) {
		const ack = record.heartbeat_ack ?? record.heartbeatAck;
		parts.push(encodePresentMessageField(12, encodeHeartbeatAck(ack)));
		return Buffer.concat(parts);
	}
	const input = isRecord(record.session_input)
		? record.session_input
		: isRecord(record.sessionInput)
			? record.sessionInput
			: record;
	parts.push(encodePresentMessageField(30, encodeSessionInput(input)));
	return Buffer.concat(parts);
}

export function decodeChatResponse(bytes: Uint8Array): UniverseAgentChatResponse {
	const fields = readProtoFields(bytes);
	return {
		payload: {
			session_id: lastString(fields, 1) ?? '',
			agent_id: lastString(fields, 2) ?? '',
		},
	};
}

function encodeSessionInput(input: Record<string, unknown>): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, readString(input, 'messageId', 'message_id')),
		encodeStringField(2, readString(input, 'text')),
		encodeStringField(5, readString(input, 'modelProfileId', 'model_profile_id')),
		encodeStringField(10, readString(input, 'operationId', 'operation_id')),
	]);
}

function encodeHeartbeatAck(ack: unknown): Uint8Array {
	if (!isRecord(ack)) {
		return new Uint8Array(0);
	}
	const echo = ack.echo_ts ?? ack.echoTs;
	if (typeof echo === 'number' || typeof echo === 'bigint') {
		return encodeInt64Field(1, echo);
	}
	return new Uint8Array(0);
}

function decodePermissionRequestEvent(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const agentId = lastString(fields, 6);
	return {
		request_id: lastString(fields, 1) ?? '',
		tool_name: lastString(fields, 2) ?? '',
		description: lastString(fields, 3) ?? '',
		...(agentId ? { agent_id: agentId } : {}),
	};
}

/**
 * SessionStreamClientToolCallEvent — `request_id`=1 `tool_name`=3
 * `arguments_json`=4 `agent_id`=5. `origin`=2 / `parent_tool_call_id`=6
 * unread (no public demux fields). proto3: empty omitted.
 */
function decodeClientToolCallEvent(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const agentId = lastString(fields, 5);
	return {
		request_id: lastString(fields, 1) ?? '',
		tool_name: lastString(fields, 3) ?? '',
		arguments_json: lastString(fields, 4) ?? '',
		...(agentId ? { agent_id: agentId } : {}),
	};
}

/**
 * AskUserQuestionEvent — `request_id`=1 repeated items=2 `agent_id`=3.
 * `parent_tool_call_id`=4 unread. Item: `id`=1 `header`=2 `question`=3
 * options=4 `multi_select`=5 `allow_custom`=6. Option: `label`=2
 * (`id`=1 `description`=3 unread). proto3: empty / 0 / false omitted.
 */
function decodeAskUserQuestionEvent(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const agentId = lastString(fields, 3);
	return {
		request_id: lastString(fields, 1) ?? '',
		items: allLengthDelimited(fields, 2).map(decodeAskUserQuestionItemProto),
		...(agentId ? { agent_id: agentId } : {}),
	};
}

function decodeAskUserQuestionItemProto(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1) ?? '',
		header: lastString(fields, 2) ?? '',
		question: lastString(fields, 3) ?? '',
		options: allLengthDelimited(fields, 4).map(decodeAskUserQuestionOptionProto),
		multi_select: lastVarint(fields, 5) === 1n,
		allow_custom: lastVarint(fields, 6) === 1n,
	};
}

function decodeAskUserQuestionOptionProto(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return {
		label: lastString(fields, 2) ?? '',
	};
}

/**
 * MultiAgentStatusEvent — present empty nested → `{}`. Nested
 * `team_created`=14 TeamCreated `team_id`=1 (int32). Other oneof
 * arms / `runtime_epoch` / `member_count` unread. proto3: empty /
 * 0 omitted; oneof arm present even when nested payload is empty.
 */
function decodeMultiAgentStatusEvent(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const teamCreated = lastBytes(fields, 14);
	if (teamCreated === undefined) {
		return {};
	}
	return { team_created: decodeTeamCreated(teamCreated) };
}

/** TeamCreated — `team_id`=1. `member_count`=2 unread. */
function decodeTeamCreated(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const teamId = lastVarint(fields, 1);
	return {
		...(teamId !== undefined ? { team_id: Number(teamId) } : {}),
	};
}

/**
 * ToolCallLifecycleEvent — present empty nested → `{}`. Nested
 * `turn_id`=2 `tool_call_id`=3 `agent_id`=4. `runtime_epoch`=1 and
 * oneof `change` 10–13 unread. proto3: empty / 0 omitted.
 */
function decodeToolCallLifecycleEvent(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const turnId = lastString(fields, 2);
	const toolCallId = lastString(fields, 3);
	const agentId = lastString(fields, 4);
	return {
		...(turnId ? { turn_id: turnId } : {}),
		...(toolCallId ? { tool_call_id: toolCallId } : {}),
		...(agentId ? { agent_id: agentId } : {}),
	};
}

/**
 * ToolRuntimeSnapshotProto — present empty nested → `{}`. Nested
 * `tool_call_id`=2 optional `detail_ref`=12 oneof
 * `file_mutation_payload`=23. When 23 is present, also set
 * `payload: { file_mutation_payload }` so fileMutationJoin can read
 * the wrapper; sessionViewHost reads sibling `detail_ref` /
 * `file_mutation_payload`. `runtime_epoch`=1 `tool_name`=3
 * family/owner_scope_id/lifecycle/timing/progress/usage/actions/
 * preview=4–11, other oneof 20–22/24–25, `sequence`=30
 * `updated_at_ms`=31 unread. proto3: empty omitted.
 */
function decodeToolRuntimeSnapshot(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const snapshot: Record<string, unknown> = {};
	const toolCallId = lastString(fields, 2);
	if (toolCallId) {
		snapshot.tool_call_id = toolCallId;
	}
	const detailRef = lastBytes(fields, 12);
	if (detailRef) {
		snapshot.detail_ref = decodeToolDetailRef(detailRef);
	}
	const fileMutation = lastBytes(fields, 23);
	if (fileMutation) {
		const fileMutationPayload = decodeFileMutation(fileMutation);
		snapshot.file_mutation_payload = fileMutationPayload;
		snapshot.payload = { file_mutation_payload: fileMutationPayload };
	}
	return snapshot;
}

/**
 * GeneratingToolEvent — `runtime_epoch`=1 `turn_id`=2 `agent_id`=3
 * optional `tool_name`=4. OverlayDeltaJoin reads `turn_id` + `tool_name`.
 * proto3: empty / 0 omitted.
 */
function decodeGeneratingToolEvent(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return {
		runtime_epoch: numberOrZero(lastVarint(fields, 1)),
		turn_id: lastString(fields, 2) ?? '',
		agent_id: lastString(fields, 3) ?? '',
		tool_name: lastString(fields, 4) ?? '',
	};
}

/**
 * TurnLifecycleEvent — `runtime_epoch`=1; oneof `turn_started`=10
 * `turn_completed`=11. OverlayDeltaJoin reads completed presence or
 * `turn_started.turn_id`. proto3: empty / 0 omitted; oneof arm present
 * even when nested payload is empty.
 */
function decodeTurnLifecycleEvent(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const started = lastBytes(fields, 10);
	const completed = lastBytes(fields, 11);
	return {
		runtime_epoch: numberOrZero(lastVarint(fields, 1)),
		...(started ? { turn_started: decodeTurnStartedChange(started) } : {}),
		...(completed ? { turn_completed: {} } : {}),
	};
}

/** TurnStartedChange — `turn_id`=1. Fields 2–6 unread (no overlay join). */
function decodeTurnStartedChange(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return {
		turn_id: lastString(fields, 1) ?? '',
	};
}

/**
 * RuntimeOverlaySnapshotEvent — `runtime_epoch`=1 optional `active_turn`=2
 * repeated `pending`=6. Fields 3–5 / 7–9 unread (no public demux keys).
 * proto3: empty / 0 omitted; empty repeated `pending` still `[]`.
 */
function decodeRuntimeOverlaySnapshotEvent(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const activeTurn = lastBytes(fields, 2);
	return {
		runtime_epoch: numberOrZero(lastVarint(fields, 1)),
		...(activeTurn ? { active_turn: decodeActiveTurnSnapshotProto(activeTurn) } : {}),
		pending: allLengthDelimited(fields, 6).map(decodePendingActionSnapshotProto),
	};
}

/**
 * ActiveTurnSnapshotProto — `turn_id`=1 `streaming_text`=3 `thinking_text`=4
 * optional `generating_tool_name`=5. `agent_id`=2 unread. proto3: empty omitted.
 */
function decodeActiveTurnSnapshotProto(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const generatingToolName = lastString(fields, 5);
	return {
		turn_id: lastString(fields, 1) ?? '',
		streaming_text: lastString(fields, 3) ?? '',
		thinking_text: lastString(fields, 4) ?? '',
		...(generatingToolName ? { generating_tool_name: generatingToolName } : {}),
	};
}

/**
 * PendingActionSnapshotProto — `request_id`=1 `kind`=2 optional `tool_name`=3
 * `description`=4 optional `agent_id`=5 repeated `questions`=7
 * `arguments_json`=8. `parent_tool_call_id`=6 unread. proto3: empty / 0 omitted.
 */
function decodePendingActionSnapshotProto(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const toolName = lastString(fields, 3);
	const agentId = lastString(fields, 5);
	const questions = allLengthDelimited(fields, 7).map(decodeAskUserQuestionItemProto);
	const argumentsJson = lastString(fields, 8);
	return {
		request_id: lastString(fields, 1) ?? '',
		kind: numberOrZero(lastVarint(fields, 2)),
		description: lastString(fields, 4) ?? '',
		...(toolName ? { tool_name: toolName } : {}),
		...(agentId ? { agent_id: agentId } : {}),
		...(argumentsJson ? { arguments_json: argumentsJson } : {}),
		...(questions.length > 0 ? { questions } : {}),
	};
}

/**
 * StreamingDeltaEvent / SessionStreamThinkingDeltaEvent — `runtime_epoch`=1
 * `turn_id`=2 `block_id`=3 `agent_id`=4 `text_delta`=5 `delta_seq`=6.
 * Streaming reserved 10–13 unread. proto3: empty / 0 omitted.
 */
function decodeStreamingDelta(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return {
		runtime_epoch: numberOrZero(lastVarint(fields, 1)),
		turn_id: lastString(fields, 2) ?? '',
		block_id: lastString(fields, 3) ?? '',
		agent_id: lastString(fields, 4) ?? '',
		text_delta: lastString(fields, 5) ?? '',
		delta_seq: numberOrZero(lastVarint(fields, 6)),
	};
}

function decodeStreamHello(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return {
		session_version: numberOrZero(lastVarint(fields, 1)),
		head_seq: numberOrZero(lastVarint(fields, 2)),
		runtime_epoch: numberOrZero(lastVarint(fields, 3)),
		last_mutated_from_seq: numberOrZero(lastVarint(fields, 4)),
	};
}

function decodeStreamHeartbeat(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return { server_mono_ms: numberOrZero(lastVarint(fields, 1)) };
}

function decodeSubscriptionHealth(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return { phase: numberOrZero(lastVarint(fields, 1)) };
}

function decodeSessionClosed(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return { reason: numberOrZero(lastVarint(fields, 1)) };
}

function decodeEnvelopeAppended(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const envelopeBytes = lastBytes(fields, 5);
	const body: Record<string, unknown> = {
		seq: numberOrZero(lastVarint(fields, 1)),
		session_version: numberOrZero(lastVarint(fields, 2)),
	};
	if (envelopeBytes) {
		body.envelope = decodeMessageEnvelope(envelopeBytes);
	}
	return body;
}

function decodeEnvelopeBatchAppended(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return {
		seq: numberOrZero(lastVarint(fields, 1)),
		session_version: numberOrZero(lastVarint(fields, 2)),
		envelopes: allLengthDelimited(fields, 5).map(decodeMessageEnvelope),
	};
}

function decodeEnvelopeRangeReplaced(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	return {
		seq: numberOrZero(lastVarint(fields, 1)),
		session_version: numberOrZero(lastVarint(fields, 2)),
		from_seq: numberOrZero(lastVarint(fields, 5)),
		new_head_seq: numberOrZero(lastVarint(fields, 6)),
		replacement: allLengthDelimited(fields, 7).map(decodeMessageEnvelope),
		diverged_from_turn_id: lastString(fields, 8) ?? '',
		replaced_envelope_ids: allLengthDelimited(fields, 10).map(value => Buffer.from(value).toString('utf8')),
	};
}

function decodeMessageEnvelope(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const envelope: Record<string, unknown> = {
		id: lastString(fields, 1) ?? '',
		seq: numberOrZero(lastVarint(fields, 3)),
	};
	const sessionId = lastString(fields, 2);
	if (sessionId) {
		envelope.session_id = sessionId;
	}
	const role = lastVarint(fields, 7);
	if (role !== undefined) {
		envelope.role = Number(role);
	}
	const agentId = lastString(fields, 8);
	if (agentId) {
		envelope.agent_id = agentId;
	}
	const turnId = lastString(fields, 10);
	if (turnId) {
		envelope.turn_id = turnId;
	}
	const blocks = allLengthDelimited(fields, 17).map(decodeBlock);
	if (blocks.length > 0) {
		envelope.blocks = blocks;
	}
	return envelope;
}

function decodeBlock(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const block: Record<string, unknown> = {
		block_type: numberOrZero(lastVarint(fields, 1)),
	};
	const text = lastBytes(fields, 2);
	if (text) {
		block.text_block = { text: lastString(readProtoFields(text), 1) ?? '' };
	}
	const toolCall = lastBytes(fields, 3);
	if (toolCall) {
		const inner = readProtoFields(toolCall);
		const toolCallBlock: Record<string, unknown> = {
			tool_call_id: lastString(inner, 1) ?? '',
			tool_name: lastString(inner, 2) ?? '',
			arguments_json: lastString(inner, 3) ?? '',
		};
		const detailRef = lastBytes(inner, 4);
		if (detailRef) {
			toolCallBlock.detail_ref = decodeToolDetailRef(detailRef);
		}
		const fileMutation = lastBytes(inner, 5);
		if (fileMutation) {
			toolCallBlock.file_mutation = decodeFileMutation(fileMutation);
		}
		block.tool_call_block = toolCallBlock;
	}
	const toolResult = lastBytes(fields, 4);
	if (toolResult) {
		const inner = readProtoFields(toolResult);
		block.tool_result_block = {
			tool_call_id: lastString(inner, 1) ?? '',
			tool_name: lastString(inner, 2) ?? '',
			content: lastString(inner, 3) ?? '',
			is_error: lastVarint(inner, 4) === 1n,
		};
	}
	const thinking = lastBytes(fields, 5);
	if (thinking) {
		block.thinking_block = { text: lastString(readProtoFields(thinking), 1) ?? '' };
	}
	return block;
}

export function fetchToolDetailRequestFromHistoryToolCall(
	sessionId: string,
	toolCallBlock: Record<string, unknown> | undefined,
): UniverseAgentFetchToolDetailRequest | undefined {
	if (!toolCallBlock) {
		return undefined;
	}
	const toolCallId = typeof toolCallBlock.tool_call_id === 'string' ? toolCallBlock.tool_call_id : '';
	const detailRef = isRecord(toolCallBlock.detail_ref) ? toolCallBlock.detail_ref : undefined;
	const refId = detailRef && typeof detailRef.ref_id === 'string' ? detailRef.ref_id : '';
	if (!toolCallId || !refId) {
		return undefined;
	}
	const kind = detailRef && typeof detailRef.kind === 'number' ? detailRef.kind : 0;
	return {
		sessionId,
		toolCallId,
		detailKind: kind,
		refId,
	};
}

function decodeToolDetailRef(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const ref: Record<string, unknown> = {
		kind: numberOrZero(lastVarint(fields, 1)),
		ref_id: lastString(fields, 2) ?? '',
	};
	const mimeType = lastString(fields, 3);
	if (mimeType) {
		ref.mime_type = mimeType;
	}
	const sizeBytes = lastVarint(fields, 4);
	if (sizeBytes !== undefined) {
		ref.size_bytes = Number(sizeBytes);
	}
	const revision = lastVarint(fields, 5);
	if (revision !== undefined) {
		ref.revision = Number(revision);
	}
	return ref;
}

function decodeFileMutation(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const mutation: Record<string, unknown> = {
		path: lastString(fields, 2) ?? '',
		operation: lastString(fields, 3) ?? '',
	};
	const schemaVersion = lastVarint(fields, 1);
	if (schemaVersion !== undefined) {
		mutation.schema_version = Number(schemaVersion);
	}
	const stats = lastBytes(fields, 4);
	if (stats) {
		const statFields = readProtoFields(stats);
		mutation.diff_stats = {
			added_lines: numberOrZero(lastVarint(statFields, 1)),
			removed_lines: numberOrZero(lastVarint(statFields, 2)),
			changed_files: numberOrZero(lastVarint(statFields, 3)),
		};
	}
	const previewRef = lastBytes(fields, 5);
	if (previewRef) {
		mutation.preview_ref = decodeToolDetailRef(previewRef);
	}
	return mutation;
}

function parseCursorSeq(value: string | undefined): number {
	if (!value) {
		return 0;
	}
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function clampPageSize(limit: number | undefined): number {
	if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit <= 0) {
		return 100;
	}
	return Math.min(limit, GET_HISTORY_WIRE_PAGE_SIZE_MAX);
}

function numberOrZero(value: bigint | undefined): number {
	return value === undefined ? 0 : Number(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
	for (const key of keys) {
		if (!Object.hasOwn(record, key)) {
			continue;
		}
		const value = record[key];
		if (typeof value === 'string' && value.length > 0) {
			return value;
		}
	}
	return undefined;
}

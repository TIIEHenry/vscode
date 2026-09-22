/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentChatSyncRequest,
	UniverseAgentChatSyncSessionInput,
	UniverseAgentSyncInputDeliveryRequest,
} from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	encodeVarint,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * ChatSyncResponse / SyncInputDeliveryResponse wire shape for
 * `mapChatSyncResponse` / `mapSyncInputDeliveryResponse`. Unknown fields unread.
 */
export interface ChatSyncToolResultWire {
	tool_id?: string;
	tool_name?: string;
	is_error?: boolean;
	content?: string;
	duration_ms?: number;
	metadata_json?: string;
}

export interface ChatSyncInputDeliveryEventWire {
	message_id?: string;
	status?: number;
	error_code?: string;
	error_message?: string;
}

export interface ChatSyncResponseWire {
	session_id?: string;
	agent_id?: string;
	text?: string;
	stop_reason?: string;
	input_tokens?: number;
	output_tokens?: number;
	turn_count?: number;
	tool_results?: ChatSyncToolResultWire[];
	error?: string;
	input_delivery_events?: ChatSyncInputDeliveryEventWire[];
}

export interface SyncInputDeliveryResponseWire {
	input_delivery_events?: ChatSyncInputDeliveryEventWire[];
}

/**
 * proto InputDeliveryPolicy (agent_service.proto).
 * TS `UniverseAgentChatSyncSessionInput.delivery` is already a number.
 * Map only STANDARD=1 / STANDARD_INTERRUPT=2 / QUEUE=3; UNSPECIFIED=0 omitted
 * (proto3 default). Any other number is omitted (gap — do not guess).
 */
const INPUT_DELIVERY_STANDARD = 1;
const INPUT_DELIVERY_STANDARD_INTERRUPT = 2;
const INPUT_DELIVERY_QUEUE = 3;

/**
 * AgentService.ChatSync — ChatSyncRequest:
 * `session_id`=1 `agent_id`=2 `session_input`=3 `timeout_seconds`=4
 * repeated `last_known_message_ids`=5 `idempotency_key`=6.
 * proto3: empty / 0 omitted.
 */
export function encodeChatSyncRequest(request: UniverseAgentChatSyncRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeMessageField(3, request.sessionInput ? encodeChatSyncSessionInput(request.sessionInput) : undefined),
		encodeInt32Field(4, request.timeoutSeconds),
		encodeRepeatedString(5, request.lastKnownMessageIds ?? []),
		encodeStringField(6, request.idempotencyKey),
	]);
}

/**
 * ChatSyncResponse — `session_id`=1 `agent_id`=2 `text`=3 `stop_reason`=4
 * `input_tokens`=5 `output_tokens`=6 `turn_count`=7 repeated `tool_results`=8
 * `error`=9 repeated `input_delivery_events`=10.
 * ToolResultEvent: `tool_id`=1 `tool_name`=2 `is_error`=3 `content`=4 `duration_ms`=5 `metadata_json`=6.
 * InputDeliveryEvent: `message_id`=1 `status`=2 `error_code`=3 `error_message`=4.
 * Unknown fields unread.
 */
export function decodeChatSyncResponse(bytes: Uint8Array): ChatSyncResponseWire {
	const fields = readProtoFields(bytes);
	return {
		session_id: lastString(fields, 1),
		agent_id: lastString(fields, 2),
		text: lastString(fields, 3),
		stop_reason: lastString(fields, 4),
		input_tokens: numberOrUndefined(lastVarint(fields, 5)),
		output_tokens: numberOrUndefined(lastVarint(fields, 6)),
		turn_count: numberOrUndefined(lastVarint(fields, 7)),
		tool_results: allLengthDelimited(fields, 8).map(decodeToolResultEvent),
		error: lastString(fields, 9),
		input_delivery_events: allLengthDelimited(fields, 10).map(decodeInputDeliveryEvent),
	};
}

/**
 * AgentService.SyncInputDelivery — SyncInputDeliveryRequest:
 * `session_id`=1 repeated `last_known_message_ids`=2.
 * proto3: empty omitted.
 */
export function encodeSyncInputDeliveryRequest(request: UniverseAgentSyncInputDeliveryRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeRepeatedString(2, request.lastKnownMessageIds ?? []),
	]);
}

/**
 * SyncInputDeliveryResponse — repeated `input_delivery_events`=1
 * (InputDeliveryEvent 1–4). Unknown fields unread.
 */
export function decodeSyncInputDeliveryResponse(bytes: Uint8Array): SyncInputDeliveryResponseWire {
	return {
		input_delivery_events: allLengthDelimited(readProtoFields(bytes), 1).map(decodeInputDeliveryEvent),
	};
}

/**
 * SessionInput: `message_id`=1 `text`=2 repeated `attachments`=3 `delivery`=4
 * `model_profile_id`=5 `system_prompt`=6 optional bool `memory_enabled`=7
 * optional bool `thinking_enabled`=8 optional `reply_to_id`=9
 * optional `operation_id`=10 optional `skill_name`=11 optional `skill_scope`=12
 * optional `skill_command_text`=13.
 *
 * `attachments` is not on `UniverseAgentChatSyncSessionInput` (JSON helper also
 * omits it) — field 3 is not encoded. Do not invent Attachment numbers here.
 */
function encodeChatSyncSessionInput(input: UniverseAgentChatSyncSessionInput): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, input.messageId),
		encodeStringField(2, input.text),
		encodeInputDeliveryPolicy(4, input.delivery),
		encodeStringField(5, input.modelProfileId),
		encodeStringField(6, input.systemPrompt),
		encodePresentBoolField(7, input.memoryEnabled),
		encodePresentBoolField(8, input.thinkingEnabled),
		encodeStringField(9, input.replyToId),
		encodeStringField(10, input.operationId),
		encodeStringField(11, input.skillName),
		encodeStringField(12, input.skillScope),
		encodeStringField(13, input.skillCommandText),
	]);
}

function encodeInputDeliveryPolicy(field: number, value: number | undefined): Buffer {
	if (value === INPUT_DELIVERY_STANDARD || value === INPUT_DELIVERY_STANDARD_INTERRUPT || value === INPUT_DELIVERY_QUEUE) {
		return encodeInt32Field(field, value);
	}
	return Buffer.alloc(0);
}

/**
 * proto3 optional bool: `undefined` omitted; `false` must write field+varint0
 * (presence). `encodeInt32Field` omits 0 and cannot encode explicit false.
 */
function encodePresentBoolField(field: number, value: boolean | undefined): Buffer {
	if (value === undefined) {
		return Buffer.alloc(0);
	}
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(value ? 1 : 0),
	]);
}

function decodeToolResultEvent(bytes: Uint8Array): ChatSyncToolResultWire {
	const fields = readProtoFields(bytes);
	return {
		tool_id: lastString(fields, 1),
		tool_name: lastString(fields, 2),
		is_error: lastVarint(fields, 3) === 1n,
		content: lastString(fields, 4),
		duration_ms: numberOrUndefined(lastVarint(fields, 5)),
		metadata_json: lastString(fields, 6),
	};
}

function decodeInputDeliveryEvent(bytes: Uint8Array): ChatSyncInputDeliveryEventWire {
	const fields = readProtoFields(bytes);
	return {
		message_id: lastString(fields, 1),
		status: numberOrUndefined(lastVarint(fields, 2)),
		error_code: lastString(fields, 3),
		error_message: lastString(fields, 4),
	};
}

function encodeRepeatedString(field: number, values: readonly string[]): Buffer {
	if (values.length === 0) {
		return Buffer.alloc(0);
	}
	return Buffer.concat(values.map(value => encodeStringField(field, value)));
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

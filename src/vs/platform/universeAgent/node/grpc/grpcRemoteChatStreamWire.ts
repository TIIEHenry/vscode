/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentRemoteChatRequest,
	UniverseAgentRemotePermissionDecision,
	UniverseAgentRemoteResponse,
} from '../../common/universeAgentTypes.js';
import type {
	RemoteAssistantMessageWire,
	RemoteChatMessageWire,
	RemoteChatResponseWire,
	RemoteChatResultWire,
	RemotePendingPermissionWire,
	RemotePendingQuestionWire,
	RemoteProgressEventWire,
	RemoteToolCallWire,
	RemoteToolResultMessageWire,
} from './grpcClientMappersCatalog.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodePresentMessageField,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * RemoteAgentService.RemoteChat — `call_id`=1 `task`=2 repeated
 * `responses`=3 `override_pending`=4.
 * JSON keys: `call_id` / `task` / `responses` / `override_pending`.
 * RemoteResponse: `type`=1 `request_id`=2 oneof `permission`=3
 * (`decision`=1 `reason`=2) / `question_answers_json`=4.
 * proto3: empty strings / false omitted. `override_pending` false omit.
 * Empty `responses` items still written (length-delimited 0).
 */
export function encodeRemoteChatRequest(request: UniverseAgentRemoteChatRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.callId),
		encodeStringField(2, request.task),
		...request.responses.map(item => encodePresentMessageField(3, encodeRemoteResponse(item))),
		encodeInt32Field(4, request.overridePending === true ? 1 : 0),
	]);
}

/**
 * RemoteChatResponse oneof `result`=1 `progress`=2.
 * RemoteChatResult 1–11: `status` `call_id` `output` `error_message`
 * `error_code` repeated `pending_permissions`=6 `pending_questions`=7
 * `progress` `completed_steps` `total_steps_estimate` repeated `messages`=11.
 * RemoteProgressEvent 1–6: `call_id` `timestamp` `elapsed_ms` `progress`
 * `completed_steps` `total_steps_estimate`.
 * RemoteChatMessage oneof 1–4 (`system` / `user` / `assistant` /
 * `tool_result`); unknown unread.
 * Shape matches RemoteChatResponseWire / mapRemoteChatResponse.
 */
export function decodeRemoteChatResponse(bytes: Uint8Array): RemoteChatResponseWire {
	const fields = readProtoFields(bytes);
	const result = lastBytes(fields, 1);
	const progress = lastBytes(fields, 2);
	return {
		...(result !== undefined ? { result: decodeRemoteChatResult(result) } : {}),
		...(progress !== undefined ? { progress: decodeRemoteProgressEvent(progress) } : {}),
	};
}

function encodeRemoteResponse(response: UniverseAgentRemoteResponse): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, response.type),
		encodeStringField(2, response.requestId),
		response.permission !== undefined
			? encodePresentMessageField(3, encodeRemotePermissionDecision(response.permission))
			: Buffer.alloc(0),
		response.questionAnswersJson !== undefined
			? encodePresentMessageField(4, Buffer.from(response.questionAnswersJson, 'utf8'))
			: Buffer.alloc(0),
	]);
}

function encodeRemotePermissionDecision(permission: UniverseAgentRemotePermissionDecision): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, permission.decision),
		encodeStringField(2, permission.reason),
	]);
}

function decodeRemoteChatResult(bytes: Uint8Array): RemoteChatResultWire {
	const fields = readProtoFields(bytes);
	return {
		status: lastString(fields, 1),
		call_id: lastString(fields, 2),
		output: lastString(fields, 3),
		error_message: lastString(fields, 4),
		error_code: lastString(fields, 5),
		pending_permissions: allLengthDelimited(fields, 6).map(decodeRemotePendingPermission),
		pending_questions: allLengthDelimited(fields, 7).map(decodeRemotePendingQuestion),
		progress: lastString(fields, 8),
		completed_steps: numberOrUndefined(lastVarint(fields, 9)),
		total_steps_estimate: numberOrUndefined(lastVarint(fields, 10)),
		messages: allLengthDelimited(fields, 11).map(decodeRemoteChatMessage),
	};
}

function decodeRemoteProgressEvent(bytes: Uint8Array): RemoteProgressEventWire {
	const fields = readProtoFields(bytes);
	return {
		call_id: lastString(fields, 1),
		timestamp: numberOrUndefined(lastVarint(fields, 2)),
		elapsed_ms: numberOrUndefined(lastVarint(fields, 3)),
		progress: lastString(fields, 4),
		completed_steps: numberOrUndefined(lastVarint(fields, 5)),
		total_steps_estimate: numberOrUndefined(lastVarint(fields, 6)),
	};
}

function decodeRemotePendingPermission(bytes: Uint8Array): RemotePendingPermissionWire {
	const fields = readProtoFields(bytes);
	return {
		request_id: lastString(fields, 1),
		tool_name: lastString(fields, 2),
		path: lastString(fields, 3),
		command: lastString(fields, 4),
		arguments_json: lastString(fields, 5),
		danger_level: lastString(fields, 6),
		bubble_target: lastString(fields, 7),
	};
}

function decodeRemotePendingQuestion(bytes: Uint8Array): RemotePendingQuestionWire {
	const fields = readProtoFields(bytes);
	return {
		question_id: lastString(fields, 1),
		questions_json: lastString(fields, 2),
	};
}

function decodeRemoteChatMessage(bytes: Uint8Array): RemoteChatMessageWire {
	const fields = readProtoFields(bytes);
	const system = lastBytes(fields, 1);
	const user = lastBytes(fields, 2);
	const assistant = lastBytes(fields, 3);
	const toolResult = lastBytes(fields, 4);
	return {
		...(system !== undefined ? { system: { content: lastString(readProtoFields(system), 1) } } : {}),
		...(user !== undefined ? { user: { content: lastString(readProtoFields(user), 1) } } : {}),
		...(assistant !== undefined ? { assistant: decodeRemoteAssistantMessage(assistant) } : {}),
		...(toolResult !== undefined ? { tool_result: decodeRemoteToolResultMessage(toolResult) } : {}),
	};
}

function decodeRemoteAssistantMessage(bytes: Uint8Array): RemoteAssistantMessageWire {
	const fields = readProtoFields(bytes);
	return {
		content: lastString(fields, 1),
		tool_calls: allLengthDelimited(fields, 2).map(decodeRemoteToolCall),
	};
}

function decodeRemoteToolCall(bytes: Uint8Array): RemoteToolCallWire {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1),
		name: lastString(fields, 2),
		arguments: lastString(fields, 3),
	};
}

function decodeRemoteToolResultMessage(bytes: Uint8Array): RemoteToolResultMessageWire {
	const fields = readProtoFields(bytes);
	return {
		tool_call_id: lastString(fields, 1),
		tool_name: lastString(fields, 2),
		content: lastString(fields, 3),
		is_error: lastVarint(fields, 4) === 1n,
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

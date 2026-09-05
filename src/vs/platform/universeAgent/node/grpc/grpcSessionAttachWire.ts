/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentChatResponse,
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentHistoryEnvelope,
	UniverseAgentResumeSessionRequest,
	UniverseAgentResumeSessionResult,
	UniverseAgentSessionEvent,
} from '../../common/universeAgentTypes.js';
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

export const GET_HISTORY_WIRE_PAGE_SIZE_MAX = 500;

export function encodeCreateSessionRequest(request: UniverseAgentCreateSessionRequest): Uint8Array {
	// proto CreateSessionRequest has no title; field 3 is model.
	return encodeStringField(3, request.model);
}

export function decodeCreateSessionResponse(bytes: Uint8Array): UniverseAgentCreateSessionResult {
	const fields = readProtoFields(bytes);
	return { sessionId: lastString(fields, 1) ?? '' };
}

export function encodeResumeSessionRequest(request: UniverseAgentResumeSessionRequest): Uint8Array {
	return encodeStringField(1, request.sessionId);
}

export function decodeResumeSessionResponse(bytes: Uint8Array): UniverseAgentResumeSessionResult {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	const message = lastString(fields, 2);
	return {
		ok: success === 1n,
		...(message ? { message } : {}),
	};
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
		block.tool_call_block = {
			tool_call_id: lastString(inner, 1) ?? '',
			tool_name: lastString(inner, 2) ?? '',
			arguments_json: lastString(inner, 3) ?? '',
		};
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

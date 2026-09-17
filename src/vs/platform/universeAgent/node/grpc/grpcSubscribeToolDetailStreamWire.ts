/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentSubscribeToolDetailRequest } from '../../common/universeAgentTypes.js';
import type { SubscribeToolDetailChunkWire } from './grpcClientMappersSession.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * AgentService.SubscribeToolDetail — `session_id`=1 `tool_call_id`=2 `detail_kind`=3
 * `ref_id`=4 optional `mime_type`=5 `from_revision`=6 optional `tail_bytes`=7.
 * proto3 empty/0 omitted. optional mime/tail omitted when undefined.
 * Field numbers from J `agent_service.proto` SubscribeToolDetailRequest 1804–1811.
 */
export function encodeSubscribeToolDetailRequest(request: UniverseAgentSubscribeToolDetailRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.toolCallId),
		encodeInt32Field(3, request.detailKind),
		encodeStringField(4, request.refId),
		encodeStringField(5, request.mimeType),
		encodeInt64Field(6, request.fromRevision),
		encodeInt64Field(7, request.tailBytes),
	]);
}

/**
 * SubscribeToolDetailChunk — `success`=1 `error_message`=2 `content`=3 `revision`=4
 * `truncated`=5 `total_bytes`=6 `mime_type`=7 `eof`=8 `content_mode`=9 (varint).
 * proto3: false / 0 / empty omitted. Unknown fields unread.
 * Shape matches existing `SubscribeToolDetailChunkWire`; mapper accepts `content_mode` number.
 * Field numbers from J `agent_service.proto` SubscribeToolDetailChunk 1821–1830.
 */
export function decodeSubscribeToolDetailChunk(bytes: Uint8Array): SubscribeToolDetailChunkWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	const truncated = lastVarint(fields, 5);
	const eof = lastVarint(fields, 8);
	return {
		success: success === undefined ? undefined : success === 1n,
		error_message: lastString(fields, 2),
		content: lastString(fields, 3),
		revision: numberOrUndefined(lastVarint(fields, 4)),
		truncated: truncated === undefined ? undefined : truncated === 1n,
		total_bytes: numberOrUndefined(lastVarint(fields, 6)),
		mime_type: lastString(fields, 7),
		eof: eof === undefined ? undefined : eof === 1n,
		content_mode: numberOrUndefined(lastVarint(fields, 9)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentClearClipboardRequest,
	UniverseAgentClipboardEntryType,
	UniverseAgentListClipboardRequest,
	UniverseAgentReadClipboardRequest,
	UniverseAgentWriteClipboardRequest,
} from '../../common/universeAgentTypes.js';
import type {
	ClipboardClearResponseWire,
	ClipboardEntrySummaryWire,
	ClipboardEntryWire,
	ClipboardListResponseWire,
	ClipboardReadResponseWire,
	ClipboardWriteResponseWire,
} from './grpcClientMappersCatalog.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * ClipboardService.Write — `session_id`=1 `agent_id`=2 `label`=3 `type`=4
 * `content`=5 `file_path`=6 `url`=7.
 * proto3: empty strings / TEXT type=0 omitted.
 */
export function encodeClipboardWriteRequest(request: UniverseAgentWriteClipboardRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.label),
		encodeInt32Field(4, clipboardEntryTypeNumber(request.type)),
		encodeStringField(5, request.content),
		encodeStringField(6, request.filePath),
		encodeStringField(7, request.url),
	]);
}

/** ClipboardWriteResponse — `clip_id`=1. Unknown fields unread. */
export function decodeClipboardWriteResponse(bytes: Uint8Array): ClipboardWriteResponseWire {
	return {
		clip_id: lastString(readProtoFields(bytes), 1),
	};
}

/**
 * ClipboardService.Read — `session_id`=1 `clip_id`=2.
 * proto3: empty strings omitted.
 */
export function encodeClipboardReadRequest(request: UniverseAgentReadClipboardRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.clipId),
	]);
}

/** ClipboardReadResponse — `entry`=1. Unknown fields unread. */
export function decodeClipboardReadResponse(bytes: Uint8Array): ClipboardReadResponseWire {
	const entry = lastBytes(readProtoFields(bytes), 1);
	return {
		entry: entry ? decodeClipboardEntry(entry) : undefined,
	};
}

/**
 * ClipboardEntry — `clip_id`=1 `label`=2 `type`=3 `content`=4
 * `created_by`=5 `created_at`=6. TEXT type=0 omitted. Unknown fields unread.
 */
function decodeClipboardEntry(bytes: Uint8Array): ClipboardEntryWire {
	const fields = readProtoFields(bytes);
	return {
		clip_id: lastString(fields, 1),
		label: lastString(fields, 2),
		type: numberOrUndefined(lastVarint(fields, 3)),
		content: lastString(fields, 4),
		created_by: lastString(fields, 5),
		created_at: numberOrUndefined(lastVarint(fields, 6)),
	};
}

/** ClipboardService.List — `session_id`=1. proto3: empty string omitted. */
export function encodeClipboardListRequest(request: UniverseAgentListClipboardRequest): Uint8Array {
	return encodeStringField(1, request.sessionId);
}

/** ClipboardListResponse — repeated `entries`=1. Unknown fields unread. */
export function decodeClipboardListResponse(bytes: Uint8Array): ClipboardListResponseWire {
	return {
		entries: allLengthDelimited(readProtoFields(bytes), 1).map(decodeClipboardEntrySummary),
	};
}

/**
 * ClipboardEntrySummary — `clip_id`=1 `label`=2 `type`=3 `created_by`=4
 * `created_at`=5. TEXT type=0 omitted. Unknown fields unread.
 */
function decodeClipboardEntrySummary(bytes: Uint8Array): ClipboardEntrySummaryWire {
	const fields = readProtoFields(bytes);
	return {
		clip_id: lastString(fields, 1),
		label: lastString(fields, 2),
		type: numberOrUndefined(lastVarint(fields, 3)),
		created_by: lastString(fields, 4),
		created_at: numberOrUndefined(lastVarint(fields, 5)),
	};
}

/** ClipboardService.Clear — `session_id`=1. proto3: empty string omitted. */
export function encodeClipboardClearRequest(request: UniverseAgentClearClipboardRequest): Uint8Array {
	return encodeStringField(1, request.sessionId);
}

/** ClipboardClearResponse — `removed_count`=1. int32 0 omitted. Unknown fields unread. */
export function decodeClipboardClearResponse(bytes: Uint8Array): ClipboardClearResponseWire {
	return {
		removed_count: numberOrUndefined(lastVarint(readProtoFields(bytes), 1)),
	};
}

function clipboardEntryTypeNumber(type: UniverseAgentClipboardEntryType): number {
	switch (type) {
		case 'CLIPBOARD_FILE_PATH':
			return 1;
		case 'CLIPBOARD_URL':
			return 2;
		default:
			return 0;
	}
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentAgentMergeRequest,
	UniverseAgentForceWriteFileRequest,
	UniverseAgentGetFileInfoRequest,
	UniverseAgentListFilesRequest,
	UniverseAgentReadFileRequest,
	UniverseAgentWriteFileRequest,
} from '../../common/universeAgentTypes.js';
import type {
	AgentMergeResponseWire,
	GetFileInfoResponseWire,
	ListFilesResponseWire,
	ReadFileResponseWire,
	WriteFileResponseWire,
} from './grpcClientMappersCatalog.js';
import {
	allLengthDelimited,
	encodeBytesField,
	encodeInt32Field,
	encodeInt64Field,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * FileService.ListFiles — `path`=1 `session_id`=2 `recursive`=3 `pattern`=4 `max_results`=5.
 * proto3: empty string / false / 0 omitted.
 */
export function encodeListFilesRequest(request: UniverseAgentListFilesRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.path),
		encodeStringField(2, request.sessionId),
		encodeInt32Field(3, request.recursive === true ? 1 : 0),
		encodeStringField(4, request.pattern),
		encodeInt32Field(5, request.maxResults),
	]);
}

/**
 * ListFilesResponse — repeated `entries`=1 `total`=2.
 * FileEntry: `name`=1 `path`=2 `is_directory`=3 `size`=4 `last_modified`=5 `mime_type`=6.
 * Unknown fields unread.
 */
export function decodeListFilesResponse(bytes: Uint8Array): ListFilesResponseWire {
	const fields = readProtoFields(bytes);
	return {
		entries: allLengthDelimited(fields, 1).map(decodeFileEntry),
		total: numberOrUndefined(lastVarint(fields, 2)),
	};
}

function decodeFileEntry(bytes: Uint8Array): NonNullable<ListFilesResponseWire['entries']>[number] {
	const fields = readProtoFields(bytes);
	return {
		name: lastString(fields, 1),
		path: lastString(fields, 2),
		is_directory: lastVarint(fields, 3) === 1n,
		size: numberOrUndefined(lastVarint(fields, 4)),
		last_modified: numberOrUndefined(lastVarint(fields, 5)),
		mime_type: lastString(fields, 6),
	};
}

/**
 * FileService.ReadFile — `path`=1 `session_id`=2 `start_line`=3 `end_line`=4 `max_bytes`=5.
 * proto3: empty string / 0 omitted.
 */
export function encodeReadFileRequest(request: UniverseAgentReadFileRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.path),
		encodeStringField(2, request.sessionId),
		encodeInt32Field(3, request.startLine),
		encodeInt32Field(4, request.endLine),
		encodeInt64Field(5, request.maxBytes),
	]);
}

/**
 * ReadFileResponse — `content`=1 (bytes, not UTF-8) `total_size`=2 `mime_type`=3
 * `line_count`=4 `content_hash`=5. Wire `content` is base64 for the existing mapper.
 * Unknown fields unread.
 */
export function decodeReadFileResponse(bytes: Uint8Array): ReadFileResponseWire {
	const fields = readProtoFields(bytes);
	return {
		content: bytesAsBase64(lastBytes(fields, 1)),
		total_size: numberOrUndefined(lastVarint(fields, 2)),
		mime_type: lastString(fields, 3),
		line_count: numberOrUndefined(lastVarint(fields, 4)),
		content_hash: lastString(fields, 5),
	};
}

/**
 * FileService.GetFileInfo — `path`=1 `session_id`=2.
 * proto3: empty string omitted.
 */
export function encodeGetFileInfoRequest(request: UniverseAgentGetFileInfoRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.path),
		encodeStringField(2, request.sessionId),
	]);
}

/**
 * GetFileInfoResponse — `file`=1 (FileEntry 1–6). Unknown fields unread.
 */
export function decodeGetFileInfoResponse(bytes: Uint8Array): GetFileInfoResponseWire {
	const file = lastBytes(readProtoFields(bytes), 1);
	return {
		file: file ? decodeFileEntry(file) : undefined,
	};
}

/**
 * FileService.WriteFile — `path`=1 `content`=2 (bytes) `base_hash`=3 `session_id`=4
 * `base_content`=5 (bytes). proto3: empty string / empty bytes omitted.
 */
export function encodeWriteFileRequest(request: UniverseAgentWriteFileRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.path),
		encodeBytesField(2, request.content),
		encodeStringField(3, request.baseHash),
		encodeStringField(4, request.sessionId),
		encodeBytesField(5, request.baseContent),
	]);
}

/**
 * FileService.ForceWriteFile — `path`=1 `content`=2 (bytes) `session_id`=3.
 * proto3: empty string / empty bytes omitted.
 */
export function encodeForceWriteFileRequest(request: UniverseAgentForceWriteFileRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.path),
		encodeBytesField(2, request.content),
		encodeStringField(3, request.sessionId),
	]);
}

/**
 * WriteFileResponse — `status`=1 (SAVED=0 omit, MERGED=1, CONFLICT=2)
 * `new_hash`=2 `size`=3 `modified_at`=4 `current_content`=5 (bytes)
 * `current_hash`=6 `merged_content`=7 (bytes).
 * Bytes fields become base64 for the existing mapper. Unknown fields unread.
 */
export function decodeWriteFileResponse(bytes: Uint8Array): WriteFileResponseWire {
	const fields = readProtoFields(bytes);
	return {
		status: numberOrUndefined(lastVarint(fields, 1)),
		new_hash: lastString(fields, 2),
		size: numberOrUndefined(lastVarint(fields, 3)),
		modified_at: numberOrUndefined(lastVarint(fields, 4)),
		current_content: bytesAsBase64(lastBytes(fields, 5)),
		current_hash: lastString(fields, 6),
		merged_content: bytesAsBase64(lastBytes(fields, 7)),
	};
}

/**
 * FileService.AgentMerge — `session_id`=1 `path`=2 `base_content`=3 (bytes)
 * `current_content`=4 (bytes) `user_content`=5 (bytes).
 * proto3: empty string / empty bytes omitted.
 */
export function encodeAgentMergeRequest(request: UniverseAgentAgentMergeRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.path),
		encodeBytesField(3, request.baseContent),
		encodeBytesField(4, request.currentContent),
		encodeBytesField(5, request.userContent),
	]);
}

/**
 * AgentMergeResponse — `accepted`=1. proto3 false omitted. Unknown fields unread.
 */
export function decodeAgentMergeResponse(bytes: Uint8Array): AgentMergeResponseWire {
	return {
		accepted: lastVarint(readProtoFields(bytes), 1) === 1n,
	};
}

/** Proto bytes → existing File* Wire string (mapper `base64ToBytes`). Not UTF-8. */
function bytesAsBase64(bytes: Uint8Array | undefined): string | undefined {
	return bytes === undefined ? undefined : Buffer.from(bytes).toString('base64');
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

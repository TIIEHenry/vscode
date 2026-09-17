/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentUploadChunk, UniverseAgentUploadHeader } from '../../common/universeAgentTypes.js';
import type { UploadResponseWire } from './grpcClientMappersSession.js';
import {
	encodeBytesField,
	encodeInt32Field,
	encodeInt64Field,
	encodePresentMessageField,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * FileTransferService.UploadAttachment — stream `UploadChunk`.
 * JSON shape matches catalog `mapUploadChunkWire`: nested `header`,
 * `chunk` bytes, `offset`. proto field numbers from J
 * `file_transfer_service.proto` (do not invent):
 * `oneof data` `header`=1 / `chunk`=2; `offset`=3.
 * UploadHeader 1–9 (`queue_item_id`=9 optional). proto3 empty / 0 / false omitted.
 * Empty header object still writes oneof presence via encodePresentMessageField.
 */
export function encodeUploadChunk(chunk: UniverseAgentUploadChunk): Uint8Array {
	return Buffer.concat([
		chunk.header !== undefined ? encodePresentMessageField(1, encodeUploadHeader(chunk.header)) : Buffer.alloc(0),
		encodeBytesField(2, chunk.chunk),
		encodeInt64Field(3, chunk.offset),
	]);
}

/**
 * UploadResponse — `success`=1 `file_path`=2 `checksum_sha256`=3
 * `error_message`=4 `error_code`=5 (varint; mapper accepts number).
 * proto3: false / 0 / empty omitted. Unknown fields unread.
 * Shape matches JSON `UploadResponseWire`.
 */
export function decodeUploadResponse(bytes: Uint8Array): UploadResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		file_path: lastString(fields, 2),
		checksum_sha256: lastString(fields, 3),
		error_message: lastString(fields, 4),
		error_code: numberOrUndefined(lastVarint(fields, 5)),
	};
}

/**
 * UploadHeader — `transfer_id`=1 `filename`=2 `total_size`=3 `mime_type`=4
 * `checksum_sha256`=5 `is_precompressed`=6 `session_id`=7 `chunk_size`=8
 * optional `queue_item_id`=9. proto3 empty / 0 / false omitted.
 */
function encodeUploadHeader(header: UniverseAgentUploadHeader): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, header.transferId),
		encodeStringField(2, header.filename),
		encodeInt64Field(3, header.totalSize),
		encodeStringField(4, header.mimeType),
		encodeStringField(5, header.checksumSha256),
		encodeInt32Field(6, header.isPrecompressed ? 1 : 0),
		encodeStringField(7, header.sessionId),
		encodeInt32Field(8, header.chunkSize),
		encodeStringField(9, header.queueItemId),
	]);
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

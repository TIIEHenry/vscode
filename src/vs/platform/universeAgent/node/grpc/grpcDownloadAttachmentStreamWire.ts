/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentDownloadAttachmentRequest } from '../../common/universeAgentTypes.js';
import type { DownloadChunkWire } from './grpcClientMappersCatalog.js';
import {
	encodeInt64Field,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * FileTransferService.DownloadAttachment — `file_path`=1 `offset`=2 `max_bytes`=3
 * `session_id`=4 optional `artifact_id`=5.
 * proto3: empty string / 0 omitted. optional artifact omitted when undefined/empty.
 */
export function encodeDownloadAttachmentRequest(request: UniverseAgentDownloadAttachmentRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.filePath),
		encodeInt64Field(2, request.offset),
		encodeInt64Field(3, request.maxBytes),
		encodeStringField(4, request.sessionId),
		encodeStringField(5, request.artifactId),
	]);
}

/**
 * DownloadChunk — `offset`=1 `data`=2 (bytes) `total_size`=3 `is_last`=4
 * `checksum_sha256`=5.
 * proto3: 0 / false / empty omitted. Unknown fields unread.
 * Wire `data` is base64 for the existing mapper (`base64ToBytes`).
 */
export function decodeDownloadChunk(bytes: Uint8Array): DownloadChunkWire {
	const fields = readProtoFields(bytes);
	const isLast = lastVarint(fields, 4);
	return {
		offset: numberOrUndefined(lastVarint(fields, 1)),
		data: bytesAsBase64(lastBytes(fields, 2)),
		total_size: numberOrUndefined(lastVarint(fields, 3)),
		is_last: isLast === undefined ? undefined : isLast === 1n,
		checksum_sha256: lastString(fields, 5),
	};
}

/** Proto bytes → existing DownloadChunkWire string (mapper `base64ToBytes`). Not UTF-8. */
function bytesAsBase64(bytes: Uint8Array | undefined): string | undefined {
	return bytes === undefined ? undefined : Buffer.from(bytes).toString('base64');
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetUploadProgressRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of FileTransferService.UploadProgressResponse.
 * Mapper: `exists: wire.exists === true`, `bytesReceived: requiredInt64(wire.bytes_received)`,
 * `partialPath: wire.partial_path ?? ''` (mapUploadProgressResponse).
 */
export interface UploadProgressResponseWire {
	readonly exists?: boolean;
	readonly bytes_received?: number | string;
	readonly partial_path?: string;
}

/**
 * FileTransferService.GetUploadProgress — `transfer_id`=1 `session_id`=2.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeGetUploadProgressRequest(request: UniverseAgentGetUploadProgressRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.transferId),
		encodeStringField(2, request.sessionId),
	]);
}

/**
 * UploadProgressResponse — `exists`=1 `bytes_received`=2 `partial_path`=3.
 * proto3: false / 0 / empty omitted. Unknown fields unread.
 * Shape matches JSON UploadProgressResponseWire
 * `{ exists?: boolean; bytes_received?: number | string; partial_path?: string }`.
 */
export function decodeGetUploadProgressResponse(bytes: Uint8Array): UploadProgressResponseWire {
	const fields = readProtoFields(bytes);
	const exists = lastVarint(fields, 1);
	return {
		exists: exists === undefined ? undefined : exists === 1n,
		bytes_received: numberOrUndefined(lastVarint(fields, 2)),
		partial_path: lastString(fields, 3),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

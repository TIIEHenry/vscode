/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetRemoteSessionHistoryRequest } from '../../common/universeAgentTypes.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeStringField,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.GetRemoteSessionHistoryResponse.
 * Shape matches `GetRemoteSessionHistoryResponseWire` /
 * `mapGetRemoteSessionHistoryResponse`. `messages`=1 unread this slice
 * (no nested codecs).
 */
export interface GetRemoteSessionHistoryResponseWire {
	readonly version?: number | string;
	readonly has_more?: boolean;
}

/**
 * RemoteAgentService.GetRemoteSessionHistory — `call_id`=1
 * `since_version`=2 `page_size`=3.
 * proto3 / proto comment: empty strings / 0 omitted.
 * `since_version` via `encodeInt64Field`; `page_size` via `encodeInt32Field`.
 */
export function encodeGetRemoteSessionHistoryRequest(request: UniverseAgentGetRemoteSessionHistoryRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.callId),
		encodeInt64Field(2, request.sinceVersion),
		encodeInt32Field(3, request.pageSize),
	]);
}

/**
 * GetRemoteSessionHistoryResponse — repeated `messages`=1 unread this
 * slice (no nested codecs) `version`=2 `has_more`=3.
 * proto3: empty / 0 / false omitted. Unknown fields unread.
 * Shape matches GetRemoteSessionHistoryResponseWire /
 * `mapGetRemoteSessionHistoryResponse` (missing messages → []).
 */
export function decodeGetRemoteSessionHistoryResponse(bytes: Uint8Array): GetRemoteSessionHistoryResponseWire {
	const fields = readProtoFields(bytes);
	const hasMore = lastVarint(fields, 3);
	return {
		version: numberOrUndefined(lastVarint(fields, 2)),
		has_more: hasMore === undefined ? undefined : hasMore === 1n,
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

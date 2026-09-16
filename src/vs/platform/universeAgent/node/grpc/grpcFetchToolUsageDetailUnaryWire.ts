/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentFetchToolUsageDetailRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.FetchToolUsageDetailResponse.
 * Mapper: `mapFetchToolUsageDetailResponse` (`ok: wire.success === true`).
 * `context_sources` unused unread this slice.
 */
export interface FetchToolUsageDetailResponseWire {
	readonly success?: boolean;
	readonly tool_call_id?: string;
	readonly error_message?: string;
}

/**
 * AgentService.FetchToolUsageDetail — `session_id`=1 `tool_call_id`=2.
 * proto3: empty strings omitted.
 */
export function encodeFetchToolUsageDetailRequest(request: UniverseAgentFetchToolUsageDetailRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.toolCallId),
	]);
}

/**
 * FetchToolUsageDetailResponse — `success`=1 `tool_call_id`=2
 * repeated `context_sources`=3 unused unread this slice
 * `error_message`=4.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches `FetchToolUsageDetailResponseWire` / `mapFetchToolUsageDetailResponse`.
 */
export function decodeFetchToolUsageDetailResponse(bytes: Uint8Array): FetchToolUsageDetailResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		tool_call_id: lastString(fields, 2),
		error_message: lastString(fields, 4),
	};
}

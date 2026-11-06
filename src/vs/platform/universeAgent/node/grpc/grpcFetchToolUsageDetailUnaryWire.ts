/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentFetchToolUsageDetailRequest } from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.FetchToolUsageDetailResponse.
 * Mapper: `mapFetchToolUsageDetailResponse` (`ok: wire.success === true`).
 * Decode fills `source_type` with the varint number; the mapper also accepts the enum name.
 */
export interface FetchToolUsageDetailResponseWire {
	readonly success?: boolean;
	readonly tool_call_id?: string;
	readonly context_sources?: ContextSourceUsageWire[];
	readonly error_message?: string;
}

export interface ContextSourceUsageWire {
	source_type?: string | number;
	source_agent_id?: string;
	source_scope_id?: string;
	message_id?: string;
	estimated_tokens?: number | string;
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
 * repeated `context_sources`=3 (`source_type`=1 `source_agent_id`=2
 * `source_scope_id`=3 `message_id`=4 `estimated_tokens`=5)
 * `error_message`=4.
 * proto3: false / empty / 0 omitted. Unknown fields unread.
 * Shape matches `FetchToolUsageDetailResponseWire` / `mapFetchToolUsageDetailResponse`.
 */
export function decodeFetchToolUsageDetailResponse(bytes: Uint8Array): FetchToolUsageDetailResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		tool_call_id: lastString(fields, 2),
		context_sources: allLengthDelimited(fields, 3).map(decodeContextSourceUsage),
		error_message: lastString(fields, 4),
	};
}

function decodeContextSourceUsage(bytes: Uint8Array): ContextSourceUsageWire {
	const fields = readProtoFields(bytes);
	return {
		source_type: numberOrUndefined(lastVarint(fields, 1)),
		source_agent_id: lastString(fields, 2),
		source_scope_id: lastString(fields, 3),
		message_id: lastString(fields, 4),
		estimated_tokens: numberOrUndefined(lastVarint(fields, 5)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

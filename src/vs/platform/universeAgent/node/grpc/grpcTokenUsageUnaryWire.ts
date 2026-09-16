/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetSessionUsageRequest } from '../../common/universeAgentTypes.js';
import type {
	GetGlobalUsageResponseWire,
	GetSessionUsageResponseWire,
	TokenUsageDataWire,
} from './grpcClientMappersCatalog.js';
import {
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * TokenUsageService.GetSessionUsage — `session_id`=1.
 * proto3: empty string omitted.
 */
export function encodeGetSessionUsageRequest(request: UniverseAgentGetSessionUsageRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
	]);
}

/**
 * GetSessionUsageResponse — `usage`=1 (TokenUsageData).
 * TokenUsageData: `input_tokens`=1 `output_tokens`=2 `thinking_tokens`=3
 * `cache_read_tokens`=4 `cache_write_tokens`=5 `total_cost_micros`=6
 * `currency`=7 `request_count`=8. Unknown fields unread.
 * Shape matches `mapGetSessionUsageResponse` input.
 */
export function decodeGetSessionUsageResponse(bytes: Uint8Array): GetSessionUsageResponseWire {
	const usage = lastBytes(readProtoFields(bytes), 1);
	return {
		usage: usage ? decodeTokenUsageData(usage) : undefined,
	};
}

/**
 * TokenUsageService.GetGlobalUsage — `GetGlobalUsageRequest` reserved 1-10:
 * empty payload, no reserved fields encoded. proto3 empty message: 0 payload
 * bytes, never JSON `{}`.
 */
export function encodeGetGlobalUsageRequest(): Uint8Array {
	return new Uint8Array(0);
}

/**
 * GetGlobalUsageResponse — `usage`=1 (TokenUsageData 1–8). Unknown fields unread.
 * Shape matches `mapGetGlobalUsageResponse` input.
 */
export function decodeGetGlobalUsageResponse(bytes: Uint8Array): GetGlobalUsageResponseWire {
	const usage = lastBytes(readProtoFields(bytes), 1);
	return {
		usage: usage ? decodeTokenUsageData(usage) : undefined,
	};
}

function decodeTokenUsageData(bytes: Uint8Array): TokenUsageDataWire {
	const fields = readProtoFields(bytes);
	return {
		input_tokens: numberOrUndefined(lastVarint(fields, 1)),
		output_tokens: numberOrUndefined(lastVarint(fields, 2)),
		thinking_tokens: numberOrUndefined(lastVarint(fields, 3)),
		cache_read_tokens: numberOrUndefined(lastVarint(fields, 4)),
		cache_write_tokens: numberOrUndefined(lastVarint(fields, 5)),
		total_cost_micros: numberOrUndefined(lastVarint(fields, 6)),
		currency: lastString(fields, 7),
		request_count: numberOrUndefined(lastVarint(fields, 8)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

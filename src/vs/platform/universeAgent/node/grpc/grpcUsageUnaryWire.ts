/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentUsageRequest } from '../../common/universeAgentTypes.js';
import type { RecentRequestSpanWire } from './grpcClientMappersSession.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.UsageResponse fields 1–4.
 * Shape matches `mapUsageResponse` input for those fields.
 */
export interface AgentUsageWire {
	readonly agent_id?: string;
	readonly input_tokens?: number;
	readonly output_tokens?: number;
	readonly turns?: number;
}

/**
 * JSON-shaped decode of AgentService.UsageResponse.
 * Reads 1–4 and nested `recent_request_spans`=12 (RecentRequestSpan 1–9).
 * `context_window`=10 `session_usage`=11 unread (nested too deep; not this type).
 */
export interface UsageResponseWire {
	readonly total_input_tokens?: number;
	readonly total_output_tokens?: number;
	readonly total_turns?: number;
	readonly agent_usages?: AgentUsageWire[];
	readonly recent_request_spans?: RecentRequestSpanWire[];
}

/**
 * AgentService.Usage — `session_id`=1 `agent_id`=2 (empty agent = session rollup).
 * proto3: empty strings omitted.
 */
export function encodeUsageRequest(request: UniverseAgentUsageRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}

/**
 * UsageResponse — `total_input_tokens`=1 `total_output_tokens`=2 `total_turns`=3
 * repeated `agent_usages`=4 (AgentUsage: `agent_id`=1 `input_tokens`=2
 * `output_tokens`=3 `turns`=4). Nested repeated `recent_request_spans`=12
 * RecentRequestSpan (`profile_id`=1 `provider`=2 `model_id`=3
 * `input_tokens`=4 `output_tokens`=5 `prefill_ms`=6 `decode_ms`=7
 * `completed_at_ms`=8 `usage_kind`=9). proto3: empty / 0 omitted.
 * Unknown fields unread (including `context_window`=10 `session_usage`=11).
 * Shape matches `mapUsageResponse` input for 1–4 and 12.
 */
export function decodeUsageResponse(bytes: Uint8Array): UsageResponseWire {
	const fields = readProtoFields(bytes);
	return {
		total_input_tokens: numberOrUndefined(lastVarint(fields, 1)),
		total_output_tokens: numberOrUndefined(lastVarint(fields, 2)),
		total_turns: numberOrUndefined(lastVarint(fields, 3)),
		agent_usages: allLengthDelimited(fields, 4).map(decodeAgentUsage),
		recent_request_spans: allLengthDelimited(fields, 12).map(decodeRecentRequestSpan),
	};
}

function decodeAgentUsage(bytes: Uint8Array): AgentUsageWire {
	const fields = readProtoFields(bytes);
	return {
		agent_id: lastString(fields, 1),
		input_tokens: numberOrUndefined(lastVarint(fields, 2)),
		output_tokens: numberOrUndefined(lastVarint(fields, 3)),
		turns: numberOrUndefined(lastVarint(fields, 4)),
	};
}

function decodeRecentRequestSpan(bytes: Uint8Array): RecentRequestSpanWire {
	const fields = readProtoFields(bytes);
	return {
		profile_id: lastString(fields, 1),
		provider: lastString(fields, 2),
		model_id: lastString(fields, 3),
		input_tokens: numberOrUndefined(lastVarint(fields, 4)),
		output_tokens: numberOrUndefined(lastVarint(fields, 5)),
		prefill_ms: numberOrUndefined(lastVarint(fields, 6)),
		decode_ms: numberOrUndefined(lastVarint(fields, 7)),
		completed_at_ms: numberOrUndefined(lastVarint(fields, 8)),
		usage_kind: lastString(fields, 9),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

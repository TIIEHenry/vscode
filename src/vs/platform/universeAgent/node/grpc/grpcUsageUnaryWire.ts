/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentUsageRequest } from '../../common/universeAgentTypes.js';
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
 * Reads 1–4 only. `context_window`=10 `session_usage`=11 unread (nested too deep).
 * `recent_request_spans` unread (no invented field number).
 */
export interface UsageResponseWire {
	readonly total_input_tokens?: number;
	readonly total_output_tokens?: number;
	readonly total_turns?: number;
	readonly agent_usages?: AgentUsageWire[];
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
 * `output_tokens`=3 `turns`=4). proto3: empty / 0 omitted. Unknown fields unread
 * (including 10 / 11). Shape matches `mapUsageResponse` input for 1–4.
 */
export function decodeUsageResponse(bytes: Uint8Array): UsageResponseWire {
	const fields = readProtoFields(bytes);
	return {
		total_input_tokens: numberOrUndefined(lastVarint(fields, 1)),
		total_output_tokens: numberOrUndefined(lastVarint(fields, 2)),
		total_turns: numberOrUndefined(lastVarint(fields, 3)),
		agent_usages: allLengthDelimited(fields, 4).map(decodeAgentUsage),
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

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

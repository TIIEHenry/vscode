/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentUsageRequest } from '../../common/universeAgentTypes.js';
import type {
	AgentUsageDetailWire,
	CacheInfoWire,
	CompactInfoWire,
	ContextWindowInfoWire,
	FixedOverheadInfoWire,
	MessageBreakdownInfoWire,
	ModelUsageWire,
	ProfileUsageWire,
	RecentRequestSpanWire,
	SessionUsageInfoWire,
	SystemPromptPartInfoWire,
} from './grpcClientMappersSession.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastBytes,
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
 * Reads 1–4, nested `context_window`=10, `session_usage`=11, and
 * `recent_request_spans`=12. Missing optional nested 10/11 omit the key.
 * Shape matches `mapUsageResponse`.
 */
export interface UsageResponseWire {
	readonly total_input_tokens?: number;
	readonly total_output_tokens?: number;
	readonly total_turns?: number;
	readonly agent_usages?: AgentUsageWire[];
	readonly context_window?: ContextWindowInfoWire;
	readonly session_usage?: SessionUsageInfoWire;
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
 * repeated `agent_usages`=4 (agent row: `agent_id`=1 `input_tokens`=2
 * `output_tokens`=3 `turns`=4). Nested `context_window`=10 (scalars 1–4;
 * nested `breakdown`=5 `compact`=6 `cache`=7 `fixed_overhead`=8; repeated
 * `system_prompt_parts`=9 part 1–5). Nested `session_usage`=11 (totals 1–7;
 * repeated `model_usages`=8 `agent_details`=9 `profile_usages`=10).
 * breakdown 1–9; compact 1–4; cache 1–2; fixed_overhead 1–6; model row 1–8;
 * agent detail 1–8; profile 1–19 (`has_post_switch_chat`=16 bool varint 1,
 * 0 omit; recall 17–19). Nested repeated `recent_request_spans`=12
 * (`profile_id`=1 `provider`=2 `model_id`=3 `input_tokens`=4
 * `output_tokens`=5 `prefill_ms`=6 `decode_ms`=7 `completed_at_ms`=8
 * `usage_kind`=9). proto3: empty / 0 / false omitted. Unknown fields unread.
 * Shape matches `mapUsageResponse`.
 */
export function decodeUsageResponse(bytes: Uint8Array): UsageResponseWire {
	const fields = readProtoFields(bytes);
	const contextWindow = lastBytes(fields, 10);
	const sessionUsage = lastBytes(fields, 11);
	return {
		total_input_tokens: numberOrUndefined(lastVarint(fields, 1)),
		total_output_tokens: numberOrUndefined(lastVarint(fields, 2)),
		total_turns: numberOrUndefined(lastVarint(fields, 3)),
		agent_usages: allLengthDelimited(fields, 4).map(decodeAgentUsage),
		...(contextWindow === undefined ? {} : { context_window: decodeContextWindow(contextWindow) }),
		...(sessionUsage === undefined ? {} : { session_usage: decodeSessionUsage(sessionUsage) }),
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

function decodeContextWindow(bytes: Uint8Array): ContextWindowInfoWire {
	const fields = readProtoFields(bytes);
	const breakdown = lastBytes(fields, 5);
	const compact = lastBytes(fields, 6);
	const cache = lastBytes(fields, 7);
	const fixedOverhead = lastBytes(fields, 8);
	return {
		context_window_size: numberOrUndefined(lastVarint(fields, 1)),
		estimated_context_tokens: numberOrUndefined(lastVarint(fields, 2)),
		model_name: lastString(fields, 3),
		message_count: numberOrUndefined(lastVarint(fields, 4)),
		...(breakdown === undefined ? {} : { breakdown: decodeBreakdown(breakdown) }),
		...(compact === undefined ? {} : { compact: decodeCompact(compact) }),
		...(cache === undefined ? {} : { cache: decodeCache(cache) }),
		...(fixedOverhead === undefined ? {} : { fixed_overhead: decodeFixedOverhead(fixedOverhead) }),
		system_prompt_parts: allLengthDelimited(fields, 9).map(decodeSystemPromptPart),
	};
}

function decodeBreakdown(bytes: Uint8Array): MessageBreakdownInfoWire {
	const fields = readProtoFields(bytes);
	return {
		system_prompt_tokens: numberOrUndefined(lastVarint(fields, 1)),
		user_message_count: numberOrUndefined(lastVarint(fields, 2)),
		user_message_tokens: numberOrUndefined(lastVarint(fields, 3)),
		assistant_count: numberOrUndefined(lastVarint(fields, 4)),
		assistant_tokens: numberOrUndefined(lastVarint(fields, 5)),
		tool_result_count: numberOrUndefined(lastVarint(fields, 6)),
		tool_result_tokens: numberOrUndefined(lastVarint(fields, 7)),
		compact_notice_count: numberOrUndefined(lastVarint(fields, 8)),
		compact_notice_tokens: numberOrUndefined(lastVarint(fields, 9)),
	};
}

function decodeCompact(bytes: Uint8Array): CompactInfoWire {
	const fields = readProtoFields(bytes);
	return {
		compact_count: numberOrUndefined(lastVarint(fields, 1)),
		last_compact_tokens_before: numberOrUndefined(lastVarint(fields, 2)),
		last_compact_tokens_after: numberOrUndefined(lastVarint(fields, 3)),
		last_compact_time_ms: numberOrUndefined(lastVarint(fields, 4)),
	};
}

function decodeCache(bytes: Uint8Array): CacheInfoWire {
	const fields = readProtoFields(bytes);
	return {
		total_cache_read_tokens: numberOrUndefined(lastVarint(fields, 1)),
		total_cache_creation_tokens: numberOrUndefined(lastVarint(fields, 2)),
	};
}

function decodeFixedOverhead(bytes: Uint8Array): FixedOverheadInfoWire {
	const fields = readProtoFields(bytes);
	return {
		tool_definition_tokens: numberOrUndefined(lastVarint(fields, 1)),
		tool_definition_count: numberOrUndefined(lastVarint(fields, 2)),
		skill_inject_tokens: numberOrUndefined(lastVarint(fields, 3)),
		mcp_tool_tokens: numberOrUndefined(lastVarint(fields, 4)),
		memory_inject_tokens: numberOrUndefined(lastVarint(fields, 5)),
		rules_inject_tokens: numberOrUndefined(lastVarint(fields, 6)),
	};
}

function decodeSystemPromptPart(bytes: Uint8Array): SystemPromptPartInfoWire {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1),
		label: lastString(fields, 2),
		tokens: numberOrUndefined(lastVarint(fields, 3)),
		cache_scope: lastString(fields, 4),
		volatility: lastString(fields, 5),
	};
}

function decodeSessionUsage(bytes: Uint8Array): SessionUsageInfoWire {
	const fields = readProtoFields(bytes);
	return {
		total_input_tokens: numberOrUndefined(lastVarint(fields, 1)),
		total_output_tokens: numberOrUndefined(lastVarint(fields, 2)),
		total_thinking_tokens: numberOrUndefined(lastVarint(fields, 3)),
		total_cache_read_tokens: numberOrUndefined(lastVarint(fields, 4)),
		total_cache_creation_tokens: numberOrUndefined(lastVarint(fields, 5)),
		total_tokens: numberOrUndefined(lastVarint(fields, 6)),
		total_turns: numberOrUndefined(lastVarint(fields, 7)),
		model_usages: allLengthDelimited(fields, 8).map(decodeModelUsage),
		agent_details: allLengthDelimited(fields, 9).map(decodeAgentDetail),
		profile_usages: allLengthDelimited(fields, 10).map(decodeProfileUsage),
	};
}

function decodeModelUsage(bytes: Uint8Array): ModelUsageWire {
	const fields = readProtoFields(bytes);
	return {
		model_id: lastString(fields, 1),
		model_name: lastString(fields, 2),
		provider: lastString(fields, 3),
		input_tokens: numberOrUndefined(lastVarint(fields, 4)),
		output_tokens: numberOrUndefined(lastVarint(fields, 5)),
		thinking_tokens: numberOrUndefined(lastVarint(fields, 6)),
		total_tokens: numberOrUndefined(lastVarint(fields, 7)),
		turn_count: numberOrUndefined(lastVarint(fields, 8)),
	};
}

function decodeAgentDetail(bytes: Uint8Array): AgentUsageDetailWire {
	const fields = readProtoFields(bytes);
	return {
		agent_id: lastString(fields, 1),
		agent_type: lastString(fields, 2),
		model_id: lastString(fields, 3),
		input_tokens: numberOrUndefined(lastVarint(fields, 4)),
		output_tokens: numberOrUndefined(lastVarint(fields, 5)),
		thinking_tokens: numberOrUndefined(lastVarint(fields, 6)),
		total_tokens: numberOrUndefined(lastVarint(fields, 7)),
		turn_count: numberOrUndefined(lastVarint(fields, 8)),
	};
}

function decodeProfileUsage(bytes: Uint8Array): ProfileUsageWire {
	const fields = readProtoFields(bytes);
	return {
		profile_id: lastString(fields, 1),
		profile_name: lastString(fields, 2),
		provider: lastString(fields, 3),
		model_id: lastString(fields, 4),
		chat_input_tokens: numberOrUndefined(lastVarint(fields, 5)),
		chat_output_tokens: numberOrUndefined(lastVarint(fields, 6)),
		compact_input_tokens: numberOrUndefined(lastVarint(fields, 7)),
		compact_output_tokens: numberOrUndefined(lastVarint(fields, 8)),
		thinking_tokens: numberOrUndefined(lastVarint(fields, 9)),
		cache_read_tokens: numberOrUndefined(lastVarint(fields, 10)),
		cache_creation_tokens: numberOrUndefined(lastVarint(fields, 11)),
		total_tokens: numberOrUndefined(lastVarint(fields, 12)),
		conversation_turn_count: numberOrUndefined(lastVarint(fields, 13)),
		llm_request_count: numberOrUndefined(lastVarint(fields, 14)),
		compact_request_count: numberOrUndefined(lastVarint(fields, 15)),
		has_post_switch_chat: lastVarint(fields, 16) === 1n,
		recall_input_tokens: numberOrUndefined(lastVarint(fields, 17)),
		recall_output_tokens: numberOrUndefined(lastVarint(fields, 18)),
		recall_request_count: numberOrUndefined(lastVarint(fields, 19)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapUsageResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeUsageResponse,
	encodeUsageRequest,
} from '../../node/grpc/grpcUsageUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService Usage protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeUsageRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodeUsageRequest({
			sessionId: 'sess-1',
			agentId: 'ag-9',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'ag-9',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'ag-9',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const rollup = encodeUsageRequest({
			sessionId: 'sess-1',
			agentId: '',
		});
		assert.strictEqual(protoStrings(rollup).get(1), 'sess-1');
		assert.ok(!protoStrings(rollup).has(2));
		assert.notStrictEqual(rollup[0], 0x7b);

		assert.strictEqual(encodeUsageRequest({
			sessionId: '',
			agentId: '',
		}).length, 0);
	});

	test('decodeUsageResponse reads 1-4, nested context_window=10 session_usage=11, recent_request_spans=12; filled + sparse + omitted', () => {
		const agent = Buffer.concat([
			encodeStringField(1, 'ag-1'),
			encodeInt64Field(2, 11),
			encodeInt64Field(3, 22),
			encodeInt32Field(4, 4),
			encodeStringField(5, 'unused-agent'),
		]);
		const span = Buffer.concat([
			encodeStringField(1, 'prof-1'),
			encodeStringField(2, 'openai'),
			encodeStringField(3, 'gpt-4'),
			encodeInt64Field(4, 100),
			encodeInt64Field(5, 50),
			encodeInt64Field(6, 12),
			encodeInt64Field(7, 34),
			encodeInt64Field(8, 1700000000),
			encodeStringField(9, 'chat'),
			encodeStringField(10, 'unused-span'),
		]);
		const sparseSpan = encodeStringField(1, 'prof-sparse');
		const encoded = Buffer.concat([
			encodeInt64Field(1, 1),
			encodeInt64Field(2, 2),
			encodeInt32Field(3, 3),
			encodeMessageField(4, agent),
			encodeStringField(5, 'unused-field'),
			encodeMessageField(10, encodeInt64Field(1, 1)),
			encodeMessageField(10, filledContextWindowBytes()),
			encodeMessageField(11, encodeInt64Field(1, 9)),
			encodeMessageField(11, filledSessionUsageBytes()),
			encodeMessageField(12, span),
			encodeMessageField(12, sparseSpan),
			encodeStringField(13, 'unused-extra'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeUsageResponse(encoded);
		assert.deepStrictEqual(wire, {
			total_input_tokens: 1,
			total_output_tokens: 2,
			total_turns: 3,
			agent_usages: [{
				agent_id: 'ag-1',
				input_tokens: 11,
				output_tokens: 22,
				turns: 4,
			}],
			context_window: filledContextWindowWire(),
			session_usage: filledSessionUsageWire(),
			recent_request_spans: [{
				profile_id: 'prof-1',
				provider: 'openai',
				model_id: 'gpt-4',
				input_tokens: 100,
				output_tokens: 50,
				prefill_ms: 12,
				decode_ms: 34,
				completed_at_ms: 1700000000,
				usage_kind: 'chat',
			}, {
				profile_id: 'prof-sparse',
				provider: undefined,
				model_id: undefined,
				input_tokens: undefined,
				output_tokens: undefined,
				prefill_ms: undefined,
				decode_ms: undefined,
				completed_at_ms: undefined,
				usage_kind: undefined,
			}],
		});
		assert.ok('context_window' in wire);
		assert.ok('session_usage' in wire);
		assert.ok('breakdown' in (wire.context_window ?? {}));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapUsageResponse(wire), {
			totalInputTokens: 1,
			totalOutputTokens: 2,
			totalTurns: 3,
			agentUsages: [{
				agentId: 'ag-1',
				inputTokens: 11,
				outputTokens: 22,
				turns: 4,
			}],
			contextWindow: filledContextWindowMapped(),
			sessionUsage: filledSessionUsageMapped(),
			recentRequestSpans: [{
				profileId: 'prof-1',
				provider: 'openai',
				modelId: 'gpt-4',
				inputTokens: 100,
				outputTokens: 50,
				prefillMs: 12,
				decodeMs: 34,
				completedAtMs: 1700000000,
				usageKind: 'chat',
			}, {
				profileId: 'prof-sparse',
				provider: '',
				modelId: '',
				inputTokens: 0,
				outputTokens: 0,
				prefillMs: 0,
				decodeMs: 0,
				completedAtMs: 0,
				usageKind: '',
			}],
		});

		const sparse = decodeUsageResponse(Buffer.concat([
			encodeMessageField(10, encodeInt64Field(1, 4096)),
			encodeMessageField(11, encodeInt64Field(1, 7)),
		]));
		assert.deepStrictEqual(sparse, {
			total_input_tokens: undefined,
			total_output_tokens: undefined,
			total_turns: undefined,
			agent_usages: [],
			context_window: {
				context_window_size: 4096,
				estimated_context_tokens: undefined,
				model_name: undefined,
				message_count: undefined,
				system_prompt_parts: [],
			},
			session_usage: {
				total_input_tokens: 7,
				total_output_tokens: undefined,
				total_thinking_tokens: undefined,
				total_cache_read_tokens: undefined,
				total_cache_creation_tokens: undefined,
				total_tokens: undefined,
				total_turns: undefined,
				model_usages: [],
				agent_details: [],
				profile_usages: [],
			},
			recent_request_spans: [],
		});
		assert.ok(!('breakdown' in (sparse.context_window ?? {})));
		assert.ok(!('compact' in (sparse.context_window ?? {})));
		assert.ok(!('cache' in (sparse.context_window ?? {})));
		assert.ok(!('fixed_overhead' in (sparse.context_window ?? {})));
		assert.deepStrictEqual(mapUsageResponse(sparse), {
			totalInputTokens: 0,
			totalOutputTokens: 0,
			totalTurns: 0,
			agentUsages: [],
			contextWindow: {
				contextWindowSize: 4096,
				estimatedContextTokens: 0,
				modelName: '',
				messageCount: 0,
				breakdown: undefined,
				compact: undefined,
				cache: undefined,
				fixedOverhead: undefined,
				systemPromptParts: [],
			},
			sessionUsage: {
				totalInputTokens: 7,
				totalOutputTokens: 0,
				totalThinkingTokens: 0,
				totalCacheReadTokens: 0,
				totalCacheCreationTokens: 0,
				totalTokens: 0,
				totalTurns: 0,
				modelUsages: [],
				agentDetails: [],
				profileUsages: [],
			},
			recentRequestSpans: [],
		});

		const omittedZeros = decodeUsageResponse(encodeMessageField(4, encodeStringField(1, 'ag-only')));
		assert.deepStrictEqual(omittedZeros, {
			total_input_tokens: undefined,
			total_output_tokens: undefined,
			total_turns: undefined,
			agent_usages: [{
				agent_id: 'ag-only',
				input_tokens: undefined,
				output_tokens: undefined,
				turns: undefined,
			}],
			recent_request_spans: [],
		});
		assert.ok(!('context_window' in omittedZeros));
		assert.ok(!('session_usage' in omittedZeros));
		assert.deepStrictEqual(mapUsageResponse(omittedZeros), {
			totalInputTokens: 0,
			totalOutputTokens: 0,
			totalTurns: 0,
			agentUsages: [{
				agentId: 'ag-only',
				inputTokens: 0,
				outputTokens: 0,
				turns: 0,
			}],
			contextWindow: undefined,
			sessionUsage: undefined,
			recentRequestSpans: [],
		});

		const second = Buffer.concat([
			encodeStringField(1, 'ag-2'),
			encodeInt64Field(2, 7),
		]);
		const repeated = decodeUsageResponse(Buffer.concat([
			encodeMessageField(4, encodeStringField(1, 'ag-1')),
			encodeMessageField(4, second),
		]));
		assert.deepStrictEqual(repeated.agent_usages?.map(item => item.agent_id), ['ag-1', 'ag-2']);
		assert.strictEqual(mapUsageResponse(repeated).agentUsages.length, 2);

		const empty = decodeUsageResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			total_input_tokens: undefined,
			total_output_tokens: undefined,
			total_turns: undefined,
			agent_usages: [],
			recent_request_spans: [],
		});
		assert.ok(!('context_window' in empty));
		assert.ok(!('session_usage' in empty));
		assert.deepStrictEqual(mapUsageResponse(empty), {
			totalInputTokens: 0,
			totalOutputTokens: 0,
			totalTurns: 0,
			agentUsages: [],
			contextWindow: undefined,
			sessionUsage: undefined,
			recentRequestSpans: [],
		});
	});

	test('usage unary wire is Usage only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcUsageUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeUsageRequest\b/.test(source));
		assert.ok(/\bdecodeUsageResponse\b/.test(source));
		assert.ok(/\bdecodeRecentRequestSpan\b/.test(source));
		assert.ok(/\bdecodeContextWindow\b/.test(source));
		assert.ok(/\bdecodeSessionUsage\b/.test(source));
		assert.ok(/\blastBytes\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(/\bContextWindowInfoWire\b/.test(source));
		assert.ok(/\bSessionUsageInfoWire\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b|\bResolveAnchor\b/.test(source));
		assert.ok(!/\bPty\b/.test(source));
		assert.ok(!/\bContextWindowInfo\b|\bSessionUsageInfo\b|\bMessageBreakdown\b/.test(source));
		assert.ok(!/\bmodel_info\b|\bdecodeModelInfo\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('getUsage uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const body = extractAsyncMethod(source, 'getUsage');
		assert.ok(body.includes('makeUnaryBytesClient'), 'getUsage must use makeUnaryBytesClient');
		assert.ok(body.includes('encodeUsageRequest'), 'getUsage must call encodeUsageRequest');
		assert.ok(body.includes('decodeUsageResponse'), 'getUsage must call decodeUsageResponse');
		assert.ok(body.includes('mapUsageResponse'), 'getUsage still calls mapUsageResponse');
		assert.ok(!body.includes('makeUnaryClient<'), 'getUsage must not use JSON makeUnaryClient');
		assert.ok(!body.includes('JSON.stringify'), 'getUsage must not JSON.stringify');

		assert.ok(source.includes('grpcUsageUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

function filledContextWindowBytes(): Uint8Array {
	return Buffer.concat([
		encodeInt64Field(1, 128000),
		encodeInt64Field(2, 9000),
		encodeStringField(3, 'gpt-4'),
		encodeInt32Field(4, 12),
		encodeMessageField(5, Buffer.concat([
			encodeInt64Field(1, 100),
			encodeInt32Field(2, 2),
			encodeInt64Field(3, 200),
			encodeInt32Field(4, 3),
			encodeInt64Field(5, 300),
			encodeInt32Field(6, 4),
			encodeInt64Field(7, 400),
			encodeInt32Field(8, 1),
			encodeInt64Field(9, 50),
			encodeStringField(10, 'unused-breakdown'),
		])),
		encodeMessageField(6, Buffer.concat([
			encodeInt32Field(1, 2),
			encodeInt64Field(2, 8000),
			encodeInt64Field(3, 4000),
			encodeInt64Field(4, 1700000001),
		])),
		encodeMessageField(7, Buffer.concat([
			encodeInt64Field(1, 10),
			encodeInt64Field(2, 20),
		])),
		encodeMessageField(8, Buffer.concat([
			encodeInt64Field(1, 111),
			encodeInt32Field(2, 5),
			encodeInt64Field(3, 22),
			encodeInt64Field(4, 33),
			encodeInt64Field(5, 44),
			encodeInt64Field(6, 55),
		])),
		encodeMessageField(9, Buffer.concat([
			encodeStringField(1, 'sys'),
			encodeStringField(2, 'System'),
			encodeInt64Field(3, 80),
			encodeStringField(4, 'stable'),
			encodeStringField(5, 'low'),
		])),
		encodeStringField(10, 'unused-window'),
	]);
}

function filledSessionUsageBytes(): Uint8Array {
	return Buffer.concat([
		encodeInt64Field(1, 1000),
		encodeInt64Field(2, 200),
		encodeInt64Field(3, 30),
		encodeInt64Field(4, 40),
		encodeInt64Field(5, 50),
		encodeInt64Field(6, 1320),
		encodeInt32Field(7, 6),
		encodeMessageField(8, Buffer.concat([
			encodeStringField(1, 'm-1'),
			encodeStringField(2, 'Model One'),
			encodeStringField(3, 'openai'),
			encodeInt64Field(4, 10),
			encodeInt64Field(5, 20),
			encodeInt64Field(6, 3),
			encodeInt64Field(7, 33),
			encodeInt32Field(8, 2),
		])),
		encodeMessageField(9, Buffer.concat([
			encodeStringField(1, 'ag-d'),
			encodeStringField(2, 'coder'),
			encodeStringField(3, 'm-1'),
			encodeInt64Field(4, 11),
			encodeInt64Field(5, 21),
			encodeInt64Field(6, 4),
			encodeInt64Field(7, 36),
			encodeInt32Field(8, 1),
		])),
		encodeMessageField(10, Buffer.concat([
			encodeStringField(1, 'p-1'),
			encodeStringField(2, 'Primary'),
			encodeStringField(3, 'openai'),
			encodeStringField(4, 'gpt-4'),
			encodeInt64Field(5, 15),
			encodeInt64Field(6, 25),
			encodeInt64Field(7, 5),
			encodeInt64Field(8, 6),
			encodeInt64Field(9, 7),
			encodeInt64Field(10, 8),
			encodeInt64Field(11, 9),
			encodeInt64Field(12, 75),
			encodeInt32Field(13, 3),
			encodeInt32Field(14, 4),
			encodeInt32Field(15, 1),
			encodeInt32Field(16, 1),
			encodeInt64Field(17, 17),
			encodeInt64Field(18, 18),
			encodeInt32Field(19, 2),
			encodeStringField(20, 'unused-profile'),
		])),
		encodeStringField(11, 'unused-session'),
	]);
}

function filledContextWindowWire() {
	return {
		context_window_size: 128000,
		estimated_context_tokens: 9000,
		model_name: 'gpt-4',
		message_count: 12,
		breakdown: {
			system_prompt_tokens: 100,
			user_message_count: 2,
			user_message_tokens: 200,
			assistant_count: 3,
			assistant_tokens: 300,
			tool_result_count: 4,
			tool_result_tokens: 400,
			compact_notice_count: 1,
			compact_notice_tokens: 50,
		},
		compact: {
			compact_count: 2,
			last_compact_tokens_before: 8000,
			last_compact_tokens_after: 4000,
			last_compact_time_ms: 1700000001,
		},
		cache: {
			total_cache_read_tokens: 10,
			total_cache_creation_tokens: 20,
		},
		fixed_overhead: {
			tool_definition_tokens: 111,
			tool_definition_count: 5,
			skill_inject_tokens: 22,
			mcp_tool_tokens: 33,
			memory_inject_tokens: 44,
			rules_inject_tokens: 55,
		},
		system_prompt_parts: [{
			id: 'sys',
			label: 'System',
			tokens: 80,
			cache_scope: 'stable',
			volatility: 'low',
		}],
	};
}

function filledSessionUsageWire() {
	return {
		total_input_tokens: 1000,
		total_output_tokens: 200,
		total_thinking_tokens: 30,
		total_cache_read_tokens: 40,
		total_cache_creation_tokens: 50,
		total_tokens: 1320,
		total_turns: 6,
		model_usages: [{
			model_id: 'm-1',
			model_name: 'Model One',
			provider: 'openai',
			input_tokens: 10,
			output_tokens: 20,
			thinking_tokens: 3,
			total_tokens: 33,
			turn_count: 2,
		}],
		agent_details: [{
			agent_id: 'ag-d',
			agent_type: 'coder',
			model_id: 'm-1',
			input_tokens: 11,
			output_tokens: 21,
			thinking_tokens: 4,
			total_tokens: 36,
			turn_count: 1,
		}],
		profile_usages: [{
			profile_id: 'p-1',
			profile_name: 'Primary',
			provider: 'openai',
			model_id: 'gpt-4',
			chat_input_tokens: 15,
			chat_output_tokens: 25,
			compact_input_tokens: 5,
			compact_output_tokens: 6,
			thinking_tokens: 7,
			cache_read_tokens: 8,
			cache_creation_tokens: 9,
			total_tokens: 75,
			conversation_turn_count: 3,
			llm_request_count: 4,
			compact_request_count: 1,
			has_post_switch_chat: true,
			recall_input_tokens: 17,
			recall_output_tokens: 18,
			recall_request_count: 2,
		}],
	};
}

function filledContextWindowMapped() {
	return {
		contextWindowSize: 128000,
		estimatedContextTokens: 9000,
		modelName: 'gpt-4',
		messageCount: 12,
		breakdown: {
			systemPromptTokens: 100,
			userMessageCount: 2,
			userMessageTokens: 200,
			assistantCount: 3,
			assistantTokens: 300,
			toolResultCount: 4,
			toolResultTokens: 400,
			compactNoticeCount: 1,
			compactNoticeTokens: 50,
		},
		compact: {
			compactCount: 2,
			lastCompactTokensBefore: 8000,
			lastCompactTokensAfter: 4000,
			lastCompactTimeMs: 1700000001,
		},
		cache: {
			totalCacheReadTokens: 10,
			totalCacheCreationTokens: 20,
		},
		fixedOverhead: {
			toolDefinitionTokens: 111,
			toolDefinitionCount: 5,
			skillInjectTokens: 22,
			mcpToolTokens: 33,
			memoryInjectTokens: 44,
			rulesInjectTokens: 55,
		},
		systemPromptParts: [{
			id: 'sys',
			label: 'System',
			tokens: 80,
			cacheScope: 'stable',
			volatility: 'low',
		}],
	};
}

function filledSessionUsageMapped() {
	return {
		totalInputTokens: 1000,
		totalOutputTokens: 200,
		totalThinkingTokens: 30,
		totalCacheReadTokens: 40,
		totalCacheCreationTokens: 50,
		totalTokens: 1320,
		totalTurns: 6,
		modelUsages: [{
			modelId: 'm-1',
			modelName: 'Model One',
			provider: 'openai',
			inputTokens: 10,
			outputTokens: 20,
			thinkingTokens: 3,
			totalTokens: 33,
			turnCount: 2,
		}],
		agentDetails: [{
			agentId: 'ag-d',
			agentType: 'coder',
			modelId: 'm-1',
			inputTokens: 11,
			outputTokens: 21,
			thinkingTokens: 4,
			totalTokens: 36,
			turnCount: 1,
		}],
		profileUsages: [{
			profileId: 'p-1',
			profileName: 'Primary',
			provider: 'openai',
			modelId: 'gpt-4',
			chatInputTokens: 15,
			chatOutputTokens: 25,
			compactInputTokens: 5,
			compactOutputTokens: 6,
			thinkingTokens: 7,
			cacheReadTokens: 8,
			cacheCreationTokens: 9,
			totalTokens: 75,
			conversationTurnCount: 3,
			llmRequestCount: 4,
			compactRequestCount: 1,
			hasPostSwitchChat: true,
			recallInputTokens: 17,
			recallOutputTokens: 18,
			recallRequestCount: 2,
		}],
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcUsageUnaryWire.ts')));
	assert.ok(dir, 'grpcUsageUnaryWire.ts not found from cwd or import.meta');
	return dir;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}

function protoStrings(encoded: Uint8Array): Map<number, string> {
	const strings = new Map<number, string>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 2) {
			strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return strings;
}

function protoVarints(encoded: Uint8Array): Map<number, number> {
	const numbers = new Map<number, number>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 0) {
			numbers.set(field.field, Number(field.varint));
		}
	}
	return numbers;
}

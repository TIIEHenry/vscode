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

	test('decodeUsageResponse reads 1-4 AgentUsage 1-4; unused 10/11 unread', () => {
		const agent = Buffer.concat([
			encodeStringField(1, 'ag-1'),
			encodeInt64Field(2, 11),
			encodeInt64Field(3, 22),
			encodeInt32Field(4, 4),
			encodeStringField(5, 'unused-agent'),
		]);
		const encoded = Buffer.concat([
			encodeInt64Field(1, 1),
			encodeInt64Field(2, 2),
			encodeInt32Field(3, 3),
			encodeMessageField(4, agent),
			encodeStringField(5, 'unused-field'),
			encodeStringField(10, 'unused-window'),
			encodeStringField(11, 'unused-session'),
			encodeStringField(12, 'unused-spans'),
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
		});
		assert.ok(!('context_window' in wire));
		assert.ok(!('session_usage' in wire));
		assert.ok(!('recent_request_spans' in wire));
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
			contextWindow: undefined,
			sessionUsage: undefined,
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
		});
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
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bContextWindowInfo\b|\bSessionUsageInfo\b|\bMessageBreakdown\b/.test(source));
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
		assert.ok(!extractAsyncMethod(source, 'testModelProfile').includes('makeUnaryBytesClient'));
	});
});

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

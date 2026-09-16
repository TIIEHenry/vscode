/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	mapGetGlobalUsageResponse,
	mapGetSessionUsageResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	decodeGetGlobalUsageResponse,
	decodeGetSessionUsageResponse,
	encodeGetGlobalUsageRequest,
	encodeGetSessionUsageRequest,
} from '../../node/grpc/grpcTokenUsageUnaryWire.js';
import {
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc TokenUsage GetSessionUsage / GetGlobalUsage protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeGetSessionUsageRequest writes session_id=1; omits empty; not JSON', () => {
		const encoded = encodeGetSessionUsageRequest({ sessionId: 'sess-1' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(JSON.stringify({ session_id: 'sess-1' }).includes(Buffer.from(encoded).toString('utf8')), false);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(1));

		assert.strictEqual(encodeGetSessionUsageRequest({ sessionId: '' }).length, 0);
	});

	test('decodeGetSessionUsageResponse reads usage=1 TokenUsageData 1-8; unused unread', () => {
		const usage = Buffer.concat([
			encodeInt64Field(1, 11),
			encodeInt64Field(2, 22),
			encodeInt64Field(3, 33),
			encodeInt64Field(4, 44),
			encodeInt64Field(5, 55),
			encodeInt64Field(6, 1700000000000),
			encodeStringField(7, 'USD'),
			encodeInt64Field(8, 9),
			encodeStringField(9, 'unused-usage'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, usage),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeGetSessionUsageResponse(encoded);
		assert.deepStrictEqual(wire, {
			usage: {
				input_tokens: 11,
				output_tokens: 22,
				thinking_tokens: 33,
				cache_read_tokens: 44,
				cache_write_tokens: 55,
				total_cost_micros: 1700000000000,
				currency: 'USD',
				request_count: 9,
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapGetSessionUsageResponse(wire), {
			usage: {
				inputTokens: 11,
				outputTokens: 22,
				thinkingTokens: 33,
				cacheReadTokens: 44,
				cacheWriteTokens: 55,
				totalCostMicros: 1700000000000,
				currency: 'USD',
				requestCount: 9,
			},
		});

		const omittedZeros = decodeGetSessionUsageResponse(encodeMessageField(1, encodeStringField(7, 'EUR')));
		assert.deepStrictEqual(omittedZeros, {
			usage: {
				input_tokens: undefined,
				output_tokens: undefined,
				thinking_tokens: undefined,
				cache_read_tokens: undefined,
				cache_write_tokens: undefined,
				total_cost_micros: undefined,
				currency: 'EUR',
				request_count: undefined,
			},
		});
		assert.deepStrictEqual(mapGetSessionUsageResponse(omittedZeros), {
			usage: {
				inputTokens: 0,
				outputTokens: 0,
				thinkingTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				totalCostMicros: 0,
				currency: 'EUR',
				requestCount: 0,
			},
		});

		const empty = decodeGetSessionUsageResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { usage: undefined });
		assert.deepStrictEqual(mapGetSessionUsageResponse(empty), {
			usage: {
				inputTokens: 0,
				outputTokens: 0,
				thinkingTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				totalCostMicros: 0,
				currency: '',
				requestCount: 0,
			},
		});
	});

	test('encodeGetGlobalUsageRequest is empty proto, not JSON {}; reserved 1-10 unwritten', () => {
		const encoded = encodeGetGlobalUsageRequest();
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), '{}');
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({}));
		assert.deepStrictEqual(Array.from(readProtoFields(encoded)), []);
		for (let field = 1; field <= 10; field++) {
			assert.ok(!protoStrings(encoded).has(field), `reserved field ${field} must not be encoded`);
			assert.ok(!protoVarints(encoded).has(field), `reserved field ${field} must not be encoded`);
		}
	});

	test('decodeGetGlobalUsageResponse reads usage=1 TokenUsageData 1-8; unused unread', () => {
		const usage = Buffer.concat([
			encodeInt64Field(1, 1),
			encodeInt64Field(2, 2),
			encodeInt64Field(3, 3),
			encodeInt64Field(4, 4),
			encodeInt64Field(5, 5),
			encodeInt64Field(6, 6),
			encodeStringField(7, 'CNY'),
			encodeInt64Field(8, 8),
			encodeInt64Field(9, 99),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, usage),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeGetGlobalUsageResponse(encoded);
		assert.deepStrictEqual(wire, {
			usage: {
				input_tokens: 1,
				output_tokens: 2,
				thinking_tokens: 3,
				cache_read_tokens: 4,
				cache_write_tokens: 5,
				total_cost_micros: 6,
				currency: 'CNY',
				request_count: 8,
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapGetGlobalUsageResponse(wire), {
			usage: {
				inputTokens: 1,
				outputTokens: 2,
				thinkingTokens: 3,
				cacheReadTokens: 4,
				cacheWriteTokens: 5,
				totalCostMicros: 6,
				currency: 'CNY',
				requestCount: 8,
			},
		});

		const empty = decodeGetGlobalUsageResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { usage: undefined });
		assert.deepStrictEqual(mapGetGlobalUsageResponse(empty), {
			usage: {
				inputTokens: 0,
				outputTokens: 0,
				thinkingTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				totalCostMicros: 0,
				currency: '',
				requestCount: 0,
			},
		});
	});

	test('token usage unary wire is GetSessionUsage+GetGlobalUsage only; no JSON.stringify; grpcClient still JSON', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const candidates = [
			path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
			path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
		];
		const grpcDir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcTokenUsageUnaryWire.ts')));
		assert.ok(grpcDir, 'grpcTokenUsageUnaryWire.ts not found from cwd or import.meta');
		const source = fs.readFileSync(path.join(grpcDir, 'grpcTokenUsageUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeGetSessionUsageRequest\b/.test(source));
		assert.ok(/\bdecodeGetSessionUsageResponse\b/.test(source));
		assert.ok(/\bencodeGetGlobalUsageRequest\b/.test(source));
		assert.ok(/\bdecodeGetGlobalUsageResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bencodeInt64Field\b/.test(source));
		assert.ok(!/\bencodeInt32Field\b/.test(source));
		assert.ok(!/\bWatch\b/.test(source));
		assert.ok(!/\bgrpcClient\b/.test(source));
		assert.ok(!/\bonOpenConnection\b/.test(source));

		const client = fs.readFileSync(path.join(grpcDir, 'grpcClient.ts'), 'utf8');
		assert.ok(!client.includes('grpcTokenUsageUnaryWire'));
		assert.ok(!client.includes('encodeGetSessionUsageRequest'));
		assert.ok(!client.includes('decodeGetSessionUsageResponse'));
		assert.ok(!client.includes('encodeGetGlobalUsageRequest'));
		assert.ok(!client.includes('decodeGetGlobalUsageResponse'));
		const sessionBody = extractAsyncMethod(client, 'getSessionUsage');
		const globalBody = extractAsyncMethod(client, 'getGlobalUsage');
		assert.ok(sessionBody.includes('makeUnaryClient<'), 'getSessionUsage must stay JSON until a later slice wires bytes');
		assert.ok(globalBody.includes('makeUnaryClient<'), 'getGlobalUsage must stay JSON until a later slice wires bytes');
		assert.ok(!sessionBody.includes('makeUnaryBytesClient'), 'getSessionUsage must not be wired yet');
		assert.ok(!globalBody.includes('makeUnaryBytesClient'), 'getGlobalUsage must not be wired yet');
	});
});

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

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}

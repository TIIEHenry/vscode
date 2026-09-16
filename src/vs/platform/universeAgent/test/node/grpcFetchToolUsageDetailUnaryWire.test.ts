/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapFetchToolUsageDetailResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeFetchToolUsageDetailResponse,
	encodeFetchToolUsageDetailRequest,
} from '../../node/grpc/grpcFetchToolUsageDetailUnaryWire.js';
import {
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService FetchToolUsageDetail protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeFetchToolUsageDetailRequest writes session_id=1 tool_call_id=2; omits empty; not JSON', () => {
		const encoded = encodeFetchToolUsageDetailRequest({
			sessionId: 'sess-1',
			toolCallId: 'tc-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			tool_call_id: 'tc-1',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'tc-1',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const sessionOnly = encodeFetchToolUsageDetailRequest({
			sessionId: 'sess-1',
			toolCallId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodeFetchToolUsageDetailRequest({
			sessionId: '',
			toolCallId: '',
		}).length, 0);
	});

	test('decodeFetchToolUsageDetailResponse reads success=1 tool_call_id=2 error_message=4; field 3 and extra unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'tc-1'),
			encodeMessageField(3, encodeStringField(1, 'unused-context-source')),
			encodeStringField(4, 'not found'),
			encodeStringField(5, 'unused-extra'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeFetchToolUsageDetailResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			tool_call_id: 'tc-1',
			error_message: 'not found',
		});
		assert.ok(!('context_sources' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapFetchToolUsageDetailResponse(wire), {
			ok: true,
			toolCallId: 'tc-1',
			contextSources: [],
			message: 'not found',
		});

		const empty = decodeFetchToolUsageDetailResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			tool_call_id: undefined,
			error_message: undefined,
		});
		assert.deepStrictEqual(mapFetchToolUsageDetailResponse(empty), {
			ok: false,
			toolCallId: '',
			contextSources: [],
			message: undefined,
		});
	});

	test('fetch-tool-usage-detail unary wire is FetchToolUsageDetail only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcFetchToolUsageDetailUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(!source.includes('ContextSourceUsageProto'));
		assert.ok(/\bencodeFetchToolUsageDetailRequest\b/.test(source));
		assert.ok(/\bdecodeFetchToolUsageDetailResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\ballLengthDelimited\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('fetchToolUsageDetail uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const usage = extractAsyncMethod(source, 'fetchToolUsageDetail');
		assert.ok(usage.includes('makeUnaryBytesClient'), 'fetchToolUsageDetail must use makeUnaryBytesClient');
		assert.ok(usage.includes('encodeFetchToolUsageDetailRequest'), 'fetchToolUsageDetail must call encodeFetchToolUsageDetailRequest');
		assert.ok(usage.includes('decodeFetchToolUsageDetailResponse'), 'fetchToolUsageDetail must call decodeFetchToolUsageDetailResponse');
		assert.ok(usage.includes('mapFetchToolUsageDetailResponse'), 'fetchToolUsageDetail still calls mapFetchToolUsageDetailResponse');
		assert.ok(!usage.includes('makeUnaryClient<'), 'fetchToolUsageDetail must not use JSON makeUnaryClient');
		assert.ok(!usage.includes('JSON.stringify'), 'fetchToolUsageDetail must not JSON.stringify');

		assert.ok(source.includes('grpcFetchToolUsageDetailUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcFetchToolUsageDetailUnaryWire.ts')));
	assert.ok(dir, 'grpcFetchToolUsageDetailUnaryWire.ts not found from cwd or import.meta');
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

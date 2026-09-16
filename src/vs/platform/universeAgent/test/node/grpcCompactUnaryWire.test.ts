/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapCompactOutcome, mapCompactResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeCompactResponse,
	encodeCompactRequest,
} from '../../node/grpc/grpcCompactUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService Compact protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeCompactRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodeCompactRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'agent-9',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));

		const sessionOnly = encodeCompactRequest({
			sessionId: 'sess-1',
			agentId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodeCompactRequest({
			sessionId: '',
			agentId: '',
		}).length, 0);
	});

	test('decodeCompactResponse reads success=1 message=2 tokens 3-4 outcome=5 enum 0-7 reject_reason=6; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
			encodeInt64Field(3, 1000),
			encodeInt64Field(4, 400),
			encodeInt32Field(5, 2),
			encodeStringField(6, 'too-big'),
			encodeStringField(7, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeCompactResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'ok',
			tokens_before: 1000,
			tokens_after: 400,
			outcome: 2,
			reject_reason: 'too-big',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.strictEqual(mapCompactOutcome(wire.outcome), 'COMPACT_OUTCOME_SUCCEEDED');
		assert.deepStrictEqual(mapCompactResponse(wire), {
			ok: true,
			message: 'ok',
			tokensBefore: 1000,
			tokensAfter: 400,
			outcome: 'COMPACT_OUTCOME_SUCCEEDED',
			rejectReason: 'too-big',
		});

		const names = [0, 1, 2, 3, 4, 5, 6, 7].map(value => {
			const body = value === 0
				? encodeEnumInclZero(5, 0)
				: encodeInt32Field(5, value);
			return mapCompactOutcome(decodeCompactResponse(body).outcome);
		});
		assert.deepStrictEqual(names, [
			'COMPACT_OUTCOME_UNSPECIFIED',
			'COMPACT_OUTCOME_STARTED',
			'COMPACT_OUTCOME_SUCCEEDED',
			'COMPACT_OUTCOME_FAILED',
			'COMPACT_OUTCOME_APPLIED_PENDING_RETRY',
			'COMPACT_OUTCOME_APPLIED_DURABILITY_FAILED',
			'COMPACT_OUTCOME_APPLIED_IN_FLIGHT',
			'COMPACT_OUTCOME_APPLIED_NOT_CONFIGURED',
		]);

		const empty = decodeCompactResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
			tokens_before: undefined,
			tokens_after: undefined,
			outcome: undefined,
			reject_reason: undefined,
		});
		assert.strictEqual(mapCompactOutcome(empty.outcome), undefined);
		assert.deepStrictEqual(mapCompactResponse(empty), {
			ok: false,
			message: undefined,
			tokensBefore: undefined,
			tokensAfter: undefined,
			outcome: undefined,
			rejectReason: undefined,
		});
	});

	test('compact unary wire is Compact only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcCompactUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeCompactRequest\b/.test(source));
		assert.ok(/\bdecodeCompactResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bContextCompactedEvent\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('compact uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const body = extractAsyncMethod(source, 'compact');
		assert.ok(body.includes('makeUnaryBytesClient'), 'compact must use makeUnaryBytesClient');
		assert.ok(body.includes('encodeCompactRequest'), 'compact must call encodeCompactRequest');
		assert.ok(body.includes('decodeCompactResponse'), 'compact must call decodeCompactResponse');
		assert.ok(body.includes('mapCompactResponse'), 'compact still calls mapCompactResponse');
		assert.ok(!body.includes('makeUnaryClient<'), 'compact must not use JSON makeUnaryClient');
		assert.ok(!body.includes('JSON.stringify'), 'compact must not JSON.stringify');

		assert.ok(source.includes('grpcCompactUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

function encodeEnumInclZero(field: number, value: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(value),
	]);
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcCompactUnaryWire.ts')));
	assert.ok(dir, 'grpcCompactUnaryWire.ts not found from cwd or import.meta');
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

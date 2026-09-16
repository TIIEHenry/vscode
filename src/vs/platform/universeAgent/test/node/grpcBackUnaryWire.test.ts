/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapBackResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeBackResponse,
	encodeBackRequest,
} from '../../node/grpc/grpcBackUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService Back protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeBackRequest writes session_id=1 agent_id=2 operation_id=3; omits empty; not JSON', () => {
		const encoded = encodeBackRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
			operationId: 'op-7',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'agent-9',
			operation_id: 'op-7',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
			3: 'op-7',
		});
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoVarints(encoded).has(1));

		const noOp = encodeBackRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
			operationId: '',
		});
		assert.strictEqual(protoStrings(noOp).get(1), 'sess-1');
		assert.strictEqual(protoStrings(noOp).get(2), 'agent-9');
		assert.ok(!protoStrings(noOp).has(3));
		assert.notStrictEqual(noOp[0], 0x7b);

		const noAgent = encodeBackRequest({
			sessionId: 'sess-1',
			agentId: '',
			operationId: 'op-7',
		});
		assert.strictEqual(protoStrings(noAgent).get(1), 'sess-1');
		assert.ok(!protoStrings(noAgent).has(2));
		assert.strictEqual(protoStrings(noAgent).get(3), 'op-7');

		assert.strictEqual(encodeBackRequest({
			sessionId: '',
			agentId: '',
			operationId: '',
		}).length, 0);
	});

	test('decodeBackResponse reads success=1 message=2 current_turn_id=3; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'reverted'),
			encodeStringField(3, 'turn-4'),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeBackResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'reverted',
			current_turn_id: 'turn-4',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapBackResponse(wire), {
			ok: true,
			message: 'reverted',
			currentTurnId: 'turn-4',
		});

		const empty = decodeBackResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
			current_turn_id: undefined,
		});
		assert.deepStrictEqual(mapBackResponse(empty), {
			ok: false,
			message: undefined,
			currentTurnId: undefined,
		});
	});

	test('back unary wire is AgentService.Back only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcBackUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeBackRequest\b/.test(source));
		assert.ok(/\bdecodeBackResponse\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bClearSessionDemoFake\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcBackUnaryWire.ts')));
	assert.ok(dir, 'grpcBackUnaryWire.ts not found from cwd or import.meta');
	return dir;
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapBranchResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeBranchResponse,
	encodeBranchRequest,
} from '../../node/grpc/grpcBranchUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	lastVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService Branch protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeBranchRequest writes session_id=1 agent_id=2 branch_index=3 turn_id=4; keeps 0 and -1; omits empty turn; not JSON', () => {
		const encoded = encodeBranchRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			branchIndex: 1,
			turnId: 'turn-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'root',
			branch_index: 1,
			turn_id: 'turn-1',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'root',
			4: 'turn-1',
		});
		assert.strictEqual(signedProtoVarint(encoded, 3), 1);
		assert.ok(!protoStrings(encoded).has(5));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		assert.strictEqual(encodeInt32Field(3, 0).length, 0);

		const zeroIndex = encodeBranchRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			branchIndex: 0,
			turnId: '',
		});
		assert.notStrictEqual(zeroIndex[0], 0x7b);
		assert.strictEqual(protoStrings(zeroIndex).get(1), 'sess-1');
		assert.strictEqual(protoStrings(zeroIndex).get(2), 'root');
		assert.ok(!protoStrings(zeroIndex).has(4));
		assert.strictEqual(signedProtoVarint(zeroIndex, 3), 0);

		const listOnly = encodeBranchRequest({
			sessionId: '',
			agentId: '',
			branchIndex: -1,
			turnId: '',
		});
		assert.ok(listOnly.length > 0);
		assert.ok(!protoStrings(listOnly).has(1));
		assert.ok(!protoStrings(listOnly).has(2));
		assert.ok(!protoStrings(listOnly).has(4));
		assert.strictEqual(signedProtoVarint(listOnly, 3), -1);
		assert.notStrictEqual(listOnly[0], 0x7b);
	});

	test('decodeBranchResponse reads success=1 message=2 current_branch=3 total_branches=4 current_turn_id=5; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'switched'),
			encodeInt32Field(3, 2),
			encodeInt32Field(4, 3),
			encodeStringField(5, 'turn-9'),
			encodeStringField(6, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeBranchResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'switched',
			current_branch: 2,
			total_branches: 3,
			current_turn_id: 'turn-9',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapBranchResponse(wire), {
			ok: true,
			message: 'switched',
			currentBranch: 2,
			totalBranches: 3,
			currentTurnId: 'turn-9',
		});

		const empty = decodeBranchResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
			current_branch: undefined,
			total_branches: undefined,
			current_turn_id: undefined,
		});
		assert.deepStrictEqual(mapBranchResponse(empty), {
			ok: false,
			message: undefined,
			currentBranch: 0,
			totalBranches: 0,
			currentTurnId: undefined,
		});
	});
});

function signedProtoVarint(encoded: Uint8Array, fieldNumber: number): number {
	const value = lastVarint(readProtoFields(encoded), fieldNumber);
	assert.ok(value !== undefined, `missing varint field ${fieldNumber}`);
	return Number(BigInt.asIntN(32, value));
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

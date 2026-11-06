/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapPruneResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodePruneResponse,
	encodePruneRequest,
} from '../../node/grpc/grpcPruneUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService Prune protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodePruneRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodePruneRequest({
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
		assert.ok(!protoVarints(encoded).has(2));

		const sessionOnly = encodePruneRequest({
			sessionId: 'sess-1',
			agentId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodePruneRequest({
			sessionId: '',
			agentId: '',
		}).length, 0);
	});

	test('decodePruneResponse reads success=1 message=2 removed_count=3; 0 omit; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'pruned'),
			encodeInt32Field(3, 4),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodePruneResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'pruned',
			removed_count: 4,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapPruneResponse(wire), {
			ok: true,
			message: 'pruned',
			removedCount: 4,
		});

		const empty = decodePruneResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
			removed_count: undefined,
		});
		assert.deepStrictEqual(mapPruneResponse(empty), {
			ok: false,
			message: undefined,
			removedCount: 0,
		});

		const zeroPresent = decodePruneResponse(encodeVarintZero(3));
		assert.strictEqual(zeroPresent.removed_count, 0);
		assert.deepStrictEqual(mapPruneResponse(zeroPresent), {
			ok: false,
			message: undefined,
			removedCount: 0,
		});
		assert.strictEqual(encodeInt32Field(3, 0).length, 0);
	});
});

function encodeVarintZero(field: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(0),
	]);
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

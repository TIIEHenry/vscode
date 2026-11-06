/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentResetErrorResult } from '../../common/universeAgentTypes.js';
import {
	decodeResetErrorResponse,
	encodeResetErrorRequest,
	type ResetErrorResponseWire,
} from '../../node/grpc/grpcResetErrorUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService ResetError protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeResetErrorRequest writes node_id=1; omits empty; not JSON', () => {
		const encoded = encodeResetErrorRequest({
			nodeId: 'node-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			node_id: 'node-1',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'node-1',
		});
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(1));

		assert.strictEqual(encodeResetErrorRequest({
			nodeId: '',
		}).length, 0);
	});

	test('decodeResetErrorResponse reads success=1; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeResetErrorResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapResetErrorResponse(wire), {
			success: true,
		});

		const empty = decodeResetErrorResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
		});
		assert.deepStrictEqual(mapResetErrorResponse(empty), {
			success: false,
		});
		assert.deepStrictEqual(mapResetErrorResponse({ success: false }), { success: false });
	});
});

/** Same mapping as RemoteAgent.ResetError JSON unary (`success: wire.success === true`). */
function mapResetErrorResponse(wire: ResetErrorResponseWire): UniverseAgentResetErrorResult {
	return {
		success: wire.success === true,
	};
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

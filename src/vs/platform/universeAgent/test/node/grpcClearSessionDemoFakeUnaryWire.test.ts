/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentClearSessionDemoFakeResult } from '../../common/universeAgentTypes.js';
import {
	decodeClearSessionDemoFakeResponse,
	encodeClearSessionDemoFakeRequest,
	type ClearSessionDemoFakeResponseWire,
} from '../../node/grpc/grpcClearSessionDemoFakeUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService ClearSessionDemoFake protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeClearSessionDemoFakeRequest writes session_id=1; omits empty; not JSON', () => {
		const encoded = encodeClearSessionDemoFakeRequest({ sessionId: 'sess-1' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({ session_id: 'sess-1' }));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), { 1: 'sess-1' });
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(1));

		assert.strictEqual(encodeClearSessionDemoFakeRequest({ sessionId: '' }).length, 0);
	});

	test('decodeClearSessionDemoFakeResponse reads success=1 message=2 reason_code=3; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'cleared'),
			encodeStringField(3, 'OK'),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeClearSessionDemoFakeResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'cleared',
			reason_code: 'OK',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapClearSessionDemoFake(wire), {
			ok: true,
			message: 'cleared',
			reasonCode: 'OK',
		});

		const empty = decodeClearSessionDemoFakeResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
			reason_code: undefined,
		});
		assert.deepStrictEqual(mapClearSessionDemoFake(empty), {
			ok: false,
			message: undefined,
			reasonCode: '',
		});
	});
});

/** Same mapping as Agent.ClearSessionDemoFake JSON unary (`ok: wire.success === true`). */
function mapClearSessionDemoFake(wire: ClearSessionDemoFakeResponseWire): UniverseAgentClearSessionDemoFakeResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		reasonCode: wire.reason_code ?? '',
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

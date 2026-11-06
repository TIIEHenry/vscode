/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentDestroyRemoteSessionResult } from '../../common/universeAgentTypes.js';
import {
	decodeDestroyRemoteSessionResponse,
	encodeDestroyRemoteSessionRequest,
	type DestroyRemoteSessionResponseWire,
} from '../../node/grpc/grpcDestroyRemoteSessionUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService DestroyRemoteSession protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeDestroyRemoteSessionRequest writes call_id=1; omits empty; not JSON', () => {
		const encoded = encodeDestroyRemoteSessionRequest({
			callId: 'call-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			call_id: 'call-1',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'call-1',
		});
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(1));

		assert.strictEqual(encodeDestroyRemoteSessionRequest({
			callId: '',
		}).length, 0);
	});

	test('decodeDestroyRemoteSessionResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'destroyed'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeDestroyRemoteSessionResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'destroyed',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapDestroyRemoteSessionResponse(wire), {
			success: true,
			message: 'destroyed',
		});

		const empty = decodeDestroyRemoteSessionResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapDestroyRemoteSessionResponse(empty), {
			success: false,
			message: '',
		});

		const unusedOnly = decodeDestroyRemoteSessionResponse(encodeStringField(3, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			success: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapDestroyRemoteSessionResponse(unusedOnly), {
			success: false,
			message: '',
		});

		const explicitFalse = decodeDestroyRemoteSessionResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			success: false,
			message: undefined,
		});
		assert.deepStrictEqual(mapDestroyRemoteSessionResponse(explicitFalse), {
			success: false,
			message: '',
		});
	});
});

/** Same mapping as RemoteAgent.DestroyRemoteSession JSON unary (`success: wire.success === true`, `message: wire.message ?? ''`). */
function mapDestroyRemoteSessionResponse(wire: DestroyRemoteSessionResponseWire): UniverseAgentDestroyRemoteSessionResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
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

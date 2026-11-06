/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentDeleteRemoteAgentConfigResult } from '../../common/universeAgentTypes.js';
import {
	decodeDeleteConfigResponse,
	encodeDeleteConfigRequest,
	type DeleteRemoteAgentConfigResponseWire,
} from '../../node/grpc/grpcDeleteConfigUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService DeleteConfig protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeDeleteConfigRequest writes node_id=1; omits empty; not JSON', () => {
		const encoded = encodeDeleteConfigRequest({
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

		assert.strictEqual(encodeDeleteConfigRequest({
			nodeId: '',
		}).length, 0);
	});

	test('decodeDeleteConfigResponse reads success=1; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeDeleteConfigResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapDeleteRemoteAgentConfigResponse(wire), {
			success: true,
		});

		const empty = decodeDeleteConfigResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
		});
		assert.deepStrictEqual(mapDeleteRemoteAgentConfigResponse(empty), {
			success: false,
		});
		assert.deepStrictEqual(mapDeleteRemoteAgentConfigResponse({ success: false }), { success: false });

		const unusedOnly = decodeDeleteConfigResponse(encodeStringField(2, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			success: undefined,
		});
		assert.deepStrictEqual(mapDeleteRemoteAgentConfigResponse(unusedOnly), { success: false });

		const explicitFalse = decodeDeleteConfigResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			success: false,
		});
		assert.deepStrictEqual(mapDeleteRemoteAgentConfigResponse(explicitFalse), { success: false });
	});
});

/** Same mapping as RemoteAgent.DeleteConfig JSON unary (`success: wire.success === true`). */
function mapDeleteRemoteAgentConfigResponse(wire: DeleteRemoteAgentConfigResponseWire): UniverseAgentDeleteRemoteAgentConfigResult {
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentExitMaintenanceResult } from '../../common/universeAgentTypes.js';
import {
	decodeExitMaintenanceResponse,
	encodeExitMaintenanceRequest,
	type ExitMaintenanceResponseWire,
} from '../../node/grpc/grpcExitMaintenanceUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService ExitMaintenance protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeExitMaintenanceRequest writes node_id=1; omits empty; not JSON', () => {
		const encoded = encodeExitMaintenanceRequest({
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

		assert.strictEqual(encodeExitMaintenanceRequest({
			nodeId: '',
		}).length, 0);
	});

	test('decodeExitMaintenanceResponse reads success=1; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeExitMaintenanceResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapExitMaintenance(wire), {
			success: true,
		});

		const empty = decodeExitMaintenanceResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
		});
		assert.deepStrictEqual(mapExitMaintenance(empty), {
			success: false,
		});

		const encodedFalse = Buffer.from([0x08, 0x00]);
		const falsy = decodeExitMaintenanceResponse(encodedFalse);
		assert.deepStrictEqual(falsy, {
			success: false,
		});
		assert.deepStrictEqual(mapExitMaintenance(falsy), {
			success: false,
		});
	});
});

/** Same mapping as RemoteAgent.ExitMaintenance JSON unary (`success: wire.success === true`). */
function mapExitMaintenance(wire: ExitMaintenanceResponseWire): UniverseAgentExitMaintenanceResult {
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentSetMaintenanceResult } from '../../common/universeAgentTypes.js';
import {
	decodeSetMaintenanceResponse,
	encodeSetMaintenanceRequest,
	type SetMaintenanceResponseWire,
} from '../../node/grpc/grpcSetMaintenanceUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService SetMaintenance protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeSetMaintenanceRequest writes node_id=1; omits empty; not JSON', () => {
		const encoded = encodeSetMaintenanceRequest({
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

		assert.strictEqual(encodeSetMaintenanceRequest({
			nodeId: '',
		}).length, 0);
	});

	test('decodeSetMaintenanceResponse reads success=1; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSetMaintenanceResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSetMaintenance(wire), {
			success: true,
		});

		const empty = decodeSetMaintenanceResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
		});
		assert.deepStrictEqual(mapSetMaintenance(empty), {
			success: false,
		});

		const unusedOnly = decodeSetMaintenanceResponse(encodeStringField(2, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			success: undefined,
		});
		assert.deepStrictEqual(mapSetMaintenance(unusedOnly), {
			success: false,
		});

		const explicitFalse = decodeSetMaintenanceResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			success: false,
		});
		assert.deepStrictEqual(mapSetMaintenance(explicitFalse), {
			success: false,
		});
	});
});

/** Same mapping as RemoteAgent.SetMaintenance JSON unary (`success: wire.success === true`). */
function mapSetMaintenance(wire: SetMaintenanceResponseWire): UniverseAgentSetMaintenanceResult {
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

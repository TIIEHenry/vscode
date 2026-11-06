/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentReloadRemoteAgentsResult } from '../../common/universeAgentTypes.js';
import {
	decodeReloadRemoteAgentsResponse,
	encodeReloadRemoteAgentsRequest,
	type ReloadRemoteAgentsResponseWire,
} from '../../node/grpc/grpcReloadRemoteAgentsUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodePresentMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService Reload protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeReloadRemoteAgentsRequest is empty proto, not JSON {}', () => {
		const encoded = encodeReloadRemoteAgentsRequest();
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), '{}');
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({}));
		assert.deepStrictEqual(Array.from(readProtoFields(encoded)), []);
	});

	test('decodeReloadRemoteAgentsResponse reads success=1 added=2 removed=3 changed=4 errors=5 duration_ms=6; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'node-a'),
			encodeStringField(2, 'node-a2'),
			encodeStringField(3, 'node-b'),
			encodeStringField(4, 'node-c'),
			encodeStringField(5, 'node-d failed'),
			encodeInt64Field(6, 1),
			encodeInt64Field(6, 42),
			encodeStringField(7, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeReloadRemoteAgentsResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			added: ['node-a', 'node-a2'],
			removed: ['node-b'],
			changed: ['node-c'],
			errors: ['node-d failed'],
			duration_ms: 42,
		});
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapReloadRemoteAgentsResponse(wire), {
			success: true,
			added: ['node-a', 'node-a2'],
			removed: ['node-b'],
			changed: ['node-c'],
			errors: ['node-d failed'],
			durationMs: 42,
		});
	});

	test('decodeReloadRemoteAgentsResponse omitted/false/empty-string lists; lastVarint duration_ms', () => {
		const empty = decodeReloadRemoteAgentsResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			added: [],
			removed: [],
			changed: [],
			errors: [],
			duration_ms: undefined,
		});
		assert.deepStrictEqual(mapReloadRemoteAgentsResponse(empty), {
			success: false,
			added: [],
			removed: [],
			changed: [],
			errors: [],
			durationMs: 0,
		});

		const unusedOnly = decodeReloadRemoteAgentsResponse(encodeStringField(7, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			success: undefined,
			added: [],
			removed: [],
			changed: [],
			errors: [],
			duration_ms: undefined,
		});
		assert.deepStrictEqual(mapReloadRemoteAgentsResponse(unusedOnly), {
			success: false,
			added: [],
			removed: [],
			changed: [],
			errors: [],
			durationMs: 0,
		});

		const explicitFalse = decodeReloadRemoteAgentsResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			success: false,
			added: [],
			removed: [],
			changed: [],
			errors: [],
			duration_ms: undefined,
		});
		assert.deepStrictEqual(mapReloadRemoteAgentsResponse(explicitFalse), {
			success: false,
			added: [],
			removed: [],
			changed: [],
			errors: [],
			durationMs: 0,
		});

		const emptyStrings = decodeReloadRemoteAgentsResponse(Buffer.concat([
			encodePresentMessageField(2, new Uint8Array(0)),
			encodePresentMessageField(3, new Uint8Array(0)),
			encodePresentMessageField(4, new Uint8Array(0)),
			encodePresentMessageField(5, new Uint8Array(0)),
		]));
		assert.deepStrictEqual(emptyStrings, {
			success: undefined,
			added: [''],
			removed: [''],
			changed: [''],
			errors: [''],
			duration_ms: undefined,
		});
		assert.deepStrictEqual(mapReloadRemoteAgentsResponse(emptyStrings), {
			success: false,
			added: [''],
			removed: [''],
			changed: [''],
			errors: [''],
			durationMs: 0,
		});
	});
});

/** TEST-only mapper: same shape as catalog `mapReloadRemoteAgentsResponse`. */
function mapReloadRemoteAgentsResponse(wire: ReloadRemoteAgentsResponseWire): UniverseAgentReloadRemoteAgentsResult {
	return {
		success: wire.success === true,
		added: (wire.added ?? []).map(id => id ?? ''),
		removed: (wire.removed ?? []).map(id => id ?? ''),
		changed: (wire.changed ?? []).map(id => id ?? ''),
		errors: (wire.errors ?? []).map(id => id ?? ''),
		durationMs: requiredInt64(wire.duration_ms),
	};
}

function requiredInt64(value: number | string | undefined): number {
	if (value === undefined || value === '') {
		return 0;
	}
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

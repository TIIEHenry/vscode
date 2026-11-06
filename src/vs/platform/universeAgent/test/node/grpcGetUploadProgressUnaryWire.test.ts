/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentGetUploadProgressResult } from '../../common/universeAgentTypes.js';
import {
	decodeGetUploadProgressResponse,
	encodeGetUploadProgressRequest,
	type UploadProgressResponseWire,
} from '../../node/grpc/grpcGetUploadProgressUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc FileTransferService GetUploadProgress protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeGetUploadProgressRequest writes transfer_id=1 session_id=2; omits empty; not JSON', () => {
		const encoded = encodeGetUploadProgressRequest({
			transferId: 'xfer-1',
			sessionId: 'sess-9',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			transfer_id: 'xfer-1',
			session_id: 'sess-9',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'xfer-1',
			2: 'sess-9',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const transferOnly = encodeGetUploadProgressRequest({
			transferId: 'xfer-1',
			sessionId: '',
		});
		assert.strictEqual(protoStrings(transferOnly).get(1), 'xfer-1');
		assert.ok(!protoStrings(transferOnly).has(2));
		assert.notStrictEqual(transferOnly[0], 0x7b);

		assert.strictEqual(encodeGetUploadProgressRequest({
			transferId: '',
			sessionId: '',
		}).length, 0);
	});

	test('decodeGetUploadProgressResponse reads exists=1 bytes_received=2 partial_path=3; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeInt64Field(2, 1),
			encodeInt64Field(2, 4096),
			encodeStringField(3, 'partial/xfer-1.bin'),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeGetUploadProgressResponse(encoded);
		assert.deepStrictEqual(wire, {
			exists: true,
			bytes_received: 4096,
			partial_path: 'partial/xfer-1.bin',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapUploadProgressResponse(wire), {
			exists: true,
			bytesReceived: 4096,
			partialPath: 'partial/xfer-1.bin',
		});

		const empty = decodeGetUploadProgressResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			exists: undefined,
			bytes_received: undefined,
			partial_path: undefined,
		});
		assert.deepStrictEqual(mapUploadProgressResponse(empty), {
			exists: false,
			bytesReceived: 0,
			partialPath: '',
		});

		const unusedOnly = decodeGetUploadProgressResponse(encodeStringField(4, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			exists: undefined,
			bytes_received: undefined,
			partial_path: undefined,
		});
		assert.deepStrictEqual(mapUploadProgressResponse(unusedOnly), {
			exists: false,
			bytesReceived: 0,
			partialPath: '',
		});

		const explicitFalse = decodeGetUploadProgressResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			exists: false,
			bytes_received: undefined,
			partial_path: undefined,
		});
		assert.deepStrictEqual(mapUploadProgressResponse(explicitFalse), {
			exists: false,
			bytesReceived: 0,
			partialPath: '',
		});
	});
});

/** TEST mapper: same shape as catalog `mapUploadProgressResponse`. */
function mapUploadProgressResponse(wire: UploadProgressResponseWire): UniverseAgentGetUploadProgressResult {
	return {
		exists: wire.exists === true,
		bytesReceived: requiredInt64(wire.bytes_received),
		partialPath: wire.partial_path ?? '',
	};
}

function requiredInt64(value: number | string | undefined): number {
	if (value === undefined || value === '') {
		return 0;
	}
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
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

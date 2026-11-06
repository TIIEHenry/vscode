/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapMemoryRebuildEvent } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeMemoryRebuildEvent,
	encodeMemoryRebuildRequest,
} from '../../node/grpc/grpcMemoryRebuildStreamWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc MemoryService Rebuild protobuf server-stream wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeMemoryRebuildRequest writes scope=1 dry_run=2; omits empty/false; not JSON', () => {
		const encoded = encodeMemoryRebuildRequest({
			scope: 'global',
			dryRun: true,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			scope: 'global',
			dry_run: true,
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'global');
		assert.strictEqual(protoVarints(encoded).get(2), 1);
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(3));

		const scopeOnly = encodeMemoryRebuildRequest({
			scope: 'global',
			dryRun: false,
		});
		assert.strictEqual(protoStrings(scopeOnly).get(1), 'global');
		assert.ok(!protoVarints(scopeOnly).has(2));
		assert.notStrictEqual(scopeOnly[0], 0x7b);

		const dryRunOnly = encodeMemoryRebuildRequest({
			scope: '',
			dryRun: true,
		});
		assert.ok(!protoStrings(dryRunOnly).has(1));
		assert.strictEqual(protoVarints(dryRunOnly).get(2), 1);
		assert.notStrictEqual(dryRunOnly[0], 0x7b);

		assert.strictEqual(encodeMemoryRebuildRequest({
			scope: '',
			dryRun: false,
		}).length, 0);
	});

	test('decodeMemoryRebuildEvent reads phase=1 message=2 progress=3 files_processed=4 files_total=5 then mapMemoryRebuildEvent; unused unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'scanning'),
			encodeStringField(2, 'listing files'),
			encodeInt32Field(3, 40),
			encodeInt32Field(4, 8),
			encodeInt32Field(5, 20),
			encodeStringField(6, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeMemoryRebuildEvent(encoded);
		assert.deepStrictEqual(wire, {
			phase: 'scanning',
			message: 'listing files',
			progress: 40,
			files_processed: 8,
			files_total: 20,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapMemoryRebuildEvent(wire), {
			phase: 'scanning',
			message: 'listing files',
			progress: 40,
			filesProcessed: 8,
			filesTotal: 20,
		});

		const empty = decodeMemoryRebuildEvent(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			phase: undefined,
			message: undefined,
			progress: undefined,
			files_processed: undefined,
			files_total: undefined,
		});
		assert.deepStrictEqual(mapMemoryRebuildEvent(empty), {
			phase: '',
			message: '',
			progress: 0,
			filesProcessed: 0,
			filesTotal: 0,
		});

		const unusedOnly = decodeMemoryRebuildEvent(encodeStringField(6, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			phase: undefined,
			message: undefined,
			progress: undefined,
			files_processed: undefined,
			files_total: undefined,
		});
		assert.deepStrictEqual(mapMemoryRebuildEvent(unusedOnly), {
			phase: '',
			message: '',
			progress: 0,
			filesProcessed: 0,
			filesTotal: 0,
		});

		const lastWins = decodeMemoryRebuildEvent(Buffer.concat([
			encodeInt32Field(3, 1),
			encodeInt32Field(3, 40),
			encodeInt32Field(4, 1),
			encodeInt32Field(4, 8),
			encodeInt32Field(5, 1),
			encodeInt32Field(5, 20),
		]));
		assert.strictEqual(lastWins.progress, 40);
		assert.strictEqual(lastWins.files_processed, 8);
		assert.strictEqual(lastWins.files_total, 20);
		assert.strictEqual(mapMemoryRebuildEvent(lastWins).progress, 40);
		assert.strictEqual(mapMemoryRebuildEvent(lastWins).filesProcessed, 8);
		assert.strictEqual(mapMemoryRebuildEvent(lastWins).filesTotal, 20);

		const zeroPresent = decodeMemoryRebuildEvent(Buffer.concat([
			encodeVarintZero(3),
			encodeVarintZero(4),
			encodeVarintZero(5),
		]));
		assert.strictEqual(zeroPresent.progress, 0);
		assert.strictEqual(zeroPresent.files_processed, 0);
		assert.strictEqual(zeroPresent.files_total, 0);
		assert.strictEqual(mapMemoryRebuildEvent(zeroPresent).progress, 0);
		assert.strictEqual(mapMemoryRebuildEvent(zeroPresent).filesProcessed, 0);
		assert.strictEqual(mapMemoryRebuildEvent(zeroPresent).filesTotal, 0);
		assert.strictEqual(encodeInt32Field(3, 0).length, 0);
		assert.strictEqual(encodeInt32Field(4, 0).length, 0);
		assert.strictEqual(encodeInt32Field(5, 0).length, 0);
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

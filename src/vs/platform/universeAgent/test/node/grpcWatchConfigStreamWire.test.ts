/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapConfigChangedEvent } from '../../node/grpc/grpcClientMappers.js';
import { decodeConfigChangedEvent, encodeWatchConfigRequest } from '../../node/grpc/grpcWatchConfigStreamWire.js';
import {
	allLengthDelimited,
	encodePresentMessageField,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc ConfigService Watch protobuf server-stream wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeWatchConfigRequest writes repeated keys=1; empty keys and empty strings omitted; not JSON', () => {
		const encoded = encodeWatchConfigRequest({ keys: ['theme', 'locale'] });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		const keys = allLengthDelimited(readProtoFields(encoded), 1).map(value => Buffer.from(value).toString('utf8'));
		assert.deepStrictEqual(keys, ['theme', 'locale']);
		assert.ok(!protoVarints(encoded).has(1));

		const skippedEmpty = encodeWatchConfigRequest({ keys: ['theme', ''] });
		assert.deepStrictEqual(allLengthDelimited(readProtoFields(skippedEmpty), 1).map(value => Buffer.from(value).toString('utf8')), ['theme']);

		assert.strictEqual(encodeWatchConfigRequest({ keys: [] }).length, 0);
		assert.strictEqual(encodeWatchConfigRequest({ keys: [''] }).length, 0);
	});

	test('decodeConfigChangedEvent reads key=1 old_value=2 new_value=3 scope=4 timestamp=5; maps through mapConfigChangedEvent', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'theme'),
			encodeStringField(2, 'light'),
			encodeStringField(3, 'dark'),
			encodeStringField(4, 'session'),
			encodeVarintZero(5),
			encodeStringField(9, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeConfigChangedEvent(encoded);
		assert.deepStrictEqual(wire, {
			key: 'theme',
			old_value: 'light',
			new_value: 'dark',
			scope: 'session',
			timestamp: 0,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapConfigChangedEvent(wire), {
			key: 'theme',
			oldValue: 'light',
			newValue: 'dark',
			scope: 'session',
			timestamp: 0,
		});

		const emptyStrings = decodeConfigChangedEvent(Buffer.concat([
			encodePresentMessageField(1, new Uint8Array(0)),
			encodePresentMessageField(2, new Uint8Array(0)),
			encodePresentMessageField(3, new Uint8Array(0)),
			encodePresentMessageField(4, new Uint8Array(0)),
		]));
		assert.deepStrictEqual(mapConfigChangedEvent(emptyStrings), {
			key: '',
			oldValue: '',
			newValue: '',
			scope: '',
			timestamp: 0,
		});
		assert.deepStrictEqual(mapConfigChangedEvent(decodeConfigChangedEvent(new Uint8Array(0))), {
			key: '',
			oldValue: '',
			newValue: '',
			scope: '',
			timestamp: 0,
		});
	});
});

function encodeVarintZero(field: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(0),
	]);
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

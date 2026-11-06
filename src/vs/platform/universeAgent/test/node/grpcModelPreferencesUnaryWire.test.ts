/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type {
	UniverseAgentGetModelPreferencesResult,
	UniverseAgentSetModelPreferencesResult,
} from '../../common/universeAgentTypes.js';
import {
	decodeGetModelPreferencesResponse,
	decodeSetModelPreferencesResponse,
	encodeGetModelPreferencesRequest,
	encodeSetModelPreferencesRequest,
	type GetModelPreferencesResponseWire,
	type SetModelPreferencesResponseWire,
} from '../../node/grpc/grpcModelPreferencesUnaryWire.js';
import {
	encodeInt32Field,
	encodePresentMessageField,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc ConfigService Get/Set ModelPreferences protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeGetModelPreferencesRequest writes session_id=1; omits empty; not JSON', () => {
		const encoded = encodeGetModelPreferencesRequest({ sessionId: 'sess-1' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({ session_id: 'sess-1' }));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), { 1: 'sess-1' });
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(1));

		assert.strictEqual(encodeGetModelPreferencesRequest({ sessionId: '' }).length, 0);
	});

	test('decodeGetModelPreferencesResponse reads min_level=1 max_cost=2 min_speed=3 strategy=4; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 5),
			encodeStringField(2, 'middle'),
			encodeStringField(3, 'fast'),
			encodeStringField(4, 'level'),
			encodeStringField(5, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeGetModelPreferencesResponse(encoded);
		assert.deepStrictEqual(wire, {
			min_level: 5,
			max_cost: 'middle',
			min_speed: 'fast',
			strategy: 'level',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapGetModelPreferences(wire), {
			minLevel: 5,
			maxCost: 'middle',
			minSpeed: 'fast',
			strategy: 'level',
		});

		const zeroLevel = decodeGetModelPreferencesResponse(encodeInt32InclZero(1, 0));
		assert.strictEqual(zeroLevel.min_level, 0);
		assert.deepStrictEqual(mapGetModelPreferences(zeroLevel), {
			minLevel: 0,
			maxCost: '',
			minSpeed: '',
			strategy: '',
		});

		const empty = decodeGetModelPreferencesResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			min_level: undefined,
			max_cost: undefined,
			min_speed: undefined,
			strategy: undefined,
		});
		assert.deepStrictEqual(mapGetModelPreferences(empty), {
			minLevel: 0,
			maxCost: '',
			minSpeed: '',
			strategy: '',
		});
	});

	test('encodeSetModelPreferencesRequest writes session_id=1 min_level=2 max_cost=3 min_speed=4 strategy=5; omits empty/0; not JSON', () => {
		const encoded = encodeSetModelPreferencesRequest({
			sessionId: 'sess-1',
			minLevel: 5,
			maxCost: 'middle',
			minSpeed: 'fast',
			strategy: 'level',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			min_level: 5,
			max_cost: 'middle',
			min_speed: 'fast',
			strategy: 'level',
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoVarints(encoded).get(2), 5);
		assert.strictEqual(protoStrings(encoded).get(3), 'middle');
		assert.strictEqual(protoStrings(encoded).get(4), 'fast');
		assert.strictEqual(protoStrings(encoded).get(5), 'level');
		assert.ok(!protoStrings(encoded).has(6));
		assert.ok(!protoVarints(encoded).has(1));

		const omitted = encodeSetModelPreferencesRequest({
			sessionId: '',
			minLevel: 0,
			maxCost: '',
			minSpeed: '',
			strategy: '',
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(2));
	});

	test('decodeSetModelPreferencesResponse reads nested preferences=1 via encodePresentMessageField; unused unread', () => {
		const nested = Buffer.concat([
			encodeInt32Field(1, 5),
			encodeStringField(2, 'middle'),
			encodeStringField(3, 'fast'),
			encodeStringField(4, 'level'),
			encodeStringField(5, 'unused-nested'),
		]);
		const encoded = Buffer.concat([
			encodePresentMessageField(1, nested),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSetModelPreferencesResponse(encoded);
		assert.deepStrictEqual(wire, {
			preferences: {
				min_level: 5,
				max_cost: 'middle',
				min_speed: 'fast',
				strategy: 'level',
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSetModelPreferences(wire), {
			minLevel: 5,
			maxCost: 'middle',
			minSpeed: 'fast',
			strategy: 'level',
		});

		const emptyNested = decodeSetModelPreferencesResponse(encodePresentMessageField(1, new Uint8Array(0)));
		assert.deepStrictEqual(emptyNested, {
			preferences: {
				min_level: undefined,
				max_cost: undefined,
				min_speed: undefined,
				strategy: undefined,
			},
		});
		assert.deepStrictEqual(mapSetModelPreferences(emptyNested), {
			minLevel: 0,
			maxCost: '',
			minSpeed: '',
			strategy: '',
		});

		const empty = decodeSetModelPreferencesResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { preferences: undefined });
		assert.deepStrictEqual(mapSetModelPreferences(empty), {
			minLevel: 0,
			maxCost: '',
			minSpeed: '',
			strategy: '',
		});
	});
});

/** Same mapping as Config.GetModelPreferences JSON unary. */
function mapGetModelPreferences(wire: GetModelPreferencesResponseWire): UniverseAgentGetModelPreferencesResult {
	return {
		minLevel: wire.min_level ?? 0,
		maxCost: wire.max_cost ?? '',
		minSpeed: wire.min_speed ?? '',
		strategy: wire.strategy ?? '',
	};
}

/** Same mapping as Config.SetModelPreferences JSON unary. */
function mapSetModelPreferences(wire: SetModelPreferencesResponseWire): UniverseAgentSetModelPreferencesResult {
	const prefs = wire.preferences;
	return {
		minLevel: prefs?.min_level ?? 0,
		maxCost: prefs?.max_cost ?? '',
		minSpeed: prefs?.min_speed ?? '',
		strategy: prefs?.strategy ?? '',
	};
}

function encodeInt32InclZero(field: number, value: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(value),
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

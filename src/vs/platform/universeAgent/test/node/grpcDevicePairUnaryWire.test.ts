/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { asUnaryProtoBytes } from '../../node/grpc/grpcClientCalls.js';
import {
	mapListPendingResponse,
	mapPairApproveResponse,
	mapPairRejectResponse,
	mapRevokeResponse,
	mapRotateTokenResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	decodeListPendingResponse,
	decodePairApproveResponse,
	decodePairRejectResponse,
	decodeRevokeResponse,
	decodeRotateTokenResponse,
	encodeListPendingRequest,
	encodePairApproveRequest,
	encodePairRejectRequest,
	encodeRevokeRequest,
	encodeRotateTokenRequest,
} from '../../node/grpc/grpcDevicePairUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc DeviceService PairApprove / PairReject / ListPending / RotateToken protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodePairApproveRequest writes pairing_code=1 display_name=2 role=3; omits empty; not JSON', () => {
		const encoded = encodePairApproveRequest({
			pairingCode: '123456',
			displayName: 'Phone',
			role: 'operator',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			pairing_code: '123456',
			display_name: 'Phone',
			role: 'operator',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: '123456',
			2: 'Phone',
			3: 'operator',
		});
		const omitted = encodePairApproveRequest({ pairingCode: '', displayName: '', role: '' });
		assert.strictEqual(omitted.length, 0);
		assert.notStrictEqual(omitted[0], 0x7b);
	});

	test('decodePairApproveResponse reads success=1 device_id=2 message=4; reserved 3 unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'dev-9'),
			encodeStringField(3, 'stolen-pair-secret'),
			encodeStringField(4, 'paired'),
			encodeStringField(5, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodePairApproveResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			device_id: 'dev-9',
			message: 'paired',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.strictEqual(JSON.stringify(wire).includes('stolen'), false);
		assert.deepStrictEqual(Object.keys(wire), ['success', 'device_id', 'message']);
		assert.deepStrictEqual(mapPairApproveResponse(wire), {
			success: true,
			deviceId: 'dev-9',
			message: 'paired',
		});
		const empty = decodePairApproveResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			device_id: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapPairApproveResponse(empty), {
			success: false,
			deviceId: '',
			message: '',
		});
	});

	test('encodePairRejectRequest writes pairing_code=1; omits empty; not JSON', () => {
		const encoded = encodePairRejectRequest({ pairingCode: '654321' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({ pairing_code: '654321' }));
		assert.strictEqual(protoStrings(encoded).get(1), '654321');
		assert.ok(!protoStrings(encoded).has(2));
		assert.strictEqual(encodePairRejectRequest({ pairingCode: '' }).length, 0);
	});

	test('decodePairRejectResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'rejected'),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodePairRejectResponse(encoded);
		assert.deepStrictEqual(wire, { success: true, message: 'rejected' });
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapPairRejectResponse(wire), { success: true, message: 'rejected' });
		assert.deepStrictEqual(mapPairRejectResponse(decodePairRejectResponse(new Uint8Array(0))), {
			success: false,
			message: '',
		});
	});

	test('encodeRevokeRequest writes device_id=1; omits empty; not JSON', () => {
		const encoded = encodeRevokeRequest({ deviceId: 'dev-r' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({ device_id: 'dev-r' }));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), { 1: 'dev-r' });
		assert.ok(!protoStrings(encoded).has(2));
		assert.strictEqual(encodeRevokeRequest({ deviceId: '' }).length, 0);
	});

	test('decodeRevokeResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'revoked'),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeRevokeResponse(encoded);
		assert.deepStrictEqual(wire, { success: true, message: 'revoked' });
		assert.deepStrictEqual(Object.keys(wire), ['success', 'message']);
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapRevokeResponse(wire), { success: true, message: 'revoked' });
		assert.deepStrictEqual(mapRevokeResponse(decodeRevokeResponse(new Uint8Array(0))), {
			success: false,
			message: '',
		});
	});

	test('encodeRotateTokenRequest writes device_id=1 only; reserved 2 never encoded', () => {
		const encoded = encodeRotateTokenRequest({ deviceId: 'dev-1' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({ device_id: 'dev-1' }));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), { 1: 'dev-1' });
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(2));
		assert.strictEqual(encodeRotateTokenRequest({ deviceId: '' }).length, 0);
	});

	test('decodeRotateTokenResponse reads success=1 message=3; reserved 2 unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'stolen-rotate-secret'),
			encodeStringField(3, 'rotated'),
			encodeStringField(4, 'unused-field'),
		]);
		const wire = decodeRotateTokenResponse(encoded);
		assert.deepStrictEqual(wire, { success: true, message: 'rotated' });
		assert.deepStrictEqual(Object.keys(wire), ['success', 'message']);
		assert.strictEqual(JSON.stringify(wire).includes('stolen'), false);
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapRotateTokenResponse(wire), { success: true, message: 'rotated' });
		assert.deepStrictEqual(mapRotateTokenResponse(decodeRotateTokenResponse(new Uint8Array(0))), {
			success: false,
			message: '',
		});
	});

	test('encodeListPendingRequest is empty proto, not JSON {}', () => {
		const encoded = encodeListPendingRequest();
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), '{}');
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({}));
		assert.deepStrictEqual(Array.from(readProtoFields(encoded)), []);
		const framed = asUnaryProtoBytes(encoded);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
		assert.notStrictEqual(framed[0], 0x7b);
	});

	test('decodeListPendingResponse reads pending=1 nested 1-6 then mapper; unused unread', () => {
		const pending = Buffer.concat([
			encodeStringField(1, '111222'),
			encodeStringField(2, 'dev-p'),
			encodeStringField(3, 'Tablet'),
			encodeStringField(4, 'android'),
			encodeInt64Field(5, 1700000000),
			encodeInt32Field(6, 45),
			encodeStringField(7, 'unused-nested'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, pending),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeListPendingResponse(encoded);
		assert.deepStrictEqual(wire, {
			pending: [{
				pairing_code: '111222',
				device_id: 'dev-p',
				display_name: 'Tablet',
				platform: 'android',
				requested_at: 1700000000,
				expires_in_seconds: 45,
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapListPendingResponse(wire), {
			pending: [{
				pairingCode: '111222',
				deviceId: 'dev-p',
				displayName: 'Tablet',
				platform: 'android',
				requestedAt: 1700000000,
				expiresInSeconds: 45,
			}],
		});
		const empty = decodeListPendingResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { pending: [] });
		assert.deepStrictEqual(mapListPendingResponse(empty), { pending: [] });
		assert.deepStrictEqual(mapListPendingResponse(decodeListPendingResponse(encodeMessageField(1, encodeStringField(1, 'only')))), {
			pending: [{
				pairingCode: 'only',
				deviceId: '',
				displayName: '',
				platform: '',
				requestedAt: 0,
				expiresInSeconds: 0,
			}],
		});
	});
});

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

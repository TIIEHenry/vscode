/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	CONNECT_WIRE_PROTOCOL,
	decodeAuthNonceResponse,
	decodeConnectResponse,
	encodeAuthNonceRequest,
	encodeDeviceAuthConnectRequest,
} from '../../node/grpc/grpcHandshakeWire.js';
import { encodeBytesField, encodeInt64Field, encodeStringField, readProtoFields } from '../../node/grpc/grpcProtoCodec.js';

suite('grpc handshake protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeAuthNonceRequest writes string + raw bytes, not JSON', () => {
		const identity = 'a'.repeat(64);
		const publicKey = Uint8Array.from([0x01, 0x02, 0x03]);
		const encoded = encodeAuthNonceRequest({
			clientIdentityId: identity,
			clientPublicKey: publicKey,
		});

		assert.strictEqual(encoded[0], 0x0a, 'field 1 string tag');
		assert.notStrictEqual(encoded[0], 0x7b, 'must not start with JSON {');
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields.length, 2);
		assert.strictEqual(Buffer.from(fields[0].wireType === 2 ? fields[0].bytes : []).toString('utf8'), identity);
		assert.deepStrictEqual(Array.from(fields[1].wireType === 2 ? fields[1].bytes : []), [1, 2, 3]);
	});

	test('decodeAuthNonceResponse reads UTF-8 fingerprint bytes', () => {
		const nonce = Uint8Array.from([0xaa, 0xbb]);
		const fingerprint = 'ab'.repeat(32);
		const encoded = Buffer.concat([
			encodeBytesField(1, nonce),
			encodeInt64Field(2, 1_700_000_000_000),
			encodeStringField(3, 'engine-id-1'),
			encodeBytesField(4, Buffer.from(fingerprint, 'utf8')),
		]);

		const decoded = decodeAuthNonceResponse(encoded);
		assert.deepStrictEqual(Array.from(decoded.authNonce), [0xaa, 0xbb]);
		assert.strictEqual(decoded.expiresAtMs, 1_700_000_000_000);
		assert.strictEqual(decoded.engineIdentityId, 'engine-id-1');
		assert.strictEqual(decoded.engineCertFingerprint, fingerprint);
	});

	test('encodeDeviceAuthConnectRequest carries protocol ints and nested DeviceAuth', () => {
		const request = {
			clientIdentityId: 'id-1',
			clientPublicKey: Uint8Array.from([9]),
			authNonce: Uint8Array.from([8]),
			signature: Uint8Array.from([7]),
			protocolVersion: '1',
		};
		const encoded = encodeDeviceAuthConnectRequest(request);
		const fields = readProtoFields(encoded);
		const numbers = new Map<number, number>();
		let deviceAuth: Uint8Array | undefined;
		for (const field of fields) {
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
			if (field.field === 12 && field.wireType === 2) {
				deviceAuth = field.bytes;
			}
		}

		assert.strictEqual(numbers.get(1), CONNECT_WIRE_PROTOCOL.minProtocol);
		assert.strictEqual(numbers.get(2), CONNECT_WIRE_PROTOCOL.maxProtocol);
		assert.strictEqual(numbers.get(9), CONNECT_WIRE_PROTOCOL.protocolMajor);
		assert.ok(deviceAuth);
		const authFields = readProtoFields(deviceAuth);
		assert.strictEqual(Buffer.from(authFields[0].wireType === 2 ? authFields[0].bytes : []).toString('utf8'), 'id-1');
		assert.deepStrictEqual(Array.from(authFields[3].wireType === 2 ? authFields[3].bytes : []), [7]);
	});

	test('decodeConnectResponse maps pairing_nonce bytes to base64', () => {
		const pairingNonce = Uint8Array.from([0x11, 0x22, 0x33]);
		const caps = Buffer.concat([
			encodeStringField(1, 'Connect'),
			encodeStringField(2, 'SessionEvent'),
		]);
		const encoded = Buffer.concat([
			encodeBytesField(3, caps),
			encodeStringField(5, '/tmp/ws'),
			encodeBytesField(7, pairingNonce),
			encodeStringField(8, 'ABCD-EFGH'),
		]);
		const decoded = decodeConnectResponse(encoded);
		assert.strictEqual(decoded.workDir, '/tmp/ws');
		assert.strictEqual(decoded.sessionToken, undefined);
		assert.strictEqual(decoded.pairingNonce, Buffer.from(pairingNonce).toString('base64'));
		assert.strictEqual(decoded.sasCode, 'ABCD-EFGH');
		assert.deepStrictEqual(decoded.methods, ['Connect']);
		assert.deepStrictEqual(decoded.events, ['SessionEvent']);
	});

	test('decodeConnectResponse leaves sasCode undefined when field 8 is absent', () => {
		const pairingNonce = Uint8Array.from([0x11, 0x22, 0x33]);
		const encoded = Buffer.concat([
			encodeBytesField(7, pairingNonce),
		]);
		const decoded = decodeConnectResponse(encoded);
		assert.strictEqual(decoded.pairingNonce, Buffer.from(pairingNonce).toString('base64'));
		assert.strictEqual(decoded.sasCode, undefined);
	});
});

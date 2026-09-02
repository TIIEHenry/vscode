/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createHash, generateKeyPairSync, verify as verifyBytes } from 'node:crypto';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	buildDeviceAuthTranscript,
	createEd25519DeviceAuthSigner,
	derivePairingSasCode,
	isPairingSasCode,
	verifyPairingSas,
} from '../../node/deviceGrant/device-grant-crypto.js';

suite('ADR-261 Device Grant crypto (KAT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const KAT1_ENGINE_IDENTITY_ID = '0123456789abcdef'.repeat(4);
	const KAT1_ENGINE_CERT_FINGERPRINT = 'fedcba9876543210'.repeat(4);
	const KAT1_CLIENT_PUBLIC_KEY = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index));
	const KAT1_AUTH_NONCE = new Uint8Array(32).fill(0x11);
	const KAT1_PAIRING_NONCE = new Uint8Array(32).fill(0xaa);
	const KAT1_CLIENT_IDENTITY_ID = 'a'.repeat(64);

	test('KAT-1 auth transcript sha256 and SAS 0H4X-JVFQ', () => {
		const transcript = buildDeviceAuthTranscript({
			engineIdentityId: KAT1_ENGINE_IDENTITY_ID,
			engineCertFingerprint: KAT1_ENGINE_CERT_FINGERPRINT,
			authNonce: KAT1_AUTH_NONCE,
			clientIdentityId: KAT1_CLIENT_IDENTITY_ID,
			protocolVersion: '1',
		});
		assert.strictEqual(
			createHash('sha256').update(transcript).digest('hex'),
			'b168bbea8726dd9724f365ffce475a9d432c31c258bf13c417a572cf8f73e81e',
		);

		const sasInput = {
			engineIdentityId: KAT1_ENGINE_IDENTITY_ID,
			engineCertFingerprint: KAT1_ENGINE_CERT_FINGERPRINT,
			clientPublicKey: KAT1_CLIENT_PUBLIC_KEY,
			pairingNonce: KAT1_PAIRING_NONCE,
			protocolVersion: '1',
		};
		assert.strictEqual(derivePairingSasCode(sasInput), '0H4X-JVFQ');
		assert.strictEqual(
			createHash('sha256').update(
				Buffer.concat([
					Buffer.from(KAT1_ENGINE_IDENTITY_ID, 'utf8'),
					Buffer.from(KAT1_ENGINE_CERT_FINGERPRINT, 'utf8'),
					Buffer.from(KAT1_CLIENT_PUBLIC_KEY),
					Buffer.from(KAT1_PAIRING_NONCE),
					Buffer.from('1', 'utf8'),
				]),
			).digest('hex'),
			'0449d96df7330cc65c313018e20a7a331cfd9d8d91b4d95e1de3eb893fe9aefc',
		);
		assert.ok(verifyPairingSas(sasInput, '0H4X-JVFQ'));
		assert.ok(!verifyPairingSas(sasInput, '0H4X-JVFQ'.toLowerCase()));
		assert.ok(!isPairingSasCode('0H4X-JVFU'));

		const { privateKey, publicKey } = generateKeyPairSync('ed25519');
		const signer = createEd25519DeviceAuthSigner(privateKey.export({ type: 'pkcs8', format: 'pem' }));
		const signature = signer({
			engineIdentityId: KAT1_ENGINE_IDENTITY_ID,
			engineCertFingerprint: KAT1_ENGINE_CERT_FINGERPRINT,
			authNonce: KAT1_AUTH_NONCE,
			clientIdentityId: KAT1_CLIENT_IDENTITY_ID,
			protocolVersion: '1',
		});
		assert.strictEqual(signature.length, 64);
		assert.ok(verifyBytes(null, transcript, publicKey, Buffer.from(signature)));
	});

	test('KAT-2 auth transcript sha256 and SAS C1RD-95QA', () => {
		const engineIdentityId = '0'.repeat(64);
		const engineCertFingerprint = 'f'.repeat(64);
		const clientPublicKey = new Uint8Array(32).fill(0xff);
		const pairingNonce = Uint8Array.from(Array.from({ length: 32 }, (_, index) => 0x1f - index));
		const authNonce = new Uint8Array(32).fill(0x00);
		const clientIdentityId = '0123456789abcdef'.repeat(4);
		const protocolVersion = '2';

		const transcript = buildDeviceAuthTranscript({
			engineIdentityId,
			engineCertFingerprint,
			authNonce,
			clientIdentityId,
			protocolVersion,
		});
		assert.strictEqual(
			createHash('sha256').update(transcript).digest('hex'),
			'ebe989459b3998df08233cd8eeb0b9efda6cef0b2daaadd8f4bf254db52b1a54',
		);

		const sasInput = {
			engineIdentityId,
			engineCertFingerprint,
			clientPublicKey,
			pairingNonce,
			protocolVersion,
		};
		assert.strictEqual(derivePairingSasCode(sasInput), 'C1RD-95QA');
		assert.strictEqual(
			createHash('sha256').update(
				Buffer.concat([
					Buffer.from(engineIdentityId, 'utf8'),
					Buffer.from(engineCertFingerprint, 'utf8'),
					Buffer.from(clientPublicKey),
					Buffer.from(pairingNonce),
					Buffer.from(protocolVersion, 'utf8'),
				]),
			).digest('hex'),
			'6070d496ea515b0f6e3b2c9f6993e65dcbf5a708be3dcf6b5f8d84e42e2109fc',
		);
	});
});

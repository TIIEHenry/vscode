/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { finalizeConnectProfileResult, readConnectProfileSasCode } from '../../common/connectProfileResult.js';

suite('connectProfileResult', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('pairingPending without sasCode or recoverTrust fails closed', () => {
		const result = finalizeConnectProfileResult({
			ok: true,
			path: 'direct',
			pairingPending: true,
		});
		assert.strictEqual(result.ok, false);
		if (!result.ok) {
			assert.strictEqual(result.code, 'pairing_required');
		}
	});

	test('pairingPending keeps concrete sasCode for IPC', () => {
		const result = finalizeConnectProfileResult({
			ok: true,
			path: 'direct',
			pairingPending: true,
			sasCode: '  ABCD-EFGH  ',
			engineIdentityId: 'eng-1',
		});
		assert.strictEqual(result.ok, true);
		if (result.ok) {
			assert.strictEqual(result.pairingPending, true);
			assert.strictEqual(result.sasCode, 'ABCD-EFGH');
			assert.strictEqual(result.engineIdentityId, 'eng-1');
			assert.strictEqual(result.recoverTrust, undefined);
		}
	});

	test('recoverTrust without fingerprint fails closed', () => {
		const result = finalizeConnectProfileResult({
			ok: true,
			path: 'direct',
			pairingPending: true,
			recoverTrust: true,
			engineIdentityId: 'eng-1',
		});
		assert.strictEqual(result.ok, false);
		if (!result.ok) {
			assert.strictEqual(result.code, 'trust_missing');
		}
	});

	test('recoverTrust keeps fingerprint and drops sasCode', () => {
		const result = finalizeConnectProfileResult({
			ok: true,
			path: 'direct',
			pairingPending: true,
			recoverTrust: true,
			engineIdentityId: 'eng-1',
			leafSha256Hex: 'ab'.repeat(32),
			sasCode: 'ABCD-EFGH',
		});
		assert.strictEqual(result.ok, true);
		if (result.ok) {
			assert.strictEqual(result.recoverTrust, true);
			assert.strictEqual(result.leafSha256Hex, 'ab'.repeat(32));
			assert.strictEqual(result.sasCode, undefined);
			assert.strictEqual(result.pairingPending, true);
		}
	});

	test('placeholder sasCode is not a handshake code', () => {
		assert.strictEqual(readConnectProfileSasCode({ sasCode: 'XXXX-XXXX' }), undefined);
		assert.strictEqual(readConnectProfileSasCode({ sasCode: 'ABCD-EFGH' }), 'ABCD-EFGH');
	});
});

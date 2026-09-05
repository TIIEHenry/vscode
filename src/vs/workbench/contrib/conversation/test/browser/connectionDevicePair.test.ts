/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	canSendConnectionDevicePairRequest,
	connectionDevicePairIds,
	formatConnectionPendingPairLabel,
} from '../../browser/connectionDevicePair.js';

suite('Connection device pair bind', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ListPending / PairApprove / PairReject gate is connected + hook; empty ids still send', () => {
		assert.strictEqual(canSendConnectionDevicePairRequest(false, true), false);
		assert.strictEqual(canSendConnectionDevicePairRequest(true, false), false);
		assert.strictEqual(canSendConnectionDevicePairRequest(true, true), true);
		assert.deepStrictEqual(connectionDevicePairIds(undefined, undefined), {
			pairingCode: '',
			displayName: '',
			role: '',
		});
		assert.deepStrictEqual(connectionDevicePairIds('', { pairingCode: '', displayName: '', role: '' }), {
			pairingCode: '',
			displayName: '',
			role: '',
		});
		assert.deepStrictEqual(connectionDevicePairIds('  code  ', undefined), {
			pairingCode: '  code  ',
			displayName: '',
			role: '',
		});
		assert.deepStrictEqual(connectionDevicePairIds('typed', { pairingCode: 'sel', displayName: 'Phone', role: 'peer' }), {
			pairingCode: 'sel',
			displayName: 'Phone',
			role: 'peer',
		});
	});

	test('pending pair label keeps empty fields as-is', () => {
		assert.strictEqual(formatConnectionPendingPairLabel({
			pairingCode: '',
			deviceId: '',
			displayName: '',
			platform: '',
			requestedAt: 0,
			expiresInSeconds: 0,
		}), ' —  — ');
		assert.strictEqual(formatConnectionPendingPairLabel({
			pairingCode: '123456',
			deviceId: 'dev-1',
			displayName: 'Phone',
			platform: 'ios',
			requestedAt: 1,
			expiresInSeconds: 30,
		}), 'Phone — 123456 — ios');
	});
});

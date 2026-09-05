/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	canSendConnectionDeviceRevokeRequest,
	connectionDeviceRevokeIds,
} from '../../browser/connectionDeviceRevoke.js';

suite('Connection device revoke bind', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Revoke gate is connected + hook; empty ids still send', () => {
		assert.strictEqual(canSendConnectionDeviceRevokeRequest(false, true), false);
		assert.strictEqual(canSendConnectionDeviceRevokeRequest(true, false), false);
		assert.strictEqual(canSendConnectionDeviceRevokeRequest(true, true), true);
		assert.deepStrictEqual(connectionDeviceRevokeIds(undefined), { deviceId: '' });
		assert.deepStrictEqual(connectionDeviceRevokeIds(''), { deviceId: '' });
		assert.deepStrictEqual(connectionDeviceRevokeIds('  dev  '), { deviceId: '  dev  ' });
		assert.deepStrictEqual(connectionDeviceRevokeIds('dev-1'), { deviceId: 'dev-1' });
	});
});

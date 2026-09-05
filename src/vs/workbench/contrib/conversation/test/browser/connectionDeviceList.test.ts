/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	canSendConnectionDeviceListRequest,
	canSendConnectionDeviceRotateToken,
	CONNECTION_DEVICE_ROTATE_TOKEN_LABEL,
	connectionDeviceRotateTokenIds,
	formatConnectionPairedDeviceLabel,
	toConnectionPairedDevice,
} from '../../browser/connectionDeviceList.js';

suite('Connection device list bind', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ListDevices gate is connected + hook; empty ids stay empty', () => {
		assert.strictEqual(canSendConnectionDeviceListRequest(false, true), false);
		assert.strictEqual(canSendConnectionDeviceListRequest(true, false), false);
		assert.strictEqual(canSendConnectionDeviceListRequest(true, true), true);
		assert.deepStrictEqual(toConnectionPairedDevice({
			deviceId: '',
			displayName: '',
			role: '',
			platform: '',
			pairedAt: 0,
			lastSeenAt: 0,
			active: false,
		}), {
			id: '',
			name: '',
			presence: 'OFFLINE',
			engineStatus: 'NOT_SERVING',
			engineIdentityId: '',
			revoked: false,
		});
		assert.deepStrictEqual(toConnectionPairedDevice({
			deviceId: '  dev  ',
			displayName: '  Phone  ',
			role: 'peer',
			platform: 'ios',
			pairedAt: 1,
			lastSeenAt: 2,
			active: true,
		}), {
			id: '  dev  ',
			name: '  Phone  ',
			presence: 'ONLINE',
			engineStatus: 'SERVING',
			engineIdentityId: '  dev  ',
			revoked: false,
		});
	});

	test('RotateToken gate is connected + hook; empty ids stay empty', () => {
		assert.strictEqual(canSendConnectionDeviceRotateToken(false, true), false);
		assert.strictEqual(canSendConnectionDeviceRotateToken(true, false), false);
		assert.strictEqual(canSendConnectionDeviceRotateToken(true, true), true);
		assert.deepStrictEqual(connectionDeviceRotateTokenIds(undefined), { deviceId: '' });
		assert.deepStrictEqual(connectionDeviceRotateTokenIds({ id: '' }), { deviceId: '' });
		assert.deepStrictEqual(connectionDeviceRotateTokenIds({ id: '  dev  ' }), { deviceId: '  dev  ' });
		assert.strictEqual(CONNECTION_DEVICE_ROTATE_TOKEN_LABEL, 'Rotate Token');
	});

	test('paired device label keeps empty fields as-is', () => {
		assert.strictEqual(formatConnectionPairedDeviceLabel({
			deviceId: '',
			displayName: '',
			role: '',
			platform: '',
			pairedAt: 0,
			lastSeenAt: 0,
			active: false,
		}), ' —  — ');
		assert.strictEqual(formatConnectionPairedDeviceLabel({
			deviceId: 'dev-1',
			displayName: 'Phone',
			role: 'peer',
			platform: 'ios',
			pairedAt: 1,
			lastSeenAt: 2,
			active: true,
		}), 'Phone — peer — ios');
	});
});

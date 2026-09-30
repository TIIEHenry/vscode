/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { formatWebUiAvailableUrl } from '../../node/webUiAvailableUrl.js';

suite('formatWebUiAvailableUrl', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('uses concrete unicast IPv4 address and port', () => {
		assert.strictEqual(formatWebUiAvailableUrl('192.168.1.5', 8080), 'http://192.168.1.5:8080');
	});

	test('maps wildcard bind addresses to localhost', () => {
		assert.strictEqual(formatWebUiAvailableUrl('0.0.0.0', 8080), 'http://localhost:8080');
		assert.strictEqual(formatWebUiAvailableUrl('::', 8080), 'http://localhost:8080');
	});

	test('brackets unbracketed IPv6 loopback', () => {
		assert.strictEqual(formatWebUiAvailableUrl('::1', 8080), 'http://[::1]:8080');
	});

	test('omits port 80 from the URL', () => {
		assert.strictEqual(formatWebUiAvailableUrl('192.168.1.5', 80), 'http://192.168.1.5');
		assert.strictEqual(formatWebUiAvailableUrl('0.0.0.0', 80), 'http://localhost');
		assert.strictEqual(formatWebUiAvailableUrl('::1', 80), 'http://[::1]');
	});
});

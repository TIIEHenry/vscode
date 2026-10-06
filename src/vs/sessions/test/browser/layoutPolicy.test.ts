/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import {
	COMPACT_DESKTOP_MAX_WIDTH,
	isCompactDesktopViewport,
	isSessionsPhoneViewport,
	PHONE_MAX_WIDTH,
	SessionsLayoutPolicy,
} from '../../browser/layoutPolicy.js';

suite('SessionsLayoutPolicy compact desktop', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('isCompactDesktopViewport is false at and above 600px on desktop platforms', () => {
		assert.strictEqual(isCompactDesktopViewport(COMPACT_DESKTOP_MAX_WIDTH - 1), true);
		assert.strictEqual(isCompactDesktopViewport(COMPACT_DESKTOP_MAX_WIDTH), false);
		assert.strictEqual(isCompactDesktopViewport(900), false);
	});

	test('isSessionsPhoneViewport follows platform gate (desktop host never phone at 390px)', () => {
		assert.strictEqual(isSessionsPhoneViewport(390), false);
		assert.strictEqual(isSessionsPhoneViewport(PHONE_MAX_WIDTH - 1), false);
	});

	test('update tracks compactDesktop separately from viewportClass on desktop', () => {
		const policy = new SessionsLayoutPolicy();
		policy.update(900, 800);
		assert.strictEqual(policy.viewportClass.get(), 'desktop');
		assert.strictEqual(policy.isCompactDesktop.get(), false);

		policy.update(390, 800);
		assert.strictEqual(policy.viewportClass.get(), 'desktop');
		assert.strictEqual(policy.isCompactDesktop.get(), true);

		policy.update(599, 800);
		assert.strictEqual(policy.isCompactDesktop.get(), true);

		policy.update(600, 800);
		assert.strictEqual(policy.isCompactDesktop.get(), false);
	});
});

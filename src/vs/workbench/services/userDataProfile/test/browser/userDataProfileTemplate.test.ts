/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isUserDataProfileTemplate } from '../../common/userDataProfile.js';

suite('isUserDataProfileTemplate', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('arrays are not templates', () => {
		assert.strictEqual(isUserDataProfileTemplate([]), false);
		assert.strictEqual(isUserDataProfileTemplate(['x']), false);

		const withExtensions = Object.assign(['x'], { extensions: 'ms-python.python' });
		assert.strictEqual(isUserDataProfileTemplate(withExtensions), false);
	});

	test('settings string without a name is still a template', () => {
		assert.strictEqual(isUserDataProfileTemplate({ settings: '{"editor.fontSize":14}' }), true);
		assert.strictEqual(isUserDataProfileTemplate({ name: 1, settings: '{"editor.fontSize":14}' }), true);
	});

	test('non-string settings and null are not templates', () => {
		assert.strictEqual(isUserDataProfileTemplate({ settings: 1 }), false);
		assert.strictEqual(isUserDataProfileTemplate(null), false);
	});
});

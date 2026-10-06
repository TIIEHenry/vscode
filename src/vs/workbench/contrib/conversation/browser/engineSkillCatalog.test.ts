/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { isSkillBodyDirty } from './engineSkillCatalog.js';

suite('engineSkillCatalog body dirty', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('isSkillBodyDirty before SkillInfo lands treats non-empty editor as dirty', () => {
		assert.strictEqual(isSkillBodyDirty('', undefined), false);
		assert.strictEqual(isSkillBodyDirty('draft while loading', undefined), true);
		assert.strictEqual(isSkillBodyDirty('same', 'same'), false);
		assert.strictEqual(isSkillBodyDirty('edited', 'loaded'), true);
	});
});

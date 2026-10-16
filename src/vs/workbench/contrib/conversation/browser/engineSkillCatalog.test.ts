/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { groupSkillsBySource, isSkillBodyDirty } from './engineSkillCatalog.js';

suite('engineSkillCatalog body dirty', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('isSkillBodyDirty before SkillInfo lands treats non-empty editor as dirty', () => {
		assert.strictEqual(isSkillBodyDirty('', undefined), false);
		assert.strictEqual(isSkillBodyDirty('draft while loading', undefined), true);
		assert.strictEqual(isSkillBodyDirty('same', 'same'), false);
		assert.strictEqual(isSkillBodyDirty('edited', 'loaded'), true);
	});

	test('groupSkillsBySource groups skills by source with correct length (S9)', () => {
		const skills = [
			{ id: 's1', name: 'Skill 1', source: 'bundled' as const, enabled: true },
			{ id: 's2', name: 'Skill 2', source: 'bundled' as const, enabled: true },
			{ id: 's3', name: 'Skill 3', source: 'user' as const, enabled: true },
		];
		const groups = groupSkillsBySource(skills);
		const bundledGroup = groups.get('bundled');
		const userGroup = groups.get('user');
		assert.strictEqual(bundledGroup?.length, 2);
		assert.strictEqual(userGroup?.length, 1);
	});
});

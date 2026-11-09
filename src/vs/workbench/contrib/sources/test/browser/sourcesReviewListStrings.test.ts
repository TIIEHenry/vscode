/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { sourcesReviewListEmptyMessage, sourcesReviewListHeaderHint, sourcesReviewRevealMissHint } from '../../browser/sourcesReviewListStrings.js';

suite('Sources - Review list strings', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('header hint states the Review surface is read-only in user terms, with window-local progress', () => {
		assert.ok(sourcesReviewListHeaderHint.includes('this window'));
		assert.ok(sourcesReviewListHeaderHint.includes('doesn\'t change files'), 'PRD-005: the panel top says this surface is read-only');
		assert.ok(!sourcesReviewListHeaderHint.includes('Read-only'));
		assert.ok(!sourcesReviewListHeaderHint.includes('not connected'));
		assert.ok(!sourcesReviewListHeaderHint.includes('Preview'), 'must not advertise Preview open behavior');
		assert.ok(!sourcesReviewListHeaderHint.includes('FORK'), 'must not advertise FORK diff gap');
		assert.ok(!sourcesReviewListHeaderHint.match(/comment/i), 'must not imply review comments are available');
	});

	test('filter empty messages are distinct by reason', () => {
		const unreviewed = sourcesReviewListEmptyMessage('unreviewedDone');
		const path = sourcesReviewListEmptyMessage('pathNoIntersection');
		const text = sourcesReviewListEmptyMessage('textFilterEmpty');
		assert.notStrictEqual(unreviewed, path);
		assert.notStrictEqual(path, text);
		assert.notStrictEqual(unreviewed, text);
		assert.ok(!unreviewed.includes('No matching changes'));
		assert.ok(!path.includes('No matching changes'));
		assert.ok(!text.includes('No matching changes'));
		assert.strictEqual(sourcesReviewRevealMissHint, 'Couldn\'t find this step in the conversation.');
	});
});

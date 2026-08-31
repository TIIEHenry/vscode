/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { sourcesReviewListHeaderHint } from '../../browser/sourcesReviewListStrings.js';

suite('Sources - Review list strings', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('header hint is honest about Preview vs Diff FORK and missing review engine', () => {
		assert.ok(sourcesReviewListHeaderHint.includes('Read-only'));
		assert.ok(sourcesReviewListHeaderHint.includes('Preview'));
		assert.ok(sourcesReviewListHeaderHint.includes('Diff'));
		assert.ok(sourcesReviewListHeaderHint.includes('FORK'));
		assert.ok(sourcesReviewListHeaderHint.includes('not connected'));
		assert.ok(!sourcesReviewListHeaderHint.match(/comment/i), 'must not imply review comments are available');
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { sourcesReviewListHeaderHint } from '../../browser/sourcesReviewListStrings.js';

suite('Sources - Review list strings', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('header hint is honest about read-only list and window-local progress', () => {
		assert.ok(sourcesReviewListHeaderHint.includes('Read-only'));
		assert.ok(sourcesReviewListHeaderHint.includes('window only'));
		assert.ok(!sourcesReviewListHeaderHint.includes('not connected'));
		assert.ok(!sourcesReviewListHeaderHint.includes('Preview'), 'must not advertise Preview open behavior');
		assert.ok(!sourcesReviewListHeaderHint.includes('FORK'), 'must not advertise FORK diff gap');
		assert.ok(!sourcesReviewListHeaderHint.match(/comment/i), 'must not imply review comments are available');
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { testingExplorerFilterEmptyReason } from '../../common/testingExplorerFilterEmpty.js';

suite('Testing - explorer filter empty reason', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('discovery in progress or an empty collection stays silent', function () {
		const miss = { providersBusy: false, collectionEmpty: false, filterText: 'zzz', visibleCount: 0 };
		assert.strictEqual(testingExplorerFilterEmptyReason({ ...miss, providersBusy: true }), undefined);
		assert.strictEqual(testingExplorerFilterEmptyReason({ ...miss, collectionEmpty: true }), undefined);
		assert.strictEqual(testingExplorerFilterEmptyReason({ ...miss, providersBusy: true, collectionEmpty: true }), undefined);
	});

	test('a blank or whitespace filter does not claim a miss', function () {
		assert.strictEqual(testingExplorerFilterEmptyReason({
			providersBusy: false,
			collectionEmpty: false,
			filterText: '',
			visibleCount: 0,
		}), undefined);
		assert.strictEqual(testingExplorerFilterEmptyReason({
			providersBusy: false,
			collectionEmpty: false,
			filterText: '   ',
			visibleCount: 0,
		}), undefined);
	});

	test('a trimmed filter with a non-empty collection and no visible rows is a miss', function () {
		for (const filterText of ['zzz', ' missing ', '@failed', '@executed', '@doc', '@openedFiles']) {
			assert.strictEqual(testingExplorerFilterEmptyReason({
				providersBusy: false,
				collectionEmpty: false,
				filterText,
				visibleCount: 0,
			}), 'noMatching', filterText);
		}
	});

	test('any visible row stays silent', function () {
		assert.strictEqual(testingExplorerFilterEmptyReason({
			providersBusy: false,
			collectionEmpty: false,
			filterText: '@failed',
			visibleCount: 1,
		}), undefined);
	});
});

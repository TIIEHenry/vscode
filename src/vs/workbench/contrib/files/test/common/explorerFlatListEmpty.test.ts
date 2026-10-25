/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { explorerFlatListEmptyReason } from '../../common/explorerFlatListEmpty.js';

suite('Files - explorer flat list empty reason', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('tree mode and an unresolved directory stay silent', function () {
		assert.strictEqual(explorerFlatListEmptyReason({
			flat: false,
			query: 'x',
			directoryResolved: true,
			childCount: 0,
			visibleCount: 0,
		}), undefined);
		assert.strictEqual(explorerFlatListEmptyReason({
			flat: true,
			query: 'x',
			directoryResolved: false,
			childCount: 0,
			visibleCount: 0,
		}), undefined);
	});

	test('a resolved directory with no children is empty even when a query is typed', function () {
		assert.strictEqual(explorerFlatListEmptyReason({
			flat: true,
			query: '',
			directoryResolved: true,
			childCount: 0,
			visibleCount: 0,
		}), 'emptyFolder');
		assert.strictEqual(explorerFlatListEmptyReason({
			flat: true,
			query: 'missing',
			directoryResolved: true,
			childCount: 0,
			visibleCount: 0,
		}), 'emptyFolder');
	});

	test('a non-blank query with children but no visible rows is a filter miss', function () {
		assert.strictEqual(explorerFlatListEmptyReason({
			flat: true,
			query: ' missing ',
			directoryResolved: true,
			childCount: 2,
			visibleCount: 0,
		}), 'noMatching');
	});

	test('a blank query or any visible row does not claim a miss', function () {
		assert.strictEqual(explorerFlatListEmptyReason({
			flat: true,
			query: '   ',
			directoryResolved: true,
			childCount: 2,
			visibleCount: 0,
		}), undefined);
		assert.strictEqual(explorerFlatListEmptyReason({
			flat: true,
			query: 'missing',
			directoryResolved: true,
			childCount: 2,
			visibleCount: 1,
		}), undefined);
	});
});

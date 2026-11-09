/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ISearchComplete } from '../../../../services/search/common/search.js';
import { AttachedSearchDecision, SearchResultOwner } from '../../browser/searchEditorResultOwner.js';

suite('SearchResultOwner', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function searchOperation(): Promise<ISearchComplete> {
		return Promise.resolve<ISearchComplete>({ results: [], messages: [] });
	}

	test('the latest search of this pane owns its operation', () => {
		const owner = new SearchResultOwner();
		const first = searchOperation();
		owner.searchStarting();
		owner.searchStarted(first);

		assert.strictEqual(owner.decideAttached(first), AttachedSearchDecision.Owned);
		assert.strictEqual(owner.owns(first), true);
	});

	test('a later search for another input in the same pane takes ownership away', () => {
		const owner = new SearchResultOwner();
		const first = searchOperation();
		const second = searchOperation();
		owner.searchStarting();
		owner.searchStarted(first);
		owner.searchStarting();
		owner.searchStarted(second);

		assert.strictEqual(owner.decideAttached(first), AttachedSearchDecision.NotOwned);
		assert.strictEqual(owner.owns(first), false);
		assert.strictEqual(owner.decideAttached(second), AttachedSearchDecision.Owned);
	});

	test('a pane that never ran the attached search does not own it', () => {
		const owner = new SearchResultOwner();

		assert.strictEqual(owner.decideAttached(searchOperation()), AttachedSearchDecision.NotOwned);
	});

	test('an input without an operation was already handled by another completion', () => {
		const owner = new SearchResultOwner();
		assert.strictEqual(owner.decideAttached(undefined), AttachedSearchDecision.Handled);

		owner.searchStarting();
		owner.searchStarted(searchOperation());
		assert.strictEqual(owner.decideAttached(undefined), AttachedSearchDecision.Handled);
		assert.strictEqual(owner.owns(undefined), false);
	});

	test('a search that throws before handing back its operation leaves no owner', () => {
		const owner = new SearchResultOwner();
		const first = searchOperation();
		owner.searchStarting();
		owner.searchStarted(first);
		owner.searchStarting();

		assert.strictEqual(owner.decideAttached(first), AttachedSearchDecision.NotOwned);
		assert.strictEqual(owner.owns(first), false);
	});
});
